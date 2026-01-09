import { sha256 } from 'js-sha256';

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE = ALPHABET.length;
const ALPHABET_MAP: Record<string, number> = {};

for (let i = 0; i < ALPHABET.length; i++) {
  ALPHABET_MAP[ALPHABET[i]] = i;
}

function sha256Bytes(data: Uint8Array): Uint8Array {
  const hash = sha256.array(data);
  return Uint8Array.from(hash);
}

export function base58Encode(bytes: Uint8Array): string {
  if (!bytes || bytes.length === 0) return '';

  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) {
    zeros++;
  }

  if (zeros === bytes.length) {
    return '1'.repeat(zeros);
  }

  const digits: number[] = [0];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % BASE;
      carry = (carry / BASE) | 0;
    }
    while (carry > 0) {
      digits.push(carry % BASE);
      carry = (carry / BASE) | 0;
    }
  }

  let result = '1'.repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i--) {
    result += ALPHABET[digits[i]];
  }
  return result;
}

export function base58Decode(input: string): Uint8Array {
  const str = String(input || '').trim();
  if (str.length === 0) return new Uint8Array(0);

  let zeros = 0;
  while (zeros < str.length && str[zeros] === '1') {
    zeros++;
  }

  if (zeros === str.length) {
    return new Uint8Array(zeros);
  }

  const bytes: number[] = [0];
  for (let i = zeros; i < str.length; i++) {
    const value = ALPHABET_MAP[str[i]];
    if (value === undefined) {
      throw new Error(`invalid base58 character: ${str[i]}`);
    }
    let carry = value;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * BASE;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  for (let i = 0; i < zeros; i++) {
    bytes.push(0);
  }

  return new Uint8Array(bytes.reverse());
}

export function base58CheckEncode(payload: Uint8Array): string {
  const first = sha256Bytes(payload);
  const second = sha256Bytes(first);
  const checksum = second.slice(0, 4);
  const full = new Uint8Array(payload.length + checksum.length);
  full.set(payload, 0);
  full.set(checksum, payload.length);
  return base58Encode(full);
}

export function base58CheckDecode(input: string): Uint8Array {
  const full = base58Decode(input);
  if (full.length < 4) {
    throw new Error('payload too short');
  }
  const payload = full.slice(0, full.length - 4);
  const checksum = full.slice(full.length - 4);
  const first = sha256Bytes(payload);
  const second = sha256Bytes(first);
  const expected = second.slice(0, 4);

  for (let i = 0; i < expected.length; i++) {
    if (checksum[i] !== expected[i]) {
      throw new Error('checksum mismatch');
    }
  }
  return payload;
}
