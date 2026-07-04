import type { SettlementAuth, SignatureEnvelope, Transaction, TxCertificate } from '../types/blockchain';
import { AlgorithmECDSAP256, getTimestamp, hashBackendJson, signHashEnvelope } from '../utils/signature';
import { toAmountNumber } from '../utils/amount';

function emptySignatureEnvelope(): SignatureEnvelope {
  return { Algorithm: '', Signature: null };
}

function bigintReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString(10);
  }
  return value;
}

export function zeroSettlementAuth(): SettlementAuth {
  return {
    Version: 0,
    TXCerID: '',
    SourceTXID: '',
    SourcePosition: { BlockHeight: 0, Index: 0, InIndex: 0 },
    Value: 0,
    FromGuarGroupID: '',
    ToGuarGroupID: '',
    PledgeAddress: '',
    ConsumeIntentHash: null,
    AuthTime: 0,
    UserSignatureV2: emptySignatureEnvelope()
  };
}

function normalizeTransactionForSettlementIntent(transaction: Transaction): Transaction {
  const tx = JSON.parse(JSON.stringify(transaction, bigintReplacer)) as Transaction;

  tx.TXID = '';
  tx.Size = 0;
  tx.NewValue = 0;
  tx.UserSignature = { R: null, S: null };
  tx.UserSignatureV2 = emptySignatureEnvelope();
  tx.TXType = 0;
  tx.ValueDivision = tx.ValueDivision || {};
  tx.NewValueDiv = tx.NewValueDiv || {};
  tx.InterestAssign = tx.InterestAssign || { Gas: 0, Output: 0, BackAssign: {} };
  tx.InterestAssign.BackAssign = tx.InterestAssign.BackAssign || {};
  tx.TXInputsNormal = (tx.TXInputsNormal || [])
    .filter(input => !input.IsGuarMake)
    .map(input => ({
      ...input,
      TXOutputHash: input.TXOutputHash ?? [],
      SeedReveal: input.SeedReveal ?? []
    }));
  tx.TXInputsCertificate = (tx.TXInputsCertificate || []).map(txCer => ({
    ...txCer,
    SettlementAuth: zeroSettlementAuth()
  }));
  tx.TXOutputs = (tx.TXOutputs || [])
    .filter(output => !output.IsGuarMake)
    .map(output => ({
      ...output,
      SeedAnchor: output.SeedAnchor ?? []
    }));
  tx.Data = tx.Data ?? [];

  return tx;
}

export function getSettlementIntentHash(transaction: Transaction, txCerID: string): number[] {
  return hashBackendJson({
    TXCerID: txCerID,
    Transaction: normalizeTransactionForSettlementIntent(transaction)
  });
}

function assertTXCerSettlementReady(txCer: TxCertificate): void {
  const missing: string[] = [];
  if (!txCer.TXCerID) missing.push('TXCerID');
  if (!txCer.TXID) missing.push('TXID');
  if (!txCer.TxCerPosition) missing.push('TxCerPosition');
  if (toAmountNumber(txCer.Value) <= 0) missing.push('Value');
  if (!txCer.FromGuarGroupID) missing.push('FromGuarGroupID');
  if (!txCer.ToGuarGroupID) missing.push('ToGuarGroupID');
  if (!txCer.SourcePledgeAddress) missing.push('SourcePledgeAddress');
  if (missing.length > 0) {
    throw new Error(`TXCer ${txCer.TXCerID || '(unknown)'} 缺少清算授权字段：${missing.join(', ')}，请先同步钱包状态`);
  }
}

export function buildSettlementAuth(
  transaction: Transaction,
  txCer: TxCertificate,
  accountPrivateKeyHex: string
): SettlementAuth {
  assertTXCerSettlementReady(txCer);

  const auth: SettlementAuth = {
    Version: 1,
    TXCerID: txCer.TXCerID,
    SourceTXID: txCer.TXID,
    SourcePosition: txCer.TxCerPosition,
    Value: txCer.Value,
    FromGuarGroupID: txCer.FromGuarGroupID,
    ToGuarGroupID: txCer.ToGuarGroupID,
    PledgeAddress: txCer.SourcePledgeAddress || '',
    ConsumeIntentHash: getSettlementIntentHash(transaction, txCer.TXCerID),
    AuthTime: getTimestamp(),
    UserSignatureV2: emptySignatureEnvelope()
  };

  auth.UserSignatureV2 = signHashEnvelope(
    AlgorithmECDSAP256,
    hashBackendJson({ ...auth, UserSignatureV2: emptySignatureEnvelope() }),
    accountPrivateKeyHex
  );

  return auth;
}

export function attachSettlementAuths(transaction: Transaction, accountPrivateKeyHex: string): void {
  if (!transaction.TXInputsCertificate || transaction.TXInputsCertificate.length === 0) {
    return;
  }

  transaction.TXInputsCertificate = transaction.TXInputsCertificate.map(txCer => {
    const baseTXCer = {
      ...txCer,
      SettlementAuth: zeroSettlementAuth()
    };
    return {
      ...baseTXCer,
      SettlementAuth: buildSettlementAuth(transaction, baseTXCer, accountPrivateKeyHex)
    };
  });
}
