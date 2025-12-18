/**
 * Profile UI Module (Reactive Version)
 * 
 * 使用响应式绑定系统重构的个人资料页面。
 * 特性：
 * - 声明式 UI 绑定，状态变化自动同步 DOM
 * - 头像上传/移除
 * - 昵称和签名编辑
 * - 语言/主题/性能模式选择器
 * 
 * @module ui/profile
 */

import { t, getCurrentLanguage, setLanguage, updateLanguageSelectorUI, updatePageTranslations } from '../i18n/index.js';
import { loadUser, loadUserProfile, saveUserProfile } from '../utils/storage';
import { showSuccessToast, showErrorToast, showWarningToast } from '../utils/toast.js';
import { getCurrentTheme, setTheme, updateThemeSelectorUI } from './theme.js';
import {
  createReactiveState,
  type ReactiveState
} from '../utils/reactive';
import { DOM_IDS, idSelector } from '../config/domIds';

// ============================================================================
// Types
// ============================================================================

/**
 * 个人资料页面状态
 */
interface ProfilePageState {
  // 登录状态
  isLoggedIn: boolean;
  
  // 用户信息
  nickname: string;
  signature: string;
  accountId: string;
  
  // 头像
  avatarUrl: string;
  hasAvatar: boolean;
  
  // 字符计数
  nicknameCharCount: string;
  signatureCharCount: string;
  
  // 保存状态
  isSaving: boolean;
}

// ============================================================================
// State & Bindings
// ============================================================================

/**
 * 初始状态
 */
const initialState: ProfilePageState = {
  isLoggedIn: false,
  nickname: '',
  signature: '',
  accountId: '',
  avatarUrl: '',
  hasAvatar: false,
  nicknameCharCount: '0/20',
  signatureCharCount: '0/50',
  isSaving: false
};

/**
 * 状态到 DOM 的绑定配置
 */
const stateBindings = {
  nickname: [
    { selector: idSelector(DOM_IDS.profileDisplayName), type: 'text' as const }
  ],
  accountId: [
    { selector: idSelector(DOM_IDS.profileAccountId), type: 'text' as const }
  ],
  nicknameCharCount: [
    { selector: idSelector(DOM_IDS.nicknameCharCount), type: 'text' as const }
  ],
  signatureCharCount: [
    { selector: idSelector(DOM_IDS.signatureCharCount), type: 'text' as const }
  ],
  isSaving: [
    { selector: idSelector(DOM_IDS.profileSaveBtn), type: 'prop' as const, name: 'disabled' }
  ]
};

// 页面状态实例
let pageState: ReactiveState<ProfilePageState> | null = null;

// 事件清理函数数组
let eventCleanups: (() => void)[] = [];

// ============================================================================
// Avatar Utilities
// ============================================================================

/**
 * 压缩图片
 */
function compressImage(
  dataUrl: string, 
  maxWidth: number, 
  maxHeight: number, 
  quality: number, 
  callback: (compressedUrl: string) => void
): void {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    let width = img.width;
    let height = img.height;
    
    // 计算缩放比例
    if (width > height) {
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
    } else {
      if (height > maxHeight) {
        width = Math.round((width * maxHeight) / height);
        height = maxHeight;
      }
    }
    
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0, width, height);
      callback(canvas.toDataURL('image/jpeg', quality));
    }
  };
  img.src = dataUrl;
}

/**
 * 更新头像预览
 */
