/**
 * Private Key Encryption Module
 * 
 * Provides secure encryption/decryption for private keys using password-based encryption.
 * Uses crypto-js with PBKDF2 for key derivation and AES for encryption.
 * Compatible with HTTP environments (no Web Crypto API dependency).
 * 
 * Security considerations:
 * - PBKDF2 with 100,000 iterations for key derivation
 * - Random salt for each encryption operation
 * - AES-256 for encryption
 * - Random IV for each encryption
 */

import CryptoJS from 'crypto-js';

// ========================================
// Type Definitions
// ========================================

/** Encrypted key data structure */
export interface EncryptedKeyData {
  encrypted: string;
  salt: string;
  iv: string;
  version?: number;
  timestamp?: number;
}

/** Encryption result */
export interface EncryptResult {
  encrypted: string;
  salt: string;
  iv: string;
}

/** Migration result */
export interface MigrationResult {
  success: boolean;
  error?: string;
}

/** Encryption status */
export interface EncryptionStatus {
  needsMigration: boolean;
  isEncrypted: boolean;
}

/** User type for encryption operations - compatible with storage.User */
interface UserForEncryption {
  accountId: string;
  keys?: {
    privHex?: string;
    pubXHex?: string;
    pubYHex?: string;
    /** Internal marker for encrypted keys */
    _encrypted?: boolean;
  };
  privHex?: string;
}

// ========================================
// Constants
// ========================================

/** PBKDF2 iterations - higher is more secure but slower */
const PBKDF2_ITERATIONS = 100000;

/** Salt length in bytes */
const SALT_LENGTH = 16;

/** IV length in bytes for AES-GCM */
const IV_LENGTH = 12;

/** Key length in bits for AES-256 */
const KEY_LENGTH = 256;

/** Storage key for encrypted private key */
export const ENCRYPTED_KEY_STORAGE = 'encryptedPrivateKey';

/** Storage key for encryption metadata */
export const ENCRYPTION_META_STORAGE = 'encryptionMeta';

// ========================================
// Utility Functions
// ========================================

/**
 * Convert ArrayBuffer to hex string
 */
function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to Uint8Array
 */
function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Convert string to Uint8Array
 */
function stringToBuffer(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Convert Uint8Array to string
 */
function bufferToString(buffer: Uint8Array): string {
  return new TextDecoder().decode(buffer);
}

// ========================================
// Crypto Functions (using crypto-js)
// ========================================

/**
 * Derive encryption key from password using PBKDF2
 * Returns a WordArray suitable for AES encryption
 */
function deriveKey(password: string, salt: CryptoJS.lib.WordArray): CryptoJS.lib.WordArray {
  return CryptoJS.PBKDF2(password, salt, {
    keySize: KEY_LENGTH / 32, // 256 bits = 8 words (32 bits each)
    iterations: PBKDF2_ITERATIONS,
    hasher: CryptoJS.algo.SHA256
  });
}

/**
 * Generate random bytes as WordArray
 */
function randomBytes(length: number): CryptoJS.lib.WordArray {
  return CryptoJS.lib.WordArray.random(length);
}

/**
 * Convert WordArray to hex string
 */
function wordArrayToHex(wordArray: CryptoJS.lib.WordArray): string {
  return wordArray.toString(CryptoJS.enc.Hex);
}

/**
 * Convert hex string to WordArray
 */
function hexToWordArray(hex: string): CryptoJS.lib.WordArray {
  return CryptoJS.enc.Hex.parse(hex);
}

/**
 * Encrypt private key with password
 * @param privateKeyHex - Private key in hex format
 * @param password - Encryption password
 * @returns Encrypted data with salt and IV
 */
export async function encryptPrivateKey(
  privateKeyHex: string,
  password: string
): Promise<EncryptResult> {
  if (!privateKeyHex || !password) {
    throw new Error('Private key and password are required');
  }

  // Generate random salt and IV
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);

  // Derive key from password
  const key = deriveKey(password, salt);

  // Encrypt the private key using AES
  const encrypted = CryptoJS.AES.encrypt(privateKeyHex, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });

  return {
    encrypted: encrypted.ciphertext.toString(CryptoJS.enc.Hex),
    salt: wordArrayToHex(salt),
    iv: wordArrayToHex(iv)
  };
}

/**
 * Decrypt private key with password
 * @param encryptedHex - Encrypted data in hex format
 * @param salt - Salt in hex format
 * @param iv - IV in hex format
 * @param password - Decryption password
 * @returns Decrypted private key in hex format
 */
export async function decryptPrivateKey(
  encryptedHex: string,
  salt: string,
  iv: string,
  password: string
): Promise<string> {
  if (!encryptedHex || !salt || !iv || !password) {
    throw new Error('All parameters are required for decryption');
  }

  // Convert hex strings back to WordArrays
  const encryptedWordArray = hexToWordArray(encryptedHex);
  const saltWordArray = hexToWordArray(salt);
  const ivWordArray = hexToWordArray(iv);

  // Derive key from password
  const key = deriveKey(password, saltWordArray);

  try {
    // Create cipherParams object for decryption
    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: encryptedWordArray
    });

    // Decrypt
    const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
      iv: ivWordArray,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    const result = decrypted.toString(CryptoJS.enc.Utf8);

    if (!result) {
      throw new Error('Decryption failed. Incorrect password.');
    }

    return result;
  } catch {
    // Decryption failed - likely wrong password
    throw new Error('Decryption failed. Incorrect password.');
  }
}

