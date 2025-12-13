/**
 * PanguPay - Main Entry Point
 * 
 * This is the main entry file that initializes all modules and sets up the application.
 * All functionality is imported from modular files in the js/ directory.
 * 
 * Note: Error suppression is handled centrally by initErrorBoundary() in security.ts
 */

// ========================================
// Module Imports
// ========================================

// Config
// Note: Constants imported in child modules

// i18n
import { t, setLanguage, getCurrentLanguage, updatePageTranslations, loadLanguageSetting } from './i18n/index.js';

// Utils
import { bytesToHex, hexToBytes, sha256, sha256Hex } from './utils/crypto';
import { loadUser, saveUser, toAccount, clearAccountStorage, loadUserProfile, saveUserProfile, getJoinedGroup, resetOrgSelectionForNewUser } from './utils/storage';
import { showToast, showSuccessToast, showErrorToast, showWarningToast, showInfoToast, showMiniToast } from './utils/toast.js';
import { wait, copyToClipboard } from './utils/helpers.js';
import { debounce, throttle, delegate, EventListenerManager, globalEventManager, createEventManager, cleanupPageListeners } from './utils/eventUtils.js';
import store, { 
  selectUser, selectRoute, selectTheme, selectLanguage,
  setUser, setRoute, setThemeState, setLanguageState, setLoading, setModalOpen
} from './utils/store.js';
import {
  encryptPrivateKey,
  decryptPrivateKey,
  migrateToEncrypted,
  clearLegacyKey,
  getPrivateKey,
  verifyPassword,
  changePassword,
  checkEncryptionStatus,
  hasEncryptedKey,
  hasLegacyKey
} from './utils/keyEncryption';
import { 
  escapeHtml, 
  createElement, 
  validateTransferAmount, 
  validateAddress, 
  validatePrivateKey,
  validateOrgId,
  createSubmissionGuard,
  withSubmissionGuard,
  fetchWithTimeout,
  fetchWithRetry,
  secureFetch,
  secureFetchWithRetry,
  initErrorBoundary,
  withErrorBoundary,
  reportError
} from './utils/security';
import performanceModeManager, { 
  scheduleBatchUpdate, 
  flushBatchUpdates, 
  clearBatchUpdates,
  rafDebounce,
  rafThrottle 
} from './utils/performanceMode.js';
import performanceMonitor from './utils/performanceMonitor.js';

// P2 Improvements - Accessibility, Loading, Service Worker, etc.
import { 
  initAccessibility, 
  announce,
  setAriaLabel,
  makeAccessibleButton 
} from './utils/accessibility';
import { 
  loadingManager, 
  showLoading, 
  hideLoading, 
  withLoading,
  showElementLoading,
  hideElementLoading 
} from './utils/loading';
import { 
  registerServiceWorker, 
  isOnline, 
  onOnlineStatusChange,
  onUpdateAvailable,
  skipWaiting,
  checkForUpdates
} from './utils/serviceWorker';
import { 
  FormValidator, 
  validators,
  addInlineValidation 
} from './utils/formValidator';
import { 
  withTransaction, 
  createCheckpoint, 
  restoreCheckpoint,
  enableFormAutoSave,
  recoverPendingLocalStorageTransactions
} from './utils/transaction';
import { lazyLoader, initLazyLoader } from './utils/lazyLoader';
import { 
  addRouteGuard, 
  initAuthGuard,
  configureTransition,
  navigateTo as enhancedNavigateTo 
} from './utils/enhancedRouter';

// UI
import { updateHeaderUser, initUserMenu, initHeaderScroll } from './ui/header.js';
import { showUnifiedLoading, showUnifiedSuccess, hideUnifiedOverlay, showModalTip } from './ui/modal.js';
import { getCurrentTheme, setTheme, toggleTheme, loadThemeSetting, initThemeSelector } from './ui/theme.js';
import { updateWalletChart, initWalletChart, cleanupWalletChart } from './ui/charts.js';
import { initNetworkChart, cleanupNetworkChart } from './ui/networkChart.js';
import { initWalletStructToggle, initTxDetailModal } from './ui/walletStruct.js';
import { initFooter, cleanupFooter } from './ui/footer.js';

