/**
 * Profile UI Module
 * 
 * Provides profile page functionality including avatar, nickname, and signature management.
 */

import { t, getCurrentLanguage, setLanguage, updateLanguageSelectorUI, updatePageTranslations } from '../i18n/index.js';
import { loadUser, loadUserProfile, saveUserProfile } from '../utils/storage';
import { showSuccessToast, showErrorToast, showWarningToast } from '../utils/toast.js';
import { getCurrentTheme, setTheme, updateThemeSelectorUI } from './theme.js';

/**
 * Initialize profile page
 */
export function initProfilePage() {
  const profile = loadUserProfile();
  const user = loadUser();
  const isLoggedIn = !!(user && user.accountId);
  
  // Update header display first to show correct username
  if (typeof window.updateHeaderUser === 'function') {
    window.updateHeaderUser(user);
  }
  
  // Fill current data
  const nicknameInput = document.getElementById('nicknameInput');
  const profileDisplayName = document.getElementById('profileDisplayName');
  const profileAccountId = document.getElementById('profileAccountId');
  const avatarPreviewImg = document.getElementById('avatarPreviewImg');
  const avatarUploadPreview = document.getElementById('avatarUploadPreview');
  const profileAvatarPreview = document.getElementById('profileAvatarPreview');
  const profileAvatarLarge = document.getElementById('profileAvatarLarge');
  
  // Set nickname - show "Not Logged In" when not logged in
  if (nicknameInput) {
    nicknameInput.value = isLoggedIn ? (profile.nickname || 'Amiya') : t('common.notLoggedIn');
    updateCharCount();
  }
  
  // Set signature - show login hint when not logged in
  const signatureInput = document.getElementById('signatureInput');
  if (signatureInput) {
    signatureInput.value = isLoggedIn ? (profile.signature || t('profile.signature.placeholder')) : t('header.loginHint');
    updateSignatureCharCount();
  }
  
  // Set display name - show "Not Logged In" when not logged in
  if (profileDisplayName) {
    profileDisplayName.textContent = isLoggedIn ? (profile.nickname || 'Amiya') : t('common.notLoggedIn');
  }
  
  // Set Account ID - show "Not Logged In" when not logged in
  if (profileAccountId) {
    profileAccountId.textContent = isLoggedIn ? (user.accountId || 'Account ID') : t('common.notLoggedIn');
  }
  
  // Set avatar preview - show person icon when not logged in
  if (isLoggedIn) {
    // Logged in: show custom avatar or default avatar
    const avatarSrc = profile.avatar || '/assets/avatar.png';
    if (avatarPreviewImg) {
      avatarPreviewImg.src = avatarSrc;
      avatarPreviewImg.classList.remove('hidden');
      const placeholder = avatarUploadPreview?.querySelector('.preview-placeholder');
      if (placeholder) placeholder.classList.add('hidden');
    }
    if (profileAvatarPreview) {
      profileAvatarPreview.src = avatarSrc;
      profileAvatarPreview.classList.remove('hidden');
      const placeholder = profileAvatarLarge?.querySelector('.avatar-placeholder');
      if (placeholder) placeholder.classList.add('hidden');
    }
  } else {
    // Not logged in: show person icon, hide image
    if (avatarPreviewImg) {
      avatarPreviewImg.src = '';
      avatarPreviewImg.classList.add('hidden');
      const placeholder = avatarUploadPreview?.querySelector('.preview-placeholder');
      if (placeholder) placeholder.classList.remove('hidden');
    }
    if (profileAvatarPreview) {
      profileAvatarPreview.src = '';
      profileAvatarPreview.classList.add('hidden');
      const placeholder = profileAvatarLarge?.querySelector('.avatar-placeholder');
      if (placeholder) placeholder.classList.remove('hidden');
    }
  }
  
  // Bind events (only once) - check if already bound to avoid performance issues
  if (!window._profileEventsBound) {
    bindProfileEvents();
    window._profileEventsBound = true;
  }

  // Initialize language/theme/performance selectors after first paint to avoid blocking UI
  requestAnimationFrame(() => {
    updateLanguageSelectorUI();
    updateThemeSelectorUI();
    updatePerformanceSelectorUI();
    updatePageTranslations();
  });

  // Control functionality based on login status
  updateProfilePageAccess();
}

