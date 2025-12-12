/**
 * Account Service Module
 * 
 * Provides account management functions including creation, import, and sub-wallet management.
 */

import { base64urlToBytes, bytesToHex, hexToBytes, generate8DigitFromInputHex } from '../utils/crypto';
import { loadUser, saveUser, toAccount } from '../utils/storage';
import { t } from '../i18n/index.js';
import { showUnifiedLoading, showUnifiedSuccess, hideUnifiedOverlay } from '../ui/modal.js';
import { showSuccessToast } from '../utils/toast.js';
import { wait } from '../utils/helpers.js';

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

/** Address metadata structure */
export interface AddressMetadata {
  type: number;
  utxos: Record<string, any>;
  txCers: Record<string, any>;
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
 * Import account from private key using local elliptic library
 * @param privHex - Private key in hex format
 * @returns Account data
 */
export async function importLocallyFromPrivHex(privHex: string): Promise<AccountData> {
  const normalized = privHex.replace(/^0x/i, '');
  
  if (!(window as any).elliptic || !(window as any).elliptic.ec) {
    throw new Error('Local import failed: missing elliptic library');
  }
  
  const ec = new (window as any).elliptic.ec('p256');
  let key: any;
  try {
    key = ec.keyFromPrivate(normalized, 'hex');
  } catch (e) {
    throw new Error('Private key format incorrect or cannot be parsed');
  }
  
  const pub = key.getPublic();
  const xHex = pub.getX().toString(16).padStart(64, '0');
  const yHex = pub.getY().toString(16).padStart(64, '0');
  
  const uncompressedHex = '04' + xHex + yHex;
  const uncompressed = hexToBytes(uncompressedHex);
  
  const sha = await crypto.subtle.digest('SHA-256', uncompressed as BufferSource);
  const address = bytesToHex(new Uint8Array(sha).slice(0, 20));
  const accountId = generate8DigitFromInputHex(normalized);
  
  return { accountId, address, privHex: normalized, pubXHex: xHex, pubYHex: yHex };
}

/**
 * Import account from private key (tries backend API first, falls back to local)
 * @param privHex - Private key in hex format
 * @returns Account data
 */
export async function importFromPrivHex(privHex: string): Promise<AccountData> {
  // Try backend API first; fall back to local calculation if unavailable
  try {
    const res = await fetch('/api/keys/from-priv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ privHex })
    });
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
 */
export async function addNewSubWallet(): Promise<void> {
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
    
    // Generate address
    const sha = await crypto.subtle.digest('SHA-256', uncompressed);
    const addr = bytesToHex(new Uint8Array(sha).slice(0, 20));
    
    // Ensure minimum loading time for UX
    const elapsed = Date.now() - t0;
    if (elapsed < 800) {
      await wait(800 - elapsed);
    }
    
    // Update account with new address
    const acc = toAccount({ accountId: u.accountId, address: u.address }, u);
    acc.wallet.addressMsg[addr] = acc.wallet.addressMsg[addr] || {
      type: 0,
      utxos: {},
      txCers: {},
      value: { totalValue: 0, utxoValue: 0, txCerValue: 0 },
      estInterest: 0,
      origin: 'created'
    };
    (acc.wallet.addressMsg[addr] as any).privHex = privHex;
    (acc.wallet.addressMsg[addr] as any).pubXHex = pubXHex;
    (acc.wallet.addressMsg[addr] as any).pubYHex = pubYHex;
    
    saveUser(acc);
    
    // Refresh UI if functions are available
    if ((window as any).__refreshSrcAddrList) {
      try { (window as any).__refreshSrcAddrList(); } catch (_) { }
    }
    if (typeof (window as any).renderWallet === 'function') {
      try { (window as any).renderWallet(); } catch { }
    }
    if (typeof (window as any).updateWalletBrief === 'function') {
      try {
        (window as any).updateWalletBrief();
        requestAnimationFrame(() => (window as any).updateWalletBrief());
        setTimeout(() => (window as any).updateWalletBrief(), 0);
      } catch { }
    }
    
    // Show success (smooth transition from loading state)
    showUnifiedSuccess(
      t('modal.walletAddSuccess'), 
      t('modal.walletAddSuccessDesc'), 
      () => {
        if (typeof (window as any).renderWallet === 'function') {
          try { (window as any).renderWallet(); } catch { }
        }
        if (typeof (window as any).updateWalletBrief === 'function') {
          try { (window as any).updateWalletBrief(); } catch { }
        }
      },
      undefined // no cancel callback
    );
    
  } catch (e: any) {
    hideUnifiedOverlay();
    alert('Failed to add address: ' + (e && e.message ? e.message : e));
    console.error(e);
  }
}

/**
 * Handle account creation with UI updates
 * @param showToastNotification - Whether to show toast notification
 * @returns Created account data or null on failure
 */
export async function handleCreate(showToastNotification: boolean = true): Promise<AccountData | null> {
  const btn = document.getElementById('createBtn') as HTMLButtonElement | null;
  if (btn) btn.disabled = true;
  
  try {
    const loader = document.getElementById('newLoader');
    const resultEl = document.getElementById('result');
    const nextBtn = document.getElementById('newNextBtn');
    
    if (btn) btn.classList.add('hidden');
    if (nextBtn) nextBtn.classList.add('hidden');
    if (resultEl) resultEl.classList.add('hidden');
    if (loader) loader.classList.remove('hidden');
    
    const t0 = Date.now();
    let data: AccountData;
    
    // Try backend API first, fall back to local
    try {
      const res = await fetch('/api/account/new', { method: 'POST' });
      if (res.ok) {
        data = await res.json();
      } else {
        data = await newUser();
      }
    } catch (_) {
      data = await newUser();
    }
    
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
    const accountIdEl = document.getElementById('accountId');
    const addressEl = document.getElementById('address');
    const privHexEl = document.getElementById('privHex');
    const pubXEl = document.getElementById('pubX');
    const pubYEl = document.getElementById('pubY');
    
    if (accountIdEl) accountIdEl.textContent = data.accountId;
    if (addressEl) addressEl.textContent = data.address;
    if (privHexEl) privHexEl.textContent = data.privHex;
    if (pubXEl) pubXEl.textContent = data.pubXHex;
    if (pubYEl) pubYEl.textContent = data.pubYHex;
    
    // Save user data
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
      showSuccessToast(t('toast.account.created'), t('toast.account.createTitle'));
    }
    
    return data;
    
  } catch (err: any) {
    alert('Failed to create user: ' + err);
    console.error(err);
    const nextBtn = document.getElementById('newNextBtn');
    if (btn) btn.classList.remove('hidden');
    if (nextBtn) nextBtn.classList.remove('hidden');
    return null;
    
  } finally {
    if (btn) btn.disabled = false;
    const loader = document.getElementById('newLoader');
    if (loader) loader.classList.add('hidden');
  }
}
