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
  SESSION_USER_ID_KEY,
  DEFAULT_GROUP,
  GROUP_LIST,
  GuarantorGroup
} from '../config/constants';
import { store, setUser, selectUser } from './store.js';
import { UTXOData, TxCertificate, PublicKeyEnvelope } from '../types/blockchain';
import {
  AlgorithmECDSAP256,
  convertPublicKeyToHex,
  decodeBackendBytes,
  publicKeyEnvelopeFromHex,
  type PublicKeyNew as SignaturePublicKey
} from './signature';
import { deriveAddressKeypairFromAddressRootSeed } from './addressRootSeed';
import {
  DefaultSeedChainLength,
  buildInitialSeedMetaFromPrivateKey,
  recoverDeterministicSeedChainStateFromPrivateKey
} from './seedChain';
import { hasEncryptedKey } from './keyEncryption';

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
  addressRootSeedHex?: string;
  /** Whether address is locked (external import without private key) */
  locked?: boolean;
  /** Public key from backend (for external addresses) */
  publicKeyNew?: SignaturePublicKey | null;
  lastHeight?: number;
  signPublicKeyV2?: PublicKeyEnvelope | null;
  seedAnchor?: number[] | string;
  seedChainStep?: number;
  defaultSpendAlgorithm?: string;
  registrationState?: AddressRegistrationState;
  registrationError?: string;
  seedRepairRequired?: boolean;
  readOnly?: boolean;
  lastProtocolSyncAt?: number;
  seedLocalState?: AddressSeedLocalState | null;
  pendingSeedStep?: number;
  pendingNextSeedStep?: number;
  pendingSeedTxId?: string;
  pendingSeedAt?: number;
}

export type AddressRegistrationState = 'unknown' | 'pending' | 'registered' | 'failed';

export interface AddressSeedLocalState {
  mode: 'deterministic_p256';
  chainLength: number;
  step: number;
  generation?: number;
  source: 'plain' | 'encrypted' | 'missing';
  available: boolean;
  requiresUnlock?: boolean;
  lastRecoveredAt?: number;
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
  /** Addresses intentionally removed locally; async sync should not restore them implicitly */
  deletedAddresses?: Record<string, number>;
}

/** User profile structure */
export interface UserProfile {
  nickname: string;
  avatar: string | null;
  signature: string;
}

function decodeOptionalBytes(value: unknown): number[] {
  try {
    return decodeBackendBytes(value);
  } catch {
    return [];
  }
}

function normalizeHexString(value: unknown): string {
  return String(value || '').replace(/^0x/i, '').toLowerCase();
}

function normalizeDeletedAddressesMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const out: Record<string, number> = {};
  for (const [rawAddress, rawTime] of Object.entries(value as Record<string, unknown>)) {
    const address = String(rawAddress || '').toLowerCase();
    if (!address) continue;
    const ts = Number(rawTime || 0);
    out[address] = Number.isFinite(ts) && ts > 0 ? ts : Date.now();
  }
  return out;
}

function hexToDecimalString(value: string): string {
  const normalized = normalizeHexString(value);
  if (!normalized) return '0';
  return BigInt(`0x${normalized}`).toString(10);
}

function normalizeAddressValue(value: Partial<AddressValue> | Record<string, unknown> | undefined | null): AddressValue {
  const totalValue = Number((value as any)?.totalValue ?? (value as any)?.TotalValue ?? 0);
  const utxoValue = Number((value as any)?.utxoValue ?? (value as any)?.UTXOValue ?? totalValue);
  const txCerValue = Number((value as any)?.txCerValue ?? (value as any)?.TXCerValue ?? 0);
  return {
    totalValue,
    TotalValue: totalValue,
    utxoValue,
    txCerValue
  };
}

function isRegistrationState(value: unknown): value is AddressRegistrationState {
  return value === 'unknown' || value === 'pending' || value === 'registered' || value === 'failed';
}

function isEmptyPublicKeyEnvelope(value: PublicKeyEnvelope | null | undefined): boolean {
  if (!value) return true;
  const algorithm = String(value.Algorithm || '').trim();
  if (!algorithm) return true;
  return decodeOptionalBytes(value.PublicKey).length === 0;
}

