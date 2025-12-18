/**
 * PanguPay - Main Entry Point
 * 
 * This is the main entry file that initializes all modules and sets up the application.
 * All functionality is imported from modular files in the js/ directory.
 * 
 * Architecture:
 * - All public APIs are organized under window.PanguPay namespace
 * - Legacy window.xxx aliases are kept for backward compatibility
 * - Event delegation system handles dynamic element interactions
 * 
 * Note: Error suppression is handled centrally by initErrorBoundary() in security.ts
 */

// ========================================
// CSS Imports (Vite handles bundling)
// ========================================
import '../css/index.css';

// ========================================
// Module Imports
// ========================================

// Core - Namespace and Event Delegation
import { initNamespace, initEventDelegate, registerAction } from './core';

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
  showPasswordPrompt,
  encryptAndSavePrivateKey,
  getDecryptedPrivateKey,
  checkAndPromptMigration,
  saveUserWithEncryption
} from './utils/keyEncryptionUI';
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

// P2 Improvements
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
import {
  initScreenLock,
  lockScreen,
  unlockScreen,
  isScreenLocked,
  cleanupScreenLock
} from './utils/screenLock';

// UI
import { updateHeaderUser, initUserMenu, initHeaderScroll } from './ui/header';
import { showUnifiedLoading, showUnifiedSuccess, hideUnifiedOverlay, showModalTip } from './ui/modal';
import { html as viewHtml } from './utils/view';
import { getCurrentTheme, setTheme, toggleTheme, loadThemeSetting, initThemeSelector } from './ui/theme.js';
import { updateWalletChart, initWalletChart, cleanupWalletChart } from './ui/charts.js';
import { initNetworkChart, cleanupNetworkChart } from './ui/networkChart.js';
import { initWalletStructToggle, initTxDetailModal } from './ui/walletStruct.js';
import { initFooter, cleanupFooter } from './ui/footer.js';

// Services
import { newUser, importFromPrivHex, addNewSubWallet } from './services/account';
import { 
  renderWallet, 
  refreshOrgPanel, 
  handleAddToAddress, 
  handleZeroAddress, 
  handleDeleteAddress,
  handleExportPrivateKey,
  toggleOpsMenu,
  toggleAddrCard,
  closeAllOpsMenus,
  initGlobalClickHandler,
  initAddressModal, 
  showAddrModal, 
  hideAddrModal, 
  initTransferModeTabs, 
  rebuildAddrList, 
  refreshSrcAddrList, 
  initRefreshSrcAddrList, 
  initChangeAddressSelects, 
  initRecipientCards, 
  initAdvancedOptions 
} from './services/wallet';
import { buildNewTX, exchangeRate } from './services/transaction';
import { initTransferSubmit, initBuildTransaction } from './services/transfer';
import { updateWalletStruct } from './services/walletStruct.js';

// Router
import { router, routeTo, showCard, initRouter } from './router';

// App bootstrap (TypeScript)
import { startApp } from './bootstrap';

// Template Loading System
import { templateLoader } from './utils/templateLoader';
import { pageManager } from './utils/pageManager';
import { PAGE_TEMPLATES, getPageConfig, getAllContainerIds } from './config/pageTemplates';

// ========================================
// Lazy Page Loaders
// ========================================
const pageLazyLoaders = {
  welcome: () => import('./pages/welcome.js'),
  entry: () => import('./pages/entry'),
  login: () => import('./pages/login.ts'),
  newUser: () => import('./pages/newUser.js'),
  setPassword: () => import('./pages/setPassword'),
  import: () => import('./pages/import'),
  main: () => import('./pages/main.js'),
  joinGroup: () => import('./pages/joinGroup'),
  profile: () => import('./ui/profile'),
  groupDetail: () => import('./pages/groupDetail.js'),
  history: () => import('./pages/history.js')
};

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
// UTXO/TXCer Detail Functions
// ========================================
const showUtxoDetail = (addrKey, utxoKey) => {
  const u = loadUser();
  if (!u || !u.wallet || !u.wallet.addressMsg) return;
  const addrMsg = u.wallet.addressMsg[addrKey];
  if (!addrMsg || !addrMsg.utxos) return;
  const utxo = addrMsg.utxos[utxoKey];
  if (!utxo) return;

  const positionText = utxo.Position
    ? `Block: ${utxo.Position.Blocknum}, IdxX: ${utxo.Position.IndexX}, IdxY: ${utxo.Position.IndexY}, IdxZ: ${utxo.Position.IndexZ}`
    : '';

  showModalTip(
    'UTXO 详情',
    viewHtml`
      <div class="detail-row"><div class="detail-label">UTXO Key</div><div class="detail-val">${utxoKey}</div></div>
      <div class="detail-row"><div class="detail-label">Value</div><div class="detail-val">${utxo.Value || 0}</div></div>
      <div class="detail-row"><div class="detail-label">Time</div><div class="detail-val">${utxo.Time || 0}</div></div>
      ${utxo.Position
        ? viewHtml`<div class="detail-row"><div class="detail-label">Position</div><div class="detail-val">${positionText}</div></div>`
        : null}
      <div class="detail-row"><div class="detail-label">Is TXCer</div><div class="detail-val">${utxo.IsTXCerUTXO ? 'Yes' : 'No'}</div></div>
      ${utxo.UTXO
        ? viewHtml`<div class="detail-row"><div class="detail-label">Source TX</div><div class="detail-val">
            <div class="detail-sub">
              <div style="margin-bottom:4px">TXID: ${utxo.UTXO.TXID || 'N/A'}</div>
              <div>VOut: ${utxo.UTXO.VOut}</div>
            </div>
          </div></div>`
        : null}
    `,
    false
  );
};

