/**
 * Account Service Module
 * 
 * Provides account management functions including creation, import, and sub-wallet management.
 */

import { base64urlToBytes, bytesToHex, hexToBytes, generate8DigitFromInputHex } from '../utils/crypto';
import { loadUser, saveUser, toAccount } from '../utils/storage';
import { setUser } from '../utils/store.js';
import { t } from '../i18n/index.js';
import { showUnifiedLoading, showUnifiedSuccess, hideUnifiedOverlay } from '../ui/modal';
import { showSuccessToast, showMiniToast, showErrorToast, showInfoToast } from '../utils/toast.js';
import { wait } from '../utils/helpers.js';
import { secureFetchWithRetry } from '../utils/security';
import { encryptAndSavePrivateKey, hasEncryptedKey } from '../utils/keyEncryptionUI';
import { clearLegacyKey } from '../utils/keyEncryption';
import { DOM_IDS } from '../config/domIds';
import { UTXOData } from '../types/blockchain';

// ========================================
// Type Definitions
// ========================================

/** Account data structure */
export interface AccountData {
  accountId: string;
  address: string;
  privHex: string;
  pubXHex: string;
  pubYHex: string;
}

/** Address metadata structure with strict UTXO typing */
export interface AddressMetadata {
  type: number;
  utxos: Record<string, UTXOData>;  // Strict UTXO type
  txCers: Record<string, number>;   // TXCer ID -> value mapping
  value: { totalValue: number; utxoValue: number; txCerValue: number };
  estInterest: number;
  origin?: string;
  privHex?: string;
  pubXHex?: string;
  pubYHex?: string;
}

// ========================================
// Account Generation
// ========================================

/**
 * Generate a new user account with ECDSA P-256 keypair
 * @returns Account data with accountId, address, privHex, pubXHex, pubYHex
 */
export async function newUser(): Promise<AccountData> {
  // Generate keypair
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );

  // Export JWK to get private key d, public key x/y
  const jwkPub = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const jwkPriv = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

  const dBytes = base64urlToBytes(jwkPriv.d!);
  const xBytes = base64urlToBytes(jwkPub.x!);
  const yBytes = base64urlToBytes(jwkPub.y!);

  const privHex = bytesToHex(dBytes);
  const pubXHex = bytesToHex(xBytes);
  const pubYHex = bytesToHex(yBytes);

  // Uncompressed public key: 0x04 || X || Y
  const uncompressed = new Uint8Array(1 + xBytes.length + yBytes.length);
  uncompressed[0] = 0x04;
  uncompressed.set(xBytes, 1);
  uncompressed.set(yBytes, 1 + xBytes.length);

  // Address = SHA-256(uncompressed)[0..20]
  const sha = await crypto.subtle.digest('SHA-256', uncompressed);
  const address = bytesToHex(new Uint8Array(sha).slice(0, 20));

  // User ID = 8 digits (aligned with Go's Generate8DigitNumberBasedOnInput)
  const accountId = generate8DigitFromInputHex(privHex);

  return { accountId, address, privHex, pubXHex, pubYHex };
}

/**
 * Import account from private key using Web Crypto API (no external library needed)
 * @param privHex - Private key in hex format
 * @returns Account data
 */
export async function importLocallyFromPrivHex(privHex: string): Promise<AccountData> {
  const normalized = privHex.replace(/^0x/i, '').toLowerCase();

  // Validate private key format (64 hex characters)
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error('Private key format incorrect: must be 64 hex characters');
  }

  try {
    // Use pure JS implementation of P-256 point multiplication to derive public key
    const result = await computePublicKeyFromPrivate(normalized);

    const uncompressedHex = '04' + result.x + result.y;
    const uncompressed = hexToBytes(uncompressedHex);

    const sha = await crypto.subtle.digest('SHA-256', uncompressed as BufferSource);
    const address = bytesToHex(new Uint8Array(sha).slice(0, 20));
    const accountId = generate8DigitFromInputHex(normalized);

    return {
      accountId,
      address,
      privHex: normalized,
      pubXHex: result.x,
      pubYHex: result.y
    };

  } catch (e: any) {
    throw new Error('Private key format incorrect or cannot be parsed: ' + (e.message || e));
  }
}

/**
 * Compute public key (x, y) from private key using P-256 curve math
 * Prefers elliptic library if available, falls back to pure JS implementation
 */
