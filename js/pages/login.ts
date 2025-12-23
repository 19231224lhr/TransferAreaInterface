/**
 * Login Page Module (Reactive Version)
 * 
 * 使用响应式绑定系统重构的登录页面。
 * 特性：
 * - 声明式 UI 绑定，状态变化自动同步 DOM
 * - 密码强度指示器
 * - 密码确认匹配验证
 * - 私钥加密存储
 * 
 * @module pages/login
 */

// loadUser is accessed via window.loadUser
import { updateHeaderUser } from '../ui/header.js';
import { encryptPrivateKey, saveEncryptedKey } from '../utils/keyEncryption';
import { t } from '../i18n/index.js';
import { showLoading, hideLoading, showElementLoading, hideElementLoading } from '../utils/loading';
import { addInlineValidation, quickValidate } from '../utils/formValidator';
import { DOM_IDS } from '../config/domIds';
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
 * 密码强度等级
 */
type PasswordStrength = '' | 'weak' | 'medium' | 'strong';

/**
 * 登录页面状态
 */
interface LoginPageState {
  // UI 状态
  isLoading: boolean;
  showForm: boolean;
  showLoader: boolean;
  showResult: boolean;
  showButtons: boolean;
  
  // 密码可见性
  privKeyVisible: boolean;
  passwordVisible: boolean;
  
  // 密码强度
  passwordStrength: PasswordStrength;
  
  // 密码匹配
  showMatchIndicator: boolean;
  passwordsMatch: boolean;
  
  // 私钥折叠状态
  privKeyCollapsed: boolean;
  
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
const initialState: LoginPageState = {
  isLoading: false,
  showForm: true,
  showLoader: false,
  showResult: false,
  showButtons: false,
  privKeyVisible: false,
  passwordVisible: false,
  passwordStrength: '',
  showMatchIndicator: false,
  passwordsMatch: false,
  privKeyCollapsed: true,
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
    { selector: '#loginLoader', type: 'visible' as const }
  ],
  showResult: [
    { selector: '#loginResult', type: 'visible' as const }
  ],
  showButtons: [
    { selector: '#loginNextBtn', type: 'visible' as const },
    { selector: '#loginCancelBtn', type: 'visible' as const }
  ],
  privKeyCollapsed: [
    { selector: '#loginPrivContainer', type: 'class' as const, name: 'collapsed' }
  ],
  accountId: [
    { selector: '#loginAccountId', type: 'text' as const }
  ],
  address: [
    { selector: '#loginAddress', type: 'text' as const }
  ],
  privHex: [
    { selector: '#loginPrivOut', type: 'text' as const }
  ],
  pubX: [
    { selector: '#loginPubX', type: 'text' as const }
  ],
  pubY: [
    { selector: '#loginPubY', type: 'text' as const }
  ]
};

// 页面状态实例
let pageState: ReactiveState<LoginPageState> | null = null;

// ============================================================================
// Password Strength
// ============================================================================

/**
 * 计算密码强度
 */
