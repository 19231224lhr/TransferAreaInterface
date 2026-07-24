import type { AmountDecimal, AmountUnits, DecimalInput } from './types';

export const AMOUNT_SCALE = 100_000_000n;
export const RATIO_SCALE = 100_000_000n;
export const MAX_AMOUNT_UNITS = (1n << 64n) - 1n;
const MAX_SAFE_UNITS = BigInt(Number.MAX_SAFE_INTEGER);

function parseDecimal(value: string, scale: bigint, max: bigint, label: string): bigint {
  const text = value.trim();
  if (!text) throw new Error(`${label} cannot be empty`);
  if (text.startsWith('-')) throw new Error(`${label} cannot be negative`);
  if (!/^\d*(?:\.\d*)?$/.test(text)) throw new Error(`invalid ${label}`);
  const [rawWhole = '0', rawFraction = ''] = text.split('.');
  if (rawFraction.length > 8) throw new Error(`${label} has more than 8 decimal places`);
  const whole = BigInt(rawWhole || '0');
  const fraction = BigInt((rawFraction || '').padEnd(8, '0') || '0');
  const units = whole * scale + fraction;
  if (units > max) throw new Error(`${label} overflow`);
  return units;
}

function parseLegacyNumber(value: number, parser: (text: string) => bigint, formatter: (units: bigint) => string): bigint {
  if (!Number.isFinite(value) || value < 0) throw new Error(`invalid decimal number ${value}`);
  const units = parser(String(value));
  if (units > MAX_SAFE_UNITS || Number(formatter(units)) !== value) {
    throw new Error('legacy number cannot round-trip exactly; pass a decimal string');
  }
  return units;
}

export function parseAmount(value: DecimalInput): AmountUnits {
  if (typeof value === 'bigint') {
    if (value < 0n || value > MAX_AMOUNT_UNITS) throw new Error('amount units out of range');
    return value;
  }
  if (typeof value === 'number') return parseLegacyNumber(value, text => parseDecimal(text, AMOUNT_SCALE, MAX_AMOUNT_UNITS, 'amount'), formatAmount);
  return parseDecimal(value, AMOUNT_SCALE, MAX_AMOUNT_UNITS, 'amount');
}

export function formatAmount(units: AmountUnits): AmountDecimal {
  if (units < 0n || units > MAX_AMOUNT_UNITS) throw new Error('amount units out of range');
  const whole = units / AMOUNT_SCALE;
  const fraction = units % AMOUNT_SCALE;
  if (fraction === 0n) return whole.toString();
  return `${whole}.${fraction.toString().padStart(8, '0').replace(/0+$/, '')}`;
}

export function parseRatio(value: DecimalInput): bigint {
  if (typeof value === 'bigint') {
    if (value < 0n || value > RATIO_SCALE) throw new Error('ratio units out of range');
    return value;
  }
  const parser = (text: string) => {
    const units = parseDecimal(text, RATIO_SCALE, RATIO_SCALE, 'ratio');
    if (units > RATIO_SCALE) throw new Error('ratio cannot exceed 1');
    return units;
  };
  if (typeof value === 'number') return parseLegacyNumber(value, parser, formatRatio);
  return parser(value);
}

export function formatRatio(units: bigint): string {
  if (units < 0n || units > RATIO_SCALE) throw new Error('ratio units out of range');
  const whole = units / RATIO_SCALE;
  const fraction = units % RATIO_SCALE;
  if (fraction === 0n) return whole.toString();
  return `${whole}.${fraction.toString().padStart(8, '0').replace(/0+$/, '')}`;
}

export function canonicalAmount(value: DecimalInput | null | undefined): AmountDecimal {
  return formatAmount(parseAmount(value ?? '0'));
}

export function canonicalRatio(value: DecimalInput | null | undefined): string {
  return formatRatio(parseRatio(value ?? '0'));
}

export function normalizeStoredAmount(value: unknown): AmountDecimal {
  if (!['string', 'number', 'bigint'].includes(typeof value)) {
    throw new Error('stored amount must be a decimal string, bigint units, or an exact legacy number');
  }
  return canonicalAmount(value as DecimalInput);
}

export function addAmounts(...values: DecimalInput[]): AmountDecimal {
  return formatAmount(values.reduce<bigint>((sum, value) => sum + parseAmount(value), 0n));
}

export function compareAmounts(left: DecimalInput, right: DecimalInput): -1 | 0 | 1 {
  const leftUnits = parseAmount(left);
  const rightUnits = parseAmount(right);
  return leftUnits < rightUnits ? -1 : leftUnits > rightUnits ? 1 : 0;
}

export function isWholeAmount(value: DecimalInput): boolean {
  return parseAmount(value) % AMOUNT_SCALE === 0n;
}
