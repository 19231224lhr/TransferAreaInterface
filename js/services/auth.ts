/**
 * Authentication Service Module
 * 
 * Provides user authentication functions including re-online (login) operations.
 * Implements the re-online protocol as specified in "用户登录(re-online)前端对接指南.md"
 * 
 * @module services/auth
 */

import { API_BASE_URL } from '../config/api';
import { signStruct, serializeForBackend } from '../utils/signature';
import { secureFetchWithRetry } from '../utils/security';
import { parseBigIntJson } from '../utils/bigIntJson';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * User re-online request message (matches Go's UserReOnlineMsg)
 */
export interface UserReOnlineMsg {
  UserID: string;
  FromPeerID: string;  // HTTP users must use empty string ""
  Address: string[];   // List of user's addresses
  Sig: {
    R: bigint | null;
    S: bigint | null;
  };
}

/**
 * Public key structure (matches Go's PublicKeyNew)
 * X and Y are stored as strings after BigInt-safe JSON parsing
 */
export interface PublicKeyNew {
  CurveName: string;
  X: string;
  Y: string;
}

/**
 * Guarantor group information (matches Go's GuarGroupTable)
 */
export interface GuarGroupTable {
  GroupID: string;
  GuarGroupName: string;
  AssignAPIEndpoint: string;
  AggrAPIEndpoint: string;
  GuarPublicKey: PublicKeyNew;
  AggrPublicKey: PublicKeyNew;
  // ... other fields as needed
}

/**
 * User wallet data (matches Go's UserWalletData)
 */
export interface UserWalletData {
  Value: number;
  TXCers: Record<string, any>;
  UTXOs: Record<string, any>;
  SubAddressMsg: Record<string, any>;
}

/**
 * User re-online response message (matches Go's ReturnUserReOnlineMsg)
 */
export interface ReturnUserReOnlineMsg {
  UserID: string;
  IsInGroup: boolean;
  GuarantorGroupID: string;
  GuarGroupBootMsg: GuarGroupTable | null;
  UserWalletData: UserWalletData;
  /** Gateway notice header (e.g. "no-guarantor-nodes") */
  GatewayNotice?: string;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * User re-online (login) operation
 * 
 * Sends a signed re-online request to BootNode Gateway.
 * BootNode will route the request to the appropriate AssignNode based on UserID.
 * 
 * Process:
 * 1. Construct UserReOnlineMsg with FromPeerID=""
 * 2. Sign the message excluding the Sig field
 * 3. Send POST request to /api/v1/re-online
 * 4. Return response with group membership and wallet data
 * 
 * @param userID - 8-digit user ID
 * @param addresses - List of user's wallet addresses
 * @param privateKeyHex - User's private key for signing
 * @param pubXHex - Public key X coordinate (optional)
 * @param pubYHex - Public key Y coordinate (optional)
 * @returns Re-online response with group and wallet data
 */
export async function userReOnline(
  userID: string,
  addresses: string[],
  privateKeyHex: string,
  pubXHex?: string,
  pubYHex?: string
): Promise<ReturnUserReOnlineMsg> {
  // Construct message with zero signature
  const msg: UserReOnlineMsg = {
    UserID: userID,
    FromPeerID: '',  // HTTP users must use empty string
    Address: addresses,
    Sig: { R: null, S: null }  // Zero signature
  };

  // Sign the message (excluding Sig field)
  // Cast to Record<string, unknown> for compatibility with signStruct
  const signature = signStruct(msg as unknown as Record<string, unknown>, privateKeyHex, ['Sig']);

  // Update message with actual signature
  msg.Sig = {
    R: signature.R,
    S: signature.S
  };

  // Send request to BootNode
  const url = `${API_BASE_URL}/api/v1/re-online`;
  const response = await secureFetchWithRetry(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: serializeForBackend(msg)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Re-online failed: ${response.status} ${errorText}`);
  }

  // ⚠️ 重要：使用 BigInt 安全解析
  // 后端返回的 UserWalletData 中包含 UTXO 数据，其中的 PublicKeyNew X/Y 是 256 位整数
  // JavaScript 原生 JSON.parse 会丢失精度，导致后续 TXOutputHash 计算错误
  const gatewayNotice = response.headers.get('X-Gateway-Notice') || '';
  const text = await response.text();
  const result: ReturnUserReOnlineMsg = parseBigIntJson(text);
  if (gatewayNotice) {
    result.GatewayNotice = gatewayNotice;
  }
  return result;
}

/**
 * Check if user is in a guarantor group
 * 
 * @param userID - 8-digit user ID
 * @param addresses - List of user's wallet addresses
 * @param privateKeyHex - User's private key for signing
 * @param pubXHex - Public key X coordinate (optional)
 * @param pubYHex - Public key Y coordinate (optional)
 * @returns True if user is in a group, false otherwise
 */
export async function isUserInGroup(
  userID: string,
  addresses: string[],
  privateKeyHex: string,
  pubXHex?: string,
  pubYHex?: string
): Promise<boolean> {
  try {
    const result = await userReOnline(userID, addresses, privateKeyHex, pubXHex, pubYHex);
    return result.IsInGroup;
  } catch (error) {
    console.error('Failed to check user group status:', error);
    return false;
  }
}

/**
 * Get user's guarantor group information
 * 
 * @param userID - 8-digit user ID
 * @param addresses - List of user's wallet addresses
 * @param privateKeyHex - User's private key for signing
 * @param pubXHex - Public key X coordinate (optional)
 * @param pubYHex - Public key Y coordinate (optional)
 * @returns Group information if user is in a group, null otherwise
 */
export async function getUserGroup(
  userID: string,
  addresses: string[],
  privateKeyHex: string,
  pubXHex?: string,
  pubYHex?: string
): Promise<GuarGroupTable | null> {
  try {
    const result = await userReOnline(userID, addresses, privateKeyHex, pubXHex, pubYHex);
    return result.IsInGroup ? result.GuarGroupBootMsg : null;
  } catch (error) {
    console.error('Failed to get user group:', error);
    return null;
  }
}
