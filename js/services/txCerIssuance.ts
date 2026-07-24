import { API_ENDPOINTS } from '../config/api';
import type {
  CertifierIssueBatchRequest,
  CertifierInfo,
  PublicKeyNew,
  TxCertificate,
  TXCerIssuanceDetailView,
  TXCerIssuanceMetadata
} from '../types/blockchain';
import { apiClient } from './api';
import { evaluateTXCerIssueProof } from './txCerIssuanceProof';
import { asProtocolTXCerIssuanceRecord } from './txCerIssuanceProof';
import { queryGroupInfo, type GroupInfo } from './group';
import {
  evaluateTXCerSecurity,
  mergeTXCerEvidenceMetadata,
  type TXCerAuthoritySnapshot
} from '../protocol-v2/security';
import type {
  FastLiabilityReceiptV2,
  PublicKeyV2,
  TXCerFastEvidenceV2,
  TXCerIssuanceAckV2,
  TXCerIssuanceRecordV2,
  TXCerIssueProofV2
} from '../protocol-v2/types';

interface IssuanceRecordsResponse {
  success?: boolean;
  count?: number;
  records?: TXCerIssuanceDetailView[];
}

interface IssuanceRecordResponse {
  success?: boolean;
  record?: TXCerIssuanceDetailView;
}

interface CertifiersResponse {
  success?: boolean;
  count?: number;
  certifiers?: CertifierInfo[];
}

interface CertifierStatsResponse {
  success?: boolean;
  stats?: Record<string, CertifierInfo>;
}

interface CertifierPendingRequestsResponse {
  success?: boolean;
  count?: number;
  requests?: CertifierIssueBatchRequest[];
}

