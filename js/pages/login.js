/**
 * Login Page Module
 * 
 * Handles the login page logic.
 */

import { loadUser } from '../utils/storage.js';
import { updateHeaderUser } from '../ui/header.js';

/**
 * Reset login page to initial state
 */
export function resetLoginPageState() {
  const formCard = document.querySelector('.login-form-card');
  const tipBlock = document.querySelector('.login-tip-block');
  const resultEl = document.getElementById('loginResult');
  const loader = document.getElementById('loginLoader');
  const nextBtn = document.getElementById('loginNextBtn');
  const cancelBtn = document.getElementById('loginCancelBtn');
  const inputEl = document.getElementById('loginPrivHex');
  
  // Reset all animation classes
  if (formCard) {
    formCard.classList.remove('collapsed', 'collapsing', 'expanding');
  }
  if (tipBlock) {
    tipBlock.classList.remove('collapsed', 'collapsing', 'expanding');
  }
  if (resultEl) {
    resultEl.classList.add('hidden');
    resultEl.classList.remove('collapsing', 'expanding', 'reveal');
  }
  if (loader) {
    loader.classList.add('hidden');
    loader.classList.remove('collapsed', 'collapsing');
  }
  if (nextBtn) nextBtn.classList.add('hidden');
  if (cancelBtn) cancelBtn.classList.add('hidden');
  
  // Clear input
  if (inputEl) {
    inputEl.value = '';
    inputEl.type = 'password';
  }
  
  // Reset eye icon state - initial state is closed eye (password hidden)
  const eyeOpen = document.querySelector('#loginToggleVisibility .eye-open');
  const eyeClosed = document.querySelector('#loginToggleVisibility .eye-closed');
  if (eyeOpen) eyeOpen.classList.add('hidden');
  if (eyeClosed) eyeClosed.classList.remove('hidden');
  
  // Reset private key collapse state
  const privContainer = document.getElementById('loginPrivContainer');
  if (privContainer) {
    privContainer.classList.add('collapsed');
  }
}

/**
 * Initialize login page
 */
export function initLoginPage() {
  resetLoginPageState();
  
  // Bind visibility toggle event
  const loginToggleVisibility = document.getElementById('loginToggleVisibility');
  const loginPrivHexInput = document.getElementById('loginPrivHex');
  
  if (loginToggleVisibility && loginPrivHexInput && !loginToggleVisibility.dataset._loginBind) {
    loginToggleVisibility.dataset._loginBind = 'true';
    loginToggleVisibility.addEventListener('click', () => {
      const eyeOpen = loginToggleVisibility.querySelector('.eye-open');
      const eyeClosed = loginToggleVisibility.querySelector('.eye-closed');
      
      if (loginPrivHexInput.type === 'password') {
        // Currently hidden -> show plaintext
        loginPrivHexInput.type = 'text';
        if (eyeOpen) eyeOpen.classList.remove('hidden');
        if (eyeClosed) eyeClosed.classList.add('hidden');
      } else {
        // Currently shown -> hide
        loginPrivHexInput.type = 'password';
        if (eyeOpen) eyeOpen.classList.add('hidden');
        if (eyeClosed) eyeClosed.classList.remove('hidden');
      }
    });
  }
  
  // Bind back button
  const loginBackBtn = document.getElementById('loginBackBtn');
  if (loginBackBtn && !loginBackBtn.dataset._loginBind) {
    loginBackBtn.dataset._loginBind = 'true';
    loginBackBtn.addEventListener('click', () => {
      resetLoginPageState();
      if (typeof window.routeTo === 'function') {
        window.routeTo('#/welcome');
      }
    });
  }
  
  // Bind login button - this is handled by global event in original app.js
  // The logic is complex and involves animations, so we'll keep it in a separate handler
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn && !loginBtn.dataset._loginBind) {
    loginBtn.dataset._loginBind = 'true';
    loginBtn.addEventListener('click', handleLoginClick);
  }
  
  // Bind next button - 进入钱包管理
  const loginNextBtn = document.getElementById('loginNextBtn');
  if (loginNextBtn && !loginNextBtn.dataset._loginBind) {
    loginNextBtn.dataset._loginBind = 'true';
    loginNextBtn.addEventListener('click', () => {
      window.__skipExitConfirm = true;
      if (typeof window.routeTo === 'function') {
        window.routeTo('#/entry');
      }
      // Update wallet brief when entering entry page
      if (typeof window.updateWalletBrief === 'function') {
        window.updateWalletBrief();
      }
    });
  }
  
  // Bind cancel button - 重新登录功能
  const loginCancelBtn = document.getElementById('loginCancelBtn');
  if (loginCancelBtn && !loginCancelBtn.dataset._loginBind) {
    loginCancelBtn.dataset._loginBind = 'true';
    loginCancelBtn.addEventListener('click', async () => {
      const resultEl = document.getElementById('loginResult');
      const formCard = document.querySelector('.login-form-card');
      const tipBlock = document.querySelector('.login-tip-block');
      
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
        formCard.classList.remove('collapsed');
        formCard.classList.add('expanding');
        setTimeout(() => formCard.classList.remove('expanding'), 350);
      }
      if (tipBlock) {
        tipBlock.classList.remove('collapsed');
        tipBlock.classList.add('expanding');
        setTimeout(() => tipBlock.classList.remove('expanding'), 350);
      }
      
      // Reset form
      resetLoginPageState();
    });
  }
  
  // Bind private key toggle (expand/collapse) for login result
  const loginPrivContainer = document.getElementById('loginPrivContainer');
  if (loginPrivContainer && !loginPrivContainer.dataset._loginBind) {
    const labelClickable = loginPrivContainer.querySelector('.login-result-label--clickable');
    if (labelClickable) {
      loginPrivContainer.dataset._loginBind = 'true';
      labelClickable.addEventListener('click', () => {
        loginPrivContainer.classList.toggle('collapsed');
      });
    }
  }
}

