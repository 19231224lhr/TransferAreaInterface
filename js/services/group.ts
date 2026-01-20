/**
 * Group/Organization Service Module
 * 
 * Provides guarantor organization query functions and join/leave operations.
 * Handles group information retrieval and flow-apply API calls.
 */

import { apiClient, ApiRequestError } from './api';
import { API_ENDPOINTS, API_BASE_URL } from '../config/api';
import { loadUser, saveUser } from '../utils/storage';
import { getDecryptedPrivateKey, getDecryptedPrivateKeyWithPrompt } from '../utils/keyEncryptionUI';
import { t } from '../i18n/index.js';

// 导入新的签名工具库
import {
  signStruct as signStructCore,
  verifyStruct as verifyStructCore,
  serializeForBackend,
  convertHexToPublicKey,
  getTimestamp as getUnixTimestamp,
  hexToBigInt,
  bigIntToHex,
  getPublicKeyHexFromPrivate,
  type PublicKeyNew as SigPublicKeyNew,
  type EcdsaSignature as SigEcdsaSignature
} from '../utils/signature';

// ============================================================================
// Types
// ============================================================================

/** Public key structure from backend (Go: PublicKeyNew) */
export interface PublicKeyNew {
  CurveName?: string;  // Backend uses CurveName
  Curve?: string;      // Frontend compatibility
  X?: string | bigint; // Big integer as decimal string or bigint
  Y?: string | bigint; // Big integer as decimal string or bigint
}

/** ECDSA signature structure (Go format with PascalCase) */
export interface EcdsaSignature {
  R: string | bigint;  // Big integer as decimal string or bigint
  S: string | bigint;  // Big integer as decimal string or bigint
}

/** Address data for flow-apply request */
export interface AddressData {
  PublicKeyNew: PublicKeyNew | SigPublicKeyNew;
}

/** AddressMsg mapping: address -> AddressData */
export type AddressMsg = Record<string, { AddressData: AddressData }>;

/** Flow apply request body (Go: FlowApply) */
export interface FlowApplyRequest {
  Status: number;           // 1=join, 0=leave
  UserID: string;           // 8-digit user ID
  UserPeerID: string;       // P2P peer ID (empty for HTTP)
  GuarGroupID: string;      // Target organization ID
  UserPublicKey: PublicKeyNew | SigPublicKeyNew | { CurveName: string; X: null; Y: null };  // User's account public key (can be zero value for leave)
  AddressMsg: AddressMsg | null;   // Address info (required for join, null for leave - Go map zero value is nil)
  TimeStamp: number;        // Custom timestamp (seconds since 2020-01-01)
  UserSig?: EcdsaSignature | SigEcdsaSignature;  // Account private key signature (optional, added after signing)
}

/** Flow apply response */
export interface FlowApplyResponse {
  status: number;
  user_id: string;
  guar_group_id: string;
  result: boolean;
  message: string;
  /** Error message (returned by respondWithError when HTTP status is not 200) */
  error?: string;
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
  AssignAPIEndpoint?: string;  // AssignNode HTTP API 端口 (如 ":8081")
  AggrAPIEndpoint?: string;    // AggregationNode HTTP API 端口 (如 ":8082")
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
  assignAPIEndpoint?: string;  // AssignNode API 端口 (如 ":8081")
  aggrAPIEndpoint?: string;    // AggrNode API 端口 (如 ":8082")
  guarTable?: Record<string, string>;
  createTime?: number;
}

/** Extended group info with API endpoints for storage */
export interface GroupInfoWithEndpoints extends GroupInfo {
  assignNodeUrl?: string;   // Complete AssignNode URL (如 "http://localhost:8081")
  aggrNodeUrl?: string;     // Complete AggrNode URL (如 "http://localhost:8082")
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
    assignAPIEndpoint: raw.AssignAPIEndpoint,
    aggrAPIEndpoint: raw.AggrAPIEndpoint,
    guarTable: raw.GuarTable,
    createTime: raw.CreateTime
  };
}

// ============================================================================
// Public API Functions
// ============================================================================

/**
 * Group list item for service discovery
 */
