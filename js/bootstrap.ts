/**
 * App Bootstrap (TypeScript)
 *
 * This module owns application startup and lifecycle hooks (DOMContentLoaded/unload).
 * The legacy entry file `js/app.js` stays as a thin compatibility layer for global exports.
 */

import { t, updatePageTranslations, loadLanguageSetting } from './i18n/index.js';
import { loadUser } from './utils/storage';
import { showErrorToast } from './utils/toast.js';
import { initErrorBoundary } from './utils/security';
import performanceModeManager from './utils/performanceMode.js';
import performanceMonitor from './utils/performanceMonitor.js';

import { initAccessibility, announce } from './utils/accessibility';
import { recoverPendingLocalStorageTransactions } from './utils/transaction';
import { initLazyLoader } from './utils/lazyLoader';
import { configureTransition, initAuthGuard } from './utils/enhancedRouter';

import {
  registerServiceWorker,
  isOnline,
  onOnlineStatusChange,
  onUpdateAvailable,
  skipWaiting,
  checkForUpdates
} from './utils/serviceWorker';

import { templateLoader } from './utils/templateLoader';
import { pageManager } from './utils/pageManager';
import { PAGE_TEMPLATES } from './config/pageTemplates';

import { updateHeaderUser, initUserMenu, initHeaderScroll } from './ui/header';
import { loadThemeSetting, initThemeSelector } from './ui/theme.js';
import { cleanupWalletChart } from './ui/charts.js';
import { cleanupNetworkChart } from './ui/networkChart.js';
import { initFooter, cleanupFooter } from './ui/footer.js';

import {
  initScreenLock,
  cleanupScreenLock
} from './utils/screenLock';

import { initRouter, routeTo } from './router';

// ========================================
// P2: Online/Offline Indicator Setup
// ========================================

