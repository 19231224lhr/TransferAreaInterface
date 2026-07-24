import type { AmountInput } from '../utils/amount';
import { isAmountLike } from '../utils/amount';
import type {
  ExposureShareV2,
  FastLiabilityReceiptV2,
  TXCerFastEvidenceV2,
  TXCerIssuanceAckV2,
  TXCerIssuanceRecordV2,
  TXCerIssueProofV2
} from '../protocol-v2/types';
import type { TXCerAuthoritySnapshot, TXCerSecurityState } from '../protocol-v2/security';

export type ProtocolAmount = AmountInput;

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

export interface SettlementAuth {
  Version: number;
  TXCerID: string;
  SourceTXID: string;
  SourcePosition: TXCerPosition;
  Value: ProtocolAmount;
  FromGuarGroupID: string;
  ToGuarGroupID: string;
  PledgeAddress: string;
  ConsumeIntentHash: number[] | string | null;
  AuthTime: number;
  UserSignatureV2: SignatureEnvelope;
}

export type TXCerLifecycleStatus =
  | 'Active'
  | 'PendingUse'
  | 'Consumed'
  | 'AwaitingExchange'
  | 'Exchanged'
  | 'ConvertedToUTXO'
  | 'Invalid';

export type TXCerIssuanceStatus =
  | 'Prepared'
  | 'Issued'
  | 'RegisteredActive'
  | 'Delivered'
  | 'QueuedForBlock'
  | 'BlockCommitted'
  | 'Failed'
  | 'Invalid';

export interface TXCerIssueProofStep {
  Hash: number[] | string | null;
  Side: 'left' | 'right';
}

export interface TXCerIssueProof {
  LeafHash?: number[] | string | null;
  MerkleRoot?: number[] | string | null;
  Steps?: TXCerIssueProofStep[];
  BatchID?: string;
  BatchSignature?: EcdsaSignature;
  CertifierID?: string;
}

export interface CertifierInfo {
  certifierID?: string;
  CertifierID?: string;
  publicKey?: PublicKeyNew;
  PublicKey?: PublicKeyNew;
  status?: string;
  Status?: string;
  shardRule?: string;
  ShardRule?: string;
  peerID?: string;
  PeerID?: string;
  apiEndpoint?: string;
  APIEndpoint?: string;
  lastHeartbeat?: number;
  LastHeartbeat?: number;
  registeredAt?: number;
  RegisteredAt?: number;
  disabledAt?: number;
  DisabledAt?: number;
  revokedAt?: number;
  RevokedAt?: number;
  weight?: number;
  Weight?: number;
  shardIndex?: number;
  ShardIndex?: number;
  failureCount?: number;
  FailureCount?: number;
  issuedBatchCount?: number;
  IssuedBatchCount?: number;
  inFlightCount?: number;
  InFlightCount?: number;
}

export interface TXCerIssuanceAck {
  recordID?: string;
  RecordID?: string;
  txCerID?: string;
  TXCerID?: string;
  evidenceHash?: number[] | string | null;
  EvidenceHash?: number[] | string | null;
  groupID?: string;
  GroupID?: string;
  userID?: string;
  UserID?: string;
  status?: TXCerIssuanceStatus | string;
  Status?: TXCerIssuanceStatus | string;
  assignNodeID?: string;
  AssignNodeID?: string;
  registeredAt?: number;
  RegisteredAt?: number;
  errorReason?: string;
  ErrorReason?: string;
  signature?: EcdsaSignature;
  Signature?: EcdsaSignature;
}