export interface GroupListItem {
  group_id: string;
  assign_api_endpoint: string;
  aggr_api_endpoint: string;
  assi_peer_id: string;
  aggr_peer_id: string;
}

/**
 * Response structure for listing all groups
 */
export interface GroupListResponse {
  success: boolean;
  groups: GroupListItem[];
  count: number;
  boot_node: boolean;
}

/**
 * List all registered guarantor organizations (service discovery)
 * @returns List of available groups with their API endpoints
 * @throws ApiRequestError if request fails
 */
export async function listAllGroups(): Promise<GroupListResponse> {
  const endpoint = API_ENDPOINTS.GROUPS_LIST;

  const response = await apiClient.get<GroupListResponse>(endpoint, {
    timeout: 10000,
    retries: 2
  });

  return response;
}

/**
 * Query guarantor group information by ID
 * @param groupId - 8-digit organization ID
 * @returns Normalized group information
 * @throws ApiRequestError if request fails or group ID is invalid
 */
export async function queryGroupInfo(groupId: string): Promise<GroupInfo> {
  if (!groupId || !/^\d{8}$/.test(groupId)) {
    throw new ApiRequestError(t('error.invalidGroupIdFormat'), {
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
    throw new ApiRequestError(t('error.invalidGroupIdFormat'), {
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
      error: error instanceof Error ? error.message : t('error.unknownError')
    };
  }
}

/**
 * Query group info via AssignNode (for users already in a group)
 * Uses the AssignNode's group-info endpoint: GET /api/v1/{groupID}/assign/group-info
 * 
 * @param targetGroupId - The group ID to query
 * @param currentGroupInfo - Current user's group info (for API endpoint)
 * @returns Normalized group information
 * @throws ApiRequestError if request fails
 */
export async function queryGroupInfoViaAssignNode(
  targetGroupId: string,
  currentGroupInfo: GroupInfo
): Promise<GroupInfo> {
  if (!targetGroupId || !/^\d{8}$/.test(targetGroupId)) {
    throw new ApiRequestError(t('error.invalidGroupIdFormat'), {
      code: 'INVALID_GROUP_ID'
    });
  }

  // Build the AssignNode URL
  let apiUrl: string;
  if (currentGroupInfo.assignAPIEndpoint) {
    const assignNodeUrl = buildAssignNodeUrl(currentGroupInfo.assignAPIEndpoint);
    apiUrl = `${assignNodeUrl}/api/v1/${currentGroupInfo.groupID}/assign/group-info?groupId=${targetGroupId}`;
  } else {
    // Fallback to default API base URL
    apiUrl = `${API_BASE_URL}${API_ENDPOINTS.ASSIGN_GROUP_INFO(currentGroupInfo.groupID)}?groupId=${targetGroupId}`;
  }

  console.debug(`[Group] Querying group info via AssignNode: ${apiUrl}`);

  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new ApiRequestError(t('groupDetail.orgNotFound'), {
        code: 'GROUP_NOT_FOUND',
        status: 404
      });
    }
    throw new ApiRequestError(`${t('error.networkError')}: HTTP ${response.status}`, {
      code: 'NETWORK_ERROR',
      status: response.status
    });
  }

  // The response is ReturnGroupBootMsg: { guar_group_id, group_msg: GuarGroupTable }
  const data = await response.json();

  // Handle both direct GuarGroupTable and wrapped ReturnGroupBootMsg formats
  const raw: GuarGroupTable = data.group_msg || data.GroupMsg || data;
  const groupId = data.guar_group_id || data.GuarGroupID || targetGroupId;

  return normalizeGroupInfo(groupId, raw);
}

/**
 * Safely query group info via AssignNode without throwing errors
 * @param targetGroupId - The group ID to query
 * @param currentGroupInfo - Current user's group info
 * @returns Query result with success flag and data or error
 */
export async function queryGroupInfoViaAssignNodeSafe(
  targetGroupId: string,
  currentGroupInfo: GroupInfo
): Promise<QueryResult<GroupInfo>> {
  try {
    const data = await queryGroupInfoViaAssignNode(targetGroupId, currentGroupInfo);
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
      error: error instanceof Error ? error.message : t('error.unknownError')
    };
  }
}

// ============================================================================
// Timestamp & Signing Utilities
// ============================================================================

