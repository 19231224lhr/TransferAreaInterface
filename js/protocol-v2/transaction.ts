import { canonicalAmount, canonicalRatio } from './amount';
import {
  bytesToBase64,
  bytesToHex,
  canonicalJSONStringify,
  decodeBackendBytes,
  ecdsaSignature,
  publicKey,
  sha256Bytes,
  signatureEnvelope,
  sortRecord
} from './canonical';
import type { SettlementAuthV2, TransactionV2, TXCerV2 } from './types';

export const TRANSACTION_PROTOCOL_VERSION = 2;
export const TRANSACTION_NETWORK_ID = 'utxo-area-experiment-v1';
export const TRANSACTION_HASH_DOMAIN = 'utxo-area/transaction/v2';
export const SETTLEMENT_INTENT_DOMAIN = 'utxo-area/settlement-intent/v2';

function position(value: any) {
  return { Blocknum: Number(value?.Blocknum || 0), IndexX: Number(value?.IndexX || 0), IndexY: Number(value?.IndexY || 0), IndexZ: Number(value?.IndexZ || 0) };
}

function txCerPosition(value: any) {
  return { BlockHeight: Number(value?.BlockHeight || 0), Index: Number(value?.Index || 0), InIndex: Number(value?.InIndex || 0) };
}

function zeroSettlementAuth() {
  return {
    Version: 0, TXCerID: '', SourceTXID: '', SourcePosition: txCerPosition(null), Value: '0',
    FromGuarGroupID: '', ToGuarGroupID: '', PledgeAddress: '', ConsumeIntentHash: null,
    AuthTime: 0, UserSignatureV2: signatureEnvelope(null)
  };
}

function settlementAuth(value: SettlementAuthV2 | null | undefined, canonicalBytes: boolean) {
  return {
    Version: Number(value?.Version || 0),
    TXCerID: String(value?.TXCerID || ''),
    SourceTXID: String(value?.SourceTXID || ''),
    SourcePosition: txCerPosition(value?.SourcePosition),
    Value: canonicalAmount(value?.Value),
    FromGuarGroupID: String(value?.FromGuarGroupID || ''),
    ToGuarGroupID: String(value?.ToGuarGroupID || ''),
    PledgeAddress: String(value?.PledgeAddress || ''),
    ConsumeIntentHash: value?.ConsumeIntentHash == null && !canonicalBytes ? null : bytesToBase64(value?.ConsumeIntentHash),
    AuthTime: Number(value?.AuthTime || 0),
    UserSignatureV2: signatureEnvelope(value?.UserSignatureV2, canonicalBytes)
  };
}

function exposureShare(value: any) {
  return {
    RootID: String(value?.RootID || ''), LeafID: String(value?.LeafID || ''), GroupID: String(value?.GroupID || ''),
    PledgeAddress: String(value?.PledgeAddress || ''), Amount: canonicalAmount(value?.Amount)
  };
}

function txCertificate(value: TXCerV2 | null | undefined, clearSettlement: boolean) {
  return {
    TXCerID: String(value?.TXCerID || ''),
    ToAddress: String(value?.ToAddress || ''),
    Value: canonicalAmount(value?.Value),
    ToInterest: canonicalAmount(value?.ToInterest),
    FromGuarGroupID: String(value?.FromGuarGroupID || ''),
    ToGuarGroupID: String(value?.ToGuarGroupID || ''),
    SourcePledgeAddress: String(value?.SourcePledgeAddress || ''),
    ConstructionTime: Number(value?.ConstructionTime || 0),
    Size: Number(value?.Size || 0),
    ExposureShares: (value?.ExposureShares || []).map(exposureShare),
    TXID: String(value?.TXID || ''),
    TxCerPosition: txCerPosition(value?.TxCerPosition),
    GuarGroupSignature: ecdsaSignature(value?.GuarGroupSignature),
    UserSignature: ecdsaSignature(value?.UserSignature),
    UserSignatureV2: signatureEnvelope(value?.UserSignatureV2, true),
    SettlementAuth: clearSettlement ? zeroSettlementAuth() : settlementAuth(value?.SettlementAuth, true)
  };
}

// UserNewTX still uses the legacy Go struct-JSON signature. Persisted client
// records may have alphabetically sorted keys, so rebuild every nested TXCer
// in the exact Go declaration order before computing that outer signature.
export function normalizeTXCerForGoStructJSON(value: TXCerV2 | null | undefined) {
  return txCertificate(value, false);
}

function normalInput(value: any) {
  return {
    FromTXID: String(value?.FromTXID || ''), FromTxPosition: position(value?.FromTxPosition), FromAddress: String(value?.FromAddress || ''),
    IsGuarMake: Boolean(value?.IsGuarMake), IsCommitteeMake: Boolean(value?.IsCommitteeMake), IsCrossChain: Boolean(value?.IsCrossChain),
    InputSignature: ecdsaSignature(value?.InputSignature), TXOutputHash: bytesToBase64(value?.TXOutputHash),
    InputSignatureV2: signatureEnvelope(value?.InputSignatureV2, true), SeedReveal: bytesToBase64(value?.SeedReveal),
    SeedPublicKeyV2: { Algorithm: String(value?.SeedPublicKeyV2?.Algorithm || ''), PublicKey: bytesToBase64(value?.SeedPublicKeyV2?.PublicKey) },
    SeedChainStep: Number(value?.SeedChainStep || 0)
  };
}

