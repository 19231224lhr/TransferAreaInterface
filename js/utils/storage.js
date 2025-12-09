/**
 * Storage Utility Functions
 * 
 * Provides localStorage operations for accounts, profiles, and organization data.
 */

import { 
  STORAGE_KEY, 
  PROFILE_STORAGE_KEY, 
  GUAR_CHOICE_KEY,
  DEFAULT_GROUP,
  GROUP_LIST 
} from '../config/constants.js';

// ========================================
// Account Data
// ========================================

/**
 * Convert basic account info to full account structure
 * @param {object} basic - Basic account info
 * @param {object|null} prev - Previous account data (for merging)
 * @returns {object} Full account structure
 */
export function toAccount(basic, prev) {
  const isSame = prev && prev.accountId && basic && basic.accountId && 
                 prev.accountId === basic.accountId;
  const acc = isSame ? (prev ? JSON.parse(JSON.stringify(prev)) : {}) : {};
  
  acc.accountId = basic.accountId || acc.accountId || '';
  acc.orgNumber = acc.orgNumber || '';
  acc.flowOrigin = basic.flowOrigin || acc.flowOrigin || '';
  
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
    if (basic.wallet.TotalValue !== undefined) {
      acc.wallet.TotalValue = basic.wallet.TotalValue;
    }
    if (basic.wallet.history) {
      acc.wallet.history = [...basic.wallet.history];
    }
  }
  
  return acc;
}

/**
 * Load user account from localStorage
 * @returns {object|null} User account data or null if not found
 */
export function loadUser() {
  try {
    const rawAcc = localStorage.getItem(STORAGE_KEY);
    if (rawAcc) return JSON.parse(rawAcc);
    
    // Try legacy storage key
    const legacy = localStorage.getItem('walletUser');
    if (legacy) {
      const basic = JSON.parse(legacy);
      const acc = toAccount(basic, null);
      try { 
        localStorage.setItem(STORAGE_KEY, JSON.stringify(acc)); 
      } catch { }
      return acc;
    }
    return null;
  } catch (e) {
    console.warn('Failed to load user data', e);
    return null;
  }
}

/**
 * Save user account to localStorage
 * @param {object} user - User account data to save
 */
export function saveUser(user) {
  try {
    const prev = loadUser();
    const acc = toAccount(user, prev);
    
    // Initialize wallet history if needed
    if (!acc.wallet) acc.wallet = {};
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
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(acc));
    
    // Update header user display
    if (typeof window.updateHeaderUser === 'function') {
      window.updateHeaderUser(acc);
    }
    
    // Trigger chart update
    if (typeof window.updateWalletChart === 'function') {
      window.updateWalletChart(acc);
    }
  } catch (e) {
    console.warn('Failed to save user data', e);
  }
}

/**
 * Clear account storage
 */
export function clearAccountStorage() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { }
  try { localStorage.removeItem('walletUser'); } catch { }
  try { localStorage.removeItem(PROFILE_STORAGE_KEY); } catch { }
  try { localStorage.removeItem('guarChoice'); } catch { }
}

// ========================================
// User Profile
// ========================================

/**
 * Load user profile (avatar, nickname, signature)
 * @returns {object} Profile data with defaults
 */
export function loadUserProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to load profile', e);
  }
  return { nickname: '', avatar: null, signature: '' };
}

/**
 * Save user profile
 * @param {object} profile - Profile data to save
 */
export function saveUserProfile(profile) {
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
 * @returns {object|null} Joined group or null
 */
export function getJoinedGroup() {
  try {
    const raw = localStorage.getItem(GUAR_CHOICE_KEY);
    if (raw) {
      const c = JSON.parse(raw);
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
 * @param {object} choice - Organization choice to save
 */
export function saveGuarChoice(choice) {
  try {
    localStorage.setItem(GUAR_CHOICE_KEY, JSON.stringify(choice));
  } catch (e) {
    console.warn('Failed to save organization choice', e);
  }
}

/**
 * Clear guarantor organization choice
 */
export function clearGuarChoice() {
  try {
    localStorage.removeItem(GUAR_CHOICE_KEY);
  } catch { }
}

/**
 * Reset organization selection for new user
 * Clears local organization data and updates user state
 */
export function resetOrgSelectionForNewUser() {
  let changed = false;
  
  try {
    if (localStorage.getItem(GUAR_CHOICE_KEY)) {
      localStorage.removeItem(GUAR_CHOICE_KEY);
      changed = true;
    }
  } catch (_) { }
  
  const current = loadUser();
  if (current && (current.orgNumber || current.guarGroup)) {
    current.orgNumber = '';
    current.guarGroup = null;
    try { 
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); 
    } catch (_) { }
    changed = true;
  }
  
  return changed;
}

/**
 * Compute current organization ID from user data
 * @returns {string} Organization ID or empty string
 */
export function computeCurrentOrgId() {
  const group = getJoinedGroup();
  return group ? group.groupID : '';
}