// Services
import { newUser, importFromPrivHex, addNewSubWallet } from './services/account';
import { renderWallet, refreshOrgPanel, handleAddToAddress, handleZeroAddress, initAddressModal, showAddrModal, hideAddrModal, initTransferModeTabs, rebuildAddrList, initRefreshSrcAddrList, initChangeAddressSelects, initRecipientCards, initAdvancedOptions } from './services/wallet.js';
import { buildNewTX, exchangeRate } from './services/transaction';
import { initTransferSubmit, initBuildTransaction } from './services/transfer';
import { updateWalletStruct } from './services/walletStruct.js';

// Router
import { router, routeTo, showCard, initRouter } from './router.js';

// Lazy page loaders (avoid pulling all page code on first screen)
const pageLazyLoaders = {
  welcome: () => import('./pages/welcome.js'),
  entry: () => import('./pages/entry.js'),
  login: () => import('./pages/login.js'),
  newUser: () => import('./pages/newUser.js'),
  import: () => import('./pages/import.js'),
  main: () => import('./pages/main.js'),
  joinGroup: () => import('./pages/joinGroup.js'),
  groupDetail: () => import('./pages/groupDetail.js'),
  history: () => import('./pages/history.js')
};

/** Lazy helper: call a page fn when first used */
function createLazyPageFn(routeKey, fnName, argMapper) {
  return async (...args) => {
    const loader = pageLazyLoaders[routeKey];
    if (!loader) return;
    const mod = await loader();
    const fn = mod && typeof mod[fnName] === 'function' ? mod[fnName] : null;
    if (fn) {
      return argMapper ? fn(...argMapper(args)) : fn(...args);
    }
    return undefined;
  };
}

// ========================================
// Global Function Exports (for HTML onclick compatibility)
// ========================================

// Router functions
window.routeTo = routeTo;
window.showCard = showCard;
window.router = router;

// i18n functions
window.t = t;
window.setLanguage = setLanguage;
window.getCurrentLanguage = getCurrentLanguage;
window.updatePageTranslations = updatePageTranslations;

// Theme functions
window.setTheme = setTheme;
window.toggleTheme = toggleTheme;
window.getCurrentTheme = getCurrentTheme;

// Account functions
window.handleCreate = createLazyPageFn('newUser', 'handleCreate');
window.newUser = newUser;
window.importFromPrivHex = importFromPrivHex;
window.addNewSubWallet = addNewSubWallet;

// Storage functions
window.loadUser = loadUser;
window.saveUser = saveUser;
window.toAccount = (basic) => toAccount(basic, loadUser()); // Wrapper to match expected signature
window.clearAccountStorage = clearAccountStorage;
window.loadUserProfile = loadUserProfile;
window.saveUserProfile = saveUserProfile;
window.getJoinedGroup = getJoinedGroup;
window.resetOrgSelectionForNewUser = resetOrgSelectionForNewUser;

// Wallet functions
window.renderWallet = renderWallet;
window.updateWalletBrief = createLazyPageFn('entry', 'updateWalletBrief');