/**
 * Control profile page access based on login status
 */
export function updateProfilePageAccess() {
  const user = loadUser();
  const isLoggedIn = !!(user && user.accountId);
  
  // Get elements to control
  const avatarUploadBtn = document.getElementById('avatarUploadBtn');
  const avatarRemoveBtn = document.getElementById('avatarRemoveBtn');
  const nicknameInput = document.getElementById('nicknameInput');
  const signatureInput = document.getElementById('signatureInput');
  const profileSaveBtn = document.getElementById('profileSaveBtn');
  const profileAccountId = document.getElementById('profileAccountId');
  
  // Setting groups
  const settingGroups = document.querySelectorAll('.profile-setting-group');
  const avatarSettingGroup = settingGroups[0];
  const nicknameSettingGroup = settingGroups[1];
  const signatureSettingGroup = settingGroups[2];
  
  if (!isLoggedIn) {
    // Not logged in: disable avatar, nickname, signature editing
    if (avatarUploadBtn) avatarUploadBtn.disabled = true;
    if (avatarRemoveBtn) avatarRemoveBtn.disabled = true;
    if (nicknameInput) {
      nicknameInput.disabled = true;
      nicknameInput.value = t('common.notLoggedIn');
    }
    if (signatureInput) {
      signatureInput.disabled = true;
      signatureInput.value = t('header.loginHint');
    }
    if (profileSaveBtn) profileSaveBtn.disabled = true;
    if (profileAccountId) profileAccountId.textContent = t('common.notLoggedIn');
    
    // Add disabled style
    if (avatarSettingGroup) avatarSettingGroup.style.opacity = '0.5';
    if (nicknameSettingGroup) nicknameSettingGroup.style.opacity = '0.5';
    if (signatureSettingGroup) signatureSettingGroup.style.opacity = '0.5';
  } else {
    // Logged in: enable all functionality
    if (avatarUploadBtn) avatarUploadBtn.disabled = false;
    if (avatarRemoveBtn) avatarRemoveBtn.disabled = false;
    if (nicknameInput) nicknameInput.disabled = false;
    if (signatureInput) signatureInput.disabled = false;
    if (profileSaveBtn) profileSaveBtn.disabled = false;
    
    // Remove disabled style
    if (avatarSettingGroup) avatarSettingGroup.style.opacity = '1';
    if (nicknameSettingGroup) nicknameSettingGroup.style.opacity = '1';
    if (signatureSettingGroup) signatureSettingGroup.style.opacity = '1';
  }
}

/**
 * Update nickname character count
 */
export function updateCharCount() {
  const nicknameInput = document.getElementById('nicknameInput');
  const nicknameCharCount = document.getElementById('nicknameCharCount');
  if (nicknameInput && nicknameCharCount) {
    const len = nicknameInput.value.length;
    nicknameCharCount.textContent = `${len}/20`;
  }
}

/**
 * Update signature character count
 */
export function updateSignatureCharCount() {
  const signatureInput = document.getElementById('signatureInput');
  const signatureCharCount = document.getElementById('signatureCharCount');
  if (signatureInput && signatureCharCount) {
    const len = signatureInput.value.length;
    signatureCharCount.textContent = `${len}/50`;
  }
}

/**
 * Bind profile page events
 */
