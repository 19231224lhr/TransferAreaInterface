import {
  AMOUNT_SCALE,
  addAmounts,
  canonicalAmount,
  compareAmounts,
  formatAmount,
  isWholeAmount,
  normalizeStoredAmount,
  parseAmount
} from '../protocol-v2/amount';
import type { AmountDecimal, AmountUnits, DecimalInput } from '../protocol-v2/types';

export type AmountInput = DecimalInput;
export type AmountWire = string;
export const AMOUNT_DECIMALS = 8;
export type { AmountDecimal, AmountUnits };
export { AMOUNT_SCALE, addAmounts, compareAmounts, formatAmount, isWholeAmount, normalizeStoredAmount, parseAmount };

export function toAmountWire(value: AmountInput | null | undefined): AmountWire {
  return canonicalAmount(value ?? '0');
}

// Presentation-only conversion. Consensus, signing and coin selection must use
// parseAmount()/bigint and must never feed this value back into a transaction.
export function toAmountNumber(value: AmountInput | null | undefined): number {
  if (value == null || value === '') return 0;
  const numeric = Number(toAmountWire(value));
  return Number.isFinite(numeric) ? numeric : 0;
}

export function toAmountRecordWire<T extends string | number>(
  values: Record<T, AmountInput | null | undefined>
): Record<T, AmountWire> {
  const out = {} as Record<T, AmountWire>;
  for (const [key, value] of Object.entries(values) as Array<[T, AmountInput | null | undefined]>) {
    const normalized = toAmountWire(value);
    if (normalized !== '0') out[key] = normalized;
  }
  return out;
}

export function isAmountLike(value: unknown): value is AmountInput {
  if (!['bigint', 'number', 'string'].includes(typeof value)) return false;
  try {
    parseAmount(value as AmountInput);
    return true;
  } catch {
    return false;
  }
}
