/**
 * Header UI Module
 * 
 * Provides header user menu functionality and user info display.
 */

import { t } from '../i18n/index.js';
import { loadUser, loadUserProfile, computeCurrentOrgId, clearAccountStorage } from '../utils/storage';
import { globalEventManager } from '../utils/eventUtils.js';

/**
 * Update header user display
 * @param {object} user - User account data
 */
export function updateHeaderUser(user) {
  const labelEl = document.getElementById('userLabel');
  const avatarEl = document.getElementById('userAvatar');
  const menuAddrEl = document.getElementById('menuAddress');
  const menuAddressItem = document.getElementById('menuAddressItem');
  const menuAccountItem = document.getElementById('menuAccountItem');
  const menuAccountIdEl = document.getElementById('menuAccountId');
  const menuOrgItem = document.getElementById('menuOrgItem');
  const menuBalanceItem = document.getElementById('menuBalanceItem');
  const menuOrgEl = document.getElementById('menuOrg');
  const menuBalanceEl = document.getElementById('menuBalance');
  const menuAddrPopup = document.getElementById('menuAddressPopup');
  const menuAddrList = document.getElementById('menuAddressList');
  const menuBalancePopup = document.getElementById('menuBalancePopup');
  const menuBalancePGC = document.getElementById('menuBalancePGC');
  const menuBalanceBTC = document.getElementById('menuBalanceBTC');
  const menuBalanceETH = document.getElementById('menuBalanceETH');
  const menuEmpty = document.getElementById('menuEmpty');
  const logoutEl = document.getElementById('logoutBtn');
  const menuHeader = document.querySelector('.menu-header');
  const menuCards = document.querySelector('.menu-cards');
  const menuHeaderAvatar = document.getElementById('menuHeaderAvatar');
  
  if (!labelEl || !avatarEl) return; // Header doesn't exist
  
  if (user && user.accountId) {
    // Show user nickname
    const profile = loadUserProfile();
    labelEl.textContent = profile.nickname || 'Amiya';
    
    // Update menu header title and subtitle
    const menuHeaderTitleEl = document.getElementById('menuHeaderTitle');
    const menuHeaderSubEl = document.getElementById('menuHeaderSub');
    if (menuHeaderTitleEl) {
      menuHeaderTitleEl.textContent = profile.nickname || 'Amiya';
    }
    if (menuHeaderSubEl) {
      menuHeaderSubEl.textContent = profile.bio || t('profile.signature.placeholder');
    }
    
    // Show custom avatar after login
    avatarEl.classList.add('avatar--active');
    if (menuHeaderAvatar) menuHeaderAvatar.classList.add('avatar--active');
    
    // Update avatar display
    const avatarImg = avatarEl.querySelector('.avatar-img');
    const menuAvatarImg = menuHeaderAvatar?.querySelector('.avatar-img');
    if (profile.avatar) {
      if (avatarImg) {
        avatarImg.src = profile.avatar;
        avatarImg.classList.remove('hidden');
      }
      if (menuAvatarImg) {
        menuAvatarImg.src = profile.avatar;
        menuAvatarImg.classList.remove('hidden');
      }
    } else {
      // Use default avatar
      if (avatarImg) {
        avatarImg.src = '/assets/avatar.png';
        avatarImg.classList.remove('hidden');
      }
      if (menuAvatarImg) {
        menuAvatarImg.src = '/assets/avatar.png';
        menuAvatarImg.classList.remove('hidden');
      }
    }
    
    // Show header and cards area
    if (menuHeader) menuHeader.classList.remove('hidden');
    if (menuCards) menuCards.classList.remove('hidden');
    
    // Show Account ID card
    if (menuAccountItem) menuAccountItem.classList.remove('hidden');
    if (menuAccountIdEl) menuAccountIdEl.textContent = user.accountId;
    if (menuAddressItem) menuAddressItem.classList.remove('hidden');
    const mainAddr = user.address || (user.wallet && Object.keys(user.wallet.addressMsg || {})[0]) || '';
    const subMap = (user.wallet && user.wallet.addressMsg) || {};
    const addrCount = Object.keys(subMap).length;
    if (menuAddrEl) menuAddrEl.textContent = t('header.addresses', { count: addrCount });
    if (menuAddrPopup) menuAddrPopup.classList.add('hidden');
    if (menuOrgItem) menuOrgItem.classList.remove('hidden');
    if (menuBalanceItem) menuBalanceItem.classList.remove('hidden');
    if (menuOrgEl) menuOrgEl.textContent = computeCurrentOrgId() || t('header.noOrg');
    
    // Calculate balance by coin type
    const vd = (user.wallet && user.wallet.valueDivision) || { 0: 0, 1: 0, 2: 0 };
    const pgc = Number(vd[0] || 0);
    const btc = Number(vd[1] || 0);
    const eth = Number(vd[2] || 0);
    const totalUsdt = Math.round(pgc * 1 + btc * 100 + eth * 10);
    
    if (menuBalanceEl) menuBalanceEl.textContent = totalUsdt + ' USDT';
    if (menuBalancePGC) menuBalancePGC.textContent = pgc;
    if (menuBalanceBTC) menuBalanceBTC.textContent = btc;
    if (menuBalanceETH) menuBalanceETH.textContent = eth;
    if (menuBalancePopup) menuBalancePopup.classList.add('hidden');
    
    if (menuOrgEl) menuOrgEl.classList.remove('code-waiting');
    if (menuEmpty) menuEmpty.classList.add('hidden');
    if (logoutEl) {
      logoutEl.disabled = false;
      logoutEl.classList.remove('hidden');
    }
  } else {
    // Not logged in
    labelEl.textContent = t('common.notLoggedIn');
    avatarEl.classList.remove('avatar--active');
    if (menuHeaderAvatar) menuHeaderAvatar.classList.remove('avatar--active');
    
    // Hide avatar image, show default person icon
    const avatarImg = avatarEl.querySelector('.avatar-img');
    const menuAvatarImg = menuHeaderAvatar?.querySelector('.avatar-img');
    if (avatarImg) avatarImg.classList.add('hidden');
    if (menuAvatarImg) menuAvatarImg.classList.add('hidden');
    
    // Show header with not logged in info
    if (menuHeader) menuHeader.classList.remove('hidden');
    const menuHeaderTitleEl = document.getElementById('menuHeaderTitle');
    const menuHeaderSubEl = document.getElementById('menuHeaderSub');
    if (menuHeaderTitleEl) menuHeaderTitleEl.textContent = t('common.notLoggedIn');
    if (menuHeaderSubEl) menuHeaderSubEl.textContent = t('header.loginHint');
    
    // Hide cards area
    if (menuCards) menuCards.classList.add('hidden');
    if (menuAccountItem) menuAccountItem.classList.add('hidden');
    if (menuAccountIdEl) menuAccountIdEl.textContent = '';
    if (menuAddressItem) menuAddressItem.classList.add('hidden');
    if (menuAddrEl) menuAddrEl.textContent = '';
    if (menuOrgItem) menuOrgItem.classList.add('hidden');
    if (menuBalanceItem) menuBalanceItem.classList.add('hidden');
    if (menuOrgEl) menuOrgEl.textContent = '';
    if (menuBalanceEl) menuBalanceEl.textContent = '';
    if (menuBalancePGC) menuBalancePGC.textContent = '0';
    if (menuBalanceBTC) menuBalanceBTC.textContent = '0';
    if (menuBalanceETH) menuBalanceETH.textContent = '0';
    if (menuBalancePopup) menuBalancePopup.classList.add('hidden');
    if (menuOrgEl) menuOrgEl.classList.add('code-waiting');
    if (menuEmpty) menuEmpty.classList.remove('hidden');
    if (logoutEl) {
      logoutEl.disabled = true;
      logoutEl.classList.add('hidden');
    }
    if (menuAddrList) menuAddrList.innerHTML = '';
    if (menuAddrPopup) menuAddrPopup.classList.add('hidden');
  }
  
  // Bind address click event
  bindAddressPopupEvent();
  
  // Bind balance click event
  bindBalancePopupEvent();
  
  // Bind org click event
  bindOrgClickEvent();
  
  // Bind menu header click event
  bindMenuHeaderClickEvent();
}