export function bindProfileEvents() {
  // Back button
  const profileBackBtn = document.getElementById('profileBackBtn');
  if (profileBackBtn && !profileBackBtn.dataset._bind) {
    profileBackBtn.addEventListener('click', () => {
      window.history.back();
    });
    profileBackBtn.dataset._bind = '1';
  }
  
  // Cancel button
  const profileCancelBtn = document.getElementById('profileCancelBtn');
  if (profileCancelBtn && !profileCancelBtn.dataset._bind) {
    profileCancelBtn.addEventListener('click', () => {
      window.history.back();
    });
    profileCancelBtn.dataset._bind = '1';
  }
  
  // Nickname input
  const nicknameInput = document.getElementById('nicknameInput');
  if (nicknameInput && !nicknameInput.dataset._bind) {
    nicknameInput.addEventListener('input', () => {
      updateCharCount();
      // Real-time update left preview
      const profileDisplayName = document.getElementById('profileDisplayName');
      if (profileDisplayName) {
        profileDisplayName.textContent = nicknameInput.value || 'Amiya';
      }
    });
    nicknameInput.dataset._bind = '1';
  }
  
  // Signature input
  const signatureInput = document.getElementById('signatureInput');
  if (signatureInput && !signatureInput.dataset._bind) {
    signatureInput.addEventListener('input', () => {
      updateSignatureCharCount();
    });
    signatureInput.dataset._bind = '1';
  }
  
  // Avatar upload button
  const avatarUploadBtn = document.getElementById('avatarUploadBtn');
  const avatarFileInput = document.getElementById('avatarFileInput');
  if (avatarUploadBtn && avatarFileInput && !avatarUploadBtn.dataset._bind) {
    avatarUploadBtn.addEventListener('click', () => {
      const user = loadUser();
      if (!user || !user.accountId) {
        showWarningToast(t('profile.loginRequired'), t('common.warning'));
        return;
      }
      avatarFileInput.click();
    });
    avatarUploadBtn.dataset._bind = '1';
  }
  
  // Avatar file selection
  if (avatarFileInput && !avatarFileInput.dataset._bind) {
    avatarFileInput.addEventListener('change', handleAvatarFileSelect);
    avatarFileInput.dataset._bind = '1';
  }
  
  // Remove avatar button
  const avatarRemoveBtn = document.getElementById('avatarRemoveBtn');
  if (avatarRemoveBtn && !avatarRemoveBtn.dataset._bind) {
    avatarRemoveBtn.addEventListener('click', () => {
      const user = loadUser();
      if (!user || !user.accountId) {
        showWarningToast(t('profile.loginRequired'), t('common.warning'));
        return;
      }
      handleAvatarRemove();
    });
    avatarRemoveBtn.dataset._bind = '1';
  }
  
  // Save button
  const profileSaveBtn = document.getElementById('profileSaveBtn');
  if (profileSaveBtn && !profileSaveBtn.dataset._bind) {
    profileSaveBtn.addEventListener('click', handleProfileSave);
    profileSaveBtn.dataset._bind = '1';
  }
  
  // Language selector
  const languageSelector = document.getElementById('languageSelector');
  if (languageSelector && !languageSelector.dataset._bind) {
    const options = languageSelector.querySelectorAll('.language-option');
    options.forEach(opt => {
      opt.addEventListener('click', () => {
        const lang = opt.getAttribute('data-lang');
        if (lang && lang !== getCurrentLanguage()) {
          setLanguage(lang);
          showSuccessToast(t('toast.language.changed'), t('common.success'));
        }
      });
    });
    languageSelector.dataset._bind = '1';
  }
  
  // Theme selector
  const themeSelector = document.getElementById('themeSelector');
  if (themeSelector && !themeSelector.dataset._bind) {
    const options = themeSelector.querySelectorAll('.theme-option');
    options.forEach(opt => {
      opt.addEventListener('click', () => {
        const theme = opt.getAttribute('data-theme');
        if (theme && theme !== getCurrentTheme()) {
          setTheme(theme);
        }
      });
    });
    themeSelector.dataset._bind = '1';
  }
  
  // Performance mode selector
  const performanceSelector = document.getElementById('performanceSelector');
  if (performanceSelector && !performanceSelector.dataset._bind) {
    const options = performanceSelector.querySelectorAll('.performance-option');
    options.forEach(opt => {
      opt.addEventListener('click', () => {
        const mode = opt.getAttribute('data-mode');
        if (mode && window.performanceModeManager) {
          const currentMode = window.performanceModeManager.getMode();
          if (mode !== currentMode) {
            window.performanceModeManager.setMode(mode);
            updatePerformanceSelectorUI();
            // Show toast notification
            const modeText = mode === 'premium' ? t('profile.performance.premium') : t('profile.performance.energySaving');
            showSuccessToast(t('toast.performance.changed', { mode: modeText }), t('common.success'));
          }
        }
      });
    });
    performanceSelector.dataset._bind = '1';
  }
  

  // Update language selector UI state
  updateLanguageSelectorUI();
  
  // Update theme selector UI state
  updateThemeSelectorUI();
  
  // Update performance selector UI state
  updatePerformanceSelectorUI();
  
  // Update page translations
  updatePageTranslations();
}