async function computePublicKeyFromPrivate(privHex: string): Promise<{ x: string; y: string }> {
  // Normalize private key hex
  const normalizedPrivHex = privHex.replace(/^0x/i, '').toLowerCase();

  // Try to use elliptic library if available (faster and more tested)
  if (window.elliptic?.ec) {
    try {
      const EC = window.elliptic.ec;
      const ec = new EC('p256');
      const keyPair = ec.keyFromPrivate(normalizedPrivHex, 'hex');
      const pubPoint = keyPair.getPublic();
      const xHex = pubPoint.getX().toString(16).padStart(64, '0');
      const yHex = pubPoint.getY().toString(16).padStart(64, '0');
      return { x: xHex, y: yHex };
    } catch (e) {
      console.warn('Elliptic library failed, falling back to pure JS implementation:', e);
    }
  }

  // Fallback: Pure JavaScript implementation
  // P-256 curve parameters
  const p = BigInt('0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff');
  const a = BigInt('0xffffffff00000001000000000000000000000000fffffffffffffffffffffffc');
  const Gx = BigInt('0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296');
  const Gy = BigInt('0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5');
  const n = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');

  const d = BigInt('0x' + normalizedPrivHex);

  if (d <= 0n || d >= n) {
    throw new Error('Private key out of valid range');
  }

  // Point multiplication: Q = d * G
  const Q = pointMultiply(Gx, Gy, d, p, a);

  if (!Q) {
    throw new Error('Invalid private key');
  }

  // Convert to hex, pad to 64 characters
  const xHex = Q.x.toString(16).padStart(64, '0');
  const yHex = Q.y.toString(16).padStart(64, '0');

  return { x: xHex, y: yHex };
}

/**
 * Modular inverse using extended Euclidean algorithm
 */
function modInverse(a: bigint, m: bigint): bigint {
  // Handle negative inputs by normalizing to positive
  let [old_r, r] = [((a % m) + m) % m, m];
  let [old_s, s] = [1n, 0n];

  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }

  return ((old_s % m) + m) % m;
}

/**
 * Modular operation helper - ensures result is always positive
 */
function mod(a: bigint, m: bigint): bigint {
  return ((a % m) + m) % m;
}

/**
 * Point addition on elliptic curve
 */
function pointAdd(
  x1: bigint, y1: bigint,
  x2: bigint, y2: bigint,
  p: bigint, a: bigint
): { x: bigint; y: bigint } | null {
  if (x1 === x2 && y1 === y2) {
    // Point doubling
    const numerator = mod(3n * x1 * x1 + a, p);
    const denominator = mod(2n * y1, p);
    const s = mod(numerator * modInverse(denominator, p), p);
    const x3 = mod(s * s - 2n * x1, p);
    const y3 = mod(s * (x1 - x3) - y1, p);
    return { x: x3, y: y3 };
  } else {
    // Point addition
    const dx = mod(x2 - x1, p);
    const dy = mod(y2 - y1, p);
    const s = mod(dy * modInverse(dx, p), p);
    const x3 = mod(s * s - x1 - x2, p);
    const y3 = mod(s * (x1 - x3) - y1, p);
    return { x: x3, y: y3 };
  }
}

/**
 * Scalar multiplication using double-and-add algorithm
 */
function pointMultiply(
  Gx: bigint, Gy: bigint,
  k: bigint,
  p: bigint, a: bigint
): { x: bigint; y: bigint } | null {
  let result: { x: bigint; y: bigint } | null = null;
  let addend: { x: bigint; y: bigint } | null = { x: Gx, y: Gy };

  while (k > 0n) {
    if (k & 1n) {
      if (result === null) {
        result = addend;
      } else if (addend) {
        result = pointAdd(result.x, result.y, addend.x, addend.y, p, a);
      }
    }
    if (addend) {
      addend = pointAdd(addend.x, addend.y, addend.x, addend.y, p, a);
    }
    k >>= 1n;
  }

  return result;
}

/**
 * Import account from private key (tries backend API first, falls back to local)
 * @param privHex - Private key in hex format
 * @returns Account data
 */
export async function importFromPrivHex(privHex: string): Promise<AccountData> {
  // Try backend API first; fall back to local calculation if unavailable
  try {
    const res = await secureFetchWithRetry('/api/keys/from-priv', {
      method: 'POST',
      body: JSON.stringify({ privHex })
    }, { timeout: 10000, retries: 2 });
    if (res.ok) {
      const data = await res.json();
      const normalized = (data.privHex || privHex).replace(/^0x/i, '').toLowerCase().replace(/^0+/, '');
      const accountId = generate8DigitFromInputHex(normalized);
      return { ...data, accountId };
    }
  } catch (_) {
    // Network or CORS issues - fall back to local
  }
  return await importLocallyFromPrivHex(privHex);
}

/**
 * Add a new sub-wallet address to the current account
 * 
 * This function:
 * 1. Generates a new ECDSA P-256 keypair locally
 * 2. Computes the address from the public key
 * 3. If user is in a guarantor organization, syncs with backend AssignNode first
 * 4. Only saves to local storage after backend confirms (if in organization)
 * 
 * @param addressType - Address type (0=PGC, 1=BTC, 2=ETH), defaults to 0
 */
