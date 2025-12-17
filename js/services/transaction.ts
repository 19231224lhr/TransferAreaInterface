/**
 * Transaction Service Module
 * 
 * Provides transaction building and signing functions for UTXO-based transactions.
 */

import { bytesToHex, ecdsaSignData, ECDSASignature } from '../utils/crypto';

// ========================================
// Type Definitions
// ========================================

/** Public key structure */
export interface PublicKey {
  Curve: string;
  XHex: string;
  YHex: string;
}

/** Transaction output structure */
export interface TXOutput {
  ToAddress: string;
  ToValue: number;
  ToGuarGroupID: string;
  ToPublicKey: PublicKey;
  ToInterest?: number;
  ToCoinType?: number;
  IsPayForGas?: boolean;
  IsCrossChain?: boolean;
  IsGuarMake?: boolean;
  Hash?: string;
}

/** ECDSA signature structure */
export interface TXSignature {
  R: string | null;
  S: string | null;
}

/** Interest assignment structure */
export interface InterestAssign {
  Gas: number;
  Output: number;
  BackAssign: Record<string, number>;
}

/** Transaction structure */
export interface Transaction {
  Version: number;
  TXID: string;
  Size: number;
  TXType: number;
  Value: number;
  ValueDivision: Record<number, number>;
  GuarantorGroup: string;
  TXInputsNormal: any[];
  TXInputsCertificate: any[];
  TXOutputs: TXOutput[];
  InterestAssign: InterestAssign;
  UserSignature: TXSignature;
  Data: string | Uint8Array;
}

/** Bill message structure */
export interface BillMsg {
  MoneyType: number;
  Value: number;
  GuarGroupID?: string;
  PublicKey?: { XHex: string; YHex: string };
  Gas?: number;
  ToInterest?: number;
}

/** Build transaction info structure */
export interface BuildTXInfo {
  Value?: number;
  ValueDivision: Record<number, number>;
  Bill: Record<string, BillMsg>;
  UserAddress: string[];
  PriUseTXCer: boolean;
  ChangeAddress: Record<number, string>;
  IsPledgeTX: boolean;
  HowMuchPayForGas: number;
  IsCrossChainTX: boolean;
  Data?: string | Uint8Array;
  InterestAssign: InterestAssign;
}

/** Address data structure */
export interface AddressData {
  type?: number;
  value?: { totalValue?: number; TotalValue?: number; utxoValue?: number; txCerValue?: number };
  utxos?: Record<string, any>;
  txCers?: Record<string, any>;
  privHex?: string;
  pubXHex?: string;
  pubYHex?: string;
}

/** User account structure */
export interface UserAccount {
  accountId?: string;
  address?: string;
  orgNumber?: string;
  guarGroup?: { groupID?: string };
  keys?: { privHex?: string; pubXHex?: string; pubYHex?: string };
  privHex?: string;
  pubXHex?: string;
  pubYHex?: string;
  wallet?: {
    addressMsg?: Record<string, AddressData>;
    totalValue?: number;
    valueDivision?: Record<number, number>;
  };
}

// ========================================
// Serialization Helpers
// ========================================

/**
 * Serialize a struct to bytes for hashing
 * @param obj - Object to serialize
 * @param excludeFields - Fields to exclude
 * @returns Serialized bytes
 */
function serializeStruct(obj: any, excludeFields: string[] = []): Uint8Array {
  // Create a copy and remove excluded fields
  const copy = JSON.parse(JSON.stringify(obj));
  for (const field of excludeFields) {
    delete copy[field];
  }
  
  // Sort keys for consistent serialization
  const sortedObj = sortObjectKeys(copy);
  const jsonStr = JSON.stringify(sortedObj);
  return new TextEncoder().encode(jsonStr);
}

/**
 * Sort object keys recursively for consistent serialization
 * @param obj - Object to sort
 * @returns Object with sorted keys
 */
function sortObjectKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  
  const sorted: Record<string, any> = {};
  const keys = Object.keys(obj).sort();
  for (const key of keys) {
    sorted[key] = sortObjectKeys(obj[key]);
  }
  return sorted;
}

