/**
 * PanguPay - Main Entry Point
 * 
 * This is the main entry file that initializes all modules and sets up the application.
 * All functionality is imported from modular files in the js/ directory.
 */

// ========================================
// Error Suppression (Browser Extensions)
// ========================================
try {
  window.addEventListener('error', function (e) {
    var m = String((e && e.message) || '');
    var f = String((e && e.filename) || '');
    if (m.indexOf('Cannot redefine property: ethereum') !== -1 || f.indexOf('evmAsk.js') !== -1) {
      if (e.preventDefault) e.preventDefault();
      return true;
    }
    if (f.indexOf('solanaActionsContentScript.js') !== -1 || m.indexOf('Could not establish connection') !== -1) {
      if (e.preventDefault) e.preventDefault();
      return true;
    }
  }, true);
} catch (_) { }

try {
  window.addEventListener('unhandledrejection', function (e) {
    var reason = String((e && e.reason) || '');
    if (reason.indexOf('Could not establish connection') !== -1 || 
        reason.indexOf('Receiving end does not exist') !== -1 ||
        reason.indexOf('Something went wrong') !== -1) {
      if (e.preventDefault) e.preventDefault();
      return true;
    }
  }, true);
} catch (_) { }

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

// UI
import { updateHeaderUser, initUserMenu, initHeaderScroll } from './ui/header.js';
import { showUnifiedLoading, showUnifiedSuccess, hideUnifiedOverlay, showModalTip } from './ui/modal.js';
import { getCurrentTheme, setTheme, toggleTheme, loadThemeSetting, initThemeSelector } from './ui/theme.js';
import { initProfilePage } from './ui/profile.js';
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

// Pages
import { initWelcomePage, updateWelcomeButtons } from './pages/welcome.js';
import { initEntryPage, updateWalletBrief } from './pages/entry.js';
import { initLoginPage, resetLoginPageState } from './pages/login.js';
import { initNewUserPage, handleCreate, resetCreatingFlag } from './pages/newUser.js';
import { initImportPage, resetImportState } from './pages/import.js';
import { initMainPage, handleMainRoute } from './pages/main.js';
import { initJoinGroupPage, startInquiryAnimation, resetInquiryState } from './pages/joinGroup.js';
import { initGroupDetailPage, updateGroupDetailDisplay } from './pages/groupDetail.js';
import { initHistoryPage } from './pages/history.js';

// Router
import { router, routeTo, showCard, initRouter } from './router.js';

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
window.handleCreate = handleCreate;
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
window.updateWalletBrief = updateWalletBrief;

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
window.initProfilePage = initProfilePage;
window.initWelcomePage = initWelcomePage;
window.initEntryPage = initEntryPage;
window.initLoginPage = initLoginPage;
window.initNewUserPage = initNewUserPage;
window.initImportPage = initImportPage;
window.initMainPage = initMainPage;
window.initJoinGroupPage = initJoinGroupPage;
window.initGroupDetailPage = initGroupDetailPage;
window.initHistoryPage = initHistoryPage;
window.updateWelcomeButtons = updateWelcomeButtons;
window.resetLoginPageState = resetLoginPageState;
window.startInquiryAnimation = startInquiryAnimation;
window.resetInquiryState = resetInquiryState;
window.resetCreatingFlag = resetCreatingFlag;
window.resetImportState = resetImportState;
window.handleMainRoute = handleMainRoute;
window.updateGroupDetailDisplay = updateGroupDetailDisplay;

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

// ========================================
// Global Initialization
// ========================================

function init() {
  console.log('PanguPay - Modular Version Initializing...');
  
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
  
  // Start performance monitoring in development
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    performanceMonitor.start(10000); // Monitor every 10 seconds
    console.log('🔍 Performance monitoring enabled for development');
  }
  
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
  
  console.log('PanguPay initialized (modular)');
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
  
  console.log('Global cleanup completed');
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
