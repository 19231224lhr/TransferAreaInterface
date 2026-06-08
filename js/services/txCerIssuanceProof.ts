import { sha256 } from 'js-sha256';
import type {
  EcdsaSignature,
  PublicKeyNew,
  TXCerIssueProof,
  TXCerIssueProofStep,
  TXCerIssuanceDetailView,
  TXCerProofVerificationStatus
} from '../types/blockchain';
import {
  bigIntToHex,
  bytesToHex,
  decodeBackendBytes,
  verifyStruct
} from '../utils/signature';

export interface TXCerIssueProofVerificationResult {
  status: TXCerProofVerificationStatus;
  error?: string;
}

export function buildTXCerIssueKey(groupID: string, txID: string, outputIndex: number, toAddress: string): string {
  return `${groupID}:${txID}:${outputIndex}:${toAddress}`;
}

export function buildTXCerIssuanceRecordID(issueKey: string): string {
  return bytesToHex(sha256.array(issueKey));
}

export function buildTXCerIssueLeaf(record: TXCerIssuanceDetailView): number[] {
  const normalized = normalizeIssuanceRecord(record);
  const payload = [
    normalized.recordID,
    normalized.issueKey,
    normalized.txCerID,
    normalized.toAddress,
    normalized.value.toFixed(12),
    normalized.guarGroupID,
    String(normalized.outputIndex),
    normalized.certifierID
  ].join('|');
  return sha256.array(payload);
}

export function computeDirectionalMerkleRoot(leaf: ArrayLike<number>, steps: TXCerIssueProofStep[] = []): number[] {
  let current = Array.from(leaf);
  for (const step of steps) {
    const hash = decodeBackendBytes(step.Hash);
    if (step.Side === 'left') {
      current = sha256.array([...hash, ...current]);
    } else if (step.Side === 'right') {
      current = sha256.array([...current, ...hash]);
    } else {
      return [];
    }
  }
  return current;
}

export function verifyTXCerIssueProof(
  record: TXCerIssuanceDetailView,
  proof: TXCerIssueProof | undefined | null,
  certifierPublicKey: PublicKeyNew | undefined | null
): boolean {
  return evaluateTXCerIssueProof(record, proof, certifierPublicKey).status === 'verified';
}

export function evaluateTXCerIssueProof(
  record: TXCerIssuanceDetailView,
  proof: TXCerIssueProof | undefined | null,
  certifierPublicKey: PublicKeyNew | undefined | null
): TXCerIssueProofVerificationResult {
  try {
    if (!proof) {
      return { status: 'missingProof', error: 'missing proof' };
    }
    if (!certifierPublicKey) {
      return { status: 'unsupported', error: 'missing certifier public key' };
    }
    const recordCertifierID = normalizedCertifierID(record);
    if (recordCertifierID && proof.CertifierID && recordCertifierID !== proof.CertifierID) {
      return { status: 'invalid', error: 'certifier mismatch' };
    }
    const leaf = buildTXCerIssueLeaf(record);
    const proofLeaf = decodeBackendBytes(proof.LeafHash);
    if (!bytesEqual(leaf, proofLeaf)) {
      return { status: 'invalid', error: 'leaf mismatch' };
    }
    const root = computeDirectionalMerkleRoot(leaf, proof.Steps || []);
    const proofRoot = decodeBackendBytes(proof.MerkleRoot);
    if (!bytesEqual(root, proofRoot)) {
      return { status: 'invalid', error: 'root mismatch' };
    }
    const signature = proof.BatchSignature || { R: null, S: null };
    const batch = {
      BatchID: proof.BatchID || '',
      CertifierID: proof.CertifierID || recordCertifierID,
      Root: root,
      Signature: signature
    };
    const publicKeyHex = publicKeyToHexPair(certifierPublicKey);
    const ok = verifyStruct(
      batch,
      signature as EcdsaSignature,
      publicKeyHex.x,
      publicKeyHex.y,
      ['Signature', 'RecordIDs', 'CreatedAt']
    );
    return ok ? { status: 'verified' } : { status: 'invalid', error: 'signature invalid' };
  } catch (error) {
    return {
      status: 'invalid',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function normalizeIssuanceRecord(record: TXCerIssuanceDetailView) {
  const source = record as Record<string, unknown>;
  const issueKey = stringField(source, 'issueKey', 'IssueKey');
  const parsed = parseIssueKey(issueKey);
  return {
    recordID: stringField(source, 'recordID', 'RecordID'),
    issueKey,
    txCerID: stringField(source, 'txCerID', 'TXCerID'),
    toAddress: stringField(source, 'toAddress', 'ToAddress'),
    value: numberField(source, 'value', 'Value'),
    guarGroupID: stringField(source, 'guarGroupID', 'GuarGroupID') || parsed.groupID,
    outputIndex: numberField(source, 'outputIndex', 'OutputIndex', parsed.outputIndex),
    certifierID: normalizedCertifierID(record)
  };
}

function normalizedCertifierID(record: TXCerIssuanceDetailView): string {
  return stringField(record as Record<string, unknown>, 'certifierID', 'CertifierID');
}

function parseIssueKey(issueKey: string): { groupID: string; outputIndex: number } {
  const parts = String(issueKey || '').split(':');
  return {
    groupID: parts[0] || '',
    outputIndex: Number(parts[2] || 0)
  };
}

function stringField(record: Record<string, unknown>, lower: string, upper: string): string {
  return String(record[lower] ?? record[upper] ?? '');
}

function numberField(record: Record<string, unknown>, lower: string, upper: string, fallback = 0): number {
  const value = record[lower] ?? record[upper] ?? fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function publicKeyToHexPair(publicKey: PublicKeyNew): { x: string; y: string } {
  const x = (publicKey.X ?? (publicKey as any).x ?? '').toString();
  const y = (publicKey.Y ?? (publicKey as any).y ?? '').toString();
  return {
    x: bigIntToHex(x),
    y: bigIntToHex(y)
  };
}

function bytesEqual(left: ArrayLike<number>, right: ArrayLike<number>): boolean {
  const a = Array.from(left);
  const b = Array.from(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
