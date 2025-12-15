/**
 * Login Page Module
 * 
 * Handles the login page logic.
 * Now includes mandatory password setup for private key encryption.
 * Features: password strength indicator, confirm password with match validation.
 */

import { loadUser } from '../utils/storage';
import { updateHeaderUser } from '../ui/header.js';
import { encryptPrivateKey, saveEncryptedKey } from '../utils/keyEncryption';
import { t } from '../i18n/index.js';

/**
 * Calculate password strength
 * @param {string} password
 * @returns {'weak' | 'medium' | 'strong' | ''}
 */
function getPasswordStrength(password) {
  if (!password || password.length === 0) return '';
  if (password.length < 6) return 'weak';
  
  let score = 0;
  
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  
  if (score <= 2) return 'weak';
  if (score <= 4) return 'medium';
  return 'strong';
}

/**
 * Update password strength indicator
 */
function updatePasswordStrength() {
  const passwordInput = document.getElementById('loginPassword');
  const strengthFill = document.getElementById('loginStrengthFill');
  const strengthText = document.getElementById('loginStrengthText');
  
  const password = passwordInput?.value || '';
  const strength = getPasswordStrength(password);
  
  if (strengthFill) {
    strengthFill.className = 'login-strength-fill' + (strength ? ' ' + strength : '');
  }
  
  if (strengthText) {
    strengthText.className = 'login-strength-text' + (strength ? ' ' + strength : '');
    if (strength) {
      const labels = {
        weak: t('login.strengthWeak', '弱'),
        medium: t('login.strengthMedium', '中'),
        strong: t('login.strengthStrong', '强')
      };
      strengthText.textContent = labels[strength];
    } else {
      strengthText.textContent = '';
    }
  }
  
  // Also update match status when password changes
  updatePasswordMatch();
}

/**
 * Update password match indicator
 */
