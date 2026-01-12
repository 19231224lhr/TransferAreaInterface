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
  ACTIVE_ACCOUNT_KEY,
  getUserStorageKey,
  getUserProfileKey,
  getGuarChoiceKey,
  SESSION_IGNORE_USER_KEY,
  DEFAULT_GROUP,
  GROUP_LIST,
  GuarantorGroup
} from '../config/constants';
import { store, setUser, selectUser } from './store.js';
import { UTXOData, TxCertificate } from '../types/blockchain';

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

/** Transaction history record */
export interface TxHistoryRecord {
  id: string;
  type: 'send' | 'receive';
  status: 'success' | 'pending' | 'failed';
  transferMode?: 'normal' | 'quick' | 'cross' | 'incoming' | 'unknown';
  amount: number;
  currency: string;
  from: string;
  to: string;
  timestamp: number;
  txHash: string;
  gas: number;
  guarantorOrg?: string;
  blockNumber?: number;
  confirmations?: number;
  failureReason?: string;
}

/** Wallet structure with strict typing */
export interface Wallet {
  addressMsg: Record<string, AddressData>;
  totalTXCers: Record<string, TxCertificate>;  // TXCer ID -> full TXCer object (needed for signing)
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
  txHistory?: TxHistoryRecord[];
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
  /** Whether main-page address registration has been attempted */
  mainAddressRegistered?: boolean;
}

/** User profile structure */
export interface UserProfile {
  nickname: string;
  avatar: string | null;
  signature: string;
}

