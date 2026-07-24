import type { SettlementAuth, SignatureEnvelope, Transaction, TxCertificate } from '../types/blockchain';
import { AlgorithmECDSAP256, getTimestamp, signHashEnvelope } from '../utils/signature';
import { parseAmount } from '../utils/amount';
import { computeSettlementAuthHashV2, computeSettlementIntentHashV2 } from '../protocol-v2/transaction';

function emptySignatureEnvelope(): SignatureEnvelope {
  return { Algorithm: '', Signature: null };
}

export function zeroSettlementAuth(): SettlementAuth {
  return {
    Version: 0,
    TXCerID: '',
    SourceTXID: '',
    SourcePosition: { BlockHeight: 0, Index: 0, InIndex: 0 },
    Value: '0',
    FromGuarGroupID: '',
    ToGuarGroupID: '',
    PledgeAddress: '',
    ConsumeIntentHash: null,
    AuthTime: 0,
    UserSignatureV2: emptySignatureEnvelope()
  };
}

export function getSettlementIntentHash(transaction: Transaction, txCerID: string): number[] {
  return computeSettlementIntentHashV2(transaction, txCerID);
}

function assertTXCerSettlementReady(txCer: TxCertificate): void {
  const missing: string[] = [];
  if (!txCer.TXCerID) missing.push('TXCerID');
  if (!txCer.TXID) missing.push('TXID');
  if (!txCer.TxCerPosition) missing.push('TxCerPosition');
  if (parseAmount(txCer.Value) <= 0n) missing.push('Value');
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
    computeSettlementAuthHashV2(auth),
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
