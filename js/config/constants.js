/**
 * Application Constants
 * 
 * Centralized configuration constants for the UTXO Wallet application.
 * All storage keys, default values, and configuration objects are defined here.
 */

// ========================================
// Storage Keys
// ========================================

/** LocalStorage key for wallet account data */
export const STORAGE_KEY = 'walletAccount';

/** LocalStorage key for language preference */
export const I18N_STORAGE_KEY = 'appLanguage';

/** LocalStorage key for theme preference */
export const THEME_STORAGE_KEY = 'appTheme';

/** LocalStorage key for user profile (avatar, nickname, signature) */
export const PROFILE_STORAGE_KEY = 'userProfile';

/** LocalStorage key for guarantor organization choice */
export const GUAR_CHOICE_KEY = 'guarChoice';

// ========================================
// Default Values
// ========================================

/** Default guarantor organization configuration */
export const DEFAULT_GROUP = {
  groupID: '10000000',
  aggreNode: '39012088',
  assignNode: '17770032',
  pledgeAddress: '5bd548d76dcb3f9db1d213db01464406bef5dd09'
};

/** List of available guarantor organizations */
export const GROUP_LIST = [DEFAULT_GROUP];

/** Base lift value for calculations */
export const BASE_LIFT = 20;

// ========================================
// Coin Types
// ========================================

/** Coin type identifiers */
export const COIN_TYPES = {
  PGC: 0,
  BTC: 1,
  ETH: 2
};

/** Coin type names for display */
export const COIN_NAMES = {
  0: 'PGC',
  1: 'BTC',
  2: 'ETH'
};


// ========================================
// Exchange Rates
// ========================================

/** Exchange rates to USDT */
export const EXCHANGE_RATES = {
  PGC_TO_USDT: 1,
  BTC_TO_USDT: 100,
  ETH_TO_USDT: 10
};

// ========================================
// Validation Constants
// ========================================

/** Maximum nickname length */
export const MAX_NICKNAME_LENGTH = 20;

/** Maximum signature/bio length */
export const MAX_SIGNATURE_LENGTH = 50;

/** Private key hex length (without 0x prefix) */
export const PRIVATE_KEY_HEX_LENGTH = 64;

/** Address hex length */
export const ADDRESS_HEX_LENGTH = 40;

// ========================================
// Route Paths
// ========================================

/** Application routes */
export const ROUTES = {
  WELCOME: '/welcome',
  ENTRY: '/entry',
  NEW: '/new',
  LOGIN: '/login',
  IMPORT: '/import',
  WALLET_IMPORT: '/wallet-import',
  MAIN: '/main',
  JOIN_GROUP: '/join-group',
  GROUP_DETAIL: '/group-detail',
  PROFILE: '/profile',
  INQUIRY: '/inquiry',
  INQUIRY_MAIN: '/inquiry-main',
  MEMBER_INFO: '/member-info',
  IMPORT_NEXT: '/import-next',
  NEXT: '/next'
};

/** Routes that don't require user login */
export const PUBLIC_ROUTES = ['/welcome', '/login', '/new', '/profile'];

// ========================================
// Card Element IDs
// ========================================

/** Mapping of routes to card element IDs */
export const ROUTE_CARD_MAP = {
  '/welcome': 'welcomeCard',
  '/entry': 'entryCard',
  '/new': 'newUserCard',
  '/login': 'loginCard',
  '/import': 'importCard',
  '/wallet-import': 'importCard',
  '/main': 'walletCard',
  '/join-group': 'nextCard',
  '/group-detail': 'groupDetailCard',
  '/profile': 'profileCard',
  '/inquiry': 'inquiryCard',
  '/inquiry-main': 'inquiryCard',
  '/member-info': 'memberInfoCard',
  '/import-next': 'importNextCard'
};