/** Guarantor choice structure - stores the user's organization selection */
export interface GuarChoice {
  groupID: string;
  /** Optional: full group info from backend (for backward compatibility, may not exist in old data) */
  aggreNode?: string;
  assignNode?: string;
  pledgeAddress?: string;
  assignAPIEndpoint?: string;
  aggrAPIEndpoint?: string;
  assignNodeUrl?: string;
  aggrNodeUrl?: string;
  type?: string;  // 'join' | 'leave'
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
  if (basic.mainAddressRegistered !== undefined) {
    acc.mainAddressRegistered = basic.mainAddressRegistered;
  }
  if (basic.txHistory !== undefined) {
    acc.txHistory = Array.isArray(basic.txHistory) ? [...basic.txHistory] : basic.txHistory;
    console.debug('[Storage/toAccount] Setting txHistory from basic:', basic.txHistory?.length, 'records');
  } else if (acc.txHistory !== undefined) {
    console.debug('[Storage/toAccount] Preserving txHistory from prev:', acc.txHistory?.length, 'records');
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

/**
 * Get the current active account ID
 */
function getActiveAccountId(): string | null {
  try {
    // Check session isolation flag
    if (sessionStorage.getItem(SESSION_IGNORE_USER_KEY) === 'true') {
      return null;
    }
    return localStorage.getItem(ACTIVE_ACCOUNT_KEY);
  } catch {
    return null;
  }
}

/**
 * Check if there is a stored user in localStorage, ignoring session flags.
 * Used for "Welcome Back" detection.
 */
export function hasStoredUser(): boolean {
  try {
    return !!localStorage.getItem(ACTIVE_ACCOUNT_KEY);
  } catch {
    return false;
  }
}

/**
 * Set session ignore flag to isolate this tab from logged-in user
 */
export function setSessionIgnoreUser(ignore: boolean): void {
  try {
    if (ignore) {
      sessionStorage.setItem(SESSION_IGNORE_USER_KEY, 'true');
      // If we are ignoring the user, we should also clear the Store's user state
      // to trigger UI updates immediately
      setUser(null);
    } else {
      sessionStorage.removeItem(SESSION_IGNORE_USER_KEY);
    }
  } catch {
    // ignore
  }
}

/**
 * Set the current active account ID
 */
function setActiveAccountId(accountId: string | null): void {
  try {
    if (accountId) {
      localStorage.setItem(ACTIVE_ACCOUNT_KEY, accountId);
    } else {
      localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
    }
  } catch (e) {
    console.warn('Failed to set active account ID', e);
  }
}

function readUserFromStorage(): User | null {
  const activeId = getActiveAccountId();
  if (!activeId) {
    // Try legacy migration
    return migrateLegacyUser();
  }

  try {
    const key = getUserStorageKey(activeId);
    const rawAcc = localStorage.getItem(key);
    if (rawAcc) {
      return JSON.parse(rawAcc) as User;
    }
  } catch (e) {
    console.warn('Failed to read user data from storage', e);
  }

  return null;
}

/**
 * Migrate legacy single-user data to accountId-based storage
 */
function migrateLegacyUser(): User | null {
  try {
    // Check for old walletAccount key (non-suffixed)
    const rawAcc = localStorage.getItem(STORAGE_KEY);
    if (rawAcc) {
      const user = JSON.parse(rawAcc) as User;
      if (user.accountId) {
        console.info('[Storage] Migrating legacy user data for accountId:', user.accountId);

        // Save to new accountId-specific key
        const newKey = getUserStorageKey(user.accountId);
        localStorage.setItem(newKey, rawAcc);
        localStorage.removeItem(STORAGE_KEY);
        setActiveAccountId(user.accountId);

        // Migrate profile data
        const rawProfile = localStorage.getItem(PROFILE_STORAGE_KEY);
        if (rawProfile) {
          const newProfileKey = getUserProfileKey(user.accountId);
          localStorage.setItem(newProfileKey, rawProfile);
          localStorage.removeItem(PROFILE_STORAGE_KEY);
        }

        // Migrate guarantor choice
        const rawChoice = localStorage.getItem(GUAR_CHOICE_KEY);
        if (rawChoice) {
          const newChoiceKey = getGuarChoiceKey(user.accountId);
          localStorage.setItem(newChoiceKey, rawChoice);
          localStorage.removeItem(GUAR_CHOICE_KEY);
        }

        console.info('[Storage] Legacy data migration completed');
        return user;
      }
    }

    // Try legacy walletUser key
    const legacy = localStorage.getItem('walletUser');
    if (legacy) {
      const basic = JSON.parse(legacy);
      const acc = toAccount(basic, null);
      if (acc.accountId) {
        const newKey = getUserStorageKey(acc.accountId);
        localStorage.setItem(newKey, JSON.stringify(acc));
        localStorage.removeItem('walletUser');
        setActiveAccountId(acc.accountId);
        return acc;
      }
    }
  } catch (e) {
    console.warn('Failed to migrate legacy user data', e);
  }

  return null;
}

function writeUserToStorage(user: User | null): void {
  try {
    if (!user || !user.accountId) {
      // Clear current active user data
      const activeId = getActiveAccountId();
      if (activeId) {
        const key = getUserStorageKey(activeId);
        localStorage.removeItem(key);
      }
      setActiveAccountId(null);
      return;
    }

    // Save to accountId-specific key
    const key = getUserStorageKey(user.accountId);
    localStorage.setItem(key, JSON.stringify(user));
    setActiveAccountId(user.accountId);
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
 * 
 * IMPORTANT: TXCer data is NOT persisted because it is temporary state.
 * TXCers are received in real-time via SSE and will be converted to UTXOs.
 * The blockchain StoragePoint (UTXO data) is the only source of truth for permanent balances.
 */
export function initUserStateFromStorage(): User | null {
  const user = readUserFromStorage();

  // Clear stale TXCer data - TXCers should only be received via real-time SSE
  // This prevents "ghost" TXCers from reappearing after page refresh
  if (user?.wallet) {
    // Clear totalTXCers at wallet level
    user.wallet.totalTXCers = {};

    // Clear txCers from each address
    if (user.wallet.addressMsg) {
      for (const addr of Object.keys(user.wallet.addressMsg)) {
        const addrData = user.wallet.addressMsg[addr];
        if (addrData) {
          addrData.txCers = {};
          // Also reset txCerValue in value breakdown
          if (addrData.value) {
            addrData.value.txCerValue = 0;
          }
        }
      }
    }

    console.info('[Storage] Cleared stale TXCer data on startup. TXCers will be received via SSE.');
  }

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
  const user = (selectUser(store.getState()) as User | null) || null;
  if (user) {
    console.debug('[Storage/loadUser] Loaded user:', user.accountId, 'with', user.txHistory?.length || 0, 'history records');
  }
  return user;
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
 * Clear account storage for current user
 */
export function clearAccountStorage(): void {
  const activeId = getActiveAccountId();

  if (activeId) {
    // Clear current user data
    try { localStorage.removeItem(getUserStorageKey(activeId)); } catch { }
    try { localStorage.removeItem(getUserProfileKey(activeId)); } catch { }
    try { localStorage.removeItem(getGuarChoiceKey(activeId)); } catch { }
  }

  // Clear legacy keys
  try { localStorage.removeItem(STORAGE_KEY); } catch { }
  try { localStorage.removeItem('walletUser'); } catch { }
  try { localStorage.removeItem(PROFILE_STORAGE_KEY); } catch { }
  try { localStorage.removeItem('guarChoice'); } catch { }
  try { localStorage.removeItem('capsuleAddressCache'); } catch { }
  try { localStorage.removeItem('orgPublicKeyCache'); } catch { }

  // Clear active account tracking
  setActiveAccountId(null);

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
  const user = loadUser();
  if (!user || !user.accountId) {
    return { nickname: '', avatar: null, signature: '' };
  }

  try {
    const key = getUserProfileKey(user.accountId);
    const raw = localStorage.getItem(key);
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
  const user = loadUser();
  if (!user || !user.accountId) {
    console.warn('Cannot save profile: no active user');
    return;
  }

  try {
    const key = getUserProfileKey(user.accountId);
    localStorage.setItem(key, JSON.stringify(profile));
  } catch (e) {
    console.warn('Failed to save profile', e);
  }
}

// ========================================
// Guarantor Organization
// ========================================

/**
 * Get the joined guarantor organization
 * 
 * Priority order:
 * 1. user.guarGroup (contains full info including assignAPIEndpoint from backend)
 * 2. guarChoice (may contain full info if saved after joining)
 * 3. guarChoice.groupID + GROUP_LIST lookup
 * 4. user.orgNumber + GROUP_LIST lookup
 * 5. DEFAULT_GROUP as fallback
 * 
 * @returns Joined group or null
 */
export function getJoinedGroup(): GuarantorGroup | null {
  // 1. First, try to get from user.guarGroup (contains full backend info)
  const u = loadUser();
  if (u?.guarGroup && u.guarGroup.groupID) {
    // Return the full guarGroup info which includes assignAPIEndpoint from backend
    const result = {
      groupID: u.guarGroup.groupID,
      aggreNode: u.guarGroup.aggreNode || '',
      assignNode: u.guarGroup.assignNode || '',
      pledgeAddress: u.guarGroup.pledgeAddress || '',
      assignAPIEndpoint: u.guarGroup.assignAPIEndpoint,
      aggrAPIEndpoint: u.guarGroup.aggrAPIEndpoint
    };
    console.debug('[Storage] getJoinedGroup from user.guarGroup:', result);
    return result;
  }

  // 2. Try guarChoice from localStorage
  const accountId = u?.accountId;
  try {
    const key = accountId ? getGuarChoiceKey(accountId) : GUAR_CHOICE_KEY;
    const raw = localStorage.getItem(key);
    if (raw) {
      const c = JSON.parse(raw) as GuarChoice;
      if (c && c.groupID) {
        // If guarChoice has full info (assignAPIEndpoint), use it directly
        if (c.assignAPIEndpoint) {
          const result = {
            groupID: c.groupID,
            aggreNode: c.aggreNode || '',
            assignNode: c.assignNode || '',
            pledgeAddress: c.pledgeAddress || '',
            assignAPIEndpoint: c.assignAPIEndpoint,
            aggrAPIEndpoint: c.aggrAPIEndpoint
          };
          console.debug('[Storage] getJoinedGroup from guarChoice (full info):', result);
          return result;
        }

        // Check if user has guarGroup with this ID
        if (u?.guarGroup && u.guarGroup.groupID === c.groupID) {
          const result = {
            groupID: u.guarGroup.groupID,
            aggreNode: u.guarGroup.aggreNode || '',
            assignNode: u.guarGroup.assignNode || '',
            pledgeAddress: u.guarGroup.pledgeAddress || '',
            assignAPIEndpoint: u.guarGroup.assignAPIEndpoint,
            aggrAPIEndpoint: u.guarGroup.aggrAPIEndpoint
          };
          console.debug('[Storage] getJoinedGroup from guarChoice + user.guarGroup:', result);
          return result;
        }
        // Fallback to GROUP_LIST lookup
        const g = Array.isArray(GROUP_LIST)
          ? GROUP_LIST.find(x => x.groupID === c.groupID)
          : null;
        const result = g || DEFAULT_GROUP;
        console.debug('[Storage] getJoinedGroup from GROUP_LIST/DEFAULT_GROUP:', result);
        return result;
      }
    }
  } catch { }

  // 3. Try user.orgNumber
  const gid = u && u.orgNumber;
  if (gid) {
    const g = Array.isArray(GROUP_LIST)
      ? GROUP_LIST.find(x => x.groupID === gid)
      : null;
    const result = g || DEFAULT_GROUP;
    console.debug('[Storage] getJoinedGroup from orgNumber + GROUP_LIST:', result);
    return result;
  }

  console.debug('[Storage] getJoinedGroup: no group found');
  return null;
}

/**
 * Save guarantor organization choice
 * @param choice - Organization choice to save
 */
export function saveGuarChoice(choice: GuarChoice): void {
  const user = loadUser();
  if (!user || !user.accountId) {
    console.warn('Cannot save guarantor choice: no active user');
    return;
  }

  try {
    const key = getGuarChoiceKey(user.accountId);
    localStorage.setItem(key, JSON.stringify(choice));
  } catch (e) {
    console.warn('Failed to save organization choice', e);
  }
}

/**
 * Clear guarantor organization choice
 */
export function clearGuarChoice(): void {
  const user = loadUser();
  if (user && user.accountId) {
    try {
      const key = getGuarChoiceKey(user.accountId);
      localStorage.removeItem(key);
    } catch { }
  }
  // Also clear legacy key
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

  const user = loadUser();
  const accountId = user?.accountId;

  try {
    if (accountId) {
      const key = getGuarChoiceKey(accountId);
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        changed = true;
      }
    }
    // Also clear legacy key
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
