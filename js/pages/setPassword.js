/**
 * Set Password Page Module
 * 
 * Handles the password setup page for new accounts.
 * Flow: User sets password -> Encrypt private key -> Save account -> Enter system
 */

import { saveUser, loadUser } from '../utils/storage';
import { showSuccessToast, showErrorToast } from '../utils/toast.js';
import { t } from '../i18n/index.js';
import { updateHeaderUser } from '../ui/header.js';
import { encryptPrivateKey, saveEncryptedKey } from '../utils/keyEncryption';

// Flag to prevent duplicate submission
let isSubmitting = false;

/**
 * Get pending account data from window
 * @returns {Object|null}
 */
function getPendingAccountData() {
  return window.__pendingAccountData || null;
}

/**
 * Clear pending account data
 */
function clearPendingAccountData() {
  window.__pendingAccountData = null;
}

/**
 * Validate password inputs
 * @returns {{ valid: boolean, password: string, error?: string }}
 */
function validatePasswords() {
  const passwordInput = document.getElementById('setpwdPassword');
  const confirmInput = document.getElementById('setpwdConfirm');
  
  const password = passwordInput?.value?.trim() || '';
  const confirm = confirmInput?.value?.trim() || '';
  
  if (!password) {
    return { valid: false, password: '', error: t('setpwd.passwordRequired', '请输入密码') };
  }
  
  if (password.length < 6) {
    return { valid: false, password: '', error: t('setpwd.passwordTooShort', '密码至少需要6位') };
  }
  
  if (password !== confirm) {
    return { valid: false, password: '', error: t('setpwd.passwordMismatch', '两次输入的密码不一致') };
  }
  
  return { valid: true, password };
}

/**
 * Calculate password strength
 * @param {string} password
 * @returns {'weak' | 'medium' | 'strong'}
 */
function getPasswordStrength(password) {
  if (!password || password.length < 6) return 'weak';
  
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
  const passwordInput = document.getElementById('setpwdPassword');
  const strengthFill = document.getElementById('setpwdStrengthFill');
  const strengthText = document.getElementById('setpwdStrengthText');
  
  const password = passwordInput?.value || '';
  const strength = getPasswordStrength(password);
  
  if (strengthFill) {
    strengthFill.className = 'setpwd-strength-fill ' + strength;
  }
  
  if (strengthText) {
    strengthText.className = 'setpwd-strength-text ' + strength;
    const labels = {
      weak: t('setpwd.strengthWeak', '弱'),
      medium: t('setpwd.strengthMedium', '中'),
      strong: t('setpwd.strengthStrong', '强')
    };
    strengthText.textContent = labels[strength];
  }

  // Also update match status when password changes
  updatePasswordMatch();
}

/**
 * Update password match indicator
 */
function updatePasswordMatch() {
  const passwordInput = document.getElementById('setpwdPassword');
  const confirmInput = document.getElementById('setpwdConfirm');
  const matchIcon = document.getElementById('setpwdPasswordMatchIcon');
  const matchText = document.getElementById('setpwdPasswordMatchText');

  const password = passwordInput?.value || '';
  const confirm = confirmInput?.value || '';

  // Hide if confirm is empty
  if (!confirm) {
    if (matchIcon) matchIcon.classList.add('hidden');
    if (matchText) {
      matchText.classList.add('hidden');
      matchText.textContent = '';
    }
    if (confirmInput) confirmInput.classList.remove('match', 'mismatch');
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
    matchText.classList.remove('hidden');
    matchText.className = 'setpwd-match-text ' + (isMatch ? 'match' : 'mismatch');
    matchText.textContent = isMatch
      ? t('setpwd.passwordMatch', '密码一致')
      : t('setpwd.passwordMismatchHint', '密码不一致');
  }

  // Update input border color
  if (confirmInput) {
    confirmInput.classList.toggle('match', isMatch);
    confirmInput.classList.toggle('mismatch', !isMatch);
  }
}

/**
 * Handle form submission
 */
async function handleSubmit() {
  if (isSubmitting) return;
  
  const data = getPendingAccountData();
  if (!data) {
    showErrorToast(t('setpwd.noAccountData', '账户数据丢失，请重新创建'), t('common.error', '错误'));
    if (typeof window.routeTo === 'function') {
      window.routeTo('#/new');
    }
    return;
  }
  
  const validation = validatePasswords();
  if (!validation.valid) {
    showErrorToast(validation.error, t('setpwd.passwordError', '密码错误'));
    return;
  }
  
  isSubmitting = true;
  
  const btn = document.getElementById('setpwdSubmitBtn');
  if (btn) {
    btn.disabled = true;
    btn.querySelector('span').textContent = t('common.processing', '处理中...');
  }
  
  try {
    // Encrypt private key with password
    const encryptedData = await encryptPrivateKey(data.privHex, validation.password);
    saveEncryptedKey(data.accountId, encryptedData);
    
    // Clear old account data
    const oldUser = loadUser();
    if (!oldUser || oldUser.accountId !== data.accountId) {
      if (typeof window.clearAccountStorage === 'function') {
        window.clearAccountStorage();
      }
    }
    
    // Save user WITHOUT plaintext private key
    saveUser({ 
      accountId: data.accountId, 
      address: data.address, 
      pubXHex: data.pubXHex, 
      pubYHex: data.pubYHex, 
      flowOrigin: 'new',
      _encrypted: true
    });
    
    // Update header
    const user = loadUser();
    updateHeaderUser(user);
    
    // Clear pending data
    clearPendingAccountData();
    
    // Show success
    showSuccessToast(t('toast.account.created'), t('toast.account.createTitle'));
    
    // Navigate to entry page with smooth transition
    const ov = document.getElementById('actionOverlay');
    const ovt = document.getElementById('actionOverlayText');
    if (ovt) ovt.textContent = t('modal.enteringWalletPage', '正在进入钱包管理页面...');
    if (ov) ov.classList.remove('hidden');
    
    window.__skipExitConfirm = true;
    
    setTimeout(() => {
      if (ov) ov.classList.add('hidden');
      if (typeof window.routeTo === 'function') {
        window.routeTo('#/entry');
      }
    }, 800);
    
  } catch (err) {
    showErrorToast(t('setpwd.createFailed', '创建失败') + ': ' + err.message, t('common.error', '错误'));
    console.error(err);
    
    if (btn) {
      btn.disabled = false;
      const span = btn.querySelector('span');
      if (span) span.textContent = t('setpwd.submit', '确认并进入钱包管理');
    }
  } finally {
    isSubmitting = false;
  }
}

