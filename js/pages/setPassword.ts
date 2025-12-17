/**
 * Set Password Page Module (Reactive Version)
 * 
 * 使用响应式绑定系统重构的密码设置页面。
 * 特性：
 * - 声明式 UI 绑定，状态变化自动同步 DOM
 * - 密码强度指示器
 * - 密码确认匹配验证
 * - 私钥加密存储
 * 
 * @module pages/setPassword
 */

import { saveUser, loadUser } from '../utils/storage';
import { showSuccessToast, showErrorToast } from '../utils/toast.js';
import { t } from '../i18n/index.js';
import { updateHeaderUser } from '../ui/header';
import { encryptPrivateKey, saveEncryptedKey } from '../utils/keyEncryption';
import {
  createReactiveState,
  type ReactiveState
} from '../utils/reactive';

// ============================================================================
// Types
// ============================================================================

/**
 * 密码强度等级
 */
type PasswordStrength = '' | 'weak' | 'medium' | 'strong';

/**
 * 设置密码页面状态
 */
interface SetPasswordPageState {
  // UI 状态
  isSubmitting: boolean;
  
  // 密码可见性
  passwordVisible: boolean;
  
  // 密码强度
  passwordStrength: PasswordStrength;
  
  // 密码匹配
  showMatchIndicator: boolean;
  passwordsMatch: boolean;
}

/**
 * 待处理的账户数据
 */
interface PendingAccountData {
  accountId: string;
  address: string;
  privHex: string;
  pubXHex: string;
  pubYHex: string;
}

// ============================================================================
// State & Bindings
// ============================================================================

/**
 * 初始状态
 */
const initialState: SetPasswordPageState = {
  isSubmitting: false,
  passwordVisible: false,
  passwordStrength: '',
  showMatchIndicator: false,
  passwordsMatch: false
};

/**
 * 状态到 DOM 的绑定配置
 */
const stateBindings = {
  isSubmitting: [
    { selector: '#setpwdSubmitBtn', type: 'prop' as const, name: 'disabled' }
  ]
};

// 页面状态实例
let pageState: ReactiveState<SetPasswordPageState> | null = null;

// 事件清理函数数组
let eventCleanups: (() => void)[] = [];

// ============================================================================
// Password Strength
// ============================================================================

/**
 * 计算密码强度
 */
