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
 * UTXO data from backend (simplified for query response)
 */
export interface QueryUTXOData {
  Value: number;
  Type: number;
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
 * Note: This creates a minimal UTXOData structure since query response
 * doesn't include full transaction details
 */
function convertToStorageUTXO(utxoKey: string, queryUtxo: QueryUTXOData, address: string): UTXOData {
  // Parse UTXO key (format: "txid:index" or "txid_index")
  const [txid, indexStr] = utxoKey.includes(':') 
    ? utxoKey.split(':') 
    : utxoKey.split('_');
  const index = parseInt(indexStr || '0', 10);
  
  return {
    UTXO: {
      TXID: txid || utxoKey,
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
    TXID: txid || utxoKey,
    Value: queryUtxo.Value,
    Type: queryUtxo.Type,
    Time: Date.now(),
    Position: { Blocknum: 0, IndexX: 0, IndexY: index, IndexZ: 0 },
    IsTXCerUTXO: false
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

    const data = await response.json() as QueryAddressResponse;

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

// Types are already exported at their definition sites above
