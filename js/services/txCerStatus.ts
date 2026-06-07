import type { User } from '../utils/storage';
import type { TXCerLifecycleStatus, TXCerStatusView } from '../types/blockchain';
import { isTXCerLocked } from './txCerLockManager';

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

  if (TXCER_TERMINAL_STATUSES.includes(view.status)) {
    removeTXCerFromSpendableStores(user, view.txCerID);
  }
}

export function markTXCerActive(user: User, txCerID: string, address: string, value: number): void {
  if (!txCerID) return;
  const store = ensureTXCerStatusStore(user);
  store[txCerID] = {
    txCerID,
    userID: user.accountId,
    address,
    status: 'Active',
    value,
    sourcePosition: { BlockHeight: 0, Index: 0, InIndex: 0 },
    blockHeight: 0,
    updatedAt: Date.now()
  };
}

export function getTXCerStatus(user: User | null | undefined, txCerID: string): TXCerLifecycleStatus | undefined {
  return user?.wallet?.txCerStatuses?.[txCerID]?.status;
}

export function isTXCerSpendable(user: User | null | undefined, txCerID: string): boolean {
  return getTXCerStatus(user, txCerID) === 'Active' && !isTXCerLocked(txCerID);
}

export function sumSpendableTXCerValue(user: User, txCers: Record<string, number> | undefined): number {
  return Object.entries(txCers || {}).reduce((sum, [id, rawValue]) => {
    if (!isTXCerSpendable(user, id)) return sum;
    return sum + Number(rawValue || 0);
  }, 0);
}

export function sumNonSpendableTXCerValue(user: User, txCers: Record<string, number> | undefined): number {
  return Object.entries(txCers || {}).reduce((sum, [id, rawValue]) => {
    if (isTXCerSpendable(user, id)) return sum;
    return sum + Number(rawValue || 0);
  }, 0);
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