// ========================================
// TXOutput Functions
// ========================================

/**
 * Get serialized data for TXOutput
 * @param output - TXOutput object
 * @returns Serialized bytes
 */
export function getTXOutputSerializedData(output: TXOutput): Uint8Array {
  return serializeStruct(output);
}

/**
 * Calculate TXOutput hash
 * @param output - TXOutput object
 * @returns Hash bytes
 */
export async function getTXOutputHash(output: TXOutput): Promise<Uint8Array> {
  try {
    const data = getTXOutputSerializedData(output);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data as BufferSource);
    return new Uint8Array(hashBuffer);
  } catch (err: any) {
    console.error('TXOutput hash calculation failed:', err);
    throw new Error('Failed to calculate TXOutput hash: ' + err.message);
  }
}

// ========================================
// Transaction Functions
// ========================================

/**
 * Get serialized data for Transaction (for signing)
 * @param tx - Transaction object
 * @returns Serialized bytes
 */
export function getTXSerializedData(tx: Transaction): Uint8Array {
  // Exclude fields: Size, NewValue, UserSignature, TXType
  return serializeStruct(tx, ['Size', 'NewValue', 'UserSignature', 'TXType']);
}

/**
 * Calculate Transaction hash
 * @param tx - Transaction object
 * @returns Hash bytes
 */
export async function getTXHash(tx: Transaction): Promise<Uint8Array> {
  const data = getTXSerializedData(tx);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data as BufferSource);
  return new Uint8Array(hashBuffer);
}

/**
 * Calculate Transaction ID (TXID)
 * @param tx - Transaction object
 * @returns TXID as hex string
 */
export async function getTXID(tx: Transaction): Promise<string> {
  try {
    const hashBytes = await getTXHash(tx);
    return bytesToHex(hashBytes);
  } catch (err: any) {
    console.error('TXID calculation failed:', err);
    throw new Error('Failed to calculate TXID: ' + err.message);
  }
}

/**
 * Calculate Transaction size
 * @param tx - Transaction object
 * @returns Size in bytes
 */
export function getTXSize(tx: Transaction): number {
  try {
    const data = serializeStruct(tx, ['Size']);
    return data.length;
  } catch (err) {
    console.error('Transaction size calculation failed:', err);
    return 0;
  }
}

/**
 * Calculate user signature for Transaction
 * @param tx - Transaction object
 * @param privateKeyHex - Private key in hex
 * @param pubXHex - Public key X coordinate
 * @param pubYHex - Public key Y coordinate
 * @returns Signature with r, s components
 */
export async function getTXUserSignature(
  tx: Transaction, 
  privateKeyHex: string, 
  pubXHex: string | null = null, 
  pubYHex: string | null = null
): Promise<ECDSASignature> {
  try {
    // Save TXID and clear it for hash calculation to match backend logic
    // Backend calculates signature BEFORE setting TXID, so TXID is empty string during signing
    const originalTXID = tx.TXID;
    tx.TXID = "";

    // Get serialized data (WebCrypto will calculate SHA-256)
    const serializedData = getTXSerializedData(tx);

    // Restore TXID
    tx.TXID = originalTXID;

    // Pass raw serialized data, ecdsaSignData will hash with SHA-256 then sign
    const signature = await ecdsaSignData(privateKeyHex, serializedData, pubXHex, pubYHex);
    return signature;
  } catch (err: any) {
    console.error('User signature failed:', err);
    throw new Error('Failed to generate user signature: ' + err.message);
  }
}

// ========================================
// Exchange Rate
// ========================================

/**
 * Get exchange rate for money type
 * @param moneyType - Money type (0=PGC, 1=BTC, 2=ETH)
 * @returns Exchange rate
 */
export function exchangeRate(moneyType: number): number {
  const rates: Record<number, number> = { 0: 1, 1: 1000000, 2: 1000 };
  return rates[moneyType] || 1;
}