/**
 * Bind address popup event
 */
function bindAddressPopupEvent() {
  const menuAddressItem = document.getElementById('menuAddressItem');
  if (menuAddressItem) {
    globalEventManager.add(menuAddressItem, 'click', (e) => {
      e.stopPropagation();
      // Close balance popup
      const balancePopup = document.getElementById('menuBalancePopup');
      if (balancePopup) balancePopup.classList.add('hidden');
      
      const u = loadUser();
      const popup = document.getElementById('menuAddressPopup');
      const list = document.getElementById('menuAddressList');
      if (!popup || !list) return;
      
      const map = (u && u.wallet && u.wallet.addressMsg) || {};
      let html = `<div class="tip" style="margin:2px 0 6px;color:#667085;">${t('wallet.addressListTip')}</div>`;
      
      Object.keys(map).forEach((k) => {
        if (u && u.address && String(k).toLowerCase() === String(u.address).toLowerCase()) return;
        const m = map[k];
        const type = Number(m.type || 0);
        const val = Number(m.value && (m.value.totalValue || m.value.TotalValue) || 0);
        const rate = type === 1 ? 100 : (type === 2 ? 10 : 1);
        const v = Math.round(val * rate);
        html += `<div class="addr-row" style="display:flex;justify-content:space-between;gap:6px;align-items:center;margin:4px 0;">
          <code class="break" style="max-width:150px;background:#f6f8fe;padding:4px 6px;border-radius:8px;">${k}</code>
          <span style="color:#667085;font-weight:600;min-width:64px;text-align:right;white-space:nowrap;">${v} USDT</span>
        </div>`;
      });
      
      if (Object.keys(map).length === 0) html += `<div class="tip">${t('wallet.noAddress')}</div>`;
      list.innerHTML = html;
      popup.classList.toggle('hidden');
    });
    
    const popup = document.getElementById('menuAddressPopup');
    if (popup) globalEventManager.add(popup, 'click', (e) => e.stopPropagation());
  }
}

