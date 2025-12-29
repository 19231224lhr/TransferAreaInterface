/**
 * Interest (GAS) accrual utilities
 *
 * Frontend needs to keep estimated interest in sync when polling account-update.
 * Backend formula reference (Go):
 *   inc = UTXOValue * InterestRate(0.05) * ExchangeRate(type) * deltaHeight
 */

export const DEFAULT_INTEREST_RATE = 0.05;

export function exchangeRate(type) {
  switch (Number(type)) {
    case 0:
      return 1;
    case 1:
      return 1_000_000;
    case 2:
      return 1_000;
    default:
      return 1;
  }
}

export function toFiniteNumber(val) {
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

/**
 * Normalize interest fields so UI + updates stay consistent.
 * Backend canonical field is typically `EstInterest`.
 * We keep `EstInterest`, `estInterest`, and `gas` mirrored to the same number.
 */
export function normalizeInterestFields(meta) {
  if (!meta || typeof meta !== 'object') return;

  const canonical =
    toFiniteNumber(meta.EstInterest) ??
    toFiniteNumber(meta.estInterest) ??
    toFiniteNumber(meta.gas);

  if (canonical === null) return;

  meta.EstInterest = canonical;
  meta.estInterest = canonical;
  meta.gas = canonical;
}

/**
 * Apply interest delta blocks to a single address metadata.
 */
export function accrueAddressInterest(meta, deltaBlocks, interestRate = DEFAULT_INTEREST_RATE) {
  if (!meta || typeof meta !== 'object') return 0;

  const d = Number(deltaBlocks) || 0;
  if (d <= 0) {
    normalizeInterestFields(meta);
    return 0;
  }

  normalizeInterestFields(meta);

  const type = Number(meta.type ?? 0);
  const utxoValue =
    toFiniteNumber(meta?.value?.utxoValue) ??
    toFiniteNumber(meta?.value?.UTXOValue) ??
    toFiniteNumber(meta?.value?.totalValue) ??
    0;

  const inc = Number(utxoValue) * Number(interestRate) * exchangeRate(type) * d;

  const base =
    toFiniteNumber(meta.EstInterest) ??
    toFiniteNumber(meta.estInterest) ??
    toFiniteNumber(meta.gas) ??
    0;
  const next = base + inc;

  meta.EstInterest = next;
  meta.estInterest = next;
  meta.gas = next;

  return inc;
}

/**
 * Apply interest accrual to all addresses in wallet.
 * Does NOT mutate wallet.updateBlock (caller decides when to set it).
 */
export function accrueWalletInterest(wallet, deltaBlocks, interestRate = DEFAULT_INTEREST_RATE) {
  if (!wallet || typeof wallet !== 'object') return { changed: false, totalInc: 0 };
  const addrMsg = wallet.addressMsg || wallet.AddressMsg;
  if (!addrMsg || typeof addrMsg !== 'object') return { changed: false, totalInc: 0 };

  let totalInc = 0;
  let changed = false;

  for (const meta of Object.values(addrMsg)) {
    const inc = accrueAddressInterest(meta, deltaBlocks, interestRate);
    if (inc !== 0) {
      totalInc += inc;
      changed = true;
    }
  }

  return { changed, totalInc };
}