function normalizeStoredPublicKey(
  value: unknown,
  fallbackPubXHex?: string,
  fallbackPubYHex?: string
): SignaturePublicKey | undefined {
  const raw = (value && typeof value === 'object') ? value as Record<string, unknown> : null;
  let pubXHex = normalizeHexString(raw?.XHex ?? fallbackPubXHex);
  let pubYHex = normalizeHexString(raw?.YHex ?? fallbackPubYHex);

  const x = raw?.X != null ? String(raw.X) : undefined;
  const y = raw?.Y != null ? String(raw.Y) : undefined;

  if ((!pubXHex || !pubYHex) && x && y) {
    try {
      const converted = convertPublicKeyToHex({
        CurveName: String(raw?.CurveName || raw?.Curve || 'P256'),
        X: x,
        Y: y
      } as SignaturePublicKey);
      pubXHex = pubXHex || converted.x;
      pubYHex = pubYHex || converted.y;
    } catch {
      // Ignore malformed legacy data and fall back to whatever is available.
    }
  }

  if ((!x || !y) && pubXHex && pubYHex) {
    return {
      CurveName: String(raw?.CurveName || raw?.Curve || 'P256'),
      X: x || hexToDecimalString(pubXHex),
      Y: y || hexToDecimalString(pubYHex)
    };
  }

  if (!x || !y) {
    return undefined;
  }

  return {
    CurveName: String(raw?.CurveName || raw?.Curve || 'P256'),
    X: x,
    Y: y
  };
}

function reconcileAddressRootSeedDerivedData(
  address: string,
  current: Record<string, unknown>
): Record<string, unknown> {
  const normalizedAddress = String(address || '').toLowerCase();
  const rootSeedHex = normalizeHexString(current.addressRootSeedHex);
  if (!rootSeedHex) {
    return current;
  }

  const candidateTypes = [0, 1, 2];
  for (const candidateType of candidateTypes) {
    const derived = deriveAddressKeypairFromAddressRootSeed(rootSeedHex, candidateType);
    if (String(derived.address || '').toLowerCase() !== normalizedAddress) {
      continue;
    }
    return {
      ...current,
      type: candidateType,
      privHex: derived.privHex,
      pubXHex: derived.pubXHex,
      pubYHex: derived.pubYHex,
      addressRootSeedHex: derived.addressRootSeedHex
    };
  }

  return current;
}

export function getAccountPublicKeyHex(user: Partial<User> | null | undefined): { x: string; y: string } | null {
  const pubXHex = normalizeHexString(user?.pubXHex || user?.keys?.pubXHex);
  const pubYHex = normalizeHexString(user?.pubYHex || user?.keys?.pubYHex);
  if (!pubXHex || !pubYHex) {
    return null;
  }
  return { x: pubXHex, y: pubYHex };
}

export function getAccountSignPublicKeyV2(user: Partial<User> | null | undefined): PublicKeyEnvelope | null {
  const accountPub = getAccountPublicKeyHex(user);
  if (!accountPub) {
    return null;
  }
  return publicKeyEnvelopeFromHex(accountPub.x, accountPub.y);
}

function getAddressEncryptedKeyId(accountId: string, address: string, accountAddress?: string): string {
  const normalizedAddress = String(address || '').toLowerCase();
  const normalizedMain = String(accountAddress || '').toLowerCase();
  if (normalizedMain && normalizedAddress === normalizedMain) {
    return accountId;
  }
  return `${accountId}_${normalizedAddress}`;
}

function hasLocalAddressKey(
  accountId: string | undefined,
  address: string,
  addrData: Partial<AddressData>,
  accountAddress?: string,
  topLevelPrivHex?: string
): { available: boolean; source: 'plain' | 'encrypted' | 'missing' } {
  const normalizedPrivHex = normalizeHexString(addrData.privHex);
  if (normalizedPrivHex) {
    return { available: true, source: 'plain' };
  }

  if (topLevelPrivHex && String(address || '').toLowerCase() === String(accountAddress || '').toLowerCase()) {
    return { available: true, source: 'plain' };
  }

  if (accountId) {
    const keyId = getAddressEncryptedKeyId(accountId, address, accountAddress);
    if (hasEncryptedKey(keyId)) {
      return { available: true, source: 'encrypted' };
    }
  }

  return { available: false, source: 'missing' };
}

