import { canonicalAmount, parseAmount } from './amount';
import {
  bytesToBase64,
  bytesToHex,
  canonicalJSONStringify,
  decodeBackendBytes,
  ecdsaSignature,
  integerValue,
  sha256Bytes,
  sortRecord,
  verifyECDSAHash
} from './canonical';
import {
  canonicalizeTXCerSourceSignatureMaterialV2,
  computeTXCerIDV2,
  exposureShare
} from './transaction';
import type {
  BackendBytes,
  FastLiabilityReceiptV2,
  LiabilityAuthorityContext,
  PublicKeyV2,
  TXCerFastEvidenceV2,
  TXCerIssuanceAckV2,
  TXCerIssuanceRecordV2,
  TXCerIssueProofV2
} from './types';

export const TXCER_FAST_EVIDENCE_VERSION = 'txcer-fast-v2';
export const TXCER_FAST_EVIDENCE_DOMAIN = 'utxo-area/txcer/fast-evidence/v2';
export const ISSUER_LIABILITY_COMMITMENT_DOMAIN = 'utxo-area/txcer/issuer-liability/v2';

function text(value: unknown): string {
  return value == null ? '' : String(value);
}

function integer(value: unknown): bigint {
  return integerValue(value) ?? 0n;
}

function wireBytes(value: BackendBytes, canonicalEmpty = false): string | null {
  if (value == null && !canonicalEmpty) return null;
  return bytesToBase64(value);
}

function sameBytes(left: BackendBytes, right: BackendBytes): boolean {
  const a = decodeBackendBytes(left);
  const b = decodeBackendBytes(right);
  return a.length === b.length && a.every((byte, index) => byte === b[index]);
}

