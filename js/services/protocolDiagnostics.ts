import { API_ENDPOINTS } from '../config/api';
import type {
  AuditEvent,
  ChallengeRecord,
  PenaltyRecord,
  SchedulerStatsResponse,
  TxTaskDAGEvent,
  TxTaskDAGRecord
} from '../types/blockchain';
import { apiClient } from './api';

interface DAGRecordsResponse {
  success?: boolean;
  count?: number;
  records?: TxTaskDAGRecord[];
}

interface DAGEventsResponse {
  success?: boolean;
  count?: number;
  events?: TxTaskDAGEvent[];
}

interface AuditEventsResponse {
  success?: boolean;
  count?: number;
  events?: AuditEvent[];
}

interface ChallengesResponse {
  success?: boolean;
  count?: number;
  challenges?: ChallengeRecord[];
}

interface PenaltiesResponse {
  success?: boolean;
  count?: number;
  penalties?: PenaltyRecord[];
}

export interface SchedulerDAGRecordQuery {
  userID?: string;
  status?: string;
  limit?: number;
}

export interface SchedulerDAGEventQuery {
  txID?: string;
  afterSeq?: number;
  limit?: number;
}

export interface AuditEventQuery {
  subjectID?: string;
  eventType?: string;
  limit?: number;
}

export interface ChallengeQuery {
  userID?: string;
  status?: string;
}

export async function fetchAssignSchedulerStats(groupID: string): Promise<SchedulerStatsResponse> {
  return apiClient.get<SchedulerStatsResponse>(
    API_ENDPOINTS.ASSIGN_SCHEDULER_STATS(groupID),
    { silent: true, useBigIntParsing: true }
  );
}

export async function fetchAssignSchedulerDAGRecords(
  groupID: string,
  query: SchedulerDAGRecordQuery = {}
): Promise<TxTaskDAGRecord[]> {
  const response = await apiClient.get<DAGRecordsResponse>(
    withQuery(API_ENDPOINTS.ASSIGN_SCHEDULER_DAG_RECORDS(groupID), query),
    { silent: true, useBigIntParsing: true }
  );
  return response.records || [];
}

export async function fetchAssignSchedulerDAGEvents(
  groupID: string,
  query: SchedulerDAGEventQuery = {}
): Promise<TxTaskDAGEvent[]> {
  const response = await apiClient.get<DAGEventsResponse>(
    withQuery(API_ENDPOINTS.ASSIGN_SCHEDULER_DAG_EVENTS(groupID), query),
    { silent: true, useBigIntParsing: true }
  );
  return response.events || [];
}

export async function fetchAssignAuditEvents(
  groupID: string,
  query: AuditEventQuery = {}
): Promise<AuditEvent[]> {
  const response = await apiClient.get<AuditEventsResponse>(
    withQuery(API_ENDPOINTS.ASSIGN_AUDIT_EVENTS(groupID), query),
    { silent: true, useBigIntParsing: true }
  );
  return response.events || [];
}

export async function fetchAggrAuditEvents(
  groupID: string,
  query: AuditEventQuery = {}
): Promise<AuditEvent[]> {
  const response = await apiClient.get<AuditEventsResponse>(
    withQuery(API_ENDPOINTS.AGGR_AUDIT_EVENTS(groupID), query),
    { silent: true, useBigIntParsing: true }
  );
  return response.events || [];
}

export async function fetchAssignChallenges(
  groupID: string,
  query: ChallengeQuery = {}
): Promise<ChallengeRecord[]> {
  const response = await apiClient.get<ChallengesResponse>(
    withQuery(API_ENDPOINTS.ASSIGN_CHALLENGES(groupID), query),
    { silent: true, useBigIntParsing: true }
  );
  return response.challenges || [];
}

export async function fetchAggrChallenges(
  groupID: string,
  query: ChallengeQuery = {}
): Promise<ChallengeRecord[]> {
  const response = await apiClient.get<ChallengesResponse>(
    withQuery(API_ENDPOINTS.AGGR_CHALLENGES(groupID), query),
    { silent: true, useBigIntParsing: true }
  );
  return response.challenges || [];
}

export async function fetchComChallenges(status?: string): Promise<ChallengeRecord[]> {
  const response = await apiClient.get<ChallengesResponse>(
    withQuery(API_ENDPOINTS.COM_CHALLENGES, { status }),
    { silent: true, useBigIntParsing: true }
  );
  return response.challenges || [];
}

export async function fetchAssignPenalties(groupID: string): Promise<PenaltyRecord[]> {
  const response = await apiClient.get<PenaltiesResponse>(
    API_ENDPOINTS.ASSIGN_PENALTIES(groupID),
    { silent: true, useBigIntParsing: true }
  );
  return response.penalties || [];
}

function withQuery(path: string, query: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query) as Array<[string, unknown]>) {
    if (value === undefined || value === '') continue;
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
