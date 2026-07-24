import { sha256 } from 'js-sha256';
import { ec as EC } from 'elliptic';
import type { BackendBytes, EcdsaSignatureV2, PublicKeyEnvelopeV2, PublicKeyV2, SignatureEnvelopeV2 } from './types';

function hasBuffer(): boolean {
  return typeof globalThis !== 'undefined' && typeof (globalThis as { Buffer?: unknown }).Buffer !== 'undefined';
}

export function decodeBackendBytes(value: BackendBytes): number[] {
  if (value == null) return [];
  if (value instanceof Uint8Array) return Array.from(value);
  if (Array.isArray(value)) {
    if (!value.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255)) throw new Error('invalid byte array');
    return [...value];
  }
  const text = String(value).trim();
  if (!text) return [];
  if (hasBuffer()) return Array.from(Buffer.from(text, 'base64'));
  const binary = atob(text);
  return Array.from(binary, character => character.charCodeAt(0));
}

export function bytesToBase64(value: BackendBytes): string {
  const bytes = decodeBackendBytes(value);
  if (bytes.length === 0) return '';
  if (hasBuffer()) return Buffer.from(bytes).toString('base64');
  return btoa(String.fromCharCode(...bytes));
}

export function bytesToHex(value: ArrayLike<number>): string {
  return Array.from(value, byte => Number(byte).toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(value: string): number[] {
  const text = value.replace(/^0x/i, '');
  if (!/^(?:[0-9a-f]{2})*$/i.test(text)) throw new Error('invalid hex');
  const bytes: number[] = [];
  for (let index = 0; index < text.length; index += 2) bytes.push(Number.parseInt(text.slice(index, index + 2), 16));
  return bytes;
}

export function canonicalJSONStringify(value: unknown): string {
  const encode = (child: unknown, inArray = false): string | undefined => {
    if (child === null) return 'null';
    if (typeof child === 'string') return JSON.stringify(child);
    if (typeof child === 'boolean') return child ? 'true' : 'false';
    if (typeof child === 'bigint') return child.toString();
    if (typeof child === 'number') {
      if (!Number.isFinite(child)) throw new Error('non-finite number');
      return JSON.stringify(child);
    }
    if (child === undefined || typeof child === 'function' || typeof child === 'symbol') {
      return inArray ? 'null' : undefined;
    }
    if (Array.isArray(child)) {
      return `[${child.map(item => encode(item, true) ?? 'null').join(',')}]`;
    }
    if (typeof child === 'object') {
      const record = child as Record<string, unknown>;
      let keys = Object.keys(record);
      if (keys.length > 0 && keys.every(key => /^-?\d+$/.test(key))) {
        keys = [...keys].sort((left, right) => left.localeCompare(right));
      }
      const fields: string[] = [];
      for (const key of keys) {
        const encoded = encode(record[key]);
        if (encoded !== undefined) fields.push(`${JSON.stringify(key)}:${encoded}`);
      }
      return `{${fields.join(',')}}`;
    }
    throw new Error(`unsupported canonical JSON value: ${typeof child}`);
  };
  return encode(value) ?? 'null';
}

export function sha256Bytes(value: string | ArrayLike<number>): number[] {
  return typeof value === 'string' ? sha256.array(value) : sha256.array(Array.from(value));
}

export function sortRecord<T>(value: Record<string, T> | null | undefined, normalize: (item: T) => unknown): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value || {}).sort()) result[key] = normalize((value as Record<string, T>)[key]);
  return result;
}

export function integerValue(value: unknown): bigint | null {
  if (value == null || value === '') return null;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new Error('unsafe integer');
    return BigInt(value);
  }
  if (!/^-?\d+$/.test(String(value))) throw new Error('invalid integer');
  return BigInt(String(value));
}

export function ecdsaSignature(value: EcdsaSignatureV2 | null | undefined): { R: bigint | null; S: bigint | null } {
  return { R: integerValue(value?.R), S: integerValue(value?.S) };
}

export function signatureEnvelope(value: SignatureEnvelopeV2 | null | undefined, canonicalEmpty = false): { Algorithm: string; Signature: string | null } {
  const signature = value?.Signature;
  return {
    Algorithm: String(value?.Algorithm || ''),
    Signature: signature == null && !canonicalEmpty ? null : bytesToBase64(signature)
  };
}

export function publicKey(value: PublicKeyV2 | null | undefined): { CurveName: string; X: bigint | null; Y: bigint | null } {
  return {
    CurveName: String(value?.CurveName ?? value?.curveName ?? ''),
    X: integerValue(value?.X ?? value?.x),
    Y: integerValue(value?.Y ?? value?.y)
  };
}

export function verifyECDSAHash(hash: ArrayLike<number>, signature: EcdsaSignatureV2, key: PublicKeyV2): boolean {
  try {
    const ec = new EC('p256');
    const normalizedKey = publicKey(key);
    const normalizedSignature = ecdsaSignature(signature);
    if (normalizedKey.X == null || normalizedKey.Y == null || normalizedSignature.R == null || normalizedSignature.S == null) return false;
    const publicPoint = ec.keyFromPublic({ x: normalizedKey.X.toString(16), y: normalizedKey.Y.toString(16) }, 'hex');
    return publicPoint.verify(Array.from(hash), { r: normalizedSignature.R.toString(16), s: normalizedSignature.S.toString(16) });
  } catch {
    return false;
  }
}

export function verifySignatureEnvelopeV2(
  hash: ArrayLike<number>,
  signature: SignatureEnvelopeV2 | null | undefined,
  key: PublicKeyEnvelopeV2 | null | undefined
): boolean {
  try {
    if (signature?.Algorithm !== 'ecdsa_p256' || key?.Algorithm !== 'ecdsa_p256') return false;
    const signatureBytes = decodeBackendBytes(signature.Signature);
    const publicKeyBytes = decodeBackendBytes(key.PublicKey);
    if (signatureBytes.length === 0 || publicKeyBytes.length === 0) return false;
    const ec = new EC('p256');
    return ec.keyFromPublic(bytesToHex(publicKeyBytes), 'hex').verify(Array.from(hash), signatureBytes);
  } catch {
    return false;
  }
}