function recoverAddressSeedState(
  address: string,
  addrData: Partial<AddressData>,
  accountId?: string,
  accountAddress?: string,
  topLevelPrivHex?: string
): {
  seedAnchor?: number[];
  seedChainStep?: number;
  defaultSpendAlgorithm?: string;
  seedLocalState: AddressSeedLocalState;
  readOnly: boolean;
  seedRepairRequired: boolean;
} {
  const normalizedAddress = String(address || '').toLowerCase();
  const normalizedMain = String(accountAddress || '').toLowerCase();
  const chainLength = Number(addrData.seedLocalState?.chainLength || DefaultSeedChainLength) || DefaultSeedChainLength;
  const providedAnchor = decodeOptionalBytes(addrData.seedAnchor);
  const rawStep = Number(addrData.seedChainStep ?? addrData.seedLocalState?.step ?? 0);
  const providedStep = Number.isFinite(rawStep) && rawStep >= 0 ? rawStep : 0;
  const normalizedPrivHex = normalizeHexString(
    addrData.privHex || (normalizedMain && normalizedAddress === normalizedMain ? topLevelPrivHex : '')
  );
  const now = Date.now();
  const existingLocalState = addrData.seedLocalState || null;

  // Fast path: when the address already has a usable local seed state and the
  // on-chain seed metadata hasn't changed, reuse it instead of recomputing the
  // whole deterministic seed chain on every saveUser()/normalize pass.
  if (
    normalizedPrivHex &&
    existingLocalState?.available &&
    !addrData.seedRepairRequired &&
    !addrData.readOnly &&
    Number(existingLocalState.chainLength || 0) === chainLength &&
    providedAnchor.length > 0 &&
    providedStep > 0 &&
    Number(existingLocalState.step || 0) === providedStep
  ) {
    return {
      seedAnchor: [...providedAnchor],
      seedChainStep: providedStep,
      defaultSpendAlgorithm: String(addrData.defaultSpendAlgorithm || '').trim() || AlgorithmECDSAP256,
      seedLocalState: {
        ...existingLocalState,
        mode: 'deterministic_p256',
        chainLength,
        step: providedStep,
        source: existingLocalState.source || 'plain',
        available: true
      },
      readOnly: false,
      seedRepairRequired: false
    };
  }

  if (normalizedPrivHex) {
    try {
      if (providedAnchor.length > 0 && providedStep >= 0 && providedStep <= chainLength) {
        const recovered = recoverDeterministicSeedChainStateFromPrivateKey(
          normalizedPrivHex,
          chainLength,
          providedStep,
          providedAnchor
        );
        return {
          seedAnchor: providedAnchor.length > 0 ? providedAnchor : undefined,
          seedChainStep: providedStep,
          defaultSpendAlgorithm: String(addrData.defaultSpendAlgorithm || '').trim() || AlgorithmECDSAP256,
          seedLocalState: {
            mode: 'deterministic_p256',
            chainLength,
            step: providedStep,
            generation: recovered.generation,
            source: 'plain',
            available: true,
            lastRecoveredAt: now
          },
          readOnly: false,
          seedRepairRequired: false
        };
      }

      const recovered = buildInitialSeedMetaFromPrivateKey(normalizedPrivHex);

      return {
        seedAnchor: providedAnchor.length > 0 ? providedAnchor : [...recovered.seedAnchor],
        seedChainStep: providedStep > 0 ? providedStep : recovered.seedChainStep,
        defaultSpendAlgorithm: String(addrData.defaultSpendAlgorithm || '').trim() || recovered.defaultSpendAlgorithm,
        seedLocalState: {
          mode: 'deterministic_p256',
          chainLength,
          step: providedStep > 0 ? providedStep : recovered.seedChainStep,
          generation: recovered.state.generation,
          source: 'plain',
          available: true,
          lastRecoveredAt: now
        },
        readOnly: false,
        seedRepairRequired: false
      };
    } catch (error) {
      console.warn(`[Storage] Failed to recover seed state for ${normalizedAddress}:`, error);
      const fallback = buildInitialSeedMetaFromPrivateKey(normalizedPrivHex);
      return {
        seedAnchor: providedAnchor.length > 0 ? providedAnchor : [...fallback.seedAnchor],
        seedChainStep: providedStep > 0 ? providedStep : fallback.seedChainStep,
        defaultSpendAlgorithm: String(addrData.defaultSpendAlgorithm || '').trim() || fallback.defaultSpendAlgorithm,
        seedLocalState: {
          mode: 'deterministic_p256',
          chainLength,
          step: providedStep > 0 ? providedStep : fallback.seedChainStep,
          generation: fallback.state.generation,
          source: 'plain',
          available: true,
          lastRecoveredAt: now
        },
        readOnly: false,
        seedRepairRequired: false
      };
    }
  }

  const localKey = hasLocalAddressKey(accountId, normalizedAddress, addrData, accountAddress, topLevelPrivHex);
  const defaultSpendAlgorithm = String(addrData.defaultSpendAlgorithm || '').trim() || (providedAnchor.length > 0 ? AlgorithmECDSAP256 : '');
  const hasRemoteSeedMeta = providedAnchor.length > 0 && providedStep > 0;

  return {
    seedAnchor: providedAnchor.length > 0 ? providedAnchor : undefined,
    seedChainStep: providedStep > 0 ? providedStep : undefined,
    defaultSpendAlgorithm: defaultSpendAlgorithm || undefined,
    seedLocalState: {
      mode: 'deterministic_p256',
      chainLength,
      step: providedStep > 0 ? providedStep : chainLength,
      source: localKey.source,
      available: localKey.available,
      requiresUnlock: localKey.source === 'encrypted'
    },
    readOnly: hasRemoteSeedMeta && !localKey.available,
    seedRepairRequired: hasRemoteSeedMeta && !localKey.available
  };
}