export async function addNewSubWallet(addressType: number = 0): Promise<void> {
  const u = loadUser();
  if (!u || !u.accountId) {
    alert(t('modal.pleaseLoginFirst'));
    return;
  }

  // Show unified loading component
  showUnifiedLoading(t('modal.addingWalletAddress'));

  try {
    const t0 = Date.now();

    // Generate new keypair
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify']
    );

    const jwkPub = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const jwkPriv = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

    const dBytes = base64urlToBytes(jwkPriv.d!);
    const xBytes = base64urlToBytes(jwkPub.x!);
    const yBytes = base64urlToBytes(jwkPub.y!);

    const privHex = bytesToHex(dBytes);
    const pubXHex = bytesToHex(xBytes);
    const pubYHex = bytesToHex(yBytes);

    // Create uncompressed public key
    const uncompressed = new Uint8Array(1 + xBytes.length + yBytes.length);
    uncompressed[0] = 0x04;
    uncompressed.set(xBytes, 1);
    uncompressed.set(yBytes, 1 + xBytes.length);

    // Generate address (SHA-256 of uncompressed public key, first 20 bytes)
    const sha = await crypto.subtle.digest('SHA-256', uncompressed);
    const addr = bytesToHex(new Uint8Array(sha).slice(0, 20));

    console.info(`[Account] Generated new address: ${addr}`);

    // Import address service dynamically to avoid circular dependency
    const { createNewAddressOnBackend, isUserInOrganization, registerAddressOnComNode } = await import('./address');

    // If user is in organization, must sync with backend first
    const inOrg = isUserInOrganization();
    if (inOrg) {
      console.info('[Account] User is in organization, syncing address with backend...');

      // Hide loading temporarily to show password prompt if needed
      hideUnifiedOverlay();

      const result = await createNewAddressOnBackend(addr, pubXHex, pubYHex, addressType);

      // Show loading again
      showUnifiedLoading(t('modal.addingWalletAddress'));

      if (!result.success) {
        // Check if user cancelled password input
        if (result.error === 'USER_CANCELLED') {
          console.info('[Account] User cancelled password input for new address');
          hideUnifiedOverlay();
          showInfoToast(t('common.operationCancelled') || '操作已取消');
          return; // Exit without saving locally
        }

        // Backend failed - do NOT save locally, show error
        console.error('[Account] ✗ Backend sync failed:', result.error);
        hideUnifiedOverlay();
        showErrorToast(
          t('address.createFailed', '创建地址失败'),
          result.error || t('error.unknownError')
        );
        return; // Exit without saving locally
      }

      console.info('[Account] ✓ Address synced with backend successfully');
    } else {
      console.info('[Account] User not in organization, creating address locally only');
    }

    // Backend succeeded (or user not in org) - now save locally
    const acc = toAccount({ accountId: u.accountId, address: u.address }, u);
    acc.wallet.addressMsg[addr] = acc.wallet.addressMsg[addr] || {
      type: addressType,
      utxos: {},
      txCers: {},
      value: { totalValue: 0, utxoValue: 0, txCerValue: 0 },
      estInterest: 0,
      origin: 'created'
    };
    // AddressData interface includes these fields
    const addrData = acc.wallet.addressMsg[addr];
    addrData.privHex = privHex;
    addrData.pubXHex = pubXHex;
    addrData.pubYHex = pubYHex;
    addrData.type = addressType;

    // Single Source of Truth: Update Store first, let subscriptions handle UI
    setUser(acc);
    saveUser(acc);

    if (!inOrg) {
      const registerResult = await registerAddressOnComNode(addr, pubXHex, pubYHex, privHex, '', addressType);
      if (!registerResult.success) {
        showErrorToast(
          registerResult.error || t('error.unknownError'),
          t('toast.addressRegisterFailed', 'Address registration failed')
        );
      }
    }

    // Ensure minimum loading time for UX
    const elapsed = Date.now() - t0;
    if (elapsed < 800) {
      await wait(800 - elapsed);
    }

    // P0-1 Fix: Prompt user to encrypt the new sub-wallet private key
    // Note: Sub-wallet keys are stored per-address, encryption is optional
    try {
      // For sub-wallets, we use the address as the key identifier
      // The main account encryption status determines if we prompt
      if (!hasEncryptedKey(u.accountId)) {
        // Main account not encrypted, prompt for sub-wallet encryption
        await encryptAndSavePrivateKey(`${u.accountId}_${addr}`, privHex);
      }
    } catch (encryptErr) {
      // Encryption is optional - don't block sub-wallet creation
      console.warn('Sub-wallet key encryption skipped:', encryptErr);
    }

    // New address requires full wallet re-render (DOM structure change)
    // This is an exception where we call renderWallet directly because:
    // 1. We're adding a new card to the DOM, not just updating values
    // 2. Store subscription can't determine the insertion position
    try { window.PanguPay?.wallet?.renderWallet?.(); } catch (_) { }

    // Show success (smooth transition from loading state)
    // No success callback needed - Store subscription handles all reactive updates
    // Show success (smooth transition from loading state)
    // No success callback needed - Store subscription handles all reactive updates
    hideUnifiedOverlay(); // Ensure overlay is hidden before showing toast
    showSuccessToast(
      t('modal.walletAddSuccessDesc'),
      t('modal.walletAddSuccess')
    );

  } catch (e: any) {
    hideUnifiedOverlay();
    showErrorToast(
      t('address.createFailed', '创建地址失败'),
      e && e.message ? e.message : String(e)
    );
    console.error(e);
  }
}