function buildAuthorityUrl(path: string, authorityBaseUrl?: string): string {
  const base = String(authorityBaseUrl || '').trim().replace(/\/+$/, '');
  if (!base) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

export async function fetchTXCerIssuanceRecords(
  groupID: string,
  userID: string,
  includeProof = false
): Promise<TXCerIssuanceDetailView[]> {
  const query = new URLSearchParams({ userID, includeProof: String(includeProof) });
  const response = await apiClient.get<IssuanceRecordsResponse>(
    `${API_ENDPOINTS.AGGR_TXCER_ISSUANCE_RECORDS(groupID)}?${query.toString()}`,
    { silent: true, useBigIntParsing: true }
  );
  return response.records || [];
}

export async function fetchTXCerIssuanceRecord(
  groupID: string,
  recordID: string,
  userID?: string,
  includeProof = false,
  authorityBaseUrl?: string
): Promise<TXCerIssuanceDetailView | null> {
  const query = new URLSearchParams({ includeProof: String(includeProof) });
  if (userID) query.set('userID', userID);
  const response = await apiClient.get<IssuanceRecordResponse>(
    `${buildAuthorityUrl(API_ENDPOINTS.AGGR_TXCER_ISSUANCE_RECORD(groupID, recordID), authorityBaseUrl)}?${query.toString()}`,
    { silent: true, useBigIntParsing: true }
  );
  return response.record || null;
}

export async function fetchTXCerIssuanceBatch(
  groupID: string,
  batchID: string,
  includeProof = false
): Promise<TXCerIssuanceDetailView[]> {
  const query = new URLSearchParams({ includeProof: String(includeProof) });
  const response = await apiClient.get<IssuanceRecordsResponse>(
    `${API_ENDPOINTS.AGGR_TXCER_ISSUANCE_BATCH(groupID, batchID)}?${query.toString()}`,
    { silent: true, useBigIntParsing: true }
  );
  return response.records || [];
}

export async function fetchAggrCertifiers(groupID: string, authorityBaseUrl?: string): Promise<CertifierInfo[]> {
  const response = await apiClient.get<CertifiersResponse>(
    buildAuthorityUrl(API_ENDPOINTS.AGGR_CERTIFIERS(groupID), authorityBaseUrl),
    { silent: true, useBigIntParsing: true }
  );
  return response.certifiers || [];
}

export async function fetchAssignCertifiers(groupID: string): Promise<CertifierInfo[]> {
  const response = await apiClient.get<CertifiersResponse>(
    API_ENDPOINTS.ASSIGN_CERTIFIERS(groupID),
    { silent: true, useBigIntParsing: true }
  );
  return response.certifiers || [];
}

export async function fetchAggrCertifierStats(groupID: string): Promise<Record<string, CertifierInfo>> {
  const response = await apiClient.get<CertifierStatsResponse>(
    API_ENDPOINTS.AGGR_CERTIFIER_STATS(groupID),
    { silent: true, useBigIntParsing: true }
  );
  return response.stats || {};
}

export async function fetchAggrCertifierPendingRequests(groupID: string): Promise<CertifierIssueBatchRequest[]> {
  const response = await apiClient.get<CertifierPendingRequestsResponse>(
    API_ENDPOINTS.AGGR_CERTIFIER_PENDING_REQUESTS(groupID),
    { silent: true, useBigIntParsing: true }
  );
  return response.requests || [];
}

export function certifierPublicKeyFromRegistry(
  certifiers: CertifierInfo[] | undefined | null,
  certifierID: string | undefined
): PublicKeyNew | null {
  if (!certifiers || !certifierID) return null;
  const found = certifiers.find((item) => stringField(item as Record<string, unknown>, 'certifierID', 'CertifierID') === certifierID);
  return found?.publicKey || found?.PublicKey || null;
}

export function buildTXCerIssuanceMetadata(
  record: TXCerIssuanceDetailView,
  certifierPublicKey?: PublicKeyNew | null
): TXCerIssuanceMetadata {
  const source = record as Record<string, unknown>;
  const proof = record.proof || record.Proof;
  const verification = evaluateTXCerIssueProof(record, proof, certifierPublicKey);
  const protocolRecord = asProtocolTXCerIssuanceRecord(record) as TXCerIssuanceRecordV2;
  return {
    txCer: protocolRecord.TXCer as TxCertificate,
    lifecycleStatus: 'Active',
    issuanceRecordID: stringField(source, 'recordID', 'RecordID'),
    issuanceStatus: stringField(source, 'status', 'Status'),
    issuanceProof: proof,
    issueBatchID: stringField(source, 'batchID', 'BatchID') || proof?.BatchID || '',
    proofStatus: verification.status,
    proofCheckedAt: Date.now(),
    proofError: verification.error || '',
    issuanceRecord: protocolRecord,
    fastEvidence: protocolRecord.FastEvidence,
    assignAck: protocolRecord.Ack,
    liabilityReceipt: protocolRecord.LiabilityReceipt,
    security: evaluateTXCerSecurity({
      issuanceRecord: protocolRecord,
      fastEvidence: protocolRecord.FastEvidence,
      assignAck: protocolRecord.Ack,
      liabilityReceipt: protocolRecord.LiabilityReceipt,
      issuanceProof: proof
    }, 'Active')
  };
}

export function buildTXCerIssuanceMetadataFromRegistry(
  record: TXCerIssuanceDetailView,
  certifiers: CertifierInfo[] | undefined | null
): TXCerIssuanceMetadata {
  const source = record as Record<string, unknown>;
  const proof = record.proof || record.Proof;
  const certifierID = proof?.CertifierID || stringField(source, 'certifierID', 'CertifierID');
  return buildTXCerIssuanceMetadata(record, certifierPublicKeyFromRegistry(certifiers, certifierID));
}

function quorumThreshold(memberCount: number): number {
  return memberCount > 0 ? Math.floor((2 * memberCount) / 3) + 1 : 0;
}

function certifierID(info: CertifierInfo): string {
  return stringField(info as Record<string, unknown>, 'certifierID', 'CertifierID');
}

function certifierKey(info: CertifierInfo): PublicKeyNew | null {
  return info.publicKey || info.PublicKey || null;
}

export function buildTXCerAuthoritySnapshot(
  record: TXCerIssuanceRecordV2,
  sourceGroup: GroupInfo,
  targetGroup: GroupInfo,
  certifiers: CertifierInfo[],
  capturedAt = Date.now()
): TXCerAuthoritySnapshot {
  const groupID = String(record.GuarGroupID || record.TXCer?.FromGuarGroupID || '');
  if (!groupID || sourceGroup.groupID !== groupID) throw new Error('source group authority mismatch');
  if (!sourceGroup.aggrPublicKey || !sourceGroup.assignPublicKey || !targetGroup.assignPublicKey) {
    throw new Error('group authority public keys are incomplete');
  }
  const publicKeys: Record<string, PublicKeyV2> = { aggr: sourceGroup.aggrPublicKey };
  if (sourceGroup.aggreNode) publicKeys[sourceGroup.aggreNode] = sourceGroup.aggrPublicKey;
  if (sourceGroup.assignNode) publicKeys[sourceGroup.assignNode] = sourceGroup.assignPublicKey;
  if (targetGroup.assignNode) publicKeys[targetGroup.assignNode] = targetGroup.assignPublicKey;
  for (const info of certifiers) {
    const id = certifierID(info);
    const key = certifierKey(info);
    if (!id || !key) continue;
    const signerID = `certifier:${id}`;
    publicKeys[signerID] = key;
    publicKeys[id] = key;
  }
  // CFAA certifiers audit issuance batches; they are not automatically members
  // of the independently signed liability receipt. The receipt's signed
  // Signers field selects identities from the authoritative group key set,
  // while the quorum is recomputed locally instead of trusting Threshold.
  const members = Array.from(new Set(
    (record.LiabilityReceipt?.Signers || [])
      .map(signer => String(signer || '').trim())
      .filter(Boolean),
  ));
  members.sort();
  const threshold = quorumThreshold(members.length);
  if (threshold <= 0) throw new Error('liability signer set is empty');
  return {
    groupID,
    signerSetID: `${groupID}:liability:v1`,
    members,
    threshold,
    publicKeys,
    sourceAggregationPublicKey: sourceGroup.aggrPublicKey,
    sourceAssignPublicKey: sourceGroup.assignPublicKey,
    targetAssignPublicKey: targetGroup.assignPublicKey,
    capturedAt
  };
}

export function buildVerifiedTXCerIssuanceMetadata(
  record: TXCerIssuanceDetailView,
  authoritySnapshot: TXCerAuthoritySnapshot,
  lifecycleStatus = 'Active',
  existing?: TXCerIssuanceMetadata | null
): TXCerIssuanceMetadata {
  const source = record as Record<string, unknown>;
  const protocolRecord = asProtocolTXCerIssuanceRecord(record) as TXCerIssuanceRecordV2;
  const proof = (record.proof || record.Proof) as TXCerIssueProofV2 | undefined;
  const fastEvidence = (record.fastEvidence || record.FastEvidence || protocolRecord.FastEvidence) as TXCerFastEvidenceV2 | undefined;
  const assignAck = (record.ack || record.Ack || protocolRecord.Ack) as TXCerIssuanceAckV2 | undefined;
  const liabilityReceipt = (record.liabilityReceipt || record.LiabilityReceipt || protocolRecord.LiabilityReceipt) as FastLiabilityReceiptV2 | undefined;
  const security = evaluateTXCerSecurity({ issuanceRecord: protocolRecord, fastEvidence, assignAck, liabilityReceipt, issuanceProof: proof, authoritySnapshot }, lifecycleStatus);
  const proofStatus = security.cfaaAuditStatus === 'Verified'
    ? 'verified'
    : security.cfaaAuditStatus === 'Failed'
      ? 'invalid'
      : security.cfaaAuditStatus === 'Unavailable' ? 'unsupported' : 'missingProof';
  const incoming: TXCerIssuanceMetadata = {
    txCer: protocolRecord.TXCer as TxCertificate,
    lifecycleStatus,
    issuanceRecordID: stringField(source, 'recordID', 'RecordID'),
    issuanceStatus: stringField(source, 'status', 'Status'),
    issuanceProof: proof,
    issueBatchID: stringField(source, 'batchID', 'BatchID') || proof?.BatchID || '',
    proofStatus,
    proofCheckedAt: security.checkedAt,
    proofError: security.cfaaAuditError || '',
    issuanceRecord: protocolRecord,
    fastEvidence,
    assignAck,
    liabilityReceipt,
    authoritySnapshot,
    security
  };
  return mergeTXCerEvidenceMetadata(existing, incoming) as TXCerIssuanceMetadata;
}

async function fetchGroupAuthority(groupID: string, authorityBaseUrl?: string): Promise<GroupInfo> {
  if (!authorityBaseUrl) return queryGroupInfo(groupID);
  const response = await apiClient.get<Record<string, any>>(
    buildAuthorityUrl(API_ENDPOINTS.GROUP_INFO(groupID), authorityBaseUrl),
    { silent: true, useBigIntParsing: true }
  );
  const raw = (response?.data && typeof response.data === 'object' ? response.data : response) as Record<string, any>;
  return {
    groupID: String(raw.GroupID || raw.groupID || groupID),
    peerGroupID: String(raw.PeerGroupID || raw.peerGroupID || ''),
    aggreNode: String(raw.AggrID || raw.aggreNode || ''),
    aggrePeerID: String(raw.AggrPeerID || raw.aggrePeerID || ''),
    assignNode: String(raw.AssiID || raw.assignNode || ''),
    assignPeerID: String(raw.AssiPeerID || raw.assignPeerID || ''),
    pledgeAddress: String(raw.PledgeAddress || raw.pledgeAddress || ''),
    assignPublicKey: raw.AssignPublicKeyNew || raw.assignPublicKey,
    aggrPublicKey: raw.AggrPublicKeyNew || raw.aggrPublicKey,
    certifiers: raw.Certifiers || raw.certifiers,
    assignAPIEndpoint: raw.AssignAPIEndpoint || raw.assignAPIEndpoint,
    aggrAPIEndpoint: raw.AggrAPIEndpoint || raw.aggrAPIEndpoint
  };
}

export async function resolveTXCerAuthoritySnapshot(
  record: TXCerIssuanceDetailView,
  authorityBaseUrl?: string
): Promise<TXCerAuthoritySnapshot> {
  const protocolRecord = asProtocolTXCerIssuanceRecord(record) as TXCerIssuanceRecordV2;
  const sourceID = String(protocolRecord.GuarGroupID || protocolRecord.TXCer?.FromGuarGroupID || '');
  const targetID = String(protocolRecord.TXCer?.ToGuarGroupID || sourceID);
  if (!sourceID || !targetID) throw new Error('TXCer group binding is incomplete');
  const [sourceGroup, targetGroup, registry] = await Promise.all([
    fetchGroupAuthority(sourceID, authorityBaseUrl),
    targetID === sourceID
      ? fetchGroupAuthority(sourceID, authorityBaseUrl)
      : fetchGroupAuthority(targetID, authorityBaseUrl),
    fetchAggrCertifiers(sourceID, authorityBaseUrl)
  ]);
  const fallback = Object.values(sourceGroup.certifiers || {});
  return buildTXCerAuthoritySnapshot(protocolRecord, sourceGroup, targetGroup, registry.length > 0 ? registry : fallback);
}

export async function refreshTXCerIssuanceMetadata(
  metadata: TXCerIssuanceMetadata,
  userID: string,
  lifecycleStatus = 'Active',
  authorityBaseUrl?: string
): Promise<TXCerIssuanceMetadata> {
  const current = metadata.issuanceRecord as TXCerIssuanceRecordV2 | undefined;
  const groupID = String(current?.GuarGroupID || current?.TXCer?.FromGuarGroupID || '');
  if (!groupID || !metadata.issuanceRecordID) return metadata;
  let detail: TXCerIssuanceDetailView | null = null;
  try {
    detail = await fetchTXCerIssuanceRecord(
      groupID,
      metadata.issuanceRecordID,
      userID,
      true,
      authorityBaseUrl
    );
  } catch (error) {
    return markAuthorityReplayUnavailable(metadata, lifecycleStatus, error);
  }
  if (!detail) return markAuthorityReplayUnavailable(metadata, lifecycleStatus, 'empty issuance response');
  try {
    const snapshot = metadata.authoritySnapshot
      || await resolveTXCerAuthoritySnapshot(detail, authorityBaseUrl);
    return buildVerifiedTXCerIssuanceMetadata(detail, snapshot, lifecycleStatus, metadata);
  } catch (error) {
    const protocolRecord = asProtocolTXCerIssuanceRecord(detail) as TXCerIssuanceRecordV2;
    const incoming = buildTXCerIssuanceMetadata(detail);
    incoming.security = evaluateTXCerSecurity({
      issuanceRecord: protocolRecord,
      fastEvidence: protocolRecord.FastEvidence,
      assignAck: protocolRecord.Ack,
      liabilityReceipt: protocolRecord.LiabilityReceipt,
      issuanceProof: detail.proof || detail.Proof
    }, lifecycleStatus);
    incoming.security.fastEvidenceError = error instanceof Error ? error.message : String(error);
    return mergeTXCerEvidenceMetadata(metadata, incoming) as TXCerIssuanceMetadata;
  }
}

function markAuthorityReplayUnavailable(
  metadata: TXCerIssuanceMetadata,
  lifecycleStatus: string,
  error: unknown
): TXCerIssuanceMetadata {
  const reason = `authority replay unavailable: ${error instanceof Error ? error.message : String(error)}`;
  return {
    ...metadata,
    security: {
      ...metadata.security,
      spendabilityStatus: metadata.security?.spendabilityStatus
        || (lifecycleStatus === 'Active' ? 'Active' : 'NonSpendable'),
      fastEvidenceStatus: metadata.security?.fastEvidenceStatus === 'Failed' ? 'Failed' : 'Pending',
      cfaaAuditStatus: metadata.security?.cfaaAuditStatus === 'Failed' ? 'Failed' : 'Unavailable',
      fastEvidenceError: metadata.security?.fastEvidenceStatus === 'Failed'
        ? metadata.security.fastEvidenceError
        : reason,
      cfaaAuditError: metadata.security?.cfaaAuditStatus === 'Failed'
        ? metadata.security.cfaaAuditError
        : reason,
      checkedAt: Date.now()
    }
  };
}

function stringField(source: Record<string, unknown>, camel: string, pascal: string): string {
  const value = source[camel] ?? source[pascal];
  return typeof value === 'string' ? value : '';
}