export function hasAddressProtocolMetadata(addrData: Partial<AddressData> | null | undefined): boolean {
  if (!addrData) {
    return false;
  }
  return (
    !isEmptyPublicKeyEnvelope(addrData.signPublicKeyV2 || undefined) &&
    decodeOptionalBytes(addrData.seedAnchor).length > 0 &&
    Number(addrData.seedChainStep || 0) > 0 &&
    !!String(addrData.defaultSpendAlgorithm || '').trim()
  );
}

export function getAddressProtocolIssues(address: string, addrData: Partial<AddressData> | null | undefined): string[] {
  if (!addrData) {
    return [`${address}: missing local address metadata`];
  }
  const issues: string[] = [];
  if (!addrData.pubXHex || !addrData.pubYHex) {
    issues.push(`${address}: missing address public key`);
  }
  if (isEmptyPublicKeyEnvelope(addrData.signPublicKeyV2 || undefined)) {
    issues.push(`${address}: missing SignPublicKeyV2`);
  }
  if (decodeOptionalBytes(addrData.seedAnchor).length === 0) {
    issues.push(`${address}: missing SeedAnchor`);
  }
  if (Number(addrData.seedChainStep || 0) <= 0) {
    issues.push(`${address}: invalid SeedChainStep`);
  }
  if (!String(addrData.defaultSpendAlgorithm || '').trim()) {
    issues.push(`${address}: missing DefaultSpendAlgorithm`);
  }
  if (addrData.seedRepairRequired) {
    issues.push(`${address}: local seed state missing`);
  }
  if (addrData.readOnly) {
    issues.push(`${address}: address is read-only`);
  }
  return issues;
}

