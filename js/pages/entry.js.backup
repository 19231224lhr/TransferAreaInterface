/**
 * Entry Page Module
 * 
 * Handles the wallet management entry page logic.
 */

import { loadUser } from '../utils/storage';
import { t } from '../i18n/index.js';
import { escapeHtml } from '../utils/security';

/**
 * Update wallet brief list on entry page
 * Shows the list of wallet addresses with their origin badges
 */
export function updateWalletBrief() {
  const u = loadUser();
  const countEl = document.getElementById('walletCount');
  const brief = document.getElementById('walletBriefList');
  const tip = document.getElementById('walletEmptyTip');
  const entryNextBtn = document.getElementById('entryNextBtn');
  const addrs = u && u.wallet ? Object.keys(u.wallet.addressMsg || {}) : [];
  
  if (countEl) countEl.textContent = String(addrs.length);
  
  if (brief) {
    if (addrs.length) {
      brief.classList.remove('hidden');
      
      const originOf = (addr) => {
        const u2 = loadUser();
        const ori = u2 && u2.wallet && u2.wallet.addressMsg && u2.wallet.addressMsg[addr] && u2.wallet.addressMsg[addr].origin ? u2.wallet.addressMsg[addr].origin : '';
        return ori === 'created' 
          ? { label: t('modal.newAddress'), cls: 'origin--created' } 
          : (ori === 'imported' 
            ? { label: t('wallet.import'), cls: 'origin--imported' } 
            : { label: t('common.info'), cls: 'origin--unknown' });
      };
      
      const items = addrs.map(a => {
        const o = originOf(a);
        return `<li data-addr="${escapeHtml(a)}"><span class="wallet-addr">${escapeHtml(a)}</span><span class="origin-badge ${o.cls}">${o.label}</span></li>`;
      }).join('');
      brief.innerHTML = items;
      
      // Collapse if more than 3 items
      const toggleBtn = document.getElementById('briefToggleBtn');
      if (addrs.length > 3) {
        brief.classList.add('collapsed');
        if (toggleBtn) { 
          toggleBtn.classList.remove('hidden'); 
          const spanEl = toggleBtn.querySelector('span');
          if (spanEl) spanEl.textContent = t('common.expandMore');
          toggleBtn.classList.remove('expanded');
        }
      } else {
        brief.classList.remove('collapsed');
        if (toggleBtn) toggleBtn.classList.add('hidden');
      }
    } else {
      brief.classList.add('hidden');
      brief.innerHTML = '';
    }
  }
  
  if (entryNextBtn) {
    entryNextBtn.disabled = (addrs.length === 0) && !(u && u.orgNumber);
  }
  
  if (tip) {
    if (addrs.length === 0 && !(u && u.orgNumber)) {
      tip.classList.remove('hidden');
    } else {
      tip.classList.add('hidden');
    }
  }
}

/**
 * Initialize entry page
 */
export function initEntryPage() {
  updateWalletBrief();
  
  // Bind toggle button event
  const toggleBtn = document.getElementById('briefToggleBtn');
  if (toggleBtn && !toggleBtn.dataset._entryBind) {
    toggleBtn.dataset._entryBind = 'true';
    toggleBtn.addEventListener('click', () => {
      const list = document.getElementById('walletBriefList');
      if (!list) return;
      const collapsed = list.classList.contains('collapsed');
      if (collapsed) {
        list.classList.remove('collapsed');
        toggleBtn.classList.add('expanded');
        const spanEl = toggleBtn.querySelector('span');
        if (spanEl) spanEl.textContent = t('common.collapseMore');
      } else {
        list.classList.add('collapsed');
        toggleBtn.classList.remove('expanded');
        const spanEl = toggleBtn.querySelector('span');
        if (spanEl) spanEl.textContent = t('common.expandMore');
      }
    });
  }
  
  // Bind create wallet button
  const createWalletBtn = document.getElementById('createWalletBtn');
  if (createWalletBtn && !createWalletBtn.dataset._entryBind) {
    createWalletBtn.dataset._entryBind = 'true';
    createWalletBtn.addEventListener('click', () => {
      if (typeof window.addNewSubWallet === 'function') {
        window.addNewSubWallet();
      }
    });
  }
  
  // Bind import wallet button
  const importWalletBtn = document.getElementById('importWalletBtn');
  if (importWalletBtn && !importWalletBtn.dataset._entryBind) {
    importWalletBtn.dataset._entryBind = 'true';
    importWalletBtn.addEventListener('click', () => {
      if (typeof window.routeTo === 'function') {
        window.routeTo('#/wallet-import');
      }
    });
  }
  
  // Bind back button
  const entryBackBtn = document.getElementById('entryBackBtn');
  if (entryBackBtn && !entryBackBtn.dataset._entryBind) {
    entryBackBtn.dataset._entryBind = 'true';
    entryBackBtn.addEventListener('click', () => {
      if (typeof window.routeTo === 'function') {
        window.routeTo('#/welcome');
      }
    });
  }
  
  // Bind next button (continue to join group or main page)
  const entryNextBtn = document.getElementById('entryNextBtn');
  if (entryNextBtn && !entryNextBtn.dataset._entryBind) {
    entryNextBtn.dataset._entryBind = 'true';
    entryNextBtn.addEventListener('click', () => {
      const u = loadUser();
      const addrs = u && u.wallet ? Object.keys(u.wallet.addressMsg || {}) : [];
      
      // Show confirmation modal
      const proceedModal = document.getElementById('confirmProceedModal');
      const proceedText = document.getElementById('confirmProceedText');
      
      if (proceedText && typeof window.t === 'function') {
        proceedText.textContent = window.t('modal.currentSubAddressCount', { count: addrs.length });
      }
      if (proceedModal) proceedModal.classList.remove('hidden');
    });
  }
  
  // Bind proceed modal OK button
  const proceedOk = document.getElementById('confirmProceedOk');
  if (proceedOk && !proceedOk.dataset._entryBind) {
    proceedOk.dataset._entryBind = 'true';
    proceedOk.addEventListener('click', () => {
      const proceedModal = document.getElementById('confirmProceedModal');
      if (proceedModal) proceedModal.classList.add('hidden');
      
      // Check if user has already joined an organization
      const u = loadUser();
      const gid = u && u.orgNumber ? u.orgNumber : '';
      
      if (gid && typeof window.routeTo === 'function') {
        window.routeTo('#/inquiry-main');
      } else if (typeof window.routeTo === 'function') {
        window.routeTo('#/join-group');
      }
    });
  }
  
  // Bind proceed modal Cancel button
  const proceedCancel = document.getElementById('confirmProceedCancel');
  if (proceedCancel && !proceedCancel.dataset._entryBind) {
    proceedCancel.dataset._entryBind = 'true';
    proceedCancel.addEventListener('click', () => {
      const proceedModal = document.getElementById('confirmProceedModal');
      if (proceedModal) proceedModal.classList.add('hidden');
    });
  }
}
