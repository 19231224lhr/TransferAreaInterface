/**
 * Transaction Service Module
 * 
 * Provides transaction building and signing functions for UTXO-based transactions.
 */

import { bytesToHex, ecdsaSignData } from '../utils/crypto.js';

// ========================================
// Serialization Helpers
// ========================================

/**
 * Serialize a struct to bytes for hashing
 * @param {object} obj - Object to serialize
 * @param {string[]} excludeFields - Fields to exclude
 * @returns {Uint8Array} Serialized bytes
 */
function serializeStruct(obj, excludeFields = []) {
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
 * @param {any} obj - Object to sort
 * @returns {any} Object with sorted keys
 */
function sortObjectKeys(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  
  const sorted = {};
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
 * @param {object} output - TXOutput object
 * @returns {Uint8Array} Serialized bytes
 */
export function getTXOutputSerializedData(output) {
  return serializeStruct(output);
}

/**
 * Calculate TXOutput hash
 * @param {object} output - TXOutput object
 * @returns {Promise<Uint8Array>} Hash bytes
 */
export async function getTXOutputHash(output) {
  try {
    const data = getTXOutputSerializedData(output);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(hashBuffer);
  } catch (err) {
    console.error('TXOutput hash calculation failed:', err);
    throw new Error('Failed to calculate TXOutput hash: ' + err.message);
  }
}

// ========================================
// Transaction Functions
// ========================================

/**
 * Get serialized data for Transaction (for signing)
 * @param {object} tx - Transaction object
 * @returns {Uint8Array} Serialized bytes
 */
export function getTXSerializedData(tx) {
  // Exclude fields: Size, NewValue, UserSignature, TXType
  return serializeStruct(tx, ['Size', 'NewValue', 'UserSignature', 'TXType']);
}

/**
 * Calculate Transaction hash
 * @param {object} tx - Transaction object
 * @returns {Promise<Uint8Array>} Hash bytes
 */
export async function getTXHash(tx) {
  const data = getTXSerializedData(tx);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hashBuffer);
}

/**
 * Calculate Transaction ID (TXID)
 * @param {object} tx - Transaction object
 * @returns {Promise<string>} TXID as hex string
 */
export async function getTXID(tx) {
  try {
    const hashBytes = await getTXHash(tx);
    return bytesToHex(hashBytes);
  } catch (err) {
    console.error('TXID calculation failed:', err);
    throw new Error('Failed to calculate TXID: ' + err.message);
  }
}

/**
 * Calculate Transaction size
 * @param {object} tx - Transaction object
 * @returns {number} Size in bytes
 */
export function getTXSize(tx) {
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
 * @param {object} tx - Transaction object
 * @param {string} privateKeyHex - Private key in hex
 * @param {string|null} pubXHex - Public key X coordinate
 * @param {string|null} pubYHex - Public key Y coordinate
 * @returns {Promise<object>} Signature with r, s components
 */
export async function getTXUserSignature(tx, privateKeyHex, pubXHex = null, pubYHex = null) {
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
  } catch (err) {
    console.error('User signature failed:', err);
    throw new Error('Failed to generate user signature: ' + err.message);
  }
}

// ========================================
// Exchange Rate
// ========================================

/**
 * Get exchange rate for money type
 * @param {number} moneyType - Money type (0=PGC, 1=BTC, 2=ETH)
 * @returns {number} Exchange rate
 */
export function exchangeRate(moneyType) {
  const rates = { 0: 1, 1: 1000000, 2: 1000 };
  return rates[moneyType] || 1;
}

// ========================================
// BuildNewTX Core Function
// ========================================

/**
 * Build a new transaction
 * @param {object} buildTXInfo - Transaction build info
 * @param {object} userAccount - User account data
 * @returns {Promise<object>} Built transaction
 */
export async function buildNewTX(buildTXInfo, userAccount) {
  try {
    const wallet = userAccount.wallet || {};
    const addressMsg = wallet.addressMsg || {};
    const guarGroup = userAccount.guarGroup || userAccount.orgNumber || '';

    // Calculate total balance by coin type for selected addresses
    const totalMoney = { 0: 0, 1: 0, 2: 0 };
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
        if (Number(addrData.type || 0) !== 0) {
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
    const usedMoney = { 0: 0, 1: 0, 2: 0 };
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
    const tx = {
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

    // Construct Outputs - transfer outputs
    for (const [address, bill] of Object.entries(buildTXInfo.Bill)) {
      const output = {
        ToAddress: address,
        ToValue: bill.Value,
        ToGuarGroupID: bill.GuarGroupID || '',
        ToPublicKey: {
          Curve: 'P256',
          XHex: bill.PublicKey?.XHex || '',
          YHex: bill.PublicKey?.YHex || ''
        },
        ToInterest: bill.Gas || 0,
        ToCoinType: bill.MoneyType
      };
      
      // Calculate output hash
      const outputHash = await getTXOutputHash(output);
      output.Hash = bytesToHex(outputHash);
      
      tx.TXOutputs.push(output);
    }

    // Calculate total value
    let totalValue = 0;
    for (const [typeIdStr, amount] of Object.entries(buildTXInfo.ValueDivision)) {
      const typeId = Number(typeIdStr);
      totalValue += amount * exchangeRate(typeId);
    }
    tx.Value = totalValue;

    // Calculate TXID
    tx.TXID = await getTXID(tx);

    // Calculate Size
    tx.Size = getTXSize(tx);

    // Get user's private key for signing
    const userAddr = buildTXInfo.UserAddress[0];
    const userAddrData = addressMsg[userAddr];
    const privHex = userAddrData?.privHex || userAccount.keys?.privHex || userAccount.privHex || '';
    const pubXHex = userAddrData?.pubXHex || userAccount.keys?.pubXHex || userAccount.pubXHex || '';
    const pubYHex = userAddrData?.pubYHex || userAccount.keys?.pubYHex || userAccount.pubYHex || '';

    if (!privHex) {
      throw new Error('Private key not found for signing');
    }

    // Sign transaction
    const signature = await getTXUserSignature(tx, privHex, pubXHex, pubYHex);
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