export interface TXCerIssuanceView {
  recordID?: string;
  RecordID?: string;
  issueKey?: string;
  IssueKey?: string;
  txID?: string;
  TXID?: string;
  outputIndex?: number;
  OutputIndex?: number;
  txCerID?: string;
  TXCerID?: string;
  userID?: string;
  UserID?: string;
  toAddress?: string;
  ToAddress?: string;
  value?: ProtocolAmount;
  Value?: ProtocolAmount;
  status?: TXCerIssuanceStatus | string;
  Status?: TXCerIssuanceStatus | string;
  batchID?: string;
  BatchID?: string;
  certifierID?: string;
  CertifierID?: string;
  guarGroupID?: string;
  GuarGroupID?: string;
  targetBlock?: number;
  TargetBlock?: number;
  guarTXIndex?: number;
  GuarTXIndex?: number;
  updatedAt?: number;
  UpdatedAt?: number;
  errorReason?: string;
  ErrorReason?: string;
  receiptID?: string;
  ReceiptID?: string;
  exposureSharesHash?: number[] | string | null;
  ExposureSharesHash?: number[] | string | null;
  liabilityReceiptHash?: number[] | string | null;
  LiabilityReceiptHash?: number[] | string | null;
  rootExposureIDs?: string[];
  RootExposureIDs?: string[];
  liabilityDeltaID?: string;
  LiabilityDeltaID?: string;
  fastEvidenceVersion?: string;
  FastEvidenceVersion?: string;
  auditStatus?: string;
  AuditStatus?: string;
}

export interface TXCerIssuanceDetailView extends TXCerIssuanceView {
  proof?: TXCerIssueProof;
  Proof?: TXCerIssueProof;
  ack?: TXCerIssuanceAck;
  Ack?: TXCerIssuanceAck;
  liabilityReceipt?: FastLiabilityReceiptV2;
  LiabilityReceipt?: FastLiabilityReceiptV2;
  fastEvidence?: TXCerFastEvidenceV2;
  FastEvidence?: TXCerFastEvidenceV2;
  txCer?: TxCertificate;
  TXCer?: TxCertificate;
}

export type TXCerProofVerificationStatus = 'verified' | 'invalid' | 'missingProof' | 'unsupported';

export interface AuditEvent {
  EventID?: string;
  EventType?: string;
  SubjectID?: string;
  ActorID?: string;
  GroupID?: string;
  PayloadHash?: number[] | string;
  PreviousHash?: number[] | string;
  EventHash?: number[] | string;
  Timestamp?: number;
  Signature?: EcdsaSignature;
}

export type ChallengeStatus = 'Open' | 'Resolved';

export type ChallengeType =
  | 'TXCerPendingUseTimeout'
  | 'IssuanceAckTimeout'
  | 'ExchangeConfirmTimeout';

export interface ChallengeRecord {
  ChallengeID?: string;
  ChallengeType?: ChallengeType | string;
  SubjectID?: string;
  UserID?: string;
  GroupID?: string;
  Status?: ChallengeStatus | string;
  Reason?: string;
  CreatedAt?: number;
  ResolvedAt?: number;
}

export interface CommitteeReceipt {
  ReceiptID?: string;
  SubjectType?: 'ExchangeRecord' | 'TXCerIssuanceBatch' | string;
  SubjectID?: string;
  GroupID?: string;
  Signers?: string[];
  Threshold?: number;
  Decision?: 'Confirmed' | 'Rejected' | string;
  Timestamp?: number;
  AggregateHash?: number[] | string;
  Signatures?: Record<string, EcdsaSignature>;
}

export type PenaltyStatus = 'PendingGovernance' | 'Approved' | 'Rejected';

export interface PenaltyRecord {
  PenaltyID?: string;
  GroupID?: string;
  Reason?: string;
  RelatedTXCerID?: string;
  RelatedChallengeID?: string;
  Amount?: number;
  Status?: PenaltyStatus | string;
  CreatedAt?: number;
}

