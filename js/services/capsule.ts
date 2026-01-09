import { ec as EC } from 'elliptic';
import { sha256 } from 'js-sha256';

import { API_BASE_URL, API_ENDPOINTS } from '../config/api';
import { t } from '../i18n/index.js';
import { base58CheckDecode } from '../utils/base58';
import { bytesToHex, hexToBytes } from '../utils/crypto';
import { getJoinedGroup, loadUser } from '../utils/storage';
import { getDecryptedPrivateKeyWithPrompt, hasEncryptedKey, showPasswordPrompt } from '../utils/keyEncryptionUI';
import { bigIntToHex, serializeForBackend, signStruct, type PublicKeyNew, type EcdsaSignature } from '../utils/signature';

import { apiClient, ApiRequestError } from './api';
import { getComNodeURL } from './comNodeEndpoint';
import { buildAssignNodeUrl, getTimestamp } from './group';

const ec = new EC('p256');
const CAPSULE_MASK_SALT = 'PANGU_CAPSULE_V1';
const CAPSULE_CACHE_KEY = 'capsuleAddressCache';
const ORG_PUBLIC_KEY_CACHE_KEY = 'orgPublicKeyCache';
const CAPSULE_MASK_LEN = 20;
const CAPSULE_SIG_PART_LEN = 32;
const CAPSULE_PAYLOAD_LEN = CAPSULE_MASK_LEN + CAPSULE_SIG_PART_LEN * 2;
const COMMITTEE_ORG_ID = '00000000';

interface CapsuleAddressRequest {
  UserID: string;
  Address: string;
  Timestamp: number;
  Sig?: EcdsaSignature;
}

interface CapsuleAddressReply {
  Success: boolean;
  OrgID: string;
  CapsuleAddr: string;
  ErrorMsg: string;
  Sig?: EcdsaSignature;
}

interface CapsuleVerifyResult {
  address: string;
  orgId: string;
}

function normalizeAddress(address: string): string {
  return String(address || '').trim().replace(/^0x/i, '').toLowerCase();
}

function isValidAddressFormat(address: string): boolean {
  return /^[0-9a-f]{40}$/.test(address);
}

function loadCapsuleCache(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CAPSULE_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed || {};
  } catch {
    return {};
  }
}

