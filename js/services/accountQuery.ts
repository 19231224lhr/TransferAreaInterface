/**
 * Account Query Service Module
 * 
 * Provides account information query functions for fetching address balances,
 * UTXOs, interests, and organization membership from the ComNode (Leader).
 * 
 * API Endpoint: POST {comNodeURL}/api/v1/com/query-address
 * 
 * @module services/accountQuery
 */

import { ApiRequestError, isNetworkError, isTimeoutError } from './api';
import { t } from '../i18n/index.js';
import { UTXOData } from '../types/blockchain';
import { getComNodeURL, clearComNodeCache } from './comNodeEndpoint';
import { showToast } from '../utils/toast';

// ============================================================================
// Types
// ============================================================================

/**
 * Query address request body
 */
export interface QueryAddressRequest {
  address: string[];
}

/**
 * Transaction position in blockchain
 * Corresponds to Go: TxPosition
 */
export interface QueryTxPosition {
  Blocknum: number;
  IndexX: number;
  IndexY: number;
  IndexZ: number;
}

/**
 * UTXO data from backend
 * Corresponds to Go: UTXOData in core/guaruserinfo.go
 * 
 * Note: Backend returns complete UTXOData structure including Position
 */
export interface QueryUTXOData {
  UTXO?: any;           // Source transaction (SubATX), optional for simplified queries
  Value: number;        // Transfer amount
  Type: number;         // Currency type: 0=PGC, 1=BTC, 2=ETH
  Time?: number;        // Construction timestamp
  Position?: QueryTxPosition;  // Position information (Blocknum, IndexX, IndexY, IndexZ)
  IsTXCerUTXO?: boolean; // Is this a TXCer-related UTXO
}

/**
 * Point address data from backend (Go: PointAddressData)
 */
export interface PointAddressData {
  /** Address total balance */
  Value: number;
  /** Currency type: 0=PGC, 1=BTC, 2=ETH */
  Type: number;
  /** Address total interest (real-time calculated) */
  Interest: number;
  /** Guarantor organization ID (empty string = individual user) */
  GroupID: string;
  /** Address public key */
  PublicKeyNew: {
    CurveName: string;
    X: number | string;
    Y: number | string;
  };
  /** Address UTXOs (UTXO identifier -> UTXO content) */
  UTXO: Record<string, QueryUTXOData>;
  /** Last update block height */
  LastHeight: number;
}

/**
 * Query address response (Go: ReturnNodeAddressMsg)
 */
export interface QueryAddressResponse {
  /** Committee ID that responded */
  FromGroupID: string;
  /** Address -> account data mapping */
  AddressData: Record<string, PointAddressData>;
  /** Committee signature (not used in Gateway scenario) */
  Sig: {
    R: number | string;
    S: number | string;
  };
}

/**
 * Normalized address balance info for frontend use
 */
export interface AddressBalanceInfo {
  address: string;
  balance: number;
  interest: number;
  totalAssets: number;
  type: number;
  groupID: string;
  isInGroup: boolean;
  utxoCount: number;
  utxos: Record<string, QueryUTXOData>;
  publicKey: {
    curveName: string;
    x: string;
    y: string;
  };
  lastHeight: number;
  exists: boolean;
}

/**
 * Query result type
 */
export type QueryResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; isLeaderUnavailable?: boolean };

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize backend address data to frontend format
 */
function normalizeAddressData(address: string, data: PointAddressData): AddressBalanceInfo {
  const exists = data.Value > 0 || data.Interest > 0 || data.LastHeight > 0 || Object.keys(data.UTXO || {}).length > 0;

  return {
    address,
    balance: data.Value || 0,
    interest: data.Interest || 0,
    totalAssets: (data.Value || 0) + (data.Interest || 0),
    type: data.Type || 0,
    groupID: data.GroupID || '',
    isInGroup: !!(data.GroupID && data.GroupID !== '' && data.GroupID !== '1'),
    utxoCount: Object.keys(data.UTXO || {}).length,
    utxos: data.UTXO || {},
    publicKey: {
      curveName: data.PublicKeyNew?.CurveName || 'P256',
      x: String(data.PublicKeyNew?.X || '0'),
      y: String(data.PublicKeyNew?.Y || '0')
    },
    lastHeight: data.LastHeight || 0,
    exists
  };
}

