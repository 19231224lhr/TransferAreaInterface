/**
 * Cryptographic Utility Functions
 * 
 * Provides encoding/decoding, hashing, and signing utilities.
 */

// ========================================
// Base64 URL Encoding/Decoding
// ========================================

/**
 * Convert Base64URL string to Uint8Array
 * @param {string} b64url - Base64URL encoded string
 * @returns {Uint8Array} Decoded bytes
 */
export const base64urlToBytes = (b64url) => {
  // Convert base64url -> base64
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 2 ? '==' : b64.length % 4 === 3 ? '=' : '';
  const str = atob(b64 + pad);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
};

/**
 * Convert Uint8Array to Base64URL string
 * @param {Uint8Array} bytes - Bytes to encode
 * @returns {string} Base64URL encoded string
 */
export const bytesToBase64url = (bytes) => {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 = btoa(binary);
  // Convert base64 -> base64url (remove padding and replace characters)
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

// ========================================
// Hex Encoding/Decoding
// ========================================

/**
 * Convert Uint8Array to hex string
 * @param {Uint8Array} bytes - Bytes to convert
 * @returns {string} Hex string
 */
export const bytesToHex = (bytes) => 
  Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');

/**
 * Convert hex string to Uint8Array
 * @param {string} hex - Hex string to convert
 * @returns {Uint8Array} Decoded bytes
 */
export const hexToBytes = (hex) => {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
};

// ========================================
// CRC32 (IEEE)
// ========================================

/**
 * CRC32 lookup table (IEEE polynomial)
 */
const crc32Table = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

/**
 * Calculate CRC32 checksum
 * @param {Uint8Array} bytes - Input bytes
 * @returns {number} CRC32 checksum
 */
export const crc32 = (bytes) => {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = crc32Table[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
};

/**
 * Generate 8-digit number from hex input (matches Go backend logic)
 * @param {string} hex - Hex string input
 * @returns {string} 8-digit number string
 */
export const generate8DigitFromInputHex = (hex) => {
  const enc = new TextEncoder();
  const s = String(hex).replace(/^0x/i, '').toLowerCase().replace(/^0+/, '');
  const bytes = enc.encode(s);
  const crcVal = crc32(bytes);
  const num = (crcVal % 90000000) + 10000000;
  return String(num).padStart(8, '0');
};

// ========================================
// ECDSA Signing (WebCrypto)
// ========================================

/**
 * Sign data using ECDSA P-256 (WebCrypto will hash with SHA-256)
 * This matches Go's ecdsa.Sign(rand, key, sha256(data))
 * 
 * @param {string} privateKeyHex - Private key in hex format
 * @param {Uint8Array|ArrayBuffer} data - Data to sign
 * @param {string|null} pubXHex - Public key X coordinate (optional)
 * @param {string|null} pubYHex - Public key Y coordinate (optional)
 * @returns {Promise<{r: string, s: string, signature: string}>} Signature components
 */
export async function ecdsaSignData(privateKeyHex, data, pubXHex = null, pubYHex = null) {
  try {
    // 1. Import private key from hex
    const dBytes = hexToBytes(privateKeyHex);
    const dB64 = bytesToBase64url(dBytes);
    
    // If public key coordinates not provided, derive them
    let xB64, yB64;
    if (pubXHex && pubYHex) {
      xB64 = bytesToBase64url(hexToBytes(pubXHex));
      yB64 = bytesToBase64url(hexToBytes(pubYHex));
    } else {
      // Need to derive public key - use elliptic library if available
      if (window.elliptic && window.elliptic.ec) {
        const EC = window.elliptic.ec;
        const ec = new EC('p256');
        const keyPair = ec.keyFromPrivate(privateKeyHex, 'hex');
        const pubPoint = keyPair.getPublic();
        const xHex = pubPoint.getX().toString(16).padStart(64, '0');
        const yHex = pubPoint.getY().toString(16).padStart(64, '0');
        xB64 = bytesToBase64url(hexToBytes(xHex));
        yB64 = bytesToBase64url(hexToBytes(yHex));
      } else {
        throw new Error('Public key coordinates required or elliptic library needed');
      }
    }
    
    // 2. Create JWK and import key
    const jwk = {
      kty: 'EC',
      crv: 'P-256',
      x: xB64,
      y: yB64,
      d: dB64
    };
    
    const privateKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );
    
    // 3. Sign data (WebCrypto will hash with SHA-256 first)
    const sigBuffer = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      privateKey,
      data
    );
    
    // 4. Parse signature (r || s, each 32 bytes)
    const sigBytes = new Uint8Array(sigBuffer);
    const r = bytesToHex(sigBytes.slice(0, 32));
    const s = bytesToHex(sigBytes.slice(32, 64));
    
    return {
      r,
      s,
      signature: r + s
    };
  } catch (e) {
    console.error('ECDSA signing failed:', e);
    throw e;
  }
}

/**
 * Sign a pre-computed hash using ECDSA P-256
 * Note: WebCrypto will hash again, so this results in double-hashing
 * Use only for special cases that require signing hash values
 * 
 * @param {string} privateKeyHex - Private key in hex format
 * @param {Uint8Array} hashBytes - Pre-computed hash bytes
 * @param {string|null} pubXHex - Public key X coordinate (optional)
 * @param {string|null} pubYHex - Public key Y coordinate (optional)
 * @returns {Promise<{r: string, s: string, signature: string}>} Signature components
 */
export async function ecdsaSignHash(privateKeyHex, hashBytes, pubXHex = null, pubYHex = null) {
  // This is essentially the same as ecdsaSignData since WebCrypto
  // will hash the input regardless
  return ecdsaSignData(privateKeyHex, hashBytes, pubXHex, pubYHex);
}

// ========================================
// SHA-256 Hashing
// ========================================

/**
 * Compute SHA-256 hash of data
 * @param {Uint8Array|ArrayBuffer} data - Data to hash
 * @returns {Promise<Uint8Array>} Hash bytes
 */
export async function sha256(data) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hashBuffer);
}

/**
 * Compute SHA-256 hash and return as hex string
 * @param {Uint8Array|ArrayBuffer} data - Data to hash
 * @returns {Promise<string>} Hash as hex string
 */
export async function sha256Hex(data) {
  const hashBytes = await sha256(data);
  return bytesToHex(hashBytes);
}
