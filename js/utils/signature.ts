/**
 * Signature and backend JSON utilities aligned with the Go backend.
 */

import { ec as EC } from 'elliptic';
import { sha256 } from 'js-sha256';

const ec = new EC('p256');

export const AlgorithmECDSAP256 = 'ecdsa_p256';

const BYTE_ARRAY_FIELDS = new Set([
  'TXOutputHash',
  'Data',
  'SeedReveal',
  'SeedAnchor',
  'Signature',
  'PublicKey'
]);

const SORTED_MAP_FIELDS = new Set([
  'AddressMsg',
  'GuarTable',
  'ValueDivision',
  'NewValueDiv',
  'BackAssign',
  'Addresstogroup'
]);

export interface PublicKeyNew {
  CurveName: string;
  X: bigint | string;
  Y: bigint | string;
}

export interface EcdsaSignature {
  R: bigint | string | null;
  S: bigint | string | null;
}

export interface EcdsaSignatureWire {
  R: string | null;
  S: string | null;
}

export interface SignatureEnvelope {
  Algorithm: string;
  Signature: number[] | string | null;
}

export interface PublicKeyEnvelope {
  Algorithm: string;
  PublicKey: number[] | string | null;
}

function hasBuffer(): boolean {
  return typeof globalThis !== 'undefined' && typeof (globalThis as { Buffer?: unknown }).Buffer !== 'undefined';
}

export function normalizePrivateKeyHex(privateKeyHex: string): string {
  return String(privateKeyHex || '').replace(/^0x/i, '').toLowerCase().padStart(64, '0');
}

export function isByteNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => Number.isInteger(item) && item >= 0 && item <= 255);
}

export function hexToBytes(hex: string): number[] {
  const normalized = String(hex || '').replace(/^0x/i, '').toLowerCase();
  if (!normalized) return [];
  if (!/^[0-9a-f]+$/.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error('Invalid hex string');
  }
  const out: number[] = [];
  for (let i = 0; i < normalized.length; i += 2) {
    out.push(parseInt(normalized.slice(i, i + 2), 16));
  }
  return out;
}

export function bytesToHex(bytes: ArrayLike<number> | null | undefined): string {
  if (!bytes) return '';
  return Array.from(bytes, (value) => Number(value).toString(16).padStart(2, '0')).join('');
}

export function bytesToBase64(bytes: ArrayLike<number> | null | undefined): string {
  if (!bytes) return '';
  const arr = Uint8Array.from(Array.from(bytes, (value) => Number(value)));
  if (arr.length === 0) return '';
  if (hasBuffer()) {
    return Buffer.from(arr).toString('base64');
  }
  let binary = '';
  for (const byte of arr) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): number[] {
  const normalized = String(base64 || '').trim();
  if (!normalized) return [];
  if (hasBuffer()) {
    return Array.from(Buffer.from(normalized, 'base64'));
  }
  const binary = atob(normalized);
  const out: number[] = [];
  for (let i = 0; i < binary.length; i += 1) {
    out.push(binary.charCodeAt(i));
  }
  return out;
}

export function decodeBackendBytes(value: unknown): number[] {
  if (value == null) return [];
  if (value instanceof Uint8Array) return Array.from(value);
  if (isByteNumberArray(value)) return [...value];
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) return [];
    try {
      return base64ToBytes(normalized);
    } catch {
      if (/^[0-9a-f]+$/i.test(normalized) && normalized.length % 2 === 0) {
        return hexToBytes(normalized);
      }
      throw new Error('Invalid backend byte string');
    }
  }
  return [];
}

export function hexToBigInt(hex: string): bigint {
  const normalized = String(hex || '').replace(/^0x/i, '');
  if (!normalized) return 0n;
  return BigInt(`0x${normalized}`);
}

function decimalLikeToBigInt(value: bigint | string | number | null | undefined): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(Math.trunc(value));
  if (value == null || value === '') return 0n;
  const text = String(value).trim();
  if (!text) return 0n;
  if (/^0x/i.test(text)) return BigInt(text);
  return BigInt(text);
}

export function bigIntToHex(value: bigint | string | number | null | undefined, padLength: number = 64): string {
  return decimalLikeToBigInt(value).toString(16).padStart(padLength, '0');
}

function bigintReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString(10);
  }
  return value;
}

