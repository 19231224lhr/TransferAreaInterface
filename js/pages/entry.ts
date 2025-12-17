/**
 * Entry Page Module (Reactive Version)
 * 
 * 使用响应式绑定系统重构的钱包管理入口页面。
 * 特性：
 * - 声明式 UI 绑定，状态变化自动同步 DOM
 * - 钱包地址列表展示
 * - 展开/折叠功能
 * - 创建/导入钱包按钮
 * 
 * @module pages/entry
 */

import { loadUser } from '../utils/storage';
import { t } from '../i18n/index.js';
import { escapeHtml } from '../utils/security';
import {
  createReactiveState,
  type ReactiveState
} from '../utils/reactive';

// ============================================================================
// Types
// ============================================================================

/**
 * 入口页面状态
 */
interface EntryPageState {
  // 钱包数量
  walletCount: number;
  
  // 是否有钱包
  hasWallets: boolean;
  
  // 是否展开列表
  isExpanded: boolean;
  
  // 是否显示展开按钮
  showToggleBtn: boolean;
  
  // 下一步按钮是否禁用
  nextBtnDisabled: boolean;
  
  // 是否显示空提示
  showEmptyTip: boolean;
}

/**
 * 地址来源信息
 */
interface AddressOrigin {
  label: string;
  cls: string;
}

// ============================================================================
// State & Bindings
// ============================================================================

/**
 * 初始状态
 */
const initialState: EntryPageState = {
  walletCount: 0,
  hasWallets: false,
  isExpanded: false,
  showToggleBtn: false,
  nextBtnDisabled: true,
  showEmptyTip: true
};

/**
 * 状态到 DOM 的绑定配置
 */
const stateBindings = {
  walletCount: [
    { selector: '#walletCount', type: 'text' as const }
  ],
  hasWallets: [
    { selector: '#walletBriefList', type: 'visible' as const }
  ],
  showToggleBtn: [
    { selector: '#briefToggleBtn', type: 'visible' as const }
  ],
  nextBtnDisabled: [
    { selector: '#entryNextBtn', type: 'prop' as const, name: 'disabled' }
  ],
  showEmptyTip: [
    { selector: '#walletEmptyTip', type: 'visible' as const }
  ]
};

// 页面状态实例
let pageState: ReactiveState<EntryPageState> | null = null;

// 事件清理函数数组
let eventCleanups: (() => void)[] = [];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 获取地址来源信息
 */
function getAddressOrigin(addr: string): AddressOrigin {
  const u = loadUser();
  const ori = u?.wallet?.addressMsg?.[addr]?.origin || '';
  
  if (ori === 'created') {
    return { label: t('modal.newAddress') || '新建', cls: 'origin--created' };
  } else if (ori === 'imported') {
    return { label: t('wallet.import') || '导入', cls: 'origin--imported' };
  }
  return { label: t('common.info') || '信息', cls: 'origin--unknown' };
}

/**
 * 渲染钱包地址列表
 */
function renderWalletList(addrs: string[]): void {
  const brief = document.getElementById('walletBriefList');
  if (!brief) return;
  
  if (addrs.length === 0) {
    brief.innerHTML = '';
    return;
  }
  
  const items = addrs.map(a => {
    const o = getAddressOrigin(a);
    return `<li data-addr="${escapeHtml(a)}"><span class="wallet-addr">${escapeHtml(a)}</span><span class="origin-badge ${o.cls}">${o.label}</span></li>`;
  }).join('');
  
  brief.innerHTML = items;
}

/**
 * 更新展开/折叠状态
 */