function updateAvatarPreview(avatarUrl: string | null, isLoggedIn: boolean): void {
  // 右侧小预览
  const avatarPreviewImg = document.getElementById(DOM_IDS.avatarPreviewImg) as HTMLImageElement | null;
  const avatarUploadPreview = document.getElementById(DOM_IDS.avatarUploadPreview);
  
  // 左侧大预览
  const profileAvatarPreview = document.getElementById(DOM_IDS.profileAvatarPreview) as HTMLImageElement | null;
  const profileAvatarLarge = document.getElementById(DOM_IDS.profileAvatarLarge);
  
  if (isLoggedIn && avatarUrl) {
    // 显示头像
    if (avatarPreviewImg && avatarUploadPreview) {
      avatarPreviewImg.src = avatarUrl;
      avatarPreviewImg.classList.remove('hidden');
      const placeholder = avatarUploadPreview.querySelector('.preview-placeholder');
      if (placeholder) placeholder.classList.add('hidden');
    }
    if (profileAvatarPreview && profileAvatarLarge) {
      profileAvatarPreview.src = avatarUrl;
      profileAvatarPreview.classList.remove('hidden');
      const placeholder = profileAvatarLarge.querySelector('.avatar-placeholder');
      if (placeholder) placeholder.classList.add('hidden');
    }
  } else {
    // 隐藏头像，显示占位符
    if (avatarPreviewImg && avatarUploadPreview) {
      avatarPreviewImg.src = '';
      avatarPreviewImg.classList.add('hidden');
      const placeholder = avatarUploadPreview.querySelector('.preview-placeholder');
      if (placeholder) placeholder.classList.remove('hidden');
    }
    if (profileAvatarPreview && profileAvatarLarge) {
      profileAvatarPreview.src = '';
      profileAvatarPreview.classList.add('hidden');
      const placeholder = profileAvatarLarge.querySelector('.avatar-placeholder');
      if (placeholder) placeholder.classList.remove('hidden');
    }
  }
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * 处理昵称输入
 */
function handleNicknameInput(): void {
  if (!pageState) return;
  
  const nicknameInput = document.getElementById(DOM_IDS.nicknameInput) as HTMLInputElement | null;
  const nickname = nicknameInput?.value || '';
  
  pageState.set({
    nickname: nickname || 'Amiya',
    nicknameCharCount: `${nickname.length}/20`
  });
}

/**
 * 处理签名输入
 */
function handleSignatureInput(): void {
  if (!pageState) return;
  
  const signatureInput = document.getElementById(DOM_IDS.signatureInput) as HTMLInputElement | null;
  const signature = signatureInput?.value || '';
  
  pageState.set({
    signatureCharCount: `${signature.length}/50`
  });
}

/**
 * 处理头像文件选择
 */
function handleAvatarFileSelect(e: Event): void {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  
  // 验证文件类型
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    showErrorToast(t('toast.avatar.formatError') || '不支持的图片格式');
    return;
  }
  
  // 验证文件大小 (最大 5MB)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    showErrorToast(t('toast.avatar.sizeError', { size: (file.size / 1024 / 1024).toFixed(2) }) || '图片太大');
    return;
  }
  
  // 读取并预览
  const reader = new FileReader();
  reader.onload = (event) => {
    const dataUrl = event.target?.result as string;
    
    // 压缩图片
    compressImage(dataUrl, 200, 200, 0.8, (compressedUrl) => {
      // 更新预览
      updateAvatarPreview(compressedUrl, true);
      
      // 临时存储到页面数据
      const avatarFileInput = document.getElementById(DOM_IDS.avatarFileInput) as HTMLInputElement | null;
      if (avatarFileInput) {
        avatarFileInput.dataset.pendingAvatar = compressedUrl;
        avatarFileInput.dataset.removeAvatar = '';
      }
      
      if (pageState) {
        pageState.set({ avatarUrl: compressedUrl, hasAvatar: true });
      }
    });
  };
  reader.readAsDataURL(file);
}

/**
 * 处理头像上传按钮点击
 */
function handleAvatarUploadClick(): void {
  const user = loadUser();
  if (!user || !user.accountId) {
    showWarningToast(t('profile.loginRequired') || '请先登录', t('common.warning') || '警告');
    return;
  }
  
  const avatarFileInput = document.getElementById(DOM_IDS.avatarFileInput) as HTMLInputElement | null;
  avatarFileInput?.click();
}

/**
 * 处理头像移除
 */
