/**
 * Header UI Module (Reactive Version)
 * 
 * 使用响应式绑定系统重构的头部组件。
 * 特性：
 * - 声明式 UI 绑定，状态变化自动同步 DOM
 * - 用户菜单管理
 * - 滚动行为控制
 * 
 * @module ui/header
 */

import { t } from '../i18n/index.js';
import { loadUser, loadUserProfile, computeCurrentOrgId, clearAccountStorage } from '../utils/storage';
import { globalEventManager } from '../utils/eventUtils.js';
import {
  createReactiveState,
  type ReactiveState
} from '../utils/reactive';

// ============================================================================
// Types
// ============================================================================

/**
 * 用户信息
 */
interface UserInfo {
  accountId?: string;
  address?: string;
  wallet?: {
    addressMsg?: Record<string, AddressInfo>;
    valueDivision?: Record<number, number>;
  };
}

/**
 * 地址信息
 */
interface AddressInfo {
  type?: number;
  utxos?: Record<string, unknown>;
  txCers?: Record<string, unknown>;
  value?: {
    totalValue?: number;
    TotalValue?: number;
    utxoValue?: number;
    txCerValue?: number;
  };
  estInterest?: number;
  origin?: string;
  privHex?: string;
}

/**
 * 用户资料
 */
interface UserProfile {
  nickname?: string;
  bio?: string;
  avatar?: string;
}

/**
 * 头部状态
 */
interface HeaderState {
  // 用户登录状态
  isLoggedIn: boolean;
  
  // 用户信息
  nickname: string;
  bio: string;
  avatar: string;
  accountId: string;
  
  // 地址信息
  addressCount: number;
  
  // 组织信息
  orgId: string;
  
  // 余额信息
  totalUsdt: string;
  pgcBalance: string;
  btcBalance: string;
  ethBalance: string;
  
  // 弹出框状态
  showAddressPopup: boolean;
  showBalancePopup: boolean;
  showUserMenu: boolean;
}

// ============================================================================
// State & Bindings
// ============================================================================

/**
 * 初始状态
 */
const initialState: HeaderState = {
  isLoggedIn: false,
  nickname: '',
  bio: '',
  avatar: '',
  accountId: '',
  addressCount: 0,
  orgId: '',
  totalUsdt: '0 USDT',
  pgcBalance: '0',
  btcBalance: '0',
  ethBalance: '0',
  showAddressPopup: false,
  showBalancePopup: false,
  showUserMenu: false
};

/**
 * 状态到 DOM 的绑定配置
 */
const stateBindings = {
  nickname: [
    { selector: '#userLabel', type: 'text' as const },
    { selector: '#menuHeaderTitle', type: 'text' as const }
  ],
  bio: [
    { selector: '#menuHeaderSub', type: 'text' as const }
  ],
  accountId: [
    { selector: '#menuAccountId', type: 'text' as const }
  ],
  orgId: [
    { selector: '#menuOrg', type: 'text' as const }
  ],
  totalUsdt: [
    { selector: '#menuBalance', type: 'text' as const }
  ],
  pgcBalance: [
    { selector: '#menuBalancePGC', type: 'text' as const }
  ],
  btcBalance: [
    { selector: '#menuBalanceBTC', type: 'text' as const }
  ],
  ethBalance: [
    { selector: '#menuBalanceETH', type: 'text' as const }
  ],
  showAddressPopup: [
    { selector: '#menuAddressPopup', type: 'visible' as const }
  ],
  showBalancePopup: [
    { selector: '#menuBalancePopup', type: 'visible' as const }
  ],
  showUserMenu: [
    { selector: '#userMenu', type: 'visible' as const }
  ]
};

// 页面状态实例
let headerState: ReactiveState<HeaderState> | null = null;

// ============================================================================
// UI Helpers
// ============================================================================

/**
 * 更新头像显示
 */