/**
 * Custom start time for timestamps (2020-01-01 00:00:00 UTC)
 * Matches backend Go: time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC)
 */
const CUSTOM_START_TIME = new Date('2020-01-01T00:00:00Z').getTime();

/**
 * Get custom timestamp (seconds since 2020-01-01 UTC)
 * Matches backend Go: GetTimestamp()
 */
export function getTimestamp(): number {
  const currentTime = Date.now();
  return Math.floor((currentTime - CUSTOM_START_TIME) / 1000);
}

/**
 * Convert public key from hex format to backend format (bigint)
 * @param pubXHex - X coordinate in hex
 * @param pubYHex - Y coordinate in hex
 * @returns PublicKeyNew in backend format
 */
export function convertPublicKeyToBackendFormat(pubXHex: string, pubYHex: string): SigPublicKeyNew {
  return convertHexToPublicKey(pubXHex, pubYHex);
}

/**
 * Sign a structure using ECDSA P-256 (matches backend SignStruct)
 * 
 * This is a wrapper around the core signStruct function from signature.ts
 * that provides the same interface as before but uses the new implementation.
 * 
 * ⚠️ Important: Excluded fields are set to zero values, not deleted!
 * This matches the backend's reflect.Zero() behavior.
 * 
 * @param data - Object to sign
 * @param privateKeyHex - Private key in hex format
 * @param excludeFields - Fields to exclude from signature (will be set to zero values)
 * @returns ECDSA signature in backend format (bigint)
 */
export function signStruct(
  data: Record<string, unknown>,
  privateKeyHex: string,
  excludeFields: string[]
): SigEcdsaSignature {
  console.debug('[Group] 🔐 Calling signStruct with excludeFields:', excludeFields);
  const signature = signStructCore(data, privateKeyHex, excludeFields);
  console.debug('[Group] ✓ Signature generated:', { R: signature.R.toString(), S: signature.S.toString() });
  return signature;
}

/**
 * Verify a structure signature locally (matches backend VerifyStructSig)
 * 
 * This function verifies the signature using the same logic as the backend,
 * allowing us to debug signature issues before sending to the server.
 * 
 * @param data - Object that was signed
 * @param signature - The signature to verify
 * @param pubXHex - Public key X coordinate in hex format
 * @param pubYHex - Public key Y coordinate in hex format
 * @param excludeFields - Fields that were excluded from signature
 * @returns true if signature is valid, false otherwise
 */
export function verifyStructLocal(
  data: Record<string, unknown>,
  signature: SigEcdsaSignature,
  pubXHex: string,
  pubYHex: string,
  excludeFields: string[]
): boolean {
  console.debug('[Group] 🔍 Verifying signature locally...');
  console.debug('[Group] Public key X:', pubXHex);
  console.debug('[Group] Public key Y:', pubYHex);

  const result = verifyStructCore(data, signature, pubXHex, pubYHex, excludeFields);

  if (result) {
    console.info('[Group] ✅ Local signature verification PASSED');
  } else {
    console.error('[Group] ❌ Local signature verification FAILED');
  }

  return result;
}

// ============================================================================
// Join/Leave Organization API
// ============================================================================

/**
 * Build AssignNode URL from base host and endpoint
 * @param assignEndpoint - Port string like ":8081"
 * @returns Full URL like "http://localhost:8081"
 */
/**
 * Build AssignNode URL from base host and endpoint
 * @param assignEndpoint - Port string like ":8081" or "IP:PORT"
 * @returns Full URL like "http://localhost:8081"
 */
