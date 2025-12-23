/**
 * Address Service Module
 * 
 * Provides address management functions including creating new sub-addresses
 * and syncing with backend AssignNode.
 * 
 * @module services/address
 */

import { API_ENDPOINTS, API_BASE_URL } from '../config/api';
import { ApiRequestError } from './api';
import { loadUser } from '../utils/storage';
import { getJoinedGroup } from '../utils/storage';
import { getDecryptedPrivateKeyWithPrompt } from '../utils/keyEncryptionUI';
import { t } from '../i18n/index.js';
import { buildAssignNodeUrl, signStruct, type GroupInfo } from './group';
import {
  serializeForBackend,
  convertHexToPublicKey,
  type PublicKeyNew,
  type EcdsaSignature
} from '../utils/signature';

// ============================================================================
// Types
// ============================================================================

/**
 * User new address info request body (Go: UserNewAddressInfo)
 * 
 * Backend structure:
 * ```go
 * type UserNewAddressInfo struct {
 *     NewAddress   string
 *     PublicKeyNew PublicKeyNew
 *     UserID       string
 *     Type         int
 *     Sig          EcdsaSignature
 * }
 * ```
 */
export interface UserNewAddressInfo {
  NewAddress: string;           // New wallet address (must match PublicKeyNew)
  PublicKeyNew: PublicKeyNew;   // Public key for this address (P-256)
  UserID: string;               // 8-digit user ID
  Type: number;                 // Address type (0=PGC, 1=BTC, 2=ETH)
  Sig?: EcdsaSignature;         // User signature (added after signing)
}

/**
 * Response from new-address API
 */
export interface NewAddressResponse {
  success: boolean;
  message: string;
}

/**
 * Result type for address operations
 */
export type AddressResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ============================================================================
// Public API Functions
// ============================================================================

/**
 * Create a new sub-address and sync with backend AssignNode
 * 
 * This function:
 * 1. Validates user is logged in and in a guarantor organization
 * 2. Gets the user's private key for signing
 * 3. Builds the UserNewAddressInfo request
 * 4. Signs the request with user's account private key
 * 5. Sends to AssignNode's new-address endpoint
 * 
 * @param newAddress - The new wallet address (40 hex chars)
 * @param pubXHex - Public key X coordinate (hex)
 * @param pubYHex - Public key Y coordinate (hex)
 * @param addressType - Address type (0=PGC, 1=BTC, 2=ETH)
 * @returns Result with success status
 */
export async function createNewAddressOnBackend(
  newAddress: string,
  pubXHex: string,
  pubYHex: string,
  addressType: number = 0
): Promise<AddressResult<NewAddressResponse>> {
  try {
    // 1. Validate user is logged in
    const user = loadUser();
    if (!user || !user.accountId) {
      return { success: false, error: t('error.userNotLoggedIn') };
    }

    // 2. Check if user is in a guarantor organization
    const group = getJoinedGroup();
    if (!group || !group.groupID) {
      console.warn('[Address] User not in a guarantor organization, skipping backend sync');
      // Return success since local creation is done, backend sync is optional
      return { 
        success: true, 
        data: { 
          success: true, 
          message: 'Address created locally (not in organization)' 
        } 
      };
    }

    // 3. Get decrypted private key for signing
    const privHex = await getDecryptedPrivateKeyWithPrompt(
      user.accountId,
      t('encryption.unlockForSigning', '解锁私钥进行签名'),
      t('encryption.unlockForNewAddress', '创建新地址需要使用您的账户私钥进行签名验证。请输入密码解锁私钥。')
    );

    if (!privHex) {
      return { success: false, error: t('error.privateKeyFetchFailed') };
    }

    // 4. Build request body (without signature first)
    const requestBody: UserNewAddressInfo = {
      NewAddress: newAddress,
      PublicKeyNew: convertHexToPublicKey(pubXHex, pubYHex),
      UserID: user.accountId,
      Type: addressType
      // Note: Sig will be added after signing
    };

    console.debug('[Address] Building new-address request:', {
      NewAddress: newAddress,
      UserID: user.accountId,
      Type: addressType
    });

    // 5. Sign the request (Sig field will be excluded automatically)
    const signature = signStruct(
      requestBody as unknown as Record<string, unknown>,
      privHex,
      ['Sig']
    );
    requestBody.Sig = signature;

    console.debug('[Address] Request signed successfully');

    // 6. Determine API endpoint
    const groupInfo = group as GroupInfo;
    let apiUrl: string;
    
    if (groupInfo.assignAPIEndpoint) {
      const assignNodeUrl = buildAssignNodeUrl(groupInfo.assignAPIEndpoint);
      apiUrl = `${assignNodeUrl}/api/v1/${group.groupID}/assign/new-address`;
    } else {
      apiUrl = `${API_BASE_URL}${API_ENDPOINTS.ASSIGN_NEW_ADDRESS(group.groupID)}`;
    }

    console.debug('[Address] Sending request to:', apiUrl);

    // 7. Send request
    const serializedBody = serializeForBackend(requestBody);
    console.debug('[Address] Request body:', serializedBody);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: serializedBody
    });

    // 8. Handle response
    let responseData: NewAddressResponse;
    try {
      responseData = await response.json();
    } catch {
      responseData = { 
        success: response.ok, 
        message: response.ok ? 'Address created' : `HTTP ${response.status}` 
      };
    }

    if (!response.ok) {
      console.error('[Address] ✗ Create address failed:', responseData);
      return {
        success: false,
        error: responseData.message || `${t('error.networkError')}: HTTP ${response.status}`
      };
    }

    console.info('[Address] ✓ Address created successfully on backend');
    return { success: true, data: responseData };

  } catch (error) {
    console.error('[Address] ✗ Create address error:', error);
    
    if (error instanceof ApiRequestError) {
      return {
        success: false,
        error: error.message
      };
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : t('error.unknownError')
    };
  }
}

/**
 * Check if user is in a guarantor organization
 * Used to determine if backend sync is needed
 * 
 * @returns true if user is in an organization
 */
export function isUserInOrganization(): boolean {
  const group = getJoinedGroup();
  return !!(group && group.groupID);
}
