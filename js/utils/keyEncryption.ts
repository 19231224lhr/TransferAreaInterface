/**
 * Private Key Encryption Module
 * 
 * Provides secure encryption/decryption for private keys using password-based encryption.
 * Uses Web Crypto API with PBKDF2 for key derivation and AES-GCM for encryption.
 * 
 * Security considerations:
 * - PBKDF2 with 100,000 iterations for key derivation
 * - Random salt for each encryption operation
 * - AES-256-GCM for authenticated encryption
 * - Random IV for each encryption
 */

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
// Crypto Functions
// ========================================

/**
 * Derive encryption key from password using PBKDF2
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  // Import password as key material
  const passwordBuffer = stringToBuffer(password);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer as BufferSource,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive AES key using PBKDF2
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
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
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Derive key from password
  const key = await deriveKey(password, salt);

  // Encrypt the private key
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    stringToBuffer(privateKeyHex) as BufferSource
  );

  return {
    encrypted: bufferToHex(encryptedBuffer),
    salt: bufferToHex(salt),
    iv: bufferToHex(iv)
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

  // Convert hex strings back to buffers
  const encryptedBuffer = hexToBuffer(encryptedHex);
  const saltBuffer = hexToBuffer(salt);
  const ivBuffer = hexToBuffer(iv);

  // Derive key from password
  const key = await deriveKey(password, saltBuffer);

  try {
    // Decrypt
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBuffer as BufferSource },
      key,
      encryptedBuffer as BufferSource
    );

    return bufferToString(new Uint8Array(decryptedBuffer));
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