export function buildAssignNodeUrl(assignEndpoint: string): string {
  const baseUrl = new URL(API_BASE_URL);
  const protocol = baseUrl.protocol;
  const currentHost = baseUrl.hostname; // e.g., 'localhost'

  if (assignEndpoint.startsWith(':')) {
    // Old format ":8081" -> Use current host + port
    const port = assignEndpoint.slice(1);
    return `${protocol}//${currentHost}:${port}`;
  } else {
    // New format "IP:PORT" or full URL
    if (!assignEndpoint.startsWith('http://') && !assignEndpoint.startsWith('https://')) {
      // Parse IP:PORT format
      const colonIndex = assignEndpoint.lastIndexOf(':');
      if (colonIndex > 0) {
        const ip = assignEndpoint.substring(0, colonIndex);
        const port = assignEndpoint.substring(colonIndex + 1);

        // 🔧 CORS Fix: If the IP is 127.0.0.1 and we're on localhost (or vice versa),
        // use the current host to avoid cross-origin issues.
        // Browser treats 127.0.0.1 and localhost as different origins!
        if (ip === '127.0.0.1' || ip === 'localhost') {
          return `${protocol}//${currentHost}:${port}`;
        }

        return `${protocol}//${assignEndpoint}`;
      }
      return `${protocol}//${assignEndpoint}`;
    }

    // Full URL provided - check if it needs hostname normalization
    try {
      const endpointUrl = new URL(assignEndpoint);
      if (endpointUrl.hostname === '127.0.0.1' || endpointUrl.hostname === 'localhost') {
        // Normalize to current host to avoid localhost/remote mismatch
        return `${endpointUrl.protocol}//${currentHost}:${endpointUrl.port}${endpointUrl.pathname}`;
      }
    } catch {
      // Invalid URL, return as-is
    }
    return assignEndpoint;
  }
}

/**
 * Build AggrNode URL from base host and endpoint
 * @param aggrEndpoint - Port string like ":8082" or "IP:PORT"
 * @returns Full URL like "http://localhost:8082"
 */
export function buildAggrNodeUrl(aggrEndpoint: string): string {
  const baseUrl = new URL(API_BASE_URL);
  const protocol = baseUrl.protocol;
  const currentHost = baseUrl.hostname; // e.g., 'localhost'

  if (aggrEndpoint.startsWith(':')) {
    // Old format ":8082" -> Use current host + port
    const port = aggrEndpoint.slice(1);
    return `${protocol}//${currentHost}:${port}`;
  } else {
    // New format "IP:PORT" or full URL
    if (!aggrEndpoint.startsWith('http://') && !aggrEndpoint.startsWith('https://')) {
      // Parse IP:PORT format
      const colonIndex = aggrEndpoint.lastIndexOf(':');
      if (colonIndex > 0) {
        const ip = aggrEndpoint.substring(0, colonIndex);
        const port = aggrEndpoint.substring(colonIndex + 1);

        // 🔧 CORS Fix: If the IP is 127.0.0.1 and we're on localhost (or vice versa),
        // use the current host to avoid cross-origin issues.
        if (ip === '127.0.0.1' || ip === 'localhost') {
          return `${protocol}//${currentHost}:${port}`;
        }

        return `${protocol}//${aggrEndpoint}`;
      }
      return `${protocol}//${aggrEndpoint}`;
    }

    // Full URL provided - check if it needs hostname normalization
    try {
      const endpointUrl = new URL(aggrEndpoint);
      if (endpointUrl.hostname === '127.0.0.1' || endpointUrl.hostname === 'localhost') {
        return `${endpointUrl.protocol}//${currentHost}:${endpointUrl.port}${endpointUrl.pathname}`;
      }
    } catch {
      // Invalid URL, return as-is
    }
    return aggrEndpoint;
  }
}

/**
 * Join a guarantor organization
 * 
 * @param groupId - Target organization ID
 * @param groupInfo - Organization info with API endpoints
 * @returns Join result
 */