/**
 * Update performance mode selector UI state
 */
export function updatePerformanceSelectorUI() {
  if (!window.performanceModeManager) return;
  
  const currentMode = window.performanceModeManager.getMode();
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
 * Handle avatar file selection
 * @param {Event} e - File input change event
 */
export function handleAvatarFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  // Validate file type
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    showErrorToast(t('toast.avatar.formatError'));
    return;
  }
  
  // Validate file size (max 5MB, will be compressed)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    showErrorToast(t('toast.avatar.sizeError', { size: (file.size / 1024 / 1024).toFixed(2) }));
    return;
  }
  
  // Read and preview
  const reader = new FileReader();
  reader.onload = (event) => {
    const dataUrl = event.target.result;
    
    // Compress image
    compressImage(dataUrl, 200, 200, 0.8, (compressedUrl) => {
      // Update preview
      updateAvatarPreview(compressedUrl);
      
      // Temporarily store to page data
      const avatarFileInput = document.getElementById('avatarFileInput');
      if (avatarFileInput) {
        avatarFileInput.dataset.pendingAvatar = compressedUrl;
      }
    });
  };
  reader.readAsDataURL(file);
}

/**
 * Compress image
 * @param {string} dataUrl - Image data URL
 * @param {number} maxWidth - Maximum width
 * @param {number} maxHeight - Maximum height
 * @param {number} quality - JPEG quality (0-1)
 * @param {Function} callback - Callback with compressed data URL
 */
export function compressImage(dataUrl, maxWidth, maxHeight, quality, callback) {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    let width = img.width;
    let height = img.height;
    
    // Calculate scale ratio
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
    ctx.drawImage(img, 0, 0, width, height);
    
    callback(canvas.toDataURL('image/jpeg', quality));
  };
  img.src = dataUrl;
}

/**
 * Update avatar preview
 * @param {string} avatarUrl - Avatar URL or data URL
 */
export function updateAvatarPreview(avatarUrl) {
  // Update right side small preview
  const avatarPreviewImg = document.getElementById('avatarPreviewImg');
  const avatarUploadPreview = document.getElementById('avatarUploadPreview');
  if (avatarPreviewImg && avatarUploadPreview) {
    avatarPreviewImg.src = avatarUrl;
    avatarPreviewImg.classList.remove('hidden');
    const placeholder = avatarUploadPreview.querySelector('.preview-placeholder');
    if (placeholder) placeholder.classList.add('hidden');
  }
  
  // Update left side large preview
  const profileAvatarPreview = document.getElementById('profileAvatarPreview');
  const profileAvatarLarge = document.getElementById('profileAvatarLarge');
  if (profileAvatarPreview && profileAvatarLarge) {
    profileAvatarPreview.src = avatarUrl;
    profileAvatarPreview.classList.remove('hidden');
    const placeholder = profileAvatarLarge.querySelector('.avatar-placeholder');
    if (placeholder) placeholder.classList.add('hidden');
  }
}

/**
 * Handle avatar removal
 */
export function handleAvatarRemove() {
  // Clear preview
  const avatarPreviewImg = document.getElementById('avatarPreviewImg');
  const avatarUploadPreview = document.getElementById('avatarUploadPreview');
  if (avatarPreviewImg && avatarUploadPreview) {
    avatarPreviewImg.src = '';
    avatarPreviewImg.classList.add('hidden');
    const placeholder = avatarUploadPreview.querySelector('.preview-placeholder');
    if (placeholder) placeholder.classList.remove('hidden');
  }
  
  // Clear left preview
  const profileAvatarPreview = document.getElementById('profileAvatarPreview');
  const profileAvatarLarge = document.getElementById('profileAvatarLarge');
  if (profileAvatarPreview && profileAvatarLarge) {
    profileAvatarPreview.src = '';
    profileAvatarPreview.classList.add('hidden');
    const placeholder = profileAvatarLarge.querySelector('.avatar-placeholder');
    if (placeholder) placeholder.classList.remove('hidden');
  }
  
  // Clear pending avatar
  const avatarFileInput = document.getElementById('avatarFileInput');
  if (avatarFileInput) {
    avatarFileInput.value = '';
    avatarFileInput.dataset.pendingAvatar = '';
    avatarFileInput.dataset.removeAvatar = '1';
  }
}