function handleAvatarRemove(): void {
  const user = loadUser();
  if (!user || !user.accountId) {
    showWarningToast(t('profile.loginRequired') || '请先登录', t('common.warning') || '警告');
    return;
  }
  
  // 清除预览
  updateAvatarPreview(null, true);
  
  // 标记移除
  const avatarFileInput = document.getElementById(DOM_IDS.avatarFileInput) as HTMLInputElement | null;
  if (avatarFileInput) {
    avatarFileInput.value = '';
    avatarFileInput.dataset.pendingAvatar = '';
    avatarFileInput.dataset.removeAvatar = '1';
  }
  
  if (pageState) {
    pageState.set({ avatarUrl: '', hasAvatar: false });
  }
}

/**
 * 处理返回按钮
 */
function handleBackClick(): void {
  window.history.back();
}

/**
 * 处理保存
 */
function handleProfileSave(): void {
  if (!pageState) return;
  
  const nicknameInput = document.getElementById(DOM_IDS.nicknameInput) as HTMLInputElement | null;
  const signatureInput = document.getElementById(DOM_IDS.signatureInput) as HTMLInputElement | null;
  const avatarFileInput = document.getElementById(DOM_IDS.avatarFileInput) as HTMLInputElement | null;
  const profileSaveBtn = document.getElementById(DOM_IDS.profileSaveBtn);
  
  const nickname = nicknameInput?.value?.trim() || 'Amiya';
  const signature = signatureInput?.value?.trim() || t('profile.signature.placeholder') || '';
  const pendingAvatar = avatarFileInput?.dataset.pendingAvatar || null;
  const removeAvatar = avatarFileInput?.dataset.removeAvatar === '1';
  
  // 验证昵称
  if (nickname.length === 0) {
    showErrorToast(t('validation.nickname.empty') || '昵称不能为空');
    return;
  }
  if (nickname.length > 20) {
    showErrorToast(t('validation.nickname.tooLong') || '昵称不能超过20个字符');
    return;
  }
  
  // 验证签名
  if (signature.length > 50) {
    showErrorToast(t('validation.signature.tooLong') || '签名不能超过50个字符');
    return;
  }
  
  // 获取当前资料
  const profile = loadUserProfile();
  
  // 更新昵称
  profile.nickname = nickname;
  
  // 更新签名
  profile.signature = signature;
  
  // 更新头像
  if (removeAvatar) {
    profile.avatar = null;
  } else if (pendingAvatar) {
    profile.avatar = pendingAvatar;
  }
  
  // 保存
  saveUserProfile(profile);
  
  // 清除临时数据
  if (avatarFileInput) {
    avatarFileInput.dataset.pendingAvatar = '';
    avatarFileInput.dataset.removeAvatar = '';
  }
  
  // 更新所有显示
  updateProfileDisplay();
  
  // 显示保存成功动画
  if (profileSaveBtn) {
    const originalNodes = Array.from(profileSaveBtn.childNodes).map(n => n.cloneNode(true));
    profileSaveBtn.classList.add('profile-action-btn--success');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('points', '20 6 9 17 4 12');
    svg.appendChild(polyline);

    const text = document.createTextNode(` ${t('profile.action.saved') || '已保存'}`);
    profileSaveBtn.replaceChildren(svg, text);
    
    setTimeout(() => {
      profileSaveBtn.classList.remove('profile-action-btn--success');
      profileSaveBtn.replaceChildren(...originalNodes);
    }, 1500);
  }
  
  showSuccessToast(t('toast.profile.saved') || '保存成功', t('toast.profile.saveTitle') || '个人资料');
}

/**
 * 处理语言选择
 */
function handleLanguageSelect(lang: string): void {
  if (lang && lang !== getCurrentLanguage()) {
    setLanguage(lang);
    showSuccessToast(t('toast.language.changed') || '语言已切换', t('common.success') || '成功');
  }
}

/**
 * 处理主题选择
 */