/**
 * Bind balance popup event
 */
function bindBalancePopupEvent() {
  const menuBalanceItem = document.getElementById('menuBalanceItem');
  if (menuBalanceItem) {
    globalEventManager.add(menuBalanceItem, 'click', (e) => {
      e.stopPropagation();
      // Close address popup
      const addrPopup = document.getElementById('menuAddressPopup');
      if (addrPopup) addrPopup.classList.add('hidden');
      
      const popup = document.getElementById('menuBalancePopup');
      if (popup) popup.classList.toggle('hidden');
    });
    
    const popup = document.getElementById('menuBalancePopup');
    if (popup) globalEventManager.add(popup, 'click', (e) => e.stopPropagation());
  }
}

/**
 * Bind org item click event (navigate to group detail)
 */
function bindOrgClickEvent() {
  const menuOrgItem = document.getElementById('menuOrgItem');
  if (menuOrgItem) {
    globalEventManager.add(menuOrgItem, 'click', (e) => {
      e.stopPropagation();
      // Close user menu
      const userMenu = document.getElementById('userMenu');
      if (userMenu) userMenu.classList.add('hidden');
      // Navigate to group detail page
      if (typeof window.routeTo === 'function') {
        window.routeTo('#/group-detail');
      } else {
        location.hash = '#/group-detail';
      }
    });
  }
}

/**
 * Bind menu header click event (navigate to profile)
 */
function bindMenuHeaderClickEvent() {
  const menuHeader = document.querySelector('.menu-header');
  if (menuHeader) {
    globalEventManager.add(menuHeader, 'click', (e) => {
      e.stopPropagation();
      // Close user menu
      const userMenu = document.getElementById('userMenu');
      if (userMenu) userMenu.classList.add('hidden');
      // Navigate to profile page
      if (typeof window.routeTo === 'function') {
        window.routeTo('#/profile');
      } else {
        location.hash = '#/profile';
      }
    });
    menuHeader.style.cursor = 'pointer';
  }
}

/**
 * Clear UI state (reset all form fields and results)
 */