/**
 * Reset page state
 */
function resetPageState() {
  const passwordInput = document.getElementById('setpwdPassword');
  const confirmInput = document.getElementById('setpwdConfirm');
  const strengthFill = document.getElementById('setpwdStrengthFill');
  const strengthText = document.getElementById('setpwdStrengthText');
  const matchIcon = document.getElementById('setpwdPasswordMatchIcon');
  const matchText = document.getElementById('setpwdPasswordMatchText');
  const btn = document.getElementById('setpwdSubmitBtn');
  
  if (passwordInput) passwordInput.value = '';
  if (confirmInput) {
    confirmInput.value = '';
    confirmInput.classList.remove('match', 'mismatch');
  }
  if (strengthFill) strengthFill.className = 'setpwd-strength-fill';
  if (strengthText) {
    strengthText.className = 'setpwd-strength-text';
    strengthText.textContent = t('setpwd.strength', '强度');
  }

  // Reset password match indicator
  if (matchIcon) {
    matchIcon.classList.add('hidden');
    const successIcon = matchIcon.querySelector('.match-success');
    const errorIcon = matchIcon.querySelector('.match-error');
    if (successIcon) successIcon.classList.add('hidden');
    if (errorIcon) errorIcon.classList.add('hidden');
  }
  if (matchText) {
    matchText.className = 'setpwd-match-text';
    matchText.textContent = '';
  }

  if (btn) {
    btn.disabled = false;
    const span = btn.querySelector('span');
    if (span) span.textContent = t('setpwd.submit', '确认并进入钱包管理');
  }
  
  isSubmitting = false;
}

/**
 * Initialize set password page
 */
export function initSetPasswordPage() {
  isSubmitting = false;
  resetPageState();
  
  // Check if we have pending account data
  const data = getPendingAccountData();
  if (!data) {
    // No pending data, redirect to new user page
    if (typeof window.routeTo === 'function') {
      window.routeTo('#/new');
    }
    return;
  }
  
  // Bind password input events
  const passwordInput = document.getElementById('setpwdPassword');
  if (passwordInput && !passwordInput.dataset._setpwdBind) {
    passwordInput.dataset._setpwdBind = 'true';
    passwordInput.addEventListener('input', updatePasswordStrength);
  }
  
  // Bind password toggle
  const toggleBtn = document.getElementById('setpwdToggle');
  const confirmInput = document.getElementById('setpwdConfirm');

  // Bind confirm password input for match indicator
  if (confirmInput && !confirmInput.dataset._setpwdMatchBind) {
    confirmInput.dataset._setpwdMatchBind = 'true';
    confirmInput.addEventListener('input', updatePasswordMatch);
  }

  if (toggleBtn && !toggleBtn.dataset._setpwdBind) {
    toggleBtn.dataset._setpwdBind = 'true';
    toggleBtn.addEventListener('click', () => {
      if (passwordInput) {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        if (confirmInput) confirmInput.type = isPassword ? 'text' : 'password';
        
        const eyeOpen = toggleBtn.querySelector('.eye-open');
        const eyeClosed = toggleBtn.querySelector('.eye-closed');
        
        if (isPassword) {
          eyeOpen?.classList.remove('hidden');
          eyeClosed?.classList.add('hidden');
        } else {
          eyeOpen?.classList.add('hidden');
          eyeClosed?.classList.remove('hidden');
        }
      }
    });
  }
  
  // Bind submit button
  const submitBtn = document.getElementById('setpwdSubmitBtn');
  if (submitBtn && !submitBtn.dataset._setpwdBind) {
    submitBtn.dataset._setpwdBind = 'true';
    submitBtn.addEventListener('click', handleSubmit);
  }
  
  // Bind back button
  const backBtn = document.getElementById('setpwdBackBtn');
  if (backBtn && !backBtn.dataset._setpwdBind) {
    backBtn.dataset._setpwdBind = 'true';
    backBtn.addEventListener('click', () => {
      if (typeof window.routeTo === 'function') {
        window.routeTo('#/new');
      }
    });
  }
  
  // Focus password input
  setTimeout(() => {
    passwordInput?.focus();
  }, 300);
}

export { getPendingAccountData, clearPendingAccountData };
