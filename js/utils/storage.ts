/**
 * Storage Utility Functions
 * 
 * Provides localStorage operations for accounts, profiles, and organization data.
 * 
 * @module utils/storage
 */

import { 
  STORAGE_KEY, 
  PROFILE_STORAGE_KEY, 
  GUAR_CHOICE_KEY,
  DEFAULT_GROUP,
  GROUP_LIST,
  GuarantorGroup
} from '../config/constants';
import { store, setUser, selectUser } from './store.js';
import { UTXOData } from '../types/blockchain';

// ========================================
// Type Definitions
// ========================================

/** Wallet keys structure */
export interface WalletKeys {
  privHex: string;
  pubXHex: string;
  pubYHex: string;
}

/** Address value structure */
export interface AddressValue {
  totalValue: number;
  TotalValue?: number;
  utxoValue: number;
  txCerValue: number;
}

/** Address data structure with strict UTXO typing */
export interface AddressData {
  type: number;
  utxos: Record<string, UTXOData>;  // Strict UTXO type instead of 'any'
  txCers: Record<string, number>;   // TXCer ID -> value mapping
  value: AddressValue;
  estInterest: number;
  gas?: number;
  origin?: string;
  privHex?: string;
  pubXHex?: string;
  pubYHex?: string;
  /** Whether address is locked (external import without private key) */
  locked?: boolean;
  /** Public key from backend (for external addresses) */
  publicKeyNew?: {
    CurveName: string;
    X: number;
    Y: number;
  };
}

/** Wallet history record */
export interface HistoryRecord {
  t: number;
  v: number;
}

/** Wallet structure with strict typing */
export interface Wallet {
  addressMsg: Record<string, AddressData>;
  totalTXCers: Record<string, number>;  // TXCer ID -> value mapping
  totalValue: number;
  TotalValue?: number;
  valueDivision: Record<number, number>;
  ValueDivision?: Record<number, number>;
  updateTime: number;
  updateBlock: number;
  history?: HistoryRecord[];
}

/** User account structure */
export interface User {
  accountId: string;
  address: string;
  orgNumber: string;
  flowOrigin: string;
  keys: WalletKeys;
  wallet: Wallet;
  privHex?: string;
  pubXHex?: string;
  pubYHex?: string;
  /** Guarantor group info - undefined means not joined */
  guarGroup?: GuarantorGroup;
  /** Entry source: 'login' | 'new' - tracks how user entered the app */
  entrySource?: string;
  /** Whether user is in a guarantor group */
  isInGroup?: boolean;
  /** Complete guarantor group boot message from backend */
  guarGroupBootMsg?: any;
}

/** User profile structure */
export interface UserProfile {
  nickname: string;
  avatar: string | null;
  signature: string;
}

/** Guarantor choice structure */
export interface GuarChoice {
  groupID: string;
}

// ========================================
// Account Data
// ========================================

/**
 * Convert basic account info to full account structure
 * @param basic - Basic account info
 * @param prev - Previous account data (for merging)
 * @returns Full account structure
 */