/**
 * Convert QueryUTXOData to full UTXOData format for storage
 * 
 * UTXO key formats:
 * - Backend: "TXID + IndexZ" (with space around +)
 * - Legacy: "txid:index" or "txid_index"
 * 
 * 重要：后端返回的 QueryUTXOData 可能包含完整的 UTXO（SubATX）数据！
 * 1. 如果 queryUtxo.UTXO 存在，使用完整的后端数据（包含 TXOutputs）
 * 2. 必须使用后端返回的 Position，而不是从 key 解析（key 只包含 TXID + IndexZ）
 * 
 * ⚠️ 关键：签名验证要求前端构造的 TXOutput 哈希必须与后端存储的完全一致！
 * 因此必须使用后端原始的 TXOutputs 数据，不能自己重新构造。
 */
function convertToStorageUTXO(utxoKey: string, queryUtxo: QueryUTXOData, address: string): UTXOData {
  // Parse UTXO key - 后端格式是 "TXID + IndexZ"（注意空格）
  // 示例: "f78854637d183c84 + 0"
  // 注意：key 只用于提取 TXID，Position 必须从 queryUtxo.Position 获取！
  let txid: string;
  let indexZFromKey: number = 0;

  if (utxoKey.includes(' + ')) {
    // 后端实际格式: "TXID + IndexZ"
    const parts = utxoKey.split(' + ');
    txid = parts[0].trim();
    indexZFromKey = parseInt(parts[1]?.trim() || '0', 10);
  } else if (utxoKey.includes(':')) {
    // 文档示例格式: "txid:index"
    const parts = utxoKey.split(':');
    txid = parts[0];
    indexZFromKey = parseInt(parts[1] || '0', 10);
  } else if (utxoKey.includes('_')) {
    // 兼容格式: "txid_index"
    const parts = utxoKey.split('_');
    txid = parts[0];
    indexZFromKey = parseInt(parts[1] || '0', 10);
  } else {
    // 无分隔符，整个 key 作为 txid
    txid = utxoKey;
    indexZFromKey = 0;
  }

  // 使用后端返回的 Position，如果没有则用 key 解析的 IndexZ 作为 fallback
  const position: { Blocknum: number; IndexX: number; IndexY: number; IndexZ: number } = queryUtxo.Position
    ? {
      Blocknum: queryUtxo.Position.Blocknum || 0,
      IndexX: queryUtxo.Position.IndexX || 0,
      IndexY: queryUtxo.Position.IndexY || 0,
      IndexZ: queryUtxo.Position.IndexZ ?? indexZFromKey
    }
    : { Blocknum: 0, IndexX: 0, IndexY: 0, IndexZ: indexZFromKey };

  console.log(`[UTXO解析] key="${utxoKey}" => txid="${txid}", Position=${JSON.stringify(position)}`);

  // 如果后端没有返回 Position，打印警告
  if (!queryUtxo.Position) {
    console.warn(`[UTXO解析] 警告：后端未返回 Position 数据，使用 fallback 值`);
  }

  // ⚠️ 重要修复：如果后端返回了完整的 UTXO（SubATX）数据，必须使用它！
  // 这对于签名验证至关重要，因为 TXOutput 哈希必须与后端存储的完全一致
  if (queryUtxo.UTXO && typeof queryUtxo.UTXO === 'object') {
    const backendUTXO = queryUtxo.UTXO;
    console.log(`[UTXO解析] ✓ 使用后端返回的完整 UTXO 数据`);
    console.log(`[UTXO解析] 后端 UTXO.TXID: ${backendUTXO.TXID}`);
    console.log(`[UTXO解析] 后端 UTXO.TXOutputs 长度: ${backendUTXO.TXOutputs?.length || 0}`);

    // 使用后端原始数据，但确保 TXID 正确（从 key 解析的纯 TXID）
    return {
      UTXO: {
        TXID: txid, // 使用从 key 解析的纯 TXID
        TXType: backendUTXO.TXType || 0,
        TXInputsNormal: backendUTXO.TXInputsNormal || [],
        TXInputsCertificate: backendUTXO.TXInputsCertificate || [],
        // ⚠️ 关键：使用后端原始的 TXOutputs，这对签名验证至关重要！
        TXOutputs: backendUTXO.TXOutputs || [],
        InterestAssign: backendUTXO.InterestAssign || { Gas: 0, Output: 0, BackAssign: {} },
        ExTXCerID: backendUTXO.ExTXCerID || [],
        Data: backendUTXO.Data || []
      },
      TXID: txid,
      Value: queryUtxo.Value,
      Type: queryUtxo.Type,
      Time: queryUtxo.Time || Date.now(),
      Position: position,
      IsTXCerUTXO: queryUtxo.IsTXCerUTXO || false
    };
  }

  // Fallback：如果后端没有返回完整 UTXO 数据，构造简化版本
  // 注意：这种情况下签名验证可能会失败！
  console.warn(`[UTXO解析] ⚠️ 警告：后端未返回完整 UTXO 数据，使用 fallback 构造`);
  console.warn(`[UTXO解析] 这可能导致签名验证失败，因为 TXOutput 哈希可能不匹配！`);

  return {
    UTXO: {
      TXID: txid,
      TXType: 0,
      TXInputsNormal: [],
      TXInputsCertificate: [],
      TXOutputs: [{
        ToAddress: address,
        ToValue: queryUtxo.Value,
        ToGuarGroupID: '',
        ToPublicKey: { Curve: 'P256' },
        ToInterest: 0,
        Type: queryUtxo.Type,
        ToCoinType: queryUtxo.Type,
        IsCrossChain: false,
        IsGuarMake: false
      }],
      InterestAssign: { Gas: 0, Output: 0, BackAssign: {} },
      ExTXCerID: [],
      Data: []
    },
    TXID: txid,
    Value: queryUtxo.Value,
    Type: queryUtxo.Type,
    Time: queryUtxo.Time || Date.now(),
    Position: position,
    IsTXCerUTXO: queryUtxo.IsTXCerUTXO || false
  };
}

