/**
 * Screen Lock Module
 * 
 * Provides automatic screen locking after inactivity period.
 * Users must enter their password to unlock and access the wallet.
 * 
 * Features:
 * - Auto-lock after 10 minutes of inactivity
 * - Smooth lock/unlock animations
 * - Password verification against encrypted key
 * - Activity tracking (mouse, keyboard, touch, scroll)
 */

import { verifyPassword, hasEncryptedKey } from './keyEncryption';
import { loadUser } from './storage';
import { t } from '../i18n/index.js';

// ========================================
// Types
// ========================================

interface ScreenLockConfig {
  /** Inactivity timeout in milliseconds (default: 10 minutes) */
  timeout: number;
  /** Whether to show lock screen on app start if user is logged in */
  lockOnStart: boolean;
  /** Callback when screen is locked */
  onLock?: () => void;
  /** Callback when screen is unlocked */
  onUnlock?: () => void;
}

interface ScreenLockState {
  isLocked: boolean;
  lastActivity: number;
  timerId: number | null;
  config: ScreenLockConfig;
}

// ========================================
// Constants
// ========================================

const DEFAULT_TIMEOUT = 10 * 60 * 1000; // 10 minutes
/**
 * Activity listeners used to reset the idle timer.
 * Only mouse activity (mousedown, mousemove, click) is monitored.
 */
const ACTIVITY_LISTENERS: Array<{
  target: Document | Window;
  event: string;
  options?: AddEventListenerOptions | boolean;
}> = [
  { target: window, event: 'mousedown', options: { passive: true } },
  { target: window, event: 'mousemove', options: { passive: true } },
  { target: window, event: 'click', options: { passive: true } },
  { target: window, event: 'keydown', options: { passive: true } },
  { target: window, event: 'touchstart', options: { passive: true } },
  { target: window, event: 'wheel', options: { passive: true } }
];
const LOCK_SCREEN_ID = 'screenLockOverlay';
const STORAGE_KEY = 'screenLockState';
let isVerifying = false;

// ========================================
// State
// ========================================

const state: ScreenLockState = {
  isLocked: false,
  lastActivity: Date.now(),
  timerId: null,
  config: {
    timeout: DEFAULT_TIMEOUT,
    lockOnStart: false
  }
};

// ========================================
// DOM Creation
// ========================================

/**
 * Create the lock screen overlay element
 */
function createLockScreenElement(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.id = LOCK_SCREEN_ID;
  overlay.className = 'screen-lock-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'lockScreenTitle');

  const doc = new DOMParser().parseFromString(`
    <div class="screen-lock-backdrop"></div>
    <div class="screen-lock-container">
      <div class="screen-lock-card">
        <!-- Logo and branding -->
        <div class="screen-lock-header">
          <div class="screen-lock-logo">
            <img src="/assets/logo.png" alt="PanguPay" class="screen-lock-logo-img" />
            <div class="screen-lock-logo-glow"></div>
          </div>
          <h2 id="lockScreenTitle" class="screen-lock-title" data-i18n="lock.title">钱包已锁定</h2>
          <p class="screen-lock-subtitle" data-i18n="lock.subtitle">请输入密码以解锁</p>
        </div>
        
        <!-- Password input -->
        <div class="screen-lock-form">
          <div class="screen-lock-input-group">
            <div class="screen-lock-input-wrapper">
              <svg class="screen-lock-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input 
                type="password" 
                id="screenLockPassword" 
                class="screen-lock-input" 
                placeholder="输入密码..."
                data-i18n-placeholder="lock.enterPassword"
                autocomplete="current-password"
              />
              <button type="button" class="screen-lock-toggle-visibility" id="screenLockToggleVisibility">
                <svg class="eye-open hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <svg class="eye-closed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              </button>
            </div>
            <div class="screen-lock-error hidden" id="screenLockError">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span data-i18n="lock.wrongPassword">密码错误，请重试</span>
            </div>
          </div>
          
          <button type="button" id="screenLockUnlockBtn" class="screen-lock-unlock-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 9.9-1" />
            </svg>
            <span data-i18n="lock.unlock">解锁</span>
          </button>
        </div>
        
        <!-- Footer info -->
        <div class="screen-lock-footer">
          <div class="screen-lock-user-info">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span id="screenLockAccountId" class="screen-lock-account-id"></span>
          </div>
          <button type="button" id="screenLockLogoutBtn" class="screen-lock-logout-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span data-i18n="lock.switchAccount">切换账户</span>
          </button>
        </div>
      </div>
    </div>

  `, 'text/html');
  overlay.replaceChildren(...Array.from(doc.body.childNodes));
  
  return overlay;
}

/**
 * Get or create the lock screen element
 */