function clearUIState() {
  // Clear new user page
  const newResult = document.getElementById('result');
  if (newResult) newResult.classList.add('hidden');
  
  const ids1 = ['accountId', 'address', 'privHex', 'pubX', 'pubY'];
  ids1.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
  
  const newLoader = document.getElementById('newLoader');
  if (newLoader) newLoader.classList.add('hidden');
  
  // Clear import page
  const importInput = document.getElementById('importPrivHex');
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
  
  // Clear create/new buttons
  const createBtnEl = document.getElementById('createBtn');
  const newNextBtnEl = document.getElementById('newNextBtn');
  if (createBtnEl) createBtnEl.classList.add('hidden');
  if (newNextBtnEl) newNextBtnEl.classList.add('hidden');
  
  // Clear login page
  const loginInput = document.getElementById('loginPrivHex');
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

/**
 * Initialize user menu (toggle visibility on avatar click)
 */
export function initUserMenu() {
  const avatarEl = document.getElementById('userAvatar');
  const userButton = document.getElementById('userButton');
  const userMenu = document.getElementById('userMenu');
  
  if (!userButton || !userMenu) return;
  
  // Always rebind since globalEventManager clears on route change
  globalEventManager.add(userButton, 'click', (e) => {
    e.stopPropagation();
    userMenu.classList.toggle('hidden');
  });
  
  // Close menu when clicking outside - always rebind since globalEventManager clears on route change
  globalEventManager.add(document, 'click', (e) => {
    if (!userMenu.contains(e.target) && !userButton.contains(e.target)) {
      userMenu.classList.add('hidden');
    }
  });
  
  // Bind logout button - always rebind since globalEventManager clears on route change
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    globalEventManager.add(logoutBtn, 'click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (logoutBtn.disabled) return;
      
      // Clear account storage
      clearAccountStorage();
      
      // Update header to show logged out state
      updateHeaderUser(null);
      
      // Clear UI state
      clearUIState();
      
      // Close user menu
      const menu = document.getElementById('userMenu');
      if (menu) menu.classList.add('hidden');
      
      // Redirect to welcome page
      if (typeof window.routeTo === 'function') {
        window.routeTo('#/welcome');
      } else {
        location.hash = '#/welcome';
      }
    });
  }
}

/**
 * Initialize header scroll behavior
 * Shows/hides header based on scroll direction
 */
export function initHeaderScroll() {
  const header = document.querySelector('.header');
  if (!header) return;
  
  let lastScrollY = window.scrollY;
  let ticking = false;
  const scrollDelta = 8; // Scroll change threshold
  
  function isHomePage() {
    const welcomeHero = document.querySelector('.welcome-hero');
    return welcomeHero && !welcomeHero.classList.contains('hidden');
  }
  
  function updateHeader() {
    const currentScrollY = window.scrollY;
    const delta = currentScrollY - lastScrollY;
    
    // Always show header on home page
    if (isHomePage()) {
      header.classList.add('header--visible');
      lastScrollY = currentScrollY;
      ticking = false;
      return;
    }
    
    // Other pages logic:
    // 1. At top - show header
    // 2. Scrolling down - hide header
    // 3. Scrolling up - show header
    
    if (currentScrollY <= 10) {
      // At top, show header
      header.classList.add('header--visible');
    } else if (delta > scrollDelta) {
      // Scrolling down, hide header
      header.classList.remove('header--visible');
    } else if (delta < -scrollDelta) {
      // Scrolling up, show header
      header.classList.add('header--visible');
    }
    // Keep current state if delta is small
    
    lastScrollY = currentScrollY;
    ticking = false;
  }
  
  // Only bind scroll listener once using globalEventManager
  if (!window._headerScrollBind) {
    globalEventManager.add(window, 'scroll', function() {
      if (!ticking) {
        requestAnimationFrame(updateHeader);
        ticking = true;
      }
    }, { passive: true });
    window._headerScrollBind = true;
  }
  
  // Listen for page changes (hash changes) - only bind once
  if (!window._headerHashChangeBind) {
    globalEventManager.add(window, 'hashchange', function() {
      setTimeout(function() {
        lastScrollY = window.scrollY;
        if (isHomePage() || window.scrollY <= 10) {
          header.classList.add('header--visible');
        }
      }, 100);
    });
    window._headerHashChangeBind = true;
  }
  
  // Initial state: show on home page and at top
  setTimeout(function() {
    if (isHomePage() || window.scrollY <= 10) {
      header.classList.add('header--visible');
    }
    lastScrollY = window.scrollY;
  }, 100);
}
