/**
 * Import Page Module
 * 
 * Handles the import wallet page logic.
 */

import { loadUser, saveUser, toAccount } from '../utils/storage.js';
import { importFromPrivHex } from '../services/account.js';
import { showErrorToast } from '../utils/toast.js';
import { showUnifiedLoading, showUnifiedSuccess, hideUnifiedOverlay } from '../ui/modal.js';
import { t } from '../i18n/index.js';
import { wait } from '../utils/helpers.js';
import { updateWalletBrief } from './entry.js';
import { updateHeaderUser } from '../ui/header.js';

/**
 * Reset import page state
 * @param {string} mode - Import mode ('account' or 'wallet')
 */
export function resetImportState(mode = 'account') {
  const importNextBtn = document.getElementById('importNextBtn');
  const importCancelBtn = document.getElementById('importCancelBtn');
  if (importNextBtn) importNextBtn.classList.add('hidden');
  if (importCancelBtn) importCancelBtn.classList.add('hidden');
  
  const importBtn = document.getElementById('importBtn');
  if (importBtn) importBtn.dataset.mode = mode;
  
  const inputEl = document.getElementById('importPrivHex');
  if (inputEl) inputEl.value = '';
  
  const brief = document.getElementById('walletBriefList');
  const toggleBtn = document.getElementById('briefToggleBtn');
  if (brief) {
    brief.classList.add('hidden');
    brief.innerHTML = '';
  }
  if (toggleBtn) toggleBtn.classList.add('hidden');
  
  const addrError = document.getElementById('addrError');
  if (addrError) {
    addrError.textContent = '';
    addrError.classList.add('hidden');
  }
  
  const addrPrivHex = document.getElementById('addrPrivHex');
  if (addrPrivHex) addrPrivHex.value = '';
  
  // Reset visibility toggle
  const eyeOpen = document.querySelector('#importToggleVisibility .eye-open');
  const eyeClosed = document.querySelector('#importToggleVisibility .eye-closed');
  if (eyeOpen) eyeOpen.classList.remove('hidden');
  if (eyeClosed) eyeClosed.classList.add('hidden');
  if (inputEl) inputEl.type = 'password';
  
  // Show form card and hide result
  const formCard = document.querySelector('.import-form-card');
  const resultEl = document.getElementById('importResult');
  const tipBlock = document.querySelector('.import-tip-block');
  
  if (formCard) {
    formCard.classList.remove('import-form-card--hidden');
    formCard.classList.remove('collapsing');
  }
  if (tipBlock) {
    tipBlock.classList.remove('import-tip-block--hidden');
    tipBlock.classList.remove('collapsing');
  }
  if (resultEl) {
    resultEl.classList.add('hidden');
    resultEl.classList.remove('reveal');
    resultEl.classList.remove('expanding');
  }
}

/**
 * Handle import button click
 */