function getLockScreenElement(): HTMLElement {
  let overlay = document.getElementById(LOCK_SCREEN_ID);
  if (!overlay) {
    overlay = createLockScreenElement();
    document.body.appendChild(overlay);
    bindLockScreenEvents(overlay);
  }
  return overlay;
}

// ========================================
// Event Handlers
// ========================================

/**
 * Bind events to lock screen elements
 */
function bindLockScreenEvents(overlay: HTMLElement): void {
  const passwordInput = overlay.querySelector('#screenLockPassword') as HTMLInputElement;
  const unlockBtn = overlay.querySelector('#screenLockUnlockBtn') as HTMLButtonElement;
  const toggleBtn = overlay.querySelector('#screenLockToggleVisibility') as HTMLButtonElement;
  const logoutBtn = overlay.querySelector('#screenLockLogoutBtn') as HTMLButtonElement;
  
  // Unlock button click
  unlockBtn?.addEventListener('click', handleUnlockAttempt);
  
  // Enter key to unlock
  passwordInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleUnlockAttempt();
    }
  });
  
  // Toggle password visibility
  toggleBtn?.addEventListener('click', () => {
    if (passwordInput) {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      
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
  
  // Logout button - switch account
  logoutBtn?.addEventListener('click', () => {
    // Import clearAccountStorage from storage module
    import('./storage').then(({ clearAccountStorage }) => {
      // Clear all user data properly
      clearAccountStorage();
      
      // Clear screen lock state
      localStorage.removeItem(STORAGE_KEY);
      
      // Update header to show logged out state
      if (typeof window.PanguPay?.ui?.updateHeaderUser === 'function') {
        window.PanguPay.ui.updateHeaderUser(null);
      }
      
      // Unlock screen
      unlockScreen();
      
      // Redirect to welcome page
      if (typeof window.PanguPay?.router?.routeTo === 'function') {
        window.PanguPay.router.routeTo('#/welcome');
      }
    }).catch((error) => {
      console.error('Failed to import storage module:', error);
      // Fallback: clear basic data
      localStorage.removeItem('user');
      localStorage.removeItem(STORAGE_KEY);
      unlockScreen();
      if (typeof window.PanguPay?.router?.routeTo === 'function') {
        window.PanguPay.router.routeTo('#/welcome');
      }
    });
  });
}

/**
 * Handle unlock attempt
 */
async function handleUnlockAttempt(): Promise<void> {
  if (isVerifying) return;

  const overlay = document.getElementById(LOCK_SCREEN_ID);
  const passwordInput = overlay?.querySelector('#screenLockPassword') as HTMLInputElement;
  const errorEl = overlay?.querySelector('#screenLockError') as HTMLElement;
  const unlockBtn = overlay?.querySelector('#screenLockUnlockBtn') as HTMLButtonElement;
  
  const password = passwordInput?.value?.trim();
  
  if (!password) {
    showLockError(errorEl, t('lock.enterPassword', '请输入密码'));
    passwordInput?.focus();
    return;
  }
  
  // Disable button during verification
  if (unlockBtn) {
    unlockBtn.disabled = true;
    unlockBtn.classList.add('loading');
  }
  isVerifying = true;
  
  try {
    const user = loadUser();
    if (!user?.accountId) {
      throw new Error('No user found');
    }
    
    const isValid = await verifyPassword(user.accountId, password);
    
    if (isValid) {
      // Success - unlock screen
      hideLockError(errorEl);
      unlockScreen();
      
      state.config.onUnlock?.();
    } else {
      // Wrong password
      showLockError(errorEl, t('lock.wrongPassword', '密码错误，请重试'));
      passwordInput?.focus();
      passwordInput?.select();
      
      // Shake animation
      overlay?.querySelector('.screen-lock-card')?.classList.add('shake');
      setTimeout(() => {
        overlay?.querySelector('.screen-lock-card')?.classList.remove('shake');
      }, 500);
    }
  } catch (error) {
    showLockError(errorEl, t('lock.verifyFailed', '验证失败，请重试'));
    console.error('Unlock verification failed:', error);
  } finally {
    isVerifying = false;
    if (unlockBtn) {
      unlockBtn.disabled = false;
      unlockBtn.classList.remove('loading');
    }
  }
}

/**
 * Show error message
 */
function showLockError(errorEl: HTMLElement | null, message: string): void {
  if (errorEl) {
    const span = errorEl.querySelector('span');
    if (span) span.textContent = message;
    errorEl.classList.remove('hidden');
    errorEl.classList.add('visible');
  }
}

/**
 * Hide error message
 */
function hideLockError(errorEl: HTMLElement | null): void {
  if (errorEl) {
    errorEl.classList.add('hidden');
    errorEl.classList.remove('visible');
  }
}

// ========================================
// Activity Tracking
// ========================================

/**
 * Reset activity timer
 */
function resetActivityTimer(): void {
  state.lastActivity = Date.now();
  
  // Clear existing timer
  if (state.timerId !== null) {
    clearTimeout(state.timerId);
  }
  
  // Set new timer
  state.timerId = window.setTimeout(() => {
    checkAndLock();
  }, state.config.timeout);
}

/**
 * Handle user activity
 */
function handleActivity(): void {
  if (!state.isLocked) {
    resetActivityTimer();
  }
}

/**
 * Check if should lock and lock if needed
 */
function checkAndLock(): void {
  const user = loadUser();
  
  // Only lock if user is logged in and has encrypted key
  if (user?.accountId && hasEncryptedKey(user.accountId)) {
    lockScreen();
  }
}

// ========================================
// Lock/Unlock Functions
// ========================================

/**
 * Lock the screen
 */
export function lockScreen(): void {
  if (state.isLocked) return;
  
  const user = loadUser();
  if (!user?.accountId || !hasEncryptedKey(user.accountId)) {
    // No encrypted key, can't lock
    return;
  }

  // Stop any pending idle timer while locked.
  if (state.timerId !== null) {
    clearTimeout(state.timerId);
    state.timerId = null;
  }
  
  state.isLocked = true;
  
  const overlay = getLockScreenElement();
  
  // Update account ID display
  const accountIdEl = overlay.querySelector('#screenLockAccountId');
  if (accountIdEl) {
    accountIdEl.textContent = user.accountId;
  }
  
  // Clear password input
  const passwordInput = overlay.querySelector('#screenLockPassword') as HTMLInputElement;
  if (passwordInput) {
    passwordInput.value = '';
    passwordInput.type = 'password';
  }
  
  // Reset visibility toggle
  const eyeOpen = overlay.querySelector('.eye-open');
  const eyeClosed = overlay.querySelector('.eye-closed');
  eyeOpen?.classList.add('hidden');
  eyeClosed?.classList.remove('hidden');
  
  // Hide error
  const errorEl = overlay.querySelector('#screenLockError') as HTMLElement;
  hideLockError(errorEl);
  
  // Show overlay with animation
  overlay.classList.add('visible');
  document.body.classList.add('screen-locked');
  
  // Focus password input after animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      passwordInput?.focus({ preventScroll: true });
    });
  });
  
  // Update translations
  if (typeof window.PanguPay?.i18n?.updatePageTranslations === 'function') {
    window.PanguPay.i18n.updatePageTranslations();
  }
  
  state.config.onLock?.();
}