const showTxCerDetail = (addrKey, cerKey) => {
  const u = loadUser();
  if (!u || !u.wallet || !u.wallet.addressMsg) return;
  const addrMsg = u.wallet.addressMsg[addrKey];
  if (!addrMsg || !addrMsg.txCers) return;
  const cer = addrMsg.txCers[cerKey];
  if (!cer) return;

  const positionText = cer.Position
    ? `Block: ${cer.Position.Blocknum}, IdxX: ${cer.Position.IndexX}, IdxY: ${cer.Position.IndexY}, IdxZ: ${cer.Position.IndexZ}`
    : '';

  showModalTip(
    'TXCer 详情',
    viewHtml`
      <div class="detail-row"><div class="detail-label">TXCer Key</div><div class="detail-val">${cerKey}</div></div>
      <div class="detail-row"><div class="detail-label">Value</div><div class="detail-val">${cer.Value || 0}</div></div>
      <div class="detail-row"><div class="detail-label">Time</div><div class="detail-val">${cer.Time || 0}</div></div>
      ${cer.Position
        ? viewHtml`<div class="detail-row"><div class="detail-label">Position</div><div class="detail-val">${positionText}</div></div>`
        : null}
      ${cer.UTXO
        ? viewHtml`<div class="detail-row"><div class="detail-label">Source TX</div><div class="detail-val">
            <div class="detail-sub">
              <div style="margin-bottom:4px">TXID: ${cer.UTXO.TXID || 'N/A'}</div>
              <div>VOut: ${cer.UTXO.VOut}</div>
            </div>
          </div></div>`
        : null}
    `,
    false
  );
};

// ========================================
// Initialize PanguPay Namespace
// ========================================
initNamespace();

// Populate namespace with actual implementations
const PP = window.PanguPay;

// Router
Object.assign(PP.router, {
  routeTo,
  showCard,
  router,
  navigateTo: enhancedNavigateTo,
  addRouteGuard,
  configureTransition,
});

// i18n
Object.assign(PP.i18n, {
  t,
  setLanguage,
  getCurrentLanguage,
  updatePageTranslations,
});

// Theme
Object.assign(PP.theme, {
  setTheme,
  toggleTheme,
  getCurrentTheme,
});

// Account
Object.assign(PP.account, {
  newUser,
  importFromPrivHex,
  addNewSubWallet,
  handleCreate: createLazyPageFn('newUser', 'handleCreate'),
});

// Storage
Object.assign(PP.storage, {
  loadUser,
  saveUser,
  toAccount: (basic) => toAccount(basic, loadUser()),
  clearAccountStorage,
  loadUserProfile,
  saveUserProfile,
  getJoinedGroup,
  resetOrgSelectionForNewUser,
});

// Wallet
Object.assign(PP.wallet, {
  renderWallet,
  updateWalletBrief: createLazyPageFn('entry', 'updateWalletBrief'),
  refreshOrgPanel,
  handleAddToAddress,
  handleZeroAddress,
  initAddressModal,
  showAddrModal,
  hideAddrModal,
  initTransferModeTabs,
  rebuildAddrList,
  refreshSrcAddrList,
  initRefreshSrcAddrList,
  initChangeAddressSelects,
  initRecipientCards,
  initAdvancedOptions,
  showUtxoDetail,
  showTxCerDetail,
});

// UI
Object.assign(PP.ui, {
  showToast,
  showSuccessToast,
  showErrorToast,
  showWarningToast,
  showInfoToast,
  showMiniToast,
  showUnifiedLoading,
  showUnifiedSuccess,
  hideUnifiedOverlay,
  showModalTip,
  copyToClipboard,
  updateHeaderUser,
  announce,
  setAriaLabel,
  makeAccessibleButton,
  showLoading,
  hideLoading,
  withLoading,
  showElementLoading,
  hideElementLoading,
});

// Charts
Object.assign(PP.charts, {
  updateWalletChart,
  initWalletChart,
  initWalletStructToggle,
  initTxDetailModal,
  updateWalletStruct,
});

// Transaction
Object.assign(PP.transaction, {
  buildNewTX,
  exchangeRate,
  initTransferSubmit,
  initBuildTransaction,
});