// ============================================================================
// Public API Functions
// ============================================================================

/**
 * Query account information for multiple addresses
 * 
 * This function:
 * 1. Gets ComNode endpoint (from cache or BootNode)
 * 2. Sends addresses to ComNode (Leader) for query
 * 3. Returns balance, interest, UTXOs, and organization info
 * 
 * Note: This is a pure query API, no signature required.
 * 
 * @param addresses - Array of addresses to query (hex strings)
 * @returns Query result with address data
 */
export async function queryAddressInfo(
  addresses: string[]
): Promise<QueryResult<QueryAddressResponse>> {
  try {
    if (!addresses || addresses.length === 0) {
      return { success: false, error: t('error.noAddressToQuery', '没有要查询的地址') };
    }

    // Get ComNode endpoint (from cache or query BootNode)
    const comNodeURL = await getComNodeURL(false, false);
    if (!comNodeURL) {
      return {
        success: false,
        error: t('comNode.notAvailable', 'ComNode 端点不可用，请稍后重试')
      };
    }

    // Normalize addresses (remove 0x prefix, lowercase)
    const normalizedAddresses = addresses.map(addr =>
      addr.replace(/^0x/i, '').toLowerCase()
    );

    // Build full URL: {comNodeURL}/api/v1/com/query-address
    const endpoint = `${comNodeURL}/api/v1/com/query-address`;

    console.debug('[AccountQuery] Querying addresses:', normalizedAddresses);
    console.debug('[AccountQuery] Endpoint:', endpoint);

    const requestBody: QueryAddressRequest = {
      address: normalizedAddresses
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      // Handle 503 - Leader not available, clear cache
      if (response.status === 503) {
        clearComNodeCache();
        return {
          success: false,
          error: t('error.leaderUnavailable', 'Leader 节点暂时不可用，请稍后重试'),
          isLeaderUnavailable: true
        };
      }

      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || t('error.queryFailed', '查询失败')
      };
    }

    // ⚠️ 重要：使用 parseBigIntJson 而不是 response.json()
    // 因为后端返回的 TXOutput.ToPublicKey.X/Y 是大整数 (*big.Int)
    // JavaScript 的 JSON.parse() 会丢失大整数精度（超过 2^53-1）
    // 这会导致前端计算的 TXOutput 哈希与后端不一致，签名验证失败
    const responseText = await response.text();
    const data = parseBigIntJson(responseText) as QueryAddressResponse;

    console.info('[AccountQuery] ✓ Query successful, received data for',
      Object.keys(data.AddressData || {}).length, 'addresses');

    return { success: true, data };

  } catch (error) {
    console.error('[AccountQuery] ✗ Query failed:', error);

    if (error instanceof ApiRequestError) {
      // Handle specific error cases
      if (error.status === 503) {
        clearComNodeCache();
        return {
          success: false,
          error: t('error.leaderUnavailable', 'Leader 节点暂时不可用，请稍后重试'),
          isLeaderUnavailable: true
        };
      }

      if (isNetworkError(error)) {
        return {
          success: false,
          error: t('error.networkError', '网络连接失败，请检查后端服务是否运行')
        };
      }

      if (isTimeoutError(error)) {
        return {
          success: false,
          error: t('error.requestTimeout', '请求超时，请重试')
        };
      }

      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : t('error.unknownError', '未知错误')
    };
  }
}