function sameStrings(left: unknown, right: unknown): boolean {
  const a = Array.isArray(left) ? left.map(text) : [];
  const b = Array.isArray(right) ? right.map(text) : [];
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function verifyMaterial(material: unknown, signature: any, key: PublicKeyV2 | undefined): boolean {
  return Boolean(key) && verifyECDSAHash(sha256Bytes(canonicalJSONStringify(material)), signature, key as PublicKeyV2);
}

function reservation(value: any, withSignature: boolean) {
  return {
    TXID: text(value?.TXID),
    AssignSeq: integer(value?.AssignSeq),
    AssignEventID: text(value?.AssignEventID),
    GuarID: text(value?.GuarID),
    Dependencies: value?.Dependencies == null ? null : value.Dependencies.map(text),
    HardKeys: value?.HardKeys == null ? null : value.HardKeys.map(text),
    SoftKeys: value?.SoftKeys == null ? null : value.SoftKeys.map(text),
    SchemaVersion: Number(value?.SchemaVersion || 0),
    Status: text(value?.Status),
    Signature: withSignature ? ecdsaSignature(value?.Signature) : ecdsaSignature(null)
  };
}

function liabilityCommitment(value: any, withSignature: boolean, canonicalBytes = false) {
  return {
    CommitmentID: text(value?.CommitmentID),
    GroupID: text(value?.GroupID),
    PledgeAddress: text(value?.PledgeAddress),
    TXCerID: text(value?.TXCerID),
    LiabilityDeltaID: text(value?.LiabilityDeltaID),
    Seq: integer(value?.Seq),
    PrevStateRoot: wireBytes(value?.PrevStateRoot, canonicalBytes),
    NextStateRoot: wireBytes(value?.NextStateRoot, canonicalBytes),
    ExposureSharesHash: wireBytes(value?.ExposureSharesHash, canonicalBytes),
    DeltaHash: wireBytes(value?.DeltaHash, canonicalBytes),
    OutstandingBefore: canonicalAmount(value?.OutstandingBefore),
    OutstandingAfter: canonicalAmount(value?.OutstandingAfter),
    IssuerID: text(value?.IssuerID),
    IssuedAt: integer(value?.IssuedAt),
    Signature: withSignature ? ecdsaSignature(value?.Signature) : ecdsaSignature(null)
  };
}

function fastEvidence(value: TXCerFastEvidenceV2, withSignature: boolean, canonicalLiabilityBytes = false) {
  return {
    Version: text(value?.Version),
    RecordID: text(value?.RecordID),
    IssueKey: text(value?.IssueKey),
    TXID: text(value?.TXID),
    OutputIndex: Number(value?.OutputIndex || 0),
    TXCerID: text(value?.TXCerID),
    SourceGroupID: text(value?.SourceGroupID),
    DestinationGroupID: text(value?.DestinationGroupID),
    SourcePledgeAddress: text(value?.SourcePledgeAddress),
    Reservation: reservation(value?.Reservation, true),
    Liability: liabilityCommitment(value?.Liability, true, canonicalLiabilityBytes),
    IssuerID: text(value?.IssuerID),
    IssuedAt: integer(value?.IssuedAt),
    Signature: withSignature ? ecdsaSignature(value?.Signature) : ecdsaSignature(null)
  };
}

function liabilityReceipt(value: FastLiabilityReceiptV2, signatures: 'actual' | 'nil') {
  return {
    ReceiptID: text(value?.ReceiptID),
    GroupID: text(value?.GroupID),
    PledgeAddress: text(value?.PledgeAddress),
    SignerSetID: text(value?.SignerSetID),
    TXCerID: text(value?.TXCerID),
    LiabilityDeltaID: text(value?.LiabilityDeltaID),
    LiabilityDeltaType: text(value?.LiabilityDeltaType),
    Seq: integer(value?.Seq),
    PrevStateRoot: wireBytes(value?.PrevStateRoot),
    NextStateRoot: wireBytes(value?.NextStateRoot),
    ExposureSharesHash: wireBytes(value?.ExposureSharesHash),
    DeltaHash: wireBytes(value?.DeltaHash),
    OutstandingBefore: canonicalAmount(value?.OutstandingBefore),
    OutstandingAfter: canonicalAmount(value?.OutstandingAfter),
    Threshold: Number(value?.Threshold || 0),
    Signers: value?.Signers == null ? null : value.Signers.map(text),
    Timestamp: integer(value?.Timestamp),
    Signatures: signatures === 'nil' ? null : sortRecord(value?.Signatures, ecdsaSignature)
  };
}

function receiptIDMaterial(value: FastLiabilityReceiptV2) {
  const material = liabilityReceipt(value, 'nil');
  material.ReceiptID = '';
  return material;
}

function receiptSignatureMaterial(value: FastLiabilityReceiptV2) {
  return liabilityReceipt(value, 'nil');
}

function ackMaterial(value: TXCerIssuanceAckV2, withSignature: boolean) {
  const material: Record<string, unknown> = {
    recordID: text(value?.recordID ?? value?.RecordID),
    txCerID: text(value?.txCerID ?? value?.TXCerID),
    evidenceHash: wireBytes(value?.evidenceHash ?? value?.EvidenceHash),
    groupID: text(value?.groupID ?? value?.GroupID),
    userID: text(value?.userID ?? value?.UserID),
    status: text(value?.status ?? value?.Status),
    assignNodeID: text(value?.assignNodeID ?? value?.AssignNodeID),
    registeredAt: integer(value?.registeredAt ?? value?.RegisteredAt)
  };
  const errorReason = text(value?.errorReason ?? value?.ErrorReason);
  if (errorReason) material.errorReason = errorReason;
  material.signature = withSignature
    ? ecdsaSignature(value?.signature ?? value?.Signature)
    : ecdsaSignature(null);
  return material;
}

export function computeExposureSharesHashV2(shares: any[] | null | undefined): number[] {
  const ordered = (shares || []).map(exposureShare).sort((left, right) => {
    const leftKey = `${left.RootID}|${left.LeafID}|${left.GroupID}|${left.PledgeAddress}|${parseAmount(left.Amount).toString().padStart(20, '0')}`;
    const rightKey = `${right.RootID}|${right.LeafID}|${right.GroupID}|${right.PledgeAddress}|${parseAmount(right.Amount).toString().padStart(20, '0')}`;
    return leftKey.localeCompare(rightKey);
  });
  return sha256Bytes(canonicalJSONStringify(ordered));
}

export function computeIssuerLiabilityCommitmentIDV2(value: any): string {
  const material = liabilityCommitment(value, false, true);
  material.CommitmentID = '';
  return bytesToHex(sha256Bytes(canonicalJSONStringify({ Domain: ISSUER_LIABILITY_COMMITMENT_DOMAIN, Material: material })));
}

export function computeTXCerFastEvidenceHashV2(value: TXCerFastEvidenceV2): number[] {
  return sha256Bytes(canonicalJSONStringify({
    Domain: TXCER_FAST_EVIDENCE_DOMAIN,
    Material: fastEvidence(value, false, true)
  }));
}

export function computeFastLiabilityReceiptHashV2(value: FastLiabilityReceiptV2): number[] {
  return sha256Bytes(canonicalJSONStringify(liabilityReceipt(value, 'actual')));
}

export function computeFastLiabilityReceiptIDV2(value: FastLiabilityReceiptV2): string {
  return bytesToHex(sha256Bytes(canonicalJSONStringify(receiptIDMaterial(value))));
}

export function verifyFastLiabilityReceipt(value: FastLiabilityReceiptV2, authority: LiabilityAuthorityContext): boolean {
  try {
    if (!value || !text(value.ReceiptID) || authority.threshold <= 0 || Number(value.Threshold) !== authority.threshold) return false;
    if (computeFastLiabilityReceiptIDV2(value) !== value.ReceiptID) return false;
    const members = new Set(authority.members);
    const signers = (value.Signers || []).map((signer: unknown) => text(signer));
    if (new Set(signers).size !== signers.length || signers.some(signer => !members.has(signer))) return false;
    const signatures = value.Signatures || {};
    const signatureIDs = Object.keys(signatures);
    if (signatureIDs.some(signer => !members.has(signer) || !signers.includes(signer))) return false;
    let valid = 0;
    const material = receiptSignatureMaterial(value);
    for (const signer of signatureIDs) {
      const key = authority.publicKeys[signer];
      if (!key || !verifyMaterial(material, signatures[signer], key)) return false;
      valid++;
    }
    return valid >= authority.threshold;
  } catch {
    return false;
  }
}

function verifyIssuerLiabilityCommitment(value: any, key: PublicKeyV2): boolean {
  return Boolean(value?.CommitmentID) &&
    computeIssuerLiabilityCommitmentIDV2(value) === value.CommitmentID &&
    verifyMaterial(liabilityCommitment(value, false, false), value.Signature, key);
}

function buildIssueKey(record: TXCerIssuanceRecordV2): string {
  return `${text(record?.GuarGroupID)}:${text(record?.TXID)}:${Number(record?.OutputIndex || 0)}:${text(record?.ToAddress)}`;
}

function buildRecordID(issueKey: string): string {
  return bytesToHex(sha256Bytes(issueKey));
}

export function verifyTXCerFastEvidence(record: TXCerIssuanceRecordV2, value: TXCerFastEvidenceV2, authority: LiabilityAuthorityContext): boolean {
  try {
    const txCer: any = record?.TXCer;
    const sourceKey = authority.sourceAggregationPublicKey;
    const assignKey = authority.sourceAssignPublicKey;
    if (!txCer || !sourceKey || !assignKey) return false;
    const issueKey = buildIssueKey(record);
    if (!issueKey || record.IssueKey !== issueKey || record.RecordID !== buildRecordID(issueKey)) return false;
    if (!record.TXCerID || txCer.TXCerID !== record.TXCerID || computeTXCerIDV2(txCer) !== record.TXCerID) return false;
    if (record.TXID !== txCer.TXID || record.ToAddress !== txCer.ToAddress) return false;
    if (Number(record.OutputIndex) !== Number(txCer.TxCerPosition?.InIndex) || Number(record.TargetBlock) !== Number(txCer.TxCerPosition?.BlockHeight) || Number(record.GuarTXIndex) !== Number(txCer.TxCerPosition?.Index)) return false;
    if (record.GuarGroupID !== txCer.FromGuarGroupID || value.SourceGroupID !== txCer.FromGuarGroupID || value.DestinationGroupID !== txCer.ToGuarGroupID || value.SourcePledgeAddress !== txCer.SourcePledgeAddress) return false;
    if (txCer.UserSignature?.R != null || txCer.UserSignature?.S != null || txCer.UserSignatureV2?.Signature != null || txCer.SettlementAuth?.TXCerID) return false;
    if (!verifyMaterial(canonicalizeTXCerSourceSignatureMaterialV2(txCer), txCer.GuarGroupSignature, sourceKey)) return false;
    const exposureHash = computeExposureSharesHashV2(txCer.ExposureShares);
    if (!sameBytes(exposureHash, record.ExposureSharesHash)) return false;
    if (value.Version !== TXCER_FAST_EVIDENCE_VERSION || value.RecordID !== record.RecordID || value.IssueKey !== record.IssueKey || value.TXID !== record.TXID || Number(value.OutputIndex) !== Number(record.OutputIndex) || value.TXCerID !== record.TXCerID) return false;
    if (!value.IssuerID || value.IssuerID !== value.Liability?.IssuerID) return false;
    if (!verifyMaterial(fastEvidence(value, false, false), value.Signature, sourceKey)) return false;
    if (!verifyMaterial(reservation(value.Reservation, false), value.Reservation?.Signature, assignKey)) return false;
    const reservationStatus = text(value.Reservation?.Status);
    if (value.Reservation?.TXID !== record.TXID || !['processing', 'pending_confirm'].includes(reservationStatus) || Number(value.Reservation?.SchemaVersion) !== 2 || !value.Reservation?.GuarID || !Array.isArray(value.Reservation?.HardKeys) || value.Reservation.HardKeys.length === 0) return false;
    const liability = value.Liability;
    if (liability?.GroupID !== record.GuarGroupID || liability?.PledgeAddress !== txCer.SourcePledgeAddress || liability?.TXCerID !== record.TXCerID || liability?.LiabilityDeltaID !== record.LiabilityDeltaID || !sameBytes(liability?.ExposureSharesHash, record.ExposureSharesHash)) return false;
    return verifyIssuerLiabilityCommitment(liability, sourceKey);
  } catch {
    return false;
  }
}

export function verifyTXCerIssuanceAck(value: TXCerIssuanceAckV2, evidence: TXCerFastEvidenceV2, key: PublicKeyV2): boolean {
  try {
    const recordID = text(value?.recordID ?? value?.RecordID);
    const txCerID = text(value?.txCerID ?? value?.TXCerID);
    const assignNodeID = text(value?.assignNodeID ?? value?.AssignNodeID);
    if (!recordID || !txCerID || !assignNodeID || recordID !== evidence.RecordID || txCerID !== evidence.TXCerID) return false;
    if (!sameBytes(value?.evidenceHash ?? value?.EvidenceHash, computeTXCerFastEvidenceHashV2(evidence))) return false;
    return verifyMaterial(ackMaterial(value, false), value?.signature ?? value?.Signature, key);
  } catch {
    return false;
  }
}

export function buildTXCerIssueLeafV2(record: TXCerIssuanceRecordV2): number[] {
  if (record.TXCer?.Value === undefined) throw new Error('TXCer value is required');
  const rootIDs = [...(record.RootExposureIDs || [])].map(text).sort();
  const payload = [
    text(record.RecordID), text(record.IssueKey), text(record.TXCerID), text(record.ToAddress),
    parseAmount(record.TXCer?.Value).toString(), text(record.GuarGroupID), Number(record.OutputIndex || 0),
    text(record.CertifierID), bytesToHex(decodeBackendBytes(record.ExposureSharesHash)),
    bytesToHex(decodeBackendBytes(record.LiabilityReceiptHash)), rootIDs.join(',')
  ].join('|');
  return sha256Bytes(payload);
}

function computeMerkleRoot(leaf: number[], steps: any[]): number[] | null {
  let current = [...leaf];
  for (const step of steps || []) {
    const sibling = decodeBackendBytes(step?.Hash);
    if (step?.Side === 'left') current = sha256Bytes([...sibling, ...current]);
    else if (step?.Side === 'right') current = sha256Bytes([...current, ...sibling]);
    else return null;
  }
  return current;
}

export function verifyTXCerIssueProof(record: TXCerIssuanceRecordV2, proof: TXCerIssueProofV2, key: PublicKeyV2): boolean {
  try {
    if (!proof || (record.CertifierID && proof.CertifierID && record.CertifierID !== proof.CertifierID)) return false;
    const leaf = buildTXCerIssueLeafV2(record);
    if (!sameBytes(leaf, proof.LeafHash)) return false;
    const root = computeMerkleRoot(leaf, proof.Steps || []);
    if (!root || !sameBytes(root, proof.MerkleRoot)) return false;
    const batch = {
      BatchID: text(proof.BatchID),
      CertifierID: text(proof.CertifierID),
      Root: wireBytes(proof.MerkleRoot),
      RecordIDs: null,
      Signature: ecdsaSignature(null),
      CreatedAt: 0
    };
    return verifyMaterial(batch, proof.BatchSignature, key);
  } catch {
    return false;
  }
}

export function sameProtocolStringArray(left: unknown, right: unknown): boolean {
  return sameStrings(left, right);
}