function cloneForBackend(value: unknown, key?: string): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'bigint') return value.toString(10);
  if (value instanceof Uint8Array) {
    return BYTE_ARRAY_FIELDS.has(String(key || '')) ? bytesToBase64(value) : Array.from(value);
  }
  if (Array.isArray(value)) {
    if (BYTE_ARRAY_FIELDS.has(String(key || '')) && isByteNumberArray(value)) {
      return bytesToBase64(value);
    }
    return value.map((item) => cloneForBackend(item));
  }
  if (typeof value !== 'object') return value;

  const entries = Object.entries(value as Record<string, unknown>);
  const sortedEntries = SORTED_MAP_FIELDS.has(String(key || ''))
    ? [...entries].sort(([left], [right]) => left.localeCompare(right))
    : entries;

  const output: Record<string, unknown> = {};
  for (const [childKey, childValue] of sortedEntries) {
    output[childKey] = cloneForBackend(childValue, childKey);
  }
  return output;
}

function applyExcludeZeroValue(obj: Record<string, unknown>, excludeFields: string[]): void {
  for (const field of excludeFields) {
    if (field === 'UserSig' || field === 'Sig' || field === 'GroupSig' || field === 'UserSignature' || field === 'InputSignature') {
      obj[field] = { R: null, S: null };
      continue;
    }
    if (field === 'UserSignatureV2' || field === 'InputSignatureV2' || field === 'AddressOwnershipSig') {
      obj[field] = { Algorithm: '', Signature: null };
      continue;
    }
    if (field === 'SignPublicKeyV2' || field === 'SeedPublicKeyV2') {
      obj[field] = { Algorithm: '', PublicKey: null };
      continue;
    }
    const current = obj[field];
    if (Array.isArray(current)) {
      obj[field] = [];
    } else if (typeof current === 'number') {
      obj[field] = 0;
    } else if (typeof current === 'string') {
      obj[field] = '';
    } else if (current && typeof current === 'object') {
      obj[field] = {};
    } else {
      obj[field] = current ?? null;
    }
  }
}

export function serializeForBackend(obj: unknown): string {
  const prepared = cloneForBackend(obj);
  let json = JSON.stringify(prepared, bigintReplacer);
  json = json.replace(/"(X|Y|R|S|D)":"(-?\d+)"/g, '"$1":$2');
  return json;
}

function buildStructHashBytes(data: Record<string, unknown>, excludeFields: string[] = []): number[] {
  const copy = JSON.parse(JSON.stringify(data, bigintReplacer)) as Record<string, unknown>;
  applyExcludeZeroValue(copy, excludeFields);
  const jsonStr = serializeForBackend(copy);
  return sha256.array(jsonStr);
}

export function signStruct(
  data: Record<string, unknown>,
  privateKeyHex: string,
  excludeFields: string[] = []
): EcdsaSignature {
  const hashBytes = buildStructHashBytes(data, excludeFields);
  const key = ec.keyFromPrivate(normalizePrivateKeyHex(privateKeyHex), 'hex');
  const signature = key.sign(hashBytes);
  return {
    R: BigInt(`0x${signature.r.toString(16)}`),
    S: BigInt(`0x${signature.s.toString(16)}`)
  };
}

export function verifyStruct(
  data: Record<string, unknown>,
  signature: EcdsaSignature,
  publicKeyHex: string,
  publicKeyYHex: string,
  excludeFields: string[] = []
): boolean {
  try {
    const hashBytes = buildStructHashBytes(data, excludeFields);
    const key = ec.keyFromPublic({
      x: publicKeyHex,
      y: publicKeyYHex
    }, 'hex');
    return key.verify(hashBytes, {
      r: decimalLikeToBigInt(signature.R).toString(16),
      s: decimalLikeToBigInt(signature.S).toString(16)
    });
  } catch (error) {
    console.error('[signature] verifyStruct failed:', error);
    return false;
  }
}

export function signatureToJSON(signature: EcdsaSignature): EcdsaSignatureWire {
  return {
    R: signature.R == null ? null : decimalLikeToBigInt(signature.R).toString(10),
    S: signature.S == null ? null : decimalLikeToBigInt(signature.S).toString(10)
  };
}

export function convertHexToPublicKey(pubXHex: string, pubYHex: string): PublicKeyNew {
  return {
    CurveName: 'P256',
    X: hexToBigInt(pubXHex),
    Y: hexToBigInt(pubYHex)
  };
}

