/**
 * Global Type Declarations for PanguPay
 * 
 * This file declares global types that extend Window and other built-in interfaces.
 * It allows TypeScript/JSDoc to understand custom window properties.
 * 
 * NOTE: The window.xxx declarations are kept for backward compatibility.
 * New code should use window.PanguPay.xxx namespace instead.
 */

// Import types from core module
import type { PanguPayNamespace } from './core/types';

// Use declare global to extend the Window interface
declare global {
  interface Window {
    /** 
     * PanguPay centralized namespace (preferred for new code)
     * All public APIs are organized under this namespace.
     */
    PanguPay: PanguPayNamespace;
    // Router functions
    routeTo: (route: string) => void;
    showCard: (card: HTMLElement) => void;
    router: any;

    // i18n functions
    t: (key: string, paramsOrDefault?: string | Record<string, any>) => string;
    setLanguage: (lang: string) => void;
    getCurrentLanguage: () => string;
    updatePageTranslations: () => void;

    // Theme functions
    setTheme: (theme: string) => void;
    toggleTheme: () => void;
    getCurrentTheme: () => string;

    // Account functions
    handleCreate: () => Promise<void>;
    newUser: () => Promise<any>;
    importFromPrivHex: (privHex: string) => Promise<any>;
    addNewSubWallet: (type: number) => Promise<any>;

    // Storage functions
    loadUser: () => any;
    saveUser: (user: any) => void;
    toAccount: (user: any) => any;
    clearAccountStorage: () => void;
    loadUserProfile: () => any;
    saveUserProfile: (profile: any) => void;
    getJoinedGroup: () => any;
    resetOrgSelectionForNewUser: () => void;

    // Wallet functions
    renderWallet: (wallet: any) => void;
    updateWalletBrief: () => void;
    refreshOrgPanel: () => void;
    handleAddToAddress: (address: string) => void;
    handleZeroAddress: (address: string) => void;
    initAddressModal: () => void;
    showAddrModal: (mode: string) => void;
    hideAddrModal: () => void;
    initTransferModeTabs: () => void;
    rebuildAddrList: () => void;
    initRefreshSrcAddrList: () => void;
    initChangeAddressSelects: () => void;
    initRecipientCards: () => void;
    initAdvancedOptions: () => void;
    __refreshSrcAddrList: () => void;
    updateSummaryAddr: () => void;

    // UTXO/TXCer detail modal functions
    showUtxoDetail: (addrKey: string, utxoKey: string) => void;
    showTxCerDetail: (addrKey: string, cerKey: string) => void;

    // UI functions
    showToast: (message: string, type?: string) => void;
    showSuccessToast: (message: string, title?: string) => void;
    showErrorToast: (message: string, title?: string) => void;
    showWarningToast: (message: string, title?: string) => void;
    showInfoToast: (message: string, title?: string) => void;
    showMiniToast: (message: string) => void;
    showUnifiedLoading: (message?: string) => void;
    showUnifiedSuccess: (title: string, text: string, onOk: Function, onCancel: Function, isError?: boolean) => void;
    hideUnifiedOverlay: () => void;
    showModalTip: (title: string, content: string, showClose?: boolean) => void;
    showConfirmModal: (title: string, message: string, onConfirm?: () => void, onCancel?: () => void) => void;
    copyToClipboard: (text: string) => Promise<boolean>;
    updateHeaderUser: (user: any) => void;

    // Page init functions
    initProfilePage: () => void;
    initWelcomePage: () => void;
    initEntryPage: () => void;
    initLoginPage: () => void;
    initNewUserPage: () => void;
    initImportPage: () => void;
    initMainPage: () => void;
    initJoinGroupPage: () => void;
    initGroupDetailPage: () => void;
    initHistoryPage: () => void;
    updateWelcomeButtons: () => void;
    resetLoginPageState: () => void;
    startInquiryAnimation: (onComplete: Function) => void;
    resetInquiryState: () => void;
    resetCreatingFlag: () => void;
    resetImportState: () => void;
    handleMainRoute: () => void;
    updateGroupDetailDisplay: () => void;
    resetHistoryPageState: () => void;

    // Chart functions
    updateWalletChart: (data: any) => void;
    initWalletChart: () => void;
    initWalletStructToggle: () => void;
    initTxDetailModal: () => void;
    updateWalletStruct: (wallet: any) => void;
    cleanupNetworkChart: () => void;

    // Transaction functions
    buildNewTX: (buildTXInfo: any, userAccount: any) => Promise<any>;
    exchangeRate: (amount: number, fromType: number, toType: number) => number;
    initTransferSubmit: () => void;
    initBuildTransaction: () => void;

    // Crypto functions
    bytesToHex: (bytes: Uint8Array) => string;
    hexToBytes: (hex: string) => Uint8Array;
    sha256: (data: Uint8Array | ArrayBuffer) => Promise<Uint8Array>;
    sha256Hex: (data: Uint8Array | ArrayBuffer) => Promise<string>;

    // Helper functions
    wait: (ms: number) => Promise<void>;

    // Security functions
    escapeHtml: (unsafe: string) => string;
    createElement: (tagName: string, className?: string, textContent?: string, attributes?: object) => HTMLElement;
    validateTransferAmount: (amount: string | number, options?: object) => { valid: boolean; value?: number; error?: string };
    validateAddress: (address: string, options?: object) => { valid: boolean; value?: string; error?: string };
    validatePrivateKey: (privateKey: string) => { valid: boolean; value?: string; error?: string };
    validateOrgId: (orgId: string, options?: object) => { valid: boolean; value?: string; error?: string };
    createSubmissionGuard: (key: string) => { isSubmitting: () => boolean; start: () => boolean; end: () => void };
    withSubmissionGuard: (key: string, fn: Function) => Function;
    fetchWithTimeout: (url: string, options?: object, timeout?: number) => Promise<Response>;
    fetchWithRetry: (url: string, options?: object, retries?: number, timeout?: number) => Promise<Response>;
    secureFetch: (url: string, options?: object) => Promise<Response>;
    secureFetchWithRetry: (url: string, options?: object, config?: object) => Promise<Response>;
    withErrorBoundary: (fn: Function, options?: object) => Function;
    reportError: (errorInfo: object) => void;

    // Performance functions
    performanceModeManager: any;
    scheduleBatchUpdate: (key: string, callback: Function) => void;
    flushBatchUpdates: () => void;
    clearBatchUpdates: () => void;
    rafDebounce: (fn: Function) => Function;
    rafThrottle: (fn: Function) => Function;

    // Event management functions
    debounce: (fn: Function, wait: number) => Function;
    throttle: (fn: Function, wait: number) => Function;
    delegate: (container: Element, selector: string, eventType: string, handler: Function) => Function;
    EventListenerManager: any;
    globalEventManager: any;
    createEventManager: () => any;
    cleanupPageListeners: () => void;

    // State management
    store: any;
    selectUser: (state: any) => any;
    selectRoute: (state: any) => string;
    selectTheme: (state: any) => string;
    selectLanguage: (state: any) => string;
    setUser: (user: any) => void;
    setRoute: (route: string) => void;
    setThemeState: (theme: string) => void;
    setLanguageState: (lang: string) => void;
    setLoading: (loading: boolean) => void;
    setModalOpen: (open: boolean) => void;

    // Key encryption functions
    encryptPrivateKey: (privateKeyHex: string, password: string) => Promise<{ encrypted: string; salt: string; iv: string }>;
    decryptPrivateKey: (encryptedHex: string, salt: string, iv: string, password: string) => Promise<string>;
    migrateToEncrypted: (user: any, password: string) => Promise<{ success: boolean; error?: string }>;
    clearLegacyKey: (user: any) => any;
    getPrivateKey: (accountId: string, password: string) => Promise<string>;
    verifyPassword: (accountId: string, password: string) => Promise<boolean>;
    changePassword: (accountId: string, oldPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
    checkEncryptionStatus: (user: any) => { needsMigration: boolean; isEncrypted: boolean };
    hasEncryptedKey: (accountId: string) => boolean;
    hasLegacyKey: (user: any) => boolean;

    // P2: Accessibility functions
    announce: (message: string, priority?: 'polite' | 'assertive') => void;
    setAriaLabel: (element: HTMLElement, label: string) => void;
    makeAccessibleButton: (element: HTMLElement, label: string) => void;

    // P2: Loading management functions
    loadingManager: any;
    showLoading: (message?: string) => void;
    hideLoading: () => void;
    withLoading: <T>(promise: Promise<T>, text?: string) => Promise<T>;
    showElementLoading: (element: HTMLElement) => void;
    hideElementLoading: (element: HTMLElement) => void;

    // P2: Form validation functions
    FormValidator: any;
    validators: any;
    addInlineValidation: (input: string | HTMLElement, rules: any[], options?: any) => () => void;

    // P2: Transaction/Rollback functions
    withTransaction: (operations: any[], options?: any) => Promise<any>;
    createCheckpoint: (id: string, keys: string[]) => any;
    restoreCheckpoint: (id: string) => boolean;
    enableFormAutoSave: (form: string | HTMLElement, formId: string, options?: any) => () => void;

    // P2: Lazy loading functions
    lazyLoader: {
      registerModule: (id: string, config: any) => void;
      loadModule: <T>(id: string) => Promise<T>;
      preloadModule: (id: string) => void;
      isModuleLoaded: (id: string) => boolean;
      clearCache: (id?: string) => void;
      registerPage: (route: string, loader: any) => void;
      loadPage: (route: string) => Promise<any>;
      preloadPage: (route: string) => void;
      init: () => void;
    };

    // P2: Enhanced Router functions
    addRouteGuard: (guard: any) => () => void;
    enhancedNavigateTo: (route: string, options?: any) => Promise<boolean>;
    configureTransition: (config: any) => void;

    // P2: Online status functions
    isOnline: () => boolean;
    onOnlineStatusChange: (callback: (online: boolean) => void) => () => void;
    
    // Internal cleanup functions
    _removeAuthGuard?: () => void;

    // Global cleanup function
    globalCleanup: () => void;

    // Internal binding flags
    _headerScrollBind?: boolean;
    _headerHashChangeBind?: boolean;
    _footerScrollBind?: boolean;
    _routerHashChangeBind?: boolean;
    _hashLinkNavBind?: boolean;
    _userMenuClickBind?: boolean;
    
    // Chart-related flags
    _chartIntervalSet?: boolean;
    _chartResizeListenerSet?: boolean;
    _cleanupChartInterval?: (() => void) | null;
    _chartObserver?: IntersectionObserver | null;
    _chartResizeHandler?: EventListener | null;
    
    // Network chart flags
    _networkChartObserver?: IntersectionObserver | null;
    _networkChartResizeHandler?: EventListener | null;
    
    // Performance monitor
    performanceMonitor?: any;
    
    // Elliptic library (external)
    elliptic?: {
      ec: any;
    };
  }
  
  // Extend Navigator for Network Information API
  interface Navigator {
    connection?: {
      downlink?: number;
      rtt?: number;
      effectiveType?: string;
    };
  }
  
  // Extend Performance for memory API (Chrome-specific)
  interface Performance {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
  }
  
  // Extend HTMLElement dataset for custom data attributes
  interface HTMLElement {
    dataset: DOMStringMap & {
      // Common binding flags
      _bind?: string;
      _walletBind?: string;
      _changeBind?: string;
      _buildBind?: string;
      _recipientBind?: string;
      // Data storage
      txData?: string;
      buildInfo?: string;
      addr?: string;
      key?: string;
      action?: string;
    };
  }
  
  // requestIdleCallback API (not in all browsers)
  interface Window {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
    cancelIdleCallback?: (handle: number) => void;
  }
  
  interface IdleRequestCallback {
    (deadline: IdleDeadline): void;
  }
  
  interface IdleDeadline {
    readonly didTimeout: boolean;
    timeRemaining(): number;
  }
  
  interface IdleRequestOptions {
    timeout?: number;
  }
}

// Make this a module (required for declare global to work)
export {};