export function normalizeAddressDataForStorage(
  address: string,
  addrData: Partial<AddressData> | null | undefined,
  context: {
    accountId?: string;
    accountAddress?: string;
    accountPubXHex?: string;
    accountPubYHex?: string;
    topLevelPrivHex?: string;
    syncTime?: number;
  } = {}
): AddressData {
  const current = reconcileAddressRootSeedDerivedData(
    address,
    (addrData || {}) as Record<string, unknown>
  );
  const pubXHex = normalizeHexString(current.pubXHex);
  const pubYHex = normalizeHexString(current.pubYHex);
  const publicKeyNew = normalizeStoredPublicKey(current.publicKeyNew ?? current.PublicKeyNew, pubXHex, pubYHex);
  let normalizedPubXHex = pubXHex;
  let normalizedPubYHex = pubYHex;

  if ((!normalizedPubXHex || !normalizedPubYHex) && publicKeyNew) {
    try {
      const converted = convertPublicKeyToHex(publicKeyNew);
      normalizedPubXHex = normalizedPubXHex || converted.x;
      normalizedPubYHex = normalizedPubYHex || converted.y;
    } catch {
      // Ignore malformed legacy public key encodings.
    }
  }

  const protocolState = recoverAddressSeedState(
    address,
    current as Partial<AddressData>,
    context.accountId,
    context.accountAddress,
    context.topLevelPrivHex
  );
  const accountSignPublicKeyV2 = (context.accountPubXHex && context.accountPubYHex)
    ? publicKeyEnvelopeFromHex(context.accountPubXHex, context.accountPubYHex)
    : null;
  const existingSignPublicKeyV2 = current.signPublicKeyV2 as PublicKeyEnvelope | undefined;
  const signPublicKeyV2 = !isEmptyPublicKeyEnvelope(existingSignPublicKeyV2)
    ? existingSignPublicKeyV2
    : accountSignPublicKeyV2;
  const syncTime = Number(current.lastProtocolSyncAt || context.syncTime || 0) || undefined;

  let registrationState: AddressRegistrationState = 'unknown';
  if (isRegistrationState(current.registrationState)) {
    registrationState = current.registrationState;
  } else if (current.registrationError) {
    registrationState = 'failed';
  }

  return {
    type: Number(current.type ?? current.Type ?? 0),
    utxos: ((current.utxos ?? current.UTXO) as Record<string, UTXOData>) || {},
    txCers: ((current.txCers ?? current.TXCers) as Record<string, number>) || {},
    value: normalizeAddressValue((current.value ?? current.Value) as Partial<AddressValue>),
    estInterest: Number(current.estInterest ?? current.EstInterest ?? current.Interest ?? current.gas ?? 0),
    gas: Number(current.gas ?? current.estInterest ?? current.EstInterest ?? current.Interest ?? 0),
    origin: current.origin ? String(current.origin) : undefined,
    privHex: normalizeHexString(current.privHex) || undefined,
    pubXHex: normalizedPubXHex || undefined,
    pubYHex: normalizedPubYHex || undefined,
    addressRootSeedHex: normalizeHexString(current.addressRootSeedHex) || undefined,
    locked: Boolean(current.locked) || (String(current.origin || '') === 'external' && !protocolState.seedLocalState.available),
    publicKeyNew: publicKeyNew || undefined,
    lastHeight: Number(current.lastHeight ?? current.LastHeight ?? 0) || undefined,
    signPublicKeyV2: signPublicKeyV2 || undefined,
    seedAnchor: protocolState.seedAnchor && protocolState.seedAnchor.length > 0 ? protocolState.seedAnchor : undefined,
    seedChainStep: protocolState.seedChainStep,
    defaultSpendAlgorithm: protocolState.defaultSpendAlgorithm,
    registrationState,
    registrationError: registrationState === 'registered' ? undefined : (current.registrationError ? String(current.registrationError) : undefined),
    seedRepairRequired: Boolean(current.seedRepairRequired) || protocolState.seedRepairRequired,
    readOnly: Boolean(current.readOnly) || protocolState.readOnly,
    lastProtocolSyncAt: syncTime,
    seedLocalState: protocolState.seedLocalState,
    pendingSeedStep: Number(current.pendingSeedStep || 0) || undefined,
    pendingNextSeedStep: Number(current.pendingNextSeedStep || 0) || undefined,
    pendingSeedTxId: current.pendingSeedTxId ? String(current.pendingSeedTxId) : undefined,
    pendingSeedAt: Number(current.pendingSeedAt || 0) || undefined
  };
}