export function toAccount(basic: Partial<User>, prev: User | null): User {
  const isSame = prev && prev.accountId && basic && basic.accountId && 
                 prev.accountId === basic.accountId;
  const acc: any = isSame ? (prev ? JSON.parse(JSON.stringify(prev)) : {}) : {};
  
  acc.accountId = basic.accountId || acc.accountId || '';
  acc.orgNumber = (basic.orgNumber !== undefined ? basic.orgNumber : (acc.orgNumber || ''));
  acc.flowOrigin = basic.flowOrigin || acc.flowOrigin || '';

  if (basic.guarGroup !== undefined) {
    acc.guarGroup = basic.guarGroup;
  }
  
  // Handle new fields for login tracking
  if (basic.entrySource !== undefined) {
    acc.entrySource = basic.entrySource;
  }
  if (basic.isInGroup !== undefined) {
    acc.isInGroup = basic.isInGroup;
  }
  if (basic.guarGroupBootMsg !== undefined) {
    acc.guarGroupBootMsg = basic.guarGroupBootMsg;
  }
  
  acc.keys = acc.keys || { privHex: '', pubXHex: '', pubYHex: '' };
  acc.keys.privHex = basic.privHex || acc.keys.privHex || '';
  acc.keys.pubXHex = basic.pubXHex || acc.keys.pubXHex || '';
  acc.keys.pubYHex = basic.pubYHex || acc.keys.pubYHex || '';
  
  acc.wallet = acc.wallet || { 
    addressMsg: {}, 
    totalTXCers: {}, 
    totalValue: 0, 
    valueDivision: { 0: 0, 1: 0, 2: 0 }, 
    updateTime: Date.now(), 
    updateBlock: 0 
  };
  acc.wallet.addressMsg = acc.wallet.addressMsg || {};
  
  const mainAddr = basic.address || acc.address || '';
  if (mainAddr) {
    acc.address = mainAddr;
    delete acc.wallet.addressMsg[mainAddr];
  }

  // Backward-compat: allow legacy top-level key fields to be merged
  if (basic.privHex !== undefined && basic.privHex) acc.privHex = basic.privHex;
  if (basic.pubXHex !== undefined && basic.pubXHex) acc.pubXHex = basic.pubXHex;
  if (basic.pubYHex !== undefined && basic.pubYHex) acc.pubYHex = basic.pubYHex;
  
  if (basic.wallet) {
    if (basic.wallet.addressMsg !== undefined) {
      acc.wallet.addressMsg = { ...basic.wallet.addressMsg };
    }
    if (basic.wallet.valueDivision) {
      acc.wallet.valueDivision = { ...basic.wallet.valueDivision };
    }
    if (basic.wallet.totalValue !== undefined) {
      acc.wallet.totalValue = basic.wallet.totalValue;
    }
    // Handle PascalCase version for backward compatibility with backend API
    if (basic.wallet.TotalValue !== undefined) {
      acc.wallet.TotalValue = basic.wallet.TotalValue;
    }
    if (basic.wallet.history) {
      acc.wallet.history = [...basic.wallet.history];
    }
  }
  
  return acc as User;
}

// ========================================
// Internal: Pure localStorage IO (no Store side effects)
// ========================================

function readUserFromStorage(): User | null {
  try {
    const rawAcc = localStorage.getItem(STORAGE_KEY);
    if (rawAcc) {
      return JSON.parse(rawAcc) as User;
    }

    // Try legacy storage key
    const legacy = localStorage.getItem('walletUser');
    if (legacy) {
      const basic = JSON.parse(legacy);
      const acc = toAccount(basic, null);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(acc));
      } catch {
        // ignore
      }
      return acc;
    }
  } catch (e) {
    console.warn('Failed to read user data from storage', e);
  }

  return null;
}

function writeUserToStorage(user: User | null): void {
  try {
    if (!user) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('walletUser');
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    // Remove legacy to avoid split-brain
    try {
      localStorage.removeItem('walletUser');
    } catch {
      // ignore
    }
  } catch (e) {
    console.warn('Failed to write user data to storage', e);
  }
}

// ========================================
// Store-first Public API
// ========================================

/**
 * Initialize in-memory state from localStorage once at app startup.
 * After this, Store becomes the single source of truth.
 */
export function initUserStateFromStorage(): User | null {
  const user = readUserFromStorage();
  setUser(user);
  return user;
}

/**
 * Persist the given user snapshot to localStorage.
 * This is intended to be called as a Store change side effect.
 */
export function persistUserToStorage(user: User | null): void {
  writeUserToStorage(user);
}

/**
 * Load user account from localStorage
 * @returns User account data or null if not found
 */
export function loadUser(): User | null {
  return (selectUser(store.getState()) as User | null) || null;
}

/**
 * Save user account to localStorage
 * @param user - User account data to save
 */
