import {
  computeFastLiabilityReceiptHashV2,
  verifyFastLiabilityReceipt,
  verifyTXCerFastEvidence,
  verifyTXCerIssuanceAck,
  verifyTXCerIssueProof
} from './evidence';
import { decodeBackendBytes } from './canonical';
import type {
  FastLiabilityReceiptV2,
  LiabilityAuthorityContext,
  PublicKeyV2,
  TXCerFastEvidenceV2,
  TXCerIssuanceAckV2,
  TXCerIssuanceRecordV2,
  TXCerIssueProofV2
} from './types';

export type SpendabilityStatus = 'Active' | 'NonSpendable';
export type FastEvidenceStatus = 'Pending' | 'Verified' | 'Failed';
export type CFAAAuditStatus = 'Pending' | 'Verified' | 'Failed' | 'Unavailable';

export interface TXCerAuthoritySnapshot extends LiabilityAuthorityContext {
  groupID: string;
  signerSetID: string;
  targetAssignPublicKey?: PublicKeyV2;
  capturedAt: number;
}

export interface TXCerSecurityState {
  spendabilityStatus: SpendabilityStatus;
  fastEvidenceStatus: FastEvidenceStatus;
  cfaaAuditStatus: CFAAAuditStatus;
  fastEvidenceError?: string;
  cfaaAuditError?: string;
  checkedAt: number;
}

export interface TXCerSecurityBundle {
  issuanceRecord?: TXCerIssuanceRecordV2;
  fastEvidence?: TXCerFastEvidenceV2;
  assignAck?: TXCerIssuanceAckV2;
  liabilityReceipt?: FastLiabilityReceiptV2;
  issuanceProof?: TXCerIssueProofV2;
  authoritySnapshot?: TXCerAuthoritySnapshot;
}

export interface TXCerEvidenceMetadataV2 extends TXCerSecurityBundle {
  issuanceRecordID: string;
  issuanceStatus?: string;
  issueBatchID?: string;
  deliveredAt?: number;
  security?: TXCerSecurityState;
}

function valueText(value: unknown): string {
  return value == null ? '' : String(value);
}

function sameBytes(left: unknown, right: unknown): boolean {
  const a = decodeBackendBytes(left as any);
  const b = decodeBackendBytes(right as any);
  return a.length === b.length && a.every((byte, index) => byte === b[index]);
}

function ackAssignNodeID(ack: TXCerIssuanceAckV2): string {
  return valueText(ack.assignNodeID ?? ack.AssignNodeID);
}

function fastBundleError(bundle: TXCerSecurityBundle): string {
  const { issuanceRecord: record, fastEvidence, assignAck, liabilityReceipt, authoritySnapshot: authority } = bundle;
  if (!record || !fastEvidence || !assignAck || !liabilityReceipt) return '';
  if (!authority) return '';
  if (!authority.groupID || authority.groupID !== record.GuarGroupID) return 'authority group does not match issuance record';
  if (!authority.signerSetID || authority.signerSetID !== liabilityReceipt.SignerSetID) return 'LiabilityReceipt signer set is not authoritative';
  if (!verifyTXCerFastEvidence(record, fastEvidence, authority)) return 'FastEvidence verification failed';
  const targetAssignKey = authority.targetAssignPublicKey || authority.publicKeys[ackAssignNodeID(assignAck)];
  if (!targetAssignKey || !verifyTXCerIssuanceAck(assignAck, fastEvidence, targetAssignKey)) return 'AssignAck verification failed';
  if (!verifyFastLiabilityReceipt(liabilityReceipt, authority)) return 'LiabilityReceipt verification failed';
  if (record.TXCerID !== liabilityReceipt.TXCerID || record.LiabilityDeltaID !== liabilityReceipt.LiabilityDeltaID) {
    return 'LiabilityReceipt is not bound to the issuance record';
  }
  if (record.GuarGroupID !== liabilityReceipt.GroupID || record.TXCer?.SourcePledgeAddress !== liabilityReceipt.PledgeAddress) {
    return 'LiabilityReceipt authority fields do not match the issued TXCer';
  }
  if (!sameBytes(record.ExposureSharesHash, liabilityReceipt.ExposureSharesHash)) {
    return 'LiabilityReceipt exposure shares do not match the issuance record';
  }
  if (record.LiabilityReceiptHash != null && decodeBackendBytes(record.LiabilityReceiptHash).length > 0 &&
      !sameBytes(record.LiabilityReceiptHash, computeFastLiabilityReceiptHashV2(liabilityReceipt))) {
    return 'LiabilityReceipt hash does not match the issuance record';
  }
  return '';
}

function evaluateFastEvidence(bundle: TXCerSecurityBundle): Pick<TXCerSecurityState, 'fastEvidenceStatus' | 'fastEvidenceError'> {
  const missing: string[] = [];
  if (!bundle.issuanceRecord) missing.push('IssuanceRecord');
  if (!bundle.fastEvidence) missing.push('FastEvidence');
  if (!bundle.assignAck) missing.push('AssignAck');
  if (!bundle.liabilityReceipt) missing.push('LiabilityReceipt');
  if (!bundle.authoritySnapshot) missing.push('authority snapshot');
  if (missing.length > 0) {
    return { fastEvidenceStatus: 'Pending', fastEvidenceError: `Waiting for ${missing.join(', ')}` };
  }
  const error = fastBundleError(bundle);
  return error
    ? { fastEvidenceStatus: 'Failed', fastEvidenceError: error }
    : { fastEvidenceStatus: 'Verified', fastEvidenceError: '' };
}

