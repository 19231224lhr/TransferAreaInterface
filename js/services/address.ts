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
import { loadUser, getJoinedGroup, saveUser } from '../utils/storage';
import { getDecryptedPrivateKeyWithPrompt } from '../utils/keyEncryptionUI';
import { t } from '../i18n/index.js';
import { buildAssignNodeUrl, signStruct, type GroupInfo, getTimestamp } from './group';
import { getComNodeURL } from './comNodeEndpoint';
import { showErrorToast, showInfoToast } from '../utils/toast.js';
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
 * Retail address registration request (Go: UserRegisterAddressMsg)
 */
export interface RegisterAddressRequest {
  Address: string;
  PublicKeyNew: PublicKeyNew;
  GroupID: string;
  TimeStamp: number;
  Sig?: EcdsaSignature;
}

/**
 * Response from register-address API
 */
export interface RegisterAddressResponse {
  success: boolean;
  message?: string;
  error?: string;
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

async function sendNewAddressRequestWithPriv(
  newAddress: string,
  pubXHex: string,
  pubYHex: string,
  addressType: number,
  accountPrivHex: string
): Promise<AddressResult<NewAddressResponse>> {
  try {
    const user = loadUser();
    if (!user || !user.accountId) {
      return { success: false, error: t('error.userNotLoggedIn') };
    }

    const group = getJoinedGroup();
    if (!group || !group.groupID) {
      console.warn('[Address] User not in a guarantor organization, skipping backend sync');
      return {
        success: true,
        data: {
          success: true,
          message: 'Address created locally (not in organization)'
        }
      };
    }

    if (!accountPrivHex) {
      return { success: false, error: t('error.invalidPrivateKey', 'Invalid private key') };
    }

    const requestBody: UserNewAddressInfo = {
      NewAddress: newAddress,
      PublicKeyNew: convertHexToPublicKey(pubXHex, pubYHex),
      UserID: user.accountId,
      Type: addressType
    };

    console.debug('[Address] Building new-address request:', {
      NewAddress: newAddress,
      UserID: user.accountId,
      Type: addressType
    });

    const signature = signStruct(
      requestBody as unknown as Record<string, unknown>,
      accountPrivHex,
      ['Sig']
    );
    requestBody.Sig = signature;

    console.debug('[Address] Request signed successfully');

    const groupInfo = group as GroupInfo;
    let apiUrl: string;

    console.debug('[Address] Group info:', {
      groupID: groupInfo.groupID,
      assignAPIEndpoint: groupInfo.assignAPIEndpoint,
      aggrAPIEndpoint: groupInfo.aggrAPIEndpoint
    });

    if (groupInfo.assignAPIEndpoint) {
      const assignNodeUrl = buildAssignNodeUrl(groupInfo.assignAPIEndpoint);
      apiUrl = `${assignNodeUrl}/api/v1/${group.groupID}/assign/new-address`;
      console.debug('[Address] Using AssignNode URL:', assignNodeUrl);
    } else {
      apiUrl = `${API_BASE_URL}${API_ENDPOINTS.ASSIGN_NEW_ADDRESS(group.groupID)}`;
      console.debug('[Address] Using fallback API_BASE_URL:', API_BASE_URL);
    }

    console.debug('[Address] Sending request to:', apiUrl);

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
      console.error('[Address] Create address failed:', responseData);
      return {
        success: false,
        error: responseData.message || `${t('error.networkError')}: HTTP ${response.status}`
      };
    }

    console.info('[Address] Address created successfully on backend');
    return { success: true, data: responseData };

  } catch (error) {
    console.error('[Address] Create address error:', error);

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
    const user = loadUser();
    if (!user || !user.accountId) {
      return { success: false, error: t('error.userNotLoggedIn') };
    }

    const group = getJoinedGroup();
    if (!group || !group.groupID) {
      console.warn('[Address] User not in a guarantor organization, skipping backend sync');
      return {
        success: true,
        data: {
          success: true,
          message: 'Address created locally (not in organization)'
        }
      };
    }

    const privHex = await getDecryptedPrivateKeyWithPrompt(
      user.accountId,
      t('encryption.unlockForSigning', 'Unlock private key for signing'),
      t('encryption.unlockForNewAddress', 'Creating a new address requires signing with your account private key. Please enter password to unlock it.')
    );

    if (!privHex) {
      return { success: false, error: 'USER_CANCELLED' };
    }

    return await sendNewAddressRequestWithPriv(newAddress, pubXHex, pubYHex, addressType, privHex);
  } catch (error) {
    console.error('[Address] Create address error:', error);

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
 * Create a new sub-address with a provided account private key (no prompt)
 */
export async function createNewAddressOnBackendWithPriv(
  newAddress: string,
  pubXHex: string,
  pubYHex: string,
  addressType: number,
  accountPrivHex: string
): Promise<AddressResult<NewAddressResponse>> {
  if (!accountPrivHex) {
    return { success: false, error: t('error.invalidPrivateKey', 'Invalid private key') };
  }
  return await sendNewAddressRequestWithPriv(newAddress, pubXHex, pubYHex, addressType, accountPrivHex);
}

/**
 * Register a retail address on ComNode for address-group lookups
 */
export async function registerAddressOnComNode(
  address: string,
  pubXHex: string,
  pubYHex: string,
  privHex: string,
  groupID: string = ''
): Promise<AddressResult<RegisterAddressResponse>> {
  try {
    if (!address) {
      return { success: false, error: t('error.invalidAddress', 'Invalid address') };
    }

    if (groupID) {
      return {
        success: false,
        error: t('error.invalidRequest', 'Group registration must be handled by AssignNode')
      };
    }

    if (!privHex) {
      return { success: false, error: t('error.invalidPrivateKey', 'Invalid private key') };
    }

    const comNodeURL = await getComNodeURL(false, false);
    if (!comNodeURL) {
      return { success: false, error: t('comNode.notRegistered', 'ComNode not available') };
    }

    const requestBody: RegisterAddressRequest = {
      Address: address.toLowerCase(),
      PublicKeyNew: convertHexToPublicKey(pubXHex, pubYHex),
      GroupID: groupID,
      TimeStamp: getTimestamp()
    };

    const signature = signStruct(
      requestBody as unknown as Record<string, unknown>,
      privHex,
      ['Sig']
    );
    requestBody.Sig = signature;

    const apiUrl = `${comNodeURL}${API_ENDPOINTS.COM_REGISTER_ADDRESS}`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: serializeForBackend(requestBody)
    });

    let responseData: RegisterAddressResponse = { success: response.ok };
    try {
      const data = await response.json();
      responseData = {
        ...data,
        success: typeof data?.success === 'boolean' ? data.success : response.ok
      };
    } catch {
      responseData = {
        success: response.ok,
        message: response.ok ? 'Address registered' : `HTTP ${response.status}`
      };
    }

    if (!response.ok) {
      return {
        success: false,
        error: responseData.message || responseData.error || `${t('error.networkError')}: HTTP ${response.status}`
      };
    }

    return { success: true, data: responseData };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : t('error.unknownError')
    };
  }
}