/**
 * Query and normalize address balances
 * 
 * Convenience function that queries addresses and returns normalized data
 * ready for frontend display.
 * 
 * @param addresses - Array of addresses to query
 * @returns Array of normalized address balance info
 */
export async function queryAddressBalances(
  addresses: string[]
): Promise<QueryResult<AddressBalanceInfo[]>> {
  const result = await queryAddressInfo(addresses);

  if (!result.success) {
    return result;
  }

  const balances: AddressBalanceInfo[] = [];
  const addressData = result.data.AddressData || {};

  for (const [address, data] of Object.entries(addressData)) {
    balances.push(normalizeAddressData(address, data));
  }

  return { success: true, data: balances };
}

/**
 * Query single address information
 * 
 * @param address - Address to query
 * @returns Address balance info or error
 */
export async function querySingleAddress(
  address: string
): Promise<QueryResult<AddressBalanceInfo>> {
  const result = await queryAddressBalances([address]);

  if (!result.success) {
    return result;
  }

  const normalizedAddr = address.replace(/^0x/i, '').toLowerCase();
  const addressInfo = result.data.find(
    info => info.address.toLowerCase() === normalizedAddr
  );

  if (!addressInfo) {
    // Address not found in response - return empty data
    return {
      success: true,
      data: {
        address: normalizedAddr,
        balance: 0,
        interest: 0,
        totalAssets: 0,
        type: 0,
        groupID: '',
        isInGroup: false,
        utxoCount: 0,
        utxos: {},
        publicKey: { curveName: 'P256', x: '0', y: '0' },
        lastHeight: 0,
        exists: false
      }
    };
  }

  return { success: true, data: addressInfo };
}

/**
 * Calculate total balance from query results
 * 
 * @param balances - Array of address balance info
 * @returns Total balance summary
 */
export function calculateTotalBalance(balances: AddressBalanceInfo[]): {
  totalBalance: number;
  totalInterest: number;
  totalAssets: number;
  byType: Record<number, number>;
} {
  const byType: Record<number, number> = { 0: 0, 1: 0, 2: 0 };
  let totalBalance = 0;
  let totalInterest = 0;

  for (const balance of balances) {
    totalBalance += balance.balance;
    totalInterest += balance.interest;

    const type = balance.type || 0;
    if (byType[type] !== undefined) {
      byType[type] += balance.balance;
    }
  }

  return {
    totalBalance,
    totalInterest,
    totalAssets: totalBalance + totalInterest,
    byType
  };
}

/**
 * Convert query response UTXOs to storage format
 * 
 * @param addressInfo - Address balance info from query
 * @returns UTXOs in storage format
 */
export function convertUtxosForStorage(
  addressInfo: AddressBalanceInfo
): Record<string, UTXOData> {
  const result: Record<string, UTXOData> = {};

  for (const [key, utxo] of Object.entries(addressInfo.utxos)) {
    result[key] = convertToStorageUTXO(key, utxo, addressInfo.address);
  }

  return result;
}

// ============================================================================
// Query Address Group API
// ============================================================================

/**
 * P-256 Public Key structure
 */
export interface PublicKeyNew {
  CurveName: string;  // Fixed to "P256"
  X: number | string; // big.Int as number in JSON
  Y: number | string;
}

/**
 * Single address group info from backend
 */
export interface AddressGroupInfo {
  GroupID: string;        // "0" = not exist, "1" = retail, other = group ID
  PublicKey: PublicKeyNew;
  Type: number;           // 币种类型：0=PGC, 1=BTC, 2=ETH
}

/**
 * Query address group response (Go: UserQueryAddressGuarGroupReply)
 */
export interface QueryAddressGroupResponse {
  UserID: string;  // Empty for Gateway calls
  Addresstogroup: Record<string, AddressGroupInfo>;
}

