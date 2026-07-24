export type AmountDecimal = string;
export type AmountUnits = bigint;
export type RatioDecimal = string;
export type DecimalInput = string | number | bigint;
export type BackendBytes = string | number[] | Uint8Array | null | undefined;

export interface EcdsaSignatureV2 {
  R: bigint | string | number | null;
  S: bigint | string | number | null;
}

export interface PublicKeyV2 {
  CurveName?: string;
  curveName?: string;
  X?: bigint | string | number;
  Y?: bigint | string | number;
  x?: bigint | string | number;
  y?: bigint | string | number;
}

export interface SignatureEnvelopeV2 {
  Algorithm?: string;
  Signature?: BackendBytes;
}

export interface PublicKeyEnvelopeV2 {
  Algorithm?: string;
  PublicKey?: BackendBytes;
}

export interface ExposureShareV2 {
  RootID: string;
  LeafID: string;
  GroupID: string;
  PledgeAddress: string;
  Amount: DecimalInput;
}

export interface SettlementAuthV2 {
  Version?: number;
  TXCerID?: string;
  SourceTXID?: string;
  SourcePosition?: any;
  Value?: DecimalInput;
  FromGuarGroupID?: string;
  ToGuarGroupID?: string;
  PledgeAddress?: string;
  ConsumeIntentHash?: BackendBytes;
  AuthTime?: number | bigint;
  UserSignatureV2?: SignatureEnvelopeV2;
}

export interface TXCerV2 {
  TXCerID?: string;
  ToAddress?: string;
  Value?: DecimalInput;
  ToInterest?: DecimalInput;
  FromGuarGroupID?: string;
  ToGuarGroupID?: string;
  SourcePledgeAddress?: string;
  ConstructionTime?: number | bigint;
  Size?: number;
  ExposureShares?: ExposureShareV2[] | null;
  TXID?: string;
  TxCerPosition?: any;
  GuarGroupSignature?: EcdsaSignatureV2;
  UserSignature?: EcdsaSignatureV2;
  UserSignatureV2?: SignatureEnvelopeV2;
  SettlementAuth?: SettlementAuthV2;
}

export interface TransactionV2 {
  TXID?: string;
  Size?: number;
  Version?: number;
  GuarantorGroup?: string;
  TXType?: number;
  Value?: DecimalInput;
  ValueDivision?: Record<string | number, DecimalInput> | null;
  NewValue?: DecimalInput;
  NewValueDiv?: Record<string | number, DecimalInput> | null;
  InterestAssign?: any;
  UserSignature?: EcdsaSignatureV2;
  UserSignatureV2?: SignatureEnvelopeV2;
  TXInputsNormal?: any[] | null;
  TXInputsCertificate?: TXCerV2[] | null;
  TXOutputs?: any[] | null;
  Data?: BackendBytes;
}

export interface LiabilityAuthorityContext {
  members: string[];
  threshold: number;
  publicKeys: Record<string, PublicKeyV2>;
  sourceAggregationPublicKey?: PublicKeyV2;
  sourceAssignPublicKey?: PublicKeyV2;
}

export interface TxTaskDAGEnvelopeV2 {
  TXID?: string;
  AssignSeq?: number | bigint;
  AssignEventID?: string;
  GuarID?: string;
  Dependencies?: string[] | null;
  HardKeys?: string[] | null;
  SoftKeys?: string[] | null;
  SchemaVersion?: number;
  Status?: string;
  Signature?: EcdsaSignatureV2;
}

export interface IssuerLiabilityCommitmentV2 {
  CommitmentID?: string;
  GroupID?: string;
  PledgeAddress?: string;
  TXCerID?: string;
  LiabilityDeltaID?: string;
  Seq?: number | bigint;
  PrevStateRoot?: BackendBytes;
  NextStateRoot?: BackendBytes;
  ExposureSharesHash?: BackendBytes;
  DeltaHash?: BackendBytes;
  OutstandingBefore?: DecimalInput;
  OutstandingAfter?: DecimalInput;
  IssuerID?: string;
  IssuedAt?: number | bigint;
  Signature?: EcdsaSignatureV2;
}

export interface TXCerFastEvidenceV2 extends Record<string, any> {
  Version?: string;
  RecordID?: string;
  IssueKey?: string;
  TXID?: string;
  OutputIndex?: number;
  TXCerID?: string;
  SourceGroupID?: string;
  DestinationGroupID?: string;
  SourcePledgeAddress?: string;
  Reservation?: TxTaskDAGEnvelopeV2;
  Liability?: IssuerLiabilityCommitmentV2;
  IssuerID?: string;
  IssuedAt?: number | bigint;
  Signature?: EcdsaSignatureV2;
}

export interface TXCerIssuanceAckV2 extends Record<string, any> {
  recordID?: string;
  RecordID?: string;
  txCerID?: string;
  TXCerID?: string;
  evidenceHash?: BackendBytes;
  EvidenceHash?: BackendBytes;
  groupID?: string;
  GroupID?: string;
  userID?: string;
  UserID?: string;
  status?: string;
  Status?: string;
  assignNodeID?: string;
  AssignNodeID?: string;
  registeredAt?: number | bigint;
  RegisteredAt?: number | bigint;
  errorReason?: string;
  ErrorReason?: string;
  signature?: EcdsaSignatureV2;
  Signature?: EcdsaSignatureV2;
}

export interface FastLiabilityReceiptV2 extends Record<string, any> {
  ReceiptID?: string;
  GroupID?: string;
  PledgeAddress?: string;
  SignerSetID?: string;
  TXCerID?: string;
  LiabilityDeltaID?: string;
  LiabilityDeltaType?: string;
  Seq?: number | bigint;
  PrevStateRoot?: BackendBytes;
  NextStateRoot?: BackendBytes;
  ExposureSharesHash?: BackendBytes;
  DeltaHash?: BackendBytes;
  OutstandingBefore?: DecimalInput;
  OutstandingAfter?: DecimalInput;
  Threshold?: number;
  Signers?: string[] | null;
  Timestamp?: number | bigint;
  Signatures?: Record<string, EcdsaSignatureV2> | null;
}

export interface MerkleProofStepV2 {
  Hash?: BackendBytes;
  Side?: 'left' | 'right' | string;
}

export interface TXCerIssueProofV2 extends Record<string, any> {
  LeafHash?: BackendBytes;
  MerkleRoot?: BackendBytes;
  Steps?: MerkleProofStepV2[] | null;
  BatchID?: string;
  BatchSignature?: EcdsaSignatureV2;
  CertifierID?: string;
}

export interface TXCerIssuanceRecordV2 extends Record<string, any> {
  RecordID?: string;
  IssueKey?: string;
  TXID?: string;
  OutputIndex?: number;
  UserID?: string;
  ToAddress?: string;
  TXCerID?: string;
  TXCer?: TXCerV2;
  GuarGroupID?: string;
  TargetBlock?: number;
  GuarTXIndex?: number;
  CertifierID?: string;
  BatchID?: string;
  Proof?: TXCerIssueProofV2;
  Ack?: TXCerIssuanceAckV2;
  ExposureSharesHash?: BackendBytes;
  LiabilityReceiptHash?: BackendBytes;
  RootExposureIDs?: string[] | null;
  LiabilityDeltaID?: string;
  LiabilityReceipt?: FastLiabilityReceiptV2;
  FastEvidence?: TXCerFastEvidenceV2;
  AuditStatus?: string;
}