export interface TXCerIssuanceMetadata {
  txCer?: TxCertificate;
  lifecycleStatus?: TXCerLifecycleStatus | string;
  issuanceRecordID: string;
  issuanceStatus?: TXCerIssuanceStatus | string;
  issuanceProof?: TXCerIssueProofV2;
  issueBatchID?: string;
  deliveredAt?: number;
  proofStatus?: TXCerProofVerificationStatus;
  proofCheckedAt?: number;
  proofError?: string;
  issuanceRecord?: TXCerIssuanceRecordV2;
  fastEvidence?: TXCerFastEvidenceV2;
  assignAck?: TXCerIssuanceAckV2;
  liabilityReceipt?: FastLiabilityReceiptV2;
  authoritySnapshot?: TXCerAuthoritySnapshot;
  security?: TXCerSecurityState;
}

export interface TXCerClientRecord extends TXCerIssuanceMetadata {}

export interface TXCerStatusView {
  txCerID: string;
  userID: string;
  address: string;
  status: TXCerLifecycleStatus;
  previousStatus?: TXCerLifecycleStatus;
  value: ProtocolAmount;
  sourceTXID?: string;
  sourcePosition: TXCerPosition;
  fromGuarGroupID?: string;
  toGuarGroupID?: string;
  pledgeAddress?: string;
  consumeTXID?: string;
  exchangeTXID?: string;
  utxo?: string;
  reason?: string;
  blockHeight: number;
  updatedAt: number;
}

export type TxResourceKind = 'utxo' | 'txcer' | 'seed_step' | 'address' | 'pledge' | 'output';

export type TxTaskStatus =
  | 'queued'
  | 'processing'
  | 'pending_confirm'
  | 'success'
  | 'failed'
  | 'rejected';

export type TxTaskDAGEventType =
  | 'submitted'
  | 'queued'
  | 'acquired'
  | 'dispatched'
  | 'guar_received'
  | 'verify_started'
  | 'verify_passed'
  | 'verify_failed'
  | 'aggr_confirmed'
  | 'timeout'
  | 'rejected'
  | 'recovered';

export interface TxResourceSet {
  TXID?: string;
  UserID?: string;
  GroupID?: string;
  HardKeys?: string[];
  SoftKeys?: string[];
  ReadKeys?: string[];
  WriteKeys?: string[];
}

export interface TxTaskDAGEnvelope {
  TXID?: string;
  AssignSeq?: number;
  AssignEventID?: string;
  GuarID?: string;
  Dependencies?: string[];
  HardKeys?: string[];
  SoftKeys?: string[];
  Status?: TxTaskStatus | string;
  Signature?: EcdsaSignature;
}

export interface TxTask {
  TXID?: string;
  UserID?: string;
  GroupID?: string;
  TX?: Transaction;
  UserNewTX?: UserNewTX;
  GuarTX?: unknown;
  SchedulerEnvelope?: TxTaskDAGEnvelope;
  Resources?: TxResourceSet;
  Gas?: ProtocolAmount;
  Height?: number;
  ReceivedAt?: number;
  Status?: TxTaskStatus | string;
  Error?: string;
}

export interface TxTaskDAGEvent {
  EventID?: string;
  Seq?: number;
  EventType?: TxTaskDAGEventType | string;
  GroupID?: string;
  NodeRole?: 'assign' | 'guar' | 'aggr' | string;
  NodeID?: string;
  SourceNodeRole?: string;
  SourceNodeID?: string;
  SourceEventID?: string;
  SourceEventHash?: number[] | string;
  SourceSignature?: EcdsaSignature;
  TXID?: string;
  UserID?: string;
  GuarID?: string;
  Task?: TxTask;
  FromStatus?: TxTaskStatus | string;
  ToStatus?: TxTaskStatus | string;
  Dependencies?: string[];
  BlockingResources?: string[];
  ResourceOwners?: Record<string, string>;
  Reason?: string;
  Timestamp?: number;
  PreviousHash?: number[] | string;
  EventHash?: number[] | string;
  Signature?: EcdsaSignature;
}