/**
 * Register local addresses when entering main page for the first time
 */
export async function registerAddressesOnMainEntry(): Promise<void> {
  const user = loadUser();
  if (!user || !user.accountId) {
    return;
  }

  if (user.mainAddressRegistered) {
    return;
  }

  const addressMap = user.wallet?.addressMsg || {};
  const addresses = Object.keys(addressMap);
  const errors: string[] = [];

  try {
    if (addresses.length === 0) {
      return;
    }

    if (isUserInOrganization()) {
      const accountPriv = await getDecryptedPrivateKeyWithPrompt(
        user.accountId,
        t('encryption.unlockForSigning', 'Unlock private key for signing'),
        t('encryption.unlockForNewAddress', 'Creating a new address requires signing with your account private key. Please enter password to unlock it.')
      );

      if (!accountPriv) {
        showInfoToast(t('common.operationCancelled', 'Operation cancelled'));
        return;
      }

      for (const addr of addresses) {
        const meta = addressMap[addr];
        const pubXHex = meta?.pubXHex || '';
        const pubYHex = meta?.pubYHex || '';
        const addressType = Number(meta?.type ?? 0);
        if (!pubXHex || !pubYHex) {
          continue;
        }

        const result = await createNewAddressOnBackendWithPriv(
          addr,
          pubXHex,
          pubYHex,
          addressType,
          accountPriv
        );

        if (!result.success) {
          errors.push(result.error);
        }
      }
    } else {
      for (const addr of addresses) {
        const meta = addressMap[addr];
        const pubXHex = meta?.pubXHex || '';
        const pubYHex = meta?.pubYHex || '';
        const privHex = meta?.privHex || '';
        if (!pubXHex || !pubYHex || !privHex) {
          continue;
        }

        const result = await registerAddressOnComNode(
          addr,
          pubXHex,
          pubYHex,
          privHex
        );

        if (!result.success) {
          errors.push(result.error);
        }
      }
    }
  } finally {
    saveUser({ accountId: user.accountId, mainAddressRegistered: true });
  }

  if (errors.length > 0) {
    showErrorToast(errors[0], t('toast.addressRegisterFailed', 'Address registration failed'));
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
// ============================================================================
// Unbind Address Types
// ============================================================================

/**
 * User address binding/unbinding message (Go: UserAddressBindingMsg)
 * 
 * Backend structure:
 * ```go
 * type UserAddressBindingMsg struct {
 *     Op        int            // Operation type (0=unbind, 1=rebind)
 *     UserID    string         // User ID
 *     Address   string         // Address to unbind
 *     PublicKey PublicKeyNew   // Address public key
 *     Type      int            // Address type
 *     TimeStamp uint64         // Request timestamp
 *     Sig       EcdsaSignature // User signature
 * }
 * ```
 */
export interface UserAddressBindingMsg {
  Op: number;                   // Operation type (0=unbind)
  UserID: string;               // 8-digit user ID
  Address: string;              // Address to unbind
  PublicKey: PublicKeyNew;      // Address public key (P-256)
  Type: number;                 // Address type (0=PGC, 1=BTC, 2=ETH)
  TimeStamp: number;            // Request timestamp (Unix seconds)
  Sig?: EcdsaSignature;         // User signature (added after signing)
}

/**
 * Response from unbind-address API
 */
export interface UnbindAddressResponse {
  success: boolean;
  message: string;
}

// ============================================================================
// Unbind Address API
// ============================================================================

/**
 * Unbind (soft delete) an address from backend AssignNode
 * 
 * This function:
 * 1. Validates user is logged in and in a guarantor organization
 * 2. Gets the user's private key for signing
 * 3. Builds the UserAddressBindingMsg request
 * 4. Signs the request with user's account private key
 * 5. Sends to AssignNode's unbind-address endpoint
 * 
 * ⚠️ Important: This uses the ACCOUNT private key for signing, not the address private key!
 * 
 * @param address - The address to unbind (40 hex chars)
 * @param pubXHex - Address public key X coordinate (hex)
 * @param pubYHex - Address public key Y coordinate (hex)
 * @param addressType - Address type (0=PGC, 1=BTC, 2=ETH)
 * @returns Result with success status
 */
export async function unbindAddressOnBackend(
  address: string,
  pubXHex: string,
  pubYHex: string,
  addressType: number = 0
): Promise<AddressResult<UnbindAddressResponse>> {
  try {
    // 1. Validate user is logged in
    const user = loadUser();
    if (!user || !user.accountId) {
      return { success: false, error: t('error.userNotLoggedIn') };
    }

    // 2. Check if user is in a guarantor organization
    const group = getJoinedGroup();
    if (!group || !group.groupID) {
      console.warn('[Address] User not in a guarantor organization, skipping backend unbind');
      // Return success since local deletion can proceed
      return { 
        success: true, 
        data: { 
          success: true, 
          message: 'Address unbound locally (not in organization)' 
        } 
      };
    }

    // 3. Get decrypted ACCOUNT private key for signing
    // ⚠️ Important: Use account private key, NOT address private key!
    const privHex = await getDecryptedPrivateKeyWithPrompt(
      user.accountId,
      t('encryption.unlockForSigning', '解锁私钥进行签名'),
      t(
        'encryption.unlockForUnbindAddress',
        'Unbinding an address requires your account private key. Enter password to unlock.'
      )
    );

    if (!privHex) {
      // User cancelled password input - return special error code
      return { success: false, error: 'USER_CANCELLED' };
    }

    // 4. Build request body (without signature first)
    const timestamp = Math.floor(Date.now() / 1000);
    const requestBody: UserAddressBindingMsg = {
      Op: 0, // 0 = unbind
      UserID: user.accountId,
      Address: address,
      PublicKey: convertHexToPublicKey(pubXHex, pubYHex),
      Type: addressType,
      TimeStamp: timestamp
      // Note: Sig will be added after signing
    };

    console.debug('[Address] Building unbind-address request:', {
      Address: address,
      UserID: user.accountId,
      Type: addressType,
      TimeStamp: timestamp
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
      apiUrl = `${assignNodeUrl}/api/v1/${group.groupID}/assign/unbind-address`;
    } else {
      apiUrl = `${API_BASE_URL}${API_ENDPOINTS.ASSIGN_UNBIND_ADDRESS(group.groupID)}`;
    }

    console.debug('[Address] Sending unbind request to:', apiUrl);

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
    let responseData: UnbindAddressResponse;
    try {
      responseData = await response.json();
    } catch {
      responseData = { 
        success: response.ok, 
        message: response.ok ? 'Address unbound' : `HTTP ${response.status}` 
      };
    }

    if (!response.ok) {
      console.error('[Address] �?Unbind address failed:', responseData);
      
      // Parse specific error messages
      const errorMsg = responseData.message || (responseData as any).error || '';
      
      // If user is not in the organization, treat as success for local deletion
      // This can happen when:
      // 1. User imported an address that belongs to an org but never successfully joined
      // 2. User's join request failed but frontend saved org info anyway
      if (errorMsg.includes('user is not in the guarantor') || 
          errorMsg.includes('user not found in group')) {
        console.warn('[Address] User not in organization on backend, allowing local deletion');
        return { 
          success: true, 
          data: { 
            success: true, 
            message: 'Address unbound locally (user not in organization on backend)' 
          } 
        };
      }
      if (errorMsg.includes('address not found')) {
        // Address not found on backend - allow local deletion
        console.warn('[Address] Address not found on backend, allowing local deletion');
        return { 
          success: true, 
          data: { 
            success: true, 
            message: 'Address unbound locally (not found on backend)' 
          } 
        };
      }
      if (errorMsg.includes('already revoked')) {
        // Address already revoked - allow local deletion
        console.warn('[Address] Address already revoked on backend, allowing local deletion');
        return { 
          success: true, 
          data: { 
            success: true, 
            message: 'Address unbound locally (already revoked on backend)' 
          } 
        };
      }
      if (errorMsg.includes('signature verification')) {
        return { success: false, error: t('error.signatureVerificationFailed', '签名验证失败') };
      }
      
      return {
        success: false,
        error: errorMsg || `${t('error.networkError')}: HTTP ${response.status}`
      };
    }

    console.info('[Address] �?Address unbound successfully on backend');
    return { success: true, data: responseData };

  } catch (error) {
    console.error('[Address] �?Unbind address error:', error);
    
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





