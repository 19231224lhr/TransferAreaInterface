/**
 * PanguPay Core Types
 * 
 * Type definitions for the PanguPay namespace and related structures.
 * 
 * @module core/types
 */

import type { EventListenerManager } from '../utils/eventUtils';
import type { FormValidator } from '../utils/formValidator';

// ============================================
// Namespace Sub-interfaces
// ============================================

/** Router namespace */
export interface RouterNamespace {
  routeTo: (route: string) => void;
  showCard: (cardId: string) => void;
  router: () => void;
  navigateTo: (path: string, options?: { replace?: boolean }) => Promise<boolean>;
  addRouteGuard: (guard: (to: string, from: string) => boolean | Promise<boolean>) => () => void;
  configureTransition: (config: { duration?: number; easing?: string }) => void;
}

/** i18n namespace */
export interface I18nNamespace {
  t: (key: string, params?: Record<string, string | number>) => string;
  setLanguage: (lang: string) => void;
  getCurrentLanguage: () => string;
  updatePageTranslations: () => void;
}

/** Theme namespace */
export interface ThemeNamespace {
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleTheme: () => void;
  refreshSrcAddrList: () => void;
  getCurrentTheme: () => string;
}

/** Account namespace */
export interface AccountNamespace {
  newUser: () => Promise<any>;
  importFromPrivHex: (privHex: string) => Promise<any>;
  addNewSubWallet: (type?: number) => Promise<void>;
  handleCreate: () => Promise<void>;
}

/** Storage namespace */
export interface StorageNamespace {
  loadUser: () => any;
  saveUser: (user: any) => void;
  toAccount: (basic: any) => any;
  clearAccountStorage: () => void;
  loadUserProfile: () => any;
  saveUserProfile: (profile: any) => void;
  getJoinedGroup: () => any;
  resetOrgSelectionForNewUser: () => void;
}

/** Wallet namespace */
export interface WalletNamespace {
  renderWallet: () => void;
  updateWalletBrief: () => void;
  refreshOrgPanel: () => void;
  refreshSrcAddrList: () => void;
  handleAddToAddress: (addr: string) => Promise<void>;
  handleZeroAddress: () => void;
  initAddressModal: () => void;
  showAddrModal: (mode: 'create' | 'import') => void;
  hideAddrModal: () => void;
  initTransferModeTabs: () => void;
  rebuildAddrList: () => void;
  initRefreshSrcAddrList: () => void;
  initChangeAddressSelects: () => void;
  initRecipientCards: () => void;
  initAdvancedOptions: () => void;
  showUtxoDetail: (addrKey: string, utxoKey: string) => void;
  showTxCerDetail: (addrKey: string, cerKey: string) => void;
}

/** UI namespace */
export interface UINamespace {
  showToast: (message: string, type?: string, duration?: number) => void;
  showSuccessToast: (message: string, title?: string) => void;
  showErrorToast: (message: string, title?: string) => void;
  showWarningToast: (message: string, title?: string) => void;
  showInfoToast: (message: string, title?: string) => void;
  showMiniToast: (message: string, type?: string) => void;
  showUnifiedLoading: (text?: string) => void;
  showUnifiedSuccess: (title?: string, text?: string, callback?: () => void, onCancel?: (() => void) | null, isError?: boolean) => void;
  hideUnifiedOverlay: () => void;
  showModalTip: (title: string, content: string, isError?: boolean) => void;
  copyToClipboard: (text: string) => Promise<boolean>;
  updateHeaderUser: (user?: any) => void;
  announce: (message: string) => void;
  setAriaLabel: (element: HTMLElement, label: string) => void;
  makeAccessibleButton: (element: HTMLElement, label?: string) => void;
  showLoading: (text?: string) => string;
  hideLoading: (id?: string) => void;
  withLoading: <T>(fn: () => T | Promise<T>, text?: string) => Promise<T>;
  showElementLoading: (element: HTMLElement, text?: string) => void;
  hideElementLoading: (element: HTMLElement) => void;
}

/** Charts namespace */
export interface ChartsNamespace {
  updateWalletChart: (user?: any) => void;
  initWalletChart: () => void;
  initWalletStructToggle: () => void;
  initTxDetailModal: () => void;
  updateWalletStruct: () => void;
  cleanupWalletChart: () => void;
  cleanupNetworkChart: () => void;
}

/** Transaction namespace */
export interface TransactionNamespace {
  buildNewTX: (params: any) => Promise<any>;
  exchangeRate: number;
  initTransferSubmit: () => void;
  initBuildTransaction: () => void;
}

/** Crypto namespace */
export interface CryptoNamespace {
  bytesToHex: (bytes: Uint8Array) => string;
  hexToBytes: (hex: string) => Uint8Array;
  sha256: (data: Uint8Array) => Promise<Uint8Array>;
  sha256Hex: (data: string) => Promise<string>;
  encryptPrivateKey: (privateKey: string, password: string) => Promise<string>;
  decryptPrivateKey: (encrypted: string, password: string) => Promise<string>;
  migrateToEncrypted: (password: string) => Promise<boolean>;
  clearLegacyKey: () => void;
  getPrivateKey: () => string | null;
  verifyPassword: (password: string) => Promise<boolean>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
  checkEncryptionStatus: () => { hasEncrypted: boolean; hasLegacy: boolean };
  hasEncryptedKey: () => boolean;
  hasLegacyKey: () => boolean;
  showPasswordPrompt: (options?: { title?: string }) => Promise<string | null>;
  encryptAndSavePrivateKey: (privateKey: string, password: string) => Promise<boolean>;
  getDecryptedPrivateKey: () => Promise<string | null>;
  checkAndPromptMigration: () => Promise<boolean>;
  saveUserWithEncryption: (user: any, password?: string) => Promise<boolean>;
}