export async function joinGuarGroup(
  groupId: string,
  groupInfo: GroupInfo
): Promise<QueryResult<FlowApplyResponse>> {
  try {
    // 1. Get current user data
    const user = loadUser();
    if (!user || !user.accountId) {
      return { success: false, error: t('error.userNotLoggedIn') };
    }

    // Get public keys from user data
    const pubXHex = user.pubXHex || user.keys?.pubXHex;
    const pubYHex = user.pubYHex || user.keys?.pubYHex;

    if (!pubXHex || !pubYHex) {
      return { success: false, error: t('error.publicKeyIncomplete') };
    }

    // Get decrypted private key with custom prompt for joining group
    const privHex = await getDecryptedPrivateKeyWithPrompt(
      user.accountId,
      t('encryption.unlockForSigning', '解锁私钥进行签名'),
      t('encryption.unlockForJoinGroup', '加入担保组织需要使用您的账户私钥进行签名验证。请输入密码解锁私钥。')
    );

    if (!privHex) {
      // User cancelled password input - return special error code
      return { success: false, error: 'USER_CANCELLED' };
    }

    // 2. Build AddressMsg from user's sub-addresses only
    // ⚠️ IMPORTANT: user.address is the account address (not a wallet address)
    // Only wallet.addressMsg contains actual usable wallet addresses
    const addressMsg: AddressMsg = {};

    // Add sub-addresses from wallet (these are the actual usable addresses)
    if (user.wallet?.addressMsg) {
      for (const [addr, data] of Object.entries(user.wallet.addressMsg)) {
        if (data.pubXHex && data.pubYHex) {
          addressMsg[addr] = {
            AddressData: {
              PublicKeyNew: convertPublicKeyToBackendFormat(data.pubXHex, data.pubYHex)
            }
          };
        }
      }
    }

    if (Object.keys(addressMsg).length === 0) {
      return {
        success: false,
        error: t('join.noSubAddressDesc', '加入担保组织前需要至少一个钱包子地址。请先在"我的钱包"页面创建子地址。')
      };
    }

    // 3. Build request body (without signature first)
    const timestamp = getTimestamp();
    const requestBody: FlowApplyRequest = {
      Status: 1, // Join
      UserID: user.accountId,
      UserPeerID: '', // Empty for HTTP calls
      GuarGroupID: groupId,
      UserPublicKey: convertPublicKeyToBackendFormat(pubXHex, pubYHex),
      AddressMsg: addressMsg,
      TimeStamp: timestamp
      // Note: UserSig will be added after signing
    };

    // 4. Sign the request (UserSig field will be excluded automatically)
    const signature = signStruct(
      requestBody as unknown as Record<string, unknown>,
      privHex,
      ['UserSig']
    );
    requestBody.UserSig = signature;

    // 5. Determine API endpoint
    let apiUrl: string;
    if (groupInfo.assignAPIEndpoint) {
      const assignNodeUrl = buildAssignNodeUrl(groupInfo.assignAPIEndpoint);
      apiUrl = `${assignNodeUrl}/api/v1/${groupId}/assign/flow-apply`;
    } else {
      apiUrl = `${API_BASE_URL}${API_ENDPOINTS.ASSIGN_FLOW_APPLY(groupId)}`;
    }

    // 6. Send request
    const serializedBody = serializeForBackend(requestBody);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: serializedBody
    });

    const responseData = await response.json() as FlowApplyResponse;

    console.log(`[Group] Response status: ${response.status}, ok: ${response.ok}`);
    console.log(`[Group] Response data:`, JSON.stringify(responseData));

    if (!response.ok) {
      console.error(`[Group] ✗ Join failed (HTTP ${response.status}):`, responseData);
      // 后端错误响应格式: {"error": "..."} 或 {"message": "..."}
      const errorMsg = responseData.error || responseData.message || `${t('error.networkError')}: HTTP ${response.status}`;
      console.error(`[Group] ✗ Error message extracted:`, errorMsg);
      return {
        success: false,
        error: errorMsg
      };
    }

    if (!responseData.result) {
      // 业务逻辑失败，后端返回 {"result": false, "message": "..."}
      const errorMsg = responseData.error || responseData.message || t('error.joinGroupFailed');
      console.error(`[Group] ✗ Business logic failed:`, errorMsg);
      return {
        success: false,
        error: errorMsg
      };
    }

    console.info(`[Group] ✓ Join succeeded`);
    return { success: true, data: responseData };

  } catch (error) {
    console.error(`[Group] ✗ Join error:`, error);
    if (error instanceof ApiRequestError) {
      return {
        success: false,
        error: error.message,
        notFound: error.status === 404
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : t('error.unknownError')
    };
  }
}

/**
 * Leave a guarantor organization
 * 
 * @param groupId - Target organization ID
 * @param groupInfo - Organization info with API endpoints
 * @returns Leave result
 */