/**
 * Normalized address group info for frontend use
 */
export interface NormalizedAddressGroupInfo {
  address: string;
  groupID: string;
  exists: boolean;
  isRetail: boolean;
  isInGroup: boolean;
  publicKey: {
    curveName: string;
    x: string;
    y: string;
  } | null;
  type: number;  // 币种类型：0=PGC, 1=BTC, 2=ETH
}

/**
 * GroupID special values
 */
export const GROUP_ID_NOT_EXIST = '0';
export const GROUP_ID_RETAIL = '1';

/**
 * Check if address exists based on GroupID
 */
export function addressExists(groupID: string): boolean {
  return groupID !== GROUP_ID_NOT_EXIST;
}

/**
 * Check if address is retail (not in any group)
 */
export function isRetailAddress(groupID: string): boolean {
  return groupID === GROUP_ID_RETAIL;
}

/**
 * Check if address is in a guarantor group
 */
export function isInGuarGroup(groupID: string): boolean {
  return groupID !== GROUP_ID_NOT_EXIST && groupID !== GROUP_ID_RETAIL;
}

/**
 * Convert big.Int (decimal string or number) to 64-char hex string
 * Backend returns public key X/Y as big.Int which is a decimal number in JSON
 * 
 * @param value - Decimal string or number from backend
 * @returns 64-character hex string (padded with leading zeros)
 */
function bigIntToHex64(value: number | string): string {
  if (!value || value === '0' || value === 0) {
    return '0'.repeat(64);
  }

  try {
    // Value should be a string (preserved by parseBigIntJson)
    // If it's a number, it may have lost precision
    const strValue = String(value);

    // Check if it looks like a valid decimal number
    if (!/^\d+$/.test(strValue)) {
      console.error('[AccountQuery] Invalid decimal value:', strValue);
      return '0'.repeat(64);
    }

    // Convert decimal string to BigInt, then to hex
    const bigIntValue = BigInt(strValue);
    let hex = bigIntValue.toString(16);
    // Pad to 64 characters (256 bits = 32 bytes = 64 hex chars)
    hex = hex.padStart(64, '0');
    return hex.toLowerCase();
  } catch (e) {
    console.error('[AccountQuery] Failed to convert big.Int to hex:', value, e);
    return '0'.repeat(64);
  }
}

/**
 * Parse JSON with big integers preserved as strings
 * 
 * JavaScript's JSON.parse() loses precision for integers larger than
 * Number.MAX_SAFE_INTEGER (2^53 - 1). This function converts large
 * integers to strings before parsing.
 * 
 * @param jsonText - Raw JSON text
 * @returns Parsed object with large integers as strings
 */
function parseBigIntJson(jsonText: string): unknown {
  // Replace large integers (more than 15 digits) with quoted strings
  // This regex matches: "X": 12345678901234567890 (unquoted large numbers)
  // and converts to: "X": "12345678901234567890"
  const processed = jsonText.replace(
    /:\s*(\d{16,})\s*([,}\]])/g,
    ': "$1"$2'
  );
  return JSON.parse(processed);
}

/**
 * Normalize address group data for frontend use
 */
function normalizeAddressGroupData(address: string, data: AddressGroupInfo): NormalizedAddressGroupInfo {
  const exists = addressExists(data.GroupID);
  const isRetail = isRetailAddress(data.GroupID);
  const isInGroup = isInGuarGroup(data.GroupID);

  // Convert public key X/Y from decimal to hex format
  let publicKey: NormalizedAddressGroupInfo['publicKey'] = null;
  if (exists && data.PublicKey && data.PublicKey.X && data.PublicKey.Y) {
    publicKey = {
      curveName: data.PublicKey.CurveName || 'P256',
      x: bigIntToHex64(data.PublicKey.X),
      y: bigIntToHex64(data.PublicKey.Y)
    };
  }

  return {
    address,
    groupID: data.GroupID,
    exists,
    isRetail,
    isInGroup,
    publicKey,
    type: data.Type ?? 0  // 默认为 PGC (0)
  };
}

/**
 * Query address group information
 * 
 * This function queries the ComNode to get the guarantor organization
 * that each address belongs to.
 * 
 * API Endpoint: POST {comNodeURL}/api/v1/com/query-address-group
 * 
 * @param addresses - Array of addresses to query (hex strings)
 * @returns Query result with address group data
 */