function updatePasswordMatch() {
  const passwordInput = document.getElementById('loginPassword');
  const confirmInput = document.getElementById('loginConfirmPassword');
  const matchIcon = document.getElementById('loginPasswordMatchIcon');
  const matchText = document.getElementById('loginPasswordMatchText');
  
  const password = passwordInput?.value || '';
  const confirm = confirmInput?.value || '';
  
  // Hide if confirm is empty
  if (!confirm) {
    if (matchIcon) matchIcon.classList.add('hidden');
    if (matchText) {
      matchText.textContent = '';
    }
    return;
  }
  
  const isMatch = password === confirm;
  
  // Update icon
  if (matchIcon) {
    matchIcon.classList.remove('hidden');
    const successIcon = matchIcon.querySelector('.match-success');
    const errorIcon = matchIcon.querySelector('.match-error');
    
    if (isMatch) {
      successIcon?.classList.remove('hidden');
      errorIcon?.classList.add('hidden');
    } else {
      successIcon?.classList.add('hidden');
      errorIcon?.classList.remove('hidden');
    }
  }
  
  // Update text - display inside the icon container
  if (matchText) {
    matchText.className = 'login-match-text ' + (isMatch ? 'match' : 'mismatch');
    matchText.textContent = isMatch 
      ? t('login.passwordMatch', '密码一致') 
      : t('login.passwordMismatch', '密码不一致');
  }
  
  // Update input border color
  if (confirmInput) {
    confirmInput.classList.toggle('match', isMatch);
    confirmInput.classList.toggle('mismatch', !isMatch);
  }
}

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
  const passwordEl = document.getElementById('loginPassword');
  const confirmEl = document.getElementById('loginConfirmPassword');
  
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
  
  // Clear inputs
  if (inputEl) {
    inputEl.value = '';
    inputEl.type = 'password';
  }
  if (passwordEl) {
    passwordEl.value = '';
    passwordEl.type = 'password';
  }
  if (confirmEl) {
    confirmEl.value = '';
    confirmEl.type = 'password';
  }
  
  // Reset eye icon state for private key - initial state is closed eye (password hidden)
  const eyeOpen = document.querySelector('#loginToggleVisibility .eye-open');
  const eyeClosed = document.querySelector('#loginToggleVisibility .eye-closed');
  if (eyeOpen) eyeOpen.classList.add('hidden');
  if (eyeClosed) eyeClosed.classList.remove('hidden');
  
  // Reset eye icon state for password
  const pwdEyeOpen = document.querySelector('#loginPasswordToggle .eye-open');
  const pwdEyeClosed = document.querySelector('#loginPasswordToggle .eye-closed');
  if (pwdEyeOpen) pwdEyeOpen.classList.add('hidden');
  if (pwdEyeClosed) pwdEyeClosed.classList.remove('hidden');
  
  // Reset password strength indicator
  const strengthFill = document.getElementById('loginStrengthFill');
  const strengthText = document.getElementById('loginStrengthText');
  if (strengthFill) strengthFill.className = 'login-strength-fill';
  if (strengthText) {
    strengthText.className = 'login-strength-text';
    strengthText.textContent = '';
  }
  
  // Reset password match indicator
  const matchIcon = document.getElementById('loginPasswordMatchIcon');
  const matchText = document.getElementById('loginPasswordMatchText');
  if (matchIcon) {
    matchIcon.classList.add('hidden');
    const successIcon = matchIcon.querySelector('.match-success');
    const errorIcon = matchIcon.querySelector('.match-error');
    if (successIcon) successIcon.classList.add('hidden');
    if (errorIcon) errorIcon.classList.add('hidden');
  }
  if (matchText) {
    matchText.className = 'login-match-text';
    matchText.textContent = '';
  }
  
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
  
  // Bind visibility toggle event for private key
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
  
  // Bind visibility toggle event for password
  const loginPasswordToggle = document.getElementById('loginPasswordToggle');
  const loginPasswordInput = document.getElementById('loginPassword');
  const loginConfirmInput = document.getElementById('loginConfirmPassword');
  
  if (loginPasswordToggle && loginPasswordInput && !loginPasswordToggle.dataset._loginBind) {
    loginPasswordToggle.dataset._loginBind = 'true';
    loginPasswordToggle.addEventListener('click', () => {
      const eyeOpen = loginPasswordToggle.querySelector('.eye-open');
      const eyeClosed = loginPasswordToggle.querySelector('.eye-closed');
      
      if (loginPasswordInput.type === 'password') {
        loginPasswordInput.type = 'text';
        if (loginConfirmInput) loginConfirmInput.type = 'text';
        if (eyeOpen) eyeOpen.classList.remove('hidden');
        if (eyeClosed) eyeClosed.classList.add('hidden');
      } else {
        loginPasswordInput.type = 'password';
        if (loginConfirmInput) loginConfirmInput.type = 'password';
        if (eyeOpen) eyeOpen.classList.add('hidden');
        if (eyeClosed) eyeClosed.classList.remove('hidden');
      }
    });
  }
  
  // Bind password input for strength indicator
  if (loginPasswordInput && !loginPasswordInput.dataset._loginStrengthBind) {
    loginPasswordInput.dataset._loginStrengthBind = 'true';
    loginPasswordInput.addEventListener('input', updatePasswordStrength);
  }
  
  // Bind confirm password input for match indicator
  if (loginConfirmInput && !loginConfirmInput.dataset._loginMatchBind) {
    loginConfirmInput.dataset._loginMatchBind = 'true';
    loginConfirmInput.addEventListener('input', updatePasswordMatch);
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
  const passwordEl = document.getElementById('loginPassword');
  const confirmEl = document.getElementById('loginConfirmPassword');
  const priv = inputEl ? inputEl.value.trim() : '';
  const password = passwordEl ? passwordEl.value.trim() : '';
  const confirmPassword = confirmEl ? confirmEl.value.trim() : '';
  
  // Validation - Private key
  if (!priv) {
    if (typeof window.showErrorToast === 'function') {
      window.showErrorToast(t('modal.pleaseEnterPrivateKeyHex', '请输入私钥'), t('modal.inputIncomplete', '输入不完整'));
    }
    if (inputEl) inputEl.focus();
    return;
  }
  
  const normalized = priv.replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
    if (typeof window.showErrorToast === 'function') {
      window.showErrorToast(t('modal.privateKeyFormat64', '私钥格式错误，需要64位十六进制'), t('modal.formatError', '格式错误'));
    }
    if (inputEl) inputEl.focus();
    return;
  }
  
  // Validation - Password
  if (!password) {
    if (typeof window.showErrorToast === 'function') {
      window.showErrorToast(t('login.passwordRequired', '请输入钱包密码'), t('modal.inputIncomplete', '输入不完整'));
    }
    if (passwordEl) passwordEl.focus();
    return;
  }
  
  if (password.length < 6) {
    if (typeof window.showErrorToast === 'function') {
      window.showErrorToast(t('login.passwordTooShort', '密码至少需要6位'), t('modal.formatError', '格式错误'));
    }
    if (passwordEl) passwordEl.focus();
    return;
  }
  
  // Validation - Confirm Password
  if (!confirmPassword) {
    if (typeof window.showErrorToast === 'function') {
      window.showErrorToast(t('login.confirmPasswordRequired', '请再次输入密码'), t('modal.inputIncomplete', '输入不完整'));
    }
    if (confirmEl) confirmEl.focus();
    return;
  }
  
  if (password !== confirmPassword) {
    if (typeof window.showErrorToast === 'function') {
      window.showErrorToast(t('login.passwordMismatch', '两次输入的密码不一致'), t('modal.formatError', '格式错误'));
    }
    if (confirmEl) confirmEl.focus();
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
    
    // Encrypt private key with password
    const encryptedData = await encryptPrivateKey(data.privHex, password);
    saveEncryptedKey(data.accountId, encryptedData);
    
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
    
    // Save user WITHOUT plaintext private key (it's encrypted now)
    if (typeof window.saveUser === 'function') {
      window.saveUser({
        accountId: data.accountId,
        address: data.address,
        // Don't save privHex in plaintext - it's encrypted
        pubXHex: data.pubXHex,
        pubYHex: data.pubYHex,
        flowOrigin: 'login',
        _encrypted: true
      });
    }
    
    // Update header to show logged in user
    const user = typeof window.loadUser === 'function' ? window.loadUser() : null;
    updateHeaderUser(user);
    
    // Show action buttons
    if (cancelBtn) cancelBtn.classList.remove('hidden');
    if (nextBtn) nextBtn.classList.remove('hidden');
    
    if (typeof window.showSuccessToast === 'function') {
      window.showSuccessToast(t('toast.login.successDesc', '登录成功'), t('toast.login.success', '成功'));
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
    
    if (typeof window.showErrorToast === 'function') {
      window.showErrorToast(e.message || t('modal.cannotRecognizeKey', '无法识别私钥'), t('modal.loginFailed', '登录失败'));
    }
    console.error(e);
  } finally {
    if (loginBtn) loginBtn.disabled = false;
  }
}