export async function leaveGuarGroup(
  groupId: string,
  groupInfo: GroupInfo | null
): Promise<QueryResult<FlowApplyResponse>> {
  try {
    // 1. Get current user data
    const user = loadUser();
    if (!user || !user.accountId) {
      return { success: false, error: t('error.userNotLoggedIn') };
    }

    // Get public keys from user data
    const pubXHex = user.pubXHex || user.keys?.pubXHex;
    const pubYHex = user.pubYHex || user.keys?.pubYHex;

    if (!pubXHex || !pubYHex) {
      return { success: false, error: t('error.publicKeyIncomplete') };
    }

    // Get decrypted private key with custom prompt for leaving group
    const privHex = await getDecryptedPrivateKeyWithPrompt(
      user.accountId,
      t('encryption.unlockForSigning', '解锁私钥进行签名'),
      t('encryption.unlockForLeaveGroup', '退出担保组织需要使用您的账户私钥进行签名验证。请输入密码解锁私钥。')
    );

    if (!privHex) {
      // User cancelled password input - return special error code
      return { success: false, error: 'USER_CANCELLED' };
    }

    // 2. Build request body
    // ⚠️ 重要：退出时 AddressMsg 必须是空对象 {}
    // 原因：如果发送带数据的 AddressMsg，后端反序列化后会填充零值字段
    // 导致后端重新序列化的 JSON 与前端签名的 JSON 不一致，签名验证失败
    const timestamp = getTimestamp();
    const userPublicKey = convertPublicKeyToBackendFormat(pubXHex, pubYHex);

    const requestBody: FlowApplyRequest = {
      Status: 0, // Leave
      UserID: user.accountId,
      UserPeerID: '',
      GuarGroupID: groupId,
      UserPublicKey: userPublicKey,
      AddressMsg: {},  // ⚠️ 退出时必须是空对象！
      TimeStamp: timestamp
    };

    // 3. Sign the request
    const signature = signStruct(
      requestBody as unknown as Record<string, unknown>,
      privHex,
      ['UserSig']
    );
    requestBody.UserSig = signature;

    // 4. Local verification (debug only)
    if (process.env.NODE_ENV === 'development') {
      const derivedPubKey = getPublicKeyHexFromPrivate(privHex);
      const localVerifyResult = verifyStructLocal(
        requestBody as unknown as Record<string, unknown>,
        signature,
        derivedPubKey.x,
        derivedPubKey.y,
        ['UserSig']
      );
      if (!localVerifyResult) {
        console.error('[Group] ❌ Local signature verification FAILED!');
        return { success: false, error: t('error.localSignatureVerificationFailed') };
      }
    }

    // 5. Determine API endpoint
    let apiUrl: string;
    if (groupInfo?.assignAPIEndpoint) {
      const assignNodeUrl = buildAssignNodeUrl(groupInfo.assignAPIEndpoint);
      apiUrl = `${assignNodeUrl}/api/v1/${groupId}/assign/flow-apply`;
    } else {
      apiUrl = `${API_BASE_URL}${API_ENDPOINTS.ASSIGN_FLOW_APPLY(groupId)}`;
    }

    // 6. Send request
    const serializedBody = serializeForBackend(requestBody);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: serializedBody
    });

    const responseData = await response.json() as FlowApplyResponse;

    if (!response.ok) {
      console.error(`[Group] ✗ Leave failed:`, responseData);
      // 后端错误响应格式: {"error": "..."} 或 {"message": "..."}
      const errorMsg = responseData.error || responseData.message || `${t('error.networkError')}: HTTP ${response.status}`;
      return {
        success: false,
        error: errorMsg
      };
    }

    if (!responseData.result) {
      // 业务逻辑失败，后端返回 {"result": false, "message": "..."}
      const errorMsg = responseData.error || responseData.message || t('error.leaveGroupFailed');
      console.warn(`[Group] ✗ Leave rejected:`, errorMsg);
      return {
        success: false,
        error: errorMsg
      };
    }

    console.info(`[Group] ✓ Successfully left organization ${groupId}`);
    return { success: true, data: responseData };

  } catch (error) {
    console.error(`[Group] ✗ Leave error:`, error);
    if (error instanceof ApiRequestError) {
      return {
        success: false,
        error: error.message,
        notFound: error.status === 404
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : t('error.unknownError')
    };
  }
}