function getPasswordStrength(password: string): PasswordStrength {
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
 * 获取密码强度标签
 */
function getStrengthLabel(strength: PasswordStrength): string {
  const labels: Record<PasswordStrength, string> = {
    '': '',
    weak: t('setpwd.strengthWeak') || '弱',
    medium: t('setpwd.strengthMedium') || '中',
    strong: t('setpwd.strengthStrong') || '强'
  };
  return labels[strength];
}

/**
 * 更新密码强度 UI
 */
function updateStrengthUI(strength: PasswordStrength): void {
  const strengthFill = document.getElementById('setpwdStrengthFill');
  const strengthText = document.getElementById('setpwdStrengthText');
  
  if (strengthFill) {
    strengthFill.className = 'setpwd-strength-fill' + (strength ? ' ' + strength : '');
  }
  
  if (strengthText) {
    strengthText.className = 'setpwd-strength-text' + (strength ? ' ' + strength : '');
    strengthText.textContent = getStrengthLabel(strength);
  }
}

/**
 * 更新密码匹配 UI
 */
function updateMatchUI(showIndicator: boolean, isMatch: boolean): void {
  const matchIcon = document.getElementById('setpwdPasswordMatchIcon');
  const matchText = document.getElementById('setpwdPasswordMatchText');
  const confirmInput = document.getElementById('setpwdConfirm');
  
  if (matchIcon) {
    matchIcon.classList.toggle('hidden', !showIndicator);
    const successIcon = matchIcon.querySelector('.match-success');
    const errorIcon = matchIcon.querySelector('.match-error');
    
    if (showIndicator) {
      successIcon?.classList.toggle('hidden', !isMatch);
      errorIcon?.classList.toggle('hidden', isMatch);
    }
  }
  
  if (matchText) {
    if (showIndicator) {
      matchText.classList.remove('hidden');
      matchText.className = 'setpwd-match-text ' + (isMatch ? 'match' : 'mismatch');
      matchText.textContent = isMatch 
        ? (t('setpwd.passwordMatch') || '密码一致')
        : (t('setpwd.passwordMismatchHint') || '密码不一致');
    } else {
      matchText.classList.add('hidden');
      matchText.className = 'setpwd-match-text';
      matchText.textContent = '';
    }
  }
  
  if (confirmInput) {
    confirmInput.classList.toggle('match', showIndicator && isMatch);
    confirmInput.classList.toggle('mismatch', showIndicator && !isMatch);
  }
}

/**
 * 更新密码可见性 UI
 */
function updateVisibilityUI(visible: boolean): void {
  const toggleBtn = document.getElementById('setpwdToggle');
  const passwordInput = document.getElementById('setpwdPassword') as HTMLInputElement | null;
  const confirmInput = document.getElementById('setpwdConfirm') as HTMLInputElement | null;
  
  if (toggleBtn) {
    const eyeOpen = toggleBtn.querySelector('.eye-open');
    const eyeClosed = toggleBtn.querySelector('.eye-closed');
    eyeOpen?.classList.toggle('hidden', !visible);
    eyeClosed?.classList.toggle('hidden', visible);
  }
  
  if (passwordInput) {
    passwordInput.type = visible ? 'text' : 'password';
  }
  if (confirmInput) {
    confirmInput.type = visible ? 'text' : 'password';
  }
}

// ============================================================================
// Pending Account Data
// ============================================================================

/**
 * 获取待处理的账户数据
 */
export function getPendingAccountData(): PendingAccountData | null {
  return (window as unknown as { __pendingAccountData?: PendingAccountData }).__pendingAccountData || null;
}

/**
 * 清除待处理的账户数据
 */
export function clearPendingAccountData(): void {
  (window as unknown as { __pendingAccountData?: PendingAccountData }).__pendingAccountData = undefined;
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * 处理密码输入
 */
function handlePasswordInput(): void {
  if (!pageState) return;
  
  const passwordInput = document.getElementById('setpwdPassword') as HTMLInputElement | null;
  const confirmInput = document.getElementById('setpwdConfirm') as HTMLInputElement | null;
  
  const password = passwordInput?.value || '';
  const confirm = confirmInput?.value || '';
  
  const strength = password.length > 0 ? getPasswordStrength(password) : '';
  const showMatch = confirm.length > 0;
  const isMatch = password === confirm;
  
  pageState.set({
    passwordStrength: strength,
    showMatchIndicator: showMatch,
    passwordsMatch: isMatch
  });
  
  updateStrengthUI(strength);
  updateMatchUI(showMatch, isMatch);
}

/**
 * 处理确认密码输入
 */
function handleConfirmPasswordInput(): void {
  handlePasswordInput();
}

/**
 * 处理密码可见性切换
 */
function handleVisibilityToggle(): void {
  if (!pageState) return;
  
  const newVisible = !pageState.getValue('passwordVisible');
  pageState.set({ passwordVisible: newVisible });
  updateVisibilityUI(newVisible);
}

/**
 * 处理返回按钮
 */
function handleBackClick(): void {
  if (typeof window.PanguPay?.router?.routeTo === 'function') {
    window.PanguPay.router.routeTo('#/new');
  }
}

/**
 * 验证密码输入
 */
function validatePasswords(): { valid: boolean; password: string; error?: string } {
  const passwordInput = document.getElementById('setpwdPassword') as HTMLInputElement | null;
  const confirmInput = document.getElementById('setpwdConfirm') as HTMLInputElement | null;
  
  const password = passwordInput?.value?.trim() || '';
  const confirm = confirmInput?.value?.trim() || '';
  
  if (!password) {
    return { valid: false, password: '', error: t('setpwd.passwordRequired') || '请输入密码' };
  }
  
  if (password.length < 6) {
    return { valid: false, password: '', error: t('setpwd.passwordTooShort') || '密码至少需要6位' };
  }
  
  if (password !== confirm) {
    return { valid: false, password: '', error: t('setpwd.passwordMismatch') || '两次输入的密码不一致' };
  }
  
  return { valid: true, password };
}

/**
 * 处理表单提交
 */
async function handleSubmit(): Promise<void> {
  if (!pageState) {
    pageState = createReactiveState(initialState, stateBindings);
  }
  
  if (pageState.getValue('isSubmitting')) return;
  
  const data = getPendingAccountData();
  if (!data) {
    showErrorToast(t('setpwd.noAccountData') || '账户数据丢失，请重新创建', t('common.error') || '错误');
    if (typeof window.PanguPay?.router?.routeTo === 'function') {
      window.PanguPay.router.routeTo('#/new');
    }
    return;
  }
  
  const validation = validatePasswords();
  if (!validation.valid) {
    showErrorToast(validation.error || '', t('setpwd.passwordError') || '密码错误');
    return;
  }
  
  pageState.set({ isSubmitting: true });
  
  const btn = document.getElementById('setpwdSubmitBtn') as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = true;
    const span = btn.querySelector('span');
    if (span) span.textContent = t('common.processing') || '处理中...';
  }
  
  try {
    // 使用密码加密私钥
    const encryptedData = await encryptPrivateKey(data.privHex, validation.password);
    saveEncryptedKey(data.accountId, encryptedData);
    
    // 清除旧账户数据
    const oldUser = loadUser();
    if (!oldUser || oldUser.accountId !== data.accountId) {
      if (typeof window.PanguPay?.storage?.clearAccountStorage === 'function') {
        window.PanguPay.storage.clearAccountStorage();
      }
    }
    
    // 保存用户（不保存明文私钥）
    saveUser({ 
      accountId: data.accountId, 
      address: data.address, 
      pubXHex: data.pubXHex, 
      pubYHex: data.pubYHex, 
      flowOrigin: 'new'
    });
    
    // 更新 header
    const user = loadUser();
    updateHeaderUser(user);
    
    // 清除待处理数据
    clearPendingAccountData();
    
    // 显示成功
    showSuccessToast(t('toast.account.created'), t('toast.account.createTitle'));
    
    // 导航到入口页面
    const ov = document.getElementById('actionOverlay');
    const ovt = document.getElementById('actionOverlayText');
    if (ovt) ovt.textContent = t('modal.enteringWalletPage') || '正在进入钱包管理页面...';
    if (ov) ov.classList.remove('hidden');
    
    (window as unknown as { __skipExitConfirm?: boolean }).__skipExitConfirm = true;
    
    setTimeout(() => {
      if (ov) ov.classList.add('hidden');
      if (typeof window.PanguPay?.router?.routeTo === 'function') {
        window.PanguPay.router.routeTo('#/entry');
      }
    }, 800);
    
  } catch (err) {
    showErrorToast((t('setpwd.createFailed') || '创建失败') + ': ' + (err as Error).message, t('common.error') || '错误');
    console.error(err);
    
    if (btn) {
      btn.disabled = false;
      const span = btn.querySelector('span');
      if (span) span.textContent = t('setpwd.submit') || '确认并进入钱包管理';
    }
  } finally {
    pageState?.set({ isSubmitting: false });
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * 重置页面状态
 */
function resetPageState(): void {
  pageState?.reset();
  
  const passwordInput = document.getElementById('setpwdPassword') as HTMLInputElement | null;
  const confirmInput = document.getElementById('setpwdConfirm') as HTMLInputElement | null;
  const btn = document.getElementById('setpwdSubmitBtn') as HTMLButtonElement | null;
  
  if (passwordInput) {
    passwordInput.value = '';
    passwordInput.type = 'password';
  }
  if (confirmInput) {
    confirmInput.value = '';
    confirmInput.type = 'password';
    confirmInput.classList.remove('match', 'mismatch');
  }
  
  // 重置强度和匹配 UI
  updateStrengthUI('');
  updateMatchUI(false, false);
  updateVisibilityUI(false);
  
  if (btn) {
    btn.disabled = false;
    const span = btn.querySelector('span');
    if (span) span.textContent = t('setpwd.submit') || '确认并进入钱包管理';
  }
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
  cleanupEvents();
  
  // 密码输入
  const passwordInput = document.getElementById('setpwdPassword');
  addEvent(passwordInput, 'input', handlePasswordInput);
  
  // 确认密码输入
  const confirmInput = document.getElementById('setpwdConfirm');
  addEvent(confirmInput, 'input', handleConfirmPasswordInput);
  
  // 密码可见性切换
  const toggleBtn = document.getElementById('setpwdToggle');
  addEvent(toggleBtn, 'click', handleVisibilityToggle);
  
  // 提交按钮
  const submitBtn = document.getElementById('setpwdSubmitBtn');
  if (submitBtn) {
    (submitBtn as HTMLButtonElement).disabled = false;
    submitBtn.classList.remove('is-loading');
    addEvent(submitBtn, 'click', handleSubmit);
  }
  
  // 返回按钮
  const backBtn = document.getElementById('setpwdBackBtn');
  addEvent(backBtn, 'click', handleBackClick);
}

/**
 * 初始化设置密码页面
 */
export function initSetPasswordPage(): void {
  // 清理旧的事件绑定
  cleanupEvents();
  
  // 销毁旧实例
  pageState?.destroy();
  
  // 创建新的响应式状态
  pageState = createReactiveState(initialState, stateBindings);
  
  // 重置页面状态
  resetPageState();
  
  // 检查是否有待处理的账户数据
  const data = getPendingAccountData();
  if (!data) {
    if (typeof window.PanguPay?.router?.routeTo === 'function') {
      window.PanguPay.router.routeTo('#/new');
    }
    return;
  }
  
  // 绑定事件
  bindEvents();
  
  // 聚焦密码输入框
  setTimeout(() => {
    const passwordInput = document.getElementById('setpwdPassword') as HTMLInputElement | null;
    passwordInput?.focus();
  }, 300);
}