export function convertPublicKeyToHex(publicKey: PublicKeyNew): { x: string; y: string } {
  return {
    x: bigIntToHex(publicKey.X),
    y: bigIntToHex(publicKey.Y)
  };
}

export function getPublicKeyFromPrivate(privateKeyHex: string): PublicKeyNew {
  const key = ec.keyFromPrivate(normalizePrivateKeyHex(privateKeyHex), 'hex');
  const pubPoint = key.getPublic();
  return {
    CurveName: 'P256',
    X: BigInt(`0x${pubPoint.getX().toString(16)}`),
    Y: BigInt(`0x${pubPoint.getY().toString(16)}`)
  };
}

export function getPublicKeyHexFromPrivate(privateKeyHex: string): { x: string; y: string } {
  const key = ec.keyFromPrivate(normalizePrivateKeyHex(privateKeyHex), 'hex');
  const pubPoint = key.getPublic();
  return {
    x: pubPoint.getX().toString(16).padStart(64, '0'),
    y: pubPoint.getY().toString(16).padStart(64, '0')
  };
}

export function generateKeyPair(): { privateKey: string; publicKey: PublicKeyNew } {
  const key = ec.genKeyPair();
  return {
    privateKey: key.getPrivate('hex').padStart(64, '0'),
    publicKey: {
      CurveName: 'P256',
      X: BigInt(`0x${key.getPublic().getX().toString(16)}`),
      Y: BigInt(`0x${key.getPublic().getY().toString(16)}`)
    }
  };
}

export function generateAddress(publicKey: PublicKeyNew): string {
  const xHex = bigIntToHex(publicKey.X);
  const yHex = bigIntToHex(publicKey.Y);
  const publicKeyBytes = hexToBytes(`04${xHex}${yHex}`);
  return sha256(publicKeyBytes).substring(0, 40);
}

export function getTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

export function getCustomEpochTimestamp(): number {
  const epoch2020 = new Date('2020-01-01T00:00:00Z').getTime();
  return Math.floor((Date.now() - epoch2020) / 1000);
}

export function publicKeyEnvelopeFromHex(pubXHex: string, pubYHex: string): PublicKeyEnvelope {
  const x = String(pubXHex || '').padStart(64, '0');
  const y = String(pubYHex || '').padStart(64, '0');
  return {
    Algorithm: AlgorithmECDSAP256,
    PublicKey: hexToBytes(`04${x}${y}`)
  };
}

export function publicKeyEnvelopeFromPrivate(privateKeyHex: string): PublicKeyEnvelope {
  const { x, y } = getPublicKeyHexFromPrivate(privateKeyHex);
  return publicKeyEnvelopeFromHex(x, y);
}

export function publicKeyEnvelopeFromPublicKey(publicKey: PublicKeyNew): PublicKeyEnvelope {
  const { x, y } = convertPublicKeyToHex(publicKey);
  return publicKeyEnvelopeFromHex(x, y);
}

export function signHashEnvelope(
  algorithm: string,
  hash: ArrayLike<number>,
  privateKeyHex: string
): SignatureEnvelope {
  if (algorithm !== AlgorithmECDSAP256) {
    throw new Error(`Unsupported signature algorithm: ${algorithm}`);
  }
  const key = ec.keyFromPrivate(normalizePrivateKeyHex(privateKeyHex), 'hex');
  const signature = key.sign(Array.from(hash));
  return {
    Algorithm: algorithm,
    Signature: signature.toDER()
  };
}

export function verifyHashEnvelope(
  hash: ArrayLike<number>,
  signature: SignatureEnvelope,
  publicKey: PublicKeyEnvelope
): boolean {
  if (signature.Algorithm !== publicKey.Algorithm) {
    return false;
  }
  if (signature.Algorithm !== AlgorithmECDSAP256) {
    return false;
  }
  const publicKeyBytes = decodeBackendBytes(publicKey.PublicKey);
  const signatureBytes = decodeBackendBytes(signature.Signature);
  if (publicKeyBytes.length === 0 || signatureBytes.length === 0) {
    return false;
  }
  const key = ec.keyFromPublic(bytesToHex(publicKeyBytes), 'hex');
  return key.verify(Array.from(hash), signatureBytes);
}

export function hashBackendJson(data: unknown): number[] {
  return sha256.array(serializeForBackend(data));
}