// Crypto
Object.assign(PP.crypto, {
  bytesToHex,
  hexToBytes,
  sha256,
  sha256Hex,
  encryptPrivateKey,
  decryptPrivateKey,
  migrateToEncrypted,
  clearLegacyKey,
  getPrivateKey,
  verifyPassword,
  changePassword,
  checkEncryptionStatus,
  hasEncryptedKey,
  hasLegacyKey,
  showPasswordPrompt,
  encryptAndSavePrivateKey,
  getDecryptedPrivateKey,
  checkAndPromptMigration,
  saveUserWithEncryption,
});

// Utils
Object.assign(PP.utils, {
  wait,
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
  withErrorBoundary,
  reportError,
  debounce,
  throttle,
  delegate,
});

// Performance
Object.assign(PP.performance, {
  scheduleBatchUpdate,
  flushBatchUpdates,
  clearBatchUpdates,
  rafDebounce,
  rafThrottle,
});

// Events
Object.assign(PP.events, {
  globalEventManager,
  createEventManager,
  cleanupPageListeners,
});

// State
Object.assign(PP.state, {
  store,
  selectUser,
  selectRoute,
  selectTheme,
  selectLanguage,
  setUser,
  setRoute,
  setThemeState,
  setLanguageState,
  setLoading,
  setModalOpen,
});

// Form
Object.assign(PP.form, {
  FormValidator,
  validators,
  addInlineValidation,
  withTransaction,
  createCheckpoint,
  restoreCheckpoint,
  enableFormAutoSave,
});

// ScreenLock
Object.assign(PP.screenLock, {
  initScreenLock,
  lockScreen,
  unlockScreen,
  isScreenLocked,
});

// Template
Object.assign(PP.template, {
  templateLoader,
  pageManager,
  getPageConfig,
  getAllContainerIds,
  lazyLoader,
});

// Network
Object.assign(PP.network, {
  isOnline,
  onOnlineStatusChange,
  checkForUpdates,
});

// Pages
Object.assign(PP.pages, {
  initWelcomePage: createLazyPageFn('welcome', 'initWelcomePage'),
  initEntryPage: createLazyPageFn('entry', 'initEntryPage'),
  initLoginPage: createLazyPageFn('login', 'initLoginPage'),
  initNewUserPage: createLazyPageFn('newUser', 'initNewUserPage'),
  initSetPasswordPage: createLazyPageFn('setPassword', 'initSetPasswordPage'),
  initImportPage: createLazyPageFn('import', 'initImportPage'),
  initMainPage: createLazyPageFn('main', 'initMainPage'),
  initJoinGroupPage: createLazyPageFn('joinGroup', 'initJoinGroupPage'),
  initProfilePage: createLazyPageFn('profile', 'initProfilePage'),
  initGroupDetailPage: createLazyPageFn('groupDetail', 'initGroupDetailPage'),
  initHistoryPage: createLazyPageFn('history', 'initHistoryPage'),
  updateWelcomeButtons: createLazyPageFn('welcome', 'updateWelcomeButtons'),
  resetLoginPageState: createLazyPageFn('login', 'resetLoginPageState'),
  startInquiryAnimation: createLazyPageFn('joinGroup', 'startInquiryAnimation'),
  resetInquiryState: createLazyPageFn('joinGroup', 'resetInquiryState'),
  resetCreatingFlag: createLazyPageFn('newUser', 'resetCreatingFlag'),
  resetImportState: createLazyPageFn('import', 'resetImportState'),
  handleMainRoute: createLazyPageFn('main', 'handleMainRoute'),
  updateGroupDetailDisplay: createLazyPageFn('groupDetail', 'updateGroupDetailDisplay'),
});

// ========================================
// Initialize Event Delegation
// ========================================
initEventDelegate();

// Register actions for dynamic onclick replacements
registerAction('showUtxoDetail', (el, data) => {
  showUtxoDetail(data.addr, data.key);
});

registerAction('showTxCerDetail', (el, data) => {
  showTxCerDetail(data.addr, data.key);
});

registerAction('reload', () => {
  location.reload();
});

// ========================================
// Wallet Event Delegation Actions
// ========================================

// Toggle address card expand/collapse
registerAction('toggleAddrCard', (el, data) => {
  toggleAddrCard(data.addr, el);
});

// Add balance to address
registerAction('addToAddress', (el, data) => {
  handleAddToAddress(data.addr);
});

// Clear address balance
registerAction('zeroAddress', (el, data) => {
  handleZeroAddress(data.addr);
});

// Toggle operations menu
registerAction('toggleOpsMenu', (el, data) => {
  toggleOpsMenu(data.addr, el);
});

// Delete address
registerAction('deleteAddress', (el, data) => {
  handleDeleteAddress(data.addr);
});

// Export private key
registerAction('exportPrivateKey', (el, data) => {
  handleExportPrivateKey(data.addr);
});

// Initialize global click handler for closing menus
initGlobalClickHandler();

// ========================================
// Start Application
// ========================================
// NOTE: All legacy window.xxx aliases have been removed.
// All code must use window.PanguPay.xxx namespace pattern.
// See js/core/types.ts for the full API reference.
startApp();