export async function queryAddressGroup(
  addresses: string[]
): Promise<QueryResult<QueryAddressGroupResponse>> {
  try {
    if (!addresses || addresses.length === 0) {
      return { success: false, error: t('error.noAddressToQuery', '没有要查询的地址') };
    }

    // Get ComNode endpoint (from cache or query BootNode)
    const comNodeURL = await getComNodeURL(false, false);
    if (!comNodeURL) {
      return {
        success: false,
        error: t('comNode.notAvailable', 'ComNode 端点不可用，请稍后重试')
      };
    }

    // Normalize addresses (remove 0x prefix, lowercase)
    const normalizedAddresses = addresses.map(addr =>
      addr.replace(/^0x/i, '').toLowerCase()
    );

    // Build full URL: {comNodeURL}/api/v1/com/query-address-group
    const endpoint = `${comNodeURL}/api/v1/com/query-address-group`;

    console.debug('[AccountQuery] Querying address groups:', normalizedAddresses);
    console.debug('[AccountQuery] Endpoint:', endpoint);

    const requestBody: QueryAddressRequest = {
      address: normalizedAddresses
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      // Handle 503 - Leader not available, clear cache
      if (response.status === 503) {
        clearComNodeCache();
        return {
          success: false,
          error: t('error.leaderUnavailable', 'Leader 节点暂时不可用，请稍后重试'),
          isLeaderUnavailable: true
        };
      }

      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || t('error.queryFailed', '查询失败')
      };
    }

    // Use custom JSON parser to preserve big integers as strings
    const responseText = await response.text();
    const data = parseBigIntJson(responseText) as QueryAddressGroupResponse;

    console.info('[AccountQuery] ✓ Query address group successful, received data for',
      Object.keys(data.Addresstogroup || {}).length, 'addresses');

    return { success: true, data };

  } catch (error) {
    console.error('[AccountQuery] ✗ Query address group failed:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);
    showToast(t('error.queryFailed', '查询失败') + ': ' + errorMessage, 'error');

    if (error instanceof ApiRequestError) {
      if (error.status === 503) {
        clearComNodeCache();
        return {
          success: false,
          error: t('error.leaderUnavailable', 'Leader 节点暂时不可用，请稍后重试'),
          isLeaderUnavailable: true
        };
      }

      if (isNetworkError(error)) {
        return {
          success: false,
          error: t('error.networkError', '网络连接失败，请检查后端服务是否运行')
        };
      }

      if (isTimeoutError(error)) {
        return {
          success: false,
          error: t('error.requestTimeout', '请求超时，请重试')
        };
      }

      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : t('error.unknownError', '未知错误')
    };
  }
}

/**
 * Query and normalize address group information
 * 
 * Convenience function that queries addresses and returns normalized data
 * ready for frontend display.
 * 
 * @param addresses - Array of addresses to query
 * @returns Array of normalized address group info
 */
export async function queryAddressGroupInfo(
  addresses: string[]
): Promise<QueryResult<NormalizedAddressGroupInfo[]>> {
  const result = await queryAddressGroup(addresses);

  if (!result.success) {
    return result;
  }

  const groupInfos: NormalizedAddressGroupInfo[] = [];
  const addressData = result.data.Addresstogroup || {};

  for (const [address, data] of Object.entries(addressData)) {
    groupInfos.push(normalizeAddressGroupData(address, data));
  }

  return { success: true, data: groupInfos };
}

/**
 * Query single address group information
 * 
 * @param address - Address to query
 * @returns Address group info or error
 */
export async function querySingleAddressGroup(
  address: string
): Promise<QueryResult<NormalizedAddressGroupInfo>> {
  const result = await queryAddressGroupInfo([address]);

  if (!result.success) {
    return result;
  }

  const normalizedAddr = address.replace(/^0x/i, '').toLowerCase();
  const addressInfo = result.data.find(
    info => info.address.toLowerCase() === normalizedAddr
  );

  if (!addressInfo) {
    // Address not found in response - return not exist data
    return {
      success: true,
      data: {
        address: normalizedAddr,
        groupID: GROUP_ID_NOT_EXIST,
        exists: false,
        isRetail: false,
        isInGroup: false,
        publicKey: null
      }
    };
  }

  return { success: true, data: addressInfo };
}

// Types are already exported at their definition sites above
