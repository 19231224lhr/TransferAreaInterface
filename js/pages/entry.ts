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
import { DOM_IDS, idSelector } from '../config/domIds';
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
  locked?: boolean; // 是否被锁定（外部导入未解锁）
}

/**
 * 地址项数据
 */
interface AddressItem {
  address: string;
  origin: AddressOrigin;
  locked: boolean;
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
    { selector: idSelector(DOM_IDS.walletCount), type: 'text' as const }
  ],
  hasWallets: [
    { selector: idSelector(DOM_IDS.walletBriefList), type: 'visible' as const }
  ],
  showToggleBtn: [
    { selector: idSelector(DOM_IDS.briefToggleBtn), type: 'visible' as const }
  ],
  nextBtnDisabled: [
    { selector: idSelector(DOM_IDS.entryNextBtn), type: 'prop' as const, name: 'disabled' }
  ],
  showEmptyTip: [
    { selector: idSelector(DOM_IDS.walletEmptyTip), type: 'visible' as const }
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
  const addrData = u?.wallet?.addressMsg?.[addr];
  const ori = addrData?.origin || '';
  const locked = addrData?.locked || false;
  
  if (ori === 'created') {
    return { label: t('modal.newAddress') || '新建', cls: 'origin--created', locked: false };
  } else if (ori === 'imported') {
    return { label: t('wallet.import') || '导入', cls: 'origin--imported', locked: false };
  } else if (ori === 'external') {
    if (locked) {
      return { label: t('entry.externalLocked') || '外部导入暂未解锁', cls: 'origin--locked', locked: true };
    }
    return { label: t('entry.externalUnlocked') || '外部已解锁', cls: 'origin--external', locked: false };
  }
  return { label: t('common.info') || '信息', cls: 'origin--unknown', locked: false };
}

/**
 * 渲染钱包地址列表
 */
function renderWalletList(addrs: string[]): void {
  const brief = document.getElementById(DOM_IDS.walletBriefList);
  if (!brief) return;
  
  if (addrs.length === 0) {
    brief.replaceChildren();
    return;
  }

  const u = loadUser();
  const isFromLogin = u?.entrySource === 'login';

  brief.replaceChildren();
  addrs.forEach(a => {
    const o = getAddressOrigin(a);
    const li = document.createElement('li');
    li.dataset.addr = a;
    
    // 如果是从登录进入且地址被锁定，添加特殊样式
    if (isFromLogin && o.locked) {
      li.classList.add('locked-address');
    }

    const addr = document.createElement('span');
    addr.className = 'wallet-addr';
    addr.textContent = a;

    const badge = document.createElement('span');
    badge.className = `origin-badge ${o.cls}`;
    badge.textContent = o.label;

    li.appendChild(addr);
    li.appendChild(badge);
    
    // 如果是从登录进入且地址被锁定，添加删除按钮
    if (isFromLogin && o.locked) {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'address-delete-btn';
      deleteBtn.textContent = '×';
      deleteBtn.title = t('entry.deleteAddress') || '删除地址';
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        handleDeleteAddress(a);
      };
      li.appendChild(deleteBtn);
      
      // 添加点击事件以解锁地址
      li.style.cursor = 'pointer';
      li.onclick = () => handleUnlockAddress(a);
    }
    
    brief.appendChild(li);
  });
}

/**
 * 更新展开/折叠状态
 */