export function normalizeUserAccount(user: User | null): User | null {
  if (!user) {
    return null;
  }

  const normalized = JSON.parse(JSON.stringify(user)) as User;
  normalized.deletedAddresses = normalizeDeletedAddressesMap(normalized.deletedAddresses);
  normalized.keys = normalized.keys || { privHex: '', pubXHex: '', pubYHex: '' };
  normalized.wallet = normalized.wallet || {
    addressMsg: {},
    totalTXCers: {},
    totalValue: 0,
    valueDivision: { 0: 0, 1: 0, 2: 0 },
    updateTime: Date.now(),
    updateBlock: 0
  };
  normalized.wallet.addressMsg = normalized.wallet.addressMsg || {};
  normalized.wallet.totalTXCers = normalized.wallet.totalTXCers || {};
  normalized.wallet.valueDivision = {
    0: 0,
    1: 0,
    2: 0,
    ...(normalized.wallet.ValueDivision || normalized.wallet.valueDivision || {})
  };
  normalized.wallet.totalValue = Number(normalized.wallet.totalValue ?? normalized.wallet.TotalValue ?? 0);
  normalized.wallet.TotalValue = normalized.wallet.totalValue;

  const accountPub = getAccountPublicKeyHex(normalized);
  const normalizedAddressMsg: Record<string, AddressData> = {};
  for (const [rawAddress, data] of Object.entries(normalized.wallet.addressMsg)) {
    const address = String(rawAddress || '').toLowerCase();
    if (!address) {
      continue;
    }
    if (normalized.deletedAddresses?.[address]) {
      continue;
    }
    normalizedAddressMsg[address] = normalizeAddressDataForStorage(address, data, {
      accountId: normalized.accountId,
      accountAddress: normalized.address,
      accountPubXHex: accountPub?.x,
      accountPubYHex: accountPub?.y,
      topLevelPrivHex: normalized.privHex || normalized.keys?.privHex
    });
  }
  normalized.wallet.addressMsg = normalizedAddressMsg;
  return normalized;
}