function updateAvatarUI(avatar: string, isLoggedIn: boolean): void {
  const avatarEl = document.getElementById('userAvatar');
  const menuHeaderAvatar = document.getElementById('menuHeaderAvatar');
  
  if (avatarEl) {
    avatarEl.classList.toggle('avatar--active', isLoggedIn);
    const avatarImg = avatarEl.querySelector('.avatar-img') as HTMLImageElement | null;
    if (avatarImg) {
      if (isLoggedIn) {
        avatarImg.src = avatar || '/avatar.png';
        avatarImg.classList.remove('hidden');
      } else {
        avatarImg.classList.add('hidden');
      }
    }
  }
  
  if (menuHeaderAvatar) {
    menuHeaderAvatar.classList.toggle('avatar--active', isLoggedIn);
    const menuAvatarImg = menuHeaderAvatar.querySelector('.avatar-img') as HTMLImageElement | null;
    if (menuAvatarImg) {
      if (isLoggedIn) {
        menuAvatarImg.src = avatar || '/avatar.png';
        menuAvatarImg.classList.remove('hidden');
      } else {
        menuAvatarImg.classList.add('hidden');
      }
    }
  }
}

/**
 * 更新菜单区域可见性
 */
function updateMenuVisibility(isLoggedIn: boolean): void {
  const menuHeader = document.querySelector('.menu-header');
  const menuCards = document.querySelector('.menu-cards');
  const menuAccountItem = document.getElementById('menuAccountItem');
  const menuAddressItem = document.getElementById('menuAddressItem');
  const menuOrgItem = document.getElementById('menuOrgItem');
  const menuBalanceItem = document.getElementById('menuBalanceItem');
  const menuEmpty = document.getElementById('menuEmpty');
  const logoutEl = document.getElementById('logoutBtn') as HTMLButtonElement | null;
  const menuOrgEl = document.getElementById('menuOrg');
  
  if (menuHeader) menuHeader.classList.remove('hidden');
  
  if (isLoggedIn) {
    if (menuCards) menuCards.classList.remove('hidden');
    if (menuAccountItem) menuAccountItem.classList.remove('hidden');
    if (menuAddressItem) menuAddressItem.classList.remove('hidden');
    if (menuOrgItem) menuOrgItem.classList.remove('hidden');
    if (menuBalanceItem) menuBalanceItem.classList.remove('hidden');
    if (menuEmpty) menuEmpty.classList.add('hidden');
    if (logoutEl) {
      logoutEl.disabled = false;
      logoutEl.classList.remove('hidden');
    }
    if (menuOrgEl) menuOrgEl.classList.remove('code-waiting');
  } else {
    if (menuCards) menuCards.classList.add('hidden');
    if (menuAccountItem) menuAccountItem.classList.add('hidden');
    if (menuAddressItem) menuAddressItem.classList.add('hidden');
    if (menuOrgItem) menuOrgItem.classList.add('hidden');
    if (menuBalanceItem) menuBalanceItem.classList.add('hidden');
    if (menuEmpty) menuEmpty.classList.remove('hidden');
    if (logoutEl) {
      logoutEl.disabled = true;
      logoutEl.classList.add('hidden');
    }
    if (menuOrgEl) menuOrgEl.classList.add('code-waiting');
  }
}

/**
 * 更新地址数量显示
 */
function updateAddressCountUI(count: number): void {
  const menuAddrEl = document.getElementById('menuAddress');
  if (menuAddrEl) {
    menuAddrEl.textContent = t('header.addresses', { count });
  }
}

/**
 * 清除 UI 状态
 */
