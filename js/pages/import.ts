/**
 * Import Page Module (Reactive Version)
 * 
 * 使用响应式绑定系统重构的导入钱包页面。
 * 特性：
 * - 声明式 UI 绑定，状态变化自动同步 DOM
 * - 支持账户导入和钱包地址导入两种模式
 * - 私钥可见性切换
 * 
 * @module pages/import
 */

import { loadUser, saveUser, toAccount } from '../utils/storage';
import { importFromPrivHex } from '../services/account';
import { showErrorToast } from '../utils/toast.js';
import { showUnifiedLoading, showUnifiedSuccess, hideUnifiedOverlay } from '../ui/modal';
import { t } from '../i18n/index.js';
import { wait } from '../utils/helpers.js';
import { updateWalletBrief } from './entry.js';
import { updateHeaderUser } from '../ui/header.js';
import { addInlineValidation, quickValidate } from '../utils/formValidator';
import { showLoading, hideLoading, showElementLoading, hideElementLoading } from '../utils/loading';
import {
  createReactiveState,
  runAnimationSequence,
  runParallelAnimations,
  type ReactiveState
} from '../utils/reactive';

// ============================================================================
// Types
// ============================================================================

/**
 * 导入模式
 */
type ImportMode = 'account' | 'wallet';

/**
 * 导入页面状态
 */
interface ImportPageState {
  // UI 状态
  isLoading: boolean;
  showForm: boolean;
  showLoader: boolean;
  showResult: boolean;
  showButtons: boolean;
  
  // 私钥可见性
  privKeyVisible: boolean;
  
  // 私钥折叠状态
  privKeyCollapsed: boolean;
  
  // 导入模式
  mode: ImportMode;
  
  // 结果数据
  accountId: string;
  address: string;
  privHex: string;
  pubX: string;
  pubY: string;
}

// ============================================================================
// State & Bindings
// ============================================================================

/**
 * 初始状态
 */
const initialState: ImportPageState = {
  isLoading: false,
  showForm: true,
  showLoader: false,
  showResult: false,
  showButtons: false,
  privKeyVisible: false,
  privKeyCollapsed: true,
  mode: 'account',
  accountId: '',
  address: '',
  privHex: '',
  pubX: '',
  pubY: ''
};

/**
 * 状态到 DOM 的绑定配置
 */
const stateBindings = {
  showLoader: [
    { selector: '#importLoader', type: 'visible' as const }
  ],
  showResult: [
    { selector: '#importResult', type: 'visible' as const }
  ],
  showButtons: [
    { selector: '#importNextBtn', type: 'visible' as const },
    { selector: '#importCancelBtn', type: 'visible' as const }
  ],
  privKeyCollapsed: [
    { selector: '#importPrivateKeyItem', type: 'class' as const, name: 'import-result-item--collapsed' }
  ],
  accountId: [
    { selector: '#importAccountId', type: 'text' as const }
  ],
  address: [
    { selector: '#importAddress', type: 'text' as const }
  ],
  privHex: [
    { selector: '#importPrivHexOut', type: 'text' as const }
  ],
  pubX: [
    { selector: '#importPubX', type: 'text' as const }
  ],
  pubY: [
    { selector: '#importPubY', type: 'text' as const }
  ]
};

// 页面状态实例
let pageState: ReactiveState<ImportPageState> | null = null;

// 事件清理函数数组
let eventCleanups: (() => void)[] = [];

// ============================================================================
// Animation Sequences
// ============================================================================

/**
 * 表单折叠动画
 */
async function animateFormCollapse(): Promise<void> {
  await runParallelAnimations([
    {
      selector: '.import-form-card',
      phases: [
        { addClass: 'collapsing', duration: 250 },
        { removeClass: 'collapsing', addClass: 'import-form-card--hidden', duration: 0 }
      ]
    },
    {
      selector: '.import-tip-block',
      phases: [
        { addClass: 'collapsing', duration: 250 },
        { removeClass: 'collapsing', addClass: 'import-tip-block--hidden', duration: 0 }
      ]
    }
  ]);
}

/**
 * 表单展开动画
 */
async function animateFormExpand(): Promise<void> {
  await runParallelAnimations([
    {
      selector: '.import-form-card',
      phases: [
        { removeClass: ['collapsing', 'import-form-card--hidden'], addClass: 'expanding', duration: 350 },
        { removeClass: 'expanding', duration: 0 }
      ]
    },
    {
      selector: '.import-tip-block',
      phases: [
        { removeClass: ['collapsing', 'import-tip-block--hidden'], addClass: 'expanding', duration: 350 },
        { removeClass: 'expanding', duration: 0 }
      ]
    }
  ]);
}

/**
 * 结果展开动画
 */