// ========================================
// BuildNewTX Core Function
// ========================================

/**
 * Build a new transaction
 * @param buildTXInfo - Transaction build info
 * @param userAccount - User account data
 * @returns Built transaction
 */
export async function buildNewTX(buildTXInfo: BuildTXInfo, userAccount: UserAccount): Promise<Transaction> {
  try {
    const wallet = userAccount.wallet || {};
    const addressMsg = wallet.addressMsg || {};
    const guarGroup = userAccount.guarGroup?.groupID || userAccount.orgNumber || '';

    // Calculate total balance by coin type for selected addresses
    const totalMoney: Record<number, number> = { 0: 0, 1: 0, 2: 0 };
    for (const address of buildTXInfo.UserAddress) {
      const addrData = addressMsg[address];
      if (!addrData) {
        throw new Error(`Address ${address} not found in wallet`);
      }
      const type = Number(addrData.type || 0);
      const balance = Number(addrData.value?.totalValue || addrData.value?.TotalValue || 0);
      totalMoney[type] += balance;
    }

    // Parameter validation
    if (buildTXInfo.IsCrossChainTX || buildTXInfo.IsPledgeTX) {
      if (Object.keys(buildTXInfo.Bill).length !== 1) {
        throw new Error('cross-chain transactions can only transfer to one address');
      }

      for (const bill of Object.values(buildTXInfo.Bill)) {
        if (bill.MoneyType !== 0) {
          throw new Error('cross-chain transactions can only use the main currency');
        }
      }

      for (const address of buildTXInfo.UserAddress) {
        const addrData = addressMsg[address];
        if (Number(addrData?.type || 0) !== 0) {
          throw new Error('cross-chain transactions can only use the main currency');
        }
      }

      if (Object.keys(buildTXInfo.ChangeAddress).length !== 1 || !buildTXInfo.ChangeAddress[0]) {
        throw new Error('cross-chain transactions can only have one change address');
      }
    }

    if (buildTXInfo.IsCrossChainTX) {
      if (!guarGroup) {
        throw new Error('cross-chain transactions must join the guarantor group');
      }
      if (buildTXInfo.UserAddress.length !== 1) {
        throw new Error('cross-chain transactions can only have one input address');
      }
    }

    // Check change addresses
    for (const [typeIdStr, changeAddr] of Object.entries(buildTXInfo.ChangeAddress)) {
      const typeId = Number(typeIdStr);
      const addrData = addressMsg[changeAddr];
      if (!addrData || Number(addrData.type || 0) !== typeId) {
        throw new Error('the change address is incorrect');
      }
    }

    // Check balance
    for (const [typeIdStr, needed] of Object.entries(buildTXInfo.ValueDivision)) {
      const typeId = Number(typeIdStr);
      if (needed > totalMoney[typeId]) {
        throw new Error('insufficient account balance');
      }
    }

    // Check bill amounts
    const usedMoney: Record<number, number> = { 0: 0, 1: 0, 2: 0 };
    for (const bill of Object.values(buildTXInfo.Bill)) {
      usedMoney[bill.MoneyType] += bill.Value;
    }
    if (buildTXInfo.HowMuchPayForGas > 0) {
      usedMoney[0] += buildTXInfo.HowMuchPayForGas;
    }

    for (const [typeIdStr, used] of Object.entries(usedMoney)) {
      const typeId = Number(typeIdStr);
      const needed = buildTXInfo.ValueDivision[typeId] || 0;
      if (Math.abs(used - needed) > 1e-8) {
        throw new Error('the bill is incorrect');
      }
    }

    // Construct Transaction
    const tx: Transaction = {
      Version: 0.1,
      TXID: '',
      Size: 0,
      TXType: 0,
      Value: 0.0,
      ValueDivision: buildTXInfo.ValueDivision,
      GuarantorGroup: guarGroup,
      TXInputsNormal: [],
      TXInputsCertificate: [],
      TXOutputs: [],
      InterestAssign: buildTXInfo.InterestAssign,
      UserSignature: { R: null, S: null },
      Data: buildTXInfo.Data || ''
    };

    const isCrossChain = !!buildTXInfo.IsCrossChainTX;

    const normalizeHex64 = (hex: string | undefined): string => {
      const v = (hex || '').replace(/^0x/i, '').toLowerCase();
      return /^[0-9a-f]{64}$/.test(v) ? v : '';
    };

    const getAddressPublicKey = (address: string): PublicKey => {
      const meta = addressMsg[address] as AddressData | undefined;
      const x = normalizeHex64(meta?.pubXHex) || normalizeHex64(userAccount.keys?.pubXHex) || normalizeHex64((userAccount as any).pubXHex);
      const y = normalizeHex64(meta?.pubYHex) || normalizeHex64(userAccount.keys?.pubYHex) || normalizeHex64((userAccount as any).pubYHex);
      return { Curve: 'P256', XHex: x, YHex: y };
    };

    // Construct Outputs - transfer outputs
    for (const [address, bill] of Object.entries(buildTXInfo.Bill)) {
      const output: TXOutput = {
        ToAddress: address,
        ToValue: bill.Value,
        ToGuarGroupID: bill.GuarGroupID || '',
        ToPublicKey: {
          Curve: 'P256',
          XHex: bill.PublicKey?.XHex || '',
          YHex: bill.PublicKey?.YHex || ''
        },
        ToInterest: Number(bill.ToInterest || 0),
        ToCoinType: bill.MoneyType,
        IsCrossChain: isCrossChain,
        IsGuarMake: false
      };
      
      // Calculate output hash
      const outputHash = await getTXOutputHash(output);
      output.Hash = bytesToHex(outputHash);
      
      tx.TXOutputs.push(output);
    }

    // Explicit gas output (matches backend: IsPayForGas output)
    if (Number(buildTXInfo.HowMuchPayForGas || 0) > 0) {
      const gasOutput: TXOutput = {
        ToAddress: '',
        ToValue: Number(buildTXInfo.HowMuchPayForGas || 0),
        ToGuarGroupID: '',
        ToPublicKey: { Curve: 'P256', XHex: '', YHex: '' },
        ToInterest: 0,
        ToCoinType: 0,
        IsPayForGas: true,
        IsCrossChain: false,
        IsGuarMake: false
      };
      const gasHash = await getTXOutputHash(gasOutput);
      gasOutput.Hash = bytesToHex(gasHash);
      tx.TXOutputs.push(gasOutput);
    }

    // Construct Inputs by selecting UTXOs (TXInputsNormal)
    const epsilon = 1e-8;
    for (const [typeIdStr, targetRaw] of Object.entries(buildTXInfo.ValueDivision || {})) {
      const typeId = Number(typeIdStr);
      const target = Number(targetRaw || 0);
      if (!Number.isFinite(target) || target <= 0) continue;

      let collected = 0;
      let satisfied = false;

      for (const address of buildTXInfo.UserAddress || []) {
        const addrData = addressMsg[address] as AddressData | undefined;
        if (!addrData) continue;
        const addrType = Number(addrData.type || 0);
        if (addrType !== typeId) continue;

        const utxos = (addrData.utxos || {}) as Record<string, any>;
        const utxoKeys = Object.keys(utxos).sort(); // stable selection
        for (const utxoKey of utxoKeys) {
          const utxo = utxos[utxoKey];
          if (!utxo) continue;

          const utxoType = Number(utxo.Type ?? addrType);
          if (utxoType !== typeId) continue;

          const v = Number(utxo.Value || 0);
          if (!Number.isFinite(v) || v <= 0) continue;

          const txid = String(utxo.UTXO?.TXID || utxo.TXID || '').trim() || String(utxoKey).split('_')[0] || '';
          const pos = utxo.Position || { Blocknum: 0, IndexX: 0, IndexY: 0, IndexZ: 0 };
          const indexZFromKey = Number(String(utxoKey).split('_')[1] || 0);
          const indexZ = (pos.IndexZ ?? indexZFromKey) || 0;
          const fromPos = {
            Blocknum: Number(pos.Blocknum || 0),
            IndexX: Number(pos.IndexX || 0),
            IndexY: Number(pos.IndexY || 0),
            IndexZ: Number(indexZ)
          };

          const input = {
            FromTXID: txid,
            FromTxPosition: fromPos,
            FromAddress: address,
            IsGuarMake: false,
            IsCommitteeMake: false,
            IsCrossChain: isCrossChain,
            InputSignature: { R: null, S: null },
            // Frontend wallet snapshot doesn't always include the full referenced output,
            // so TXOutputHash cannot be reproduced exactly here.
            TXOutputHash: utxo.TXOutputHash || ''
          };

          tx.TXInputsNormal.push(input);
          collected += v;

          if (collected + epsilon >= target) {
            satisfied = true;
            break;
          }
        }

        if (satisfied) break;
      }

      if (!satisfied) {
        throw new Error('insufficient account balance');
      }

      // Change output if collected > target
      if (collected > target + epsilon) {
        const changeAddr = (buildTXInfo.ChangeAddress || {})[typeId];
        if (!changeAddr) {
          throw new Error('the change address is incorrect');
        }
        const changeOutput: TXOutput = {
          ToAddress: changeAddr,
          ToValue: collected - target,
          ToGuarGroupID: guarGroup,
          ToPublicKey: getAddressPublicKey(changeAddr),
          ToInterest: 0,
          ToCoinType: typeId,
          IsPayForGas: false,
          IsCrossChain: false,
          IsGuarMake: false
        };
        const changeHash = await getTXOutputHash(changeOutput);
        changeOutput.Hash = bytesToHex(changeHash);
        tx.TXOutputs.push(changeOutput);
      }
    }

    // Calculate total value
    let totalValue = 0;
    for (const [typeIdStr, amount] of Object.entries(buildTXInfo.ValueDivision || {})) {
      const typeId = Number(typeIdStr);
      totalValue += Number(amount || 0) * exchangeRate(typeId);
    }
    tx.Value = totalValue;

    // TXID/Size must be computed after inputs/outputs are finalized
    tx.TXID = await getTXID(tx);
    tx.Size = getTXSize(tx);

    // Get user's private key for signing
    const userAddr = buildTXInfo.UserAddress[0];
    const userAddrData = addressMsg[userAddr];
    
    // Try to get keys from multiple sources:
    // 1. Address-specific data (for sub-wallets)
    // 2. Account keys object (standard storage)
    // 3. Direct account properties (legacy/fallback)
    const privHex = userAddrData?.privHex || userAccount.keys?.privHex || (userAccount as any).privHex || '';
    let pubXHex = userAddrData?.pubXHex || userAccount.keys?.pubXHex || (userAccount as any).pubXHex || '';
    let pubYHex = userAddrData?.pubYHex || userAccount.keys?.pubYHex || (userAccount as any).pubYHex || '';

    if (!privHex) {
      throw new Error('Private key not found for signing');
    }
    
    // Validate private key format
    const normalizedPrivHex = privHex.replace(/^0x/i, '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(normalizedPrivHex)) {
      throw new Error('Private key format invalid: must be 64 hex characters');
    }
    
    // If public key coordinates are missing or invalid, set to empty to trigger derivation
    const validPubX = pubXHex && /^[0-9a-fA-F]{64}$/.test(pubXHex);
    const validPubY = pubYHex && /^[0-9a-fA-F]{64}$/.test(pubYHex);
    
    if (!validPubX || !validPubY) {
      console.warn('Public key coordinates missing or invalid, will be derived from private key during signing');
      pubXHex = '';
      pubYHex = '';
    }

    // Sign transaction
    const signature = await getTXUserSignature(tx, normalizedPrivHex, pubXHex, pubYHex);
    tx.UserSignature = {
      R: signature.r,
      S: signature.s
    };

    return tx;
  } catch (err) {
    console.error('BuildNewTX failed:', err);
    throw err;
  }
}