// UTXO/TXCer detail modal functions
window.showUtxoDetail = (addrKey, utxoKey) => {
  const u = loadUser();
  if (!u || !u.wallet || !u.wallet.addressMsg) return;
  const addrMsg = u.wallet.addressMsg[addrKey];
  if (!addrMsg || !addrMsg.utxos) return;
  const utxo = addrMsg.utxos[utxoKey];
  if (!utxo) return;

  let html = '';
  html += `<div class="detail-row"><div class="detail-label">UTXO Key</div><div class="detail-val">${utxoKey}</div></div>`;
  html += `<div class="detail-row"><div class="detail-label">Value</div><div class="detail-val">${utxo.Value || 0}</div></div>`;
  html += `<div class="detail-row"><div class="detail-label">Time</div><div class="detail-val">${utxo.Time || 0}</div></div>`;

  if (utxo.Position) {
    html += `<div class="detail-row"><div class="detail-label">Position</div><div class="detail-val">`;
    html += `Block: ${utxo.Position.Blocknum}, IdxX: ${utxo.Position.IndexX}, IdxY: ${utxo.Position.IndexY}, IdxZ: ${utxo.Position.IndexZ}`;
    html += `</div></div>`;
  }

  html += `<div class="detail-row"><div class="detail-label">Is TXCer</div><div class="detail-val">${utxo.IsTXCerUTXO ? 'Yes' : 'No'}</div></div>`;

  if (utxo.UTXO) {
    html += `<div class="detail-row"><div class="detail-label">Source TX</div><div class="detail-val">`;
    html += `<div class="detail-sub">`;
    html += `<div style="margin-bottom:4px">TXID: ${utxo.UTXO.TXID || 'N/A'}</div>`;
    html += `<div>VOut: ${utxo.UTXO.VOut}</div>`;
    html += `</div></div></div>`;
  }

  showModalTip('UTXO 详情', html, false);
};

window.showTxCerDetail = (addrKey, cerKey) => {
  const u = loadUser();
  if (!u || !u.wallet || !u.wallet.addressMsg) return;
  const addrMsg = u.wallet.addressMsg[addrKey];
  if (!addrMsg || !addrMsg.txCers) return;
  const cer = addrMsg.txCers[cerKey];
  if (!cer) return;

  let html = '';
  html += `<div class="detail-row"><div class="detail-label">TXCer Key</div><div class="detail-val">${cerKey}</div></div>`;
  html += `<div class="detail-row"><div class="detail-label">Value</div><div class="detail-val">${cer.Value || 0}</div></div>`;
  html += `<div class="detail-row"><div class="detail-label">Time</div><div class="detail-val">${cer.Time || 0}</div></div>`;

  if (cer.Position) {
    html += `<div class="detail-row"><div class="detail-label">Position</div><div class="detail-val">`;
    html += `Block: ${cer.Position.Blocknum}, IdxX: ${cer.Position.IndexX}, IdxY: ${cer.Position.IndexY}, IdxZ: ${cer.Position.IndexZ}`;
    html += `</div></div>`;
  }

  if (cer.UTXO) {
    html += `<div class="detail-row"><div class="detail-label">Source TX</div><div class="detail-val">`;
    html += `<div class="detail-sub">`;
    html += `<div style="margin-bottom:4px">TXID: ${cer.UTXO.TXID || 'N/A'}</div>`;
    html += `<div>VOut: ${cer.UTXO.VOut}</div>`;
    html += `</div></div></div>`;
  }

  showModalTip('TXCer 详情', html, false);
};
window.refreshOrgPanel = refreshOrgPanel;
window.handleAddToAddress = handleAddToAddress;
window.handleZeroAddress = handleZeroAddress;
window.initAddressModal = initAddressModal;
window.showAddrModal = showAddrModal;
window.hideAddrModal = hideAddrModal;
window.initTransferModeTabs = initTransferModeTabs;
window.rebuildAddrList = rebuildAddrList;
window.initRefreshSrcAddrList = initRefreshSrcAddrList;
window.initChangeAddressSelects = initChangeAddressSelects;
window.initRecipientCards = initRecipientCards;
window.initAdvancedOptions = initAdvancedOptions;
window.updateWalletBrief = createLazyPageFn('entry', 'updateWalletBrief');

// UI functions
window.showToast = showToast;
window.showSuccessToast = showSuccessToast;
window.showErrorToast = showErrorToast;
window.showWarningToast = showWarningToast;
window.showInfoToast = showInfoToast;
window.showMiniToast = showMiniToast;
window.showUnifiedLoading = showUnifiedLoading;
window.showUnifiedSuccess = showUnifiedSuccess;
window.hideUnifiedOverlay = hideUnifiedOverlay;
window.showModalTip = showModalTip;
window.copyToClipboard = copyToClipboard;
window.updateHeaderUser = updateHeaderUser;