async function animateResultReveal(): Promise<void> {
  const resultEl = document.getElementById('importResult');
  if (resultEl) {
    resultEl.classList.remove('hidden', 'fade-in', 'reveal');
    resultEl.classList.add('expanding');
    requestAnimationFrame(() => {
      resultEl.classList.remove('expanding');
      resultEl.classList.add('reveal');
    });
  }
}

/**
 * 结果折叠动画
 */
async function animateResultCollapse(): Promise<void> {
  await runAnimationSequence({
    selector: '#importResult',
    phases: [
      { addClass: 'collapsing', duration: 250 },
      { addClass: 'hidden', removeClass: ['collapsing', 'reveal', 'expanding'], duration: 0 }
    ]
  });
}

// ============================================================================
// UI Helpers
// ============================================================================

/**
 * 更新私钥可见性 UI
 */
function updateVisibilityUI(visible: boolean): void {
  const toggle = document.getElementById('importToggleVisibility');
  const input = document.getElementById('importPrivHex') as HTMLInputElement | null;
  
  if (toggle) {
    const eyeOpen = toggle.querySelector('.eye-open');
    const eyeClosed = toggle.querySelector('.eye-closed');
    eyeOpen?.classList.toggle('hidden', visible);
    eyeClosed?.classList.toggle('hidden', !visible);
  }
  
  if (input) {
    input.type = visible ? 'text' : 'password';
  }
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * 处理私钥可见性切换
 */
function handleVisibilityToggle(): void {
  if (!pageState) return;
  
  const newVisible = !pageState.getValue('privKeyVisible');
  pageState.set({ privKeyVisible: newVisible });
  updateVisibilityUI(newVisible);
}

/**
 * 处理返回按钮
 */
function handleBackClick(): void {
  if (typeof window.PanguPay?.router?.routeTo === 'function') {
    window.PanguPay.router.routeTo('#/entry');
  }
  if (typeof window.PanguPay?.wallet?.updateWalletBrief === 'function') {
    window.PanguPay.wallet.updateWalletBrief();
  }
}

/**
 * 处理下一步按钮
 */
function handleNextClick(): void {
  if (typeof window.PanguPay?.router?.routeTo === 'function') {
    window.PanguPay.router.routeTo('#/entry');
  }
}

/**
 * 处理取消按钮 (重新导入)
 */
async function handleCancelClick(): Promise<void> {
  if (!pageState) return;
  
  // 隐藏结果
  await animateResultCollapse();
  
  // 展开表单
  await animateFormExpand();
  
  // 重置状态
  resetImportState('account');
}

/**
 * 处理私钥折叠切换
 */
function handlePrivKeyToggle(): void {
  if (!pageState) return;
  
  const newCollapsed = !pageState.getValue('privKeyCollapsed');
  pageState.set({ privKeyCollapsed: newCollapsed });
}

/**
 * 处理导入按钮点击
 */
async function handleImport(): Promise<void> {
  // 确保 pageState 存在
  if (!pageState) {
    pageState = createReactiveState(initialState, stateBindings);
  }
  
  const importBtn = document.getElementById('importBtn') as HTMLButtonElement | null;
  const mode = importBtn?.dataset.mode as ImportMode || 'account';
  const inputEl = document.getElementById('importPrivHex') as HTMLInputElement | null;
  const priv = inputEl?.value.trim() || '';
  
  // 验证私钥
  const validationError = quickValidate(priv, ['required', 'privateKey']);
  if (validationError) {
    showErrorToast(validationError, t('modal.inputError'));
    if (inputEl) {
      inputEl.classList.add('is-invalid');
      inputEl.focus();
    }
    return;
  }
  
  const normalized = priv.replace(/^0x/i, '');
  
  // 开始加载
  if (importBtn) {
    importBtn.disabled = true;
    showElementLoading(importBtn, t('common.processing') || '处理中...');
  }
  const loadingId = showLoading(t('modal.importing') || '正在导入...');
  
  try {
    // 更新状态：隐藏结果和按钮
    pageState.set({
      isLoading: true,
      showResult: false,
      showButtons: false,
      mode
    });
    
    if (mode === 'account') {
      // 表单折叠动画
      await animateFormCollapse();
      
      // 显示加载器
      pageState.set({ showLoader: true });
    } else {
      showUnifiedLoading(t('modal.addingWalletAddress'));
    }
    
    const t0 = Date.now();
    const data = await importFromPrivHex(priv);
    const elapsed = Date.now() - t0;
    if (elapsed < 1000) await wait(1000 - elapsed);
    
    // 隐藏加载器
    const loader = document.getElementById('importLoader');
    if (loader) loader.classList.add('hidden');
    pageState.set({ showLoader: false });
    
    if (mode === 'account') {
      // 更新结果数据
      pageState.set({
        accountId: data.accountId || '',
        address: data.address || '',
        privHex: data.privHex || normalized,
        pubX: data.pubXHex || '',
        pubY: data.pubYHex || '',
        privKeyCollapsed: true
      });
      
      // 显示结果
      await animateResultReveal();
      pageState.set({
        showResult: true,
        showButtons: true
      });
      
      // 检查用户是否已存在
      const existingUser = loadUser();
      const addr = (data.address || '').toLowerCase();
      
      let acc: ReturnType<typeof toAccount>;
      if (existingUser && existingUser.accountId) {
        // 用户已存在 - 添加地址到现有账户
        acc = toAccount({ accountId: existingUser.accountId, address: existingUser.address }, existingUser);
        
        // 检查地址是否已存在
        const addressExists = (acc.wallet?.addressMsg?.[addr]) || 
                             (existingUser.address && String(existingUser.address).toLowerCase() === addr);
        
        if (addressExists) {
          hideUnifiedOverlay();
          showErrorToast(t('toast.addressExists'), t('modal.operationFailed'));
          // 重置按钮状态
          if (importBtn) {
            importBtn.disabled = false;
            importBtn.classList.remove('is-loading');
            hideElementLoading(importBtn);
          }
          hideLoading(loadingId);
          resetImportState('account');
          return;
        }
      } else {
        // 无现有用户 - 创建新账户
        if (typeof window.PanguPay?.storage?.clearAccountStorage === 'function') {
          window.PanguPay.storage.clearAccountStorage();
        }
        
        const accountData = { 
          accountId: data.accountId, 
          address: data.address, 
          privHex: data.privHex, 
          pubXHex: data.pubXHex, 
          pubYHex: data.pubYHex 
        };
        acc = toAccount(accountData, null);
      }
      
      // 添加导入的地址到 wallet.addressMsg
      if (addr && acc.wallet?.addressMsg) {
        acc.wallet.addressMsg[addr] = {
          type: 0,
          utxos: {},
          txCers: {},
          value: { totalValue: 0, utxoValue: 0, txCerValue: 0 },
          estInterest: 0,
          origin: 'imported',
          privHex: data.privHex || normalized
        };
      }
      
      saveUser(acc);
      
      // 更新 header
      const user = loadUser();
      updateHeaderUser(user);
      
    } else {
      // 钱包模式 - 添加到现有账户
      const u2 = loadUser();
      if (!u2 || !u2.accountId) { 
        hideUnifiedOverlay();
        showErrorToast(t('modal.pleaseLoginFirst'), t('modal.operationFailed'));
        // 重置按钮状态
        if (importBtn) {
          importBtn.disabled = false;
          importBtn.classList.remove('is-loading');
          hideElementLoading(importBtn);
        }
        hideLoading(loadingId);
        return; 
      }
      
      const acc = toAccount({ accountId: u2.accountId, address: u2.address }, u2);
      const addr = (data.address || '').toLowerCase();
      
      if (!addr) {
        showUnifiedSuccess(t('toast.importFailed'), t('toast.cannotParseAddress'), () => {
          // 重置按钮状态
          if (importBtn) {
            importBtn.disabled = false;
            importBtn.classList.remove('is-loading');
            hideElementLoading(importBtn);
          }
          hideLoading(loadingId);
        }, null, true);
        return;
      }
      
      const exists = (acc.wallet?.addressMsg?.[addr]) || 
                     (u2.address && String(u2.address).toLowerCase() === addr);
      if (exists) {
        showUnifiedSuccess(t('toast.importFailed'), t('toast.addressExists'), () => {
          // 重置按钮状态
          if (importBtn) {
            importBtn.disabled = false;
            importBtn.classList.remove('is-loading');
            hideElementLoading(importBtn);
          }
          hideLoading(loadingId);
        }, null, true);
        return;
      }
      
      if (addr && acc.wallet?.addressMsg) {
        acc.wallet.addressMsg[addr] = { 
          type: 0, 
          utxos: {}, 
          txCers: {}, 
          value: { totalValue: 0, utxoValue: 0, txCerValue: 0 }, 
          estInterest: 0, 
          origin: 'imported', 
          privHex: (data.privHex || normalized) 
        };
      }
      
      saveUser(acc);
      updateWalletBrief();
      
      showUnifiedSuccess(t('toast.importSuccess'), t('toast.importSuccessDesc'), () => {
        if (typeof window.PanguPay?.router?.routeTo === 'function') {
          window.PanguPay.router.routeTo('#/entry');
        }
      }, null);
    }
  } catch (err) {
    hideUnifiedOverlay();
    const errorMsg = (err as Error).message || t('modal.cannotRecognizeKey') || '无法识别私钥';
    showErrorToast(errorMsg, t('modal.importFailed') || '导入失败');
    console.error(err);
    
    // 隐藏加载器
    const loader = document.getElementById('importLoader');
    if (loader) loader.classList.add('hidden');
    
    // 恢复表单状态
    pageState.set({
      isLoading: false,
      showLoader: false
    });
    
    // 展开表单
    await animateFormExpand();
    
  } finally {
    pageState?.set({ isLoading: false });
    
    // 确保按钮状态被重置
    if (importBtn) {
      importBtn.disabled = false;
      importBtn.classList.remove('is-loading');
      hideElementLoading(importBtn);
    }
    hideLoading(loadingId);
    
    // 确保加载器隐藏
    const loader = document.getElementById('importLoader');
    if (loader) loader.classList.add('hidden');
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * 重置导入页面状态
 */
export function resetImportState(mode: ImportMode = 'account'): void {
  // 重置响应式状态
  pageState?.reset();
  pageState?.set({ mode });
  
  // 重置导入按钮模式
  const importBtn = document.getElementById('importBtn') as HTMLButtonElement | null;
  if (importBtn) importBtn.dataset.mode = mode;
  
  // 重置表单输入
  const inputEl = document.getElementById('importPrivHex') as HTMLInputElement | null;
  if (inputEl) {
    inputEl.value = '';
    inputEl.type = 'password';
  }
  
  // 重置钱包简介
  const brief = document.getElementById('walletBriefList');
  const toggleBtn = document.getElementById('briefToggleBtn');
  if (brief) {
    brief.classList.add('hidden');
    brief.innerHTML = '';
  }
  if (toggleBtn) toggleBtn.classList.add('hidden');
  
  // 重置错误提示
  const addrError = document.getElementById('addrError');
  if (addrError) {
    addrError.textContent = '';
    addrError.classList.add('hidden');
  }
  
  const addrPrivHex = document.getElementById('addrPrivHex') as HTMLInputElement | null;
  if (addrPrivHex) addrPrivHex.value = '';
  
  // 重置可见性 UI
  updateVisibilityUI(false);
  
  // 重置表单卡片状态
  const formCard = document.querySelector('.import-form-card');
  const tipBlock = document.querySelector('.import-tip-block');
  const resultEl = document.getElementById('importResult');
  
  formCard?.classList.remove('import-form-card--hidden', 'collapsing', 'expanding');
  tipBlock?.classList.remove('import-tip-block--hidden', 'collapsing', 'expanding');
  resultEl?.classList.add('hidden');
  resultEl?.classList.remove('collapsing', 'expanding', 'reveal');
}

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
  // 先清理旧的事件绑定
  cleanupEvents();
  
  // 导入按钮
  const importBtn = document.getElementById('importBtn') as HTMLButtonElement | null;
  if (importBtn) {
    importBtn.disabled = false;
    importBtn.classList.remove('is-loading');
    addEvent(importBtn, 'click', handleImport);
  }
  
  // 私钥可见性切换
  const importToggleVisibility = document.getElementById('importToggleVisibility');
  addEvent(importToggleVisibility, 'click', handleVisibilityToggle);
  
  // 返回按钮
  const importBackBtn = document.getElementById('importBackBtn');
  addEvent(importBackBtn, 'click', handleBackClick);
  
  // 下一步按钮
  const importNextBtn = document.getElementById('importNextBtn');
  addEvent(importNextBtn, 'click', handleNextClick);
  
  // 取消按钮
  const importCancelBtn = document.getElementById('importCancelBtn');
  addEvent(importCancelBtn, 'click', handleCancelClick);
  
  // 私钥折叠切换
  const importPrivateKeyToggle = document.getElementById('importPrivateKeyToggle');
  addEvent(importPrivateKeyToggle, 'click', handlePrivKeyToggle);
}

/**
 * 初始化导入页面
 */
export function initImportPage(): void {
  // 清理旧的事件绑定
  cleanupEvents();
  
  // 销毁旧实例
  pageState?.destroy();
  
  // 创建新的响应式状态
  pageState = createReactiveState(initialState, stateBindings);
  
  // 重置页面状态
  resetImportState('account');
  
  // 设置表单验证
  addInlineValidation('#importPrivHex', [
    { validator: 'required', message: t('modal.pleaseEnterPrivateKey') || '请输入私钥' },
    { validator: 'privateKey', message: t('modal.privateKeyFormatError') || '私钥格式错误，需要64位十六进制' }
  ], { showOnInput: true, debounceMs: 200 });
  
  // 绑定事件
  bindEvents();
}