/**
 * Handle account creation with UI updates
 * @param showToastNotification - Whether to show toast notification
 * @returns Created account data or null on failure
 */
export async function handleCreate(showToastNotification: boolean = true): Promise<AccountData | null> {
  const btn = document.getElementById(DOM_IDS.createBtn) as HTMLButtonElement | null;
  if (btn) btn.disabled = true;

  try {
    const loader = document.getElementById(DOM_IDS.newLoader);
    const resultEl = document.getElementById(DOM_IDS.result);
    const nextBtn = document.getElementById(DOM_IDS.newNextBtn);

    if (btn) btn.classList.add('hidden');
    if (nextBtn) nextBtn.classList.add('hidden');
    if (resultEl) resultEl.classList.add('hidden');
    if (loader) loader.classList.remove('hidden');

    const t0 = Date.now();
    // Generate keypair locally (Web Crypto API is secure and fast)
    const data: AccountData = await newUser();

    // Ensure minimum loading time for UX
    const elapsed = Date.now() - t0;
    if (elapsed < 1000) await wait(1000 - elapsed);

    if (loader) loader.classList.add('hidden');

    // Hide success banner, use top toast notification instead
    const successBanner = resultEl?.querySelector('.new-result-success');
    if (successBanner) {
      (successBanner as HTMLElement).style.display = 'none';
    }

    if (resultEl) {
      resultEl.classList.remove('hidden');
      resultEl.classList.remove('fade-in');
      resultEl.classList.remove('reveal');
      requestAnimationFrame(() => resultEl.classList.add('reveal'));
    }

    // Update UI with account data
    const accountIdEl = document.getElementById(DOM_IDS.accountId);
    const addressEl = document.getElementById(DOM_IDS.address);
    const privHexEl = document.getElementById(DOM_IDS.privHex);
    const pubXEl = document.getElementById(DOM_IDS.pubX);
    const pubYEl = document.getElementById(DOM_IDS.pubY);

    if (accountIdEl) accountIdEl.textContent = data.accountId;
    if (addressEl) addressEl.textContent = data.address;
    if (privHexEl) privHexEl.textContent = data.privHex;
    if (pubXEl) pubXEl.textContent = data.pubXHex;
    if (pubYEl) pubYEl.textContent = data.pubYHex;

    // Save user data first (with plaintext key for backward compatibility)
    saveUser({
      accountId: data.accountId,
      address: data.address,
      privHex: data.privHex,
      pubXHex: data.pubXHex,
      pubYHex: data.pubYHex,
      flowOrigin: 'new'
    });

    if (btn) btn.classList.remove('hidden');
    if (nextBtn) nextBtn.classList.remove('hidden');

    // Show success notification if requested
    if (showToastNotification) {
      showSuccessToast(t('toast.account.created'), t('toast.account.createTitle'), 1500);
    }

    // P0-1 Fix: Prompt user to encrypt private key after account creation
    // This is non-blocking - user can skip encryption
    try {
      if (!hasEncryptedKey(data.accountId)) {
        const encrypted = await encryptAndSavePrivateKey(data.accountId, data.privHex);
        if (encrypted) {
          // Clear plaintext key from storage after successful encryption
          const user = loadUser();
          if (user) {
            const updatedUser = clearLegacyKey(user);
            if (updatedUser) {
              saveUser(updatedUser);
            }
          }
        }
      }
    } catch (encryptErr) {
      // Encryption is optional - don't block account creation
      console.warn('Private key encryption skipped:', encryptErr);
    }

    return data;

  } catch (err: any) {
    alert('Failed to create user: ' + err);
    console.error(err);
    const nextBtn = document.getElementById(DOM_IDS.newNextBtn);
    if (btn) btn.classList.remove('hidden');
    if (nextBtn) nextBtn.classList.remove('hidden');
    return null;

  } finally {
    if (btn) btn.disabled = false;
    const loader = document.getElementById(DOM_IDS.newLoader);
    if (loader) loader.classList.add('hidden');
  }
}