async function handleImport() {
  const importBtn = document.getElementById('importBtn');
  const mode = importBtn ? (importBtn.dataset.mode || 'account') : 'account';
  const inputEl = document.getElementById('importPrivHex');
  const priv = inputEl ? inputEl.value.trim() : '';
  
  if (!priv) {
    showErrorToast(t('modal.pleaseEnterPrivateKey'), t('modal.inputError'));
    if (inputEl) inputEl.focus();
    return;
  }
  
  // Simple validation: allow 0x prefix; after removing prefix must be 64 hex chars
  const normalized = priv.replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
    showErrorToast(t('modal.privateKeyFormatError'), t('modal.formatError'));
    if (inputEl) inputEl.focus();
    return;
  }
  
  if (importBtn) importBtn.disabled = true;
  
  try {
    const loader = document.getElementById('importLoader');
    const resultEl = document.getElementById('importResult');
    const importNextBtn = document.getElementById('importNextBtn');
    const importCancelBtn = document.getElementById('importCancelBtn');
    const formCard = document.querySelector('.import-form-card');
    const tipBlock = document.querySelector('.import-tip-block');
    
    if (importNextBtn) importNextBtn.classList.add('hidden');
    if (importCancelBtn) importCancelBtn.classList.add('hidden');
    if (resultEl) resultEl.classList.add('hidden');
    
    // Show loading state
    if (mode === 'account') {
      // Hide form card with animation - 更快的衔接
      if (formCard) {
        formCard.classList.add('collapsing');
      }
      if (tipBlock) {
        tipBlock.classList.add('collapsing');
      }
      
      // 等待折叠动画完成（250ms）
      await new Promise(resolve => setTimeout(resolve, 250));
      
      if (formCard) formCard.classList.add('import-form-card--hidden');
      if (tipBlock) tipBlock.classList.add('import-tip-block--hidden');
      
      // 立即显示加载器
      if (loader) loader.classList.remove('hidden');
    } else {
      showUnifiedLoading(t('modal.addingWalletAddress'));
    }
    
    const t0 = Date.now();
    const data = await importFromPrivHex(priv);
    const elapsed = Date.now() - t0;
    if (elapsed < 1000) await wait(1000 - elapsed);
    if (loader) loader.classList.add('hidden');
    
    if (mode === 'account') {
      // Show result with smooth animation
      if (resultEl) {
        resultEl.classList.remove('hidden');
        resultEl.classList.remove('fade-in');
        resultEl.classList.remove('reveal');
        resultEl.classList.add('expanding');
        requestAnimationFrame(() => {
          resultEl.classList.remove('expanding');
          resultEl.classList.add('reveal');
        });
      }
      
      const importAccountId = document.getElementById('importAccountId');
      const importAddress = document.getElementById('importAddress');
      const importPrivHexOut = document.getElementById('importPrivHexOut');
      const importPubX = document.getElementById('importPubX');
      const importPubY = document.getElementById('importPubY');
      
      if (importAccountId) importAccountId.textContent = data.accountId || '';
      if (importAddress) importAddress.textContent = data.address || '';
      if (importPrivHexOut) importPrivHexOut.textContent = data.privHex || normalized;
      if (importPubX) importPubX.textContent = data.pubXHex || '';
      if (importPubY) importPubY.textContent = data.pubYHex || '';
      
      // Check if user already exists
      const existingUser = loadUser();
      const addr = (data.address || '').toLowerCase();
      
      let acc;
      if (existingUser && existingUser.accountId) {
        // User exists - add address to existing account
        acc = toAccount({ accountId: existingUser.accountId, address: existingUser.address }, existingUser);
        
        // Check if address already exists
        const addressExists = (acc.wallet && acc.wallet.addressMsg && acc.wallet.addressMsg[addr]) || 
                             (existingUser.address && String(existingUser.address).toLowerCase() === addr);
        
        if (addressExists) {
          hideUnifiedOverlay();
          showErrorToast(t('toast.addressExists'), t('modal.operationFailed'));
          if (importBtn) importBtn.disabled = false;
          const loader = document.getElementById('importLoader');
          if (loader) loader.classList.add('hidden');
          // Reset the page
          resetImportState('account');
          return;
        }
      } else {
        // No existing user - create new account
        // Clear any old data first
        if (typeof window.clearAccountStorage === 'function') {
          window.clearAccountStorage();
        }
        
        const accountData = { 
          accountId: data.accountId, 
          address: data.address, 
          privHex: data.privHex, 
          pubXHex: data.pubXHex, 
          pubYHex: data.pubYHex 
        };
        acc = toAccount(accountData, accountData);
      }
      
      // Add the imported address to wallet.addressMsg
      if (addr && acc.wallet && acc.wallet.addressMsg) {
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
      
      // Update header to show logged in user
      const user = loadUser();
      updateHeaderUser(user);
      
      // Show action buttons
      if (importNextBtn) importNextBtn.classList.remove('hidden');
      if (importCancelBtn) importCancelBtn.classList.remove('hidden');
      
      // Ensure private key is collapsed by default
      const importPrivateKeyItem = document.getElementById('importPrivateKeyItem');
      if (importPrivateKeyItem) importPrivateKeyItem.classList.add('import-result-item--collapsed');
    } else {
      // Wallet mode - add to existing account
      const u2 = loadUser();
      if (!u2 || !u2.accountId) { 
        hideUnifiedOverlay();
        showErrorToast(t('modal.pleaseLoginFirst'), t('modal.operationFailed')); 
        return; 
      }
      
      const acc = toAccount({ accountId: u2.accountId, address: u2.address }, u2);
      const addr = (data.address || '').toLowerCase();
      
      if (!addr) {
        showUnifiedSuccess(t('toast.importFailed'), t('toast.cannotParseAddress'), () => {}, null, true);
        return;
      }
      
      const exists = (acc.wallet && acc.wallet.addressMsg && acc.wallet.addressMsg[addr]) || 
                     (u2.address && String(u2.address).toLowerCase() === addr);
      if (exists) {
        showUnifiedSuccess(t('toast.importFailed'), t('toast.addressExists'), () => {}, null, true);
        return;
      }
      
      if (addr) {
        acc.wallet.addressMsg[addr] = acc.wallet.addressMsg[addr] || { 
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
        if (typeof window.routeTo === 'function') {
          window.routeTo('#/entry');
        }
      });
    }
  } catch (err) {
    hideUnifiedOverlay();
    showErrorToast(t('modal.importFailed', { error: err.message }), t('modal.systemError'));
    console.error(err);
  } finally {
    if (importBtn) importBtn.disabled = false;
    const loader = document.getElementById('importLoader');
    if (loader) loader.classList.add('hidden');
  }
}

