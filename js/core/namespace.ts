/**
 * PanguPay Namespace - Global API Namespace Manager
 * 
 * This module establishes a centralized namespace (window.PanguPay) to organize
 * all public APIs that need to be accessible from HTML or external scripts.
 * 
 * Benefits:
 * - Avoids polluting the global window object with 100+ individual functions
 * - Provides a clear boundary for "public API" vs "internal modules"
 * - Makes it easier to maintain type definitions
 * - Enables better IDE autocomplete and documentation
 * 
 * @module core/namespace
 */

import type { PanguPayNamespace } from './types';

/**
 * Initialize the PanguPay namespace on the window object.
 * Should be called once at application startup, before any other modules.
 */
export function initNamespace(): PanguPayNamespace {
  // Create namespace if it doesn't exist
  if (!window.PanguPay) {
    window.PanguPay = {
      // Router
      router: {
        routeTo: () => {},
        showCard: () => {},
        router: () => {},
        navigateTo: async () => false,
        addRouteGuard: () => () => {},
        configureTransition: () => {},
      },
      
      // i18n
      i18n: {
        t: (key: string) => key,
        setLanguage: () => {},
        getCurrentLanguage: () => 'zh-CN',
        updatePageTranslations: () => {},
      },
      
      // Theme
      theme: {
        setTheme: () => {},
        toggleTheme: () => {},
        refreshSrcAddrList: () => {},
        getCurrentTheme: () => 'light',
      },
      
      // Account
      account: {
        newUser: async () => undefined,
        importFromPrivHex: async () => undefined,
        addNewSubWallet: async () => {},
        handleCreate: async () => {},
      },
      
      // Storage
      storage: {
        loadUser: () => null,
        saveUser: () => {},
        toAccount: () => null,
        clearAccountStorage: () => {},
        loadUserProfile: () => null,
        saveUserProfile: () => {},
        getJoinedGroup: () => null,
        resetOrgSelectionForNewUser: () => {},
      },
      
      // Wallet
      wallet: {
        renderWallet: () => {},
        updateWalletBrief: () => {},
        refreshOrgPanel: () => {},
        refreshSrcAddrList: () => {},
        handleAddToAddress: async () => {},
        handleZeroAddress: () => {},
        initAddressModal: () => {},
        showAddrModal: () => {},
        hideAddrModal: () => {},
        initTransferModeTabs: () => {},
        rebuildAddrList: () => {},
        initRefreshSrcAddrList: () => {},
        initChangeAddressSelects: () => {},
        initRecipientCards: () => {},
        initAdvancedOptions: () => {},
        showUtxoDetail: () => {},
        showTxCerDetail: () => {},
      },
      
      // UI
      ui: {
        showToast: () => {},
        showSuccessToast: () => {},
        showErrorToast: () => {},
        showWarningToast: () => {},
        showInfoToast: () => {},
        showMiniToast: () => {},
        showUnifiedLoading: () => {},
        showUnifiedSuccess: () => {},
        hideUnifiedOverlay: () => {},
        showModalTip: () => {},
        copyToClipboard: async () => false,
        updateHeaderUser: () => {},
        announce: () => {},
        setAriaLabel: () => {},
        makeAccessibleButton: () => {},
        showLoading: () => '',
        hideLoading: () => {},
        withLoading: async (fn) => fn(),
        showElementLoading: () => {},
        hideElementLoading: () => {},
      },
      
      // Charts
      charts: {
        updateWalletChart: () => {},
        initWalletChart: () => {},
        initWalletStructToggle: () => {},
        initTxDetailModal: () => {},
        updateWalletStruct: () => {},
        cleanupWalletChart: () => {},
        cleanupNetworkChart: () => {},
      },
      
      // Transaction
      transaction: {
        buildNewTX: async () => null,
        exchangeRate: 1,
        initTransferSubmit: () => {},
      },
      
      // Crypto
      crypto: {
        bytesToHex: () => '',
        hexToBytes: () => new Uint8Array(),
        sha256: async () => new Uint8Array(),
        sha256Hex: async () => '',
        encryptPrivateKey: async () => '',
        decryptPrivateKey: async () => '',
        migrateToEncrypted: async () => false,
        clearLegacyKey: () => {},
        getPrivateKey: () => null,
        verifyPassword: async () => false,
        changePassword: async () => false,
        checkEncryptionStatus: () => ({ hasEncrypted: false, hasLegacy: false }),
        hasEncryptedKey: () => false,
        hasLegacyKey: () => false,
        showPasswordPrompt: async () => null,
        encryptAndSavePrivateKey: async () => false,
        getDecryptedPrivateKey: async () => null,
        checkAndPromptMigration: async () => false,
        saveUserWithEncryption: async () => false,
      },
      
      // Utils
      utils: {
        wait: async () => {},
        escapeHtml: (s) => s,
        createElement: () => document.createElement('div'),
        validateTransferAmount: () => ({ valid: false, error: '' }),
        validateAddress: () => ({ valid: false, error: '' }),
        validatePrivateKey: () => ({ valid: false, error: '' }),
        validateOrgId: () => ({ valid: false, error: '' }),
        createSubmissionGuard: () => ({ check: () => true, release: () => {} }),
        withSubmissionGuard: async (fn) => fn(),
        fetchWithTimeout: async () => new Response(),
        fetchWithRetry: async () => new Response(),
        secureFetch: async () => new Response(),
        secureFetchWithRetry: async () => new Response(),
        withErrorBoundary: (fn) => fn,
        reportError: () => {},
        debounce: (fn) => fn,
        throttle: (fn) => fn,
        delegate: () => () => {},
      },
      
      // Performance
      performance: {
        scheduleBatchUpdate: () => {},
        flushBatchUpdates: () => {},
        clearBatchUpdates: () => {},
        rafDebounce: (fn) => fn,
        rafThrottle: (fn) => fn,
      },
      
      // Events
      events: {
        globalEventManager: null as any,
        createEventManager: () => ({} as any),
        cleanupPageListeners: () => {},
      },
      
      // State
      state: {
        store: null as any,
        selectUser: () => null,
        selectRoute: () => '',
        selectTheme: () => 'light',
        selectLanguage: () => 'zh-CN',
        setUser: () => {},
        setRoute: () => {},
        setThemeState: () => {},
        setLanguageState: () => {},
        setLoading: () => {},
        setModalOpen: () => {},
      },
      
      // Form
      form: {
        FormValidator: class {} as any,
        validators: {} as any,
        addInlineValidation: () => () => {},
        withTransaction: async (fn) => fn(),
        createCheckpoint: () => '',
        restoreCheckpoint: () => false,
        enableFormAutoSave: () => () => {},
      },
      
      // ScreenLock
      screenLock: {
        initScreenLock: () => {},
        lockScreen: () => {},
        unlockScreen: () => false,
        isScreenLocked: () => false,
      },
      
      // Template
      template: {
        templateLoader: null as any,
        pageManager: null as any,
        getPageConfig: () => null,
        getAllContainerIds: () => [],
        lazyLoader: null as any,
      },
      
      // Network
      network: {
        isOnline: () => true,
        onOnlineStatusChange: () => () => {},
        checkForUpdates: async () => {},
      },
      
      // Page initializers (lazy loaded)
      pages: {
        initWelcomePage: async () => {},
        initEntryPage: async () => {},
        initLoginPage: async () => {},
        initNewUserPage: async () => {},
        initSetPasswordPage: async () => {},
        initImportPage: async () => {},
        initMainPage: async () => {},
        initJoinGroupPage: async () => {},
        initProfilePage: async () => {},
        initGroupDetailPage: async () => {},
        initHistoryPage: async () => {},
        updateWelcomeButtons: async () => {},
        resetLoginPageState: async () => {},
        startInquiryAnimation: async () => {},
        resetInquiryState: async () => {},
        resetCreatingFlag: async () => {},
        resetImportState: async () => {},
        handleMainRoute: async () => {},
        updateGroupDetailDisplay: async () => {},
      },
      
      // Version info
      version: '1.0.0',
    };
  }
  
  return window.PanguPay;
}

/**
 * Get the PanguPay namespace.
 * Throws an error if the namespace hasn't been initialized.
 */
export function getNamespace(): PanguPayNamespace {
  if (!window.PanguPay) {
    throw new Error('PanguPay namespace not initialized. Call initNamespace() first.');
  }
  return window.PanguPay;
}

/**
 * Register APIs to a specific namespace category.
 * This is used by various modules to expose their public APIs.
 */
export function registerAPIs<K extends keyof PanguPayNamespace>(
  category: K,
  apis: Partial<PanguPayNamespace[K]>
): void {
  const ns = getNamespace();
  if (ns[category] && typeof ns[category] === 'object') {
    Object.assign(ns[category] as object, apis);
  }
}

// Export the initialization function
export default initNamespace;
