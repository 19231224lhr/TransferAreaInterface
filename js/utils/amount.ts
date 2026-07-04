export type AmountInput = number | string | bigint;
export type AmountWire = string;

export const AMOUNT_DECIMALS = 8;

function trimTrailingZeros(text: string): string {
  return text.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') || '0';
}

function normalizeDecimalText(text: string): AmountWire {
  const raw = text.trim();
  if (!raw) return '0';
  if (raw.startsWith('-')) {
    throw new Error(`Amount cannot be negative: ${text}`);
  }
  const parts = raw.split('.');
  if (parts.length > 2 || !/^\d*$/.test(parts[0]) || (parts[1] != null && !/^\d*$/.test(parts[1]))) {
    throw new Error(`Invalid amount: ${text}`);
  }
  const whole = parts[0] || '0';
  const frac = parts[1] || '';
  if (frac.length > AMOUNT_DECIMALS) {
    throw new Error(`Amount has more than ${AMOUNT_DECIMALS} decimal places: ${text}`);
  }
  return trimTrailingZeros(frac ? `${whole}.${frac}` : whole);
}

export function toAmountWire(value: AmountInput | null | undefined): AmountWire {
  if (value == null || value === '') return '0';
  if (typeof value === 'bigint') return value.toString(10);
  if (typeof value === 'string') {
    return normalizeDecimalText(value);
  }
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid amount: ${value}`);
  }
  if (value < 0) {
    throw new Error(`Amount cannot be negative: ${value}`);
  }
  return normalizeDecimalText(value.toFixed(AMOUNT_DECIMALS));
}

export function toAmountNumber(value: AmountInput | null | undefined): number {
  if (value == null || value === '') return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function toAmountRecordWire<T extends string | number>(
  values: Record<T, AmountInput | null | undefined>
): Record<T, AmountWire> {
  const out = {} as Record<T, AmountWire>;
  for (const [key, value] of Object.entries(values) as Array<[T, AmountInput | null | undefined]>) {
    const normalized = toAmountWire(value);
    if (normalized !== '0') {
      out[key] = normalized;
    }
  }
  return out;
}

export function isAmountLike(value: unknown): value is AmountInput {
  if (typeof value === 'bigint') return value >= 0n;
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0;
  if (typeof value === 'string') {
    try {
      toAmountWire(value);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