/**
 * Unlock the screen
 */
export function unlockScreen(): void {
  if (!state.isLocked) return;
  
  state.isLocked = false;
  
  const overlay = document.getElementById(LOCK_SCREEN_ID);
  if (overlay) {
    overlay.classList.remove('visible');
    overlay.classList.add('unlocking');
    
    setTimeout(() => {
      overlay.classList.remove('unlocking');
    }, 300);
  }
  
  document.body.classList.remove('screen-locked');
  
  // Restart activity timer
  resetActivityTimer();
}

/**
 * Check if screen is locked
 */
export function isScreenLocked(): boolean {
  return state.isLocked;
}

// ========================================
// Initialization
// ========================================

/**
 * Initialize screen lock module
 */
export function initScreenLock(config?: Partial<ScreenLockConfig>): void {
  // Merge config - always use default 10 minutes timeout and disable lock-on-start
  if (config) {
    state.config = { ...state.config, ...config };
  }
  
  // Force timeout to 10 minutes (not configurable) and disable lock on page load
  state.config.timeout = DEFAULT_TIMEOUT;
  state.config.lockOnStart = false;
  
  // Clear any stale persisted lock state to avoid unexpected auto-lock after refresh
  localStorage.removeItem(STORAGE_KEY);

  // Add activity listeners
  ACTIVITY_LISTENERS.forEach(({ target, event, options }) => {
    target.addEventListener(event, handleActivity, options as any);
  });
  
  const user = loadUser();

  // Start idle timer only when user is logged in and we are not locked yet
  if (user?.accountId && hasEncryptedKey(user.accountId) && !state.isLocked) {
    resetActivityTimer();
  }
}

/**
 * Cleanup screen lock module
 */
export function cleanupScreenLock(): void {
  // Remove activity listeners
  ACTIVITY_LISTENERS.forEach(({ target, event, options }) => {
    target.removeEventListener(event, handleActivity, options as any);
  });
  
  // Clear timer
  if (state.timerId !== null) {
    clearTimeout(state.timerId);
    state.timerId = null;
  }
  
  // Remove overlay
  const overlay = document.getElementById(LOCK_SCREEN_ID);
  if (overlay) {
    overlay.remove();
  }
  
  document.body.classList.remove('screen-locked');
}

// Export for window access
export default {
  initScreenLock,
  cleanupScreenLock,
  lockScreen,
  unlockScreen,
  isScreenLocked
};