function updateExpandState(isExpanded: boolean): void {
  const list = document.getElementById(DOM_IDS.walletBriefList);
  const toggleBtn = document.getElementById(DOM_IDS.briefToggleBtn);
  
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
 * 处理解锁地址（输入私钥）
 */
async function handleUnlockAddress(address: string): Promise<void> {
  // 使用自定义模态框输入私钥
  const privKey = await showPrivateKeyInputModal(address);
  
  if (!privKey) return;

  const normalizeAddress = (value: unknown): string =>
    String(value ?? '')
      .trim()
      .replace(/^0x/i, '')
      .toLowerCase()
      .replace(/\s+/g, '');

  const normalizeHex = (value: unknown, padLength?: number): string => {
    const raw = String(value ?? '')
      .trim()
      .replace(/^0x/i, '')
      .toLowerCase()
      .replace(/\s+/g, '');
    if (!raw) return '';
    const stripped = raw.replace(/^0+/, '');
    const normalized = stripped || '0';
    return typeof padLength === 'number' ? normalized.padStart(padLength, '0') : normalized;
  };
  
  try {
    const { saveUser, loadUser } = await import('../utils/storage.js');
    
    // 使用系统已有的方法解析私钥
    if (typeof window.PanguPay?.account?.importFromPrivHex !== 'function') {
      throw new Error(t('modal.systemError', 'System Error'));
    }
    
    const keyData = await window.PanguPay.account.importFromPrivHex(privKey);
    
    // 验证私钥是否匹配该地址
    const user = loadUser();
    if (!user) return;
    
    const addrData = user.wallet?.addressMsg?.[address];
    if (!addrData || !addrData.publicKeyNew) {
      throw new Error(t('entry.addressNotFound') || '地址数据不存在');
    }

    // 优先用“私钥推导出来的地址”直接匹配（最可靠、也符合后端/既有实现）
    const derivedAddr = normalizeAddress((keyData as any)?.address);
    const targetAddr = normalizeAddress(address);
    if (derivedAddr && targetAddr && derivedAddr !== targetAddr) {
      throw new Error(t('entry.privateKeyMismatch') || '私钥与地址不匹配');
    }
    
    // 比对公钥（兼容后端 BigInt/十进制/前导 0 的差异）
    const pubKeyX = normalizeHex((keyData as any)?.pubXHex, 64);
    const pubKeyY = normalizeHex((keyData as any)?.pubYHex, 64);
    if (pubKeyX && pubKeyY) {
      try {
        const { convertPublicKeyToHex } = await import('../utils/signature.js');
        const expected = convertPublicKeyToHex(addrData.publicKeyNew);
        const expectedX = normalizeHex(expected?.x, 64);
        const expectedY = normalizeHex(expected?.y, 64);
        if (expectedX && expectedY && (pubKeyX !== expectedX || pubKeyY !== expectedY)) {
          throw new Error(t('entry.privateKeyMismatch') || '私钥与地址不匹配');
        }
      } catch (e) {
        // If signature module isn't available for any reason, fall back to address match only
        // (address match already checked above).
        console.warn('[Entry] Public key compare skipped:', e);
      }
    }
    
    // 保存私钥并解锁地址
    user.wallet.addressMsg[address].privHex = (keyData as any)?.privHex || privKey;
    user.wallet.addressMsg[address].pubXHex = pubKeyX;
    user.wallet.addressMsg[address].pubYHex = pubKeyY;
    user.wallet.addressMsg[address].locked = false;
    
    saveUser(user);
    
    // 刷新UI
    updateWalletBrief();
    
    window.PanguPay?.ui?.showSuccessToast?.(
      t('entry.unlockSuccess') || '地址解锁成功'
    );
  } catch (error) {
    console.error('[Entry] Unlock address failed:', error);
    window.PanguPay?.ui?.showErrorToast?.(
      (error as Error)?.message || t('entry.unlockFailed') || '解锁失败'
    );
  }
}

/**
 * 显示私钥输入模态框
 */
function showPrivateKeyInputModal(address: string): Promise<string | null> {
  return new Promise((resolve) => {
    // 创建模态框
    const modal = document.createElement('div');
    modal.className = 'unlock-address-modal';
    modal.innerHTML = `
      <div class="unlock-address-overlay"></div>
      <div class="unlock-address-content">
        <div class="unlock-address-header">
          <h3>${t('entry.unlockAddress') || '解锁地址'}</h3>
          <button class="unlock-address-close" id="unlockCloseBtn">×</button>
        </div>
        <div class="unlock-address-body">
          <div class="unlock-address-input-group">
            <input 
              type="password" 
              id="unlockPrivKeyInput" 
              class="unlock-address-input" 
              placeholder="${t('entry.enterPrivateKey') || '输入私钥 (Hex)'}"
              autocomplete="off"
            />
            <button type="button" class="unlock-address-toggle" id="unlockToggleBtn">
              <svg class="eye-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              <svg class="eye-closed hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
              </svg>
            </button>
          </div>
        </div>
        <div class="unlock-address-footer">
          <button class="unlock-address-btn unlock-address-btn--cancel" id="unlockCancelBtn">
            ${t('common.cancel') || '取消'}
          </button>
          <button class="unlock-address-btn unlock-address-btn--confirm" id="unlockConfirmBtn">
            ${t('common.confirm') || '确认'}
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const input = modal.querySelector('#unlockPrivKeyInput') as HTMLInputElement;
    const toggleBtn = modal.querySelector('#unlockToggleBtn') as HTMLButtonElement;
    const confirmBtn = modal.querySelector('#unlockConfirmBtn') as HTMLButtonElement;
    const cancelBtn = modal.querySelector('#unlockCancelBtn') as HTMLButtonElement;
    const closeBtn = modal.querySelector('#unlockCloseBtn') as HTMLButtonElement;
    const overlay = modal.querySelector('.unlock-address-overlay') as HTMLDivElement;
    
    // 切换密码显示
    toggleBtn?.addEventListener('click', () => {
      const eyeOpen = toggleBtn.querySelector('.eye-open');
      const eyeClosed = toggleBtn.querySelector('.eye-closed');
      if (input.type === 'password') {
        input.type = 'text';
        eyeOpen?.classList.add('hidden');
        eyeClosed?.classList.remove('hidden');
      } else {
        input.type = 'password';
        eyeOpen?.classList.remove('hidden');
        eyeClosed?.classList.add('hidden');
      }
    });
    
    // 确认按钮
    const handleConfirm = () => {
      const value = input.value.trim();
      document.body.removeChild(modal);
      resolve(value || null);
    };
    
    // 取消按钮
    const handleCancel = () => {
      document.body.removeChild(modal);
      resolve(null);
    };
    
    confirmBtn?.addEventListener('click', handleConfirm);
    cancelBtn?.addEventListener('click', handleCancel);
    closeBtn?.addEventListener('click', handleCancel);
    overlay?.addEventListener('click', handleCancel);
    
    // 回车键确认
    input?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleConfirm();
      }
    });
    
    // 自动聚焦
    setTimeout(() => input?.focus(), 100);
  });
}

/**
 * 处理删除地址
 */
async function handleDeleteAddress(address: string): Promise<void> {
  const normalizeAddress = (value: unknown): string =>
    String(value ?? '')
      .trim()
      .replace(/^0x/i, '')
      .toLowerCase()
      .replace(/\s+/g, '');

  const short = (addr: string) => {
    const a = normalizeAddress(addr);
    return a.length > 16 ? `${a.slice(0, 10)}...${a.slice(-6)}` : a;
  };

  try {
    const { showConfirmModal } = await import('../ui/modal.js');
    const confirmed = await showConfirmModal(
      t('entry.deleteAddress') || '删除地址',
      `${t('entry.deleteAddressConfirm') || '确定要删除该地址吗？'}\n${short(address)}`,
      t('common.confirm') || '确认',
      t('common.cancel') || '取消'
    );

    if (!confirmed) return;

    const { saveUser, loadUser } = await import('../utils/storage.js');
    const user = loadUser();
    if (!user?.wallet?.addressMsg) {
      throw new Error(t('entry.addressNotFound') || '地址数据不存在');
    }

    const target = normalizeAddress(address);
    const map = user.wallet.addressMsg;

    // Try exact key first
    if (map[address]) {
      delete map[address];
    } else if (map[target]) {
      delete map[target];
    } else {
      // Fallback: find by normalized equality
      const hit = Object.keys(map).find((k) => normalizeAddress(k) === target);
      if (hit) delete map[hit];
      else throw new Error(t('entry.addressNotFound') || '地址数据不存在');
    }

    saveUser(user);

    // 刷新UI
    updateWalletBrief();

    window.PanguPay?.ui?.showSuccessToast?.(t('entry.deleteSuccess') || '地址已删除');
  } catch (error) {
    console.error('[Entry] Delete address failed:', error);
    window.PanguPay?.ui?.showErrorToast?.(
      (error as Error)?.message || t('entry.deleteFailed') || '删除失败'
    );
  }
}

/**
 * 展开/折叠按钮点击
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
  const proceedModal = document.getElementById(DOM_IDS.confirmProceedModal);
  const proceedText = document.getElementById(DOM_IDS.confirmProceedText);
  
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
  const proceedModal = document.getElementById(DOM_IDS.confirmProceedModal);
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
  const proceedModal = document.getElementById(DOM_IDS.confirmProceedModal);
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
  const toggleBtn = document.getElementById(DOM_IDS.briefToggleBtn);
  addEvent(toggleBtn, 'click', handleToggleClick);
  
  // 创建钱包按钮
  const createWalletBtn = document.getElementById(DOM_IDS.createWalletBtn);
  addEvent(createWalletBtn, 'click', handleCreateWalletClick);
  
  // 导入钱包按钮
  const importWalletBtn = document.getElementById(DOM_IDS.importWalletBtn);
  addEvent(importWalletBtn, 'click', handleImportWalletClick);
  
  // 返回按钮
  const entryBackBtn = document.getElementById(DOM_IDS.entryBackBtn);
  addEvent(entryBackBtn, 'click', handleBackClick);
  
  // 下一步按钮 (disabled 状态由响应式系统自动管理)
  const entryNextBtn = document.getElementById(DOM_IDS.entryNextBtn);
  addEvent(entryNextBtn, 'click', handleNextClick);
  
  // 确认模态框确定按钮
  const proceedOk = document.getElementById(DOM_IDS.confirmProceedOk);
  addEvent(proceedOk, 'click', handleProceedOk);
  
  // 确认模态框取消按钮
  const proceedCancel = document.getElementById(DOM_IDS.confirmProceedCancel);
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
  const isInGroup = u?.isInGroup || false;
  const isFromLogin = u?.entrySource === 'login';
  
  console.log('[Entry] updateWalletBrief:', {
    hasUser: !!u,
    accountId: u?.accountId,
    entrySource: u?.entrySource,
    isFromLogin,
    isInGroup,
    hasOrg,
    addressCount: addrs.length
  });
  
  // 确保状态存在
  if (!pageState) {
    pageState = createReactiveState(initialState, stateBindings);
  }
  
  // 计算锁定地址数量
  let lockedAddressCount = 0;
  if (isFromLogin) {
    addrs.forEach(addr => {
      const addrData = u?.wallet?.addressMsg?.[addr];
      if (addrData && addrData.locked) {
        lockedAddressCount++;
        console.log('[Entry] Locked address:', addr, addrData);
      }
    });
  }
  
  console.log('[Entry] Locked addresses:', lockedAddressCount, '/', addrs.length);
  
  // 计算状态
  const walletCount = addrs.length;
  const hasWallets = walletCount > 0;
  const showToggleBtn = walletCount > 3;
  
  // 如果是从登录进入，只有所有地址都解锁才能点击下一步
  // 如果是从新建进入，按原逻辑
  let nextBtnDisabled: boolean;
  if (isFromLogin) {
    nextBtnDisabled = lockedAddressCount > 0;
  } else {
    nextBtnDisabled = walletCount === 0 && !hasOrg;
  }
  
  const showEmptyTip = walletCount === 0 && !hasOrg && !isFromLogin;
  
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
    const list = document.getElementById(DOM_IDS.walletBriefList);
    if (list) {
      list.classList.remove('collapsed');
    }
  }
  
  // 控制新建钱包和导入钱包按钮的显示（登录进入时隐藏）
  const createWalletBtn = document.getElementById(DOM_IDS.createWalletBtn);
  const importWalletBtn = document.getElementById(DOM_IDS.importWalletBtn);
  
  console.log('[Entry] Button visibility:', {
    isFromLogin,
    createWalletBtn: !!createWalletBtn,
    importWalletBtn: !!importWalletBtn,
    shouldHide: isFromLogin
  });
  
  if (createWalletBtn) {
    if (isFromLogin) {
      createWalletBtn.style.setProperty('display', 'none', 'important');
    } else {
      createWalletBtn.style.removeProperty('display');
    }
    console.log('[Entry] createWalletBtn display:', createWalletBtn.style.display);
  }
  if (importWalletBtn) {
    if (isFromLogin) {
      importWalletBtn.style.setProperty('display', 'none', 'important');
    } else {
      importWalletBtn.style.removeProperty('display');
    }
    console.log('[Entry] importWalletBtn display:', importWalletBtn.style.display);
  }
  
  // 更新用户状态信息 (只在登录进入时显示)
  updateUserStatusInfo(u, isInGroup, hasOrg, addrs.length, isFromLogin);
}

/**
 * 更新用户状态信息显示 (新增函数)
 */
function updateUserStatusInfo(
  user: any,
  isInGroup: boolean,
  hasOrg: boolean,
  addressCount: number,
  isFromLogin: boolean
): void {
  const statusContainer = document.getElementById('entryUserStatus');
  const orgStatusEl = document.getElementById('entryOrgStatus');
  const orgIdItemEl = document.getElementById('entryOrgIdItem');
  const orgIdEl = document.getElementById('entryOrgId');
  const addressCountEl = document.getElementById('entryAddressCount');
  const totalBalanceEl = document.getElementById('entryTotalBalance');
  
  console.log('[Entry] updateUserStatusInfo:', {
    statusContainer: !!statusContainer,
    isFromLogin,
    hasUser: !!user,
    accountId: user?.accountId,
    isInGroup,
    hasOrg
  });
  
  if (!statusContainer) {
    console.warn('[Entry] Status container not found!');
    return;
  }
  
  // 只有从登录进入时才显示用户状态信息
  if (!isFromLogin) {
    console.log('[Entry] Not from login, hiding status container');
    statusContainer.style.display = 'none';
    return;
  }
  
  // 如果用户已登录且有数据，显示状态区
  if (user && user.accountId) {
    console.log('[Entry] Showing status container');
    statusContainer.style.display = 'block';
    
    // 更新组织状态
    if (orgStatusEl) {
      if (isInGroup && hasOrg) {
        orgStatusEl.innerHTML = `
          <span class="entry-status-badge entry-status-badge--success">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>${t('entry.inOrg') || '已加入组织'}</span>
          </span>
        `;
      } else {
        orgStatusEl.innerHTML = `
          <span class="entry-status-badge entry-status-badge--warning">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4" />
              <path d="M12 16h.01" />
            </svg>
            <span>${t('entry.notInOrg') || '散户模式'}</span>
          </span>
        `;
      }
    }
    
    // 显示/隐藏组织ID
    if (orgIdItemEl && orgIdEl) {
      if (isInGroup && hasOrg && user.orgNumber) {
        orgIdItemEl.style.display = 'flex';
        orgIdEl.textContent = user.orgNumber;
      } else {
        orgIdItemEl.style.display = 'none';
      }
    }
    
    // 更新地址数量
    if (addressCountEl) {
      addressCountEl.textContent = String(addressCount);
    }
    
    // 更新总余额
    if (totalBalanceEl) {
      const totalValue = user.wallet?.value || 0;
      totalBalanceEl.textContent = totalValue.toFixed(2);
    }
  } else {
    // 未登录时隐藏状态区
    statusContainer.style.display = 'none';
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