// ========================================
// Storage Functions
// ========================================

/**
 * Save encrypted private key to localStorage
 * @param accountId - Account identifier
 * @param encryptedData - Encrypted key data
 */
export function saveEncryptedKey(accountId: string, encryptedData: EncryptResult): void {
  const key = `${ENCRYPTED_KEY_STORAGE}_${accountId}`;
  localStorage.setItem(key, JSON.stringify({
    ...encryptedData,
    version: 1,
    timestamp: Date.now()
  }));
}

/**
 * Load encrypted private key from localStorage
 * @param accountId - Account identifier
 * @returns Encrypted key data or null
 */
export function loadEncryptedKey(accountId: string): EncryptedKeyData | null {
  const key = `${ENCRYPTED_KEY_STORAGE}_${accountId}`;
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
}

/**
 * Remove encrypted key from storage
 * @param accountId - Account identifier
 */
export function removeEncryptedKey(accountId: string): void {
  const key = `${ENCRYPTED_KEY_STORAGE}_${accountId}`;
  localStorage.removeItem(key);
}

/**
 * Check if account has encrypted key
 * @param accountId - Account identifier
 * @returns Whether encrypted key exists
 */
export function hasEncryptedKey(accountId: string): boolean {
  return loadEncryptedKey(accountId) !== null;
}

// ========================================
// Migration Functions
// ========================================

/**
 * Check if user has legacy (unencrypted) private key
 * @param user - User object
 * @returns Whether user has legacy key
 */
export function hasLegacyKey(user: UserForEncryption | null | undefined): boolean {
  if (!user) return false;

  // Check for unencrypted private key in user object
  const privHex = (user.keys && user.keys.privHex) || user.privHex;
  return !!privHex && typeof privHex === 'string' && privHex.length === 64;
}

/**
 * Migrate legacy unencrypted key to encrypted storage
 * @param user - User object with legacy key
 * @param password - New encryption password
 * @returns Migration result
 */
export async function migrateToEncrypted(
  user: UserForEncryption | null | undefined,
  password: string
): Promise<MigrationResult> {
  if (!user || !password) {
    return { success: false, error: 'User and password required' };
  }

  try {
    // Get the legacy private key
    const privHex = (user.keys && user.keys.privHex) || user.privHex;
    if (!privHex) {
      return { success: false, error: 'No private key found' };
    }

    // Encrypt the private key
    const encryptedData = await encryptPrivateKey(privHex, password);

    // Save encrypted key
    saveEncryptedKey(user.accountId, encryptedData);

    // Return success - caller should clear the plaintext key from user object
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: (err as Error).message || 'Migration failed'
    };
  }
}

/**
 * Clear legacy (unencrypted) private key from user object
 * This should be called after successful migration
 * @param user - User object
 * @returns User object with cleared private key fields
 */
export function clearLegacyKey<T extends UserForEncryption>(user: T | null | undefined): T | null | undefined {
  if (!user) return user;

  const updated = { ...user };

  // Clear plaintext key from keys object
  if (updated.keys) {
    updated.keys = {
      ...updated.keys,
      privHex: '', // Clear but keep structure
      _encrypted: true // Mark as encrypted
    };
  }

  // Clear legacy privHex field
  if ('privHex' in updated) {
    delete updated.privHex;
  }

  return updated as T;
}

// ========================================
// Key Access Functions
// ========================================

/**
 * Get decrypted private key (for signing operations)
 * @param accountId - Account identifier
 * @param password - Decryption password
 * @returns Decrypted private key hex
 */
export async function getPrivateKey(accountId: string, password: string): Promise<string> {
  const encryptedData = loadEncryptedKey(accountId);

  if (!encryptedData) {
    throw new Error('No encrypted key found for this account');
  }

  return decryptPrivateKey(
    encryptedData.encrypted,
    encryptedData.salt,
    encryptedData.iv,
    password
  );
}

/**
 * Verify password is correct for account
 * @param accountId - Account identifier
 * @param password - Password to verify
 * @returns Whether password is correct
 */
export async function verifyPassword(accountId: string, password: string): Promise<boolean> {
  try {
    await getPrivateKey(accountId, password);
    return true;
  } catch {
    return false;
  }
}

/**
 * Change encryption password
 * @param accountId - Account identifier
 * @param oldPassword - Current password
 * @param newPassword - New password
 * @returns Result of password change
 */
export async function changePassword(
  accountId: string,
  oldPassword: string,
  newPassword: string
): Promise<MigrationResult> {
  try {
    // Decrypt with old password
    const privateKey = await getPrivateKey(accountId, oldPassword);

    // Re-encrypt with new password
    const encryptedData = await encryptPrivateKey(privateKey, newPassword);

    // Save new encrypted data
    saveEncryptedKey(accountId, encryptedData);

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: (err as Error).message || 'Password change failed'
    };
  }
}

// ========================================
// Initialization
// ========================================

/**
 * Check encryption status and prompt for migration if needed
 * @param user - User object
 * @returns Encryption status
 */
export function checkEncryptionStatus(user: UserForEncryption | null | undefined): EncryptionStatus {
  if (!user || !user.accountId) {
    return { needsMigration: false, isEncrypted: false };
  }

  const hasEncrypted = hasEncryptedKey(user.accountId);
  const hasLegacy = hasLegacyKey(user);

  return {
    needsMigration: hasLegacy && !hasEncrypted,
    isEncrypted: hasEncrypted
  };
}