function clearUIState(): void {
  // 清除新用户页面
  const newResult = document.getElementById('result');
  if (newResult) newResult.classList.add('hidden');
  
  const ids1 = ['accountId', 'address', 'privHex', 'pubX', 'pubY'];
  ids1.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
  
  const newLoader = document.getElementById('newLoader');
  if (newLoader) newLoader.classList.add('hidden');
  
  // 清除导入页面
  const importInput = document.getElementById('importPrivHex') as HTMLInputElement | null;
  if (importInput) importInput.value = '';
  
  const importResult = document.getElementById('importResult');
  if (importResult) importResult.classList.add('hidden');
  
  const ids2 = ['importAccountId', 'importAddress', 'importPrivHexOut', 'importPubX', 'importPubY'];
  ids2.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
  
  const importLoader = document.getElementById('importLoader');
  if (importLoader) importLoader.classList.add('hidden');
  
  const importNextBtn2 = document.getElementById('importNextBtn');
  if (importNextBtn2) importNextBtn2.classList.add('hidden');
  
  // 清除创建/新建按钮
  const createBtnEl = document.getElementById('createBtn');
  const newNextBtnEl = document.getElementById('newNextBtn');
  if (createBtnEl) createBtnEl.classList.add('hidden');
  if (newNextBtnEl) newNextBtnEl.classList.add('hidden');
  
  // 清除登录页面
  const loginInput = document.getElementById('loginPrivHex') as HTMLInputElement | null;
  if (loginInput) loginInput.value = '';
  
  const loginResult = document.getElementById('loginResult');
  if (loginResult) loginResult.classList.add('hidden');
  
  const ids3 = ['loginAccountId', 'loginAddress', 'loginPrivOut', 'loginPubX', 'loginPubY'];
  ids3.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
  
  const loginLoader = document.getElementById('loginLoader');
  if (loginLoader) loginLoader.classList.add('hidden');
  
  const loginNextBtn2 = document.getElementById('loginNextBtn');
  if (loginNextBtn2) loginNextBtn2.classList.add('hidden');
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * 处理地址弹出框点击
 */
function handleAddressPopupClick(e: MouseEvent): void {
  e.stopPropagation();
  
  // 关闭余额弹出框
  headerState?.set({ showBalancePopup: false });
  
  const u = loadUser() as UserInfo | null;
  const popup = document.getElementById('menuAddressPopup');
  const list = document.getElementById('menuAddressList');
  if (!popup || !list) return;
  
  const map = (u?.wallet?.addressMsg) || {};
  let html = `<div class="tip" style="margin:2px 0 6px;color:#667085;">${t('wallet.addressListTip')}</div>`;
  
  Object.keys(map).forEach((k) => {
    if (u?.address && String(k).toLowerCase() === String(u.address).toLowerCase()) return;
    const m = map[k];
    const type = Number(m.type || 0);
    const val = Number(m.value?.totalValue || m.value?.TotalValue || 0);
    const rate = type === 1 ? 100 : (type === 2 ? 10 : 1);
    const v = Math.round(val * rate);
    html += `<div class="addr-row" style="display:flex;justify-content:space-between;gap:6px;align-items:center;margin:4px 0;">
      <code class="break" style="max-width:150px;background:#f6f8fe;padding:4px 6px;border-radius:8px;">${k}</code>
      <span style="color:#667085;font-weight:600;min-width:64px;text-align:right;white-space:nowrap;">${v} USDT</span>
    </div>`;
  });
  
  if (Object.keys(map).length === 0) html += `<div class="tip">${t('wallet.noAddress')}</div>`;
  list.innerHTML = html;
  
  // 切换弹出框
  const currentShow = headerState?.getValue('showAddressPopup') || false;
  headerState?.set({ showAddressPopup: !currentShow });
}

/**
 * 处理余额弹出框点击
 */
function handleBalancePopupClick(e: MouseEvent): void {
  e.stopPropagation();
  
  // 关闭地址弹出框
  headerState?.set({ showAddressPopup: false });
  
  // 切换弹出框
  const currentShow = headerState?.getValue('showBalancePopup') || false;
  headerState?.set({ showBalancePopup: !currentShow });
}

/**
 * 处理组织点击
 */
function handleOrgClick(e: MouseEvent): void {
  e.stopPropagation();
  
  // 关闭用户菜单
  headerState?.set({ showUserMenu: false });
  
  // 导航到组织详情页
  if (typeof window.routeTo === 'function') {
    window.routeTo('#/group-detail');
  } else {
    location.hash = '#/group-detail';
  }
}

/**
 * 处理菜单头部点击
 */
function handleMenuHeaderClick(e: MouseEvent): void {
  e.stopPropagation();
  
  // 关闭用户菜单
  headerState?.set({ showUserMenu: false });
  
  // 导航到个人资料页
  if (typeof window.routeTo === 'function') {
    window.routeTo('#/profile');
  } else {
    location.hash = '#/profile';
  }
}

/**
 * 处理用户按钮点击
 */
function handleUserButtonClick(e: MouseEvent): void {
  e.stopPropagation();
  
  const currentShow = headerState?.getValue('showUserMenu') || false;
  headerState?.set({ showUserMenu: !currentShow });
}

/**
 * 处理文档点击 (关闭菜单)
 */
function handleDocumentClick(e: Event): void {
  const userMenu = document.getElementById('userMenu');
  const userButton = document.getElementById('userButton');
  
  if (userMenu && userButton) {
    if (!userMenu.contains(e.target as Node) && !userButton.contains(e.target as Node)) {
      headerState?.set({ showUserMenu: false });
    }
  }
}

/**
 * 处理登出点击
 */
function handleLogoutClick(e: MouseEvent): void {
  e.preventDefault();
  e.stopPropagation();
  
  const logoutBtn = document.getElementById('logoutBtn') as HTMLButtonElement | null;
  if (logoutBtn?.disabled) return;
  
  // 清除账户存储
  clearAccountStorage();
  
  // 更新头部显示登出状态
  updateHeaderUser(null);
  
  // 清除 UI 状态
  clearUIState();
  
  // 关闭用户菜单
  headerState?.set({ showUserMenu: false });
  
  // 重定向到欢迎页
  if (typeof window.routeTo === 'function') {
    window.routeTo('#/welcome');
  } else {
    location.hash = '#/welcome';
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * 更新头部用户显示
 */
export function updateHeaderUser(user: UserInfo | null): void {
  const labelEl = document.getElementById('userLabel');
  const avatarEl = document.getElementById('userAvatar');
  
  if (!labelEl || !avatarEl) return; // 头部不存在
  
  // 确保 headerState 存在
  if (!headerState) {
    headerState = createReactiveState(initialState, stateBindings);
  }
  
  if (user && user.accountId) {
    // 显示用户昵称
    const profile = loadUserProfile() as UserProfile;
    const nickname = profile.nickname || 'Amiya';
    const bio = profile.bio || t('profile.signature.placeholder');
    const avatar = profile.avatar || '';
    
    // 计算地址数量
    const subMap = (user.wallet?.addressMsg) || {};
    const addrCount = Object.keys(subMap).length;
    
    // 计算余额
    const vd = (user.wallet?.valueDivision) || { 0: 0, 1: 0, 2: 0 };
    const pgc = Number(vd[0] || 0);
    const btc = Number(vd[1] || 0);
    const eth = Number(vd[2] || 0);
    const totalUsdt = Math.round(pgc * 1 + btc * 100 + eth * 10);
    
    // 更新状态
    headerState.set({
      isLoggedIn: true,
      nickname,
      bio,
      avatar,
      accountId: user.accountId,
      addressCount: addrCount,
      orgId: computeCurrentOrgId() || t('header.noOrg'),
      totalUsdt: totalUsdt + ' USDT',
      pgcBalance: String(pgc),
      btcBalance: String(btc),
      ethBalance: String(eth),
      showAddressPopup: false,
      showBalancePopup: false
    });
    
    // 更新头像 UI
    updateAvatarUI(avatar, true);
    
    // 更新菜单可见性
    updateMenuVisibility(true);
    
    // 更新地址数量
    updateAddressCountUI(addrCount);
    
  } else {
    // 未登录
    headerState.set({
      isLoggedIn: false,
      nickname: t('common.notLoggedIn'),
      bio: t('header.loginHint'),
      avatar: '',
      accountId: '',
      addressCount: 0,
      orgId: '',
      totalUsdt: '0 USDT',
      pgcBalance: '0',
      btcBalance: '0',
      ethBalance: '0',
      showAddressPopup: false,
      showBalancePopup: false
    });
    
    // 更新头像 UI
    updateAvatarUI('', false);
    
    // 更新菜单可见性
    updateMenuVisibility(false);
    
    // 清空地址列表
    const menuAddrList = document.getElementById('menuAddressList');
    if (menuAddrList) menuAddrList.innerHTML = '';
  }
  
  // 绑定事件
  bindAddressPopupEvent();
  bindBalancePopupEvent();
  bindOrgClickEvent();
  bindMenuHeaderClickEvent();
}

/**
 * 绑定地址弹出框事件
 */
function bindAddressPopupEvent(): void {
  const menuAddressItem = document.getElementById('menuAddressItem');
  if (menuAddressItem) {
    // 每次都重新绑定，因为 globalEventManager 在路由切换时会清理事件
    globalEventManager.add(menuAddressItem, 'click', handleAddressPopupClick);
    
    const popup = document.getElementById('menuAddressPopup');
    if (popup) {
      globalEventManager.add(popup, 'click', (e: Event) => e.stopPropagation());
    }
  }
}

/**
 * 绑定余额弹出框事件
 */
function bindBalancePopupEvent(): void {
  const menuBalanceItem = document.getElementById('menuBalanceItem');
  if (menuBalanceItem) {
    // 每次都重新绑定，因为 globalEventManager 在路由切换时会清理事件
    globalEventManager.add(menuBalanceItem, 'click', handleBalancePopupClick);
    
    const popup = document.getElementById('menuBalancePopup');
    if (popup) {
      globalEventManager.add(popup, 'click', (e: Event) => e.stopPropagation());
    }
  }
}

/**
 * 绑定组织点击事件
 */
function bindOrgClickEvent(): void {
  const menuOrgItem = document.getElementById('menuOrgItem');
  if (menuOrgItem) {
    globalEventManager.add(menuOrgItem, 'click', handleOrgClick);
  }
}

/**
 * 绑定菜单头部点击事件
 */
function bindMenuHeaderClickEvent(): void {
  const menuHeader = document.querySelector('.menu-header') as HTMLElement | null;
  if (menuHeader) {
    globalEventManager.add(menuHeader, 'click', handleMenuHeaderClick);
    menuHeader.style.cursor = 'pointer';
  }
}

/**
 * 初始化用户菜单
 */
export function initUserMenu(): void {
  const userButton = document.getElementById('userButton');
  const userMenu = document.getElementById('userMenu');
  
  if (!userButton || !userMenu) return;
  
  // 确保 headerState 存在
  if (!headerState) {
    headerState = createReactiveState(initialState, stateBindings);
  }
  
  // 绑定用户按钮点击
  globalEventManager.add(userButton, 'click', handleUserButtonClick);
  
  // 点击外部关闭菜单
  globalEventManager.add(document as unknown as Element, 'click', handleDocumentClick);
  
  // 绑定登出按钮
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    globalEventManager.add(logoutBtn, 'click', handleLogoutClick);
  }
}

/**
 * 初始化头部滚动行为
 */
export function initHeaderScroll(): void {
  const header = document.querySelector('.header');
  if (!header) return;
  
  let lastScrollY = window.scrollY;
  let ticking = false;
  const scrollDelta = 8;
  
  function isHomePage(): boolean {
    const welcomeHero = document.querySelector('.welcome-hero');
    return !!(welcomeHero && !welcomeHero.classList.contains('hidden'));
  }
  
  function updateHeader(): void {
    const currentScrollY = window.scrollY;
    const delta = currentScrollY - lastScrollY;
    
    // 首页始终显示头部
    if (isHomePage()) {
      header.classList.add('header--visible');
      lastScrollY = currentScrollY;
      ticking = false;
      return;
    }
    
    // 其他页面逻辑
    if (currentScrollY <= 10) {
      header.classList.add('header--visible');
    } else if (delta > scrollDelta) {
      header.classList.remove('header--visible');
    } else if (delta < -scrollDelta) {
      header.classList.add('header--visible');
    }
    
    lastScrollY = currentScrollY;
    ticking = false;
  }
  
  // 只绑定一次滚动监听器
  if (!(window as unknown as Record<string, boolean>)._headerScrollBind) {
    globalEventManager.add(window as unknown as Element, 'scroll', function() {
      if (!ticking) {
        requestAnimationFrame(updateHeader);
        ticking = true;
      }
    }, { passive: true });
    (window as unknown as Record<string, boolean>)._headerScrollBind = true;
  }
  
  // 监听页面变化
  if (!(window as unknown as Record<string, boolean>)._headerHashChangeBind) {
    globalEventManager.add(window as unknown as Element, 'hashchange', function() {
      setTimeout(function() {
        lastScrollY = window.scrollY;
        if (isHomePage() || window.scrollY <= 10) {
          header.classList.add('header--visible');
        }
      }, 100);
    });
    (window as unknown as Record<string, boolean>)._headerHashChangeBind = true;
  }
  
  // 初始状态
  setTimeout(function() {
    if (isHomePage() || window.scrollY <= 10) {
      header.classList.add('header--visible');
    }
    lastScrollY = window.scrollY;
  }, 100);
}