export function saveUser(user: Partial<User>): void {
  try {
    const prev = loadUser();
    const acc = toAccount(user, prev);

    // Initialize wallet history if needed
    // Note: toAccount() always initializes wallet, but we keep this check for safety
    if (!acc.wallet) {
      acc.wallet = { 
        addressMsg: {}, 
        totalTXCers: {}, 
        totalValue: 0, 
        valueDivision: { 0: 0, 1: 0, 2: 0 }, 
        updateTime: Date.now(), 
        updateBlock: 0 
      };
    }
    if (!acc.wallet.history) acc.wallet.history = [];

    // Calculate current total assets (USDT)
    const vd = acc.wallet.valueDivision || { 0: 0, 1: 0, 2: 0 };
    const pgc = Number(vd[0] || 0);
    const btc = Number(vd[1] || 0);
    const eth = Number(vd[2] || 0);
    const totalUsdt = Math.round(pgc * 1 + btc * 100 + eth * 10);

    const now = Date.now();
    const last = acc.wallet.history[acc.wallet.history.length - 1];

    // Add new record if value changed or time > 1 minute, or if it's the first record
    if (!last || last.v !== totalUsdt || (now - last.t > 60000)) {
      acc.wallet.history.push({ t: now, v: totalUsdt });
      // Limit history length to last 100 records
      if (acc.wallet.history.length > 100) {
        acc.wallet.history = acc.wallet.history.slice(-100);
      }
    }

    // Store is the single source of truth; persistence is handled by a Store subscription side effect.
    setUser(acc);
  } catch (e) {
    console.warn('Failed to save user data', e);
  }
}

/**
 * Clear account storage
 */
export function clearAccountStorage(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { }
  try { localStorage.removeItem('walletUser'); } catch { }
  try { localStorage.removeItem(PROFILE_STORAGE_KEY); } catch { }
  try { localStorage.removeItem('guarChoice'); } catch { }
  
  // Sync to centralized store for state management
  setUser(null);
}

// ========================================
// User Profile
// ========================================

/**
 * Load user profile (avatar, nickname, signature)
 * @returns Profile data with defaults
 */
export function loadUserProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as UserProfile;
  } catch (e) {
    console.warn('Failed to load profile', e);
  }
  return { nickname: '', avatar: null, signature: '' };
}

/**
 * Save user profile
 * @param profile - Profile data to save
 */
export function saveUserProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.warn('Failed to save profile', e);
  }
}

// ========================================
// Guarantor Organization
// ========================================

/**
 * Get the joined guarantor organization
 * @returns Joined group or null
 */
export function getJoinedGroup(): GuarantorGroup | null {
  try {
    const raw = localStorage.getItem(GUAR_CHOICE_KEY);
    if (raw) {
      const c = JSON.parse(raw) as GuarChoice;
      if (c && c.groupID) {
        const g = Array.isArray(GROUP_LIST) 
          ? GROUP_LIST.find(x => x.groupID === c.groupID) 
          : null;
        return g || DEFAULT_GROUP;
      }
    }
  } catch { }
  
  const u = loadUser();
  const gid = u && (u.orgNumber || (u.guarGroup && u.guarGroup.groupID));
  if (gid) {
    const g = Array.isArray(GROUP_LIST) 
      ? GROUP_LIST.find(x => x.groupID === gid) 
      : null;
    return g || DEFAULT_GROUP;
  }
  return null;
}

/**
 * Save guarantor organization choice
 * @param choice - Organization choice to save
 */
export function saveGuarChoice(choice: GuarChoice): void {
  try {
    localStorage.setItem(GUAR_CHOICE_KEY, JSON.stringify(choice));
  } catch (e) {
    console.warn('Failed to save organization choice', e);
  }
}

/**
 * Clear guarantor organization choice
 */
export function clearGuarChoice(): void {
  try {
    localStorage.removeItem(GUAR_CHOICE_KEY);
  } catch { }
}

/**
 * Reset organization selection for new user
 * Clears local organization data and updates user state
 * @returns Whether any data was changed
 */
export function resetOrgSelectionForNewUser(): boolean {
  let changed = false;
  
  try {
    if (localStorage.getItem(GUAR_CHOICE_KEY)) {
      localStorage.removeItem(GUAR_CHOICE_KEY);
      changed = true;
    }
  } catch (_) { }
  
  const current = loadUser();
  if (current && (current.orgNumber || current.guarGroup)) {
    const next = { ...current, orgNumber: '', guarGroup: undefined } as User;
    setUser(next);
    changed = true;
  }
  
  return changed;
}

/**
 * Compute current organization ID from user data
 * @returns Organization ID or empty string
 */
export function computeCurrentOrgId(): string {
  const group = getJoinedGroup();
  return group ? group.groupID : '';
}