function updateExpandState(isExpanded: boolean): void {
  const list = document.getElementById('walletBriefList');
  const toggleBtn = document.getElementById('briefToggleBtn');
  
  if (list) {
    list.classList.toggle('collapsed', !isExpanded);
  }
  
  if (toggleBtn) {
    toggleBtn.classList.toggle('expanded', isExpanded);
    const spanEl = toggleBtn.querySelector('span');
    if (spanEl) {
      spanEl.textContent = isExpanded 
        ? (t('common.collapseMore') || '收起') 
        : (t('common.expandMore') || '展开更多');
    }
  }
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * 处理展开/折叠按钮点击
 */
function handleToggleClick(): void {
  if (!pageState) return;
  
  const isExpanded = !pageState.getValue('isExpanded');
  pageState.set({ isExpanded });
  updateExpandState(isExpanded);
}

/**
 * 处理创建钱包按钮点击
 */
async function handleCreateWalletClick(): Promise<void> {
  const fn = window.PanguPay?.account?.addNewSubWallet;
  if (typeof fn === 'function') {
    await fn();
    // Ensure entry page list reflects latest storage immediately
    try { window.PanguPay?.wallet?.updateWalletBrief?.(); } catch (_) { }
  }
}

/**
 * 处理导入钱包按钮点击
 */
function handleImportWalletClick(): void {
  if (typeof window.PanguPay?.router?.routeTo === 'function') {
    window.PanguPay.router.routeTo('#/wallet-import');
  }
}

/**
 * 处理返回按钮点击
 */
function handleBackClick(): void {
  if (typeof window.PanguPay?.router?.routeTo === 'function') {
    window.PanguPay.router.routeTo('#/welcome');
  }
}

/**
 * 处理下一步按钮点击
 */
function handleNextClick(): void {
  const u = loadUser();
  const addrs = u?.wallet ? Object.keys(u.wallet.addressMsg || {}) : [];
  
  // 显示确认模态框
  const proceedModal = document.getElementById('confirmProceedModal');
  const proceedText = document.getElementById('confirmProceedText');
  
  if (proceedText) {
    proceedText.textContent = t('modal.currentSubAddressCount', { count: addrs.length }) || `当前有 ${addrs.length} 个子地址`;
  }
  if (proceedModal) {
    proceedModal.classList.remove('hidden');
  }
}

/**
 * 处理确认模态框确定按钮
 */
function handleProceedOk(): void {
  const proceedModal = document.getElementById('confirmProceedModal');
  if (proceedModal) {
    proceedModal.classList.add('hidden');
  }
  
  // 检查用户是否已加入组织
  const u = loadUser();
  const gid = u?.orgNumber || '';
  
  if (gid && typeof window.PanguPay?.router?.routeTo === 'function') {
    window.PanguPay.router.routeTo('#/inquiry-main');
  } else if (typeof window.PanguPay?.router?.routeTo === 'function') {
    window.PanguPay.router.routeTo('#/join-group');
  }
}

/**
 * 处理确认模态框取消按钮
 */
function handleProceedCancel(): void {
  const proceedModal = document.getElementById('confirmProceedModal');
  if (proceedModal) {
    proceedModal.classList.add('hidden');
  }
}

// ============================================================================
// Event Binding
// ============================================================================

/**
 * 清理所有事件绑定
 */
function cleanupEvents(): void {
  eventCleanups.forEach(cleanup => cleanup());
  eventCleanups = [];
}

/**
 * 安全地添加事件监听器
 */
function addEvent<K extends keyof HTMLElementEventMap>(
  element: HTMLElement | null,
  event: K,
  handler: (e: HTMLElementEventMap[K]) => void
): void {
  if (!element) return;
  
  element.addEventListener(event, handler as EventListener);
  
  eventCleanups.push(() => {
    element.removeEventListener(event, handler as EventListener);
  });
}

/**
 * 绑定页面事件
 */
function bindEvents(): void {
  cleanupEvents();
  
  // 展开/折叠按钮
  const toggleBtn = document.getElementById('briefToggleBtn');
  addEvent(toggleBtn, 'click', handleToggleClick);
  
  // 创建钱包按钮
  const createWalletBtn = document.getElementById('createWalletBtn');
  addEvent(createWalletBtn, 'click', handleCreateWalletClick);
  
  // 导入钱包按钮
  const importWalletBtn = document.getElementById('importWalletBtn');
  addEvent(importWalletBtn, 'click', handleImportWalletClick);
  
  // 返回按钮
  const entryBackBtn = document.getElementById('entryBackBtn');
  addEvent(entryBackBtn, 'click', handleBackClick);
  
  // 下一步按钮
  const entryNextBtn = document.getElementById('entryNextBtn');
  if (entryNextBtn) {
    (entryNextBtn as HTMLButtonElement).disabled = false;
  }
  addEvent(entryNextBtn, 'click', handleNextClick);
  
  // 确认模态框确定按钮
  const proceedOk = document.getElementById('confirmProceedOk');
  addEvent(proceedOk, 'click', handleProceedOk);
  
  // 确认模态框取消按钮
  const proceedCancel = document.getElementById('confirmProceedCancel');
  addEvent(proceedCancel, 'click', handleProceedCancel);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * 更新钱包简要列表
 */
export function updateWalletBrief(): void {
  const u = loadUser();
  const addrs = u?.wallet ? Object.keys(u.wallet.addressMsg || {}) : [];
  const hasOrg = !!(u?.orgNumber);
  
  // 确保状态存在
  if (!pageState) {
    pageState = createReactiveState(initialState, stateBindings);
  }
  
  // 计算状态
  const walletCount = addrs.length;
  const hasWallets = walletCount > 0;
  const showToggleBtn = walletCount > 3;
  const nextBtnDisabled = walletCount === 0 && !hasOrg;
  const showEmptyTip = walletCount === 0 && !hasOrg;
  
  // 更新状态
  pageState.set({
    walletCount,
    hasWallets,
    showToggleBtn,
    nextBtnDisabled,
    showEmptyTip
  });
  
  // 渲染列表
  renderWalletList(addrs);
  
  // 处理折叠状态
  if (showToggleBtn) {
    const isExpanded = pageState.getValue('isExpanded');
    updateExpandState(isExpanded);
  } else {
    // 少于3个地址时，移除折叠状态
    const list = document.getElementById('walletBriefList');
    if (list) {
      list.classList.remove('collapsed');
    }
  }
}

/**
 * 初始化入口页面
 */
export function initEntryPage(): void {
  // 清理旧的事件绑定
  cleanupEvents();
  
  // 销毁旧实例
  pageState?.destroy();
  
  // 创建新的响应式状态
  pageState = createReactiveState(initialState, stateBindings);
  
  // 更新钱包列表
  updateWalletBrief();
  
  // 绑定事件
  bindEvents();
}