export function mergeBackendWalletData(
  user: User,
  walletData: {
    Value?: number;
    TotalValue?: number;
    ValueDivision?: Record<number, number>;
    SubAddressMsg?: Record<string, unknown>;
  } | null | undefined,
  options: { syncTime?: number } = {}
): User {
  const normalized = normalizeUserAccount(user) as User;
  const syncTime = options.syncTime || Date.now();
  const accountPub = getAccountPublicKeyHex(normalized);
  const subAddressMsg = walletData?.SubAddressMsg || {};
  const isRetailMode = !normalized.isInGroup && !(normalized.orgNumber || normalized.guarGroup?.groupID);
  const deletedAddresses = normalized.deletedAddresses || {};

  normalized.wallet.totalValue = Number(walletData?.Value ?? walletData?.TotalValue ?? normalized.wallet.totalValue ?? 0);
  normalized.wallet.TotalValue = normalized.wallet.totalValue;
  if (walletData?.ValueDivision) {
    normalized.wallet.valueDivision = {
      0: 0,
      1: 0,
      2: 0,
      ...walletData.ValueDivision
    };
  }

  for (const [rawAddress, backendAddress] of Object.entries(subAddressMsg)) {
    const address = String(rawAddress || '').toLowerCase();
    if (!address) {
      continue;
    }
    if (deletedAddresses[address]) {
      continue;
    }
    const existing = normalized.wallet.addressMsg[address];
    const merged = normalizeAddressDataForStorage(address, {
      ...(existing || {}),
      ...(backendAddress as Record<string, unknown>),
      origin: existing?.origin || (existing?.privHex ? existing.origin : 'external'),
      locked: existing?.locked ?? (!existing?.privHex),
      registrationState: 'registered',
      registrationError: undefined,
      lastProtocolSyncAt: syncTime
    }, {
      accountId: normalized.accountId,
      accountAddress: normalized.address,
      accountPubXHex: accountPub?.x,
      accountPubYHex: accountPub?.y,
      topLevelPrivHex: normalized.privHex || normalized.keys?.privHex,
      syncTime
    });
    if (
      merged.pendingNextSeedStep &&
      merged.seedChainStep &&
      Number(merged.seedChainStep) === Number(merged.pendingNextSeedStep)
    ) {
      merged.pendingSeedStep = undefined;
      merged.pendingNextSeedStep = undefined;
      merged.pendingSeedTxId = undefined;
      merged.pendingSeedAt = undefined;
    }
    normalized.wallet.addressMsg[address] = merged;
  }

  normalized.wallet.updateTime = syncTime;
  return normalizeUserAccount(normalized) as User;
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
  if ((basic as any).deletedAddresses !== undefined) {
    acc.deletedAddresses = normalizeDeletedAddressesMap((basic as any).deletedAddresses);
  } else {
    acc.deletedAddresses = normalizeDeletedAddressesMap(acc.deletedAddresses);
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

  return normalizeUserAccount(acc as User) as User;
}

// ========================================
// Internal: Pure localStorage IO (no Store side effects)
// ========================================

/**
 * Get the current active account ID for this tab
 * 
 * Tab isolation logic:
 * 1. If SESSION_IGNORE_USER_KEY is set, return null (user chose "use another account")
 * 2. If SESSION_USER_ID_KEY exists in sessionStorage, use it (preserves user across refresh)
 * 3. Otherwise fall back to localStorage ACTIVE_ACCOUNT_KEY (initial tab open)
 */
function getActiveAccountId(): string | null {
  try {
    // Check session isolation flag - user explicitly chose to ignore stored user
    if (sessionStorage.getItem(SESSION_IGNORE_USER_KEY) === 'true') {
      return null;
    }

    // Check session-specific user ID first (tab isolation)
    const sessionUserId = sessionStorage.getItem(SESSION_USER_ID_KEY);
    if (sessionUserId) {
      return sessionUserId;
    }

    // Fall back to global active account (new tab)
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
 * 
 * Updates both localStorage (global) and sessionStorage (tab-specific).
 * This ensures:
 * - New tabs see the most recently logged-in user
 * - Existing tabs keep their own user on refresh
 */
function setActiveAccountId(accountId: string | null): void {
  try {
    if (accountId) {
      // Update global active account (for new tabs)
      localStorage.setItem(ACTIVE_ACCOUNT_KEY, accountId);
      // Update session-specific user ID (for this tab's refresh)
      sessionStorage.setItem(SESSION_USER_ID_KEY, accountId);
      // Clear the "ignore user" flag since we now have a valid user for this tab
      // This handles the case where user selected "use another account" and then logged in
      sessionStorage.removeItem(SESSION_IGNORE_USER_KEY);
    } else {
      localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
      sessionStorage.removeItem(SESSION_USER_ID_KEY);
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
      return normalizeUserAccount(JSON.parse(rawAcc) as User);
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
        return normalizeUserAccount(user);
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
        return normalizeUserAccount(acc);
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
  const user = normalizeUserAccount(readUserFromStorage());

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
  writeUserToStorage(normalizeUserAccount(user));
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
  const u = loadUser();
  if (u?.isInGroup === false) {
    console.debug('[Storage] getJoinedGroup: user not in group');
    return null;
  }

  // 1. First, try to get from user.guarGroup (contains full backend info)
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

  // 1.5. Try guarGroupBootMsg from login (contains API endpoints)
  if (u?.guarGroupBootMsg && u.orgNumber) {
    const boot = u.guarGroupBootMsg as any;
    const result = {
      groupID: u.orgNumber,
      aggreNode: boot.AggrID || boot.aggreNode || '',
      assignNode: boot.AssiID || boot.assignNode || '',
      pledgeAddress: boot.PledgeAddress || boot.pledgeAddress || '',
      assignAPIEndpoint: boot.AssignAPIEndpoint || boot.assignAPIEndpoint,
      aggrAPIEndpoint: boot.AggrAPIEndpoint || boot.aggrAPIEndpoint
    };
    console.debug('[Storage] getJoinedGroup from guarGroupBootMsg:', result);
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
    const result = g || {
      groupID: gid,
      aggreNode: '',
      assignNode: '',
      pledgeAddress: ''
    };
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