// Page init functions
window.initProfilePage = createLazyPageFn('profile', 'initProfilePage');
window.initWelcomePage = createLazyPageFn('welcome', 'initWelcomePage');
window.initEntryPage = createLazyPageFn('entry', 'initEntryPage');
window.initLoginPage = createLazyPageFn('login', 'initLoginPage');
window.initNewUserPage = createLazyPageFn('newUser', 'initNewUserPage');
window.initImportPage = createLazyPageFn('import', 'initImportPage');
window.initMainPage = createLazyPageFn('main', 'initMainPage');
window.initJoinGroupPage = createLazyPageFn('joinGroup', 'initJoinGroupPage');
window.initGroupDetailPage = createLazyPageFn('groupDetail', 'initGroupDetailPage');
window.initHistoryPage = createLazyPageFn('history', 'initHistoryPage');
window.updateWelcomeButtons = createLazyPageFn('welcome', 'updateWelcomeButtons');
window.resetLoginPageState = createLazyPageFn('login', 'resetLoginPageState');
window.startInquiryAnimation = createLazyPageFn('joinGroup', 'startInquiryAnimation');
window.resetInquiryState = createLazyPageFn('joinGroup', 'resetInquiryState');
window.resetCreatingFlag = createLazyPageFn('newUser', 'resetCreatingFlag');
window.resetImportState = createLazyPageFn('import', 'resetImportState');
window.handleMainRoute = createLazyPageFn('main', 'handleMainRoute');
window.updateGroupDetailDisplay = createLazyPageFn('groupDetail', 'updateGroupDetailDisplay');

// Chart functions
window.updateWalletChart = updateWalletChart;
window.initWalletChart = initWalletChart;
window.initWalletStructToggle = initWalletStructToggle;
window.initTxDetailModal = initTxDetailModal;
window.updateWalletStruct = updateWalletStruct;

// Transaction functions
window.buildNewTX = buildNewTX;
window.exchangeRate = exchangeRate;
window.initTransferSubmit = initTransferSubmit;
window.initBuildTransaction = initBuildTransaction;

// Crypto functions
window.bytesToHex = bytesToHex;
window.hexToBytes = hexToBytes;
window.sha256 = sha256;
window.sha256Hex = sha256Hex;

// Helper functions
window.wait = wait;

// Security functions
window.escapeHtml = escapeHtml;
window.createElement = createElement;
window.validateTransferAmount = validateTransferAmount;
window.validateAddress = validateAddress;
window.validatePrivateKey = validatePrivateKey;
window.validateOrgId = validateOrgId;
window.createSubmissionGuard = createSubmissionGuard;
window.withSubmissionGuard = withSubmissionGuard;
window.fetchWithTimeout = fetchWithTimeout;
window.fetchWithRetry = fetchWithRetry;
window.secureFetch = secureFetch;
window.secureFetchWithRetry = secureFetchWithRetry;
window.withErrorBoundary = withErrorBoundary;
window.reportError = reportError;

// Performance functions
window.scheduleBatchUpdate = scheduleBatchUpdate;
window.flushBatchUpdates = flushBatchUpdates;
window.clearBatchUpdates = clearBatchUpdates;
window.rafDebounce = rafDebounce;
window.rafThrottle = rafThrottle;

// Event management functions
window.debounce = debounce;
window.throttle = throttle;
window.delegate = delegate;
window.EventListenerManager = EventListenerManager;
window.globalEventManager = globalEventManager;
window.createEventManager = createEventManager;
window.cleanupPageListeners = cleanupPageListeners;

// State management
window.store = store;
window.selectUser = selectUser;
window.selectRoute = selectRoute;
window.selectTheme = selectTheme;
window.selectLanguage = selectLanguage;
window.setUser = setUser;
window.setRoute = setRoute;
window.setThemeState = setThemeState;
window.setLanguageState = setLanguageState;
window.setLoading = setLoading;
window.setModalOpen = setModalOpen;

