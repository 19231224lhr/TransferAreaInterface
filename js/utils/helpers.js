/**
 * General-Purpose Helper Functions
 * 
 * Provides common utility functions used throughout the application.
 */

// ========================================
// Constants
// ========================================

/**
 * Base lift value for chart calculations
 */
export const BASE_LIFT = 20;

// ========================================
// Async Utilities
// ========================================

/**
 * Wait for specified milliseconds
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
export const wait = (ms) => new Promise(r => setTimeout(r, ms));

// ========================================
// Number Utilities
// ========================================

/**
 * Convert value to finite number or null
 * @param {any} val - Value to convert
 * @returns {number|null} Finite number or null
 */
export const toFiniteNumber = (val) => {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : null;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  }
  return null;
};

/**
 * Read address interest/gas from metadata
 * @param {object} meta - Address metadata
 * @returns {number} Interest value or 0
 */
export function readAddressInterest(meta) {
  if (!meta) return 0;
  // Prefer backend canonical field name first; others are mirrored for compatibility.
  const props = ['EstInterest', 'estInterest', 'gas', 'interest'];
  for (const key of props) {
    if (meta[key] === undefined || meta[key] === null) continue;
    const num = toFiniteNumber(meta[key]);
    if (num !== null) return num;
  }
  return 0;
}

// ========================================
// String Utilities
// ========================================

/**
 * Normalize address input (remove 0x prefix, lowercase)
 * @param {string} raw - Raw address input
 * @returns {string} Normalized address
 */
export function normalizeAddrInput(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw.trim().replace(/^0x/i, '').toLowerCase();
}

/**
 * Check if address format is valid (40 hex characters)
 * @param {string} addr - Address to validate
 * @returns {boolean} True if valid
 */
export function isValidAddressFormat(addr) {
  if (!addr || typeof addr !== 'string') return false;
  const normalized = normalizeAddrInput(addr);
  return /^[0-9a-f]{40}$/i.test(normalized);
}

/**
 * Check if private key format is valid (64 hex characters)
 * @param {string} privKey - Private key to validate
 * @returns {boolean} True if valid
 */
export function isValidPrivateKeyFormat(privKey) {
  if (!privKey || typeof privKey !== 'string') return false;
  const normalized = privKey.trim().replace(/^0x/i, '');
  return /^[0-9a-f]{64}$/i.test(normalized);
}

/**
 * Truncate address for display
 * @param {string} addr - Full address
 * @param {number} start - Characters to show at start
 * @param {number} end - Characters to show at end
 * @returns {string} Truncated address
 */
export function truncateAddress(addr, start = 6, end = 4) {
  if (!addr || addr.length <= start + end) return addr;
  return `${addr.slice(0, start)}...${addr.slice(-end)}`;
}

/**
 * Format balance for display
 * @param {number} amount - Balance amount
 * @param {number} decimals - Decimal places
 * @returns {string} Formatted balance
 */
export function formatBalance(amount, decimals = 2) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return '0';
  }
  return amount.toFixed(decimals);
}

// ========================================
// DOM Utilities
// ========================================

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} True if successful
 */
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (e) {
    console.warn('Copy to clipboard failed:', e);
    return false;
  }
}

// ========================================
// Chart Utilities
// ========================================

/**
 * Convert value to chart point
 * @param {number} v - Value to convert
 * @returns {number} Chart point value
 */
export function toPt(v) {
  const num = Number(v) || 0;
  return Math.min(140, Math.max(0, num / 10));
}
