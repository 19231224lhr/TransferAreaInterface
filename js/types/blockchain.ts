/**
 * Blockchain core type definitions aligned with the current Go backend.
 */

export interface EcdsaSignature {
  R: string | null;
  S: string | null;
}

export interface PublicKeyNew {
  CurveName?: string;
  Curve?: string;
  X?: string;
  Y?: string;
  XHex?: string;
  YHex?: string;
}

export interface SignatureEnvelope {
  Algorithm: string;
  Signature: number[] | string | null;
}

export interface PublicKeyEnvelope {
  Algorithm: string;
  PublicKey: number[] | string | null;
}

export interface TxPosition {
  Blocknum: number;
  IndexX: number;
  IndexY: number;
  IndexZ: number;
}

export interface NullableEcdsaSignature {
  R: string | null;
  S: string | null;
}

export interface TXInputNormal {
  FromTXID: string;
  FromTxPosition: TxPosition;
  FromAddress: string;
  IsGuarMake: boolean;
  IsCommitteeMake: boolean;
  IsCrossChain: boolean;
  InputSignature: EcdsaSignature | NullableEcdsaSignature;
  TXOutputHash: number[] | string;
  InputSignatureV2?: SignatureEnvelope;
  SeedReveal?: number[] | string;
  SeedPublicKeyV2?: PublicKeyEnvelope;
  SeedChainStep?: number;
}

export interface TXCerPosition {
  BlockHeight: number;
  Index: number;
  InIndex: number;
}

export interface TxCertificate {
  TXCerID: string;
  ToAddress: string;
  Value: number;
  ToInterest: number;
  FromGuarGroupID: string;
  ToGuarGroupID: string;
  ConstructionTime: number;
  Size?: number;
  TXID: string;
  TxCerPosition: TXCerPosition;
  GuarGroupSignature: EcdsaSignature;
  UserSignature: EcdsaSignature;
  UserSignatureV2?: SignatureEnvelope;
}

export interface TXOutput {
  ToAddress: string;
  ToValue: number;
  ToGuarGroupID: string;
  ToPublicKey: PublicKeyNew;
  ToInterest: number;
  Type?: number;
  ToCoinType?: number;
  ToPeerID?: string;
  IsPayForGas?: boolean;
  IsCrossChain: boolean;
  IsGuarMake: boolean;
  Hash?: string;
  SeedAnchor?: number[] | string;
  SeedChainStep?: number;
  DefaultSpendAlgorithm?: string;
}

export interface InterestAssign {
  Gas: number;
  Output: number;
  BackAssign: Record<string, number>;
}

export interface SubATX {
  TXID: string;
  TXType: number;
  TXInputsNormal: TXInputNormal[];
  TXInputsCertificate: TxCertificate[];
  TXOutputs: TXOutput[];
  InterestAssign: InterestAssign;
  ExTXCerID: string[];
  Data: number[] | string;
  UserSignatureV2?: SignatureEnvelope;
}

export interface AggregateGTX {
  AggrTXType: number;
  IsGuarCommittee: boolean;
  IsNoGuarGroupTX: boolean;
  GuarantorGroupID: string;
  GuarantorGroupSig: EcdsaSignature | NullableEcdsaSignature;
  TXNum: number;
  TotalGas: number;
  TXHash: string;
  TXSize: number;
  Version: number;
  AllTransactions: SubATX[];
}

export interface Transaction {
  TXID: string;
  Size: number;
  Version: number;
  GuarantorGroup: string;
  TXType: number;
  Value: number;
  ValueDivision: Record<number, number>;
  NewValue: number;
  NewValueDiv: Record<number, number>;
  InterestAssign: InterestAssign;
  UserSignature: EcdsaSignature;
  UserSignatureV2?: SignatureEnvelope;
  TXInputsNormal: TXInputNormal[];
  TXInputsCertificate: TxCertificate[];
  TXOutputs: TXOutput[];
  Data: number[] | string;
}

export interface UTXOData {
  UTXO: SubATX;
  Value: number;
  Type: number;
  Time: number;
  Position: TxPosition;
  IsTXCerUTXO: boolean;
  TXID?: string;
  TXOutputHash?: string;
}

export interface BillMsg {
  MoneyType: number;
  Value: number;
  GuarGroupID: string;
  PublicKey: PublicKeyNew;
  ToInterest: number;
}

export interface BuildTXInfo {
  Value: number;
  ValueDivision: Record<number, number>;
  Bill: Record<string, BillMsg>;
  UserAddress: string[];
  PriUseTXCer: boolean;
  ChangeAddress: Record<number, string>;
  IsPledgeTX: boolean;
  HowMuchPayForGas: number;
  IsCrossChainTX: boolean;
  Data: number[] | string;
  InterestAssign: InterestAssign;
}

export interface UserNewTX {
  TX: Transaction;
  UserID: string;
  Height: number;
  Sig: EcdsaSignature;
}

export function isUTXOData(obj: unknown): obj is UTXOData {
  if (typeof obj !== 'object' || obj === null) return false;
  const utxo = obj as Partial<UTXOData>;
  return (
    typeof utxo.Value === 'number' &&
    typeof utxo.Type === 'number' &&
    typeof utxo.Time === 'number' &&
    typeof utxo.IsTXCerUTXO === 'boolean' &&
    utxo.UTXO !== undefined &&
    utxo.Position !== undefined
  );
}

export function isTXOutput(obj: unknown): obj is TXOutput {
  if (typeof obj !== 'object' || obj === null) return false;
  const output = obj as Partial<TXOutput>;
  return (
    typeof output.ToAddress === 'string' &&
    typeof output.ToValue === 'number' &&
    typeof output.IsCrossChain === 'boolean'
  );
}

export function isTransaction(obj: unknown): obj is Transaction {
  if (typeof obj !== 'object' || obj === null) return false;
  const tx = obj as Partial<Transaction>;
  return (
    typeof tx.TXID === 'string' &&
    typeof tx.TXType === 'number' &&
    typeof tx.Value === 'number' &&
    Array.isArray(tx.TXOutputs)
  );
}