// Key encryption functions
window.encryptPrivateKey = encryptPrivateKey;
window.decryptPrivateKey = decryptPrivateKey;
window.migrateToEncrypted = migrateToEncrypted;
window.clearLegacyKey = clearLegacyKey;
window.getPrivateKey = getPrivateKey;
window.verifyPassword = verifyPassword;
window.changePassword = changePassword;
window.checkEncryptionStatus = checkEncryptionStatus;
window.hasEncryptedKey = hasEncryptedKey;
window.hasLegacyKey = hasLegacyKey;

// P2 Improvements - Accessibility
window.announce = announce;
window.setAriaLabel = setAriaLabel;
window.makeAccessibleButton = makeAccessibleButton;

// P2 Improvements - Loading Management
window.loadingManager = loadingManager;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.withLoading = withLoading;
window.showElementLoading = showElementLoading;
window.hideElementLoading = hideElementLoading;

// P2 Improvements - Form Validation
window.FormValidator = FormValidator;
window.validators = validators;
window.addInlineValidation = addInlineValidation;

// P2 Improvements - Transaction/Rollback
window.withTransaction = withTransaction;
window.createCheckpoint = createCheckpoint;
window.restoreCheckpoint = restoreCheckpoint;
window.enableFormAutoSave = enableFormAutoSave;

// P2 Improvements - Lazy Loading
window.lazyLoader = lazyLoader;

// P2 Improvements - Enhanced Router
window.addRouteGuard = addRouteGuard;
window.enhancedNavigateTo = enhancedNavigateTo;
window.configureTransition = configureTransition;

// P2 Improvements - Online Status
window.isOnline = isOnline;
window.onOnlineStatusChange = onOnlineStatusChange;

// P2 Improvements - Service Worker Update Hooks
window.checkForUpdates = checkForUpdates;

// ========================================
// P2: Online/Offline Indicator Setup
// ========================================

/**
 * Setup online/offline indicator
 */
function setupOnlineIndicator() {
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
  
  // Update indicator based on online status
  /**
   * @param {boolean} online - Whether the app is online
   */
  function updateIndicator(online) {
    if (online) {
      indicator.classList.remove('visible');
    } else {
      indicator.classList.add('visible');
      // Announce to screen readers
      announce(t('offline.message', '网络已断开，部分功能不可用'), 'assertive');
    }
  }
  
  // Initial check
  updateIndicator(isOnline());
  
  // Listen for online/offline changes
  onOnlineStatusChange(updateIndicator);
}

// ========================================
// P2: Service Worker Update Banner
// ========================================

/**
 * Setup update banner to surface new service worker versions
 */
function setupServiceWorkerUpdates() {
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
  
  const updateButton = banner.querySelector('[data-action="update"]');
  const dismissButton = banner.querySelector('[data-action="dismiss"]');
  let reloadBound = false;
  
  const hideBanner = () => banner.classList.remove('visible');
  const showBanner = () => banner.classList.add('visible');
  
  // Reload once the new service worker takes control
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
      } catch (_) {
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
  
  // Listen for update availability
  onUpdateAvailable(() => {
    showBanner();
  });
}

// ========================================
// Global Initialization
// ========================================