export interface TxTaskDAGRecord {
  TXID?: string;
  UserID?: string;
  GroupID?: string;
  GuarID?: string;
  Task?: TxTask;
  Status?: TxTaskStatus | string;
  Dependencies?: string[];
  BlockingResources?: string[];
  ResourceOwners?: Record<string, string>;
  HardKeys?: string[];
  SoftKeys?: string[];
  LastEventID?: string;
  LastSeq?: number;
  UpdatedAt?: number;
  Error?: string;
}

export interface ResourceSchedulerStats {
  mode?: string;
  active_tasks?: number;
  queued_tasks?: number;
  pending_confirm_tasks?: number;
  completed_tasks?: number;
  rejected_hard_conflicts?: number;
  soft_conflict_waits?: number;
  average_wait_ms?: number;
  average_execute_ms?: number;
}

export interface SchedulerStatsResponse {
  success?: boolean;
  mode?: string;
  stats?: ResourceSchedulerStats;
  dag_records?: number;
  dag_events?: number;
  last_seq?: number;
  last_hash?: string;
  recovered_tasks?: number;
}

export interface CertifierIssueBatchRequest {
  RequestID?: string;
  GroupID?: string;
  CertifierID?: string;
  AggregationNodeID?: string;
  AggregationPeerID?: string;
  Records?: TXCerIssuanceDetailView[];
  Deadline?: number;
  Timestamp?: number;
  Signature?: EcdsaSignature;
}

export interface TxCertificate {
  TXCerID: string;
  ToAddress: string;
  Value: ProtocolAmount;
  ToInterest: ProtocolAmount;
  FromGuarGroupID: string;
  ToGuarGroupID: string;
  SourcePledgeAddress?: string;
  ConstructionTime: number;
  Size?: number;
  ExposureShares?: ExposureShareV2[];
  TXID: string;
  TxCerPosition: TXCerPosition;
  GuarGroupSignature: EcdsaSignature;
  UserSignature: EcdsaSignature;
  UserSignatureV2?: SignatureEnvelope;
  SettlementAuth?: SettlementAuth;
}

export interface TXOutput {
  ToAddress: string;
  ToValue: ProtocolAmount;
  ToGuarGroupID: string;
  ToPublicKey: PublicKeyNew;
  ToInterest: ProtocolAmount;
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
  Gas: ProtocolAmount;
  Output: ProtocolAmount;
  BackAssign: Record<string, number | string>;
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
  TotalGas: ProtocolAmount;
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
  Value: ProtocolAmount;
  ValueDivision: Record<number, ProtocolAmount>;
  NewValue: ProtocolAmount;
  NewValueDiv: Record<number, ProtocolAmount>;
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
  Value: ProtocolAmount;
  Type: number;
  Time: number;
  Position: TxPosition;
  IsTXCerUTXO: boolean;
  TXID?: string;
  TXOutputHash?: string;
}

export interface BillMsg {
  MoneyType: number;
  Value: ProtocolAmount;
  GuarGroupID: string;
  PublicKey: PublicKeyNew;
  ToInterest: ProtocolAmount;
}

export interface BuildTXInfo {
  Value: ProtocolAmount;
  ValueDivision: Record<number, ProtocolAmount>;
  Bill: Record<string, BillMsg>;
  UserAddress: string[];
  PriUseTXCer: boolean;
  ChangeAddress: Record<number, string>;
  IsPledgeTX: boolean;
  HowMuchPayForGas: ProtocolAmount;
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
    isAmountLike(utxo.Value) &&
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
    isAmountLike(output.ToValue) &&
    typeof output.IsCrossChain === 'boolean'
  );
}

export function isTransaction(obj: unknown): obj is Transaction {
  if (typeof obj !== 'object' || obj === null) return false;
  const tx = obj as Partial<Transaction>;
  return (
    typeof tx.TXID === 'string' &&
    typeof tx.TXType === 'number' &&
    isAmountLike(tx.Value) &&
    Array.isArray(tx.TXOutputs)
  );
}
