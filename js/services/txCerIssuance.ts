import { API_ENDPOINTS } from '../config/api';
import type {
  CertifierIssueBatchRequest,
  CertifierInfo,
  PublicKeyNew,
  TXCerIssuanceDetailView,
  TXCerIssuanceMetadata
} from '../types/blockchain';
import { apiClient } from './api';
import { evaluateTXCerIssueProof } from './txCerIssuanceProof';

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
  includeProof = false
): Promise<TXCerIssuanceDetailView | null> {
  const query = new URLSearchParams({ includeProof: String(includeProof) });
  if (userID) query.set('userID', userID);
  const response = await apiClient.get<IssuanceRecordResponse>(
    `${API_ENDPOINTS.AGGR_TXCER_ISSUANCE_RECORD(groupID, recordID)}?${query.toString()}`,
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

export async function fetchAggrCertifiers(groupID: string): Promise<CertifierInfo[]> {
  const response = await apiClient.get<CertifiersResponse>(
    API_ENDPOINTS.AGGR_CERTIFIERS(groupID),
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
  return {
    issuanceRecordID: stringField(source, 'recordID', 'RecordID'),
    issuanceStatus: stringField(source, 'status', 'Status'),
    issuanceProof: proof,
    issueBatchID: stringField(source, 'batchID', 'BatchID') || proof?.BatchID || '',
    proofStatus: verification.status,
    proofCheckedAt: Date.now(),
    proofError: verification.error || ''
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

function stringField(source: Record<string, unknown>, camel: string, pascal: string): string {
  const value = source[camel] ?? source[pascal];
  return typeof value === 'string' ? value : '';
}