function init() {
  // PanguPay initialization - silent mode
  
  // Initialize error boundary first (before any other code that might throw)
  initErrorBoundary({
    showError: (title, message) => {
      // Use toast to show errors to users
      showErrorToast(message, title);
    },
    logToConsole: true
  });
  
  // Initialize language
  loadLanguageSetting();
  
  // Initialize theme
  loadThemeSetting();
  initThemeSelector();
  
  // Initialize performance mode
  performanceModeManager.loadMode();
  performanceModeManager.applyMode();
  // Export to window for global access
  window.performanceModeManager = performanceModeManager;
  
  // Start performance monitoring in development (silent)
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    performanceMonitor.start(10000); // Monitor every 10 seconds
  }
  
  // ========================================
  // P2 Improvements Initialization
  // ========================================

  // Recover from any interrupted localStorage transaction
  try {
    recoverPendingLocalStorageTransactions();
  } catch (_) {
    // Silently fail - recovery is best-effort
  }
  
  // Initialize accessibility features (skip links, ARIA live regions)
  try {
    initAccessibility();
  } catch (error) {
    // Silently fail - accessibility is optional
  }
  
  // Initialize lazy loader for code splitting
  try {
    initLazyLoader();
  } catch (error) {
    // Silently fail - lazy loading is optional
  }
  
  // Configure route transition animations
  try {
    configureTransition({
      duration: 300
    });
  } catch (error) {
    // Silently fail - transitions are optional
  }
  
  // Setup route guards for authentication
  try {
    const removeAuthGuard = initAuthGuard();
    // Store cleanup function
    window._removeAuthGuard = removeAuthGuard;
  } catch (error) {
    // Silently fail - guards are optional
  }
  
  // Register Service Worker for offline support
  setupServiceWorkerUpdates();
  registerServiceWorker()
    .then(() => checkForUpdates())
    .catch(() => {
      // Silently fail - SW is optional
    });
  
  // Setup online/offline indicator
  setupOnlineIndicator();
  
  // ========================================
  // End P2 Improvements
  // ========================================
  
  // Initialize user menu
  initUserMenu();
  
  // Initialize header scroll behavior
  initHeaderScroll();
  
  // Initialize router
  initRouter();
  
  // Update page translations
  updatePageTranslations();
  
  // Update header with current user (after router init to ensure DOM is ready)
  requestAnimationFrame(() => {
    const user = loadUser();
    updateHeaderUser(user);
  });
  
  // Initialize network chart
  try {
    initNetworkChart();
  } catch (_) { }
  
  // Initialize footer animations
  try {
    initFooter();
  } catch (_) { }
  
  // App initialized successfully (no console output)
  
  // Initialize confirmSkipModal event listeners
  const confirmSkipModal = document.getElementById('confirmSkipModal');
  const confirmSkipOk = document.getElementById('confirmSkipOk');
  const confirmSkipCancel = document.getElementById('confirmSkipCancel');
  if (confirmSkipOk && !confirmSkipOk.dataset._bind) {
    confirmSkipOk.addEventListener('click', () => {
      try { localStorage.setItem('guarChoice', JSON.stringify({ type: 'none' })); } catch { }
      if (confirmSkipModal) confirmSkipModal.classList.add('hidden');
      routeTo('#/main');
    });
    confirmSkipOk.dataset._bind = '1';
  }
  if (confirmSkipCancel && !confirmSkipCancel.dataset._bind) {
    confirmSkipCancel.addEventListener('click', () => {
      if (confirmSkipModal) confirmSkipModal.classList.add('hidden');
    });
    confirmSkipCancel.dataset._bind = '1';
  }
}

// ========================================
// Global Cleanup Function
// ========================================

/**
 * Clean up all resources to prevent memory leaks
 */
function globalCleanup() {
  // Cleanup chart resources
  try { cleanupWalletChart(); } catch (_) { }
  
  // Cleanup network chart resources
  try { cleanupNetworkChart(); } catch (_) { }
  
  // Cleanup footer resources
  try { cleanupFooter(); } catch (_) { }
  
  // Clear global flags
  window._headerScrollBind = false;
  window._headerHashChangeBind = false;
  window._footerScrollBind = false;
  window._routerHashChangeBind = false;
  window._userMenuClickBind = false;
}

// Export cleanup functions globally
window.globalCleanup = globalCleanup;

// ========================================
// DOM Ready Handler
// ========================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ========================================
// Page Unload Handler
// ========================================

// Clean up resources when page is about to unload
window.addEventListener('beforeunload', () => {
  performanceMonitor.stop();
  globalCleanup();
});

// Also clean up on visibility change (when tab becomes hidden)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Page is hidden, pause resource-intensive operations
    if (typeof window.cleanupNetworkChart === 'function') {
      try { window.cleanupNetworkChart(); } catch (_) { }
    }
  }
});