function saveCapsuleCache(cache: Record<string, string>): void {
  try {
    localStorage.setItem(CAPSULE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore cache write failures.
  }
}

function loadOrgPublicKeyCache(): Record<string, PublicKeyNew> {
  try {
    const raw = localStorage.getItem(ORG_PUBLIC_KEY_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PublicKeyNew>;
    return parsed || {};
  } catch {
    return {};
  }
}

function saveOrgPublicKeyCache(cache: Record<string, PublicKeyNew>): void {
  try {
    localStorage.setItem(ORG_PUBLIC_KEY_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore cache write failures.
  }
}

function normalizePublicKey(pubKey?: PublicKeyNew | null): PublicKeyNew | null {
  if (!pubKey || pubKey.X === undefined || pubKey.X === null || pubKey.Y === undefined || pubKey.Y === null) {
    return null;
  }

  const xVal = typeof pubKey.X === 'bigint' ? pubKey.X.toString(10) : String(pubKey.X);
  const yVal = typeof pubKey.Y === 'bigint' ? pubKey.Y.toString(10) : String(pubKey.Y);

  return {
    CurveName: pubKey.CurveName || 'P256',
    X: xVal,
    Y: yVal
  };
}

function getCachedOrgPublicKey(orgId: string): PublicKeyNew | null {
  const cache = loadOrgPublicKeyCache();
  return normalizePublicKey(cache[orgId]);
}

function cacheOrgPublicKey(orgId: string, pubKey: PublicKeyNew): void {
  const normalized = normalizePublicKey(pubKey);
  if (!normalized) return;
  const cache = loadOrgPublicKeyCache();
  cache[orgId] = normalized;
  saveOrgPublicKeyCache(cache);
}

function buildCapsuleCacheKey(orgId: string, address: string): string {
  return `${orgId}:${address}`;
}

export function clearCapsuleCache(): void {
  try {
    localStorage.removeItem(CAPSULE_CACHE_KEY);
  } catch {
    // Ignore cache clear failures.
  }
}

export function clearOrgPublicKeyCache(): void {
  try {
    localStorage.removeItem(ORG_PUBLIC_KEY_CACHE_KEY);
  } catch {
    // Ignore cache clear failures.
  }
}

export function isCapsuleAddress(input: string): boolean {
  try {
    parseCapsuleAddress(input);
    return true;
  } catch {
    return false;
  }
}

export function parseCapsuleAddress(input: string): { orgId: string; payload: string } {
  const raw = String(input || '').trim();
  const parts = raw.split('@');
  if (parts.length !== 2) {
    throw new Error(t('capsule.invalidFormat', 'Invalid capsule address format'));
  }
  const orgId = parts[0].trim();
  const payload = parts[1].trim();
  if (!/^\d{8}$/.test(orgId) || !payload) {
    throw new Error(t('capsule.invalidFormat', 'Invalid capsule address format'));
  }
  return { orgId, payload };
}

export async function requestCapsuleAddress(address: string): Promise<string> {
  const user = loadUser();
  if (!user || !user.accountId) {
    throw new Error(t('error.userNotLoggedIn', 'User not logged in'));
  }

  const normalized = normalizeAddress(address);
  if (!isValidAddressFormat(normalized)) {
    throw new Error(t('capsule.invalidFormat', 'Invalid capsule address format'));
  }

  const isInGroup = !!user.guarGroup?.groupID;
  const groupInfo = isInGroup ? getJoinedGroup() : null;
  const orgId = isInGroup ? (groupInfo?.groupID || user.guarGroup?.groupID || '') : COMMITTEE_ORG_ID;

  const cache = loadCapsuleCache();
  const cacheKey = buildCapsuleCacheKey(orgId, normalized);
  const cached = cache[cacheKey];
  if (cached) {
    return cached;
  }

  const requestBody: CapsuleAddressRequest = {
    UserID: isInGroup ? user.accountId : '',
    Address: normalized,
    Timestamp: getTimestamp()
  };

  if (isInGroup) {
    const privHex = await getDecryptedPrivateKeyWithPrompt(
      user.accountId,
      t('encryption.unlockForSigning', 'Unlock private key for signing'),
      t('capsule.signForCapsule', 'Generating a capsule address requires signing with your account private key. Please enter password to unlock it.')
    );
    if (!privHex) {
      throw new Error(t('common.operationCancelled', 'Operation cancelled'));
    }
    requestBody.Sig = signStruct(requestBody as unknown as Record<string, unknown>, privHex, ['Sig']);
  } else {
    const addrData = user.wallet?.addressMsg?.[normalized];
    const addressMeta =
      addrData ||
      Object.entries(user.wallet?.addressMsg || {}).find(([key]) => key.toLowerCase() === normalized)?.[1];
    const privHex = (addressMeta as { privHex?: string } | undefined)?.privHex || '';
    if (!privHex) {
      throw new Error(t('capsule.noPrivateKey', 'Address private key not found'));
    }
    const keyId = user.accountId ? `${user.accountId}_${normalized}` : '';
    const addressSignDesc = t(
      'capsule.signForAddress',
      'Generating a capsule address requires signing with the address private key. Please enter password to unlock it.'
    );
    if (keyId && hasEncryptedKey(keyId)) {
      const decrypted = await getDecryptedPrivateKeyWithPrompt(
        keyId,
        t('encryption.unlockForSigning', 'Unlock private key for signing'),
        addressSignDesc
      );
      if (!decrypted) {
        throw new Error(t('common.operationCancelled', 'Operation cancelled'));
      }
      requestBody.Sig = signStruct(requestBody as unknown as Record<string, unknown>, decrypted, ['Sig']);
    } else {
      const password = await showPasswordPrompt({
        title: t('encryption.unlockForSigning', 'Unlock private key for signing'),
        description: addressSignDesc
      });
      if (!password) {
        throw new Error(t('common.operationCancelled', 'Operation cancelled'));
      }
      requestBody.Sig = signStruct(requestBody as unknown as Record<string, unknown>, privHex, ['Sig']);
    }
  }

  let apiUrl = '';
  if (isInGroup) {
    if (!orgId) {
      throw new Error(t('capsule.orgNotFound', 'Organization information missing'));
    }
    if (groupInfo?.assignAPIEndpoint) {
      const assignNodeUrl = buildAssignNodeUrl(groupInfo.assignAPIEndpoint);
      apiUrl = `${assignNodeUrl}${API_ENDPOINTS.ASSIGN_CAPSULE_GENERATE(orgId)}`;
    } else {
      apiUrl = `${API_BASE_URL}${API_ENDPOINTS.ASSIGN_CAPSULE_GENERATE(orgId)}`;
    }
  } else {
    const comNodeUrl = await getComNodeURL(false, false);
    if (!comNodeUrl) {
      throw new Error(t('comNode.notAvailable', 'ComNode not available'));
    }
    apiUrl = `${comNodeUrl}${API_ENDPOINTS.COM_CAPSULE_GENERATE}`;
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: serializeForBackend(requestBody)
  });

  const data = await response.json() as CapsuleAddressReply & { error?: string; message?: string };
  if (!response.ok) {
    const errorMsg = data.error || data.message || t('error.networkError', 'Network error');
    throw new Error(errorMsg);
  }
  if (!data.Success) {
    throw new Error(data.ErrorMsg || t('capsule.generateFailed', 'Failed to generate capsule address'));
  }

  cache[cacheKey] = data.CapsuleAddr;
  saveCapsuleCache(cache);

  return data.CapsuleAddr;
}

export async function verifyCapsuleAddress(capsule: string): Promise<CapsuleVerifyResult> {
  const { orgId, payload } = parseCapsuleAddress(capsule);

  const cachedKey = getCachedOrgPublicKey(orgId);
  let pubKey = cachedKey;

  if (!pubKey) {
    try {
      if (orgId === COMMITTEE_ORG_ID) {
        const comNodeUrl = await getComNodeURL(false, false);
        if (!comNodeUrl) {
          throw new Error(t('comNode.notAvailable', 'ComNode not available'));
        }
        const result = await apiClient.get<{ org_id: string; public_key: PublicKeyNew }>(
          `${comNodeUrl}${API_ENDPOINTS.COM_PUBLIC_KEY}`,
          { useBigIntParsing: true }
        );
        pubKey = normalizePublicKey(result.public_key);
      } else {
        const result = await apiClient.get<{ org_id: string; public_key: PublicKeyNew }>(
          `${API_ENDPOINTS.ORG_PUBLIC_KEY}?org_id=${encodeURIComponent(orgId)}`,
          { useBigIntParsing: true }
        );
        pubKey = normalizePublicKey(result.public_key);
      }
    } catch (error) {
      if (error instanceof ApiRequestError) {
        throw new Error(error.message || t('capsule.orgNotFound', 'Organization public key not found'));
      }
      throw new Error(t('capsule.orgNotFound', 'Organization public key not found'));
    }
  }

  if (!pubKey) {
    throw new Error(t('capsule.orgNotFound', 'Organization public key not found'));
  }

  cacheOrgPublicKey(orgId, pubKey);

  let payloadBytes: Uint8Array;
  try {
    payloadBytes = base58CheckDecode(payload);
  } catch {
    throw new Error(t('capsule.invalidFormat', 'Invalid capsule address format'));
  }

  if (payloadBytes.length !== CAPSULE_PAYLOAD_LEN) {
    throw new Error(t('capsule.invalidFormat', 'Invalid capsule address format'));
  }

  const maskedAddr = payloadBytes.slice(0, CAPSULE_MASK_LEN);
  const rBytes = payloadBytes.slice(CAPSULE_MASK_LEN, CAPSULE_MASK_LEN + CAPSULE_SIG_PART_LEN);
  const sBytes = payloadBytes.slice(CAPSULE_MASK_LEN + CAPSULE_SIG_PART_LEN);

  const xHex = bigIntToHex(pubKey.X);
  const yHex = bigIntToHex(pubKey.Y);
  const sig = {
    r: bytesToHex(rBytes).padStart(64, '0'),
    s: bytesToHex(sBytes).padStart(64, '0')
  };

  const hashHex = sha256(maskedAddr);
  const key = ec.keyFromPublic({ x: xHex, y: yHex }, 'hex');
  if (!key.verify(hashHex, sig)) {
    throw new Error(t('capsule.verifyFailed', 'Capsule address verification failed'));
  }

  const saltBytes = new TextEncoder().encode(CAPSULE_MASK_SALT);
  const maskData = concatBytes(hexToBytes(xHex), hexToBytes(yHex), saltBytes);
  const maskHash = sha256.array(maskData);
  const mask = Uint8Array.from(maskHash.slice(0, CAPSULE_MASK_LEN));

  const realAddrBytes = xorBytes(maskedAddr, mask);
  const address = bytesToHex(realAddrBytes);

  return { address, orgId };
}

function xorBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) {
    out[i] = a[i] ^ b[i];
  }
  return out;
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
