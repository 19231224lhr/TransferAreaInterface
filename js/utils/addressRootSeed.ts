/**
 * Address-level root seed helpers aligned with the backend per-address seed model.
 */

import CryptoJS from 'crypto-js';
import { sha256 } from 'js-sha256';
import { ec as EC } from 'elliptic';
import { bytesToHex, hexToBytes } from './crypto';

const ec = new EC('p256');

export const ADDRESS_ROOT_SEED_SIZE = 32;
export const ADDRESS_ROOT_SEED_PREFIX = 'arsk_';
const addressRootSeedDeriveDomainTag = 'utxo-address-root-seed:v1';
const P256_ORDER = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');
const ADDRESS_TYPE_LABELS: Record<number, string> = {
  0: 'pgc',
  1: 'btc',
  2: 'eth'
};
const ADDRESS_TYPE_IDS: Record<string, number> = {
  pgc: 0,
  btc: 1,
  eth: 2
};

function bytesToWordArray(bytes: Uint8Array): CryptoJS.lib.WordArray {
  const words: number[] = [];
  for (let i = 0; i < bytes.length; i += 4) {
    words.push(
      ((bytes[i] || 0) << 24) |
      ((bytes[i + 1] || 0) << 16) |
      ((bytes[i + 2] || 0) << 8) |
      (bytes[i + 3] || 0)
    );
  }
  return CryptoJS.lib.WordArray.create(words, bytes.length);
}

function hmacSha256Bytes(keyBytes: Uint8Array, messageBytes: Uint8Array): Uint8Array {
  const digest = CryptoJS.HmacSHA256(bytesToWordArray(messageBytes), bytesToWordArray(keyBytes));
  return hexToBytes(digest.toString(CryptoJS.enc.Hex));
}

function uint32be(value: number): Uint8Array {
  const out = new Uint8Array(4);
  out[0] = (value >>> 24) & 0xff;
  out[1] = (value >>> 16) & 0xff;
  out[2] = (value >>> 8) & 0xff;
  out[3] = value & 0xff;
  return out;
}

export function generateAddressRootSeedHex(): string {
  const bytes = new Uint8Array(ADDRESS_ROOT_SEED_SIZE);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export function formatAddressRootSeedForExport(rootSeedHex: string, addressType?: number): string {
  const normalized = String(rootSeedHex || '').replace(/^0x/i, '').toLowerCase();
  const label = typeof addressType === 'number' ? ADDRESS_TYPE_LABELS[addressType] : '';
  if (label) {
    return `${ADDRESS_ROOT_SEED_PREFIX}${label}_${normalized}`;
  }
  return `${ADDRESS_ROOT_SEED_PREFIX}${normalized}`;
}

export function parseAddressRecoveryMaterial(input: string): {
  kind: 'root_seed' | 'private_key';
  hex: string;
  addressType?: number;
} {
  const raw = String(input || '').trim();
  const lower = raw.toLowerCase();

  const typedRootSeedMatch = lower.match(/arsk_(pgc|btc|eth)_(?:0x)?([0-9a-f]{64})/i);
  if (typedRootSeedMatch?.[1] && typedRootSeedMatch?.[2]) {
    return {
      kind: 'root_seed',
      hex: typedRootSeedMatch[2].toLowerCase(),
      addressType: ADDRESS_TYPE_IDS[typedRootSeedMatch[1].toLowerCase()]
    };
  }

  const rootSeedMatch = lower.match(/arsk_(?:0x)?([0-9a-f]{64})/i);
  if (rootSeedMatch?.[1]) {
    return { kind: 'root_seed', hex: rootSeedMatch[1].toLowerCase() };
  }

  const normalized = lower.replace(/^0x/i, '');
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    const privateKeyMatch = lower.match(/\b(?:0x)?([0-9a-f]{64})\b/i);
    if (privateKeyMatch?.[1]) {
      return { kind: 'private_key', hex: privateKeyMatch[1].toLowerCase() };
    }
    throw new Error('Private key format incorrect: must be 64 hex characters');
  }

  return { kind: 'private_key', hex: normalized };
}

export function isSupportedAddressRecoveryMaterial(input: string): boolean {
  try {
    parseAddressRecoveryMaterial(input);
    return true;
  } catch {
    return false;
  }
}

export function derivePrivateKeyHexFromAddressRootSeed(rootSeedHex: string, addressType: number = 0): string {
  const normalized = String(rootSeedHex || '').replace(/^0x/i, '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error('Address root seed must be 64 hex characters');
  }

  const keyBytes = hexToBytes(normalized);
  const domainBytes = new TextEncoder().encode(addressRootSeedDeriveDomainTag);
  const messageBytes = new Uint8Array(domainBytes.length + 4);
  messageBytes.set(domainBytes, 0);
  messageBytes.set(uint32be(addressType), domainBytes.length);

  const sum = hmacSha256Bytes(keyBytes, messageBytes);
  const d = BigInt(`0x${bytesToHex(sum)}`);
  const normalizedScalar = (d % (P256_ORDER - 1n)) + 1n;
  return normalizedScalar.toString(16).padStart(64, '0');
}

export function deriveAddressKeypairFromAddressRootSeed(rootSeedHex: string, addressType: number = 0): {
  address: string;
  privHex: string;
  pubXHex: string;
  pubYHex: string;
  addressRootSeedHex: string;
} {
  const addressRootSeedHex = String(rootSeedHex || '').replace(/^0x/i, '').toLowerCase();
  const privHex = derivePrivateKeyHexFromAddressRootSeed(addressRootSeedHex, addressType);
  const keyPair = ec.keyFromPrivate(privHex, 'hex');
  const pubPoint = keyPair.getPublic();
  const pubXHex = pubPoint.getX().toString(16).padStart(64, '0');
  const pubYHex = pubPoint.getY().toString(16).padStart(64, '0');

  const publicKeyBytes = new Uint8Array(65);
  publicKeyBytes[0] = 0x04;
  publicKeyBytes.set(hexToBytes(pubXHex), 1);
  publicKeyBytes.set(hexToBytes(pubYHex), 33);
  const address = bytesToHex(new Uint8Array(sha256.array(publicKeyBytes).slice(0, 20)));

  return {
    address,
    privHex,
    pubXHex,
    pubYHex,
    addressRootSeedHex
  };
}
