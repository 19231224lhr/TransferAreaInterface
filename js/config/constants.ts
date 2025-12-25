/**
 * Application Constants
 * 
 * Centralized configuration constants for the PanguPay application.
 * All storage keys, default values, and configuration objects are defined here.
 */

// ========================================
// Type Definitions
// ========================================

/** Coin type identifiers */
export type CoinTypeId = 0 | 1 | 2;

/** Guarantor group configuration */
export interface GuarantorGroup {
  groupID: string;
  aggreNode: string;
  assignNode: string;
  pledgeAddress: string;
  assignAPIEndpoint?: string;  // AssignNode HTTP API 端口 (如 ":8081")
  aggrAPIEndpoint?: string;    // AggrNode HTTP API 端口 (如 ":8082")
}

/** Coin information */
export interface CoinInfo {
  name: string;
  className: string;
  color: string;
  rate: number;
}

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
export const DEFAULT_GROUP: GuarantorGroup = {
  groupID: '10000000',
  aggreNode: '39012088',
  assignNode: '17770032',
  pledgeAddress: '5bd548d76dcb3f9db1d213db01464406bef5dd09',
  assignAPIEndpoint: ':8082',  // AssignNode 端口
  aggrAPIEndpoint: ':8082'     // AggrNode 端口（与 AssignNode 共用）
};

/** List of available guarantor organizations */
export const GROUP_LIST: GuarantorGroup[] = [DEFAULT_GROUP];

/** Base lift value for calculations */
export const BASE_LIFT = 20;

// ========================================
// Coin Types
// ========================================

/** Coin type identifiers */
export const COIN_TYPES = {
  PGC: 0 as const,
  BTC: 1 as const,
  ETH: 2 as const
};

/** Coin type names for display */
export const COIN_NAMES: Record<CoinTypeId, string> = {
  0: 'PGC',
  1: 'BTC',
  2: 'ETH'
};

/** Coin CSS class names (for styling) */
export const COIN_CLASSES: Record<CoinTypeId, string> = {
  0: 'pgc',
  1: 'btc',
  2: 'eth'
};

/** Coin display colors */
export const COIN_COLORS: Record<CoinTypeId, string> = {
  0: '#10b981', // PGC - green
  1: '#f59e0b', // BTC - orange
  2: '#3b82f6'  // ETH - blue
};

/** Coin conversion rates to PGC */
export const COIN_TO_PGC_RATES: Record<CoinTypeId, number> = {
  0: 1,        // PGC
  1: 1000000,  // BTC
  2: 1000      // ETH
};

/**
 * Get coin name by type ID
 * @param typeId - Coin type ID (0, 1, 2)
 * @returns Coin name ('PGC', 'BTC', 'ETH')
 */
export function getCoinName(typeId: number): string {
  return COIN_NAMES[typeId as CoinTypeId] || 'PGC';
}

/**
 * Get coin CSS class by type ID
 * @param typeId - Coin type ID (0, 1, 2)
 * @returns CSS class name ('pgc', 'btc', 'eth')
 */
export function getCoinClass(typeId: number): string {
  return COIN_CLASSES[typeId as CoinTypeId] || 'pgc';
}

/**
 * Get coin color by type ID
 * @param typeId - Coin type ID (0, 1, 2)
 * @returns Hex color code
 */
export function getCoinColor(typeId: number): string {
  return COIN_COLORS[typeId as CoinTypeId] || COIN_COLORS[0];
}

/**
 * Convert amount to PGC equivalent
 * @param amount - Amount in original coin
 * @param typeId - Coin type ID (0, 1, 2)
 * @returns Amount in PGC equivalent
 */
export function convertToPGC(amount: number, typeId: number): number {
  const rate = COIN_TO_PGC_RATES[typeId as CoinTypeId] || 1;
  return amount * rate;
}

/**
 * Get coin info object with all properties
 * @param typeId - Coin type ID (0, 1, 2)
 * @returns Coin information object
 */
export function getCoinInfo(typeId: number): CoinInfo {
  return {
    name: getCoinName(typeId),
    className: getCoinClass(typeId),
    color: getCoinColor(typeId),
    rate: COIN_TO_PGC_RATES[typeId as CoinTypeId] || 1
  };
}

// ========================================
// Exchange Rates
// ========================================

/** Exchange rates to USDT */
export const EXCHANGE_RATES = {
  PGC_TO_USDT: 1,
  BTC_TO_USDT: 100,
  ETH_TO_USDT: 10
} as const;

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
  HISTORY: '/history',
  NEXT: '/next'
} as const;

/** Routes that don't require user login */
export const PUBLIC_ROUTES: string[] = ['/welcome', '/login', '/new', '/profile'];

// ========================================
// Card Element IDs
// ========================================

/** Mapping of routes to card element IDs */
export const ROUTE_CARD_MAP: Record<string, string> = {
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
  '/history': 'historyCard'
};
