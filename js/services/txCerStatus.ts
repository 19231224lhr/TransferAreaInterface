import type { User } from '../utils/storage';
import type { TXCerLifecycleStatus, TXCerStatusView } from '../types/blockchain';
import { isTXCerLocked } from './txCerLockManager';
import { formatAmount, parseAmount, toAmountNumber, type AmountDecimal, type AmountInput } from '../utils/amount';

export const TXCER_TERMINAL_STATUSES: TXCerLifecycleStatus[] = [
  'Exchanged',
  'ConvertedToUTXO',
  'Invalid'
];

export function ensureTXCerStatusStore(user: User): Record<string, TXCerStatusView> {
  if (!user.wallet.txCerStatuses) {
    user.wallet.txCerStatuses = {};
  }
  return user.wallet.txCerStatuses;
}

export function applyTXCerStatus(user: User, view: TXCerStatusView): void {
  if (!view?.txCerID) return;
  const store = ensureTXCerStatusStore(user);
  store[view.txCerID] = view;
  const clientRecord = user.wallet.txCerIssuanceRecords?.[view.txCerID];
  if (clientRecord) {
    clientRecord.lifecycleStatus = view.status;
    if (clientRecord.security) {
      clientRecord.security.spendabilityStatus = view.status === 'Active' ? 'Active' : 'NonSpendable';
    }
  }

  if (TXCER_TERMINAL_STATUSES.includes(view.status)) {
    removeTXCerFromSpendableStores(user, view.txCerID);
  }
}

export function markTXCerActive(user: User, txCerID: string, address: string, value: AmountInput): void {
  if (!txCerID) return;
  const store = ensureTXCerStatusStore(user);
  store[txCerID] = {
    txCerID,
    userID: user.accountId,
    address,
    status: 'Active',
    value: formatAmount(parseAmount(value)),
    sourcePosition: { BlockHeight: 0, Index: 0, InIndex: 0 },
    blockHeight: 0,
    updatedAt: Date.now()
  };
  const clientRecord = user.wallet.txCerIssuanceRecords?.[txCerID];
  if (clientRecord) {
    clientRecord.lifecycleStatus = 'Active';
    if (clientRecord.security) clientRecord.security.spendabilityStatus = 'Active';
  }
}

export function getTXCerStatus(user: User | null | undefined, txCerID: string): TXCerLifecycleStatus | undefined {
  return user?.wallet?.txCerStatuses?.[txCerID]?.status;
}

export function isTXCerSpendable(
  user: User | null | undefined,
  txCerID: string,
  allowedDraftLockOwner?: string
): boolean {
  const metadata = user?.wallet?.txCerIssuanceRecords?.[txCerID];
  const fastFailed = metadata?.security?.fastEvidenceStatus === 'Failed';
  const legacyProofFailed = !metadata?.security && metadata?.proofStatus === 'invalid';
  return getTXCerStatus(user, txCerID) === 'Active'
    && !fastFailed
    && !legacyProofFailed
    && !isTXCerLocked(txCerID, allowedDraftLockOwner);
}

export function sumSpendableTXCerUnits(user: User, txCers: Record<string, AmountDecimal> | undefined): bigint {
  return Object.entries(txCers || {}).reduce((sum, [id, rawValue]) => {
    if (!isTXCerSpendable(user, id)) return sum;
    return sum + parseAmount(rawValue || '0');
  }, 0n);
}

export function sumSpendableTXCerValue(user: User, txCers: Record<string, AmountDecimal> | undefined): number {
  return toAmountNumber(sumSpendableTXCerUnits(user, txCers));
}

export function sumNonSpendableTXCerUnits(user: User, txCers: Record<string, AmountDecimal> | undefined): bigint {
  return Object.entries(txCers || {}).reduce((sum, [id, rawValue]) => {
    if (isTXCerSpendable(user, id)) return sum;
    return sum + parseAmount(rawValue || '0');
  }, 0n);
}

export function sumNonSpendableTXCerValue(user: User, txCers: Record<string, AmountDecimal> | undefined): number {
  return toAmountNumber(sumNonSpendableTXCerUnits(user, txCers));
}

export function removeTXCerFromSpendableStores(user: User, txCerID: string): void {
  for (const addrData of Object.values(user.wallet?.addressMsg || {})) {
    if (addrData?.txCers && addrData.txCers[txCerID] !== undefined) {
      delete addrData.txCers[txCerID];
    }
  }
  if (user.wallet?.totalTXCers && user.wallet.totalTXCers[txCerID] !== undefined) {
    delete user.wallet.totalTXCers[txCerID];
  }
}
