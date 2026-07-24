import type { Transaction } from '../types/blockchain';
import {
  computeTransactionHashV2,
  computeTransactionIDV2
} from '../protocol-v2/transaction';

export function getTXHash(tx: Transaction): number[] {
  return computeTransactionHashV2(tx);
}

export function calculateTXID(tx: Transaction): string {
  return computeTransactionIDV2(tx);
}