/**
 * Handle profile save
 */
export function handleProfileSave() {
  const nicknameInput = document.getElementById('nicknameInput');
  const signatureInput = document.getElementById('signatureInput');
  const avatarFileInput = document.getElementById('avatarFileInput');
  const profileSaveBtn = document.getElementById('profileSaveBtn');
  
  const nickname = nicknameInput?.value?.trim() || 'Amiya';
  const signature = signatureInput?.value?.trim() || t('profile.signature.placeholder');
  const pendingAvatar = avatarFileInput?.dataset.pendingAvatar || null;
  const removeAvatar = avatarFileInput?.dataset.removeAvatar === '1';
  
  // Validate nickname
  if (nickname.length === 0) {
    showErrorToast(t('validation.nickname.empty'));
    return;
  }
  if (nickname.length > 20) {
    showErrorToast(t('validation.nickname.tooLong'));
    return;
  }
  
  // Validate signature
  if (signature.length > 50) {
    showErrorToast(t('validation.signature.tooLong'));
    return;
  }
  
  // Get current profile
  const profile = loadUserProfile();
  
  // Update nickname
  profile.nickname = nickname;
  
  // Update signature
  profile.signature = signature;
  
  // Update avatar
  if (removeAvatar) {
    profile.avatar = null;
  } else if (pendingAvatar) {
    profile.avatar = pendingAvatar;
  }
  
  // Save
  saveUserProfile(profile);
  
  // Clear temporary data
  if (avatarFileInput) {
    avatarFileInput.dataset.pendingAvatar = '';
    avatarFileInput.dataset.removeAvatar = '';
  }
  
  // Update all displays immediately
  updateProfileDisplay();
  
  // Show save success animation
  if (profileSaveBtn) {
    const originalHtml = profileSaveBtn.innerHTML;
    profileSaveBtn.classList.add('profile-action-btn--success');
    profileSaveBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      ${t('profile.action.saved')}
    `;
    
    setTimeout(() => {
      profileSaveBtn.classList.remove('profile-action-btn--success');
      profileSaveBtn.innerHTML = originalHtml;
    }, 1500);
  }
  
  showSuccessToast(t('toast.profile.saved'), t('toast.profile.saveTitle'));
}

/**
 * Update all profile displays on the page
 */
export function updateProfileDisplay() {
  const profile = loadUserProfile();
  const nickname = profile.nickname || 'Amiya';
  const avatar = profile.avatar;
  const signature = profile.signature || t('profile.signature.placeholder');
  
  // Update top navigation bar
  const userLabel = document.getElementById('userLabel');
  if (userLabel) {
    const u = loadUser();
    if (u && u.accountId) {
      userLabel.textContent = nickname;
    }
  }
  
  // Update menu header title
  const menuHeaderTitle = document.getElementById('menuHeaderTitle');
  if (menuHeaderTitle) {
    menuHeaderTitle.textContent = nickname;
  }
  
  // Update menu header signature
  const menuHeaderSub = document.getElementById('menuHeaderSub');
  if (menuHeaderSub) {
    menuHeaderSub.textContent = signature;
  }
  
  // Update all avatars
  const avatarTargets = [
    { container: document.getElementById('userAvatar'), img: document.querySelector('#userAvatar .avatar-img') },
    { container: document.getElementById('menuHeaderAvatar'), img: document.querySelector('#menuHeaderAvatar .avatar-img') }
  ];
  
  const u = loadUser();
  const isLoggedIn = !!(u && u.accountId);
  
  avatarTargets.forEach(({ container, img }) => {
    if (!container || !img) return;
    
    if (isLoggedIn) {
      container.classList.add('avatar--active');
      if (avatar) {
        img.src = avatar;
      } else {
        img.src = '/assets/avatar.png';
      }
      img.classList.remove('hidden');
    } else {
      container.classList.remove('avatar--active');
      img.classList.add('hidden');
    }
  });
}