function getPasswordStrength(password: string): PasswordStrength {
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
 * 获取密码强度标签
 */
function getStrengthLabel(strength: PasswordStrength): string {
  const labels: Record<PasswordStrength, string> = {
    '': '',
    weak: t('login.strengthWeak', '弱'),
    medium: t('login.strengthMedium', '中'),
    strong: t('login.strengthStrong', '强')
  };
  return labels[strength];
}

/**
 * 更新密码强度 UI (这部分需要特殊处理，因为涉及多个 class)
 */
function updateStrengthUI(strength: PasswordStrength): void {
  const strengthFill = document.getElementById(DOM_IDS.loginStrengthFill);
  const strengthText = document.getElementById(DOM_IDS.loginStrengthText);
  
  if (strengthFill) {
    strengthFill.className = 'login-strength-fill' + (strength ? ' ' + strength : '');
  }
  
  if (strengthText) {
    strengthText.className = 'login-strength-text' + (strength ? ' ' + strength : '');
    strengthText.textContent = getStrengthLabel(strength);
  }
}

/**
 * 更新密码匹配 UI
 */
function updateMatchUI(showIndicator: boolean, isMatch: boolean): void {
  const matchIcon = document.getElementById(DOM_IDS.loginPasswordMatchIcon);
  const matchText = document.getElementById(DOM_IDS.loginPasswordMatchText);
  const confirmInput = document.getElementById(DOM_IDS.loginConfirmPassword);
  
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
      matchText.className = 'login-match-text ' + (isMatch ? 'match' : 'mismatch');
      matchText.textContent = isMatch 
        ? t('login.passwordMatch', '密码一致') 
        : t('login.passwordMismatch', '密码不一致');
    } else {
      matchText.className = 'login-match-text';
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
function updateVisibilityUI(
  toggleSelector: string,
  inputSelectors: string[],
  visible: boolean
): void {
  const toggle = document.querySelector(toggleSelector);
  if (toggle) {
    const eyeOpen = toggle.querySelector('.eye-open');
    const eyeClosed = toggle.querySelector('.eye-closed');
    eyeOpen?.classList.toggle('hidden', !visible);
    eyeClosed?.classList.toggle('hidden', visible);
  }
  
  inputSelectors.forEach(selector => {
    const input = document.querySelector(selector) as HTMLInputElement | null;
    if (input) {
      input.type = visible ? 'text' : 'password';
    }
  });
}

// ============================================================================
// Animation Sequences
// ============================================================================

/**
 * 表单折叠动画
 */
async function animateFormCollapse(): Promise<void> {
  await runParallelAnimations([
    {
      selector: '.login-form-card',
      phases: [
        { addClass: 'collapsing', duration: 250 },
        { removeClass: 'collapsing', addClass: 'collapsed', duration: 0 }
      ]
    },
    {
      selector: '.login-tip-block',
      phases: [
        { addClass: 'collapsing', duration: 250 },
        { removeClass: 'collapsing', addClass: 'collapsed', duration: 0 }
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
      selector: '.login-form-card',
      phases: [
        { removeClass: ['collapsing', 'collapsed'], addClass: 'expanding', duration: 350 },
        { removeClass: 'expanding', duration: 0 }
      ]
    },
    {
      selector: '.login-tip-block',
      phases: [
        { removeClass: ['collapsing', 'collapsed'], addClass: 'expanding', duration: 350 },
        { removeClass: 'expanding', duration: 0 }
      ]
    }
  ]);
}

/**
 * 加载器折叠动画
 */
async function animateLoaderCollapse(): Promise<void> {
  await runAnimationSequence({
    selector: '#loginLoader',
    phases: [
      { addClass: 'collapsing', duration: 250 },
      { removeClass: 'collapsing', addClass: ['hidden', 'collapsed'], duration: 0 }
    ]
  });
}

/**
 * 结果展开动画
 */
async function animateResultReveal(): Promise<void> {
  const resultEl = document.getElementById(DOM_IDS.loginResult);
  if (resultEl) {
    resultEl.classList.remove('hidden', 'collapsed');
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
    selector: '#loginResult',
    phases: [
      { addClass: 'collapsing', duration: 250 },
      { addClass: 'hidden', removeClass: ['collapsing', 'reveal'], duration: 0 }
    ]
  });
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * 处理密码输入
 */
function handlePasswordInput(): void {
  if (!pageState) return;
  
  const passwordInput = document.getElementById(DOM_IDS.loginPassword) as HTMLInputElement | null;
  const confirmInput = document.getElementById(DOM_IDS.loginConfirmPassword) as HTMLInputElement | null;
  
  const password = passwordInput?.value || '';
  const confirm = confirmInput?.value || '';
  
  const strength = getPasswordStrength(password);
  const showMatch = confirm.length > 0;
  const isMatch = password === confirm;
  
  pageState.set({
    passwordStrength: strength,
    showMatchIndicator: showMatch,
    passwordsMatch: isMatch
  });
  
  // 更新特殊 UI (涉及多个 class 的情况)
  updateStrengthUI(strength);
  updateMatchUI(showMatch, isMatch);
}

/**
 * 处理确认密码输入
 */
function handleConfirmPasswordInput(): void {
  handlePasswordInput(); // 复用相同逻辑
}

/**
 * 处理私钥可见性切换
 */
function handlePrivKeyVisibilityToggle(): void {
  if (!pageState) return;
  
  const newVisible = !pageState.getValue('privKeyVisible');
  pageState.set({ privKeyVisible: newVisible });
  updateVisibilityUI('#loginToggleVisibility', ['#loginPrivHex'], newVisible);
}

/**
 * 处理密码可见性切换
 */
function handlePasswordVisibilityToggle(): void {
  if (!pageState) return;
  
  const newVisible = !pageState.getValue('passwordVisible');
  pageState.set({ passwordVisible: newVisible });
  updateVisibilityUI(
    '#loginPasswordToggle',
    ['#loginPassword', '#loginConfirmPassword'],
    newVisible
  );
}

/**
 * 处理返回按钮
 */
function handleBackClick(): void {
  resetLoginPageState();
  if (typeof window.PanguPay?.router?.routeTo === 'function') {
    window.PanguPay.router.routeTo('#/welcome');
  }
}

/**
 * 处理下一步按钮
 */
async function handleNextClick(): Promise<void> {
  // Import auth service dynamically to avoid circular dependencies
  const { userReOnline } = await import('../services/auth.js');
  const { loadUser, saveUser } = await import('../utils/storage.js');
  
  const user = loadUser();
  if (!user || !user.accountId) {
    window.PanguPay?.ui?.showErrorToast?.(
      t('modal.pleaseLoginFirst', '请先登录'),
      t('modal.loginFailed', '登录失败')
    );
    return;
  }
  
  // Show loading
  const loadingId = showLoading(t('login.connectingToBackend', '正在连接后端...'));
  const nextBtn = document.getElementById(DOM_IDS.loginNextBtn) as HTMLButtonElement | null;
  if (nextBtn) {
    nextBtn.disabled = true;
    showElementLoading(nextBtn, t('common.processing') || '处理中...');
  }
  
  try {
    // Get all addresses from wallet
    const addresses = user.wallet ? Object.keys(user.wallet.addressMsg || {}) : [];
    
    // If user has no addresses yet, use the primary address
    if (addresses.length === 0 && user.address) {
      addresses.push(user.address);
    }
    
    // Get private key (try encrypted first, fallback to plaintext)
    let privHex = '';
    try {
      const { getDecryptedPrivateKey } = await import('../utils/keyEncryptionUI.js');
      privHex = await getDecryptedPrivateKey(user.accountId);
    } catch (e) {
      // Fallback to legacy plaintext key
      privHex = user.privHex || '';
    }
    
    if (!privHex) {
      throw new Error(t('modal.privateKeyNotFound', '未找到私钥'));
    }
    
    // Call re-online API
    const result = await userReOnline(
      user.accountId,
      addresses,
      privHex,
      user.pubXHex,
      user.pubYHex
    );
    
    // Update user data with re-online response
    const updatedUser = {
      ...user,
      orgNumber: result.IsInGroup ? result.GuarantorGroupID : '',
      isInGroup: result.IsInGroup,
      entrySource: 'login', // 标记用户通过登录进入
      guarGroupBootMsg: result.GuarGroupBootMsg || null // 保存完整的担保组织信息
    };
    
    // Merge wallet data from backend
    if (result.UserWalletData && result.UserWalletData.SubAddressMsg) {
      // Initialize wallet if not exists
      if (!updatedUser.wallet) {
        updatedUser.wallet = {
          addressMsg: {},
          value: 0
        };
      }
      
      // Merge backend address data
      for (const [addr, addrData] of Object.entries(result.UserWalletData.SubAddressMsg)) {
        if (!updatedUser.wallet.addressMsg[addr]) {
          // 新地址：标记为外部导入且未解锁
          updatedUser.wallet.addressMsg[addr] = {
            type: (addrData as any).Type || 0,
            utxos: (addrData as any).UTXO || {},
            txCers: (addrData as any).TXCers || {},
            value: { 
              totalValue: (addrData as any).Value?.TotalValue || 0, 
              utxoValue: (addrData as any).Value?.UTXOValue || 0, 
              txCerValue: (addrData as any).Value?.TXCerValue || 0 
            },
            estInterest: (addrData as any).EstInterest || 0,
            origin: 'external', // 标记为外部导入
            locked: true, // 标记为未解锁（没有私钥）
            publicKeyNew: (addrData as any).PublicKeyNew || null // 保存公钥信息
          };
        } else {
          // 已存在的地址：合并数据但保留私钥
          Object.assign(updatedUser.wallet.addressMsg[addr], {
            type: (addrData as any).Type || updatedUser.wallet.addressMsg[addr].type,
            utxos: (addrData as any).UTXO || updatedUser.wallet.addressMsg[addr].utxos,
            txCers: (addrData as any).TXCers || updatedUser.wallet.addressMsg[addr].txCers,
            value: { 
              totalValue: (addrData as any).Value?.TotalValue || 0, 
              utxoValue: (addrData as any).Value?.UTXOValue || 0, 
              txCerValue: (addrData as any).Value?.TXCerValue || 0 
            },
            estInterest: (addrData as any).EstInterest || updatedUser.wallet.addressMsg[addr].estInterest,
            publicKeyNew: (addrData as any).PublicKeyNew || updatedUser.wallet.addressMsg[addr].publicKeyNew
          });
        }
      }
      
      // Update total value
      updatedUser.wallet.value = result.UserWalletData.Value || 0;
    }
    
    // Save updated user data
    saveUser(updatedUser);
    
    // Store group info if user is in a group
    if (result.IsInGroup && result.GuarGroupBootMsg) {
      // Store in session storage for quick access
      try {
        sessionStorage.setItem(
          `group_${result.GuarantorGroupID}`,
          JSON.stringify(result.GuarGroupBootMsg)
        );
      } catch (e) {
        console.warn('Failed to store group info:', e);
      }
    }
    
    // Show success toast
    if (result.IsInGroup) {
      window.PanguPay?.ui?.showSuccessToast?.(
        t('login.reOnlineSuccessInGroup', { gid: String(result.GuarantorGroupID) }),
        t('toast.login.success', '登录成功')
      );
    } else {
      window.PanguPay?.ui?.showInfoToast?.(
        t('login.reOnlineSuccessNoGroup', '已连接，当前为散户模式'),
        t('toast.login.success', '登录成功')
      );
    }
    
    // Navigate to entry page
    (window as unknown as Record<string, unknown>).__skipExitConfirm = true;
    if (typeof window.PanguPay?.router?.routeTo === 'function') {
      window.PanguPay.router.routeTo('#/entry');
    }
    // Entry page will initialize itself via router
    
  } catch (error) {
    console.error('Re-online failed:', error);
    window.PanguPay?.ui?.showErrorToast?.(
      (error as Error).message || t('login.reOnlineFailed', '连接后端失败'),
      t('modal.loginFailed', '登录失败')
    );
  } finally {
    hideLoading(loadingId);
    if (nextBtn) {
      nextBtn.disabled = false;
      hideElementLoading(nextBtn);
    }
  }
}

/**
 * 处理取消按钮 (重新登录)
 */
async function handleCancelClick(): Promise<void> {
  if (!pageState) return;
  
  // 隐藏结果
  await animateResultCollapse();
  
  // 展开表单
  await animateFormExpand();
  
  // 重置状态
  resetLoginPageState();
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
 * 处理登录按钮点击
 */
async function handleLoginClick(): Promise<void> {
  // 确保 pageState 存在，如果不存在则重新初始化
  if (!pageState) {
    pageState = createReactiveState(initialState, stateBindings);
  }
  
  const loginBtn = document.getElementById(DOM_IDS.loginBtn) as HTMLButtonElement | null;
  const inputEl = document.getElementById(DOM_IDS.loginPrivHex) as HTMLInputElement | null;
  const passwordEl = document.getElementById(DOM_IDS.loginPassword) as HTMLInputElement | null;
  const confirmEl = document.getElementById(DOM_IDS.loginConfirmPassword) as HTMLInputElement | null;
  
  const priv = inputEl?.value.trim() || '';
  const password = passwordEl?.value.trim() || '';
  const confirmPassword = confirmEl?.value.trim() || '';
  
  // 验证私钥
  const privError = quickValidate(priv, ['required', 'privateKey']);
  if (privError) {
    window.PanguPay?.ui?.showErrorToast?.(privError, t('modal.inputIncomplete', '输入不完整'));
    inputEl?.focus();
    return;
  }
  
  // 验证密码
  const pwdError = quickValidate(password, ['required', 'minLength'], { minLength: 6 });
  if (pwdError) {
    window.PanguPay?.ui?.showErrorToast?.(pwdError, t('modal.inputIncomplete', '输入不完整'));
    passwordEl?.focus();
    return;
  }
  
  // 验证确认密码
  if (!confirmPassword) {
    window.PanguPay?.ui?.showErrorToast?.(
      t('login.confirmPasswordRequired', '请再次输入密码'),
      t('modal.inputIncomplete', '输入不完整')
    );
    confirmEl?.focus();
    return;
  }
  
  if (password !== confirmPassword) {
    window.PanguPay?.ui?.showErrorToast?.(
      t('login.passwordMismatch', '两次输入的密码不一致'),
      t('modal.formatError', '格式错误')
    );
    confirmEl?.focus();
    return;
  }
  
  const normalized = priv.replace(/^0x/i, '');
  
  // 开始加载
  if (loginBtn) {
    loginBtn.disabled = true;
    showElementLoading(loginBtn, t('common.processing') || '处理中...');
  }
  const loadingId = showLoading(t('common.processing') || '处理中...');
  
  try {
    // 更新状态：隐藏结果和按钮
    pageState.set({
      isLoading: true,
      showResult: false,
      showButtons: false
    });
    
    // 表单折叠动画
    await animateFormCollapse();
    
    // 显示加载器
    pageState.set({ showLoader: true });
    
    const t0 = Date.now();
    
    // 导入私钥
    let data: {
      accountId: string;
      address: string;
      privHex: string;
      pubXHex: string;
      pubYHex: string;
    };
    
    if (typeof window.PanguPay?.account?.importFromPrivHex === 'function') {
      data = await window.PanguPay.account.importFromPrivHex(priv);
    } else {
      throw new Error('importFromPrivHex function not available');
    }
    
    // 加密私钥
    const encryptedData = await encryptPrivateKey(data.privHex, password);
    saveEncryptedKey(data.accountId, encryptedData);
    
    // 确保最小加载时间
    const elapsed = Date.now() - t0;
    if (elapsed < 1000) {
      await new Promise(resolve => setTimeout(resolve, 1000 - elapsed));
    }
    
    // 加载器折叠
    await animateLoaderCollapse();
    pageState.set({ showLoader: false });
    
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
    
    // 清除旧账户数据
    const oldUser = typeof window.PanguPay?.storage?.loadUser === 'function' ? window.PanguPay.storage.loadUser() : null;
    if (!oldUser || oldUser.accountId !== data.accountId) {
      if (typeof window.PanguPay?.storage?.clearAccountStorage === 'function') {
        window.PanguPay.storage.clearAccountStorage();
      }
    }
    
    // 保存用户 (不保存明文私钥)
    if (typeof window.PanguPay?.storage?.saveUser === 'function') {
      window.PanguPay.storage.saveUser({
        accountId: data.accountId,
        address: data.address,
        pubXHex: data.pubXHex,
        pubYHex: data.pubYHex,
        flowOrigin: 'login',
        _encrypted: true
      });
    }
    
    // 更新 header
    const user = typeof window.PanguPay?.storage?.loadUser === 'function' ? window.PanguPay.storage.loadUser() : null;
    updateHeaderUser(user);
    
    // 显示成功提示
    if (typeof window.PanguPay?.ui?.showSuccessToast === 'function') {
      window.PanguPay.ui.showSuccessToast(
        t('toast.login.successDesc', '登录成功'),
        t('toast.login.success', '成功')
      );
    }
    
  } catch (e) {
    // 错误处理：恢复表单状态
    const loader = document.getElementById(DOM_IDS.loginLoader);
    if (loader) {
      loader.classList.add('hidden');
      loader.classList.remove('collapsing', 'collapsed');
    }
    
    pageState.set({
      isLoading: false,
      showLoader: false
    });
    
    // 展开表单
    await animateFormExpand();
    
    if (typeof window.PanguPay?.ui?.showErrorToast === 'function') {
      window.PanguPay.ui.showErrorToast(
        (e as Error).message || t('modal.cannotRecognizeKey', '无法识别私钥'),
        t('modal.loginFailed', '登录失败')
      );
    }
    console.error(e);
    
  } finally {
    pageState?.set({ isLoading: false });
    
    if (loginBtn) {
      loginBtn.disabled = false;
      hideElementLoading(loginBtn);
    }
    hideLoading(loadingId);
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * 重置登录页面状态
 */
export function resetLoginPageState(): void {
  // 重置响应式状态
  pageState?.reset();
  
  // 重置表单输入
  const inputEl = document.getElementById(DOM_IDS.loginPrivHex) as HTMLInputElement | null;
  const passwordEl = document.getElementById(DOM_IDS.loginPassword) as HTMLInputElement | null;
  const confirmEl = document.getElementById(DOM_IDS.loginConfirmPassword) as HTMLInputElement | null;
  
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
  
  // 重置表单卡片状态
  const formCard = document.querySelector('.login-form-card');
  const tipBlock = document.querySelector('.login-tip-block');
  const resultEl = document.getElementById(DOM_IDS.loginResult);
  const loader = document.getElementById(DOM_IDS.loginLoader);
  
  formCard?.classList.remove('collapsed', 'collapsing', 'expanding');
  tipBlock?.classList.remove('collapsed', 'collapsing', 'expanding');
  resultEl?.classList.add('hidden');
  resultEl?.classList.remove('collapsing', 'expanding', 'reveal');
  loader?.classList.add('hidden');
  loader?.classList.remove('collapsed', 'collapsing');
  
  // 重置可见性 UI
  updateVisibilityUI('#loginToggleVisibility', ['#loginPrivHex'], false);
  updateVisibilityUI('#loginPasswordToggle', ['#loginPassword', '#loginConfirmPassword'], false);
  
  // 重置强度和匹配 UI
  updateStrengthUI('');
  updateMatchUI(false, false);
}

/**
 * 初始化登录页面
 */
export function initLoginPage(): void {
  // 清理旧的事件绑定
  cleanupEvents();
  
  // 销毁旧实例
  pageState?.destroy();
  
  // 创建新的响应式状态
  pageState = createReactiveState(initialState, stateBindings);
  
  // 重置页面状态
  resetLoginPageState();
  
  // 设置表单验证
  addInlineValidation('#loginPrivHex', [
    { validator: 'required', message: t('modal.pleaseEnterPrivateKeyHex', '请输入私钥') },
    { validator: 'privateKey', message: t('modal.privateKeyFormat64', '私钥格式错误，需要64位十六进制') }
  ], { showOnInput: true, debounceMs: 150 });

  addInlineValidation('#loginPassword', [
    { validator: 'required', message: t('login.passwordRequired', '请输入钱包密码') },
    { validator: 'minLength', message: t('login.passwordTooShort', '密码至少需要6位'), params: { minLength: 6 } }
  ], { showOnInput: true, debounceMs: 150 });

  addInlineValidation('#loginConfirmPassword', [
    { validator: 'required', message: t('login.confirmPasswordRequired', '请再次输入密码') },
    { validator: 'pattern' as const, message: t('login.passwordMismatch', '两次输入的密码不一致'), params: { field: 'loginPassword' } }
  ], { showOnInput: true, debounceMs: 150 });
  
  // 绑定事件
  bindEvents();
}

// 存储事件清理函数
let eventCleanups: (() => void)[] = [];

/**
 * 清理所有事件绑定
 */
function cleanupEvents(): void {
  eventCleanups.forEach(cleanup => cleanup());
  eventCleanups = [];
}

/**
 * 安全地添加事件监听器，返回清理函数
 */
function addEvent<K extends keyof HTMLElementEventMap>(
  element: HTMLElement | null,
  event: K,
  handler: (e: HTMLElementEventMap[K]) => void
): void {
  if (!element) return;
  
  // 移除可能存在的旧监听器（通过克隆节点的方式不可行，改用标记）
  // 直接添加新监听器，依赖 cleanupEvents 在 initLoginPage 开始时清理
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
  
  // 登录按钮
  const loginBtn = document.getElementById(DOM_IDS.loginBtn);
  if (loginBtn) {
    // 确保按钮可用（防止上次登录流程中断导致的状态残留）
    (loginBtn as HTMLButtonElement).disabled = false;
    loginBtn.classList.remove('is-loading');
    addEvent(loginBtn, 'click', handleLoginClick);
  }
  
  // 私钥可见性切换
  const loginToggleVisibility = document.getElementById(DOM_IDS.loginToggleVisibility);
  addEvent(loginToggleVisibility, 'click', handlePrivKeyVisibilityToggle);
  
  // 密码可见性切换
  const loginPasswordToggle = document.getElementById(DOM_IDS.loginPasswordToggle);
  addEvent(loginPasswordToggle, 'click', handlePasswordVisibilityToggle);
  
  // 密码输入 (强度指示)
  const loginPasswordInput = document.getElementById(DOM_IDS.loginPassword);
  addEvent(loginPasswordInput, 'input', handlePasswordInput);
  
  // 确认密码输入 (匹配指示)
  const loginConfirmInput = document.getElementById(DOM_IDS.loginConfirmPassword);
  addEvent(loginConfirmInput, 'input', handleConfirmPasswordInput);
  
  // 返回按钮
  const loginBackBtn = document.getElementById(DOM_IDS.loginBackBtn);
  addEvent(loginBackBtn, 'click', handleBackClick);
  
  // 下一步按钮
  const loginNextBtn = document.getElementById(DOM_IDS.loginNextBtn);
  addEvent(loginNextBtn, 'click', handleNextClick);
  
  // 取消按钮
  const loginCancelBtn = document.getElementById(DOM_IDS.loginCancelBtn);
  addEvent(loginCancelBtn, 'click', handleCancelClick);
  
  // 私钥折叠切换
  const loginPrivContainer = document.getElementById(DOM_IDS.loginPrivContainer);
  if (loginPrivContainer) {
    const labelClickable = loginPrivContainer.querySelector('.login-result-label--clickable') as HTMLElement | null;
    addEvent(labelClickable, 'click', handlePrivKeyToggle);
  }
}

// Window functions are declared in globals.d.ts