function setupOnlineIndicator(): void {
  // Create offline indicator element
  let indicator = document.getElementById('offlineIndicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'offlineIndicator';
    indicator.className = 'offline-indicator';
    indicator.setAttribute('role', 'alert');
    indicator.setAttribute('aria-live', 'assertive');
    indicator.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.58 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01"/>
      </svg>
      <span class="offline-indicator__text">${t('offline.message', '网络已断开，部分功能不可用')}</span>
    `;
    document.body.appendChild(indicator);
  }

  const updateIndicator = (online: boolean) => {
    if (online) {
      indicator.classList.remove('visible');
    } else {
      indicator.classList.add('visible');
      announce(t('offline.message', '网络已断开，部分功能不可用'), 'assertive');
    }
  };

  updateIndicator(isOnline());
  onOnlineStatusChange(updateIndicator);
}

// ========================================
// P2: Service Worker Update Banner
// ========================================

function setupServiceWorkerUpdates(): void {
  let banner = document.getElementById('updateBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'updateBanner';
    banner.className = 'update-banner';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    banner.innerHTML = `
      <div class="update-banner__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 2v6h-6" />
          <path d="M3 13a9 9 0 0 1 15-6.7L21 8" />
          <path d="M3 22v-6h6" />
          <path d="M21 11a9 9 0 0 1-15 6.7L3 16" />
        </svg>
      </div>
      <div class="update-banner__content">
        <div class="update-banner__title">${t('update.available', '检测到新版本')}</div>
        <div class="update-banner__desc">${t('update.prompt', '点击更新以获取最新内容')}</div>
      </div>
      <div class="update-banner__actions">
        <button class="update-banner__btn update-banner__btn--secondary" data-action="dismiss">${t('update.later', '稍后')}</button>
        <button class="update-banner__btn update-banner__btn--primary" data-action="update">${t('update.apply', '立即更新')}</button>
      </div>
    `;
    document.body.appendChild(banner);
  }

  const updateButton = banner.querySelector('[data-action="update"]') as HTMLButtonElement | null;
  const dismissButton = banner.querySelector('[data-action="dismiss"]') as HTMLButtonElement | null;
  let reloadBound = false;

  const hideBanner = () => banner.classList.remove('visible');
  const showBanner = () => banner.classList.add('visible');

  const bindReloadOnControllerChange = () => {
    if (reloadBound) return;
    reloadBound = true;
    navigator.serviceWorker?.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  };

  if (updateButton && !updateButton.dataset._bind) {
    updateButton.addEventListener('click', () => {
      try {
        skipWaiting();
        bindReloadOnControllerChange();
        hideBanner();
      } catch {
        // Silent fail - SW update is best-effort
      }
    });
    updateButton.dataset._bind = '1';
  }

  if (dismissButton && !dismissButton.dataset._bind) {
    dismissButton.addEventListener('click', () => {
      hideBanner();
    });
    dismissButton.dataset._bind = '1';
  }

  onUpdateAvailable(() => {
    showBanner();
  });
}

// ========================================
// Global Cleanup
// ========================================

function globalCleanup(): void {
  try {
    cleanupWalletChart();
  } catch {
    // ignore
  }

  try {
    cleanupNetworkChart();
  } catch {
    // ignore
  }

  try {
    cleanupFooter();
  } catch {
    // ignore
  }

  try {
    cleanupScreenLock();
  } catch {
    // ignore
  }

  window._headerScrollBind = false;
  window._headerHashChangeBind = false;
  window._footerScrollBind = false;
  window._routerHashChangeBind = false;
  window._userMenuClickBind = false;
}

function bindLifecycleHooks(): void {
  // Export cleanup function globally
  window.globalCleanup = globalCleanup;

  window.addEventListener('beforeunload', () => {
    performanceMonitor.stop();
    globalCleanup();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (typeof window.cleanupNetworkChart === 'function') {
        try {
          window.cleanupNetworkChart();
        } catch {
          // ignore
        }
      }
    }
  });
}

// ========================================
// Initialization
// ========================================

function init(): void {
  initErrorBoundary({
    showError: (title: string, message: string) => {
      showErrorToast(message, title);
    },
    logToConsole: true
  });

  loadLanguageSetting();
  loadThemeSetting();
  initThemeSelector();

  performanceModeManager.loadMode();
  performanceModeManager.applyMode();
  window.performanceModeManager = performanceModeManager;

  if ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') && (window as unknown as { __PERF_DEBUG?: boolean }).__PERF_DEBUG === true) {
    performanceMonitor.start(10000);
  }

  try {
    recoverPendingLocalStorageTransactions();
  } catch {
    // best-effort
  }

  try {
    initAccessibility();
  } catch {
    // best-effort
  }

  try {
    templateLoader.init();
    pageManager.init('#main');

    PAGE_TEMPLATES.forEach((config) => {
      pageManager.register(config.id, {
        templatePath: config.templatePath || '',
        containerId: config.containerId,
        preload: config.preload
      });
    });

    console.log('[App] Template system initialized, pages will be loaded from /assets/templates/pages/');
  } catch (error) {
    console.error('[App] CRITICAL: Failed to initialize template system:', error);
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0f172a;color:white;text-align:center;padding:20px;">
        <div>
          <h1 style="color:#ef4444;margin-bottom:16px;">初始化失败</h1>
          <p style="color:#94a3b8;margin-bottom:24px;">模板系统加载失败，请刷新页面重试</p>
          <button data-action="reload" style="padding:12px 24px;background:#0ea5e9;color:white;border:none;border-radius:8px;cursor:pointer;font-size:16px;">刷新页面</button>
        </div>
      </div>
    `;
    return;
  }

  try {
    initLazyLoader();
  } catch {
    // best-effort
  }

  try {
    configureTransition({ duration: 300 });
  } catch {
    // best-effort
  }

  try {
    const removeAuthGuard = initAuthGuard();
    window._removeAuthGuard = removeAuthGuard;
  } catch {
    // best-effort
  }

  setupServiceWorkerUpdates();
  registerServiceWorker()
    .then(() => checkForUpdates())
    .catch(() => {
      // best-effort
    });

  setupOnlineIndicator();

  initUserMenu();
  initHeaderScroll();
  initRouter();

  updatePageTranslations();

  requestAnimationFrame(() => {
    const user = loadUser();
    updateHeaderUser(user);
  });

  requestAnimationFrame(() => {
    const user = loadUser();
    if (user && (user as { accountId?: string }).accountId) {
      initScreenLock({
        lockOnStart: true,
        onLock: () => {},
        onUnlock: () => {}
      });
    }
  });

  try {
    initFooter();
  } catch {
    // ignore
  }

  // Initialize confirmSkipModal event listeners
  const confirmSkipModal = document.getElementById('confirmSkipModal');
  const confirmSkipOk = document.getElementById('confirmSkipOk');
  const confirmSkipCancel = document.getElementById('confirmSkipCancel');

  if (confirmSkipOk && !(confirmSkipOk as HTMLElement).dataset._bind) {
    confirmSkipOk.addEventListener('click', () => {
      try {
        localStorage.setItem('guarChoice', JSON.stringify({ type: 'none' }));
      } catch {
        // ignore
      }
      if (confirmSkipModal) confirmSkipModal.classList.add('hidden');
      routeTo('#/main');
    });
    (confirmSkipOk as HTMLElement).dataset._bind = '1';
  }

  if (confirmSkipCancel && !(confirmSkipCancel as HTMLElement).dataset._bind) {
    confirmSkipCancel.addEventListener('click', () => {
      if (confirmSkipModal) confirmSkipModal.classList.add('hidden');
    });
    (confirmSkipCancel as HTMLElement).dataset._bind = '1';
  }

  bindLifecycleHooks();
}

export function startApp(): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