/** Utils namespace */
export interface UtilsNamespace {
  wait: (ms: number) => Promise<void>;
  escapeHtml: (str: string) => string;
  createElement: (tag: string, attrs?: Record<string, string>, children?: (HTMLElement | string)[]) => HTMLElement;
  validateTransferAmount: (amount: string) => { valid: boolean; error?: string };
  validateAddress: (address: string) => { valid: boolean; error?: string };
  validatePrivateKey: (key: string) => { valid: boolean; error?: string };
  validateOrgId: (orgId: string) => { valid: boolean; error?: string };
  createSubmissionGuard: () => { check: () => boolean; release: () => void };
  withSubmissionGuard: <T>(fn: () => T | Promise<T>) => Promise<T>;
  fetchWithTimeout: (url: string, options?: RequestInit, timeout?: number) => Promise<Response>;
  fetchWithRetry: (url: string, options?: RequestInit, retries?: number) => Promise<Response>;
  secureFetch: (url: string, options?: RequestInit) => Promise<Response>;
  secureFetchWithRetry: (url: string, options?: RequestInit, retries?: number) => Promise<Response>;
  withErrorBoundary: <T extends (...args: any[]) => any>(fn: T) => T;
  reportError: (error: Error, context?: string) => void;
  debounce: <T extends (...args: any[]) => any>(fn: T, delay: number) => T;
  throttle: <T extends (...args: any[]) => any>(fn: T, delay: number) => T;
  delegate: (container: HTMLElement, selector: string, event: string, handler: (e: Event, target: HTMLElement) => void) => () => void;
}

/** Performance namespace */
export interface PerformanceNamespace {
  scheduleBatchUpdate: (callback: () => void) => void;
  flushBatchUpdates: () => void;
  clearBatchUpdates: () => void;
  rafDebounce: <T extends (...args: any[]) => any>(fn: T) => T;
  rafThrottle: <T extends (...args: any[]) => any>(fn: T) => T;
}

/** Events namespace */
export interface EventsNamespace {
  globalEventManager: EventListenerManager;
  createEventManager: () => EventListenerManager;
  cleanupPageListeners: () => void;
}

/** State namespace */
export interface StateNamespace {
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
}

/** Form namespace */
export interface FormNamespace {
  FormValidator: typeof FormValidator;
  validators: Record<string, (value: string) => boolean | string>;
  addInlineValidation: (input: HTMLInputElement, validator: (value: string) => boolean | string) => () => void;
  withTransaction: <T>(fn: () => T | Promise<T>) => Promise<T>;
  createCheckpoint: () => string;
  restoreCheckpoint: (checkpointId: string) => boolean;
  enableFormAutoSave: (formId: string) => () => void;
}

/** Screen lock namespace */
export interface ScreenLockNamespace {
  initScreenLock: () => void;
  lockScreen: () => void;
  unlockScreen: () => boolean;
  isScreenLocked: () => boolean;
}

/** Template namespace */
export interface TemplateNamespace {
  templateLoader: any;
  pageManager: any;
  getPageConfig: (pageId: string) => any;
  getAllContainerIds: () => string[];
  lazyLoader: any;
}

/** Network namespace */
export interface NetworkNamespace {
  isOnline: () => boolean;
  onOnlineStatusChange: (callback: (online: boolean) => void) => () => void;
  checkForUpdates: () => Promise<void>;
}

/** Pages namespace */
export interface PagesNamespace {
  initWelcomePage: () => Promise<void>;
  initEntryPage: () => Promise<void>;
  initLoginPage: () => Promise<void>;
  initNewUserPage: () => Promise<void>;
  initSetPasswordPage: () => Promise<void>;
  initImportPage: () => Promise<void>;
  initMainPage: () => Promise<void>;
  initJoinGroupPage: () => Promise<void>;
  initProfilePage: () => Promise<void>;
  initGroupDetailPage: () => Promise<void>;
  initHistoryPage: () => Promise<void>;
  updateWelcomeButtons: () => Promise<void>;
  resetLoginPageState: () => Promise<void>;
  startInquiryAnimation: () => Promise<void>;
  resetInquiryState: () => Promise<void>;
  resetCreatingFlag: () => Promise<void>;
  resetImportState: () => Promise<void>;
  handleMainRoute: () => Promise<void>;
  updateGroupDetailDisplay: () => Promise<void>;
}

// ============================================
// Main PanguPay Namespace
// ============================================

/**
 * The complete PanguPay namespace interface.
 * All public APIs are organized under this namespace.
 */
export interface PanguPayNamespace {
  // Namespaced APIs
  router: RouterNamespace;
  i18n: I18nNamespace;
  theme: ThemeNamespace;
  account: AccountNamespace;
  storage: StorageNamespace;
  wallet: WalletNamespace;
  ui: UINamespace;
  charts: ChartsNamespace;
  transaction: TransactionNamespace;
  crypto: CryptoNamespace;
  utils: UtilsNamespace;
  performance: PerformanceNamespace;
  events: EventsNamespace;
  state: StateNamespace;
  form: FormNamespace;
  screenLock: ScreenLockNamespace;
  template: TemplateNamespace;
  network: NetworkNamespace;
  pages: PagesNamespace;
  
  // Version info
  version: string;
}

// ============================================
// Window Extension
// ============================================

declare global {
  interface Window {
    /** PanguPay centralized namespace */
    PanguPay: PanguPayNamespace;
  }
}
