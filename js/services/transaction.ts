/**
 * Legacy transaction facade.
 *
 * The protocol implementation lives in txBuilder/protocol-v2.  Keep this
 * module only for the historic window.PanguPay.transaction entry point and
 * old type imports; never maintain a second hashing or coin-selection path.
 */

import type { User } from '../utils/storage';
import type {
  InterestAssign as BlockchainInterestAssign,
  Transaction as BlockchainTransaction,
  TXOutput as BlockchainTXOutput
} from '../types/blockchain';
import {
  buildTransactionFromLegacy,
  type LegacyBuildTXInfo
} from './txBuilder';

export type Transaction = BlockchainTransaction;
export type TXOutput = BlockchainTXOutput;
export type InterestAssign = BlockchainInterestAssign;
export type BuildTXInfo = LegacyBuildTXInfo;
export type BillMsg = LegacyBuildTXInfo['Bill'][string];
export type UserAccount = User;

/**
 * @deprecated Use buildTransactionFromLegacy/buildTransaction from txBuilder.
 * This wrapper now delegates to the single protocol-v2 implementation.
 */
export async function buildNewTX(buildTXInfo: BuildTXInfo, userAccount: UserAccount): Promise<Transaction> {
  return (await buildTransactionFromLegacy(buildTXInfo, userAccount)).TX;
}

/** Presentation-only conversion used by legacy UI labels. */
export function exchangeRate(moneyType: number): number {
  const rates: Record<number, number> = { 0: 1, 1: 1_000_000, 2: 1_000 };
  return rates[moneyType] || 1;
}