function handleThemeSelect(theme: string): void {
  if (theme && theme !== getCurrentTheme()) {
    setTheme(theme);
  }
}

/**
 * 处理性能模式选择
 */
function handlePerformanceSelect(mode: string): void {
  const performanceModeManager = (window as unknown as { performanceModeManager?: { getMode: () => string; setMode: (m: string) => void } }).performanceModeManager;
  if (mode && performanceModeManager) {
    const currentMode = performanceModeManager.getMode();
    if (mode !== currentMode) {
      performanceModeManager.setMode(mode);
      updatePerformanceSelectorUI();
      const modeText = mode === 'premium' 
        ? (t('profile.performance.premium') || '高性能') 
        : (t('profile.performance.energySaving') || '省电');
      showSuccessToast(t('toast.performance.changed', { mode: modeText }) || `已切换到${modeText}模式`, t('common.success') || '成功');
    }
  }
}

// ============================================================================
// UI Update Functions
// ============================================================================

/**
 * 更新性能模式选择器 UI
 */
export function updatePerformanceSelectorUI(): void {
  const performanceModeManager = (window as unknown as { performanceModeManager?: { getMode: () => string } }).performanceModeManager;
  if (!performanceModeManager) return;
  
  const currentMode = performanceModeManager.getMode();
  const options = document.querySelectorAll('.performance-option');
  
  options.forEach(opt => {
    const mode = opt.getAttribute('data-mode');
    if (mode === currentMode) {
      opt.classList.add('active');
    } else {
      opt.classList.remove('active');
    }
  });
}

/**
 * 更新页面访问权限
 */
export function updateProfilePageAccess(): void {
  const user = loadUser();
  const isLoggedIn = !!(user && user.accountId);
  
  const avatarUploadBtn = document.getElementById(DOM_IDS.avatarUploadBtn) as HTMLButtonElement | null;
  const avatarRemoveBtn = document.getElementById(DOM_IDS.avatarRemoveBtn) as HTMLButtonElement | null;
  const nicknameInput = document.getElementById(DOM_IDS.nicknameInput) as HTMLInputElement | null;
  const signatureInput = document.getElementById(DOM_IDS.signatureInput) as HTMLInputElement | null;
  const profileSaveBtn = document.getElementById(DOM_IDS.profileSaveBtn) as HTMLButtonElement | null;
  const profileAccountId = document.getElementById(DOM_IDS.profileAccountId);
  
  const settingGroups = document.querySelectorAll('.profile-setting-group');
  const avatarSettingGroup = settingGroups[0] as HTMLElement | undefined;
  const nicknameSettingGroup = settingGroups[1] as HTMLElement | undefined;
  const signatureSettingGroup = settingGroups[2] as HTMLElement | undefined;
  
  if (!isLoggedIn) {
    if (avatarUploadBtn) avatarUploadBtn.disabled = true;
    if (avatarRemoveBtn) avatarRemoveBtn.disabled = true;
    if (nicknameInput) {
      nicknameInput.disabled = true;
      nicknameInput.value = t('common.notLoggedIn') || '未登录';
    }
    if (signatureInput) {
      signatureInput.disabled = true;
      signatureInput.value = t('header.loginHint') || '请先登录';
    }
    if (profileSaveBtn) profileSaveBtn.disabled = true;
    if (profileAccountId) profileAccountId.textContent = t('common.notLoggedIn') || '未登录';
    
    if (avatarSettingGroup) avatarSettingGroup.style.opacity = '0.5';
    if (nicknameSettingGroup) nicknameSettingGroup.style.opacity = '0.5';
    if (signatureSettingGroup) signatureSettingGroup.style.opacity = '0.5';
  } else {
    if (avatarUploadBtn) avatarUploadBtn.disabled = false;
    if (avatarRemoveBtn) avatarRemoveBtn.disabled = false;
    if (nicknameInput) nicknameInput.disabled = false;
    if (signatureInput) signatureInput.disabled = false;
    if (profileSaveBtn) profileSaveBtn.disabled = false;
    
    if (avatarSettingGroup) avatarSettingGroup.style.opacity = '1';
    if (nicknameSettingGroup) nicknameSettingGroup.style.opacity = '1';
    if (signatureSettingGroup) signatureSettingGroup.style.opacity = '1';
  }
}