/**
 * Handle login button click
 */
async function handleLoginClick() {
  const loginBtn = document.getElementById('loginBtn');
  const inputEl = document.getElementById('loginPrivHex');
  const priv = inputEl ? inputEl.value.trim() : '';
  
  // Validation
  if (!priv) {
    if (typeof window.showErrorToast === 'function' && typeof window.t === 'function') {
      window.showErrorToast(window.t('modal.pleaseEnterPrivateKeyHex'), window.t('modal.inputIncomplete'));
    }
    if (inputEl) inputEl.focus();
    return;
  }
  
  const normalized = priv.replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
    if (typeof window.showErrorToast === 'function' && typeof window.t === 'function') {
      window.showErrorToast(window.t('modal.privateKeyFormat64'), window.t('modal.formatError'));
    }
    if (inputEl) inputEl.focus();
    return;
  }
  
  if (loginBtn) loginBtn.disabled = true;
  
  try {
    const formCard = document.querySelector('.login-form-card');
    const tipBlock = document.querySelector('.login-tip-block');
    const loader = document.getElementById('loginLoader');
    const resultEl = document.getElementById('loginResult');
    const nextBtn = document.getElementById('loginNextBtn');
    const cancelBtn = document.getElementById('loginCancelBtn');
    
    // Hide previous results
    if (resultEl) resultEl.classList.add('hidden');
    if (nextBtn) nextBtn.classList.add('hidden');
    if (cancelBtn) cancelBtn.classList.add('hidden');
    
    // Form and tip collapse animation - 更快的衔接
    if (formCard) formCard.classList.add('collapsing');
    if (tipBlock) tipBlock.classList.add('collapsing');
    
    // 等待折叠动画完成（250ms）
    await new Promise(resolve => setTimeout(resolve, 250));
    
    if (formCard) {
      formCard.classList.remove('collapsing');
      formCard.classList.add('collapsed');
    }
    if (tipBlock) {
      tipBlock.classList.remove('collapsing');
      tipBlock.classList.add('collapsed');
    }
    
    // 立即显示加载器
    if (loader) loader.classList.remove('hidden');
    
    const t0 = Date.now();
    let data;
    if (typeof window.importFromPrivHex === 'function') {
      data = await window.importFromPrivHex(priv);
    } else {
      throw new Error('importFromPrivHex function not available');
    }
    
    const elapsed = Date.now() - t0;
    if (elapsed < 1000) {
      await new Promise(resolve => setTimeout(resolve, 1000 - elapsed));
    }
    
    // Loader collapse - 更快的衔接
    if (loader) {
      loader.classList.add('collapsing');
      await new Promise(resolve => setTimeout(resolve, 250));
      loader.classList.remove('collapsing');
      loader.classList.add('hidden', 'collapsed');
    }
    
    // Show result with expand animation - 立即展开
    const resultEl2 = document.getElementById('loginResult');
    if (resultEl2) {
      resultEl2.classList.remove('hidden', 'collapsed');
      resultEl2.classList.add('expanding');
      requestAnimationFrame(() => {
        resultEl2.classList.remove('expanding');
        resultEl2.classList.add('reveal');
      });
    }
    
    const loginAccountId = document.getElementById('loginAccountId');
    const loginAddress = document.getElementById('loginAddress');
    const loginPrivOut = document.getElementById('loginPrivOut');
    const loginPubX = document.getElementById('loginPubX');
    const loginPubY = document.getElementById('loginPubY');
    
    if (loginAccountId) loginAccountId.textContent = data.accountId || '';
    if (loginAddress) loginAddress.textContent = data.address || '';
    if (loginPrivOut) loginPrivOut.textContent = data.privHex || normalized;
    if (loginPubX) loginPubX.textContent = data.pubXHex || '';
    if (loginPubY) loginPubY.textContent = data.pubYHex || '';
    
    // Ensure private key area is collapsed by default
    const privContainer = document.getElementById('loginPrivContainer');
    if (privContainer) privContainer.classList.add('collapsed');
    
    // Clear old account data before saving new account
    const oldUser = typeof window.loadUser === 'function' ? window.loadUser() : null;
    if (!oldUser || oldUser.accountId !== data.accountId) {
      // Different account, clear old data
      if (typeof window.clearAccountStorage === 'function') {
        window.clearAccountStorage();
      }
    }
    
    if (typeof window.saveUser === 'function') {
      window.saveUser({
        accountId: data.accountId,
        address: data.address,
        privHex: data.privHex,
        pubXHex: data.pubXHex,
        pubYHex: data.pubYHex,
        flowOrigin: 'login'
      });
    }
    
    // Update header to show logged in user
    const user = typeof window.loadUser === 'function' ? window.loadUser() : null;
    updateHeaderUser(user);
    
    // Show action buttons
    if (cancelBtn) cancelBtn.classList.remove('hidden');
    if (nextBtn) nextBtn.classList.remove('hidden');
    
    if (typeof window.showSuccessToast === 'function' && typeof window.t === 'function') {
      window.showSuccessToast(window.t('toast.login.successDesc'), window.t('toast.login.success'));
    }
    
  } catch (e) {
    // Error handling: restore form state
    const formCard = document.querySelector('.login-form-card');
    const tipBlock = document.querySelector('.login-tip-block');
    const loader = document.getElementById('loginLoader');
    
    if (loader) {
      loader.classList.add('hidden');
      loader.classList.remove('collapsing', 'collapsed');
    }
    
    // Restore form display
    if (formCard) {
      formCard.classList.remove('collapsing', 'collapsed');
      formCard.classList.add('expanding');
      setTimeout(() => formCard.classList.remove('expanding'), 350);
    }
    if (tipBlock) {
      tipBlock.classList.remove('collapsing', 'collapsed');
      tipBlock.classList.add('expanding');
      setTimeout(() => tipBlock.classList.remove('expanding'), 350);
    }
    
    if (typeof window.showErrorToast === 'function' && typeof window.t === 'function') {
      window.showErrorToast(e.message || window.t('modal.cannotRecognizeKey'), window.t('modal.loginFailed'));
    }
    console.error(e);
  } finally {
    if (loginBtn) loginBtn.disabled = false;
  }
}