/**
 * Initialize import page
 */
export function initImportPage() {
  resetImportState('account');
  
  // Bind import button event
  const importBtn = document.getElementById('importBtn');
  if (importBtn && !importBtn.dataset._importBind) {
    importBtn.dataset._importBind = 'true';
    importBtn.addEventListener('click', handleImport);
  }
  
  // Bind visibility toggle event
  const importToggleVisibility = document.getElementById('importToggleVisibility');
  const importPrivHexInput = document.getElementById('importPrivHex');
  
  if (importToggleVisibility && importPrivHexInput && !importToggleVisibility.dataset._importBind) {
    importToggleVisibility.dataset._importBind = 'true';
    importToggleVisibility.addEventListener('click', () => {
      const eyeOpen = importToggleVisibility.querySelector('.eye-open');
      const eyeClosed = importToggleVisibility.querySelector('.eye-closed');
      
      if (importPrivHexInput.type === 'password') {
        importPrivHexInput.type = 'text';
        if (eyeOpen) eyeOpen.classList.add('hidden');
        if (eyeClosed) eyeClosed.classList.remove('hidden');
      } else {
        importPrivHexInput.type = 'password';
        if (eyeOpen) eyeOpen.classList.remove('hidden');
        if (eyeClosed) eyeClosed.classList.add('hidden');
      }
    });
  }
  
  // Bind back button
  const importBackBtn = document.getElementById('importBackBtn');
  if (importBackBtn && !importBackBtn.dataset._importBind) {
    importBackBtn.dataset._importBind = 'true';
    importBackBtn.addEventListener('click', () => {
      if (typeof window.routeTo === 'function') {
        window.routeTo('#/entry');
      }
      if (typeof window.updateWalletBrief === 'function') {
        window.updateWalletBrief();
      }
    });
  }
  
  // Bind private key toggle (expand/collapse) for import result
  const importPrivateKeyToggle = document.getElementById('importPrivateKeyToggle');
  const importPrivateKeyItem = document.getElementById('importPrivateKeyItem');
  if (importPrivateKeyToggle && importPrivateKeyItem && !importPrivateKeyToggle.dataset._importBind) {
    importPrivateKeyToggle.dataset._importBind = 'true';
    importPrivateKeyToggle.addEventListener('click', () => {
      importPrivateKeyItem.classList.toggle('import-result-item--collapsed');
    });
  }
  
  // Bind cancel button to reset the page
  const importCancelBtn = document.getElementById('importCancelBtn');
  if (importCancelBtn && !importCancelBtn.dataset._importBind) {
    importCancelBtn.dataset._importBind = 'true';
    importCancelBtn.addEventListener('click', async () => {
      const resultEl = document.getElementById('importResult');
      const formCard = document.querySelector('.import-form-card');
      const tipBlock = document.querySelector('.import-tip-block');
      
      // Hide result with animation - 更快的衔接
      if (resultEl) {
        resultEl.classList.add('collapsing');
        await new Promise(resolve => setTimeout(resolve, 250));
        resultEl.classList.add('hidden');
        resultEl.classList.remove('collapsing');
        resultEl.classList.remove('reveal');
      }
      
      // Show form card with animation - 立即展开
      if (formCard) {
        formCard.classList.remove('import-form-card--hidden');
        formCard.classList.add('expanding');
        setTimeout(() => formCard.classList.remove('expanding'), 350);
      }
      if (tipBlock) {
        tipBlock.classList.remove('import-tip-block--hidden');
        tipBlock.classList.add('expanding');
        setTimeout(() => tipBlock.classList.remove('expanding'), 350);
      }
      
      // Reset form
      resetImportState('account');
    });
  }
  
  // Bind next button to go to entry page
  const importNextBtn = document.getElementById('importNextBtn');
  if (importNextBtn && !importNextBtn.dataset._importBind) {
    importNextBtn.dataset._importBind = 'true';
    importNextBtn.addEventListener('click', () => {
      // Navigate to entry page - router will call initEntryPage which updates the wallet brief
      if (typeof window.routeTo === 'function') {
        window.routeTo('#/entry');
      }
    });
  }
}
