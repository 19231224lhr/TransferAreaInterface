import { sha256 } from 'js-sha256';
import type {
  PublicKeyNew,
  TXCerIssueProof,
  TXCerIssueProofStep,
  TXCerIssuanceDetailView,
  TXCerProofVerificationStatus
} from '../types/blockchain';
import {
  buildTXCerIssueLeafV2,
  verifyTXCerIssueProof as verifyProtocolV2IssueProof
} from '../protocol-v2/evidence';
import { decodeBackendBytes } from '../protocol-v2/canonical';

export interface TXCerIssueProofVerificationResult {
  status: TXCerProofVerificationStatus;
  error?: string;
}

export function buildTXCerIssueKey(groupID: string, txID: string, outputIndex: number, toAddress: string): string {
  return `${groupID}:${txID}:${outputIndex}:${toAddress}`;
}

export function buildTXCerIssuanceRecordID(issueKey: string): string {
  return sha256(issueKey);
}

function field(source: Record<string, any>, lower: string, upper: string): any {
  return source[upper] ?? source[lower];
}

export function asProtocolTXCerIssuanceRecord(record: TXCerIssuanceDetailView): Record<string, any> {
  const source = record as Record<string, any>;
  const txCer = field(source, 'txCer', 'TXCer') || {};
  return {
    ...source,
    RecordID: field(source, 'recordID', 'RecordID') || '',
    IssueKey: field(source, 'issueKey', 'IssueKey') || '',
    TXID: field(source, 'txID', 'TXID') || txCer.TXID || '',
    OutputIndex: field(source, 'outputIndex', 'OutputIndex') || 0,
    UserID: field(source, 'userID', 'UserID') || '',
    ToAddress: field(source, 'toAddress', 'ToAddress') || txCer.ToAddress || '',
    TXCerID: field(source, 'txCerID', 'TXCerID') || txCer.TXCerID || '',
    TXCer: txCer,
    GuarGroupID: field(source, 'guarGroupID', 'GuarGroupID') || txCer.FromGuarGroupID || '',
    TargetBlock: field(source, 'targetBlock', 'TargetBlock') || txCer.TxCerPosition?.BlockHeight || 0,
    GuarTXIndex: field(source, 'guarTXIndex', 'GuarTXIndex') || txCer.TxCerPosition?.Index || 0,
    CertifierID: field(source, 'certifierID', 'CertifierID') || '',
    ExposureSharesHash: field(source, 'exposureSharesHash', 'ExposureSharesHash'),
    LiabilityReceiptHash: field(source, 'liabilityReceiptHash', 'LiabilityReceiptHash'),
    RootExposureIDs: field(source, 'rootExposureIDs', 'RootExposureIDs') || [],
    LiabilityDeltaID: field(source, 'liabilityDeltaID', 'LiabilityDeltaID') || '',
    ReceiptID: field(source, 'receiptID', 'ReceiptID') || '',
    AuditStatus: field(source, 'auditStatus', 'AuditStatus') || '',
    Ack: field(source, 'ack', 'Ack'),
    LiabilityReceipt: field(source, 'liabilityReceipt', 'LiabilityReceipt'),
    FastEvidence: field(source, 'fastEvidence', 'FastEvidence')
  };
}

export function buildTXCerIssueLeaf(record: TXCerIssuanceDetailView): number[] {
  return buildTXCerIssueLeafV2(asProtocolTXCerIssuanceRecord(record));
}

export function computeDirectionalMerkleRoot(leaf: ArrayLike<number>, steps: TXCerIssueProofStep[] = []): number[] {
  let current = Array.from(leaf);
  for (const step of steps) {
    const sibling = decodeBackendBytes(step.Hash);
    if (step.Side === 'left') current = sha256.array([...sibling, ...current]);
    else if (step.Side === 'right') current = sha256.array([...current, ...sibling]);
    else return [];
  }
  return current;
}

export function verifyTXCerIssueProof(
  record: TXCerIssuanceDetailView,
  proof: TXCerIssueProof | undefined | null,
  certifierPublicKey: PublicKeyNew | undefined | null
): boolean {
  return evaluateTXCerIssueProof(record, proof, certifierPublicKey).status === 'verified';
}

export function evaluateTXCerIssueProof(
  record: TXCerIssuanceDetailView,
  proof: TXCerIssueProof | undefined | null,
  certifierPublicKey: PublicKeyNew | undefined | null
): TXCerIssueProofVerificationResult {
  if (!proof) return { status: 'missingProof', error: 'missing proof' };
  if (!certifierPublicKey) return { status: 'unsupported', error: 'missing certifier public key' };
  try {
    return verifyProtocolV2IssueProof(asProtocolTXCerIssuanceRecord(record), proof, certifierPublicKey)
      ? { status: 'verified' }
      : { status: 'invalid', error: 'protocol-v2 proof verification failed' };
  } catch (error) {
    return { status: 'invalid', error: error instanceof Error ? error.message : String(error) };
  }
}
