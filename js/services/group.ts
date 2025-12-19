/**
 * Group/Organization Service Module
 * 
 * Provides guarantor organization query functions.
 * Handles group information retrieval from backend Gateway API.
 */

import { apiClient, ApiRequestError } from './api';
import { API_ENDPOINTS } from '../config/api';

// ============================================================================
// Types
// ============================================================================

/** Public key structure from backend (Go: PublicKeyNew) */
export interface PublicKeyNew {
  X?: string;
  Y?: string;
  Curve?: string;
}

/**
 * Guarantor Group Table structure from backend (Go: GuarGroupTable)
 * Backend uses PascalCase; we keep compatibility.
 */
export interface GuarGroupTable {
  GroupID?: string;
  PeerGroupID: string;
  AggrID?: string;
  AggrPeerID: string;
  AssiID?: string;
  AssiPeerID: string;
  PledgeAddress?: string;
  GuarTable?: Record<string, string>;
  AssignPublicKeyNew?: PublicKeyNew;
  AggrPublicKeyNew?: PublicKeyNew;
  CreateTime?: number;
}

/** Normalized group info for frontend use */
export interface GroupInfo {
  groupID: string;
  peerGroupID: string;
  aggreNode: string;
  aggrePeerID: string;
  assignNode: string;
  assignPeerID: string;
  pledgeAddress: string;
  guarTable?: Record<string, string>;
  createTime?: number;
}

/** Result type for operations that can fail */
export type QueryResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; notFound?: boolean };

// ============================================================================
// Private Helper Functions
// ============================================================================

/**
 * Normalize backend group data to frontend format
 */
function normalizeGroupInfo(groupId: string, raw: GuarGroupTable): GroupInfo {
  return {
    groupID: raw.GroupID || groupId,
    peerGroupID: raw.PeerGroupID || '',
    aggreNode: raw.AggrID || '',
    aggrePeerID: raw.AggrPeerID || '',
    assignNode: raw.AssiID || '',
    assignPeerID: raw.AssiPeerID || '',
    pledgeAddress: raw.PledgeAddress || '',
    guarTable: raw.GuarTable,
    createTime: raw.CreateTime
  };
}

// ============================================================================
// Public API Functions
// ============================================================================

/**
 * Query guarantor group information by ID
 * @param groupId - 8-digit organization ID
 * @returns Normalized group information
 * @throws ApiRequestError if request fails or group ID is invalid
 */
export async function queryGroupInfo(groupId: string): Promise<GroupInfo> {
  if (!groupId || !/^\d{8}$/.test(groupId)) {
    throw new ApiRequestError('无效的组织ID格式，需要8位数字', {
      code: 'INVALID_GROUP_ID'
    });
  }

  const endpoint = API_ENDPOINTS.GROUP_INFO(groupId);

  const raw = await apiClient.get<GuarGroupTable>(endpoint, {
    timeout: 10000,
    retries: 2
  });

  return normalizeGroupInfo(groupId, raw);
}

/**
 * Query group info from assign node
 * @param groupId - 8-digit organization ID
 * @returns Normalized group information
 * @throws ApiRequestError if request fails or group ID is invalid
 */
export async function queryGroupInfoFromAssign(groupId: string): Promise<GroupInfo> {
  if (!groupId || !/^\d{8}$/.test(groupId)) {
    throw new ApiRequestError('无效的组织ID格式，需要8位数字', {
      code: 'INVALID_GROUP_ID'
    });
  }

  const endpoint = API_ENDPOINTS.ASSIGN_GROUP_INFO(groupId);

  const raw = await apiClient.get<GuarGroupTable>(endpoint, {
    timeout: 10000,
    retries: 2
  });

  return normalizeGroupInfo(groupId, raw);
}

/**
 * Safely query group information without throwing errors
 * @param groupId - 8-digit organization ID
 * @returns Query result with success flag and data or error
 */
export async function queryGroupInfoSafe(groupId: string): Promise<QueryResult<GroupInfo>> {
  try {
    const data = await queryGroupInfo(groupId);
    return { success: true, data };
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return {
        success: false,
        error: error.message,
        notFound: error.status === 404
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    };
  }
}