function output(value: any) {
  return {
    ToAddress: String(value?.ToAddress || ''), ToValue: canonicalAmount(value?.ToValue), ToGuarGroupID: String(value?.ToGuarGroupID || ''),
    ToPublicKey: publicKey(value?.ToPublicKey), ToInterest: canonicalAmount(value?.ToInterest), Type: Number(value?.Type || 0),
    ToPeerID: String(value?.ToPeerID || ''), IsPayForGas: Boolean(value?.IsPayForGas), IsCrossChain: Boolean(value?.IsCrossChain),
    IsGuarMake: Boolean(value?.IsGuarMake), SeedAnchor: bytesToBase64(value?.SeedAnchor), SeedChainStep: Number(value?.SeedChainStep || 0),
    DefaultSpendAlgorithm: String(value?.DefaultSpendAlgorithm || '')
  };
}

export function canonicalizeTXOutputHashMaterialV2(value: any) {
  const material = output(value);
  if (decodeBackendBytes(value?.SeedAnchor).length === 0) {
    return { ...material, SeedAnchor: null, SeedChainStep: 0, DefaultSpendAlgorithm: '' };
  }
  return material;
}

export function computeTXOutputHashCompatV2(value: any): number[] {
  return sha256Bytes(canonicalJSONStringify(canonicalizeTXOutputHashMaterialV2(value)));
}

function material(tx: TransactionV2, domain: string, clearSettlement: boolean) {
  const interest: any = tx.InterestAssign || {};
  return {
    Domain: domain,
    NetworkID: TRANSACTION_NETWORK_ID,
    Version: Number(tx.Version || 0),
    GuarantorGroup: String(tx.GuarantorGroup || ''),
    TXType: Number(tx.TXType || 0),
    Value: canonicalAmount(tx.Value),
    ValueDivision: sortRecord(tx.ValueDivision as Record<string, any>, canonicalAmount),
    InterestAssign: {
      Gas: canonicalAmount(interest.Gas), Output: canonicalAmount(interest.Output),
      BackAssign: sortRecord(interest.BackAssign as Record<string, any>, canonicalRatio)
    },
    TXInputsNormal: (tx.TXInputsNormal || []).filter(input => !input.IsGuarMake).map(normalInput),
    TXInputsCertificate: (tx.TXInputsCertificate || []).map(input => txCertificate(input, clearSettlement)),
    TXOutputs: (tx.TXOutputs || []).filter(item => !item.IsGuarMake).map(output),
    Data: bytesToBase64(tx.Data)
  };
}

export function canonicalizeTransactionV2(tx: TransactionV2) {
  return material(tx, TRANSACTION_HASH_DOMAIN, false);
}

export function computeTransactionHashV2(tx: TransactionV2): number[] {
  return sha256Bytes(canonicalJSONStringify(canonicalizeTransactionV2(tx)));
}

export function computeTransactionIDV2(tx: TransactionV2): string {
  return bytesToHex(computeTransactionHashV2(tx));
}

export function computeSettlementIntentHashV2(tx: TransactionV2, txCerID: string): number[] {
  return sha256Bytes(canonicalJSONStringify({ TXCerID: txCerID, Transaction: material(tx, SETTLEMENT_INTENT_DOMAIN, true) }));
}

export function canonicalizeSettlementAuthSignatureMaterialV2(value: SettlementAuthV2) {
  const material = settlementAuth(value, true);
  material.UserSignatureV2 = signatureEnvelope(null);
  return material;
}

export function computeSettlementAuthHashV2(value: SettlementAuthV2): number[] {
  return sha256Bytes(canonicalJSONStringify(canonicalizeSettlementAuthSignatureMaterialV2(value)));
}

export function canonicalizeTXCerIdentityV2(value: TXCerV2) {
  const material = txCertificate(value, false);
  material.TXCerID = '';
  material.GuarGroupSignature = ecdsaSignature(null);
  material.UserSignature = ecdsaSignature(null);
  material.UserSignatureV2 = signatureEnvelope(null);
  material.SettlementAuth = zeroSettlementAuth();
  return material;
}

export function canonicalizeTXCerSourceSignatureMaterialV2(value: TXCerV2) {
  const material = txCertificate(value, false);
  material.GuarGroupSignature = ecdsaSignature(null);
  material.UserSignature = ecdsaSignature(null);
  material.UserSignatureV2 = signatureEnvelope(null);
  material.SettlementAuth = zeroSettlementAuth();
  return material;
}

export function computeTXCerIDV2(value: TXCerV2): string {
  return bytesToHex(sha256Bytes(canonicalJSONStringify(canonicalizeTXCerIdentityV2(value))));
}

export { exposureShare, txCertificate, zeroSettlementAuth };