function evaluateCFAA(bundle: TXCerSecurityBundle): Pick<TXCerSecurityState, 'cfaaAuditStatus' | 'cfaaAuditError'> {
  const record = bundle.issuanceRecord;
  const auditStatus = valueText(record?.AuditStatus).toLowerCase();
  if (auditStatus === 'disputed' || auditStatus === 'failed' || auditStatus === 'invalid') {
    return { cfaaAuditStatus: 'Failed', cfaaAuditError: `CFAA audit status is ${record?.AuditStatus}` };
  }
  if (!bundle.issuanceProof) {
    return { cfaaAuditStatus: 'Pending', cfaaAuditError: 'Waiting for asynchronous CFAA proof' };
  }
  if (!record || !bundle.authoritySnapshot) {
    return { cfaaAuditStatus: 'Unavailable', cfaaAuditError: 'CFAA authority context is unavailable' };
  }
  const certifierID = valueText(bundle.issuanceProof.CertifierID || record.CertifierID);
  const key = bundle.authoritySnapshot.publicKeys[certifierID] || bundle.authoritySnapshot.publicKeys[`certifier:${certifierID}`];
  if (!certifierID || !key) {
    return { cfaaAuditStatus: 'Unavailable', cfaaAuditError: 'Certifier public key is unavailable' };
  }
  return verifyTXCerIssueProof(record, bundle.issuanceProof, key)
    ? { cfaaAuditStatus: 'Verified', cfaaAuditError: '' }
    : { cfaaAuditStatus: 'Failed', cfaaAuditError: 'CFAA proof verification failed' };
}

export function evaluateTXCerSecurity(
  bundle: TXCerSecurityBundle,
  lifecycleStatus: string | null | undefined,
  checkedAt = Date.now()
): TXCerSecurityState {
  const fast = evaluateFastEvidence(bundle);
  const cfaa = evaluateCFAA(bundle);
  return {
    spendabilityStatus: lifecycleStatus === 'Active' ? 'Active' : 'NonSpendable',
    fastEvidenceStatus: fast.fastEvidenceStatus,
    cfaaAuditStatus: cfaa.cfaaAuditStatus,
    fastEvidenceError: fast.fastEvidenceError || '',
    cfaaAuditError: cfaa.cfaaAuditError || '',
    checkedAt
  };
}

export function isTXCerLocallySpendable(state: TXCerSecurityState | null | undefined): boolean {
  return state?.spendabilityStatus === 'Active' && state.fastEvidenceStatus !== 'Failed';
}

function richness(value: unknown, seen = new Set<unknown>()): number {
  if (value == null || value === '') return 0;
  if (typeof value !== 'object') return 1;
  if (seen.has(value)) return 0;
  seen.add(value);
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + richness(item, seen), value.length > 0 ? 1 : 0);
  return Object.values(value as Record<string, unknown>).reduce<number>((sum, item) => sum + richness(item, seen), 1);
}

function richer<T>(existing: T | undefined, incoming: T | undefined): T | undefined {
  if (existing === undefined) return incoming;
  if (incoming === undefined) return existing;
  return richness(incoming) > richness(existing) ? incoming : existing;
}

function fastRank(status: FastEvidenceStatus | undefined): number {
  return status === 'Failed' ? 3 : status === 'Verified' ? 2 : status === 'Pending' ? 1 : 0;
}

function auditRank(status: CFAAAuditStatus | undefined): number {
  return status === 'Failed' ? 4 : status === 'Verified' ? 3 : status === 'Pending' ? 2 : status === 'Unavailable' ? 1 : 0;
}

function mergeSecurity(existing?: TXCerSecurityState, incoming?: TXCerSecurityState): TXCerSecurityState | undefined {
  if (!existing) return incoming;
  if (!incoming) return existing;
  const fastIncoming = fastRank(incoming.fastEvidenceStatus) > fastRank(existing.fastEvidenceStatus);
  const auditIncoming = auditRank(incoming.cfaaAuditStatus) > auditRank(existing.cfaaAuditStatus);
  return {
    spendabilityStatus: incoming.spendabilityStatus || existing.spendabilityStatus,
    fastEvidenceStatus: fastIncoming ? incoming.fastEvidenceStatus : existing.fastEvidenceStatus,
    cfaaAuditStatus: auditIncoming ? incoming.cfaaAuditStatus : existing.cfaaAuditStatus,
    fastEvidenceError: fastIncoming ? incoming.fastEvidenceError : existing.fastEvidenceError,
    cfaaAuditError: auditIncoming ? incoming.cfaaAuditError : existing.cfaaAuditError,
    checkedAt: Math.max(existing.checkedAt || 0, incoming.checkedAt || 0)
  };
}

export function mergeTXCerEvidenceMetadata<T extends TXCerEvidenceMetadataV2>(existing: T | null | undefined, incoming: T): T {
  if (!existing) return incoming;
  if (existing.issuanceRecordID && incoming.issuanceRecordID && existing.issuanceRecordID !== incoming.issuanceRecordID) {
    throw new Error('cannot merge evidence from different issuance records');
  }
  const merged = { ...existing } as T;
  for (const [key, value] of Object.entries(incoming)) {
    if (value !== undefined) (merged as Record<string, unknown>)[key] = value;
  }
  merged.issuanceRecord = richer(existing.issuanceRecord, incoming.issuanceRecord);
  merged.fastEvidence = richer(existing.fastEvidence, incoming.fastEvidence);
  merged.assignAck = richer(existing.assignAck, incoming.assignAck);
  merged.liabilityReceipt = richer(existing.liabilityReceipt, incoming.liabilityReceipt);
  merged.issuanceProof = richer(existing.issuanceProof, incoming.issuanceProof);
  merged.authoritySnapshot = existing.authoritySnapshot || incoming.authoritySnapshot;
  merged.security = mergeSecurity(existing.security, incoming.security);
  return merged;
}