/**
 * 更新所有资料显示
 */
export function updateProfileDisplay(): void {
  const profile = loadUserProfile();
  const nickname = profile.nickname || 'Amiya';
  const avatar = profile.avatar;
  const signature = profile.signature || t('profile.signature.placeholder') || '';
  
  // 更新顶部导航栏
  const userLabel = document.getElementById(DOM_IDS.userLabel);
  if (userLabel) {
    const u = loadUser();
    if (u && u.accountId) {
      userLabel.textContent = nickname;
    }
  }
  
  // 更新菜单头部标题
  const menuHeaderTitle = document.getElementById(DOM_IDS.menuHeaderTitle);
  if (menuHeaderTitle) {
    menuHeaderTitle.textContent = nickname;
  }
  
  // 更新菜单头部签名
  const menuHeaderSub = document.getElementById(DOM_IDS.menuHeaderSub);
  if (menuHeaderSub) {
    menuHeaderSub.textContent = signature;
  }
  
  // 更新所有头像
  const userAvatar = document.getElementById(DOM_IDS.userAvatar);
  const menuHeaderAvatar = document.getElementById(DOM_IDS.menuHeaderAvatar);
  const avatarTargets = [
    { container: userAvatar, img: (userAvatar?.querySelector('.avatar-img') as HTMLImageElement | null) },
    { container: menuHeaderAvatar, img: (menuHeaderAvatar?.querySelector('.avatar-img') as HTMLImageElement | null) }
  ];
  
  const u = loadUser();
  const isLoggedIn = !!(u && u.accountId);
  
  avatarTargets.forEach(({ container, img }) => {
    if (!container || !img) return;
    
    if (isLoggedIn) {
      container.classList.add('avatar--active');
      img.src = avatar || '/assets/avatar.png';
      img.classList.remove('hidden');
    } else {
      container.classList.remove('avatar--active');
      img.classList.add('hidden');
    }
  });
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
  
  // 返回按钮
  const profileBackBtn = document.getElementById(DOM_IDS.profileBackBtn);
  addEvent(profileBackBtn, 'click', handleBackClick);
  
  // 取消按钮
  const profileCancelBtn = document.getElementById(DOM_IDS.profileCancelBtn);
  addEvent(profileCancelBtn, 'click', handleBackClick);
  
  // 昵称输入
  const nicknameInput = document.getElementById(DOM_IDS.nicknameInput);
  addEvent(nicknameInput, 'input', handleNicknameInput);
  
  // 签名输入
  const signatureInput = document.getElementById(DOM_IDS.signatureInput);
  addEvent(signatureInput, 'input', handleSignatureInput);
  
  // 头像上传按钮
  const avatarUploadBtn = document.getElementById(DOM_IDS.avatarUploadBtn);
  addEvent(avatarUploadBtn, 'click', handleAvatarUploadClick);
  
  // 头像文件选择
  const avatarFileInput = document.getElementById(DOM_IDS.avatarFileInput);
  addEvent(avatarFileInput, 'change', handleAvatarFileSelect);
  
  // 移除头像按钮
  const avatarRemoveBtn = document.getElementById(DOM_IDS.avatarRemoveBtn);
  addEvent(avatarRemoveBtn, 'click', handleAvatarRemove);
  
  // 保存按钮
  const profileSaveBtn = document.getElementById(DOM_IDS.profileSaveBtn);
  if (profileSaveBtn) {
    (profileSaveBtn as HTMLButtonElement).disabled = false;
  }
  addEvent(profileSaveBtn, 'click', handleProfileSave);
  
  // 语言选择器
  const languageSelector = document.getElementById(DOM_IDS.languageSelector);
  if (languageSelector) {
    const options = languageSelector.querySelectorAll('.language-option');
    options.forEach(opt => {
      addEvent(opt as HTMLElement, 'click', () => {
        const lang = opt.getAttribute('data-lang');
        if (lang) handleLanguageSelect(lang);
      });
    });
  }
  
  // 主题选择器
  const themeSelector = document.getElementById(DOM_IDS.themeSelector);
  if (themeSelector) {
    const options = themeSelector.querySelectorAll('.theme-option');
    options.forEach(opt => {
      addEvent(opt as HTMLElement, 'click', () => {
        const theme = opt.getAttribute('data-theme');
        if (theme) handleThemeSelect(theme);
      });
    });
  }
  
  // 性能模式选择器
  const performanceSelector = document.getElementById(DOM_IDS.performanceSelector);
  if (performanceSelector) {
    const options = performanceSelector.querySelectorAll('.performance-option');
    options.forEach(opt => {
      addEvent(opt as HTMLElement, 'click', () => {
        const mode = opt.getAttribute('data-mode');
        if (mode) handlePerformanceSelect(mode);
      });
    });
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * 初始化个人资料页面
 */
export function initProfilePage(): void {
  // 清理旧的事件绑定
  cleanupEvents();
  
  // 销毁旧实例
  pageState?.destroy();
  
  // 加载数据
  const profile = loadUserProfile();
  const user = loadUser();
  const isLoggedIn = !!(user && user.accountId);
  
  // 创建新的响应式状态
  pageState = createReactiveState({
    ...initialState,
    isLoggedIn,
    nickname: isLoggedIn ? (profile.nickname || 'Amiya') : (t('common.notLoggedIn') || '未登录'),
    signature: isLoggedIn ? (profile.signature || t('profile.signature.placeholder') || '') : (t('header.loginHint') || '请先登录'),
    accountId: isLoggedIn ? (user?.accountId || '') : (t('common.notLoggedIn') || '未登录'),
    avatarUrl: isLoggedIn ? (profile.avatar || '/avatar.png') : '',
    hasAvatar: isLoggedIn && !!profile.avatar,
    nicknameCharCount: `${(isLoggedIn ? (profile.nickname || 'Amiya') : '').length}/20`,
    signatureCharCount: `${(isLoggedIn ? (profile.signature || '') : '').length}/50`
  }, stateBindings);
  
  // 填充表单
  const nicknameInput = document.getElementById(DOM_IDS.nicknameInput) as HTMLInputElement | null;
  const signatureInput = document.getElementById(DOM_IDS.signatureInput) as HTMLInputElement | null;
  
  if (nicknameInput) {
    nicknameInput.value = isLoggedIn ? (profile.nickname || 'Amiya') : (t('common.notLoggedIn') || '未登录');
  }
  if (signatureInput) {
    signatureInput.value = isLoggedIn ? (profile.signature || t('profile.signature.placeholder') || '') : (t('header.loginHint') || '请先登录');
  }
  
  // 更新头像预览
  updateAvatarPreview(isLoggedIn ? (profile.avatar || '/avatar.png') : null, isLoggedIn);
  
  // 更新 header 显示
  setTimeout(() => {
    import('./header').then(({ updateHeaderUser }) => {
      const currentUser = loadUser();
      updateHeaderUser(currentUser);
    });
  }, 50);
  
  // 绑定事件
  bindEvents();
  
  // 初始化选择器 UI
  requestAnimationFrame(() => {
    updateLanguageSelectorUI();
    updateThemeSelectorUI();
    updatePerformanceSelectorUI();
    updatePageTranslations();
  });
  
  // 更新访问权限
  updateProfilePageAccess();
}

// 导出兼容函数
export { compressImage, handleAvatarFileSelect, handleAvatarRemove };
export { bindEvents as bindProfileEvents };
export { handleNicknameInput as updateCharCount };
export { handleSignatureInput as updateSignatureCharCount };
