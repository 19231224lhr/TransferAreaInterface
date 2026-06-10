import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function assertIncludes(source, marker, message) {
  assert.ok(source.includes(marker), message || `expected source to include ${marker}`);
}

test('frontend syncs TXCer lifecycle through the new AssignNode endpoints while keeping old changes compatible', () => {
  const api = read('js/config/api.ts');
  const polling = read('js/services/accountPolling.ts');

  for (const marker of [
    'ASSIGN_TXCER_STATUSES',
    'ASSIGN_TXCER_STATUS',
    'ASSIGN_TXCER_STATUS_CHANGE',
    'ASSIGN_SCHEDULER_STATS',
    'ASSIGN_SCHEDULER_DAG_RECORDS',
    'ASSIGN_SCHEDULER_DAG_EVENTS',
    'COM_CHALLENGES'
  ]) {
    assertIncludes(api, marker, `API config is missing ${marker}`);
  }

  assertIncludes(polling, 'ASSIGN_TXCER_CHANGE', 'old txcer-change polling must remain available for compatibility');
  assertIncludes(polling, 'ASSIGN_TXCER_STATUSES', 'polling must load the authoritative lifecycle snapshot');
  assertIncludes(polling, 'ASSIGN_TXCER_STATUS_CHANGE', 'polling must consume lifecycle change events');
  assertIncludes(polling, "addEventListener('txcer_status_change'", 'SSE must listen for lifecycle status changes');
  assertIncludes(polling, 'applyTXCerStatus', 'lifecycle updates must be written into the local status cache');
  assertIncludes(polling, 'markTXCerActive', 'newly received TXCer records must be marked Active locally');
});

test('frontend full send flow treats only authoritative Active TXCers as spendable', () => {
  const txCerStatus = read('js/services/txCerStatus.ts');
  const txBuilder = read('js/services/txBuilder.ts');
  const transfer = read('js/services/transfer.ts');

  assertIncludes(
    txCerStatus,
    "proofStatus !== 'invalid'",
    'spendable helper must reject TXCers with explicitly invalid CFAA proofs'
  );
  assertIncludes(
    txCerStatus,
    'TXCER_TERMINAL_STATUSES.includes(view.status)',
    'terminal lifecycle states must remove TXCer from spendable stores'
  );
  assertIncludes(
    txBuilder,
    'isTXCerSpendable(user, txCerId)',
    'transaction builder must filter TXCers through lifecycle availability'
  );
  assertIncludes(
    transfer,
    'isTXCerSpendable(user, id)',
    'transfer locking must only lock TXCers that are authoritative Active'
  );
  assertIncludes(
    transfer,
    'sumSpendableTXCerValue(txCerStatusUser',
    'automatic source selection must calculate TXCer balance through lifecycle state'
  );
});

test('frontend wallet and send balances use lifecycle spendable TXCer value instead of raw local txCers', () => {
  const wallet = read('js/services/wallet.ts');
  const send = read('js/services/transfer.ts');

  assertIncludes(wallet, 'sumSpendableTXCerValue(u, txCers)', 'wallet balance must calculate available TXCer value from lifecycle cache');
  assertIncludes(wallet, 'getTXCerStatus(u, id)', 'wallet TXCer list must expose lifecycle state');
  assertIncludes(send, 'sumSpendableTXCerValue(txCerStatusUser', 'send source selection must ignore non-Active TXCers');
});

test('frontend startup cleanup preserves CFAA issuance metadata for audit history', () => {
  const storage = read('js/utils/storage.ts');

  assertIncludes(storage, 'CFAA issuance metadata is retained', 'storage comment should document retained issuance metadata');
  assert.ok(!/user\.wallet\.txCerIssuanceRecords\s*=\s*\{\s*\}/.test(storage), 'startup cleanup must not delete issuance metadata');
  assertIncludes(storage, 'user.wallet.totalTXCers = {};', 'startup cleanup should still clear spendable TXCer cache');
  assertIncludes(storage, 'user.wallet.txCerStatuses = {};', 'startup cleanup should still resync lifecycle status from backend');
});

test('frontend exposes backend protocol diagnostics and certifier node query helpers', () => {
  const api = read('js/config/api.ts');
  const blockchain = read('js/types/blockchain.ts');
  const issuance = read('js/services/txCerIssuance.ts');
  const diagnostics = read('js/services/protocolDiagnostics.ts');

  for (const marker of [
    'COMMITTEE_QC_STATUS',
    'COMMITTEE_QC_PROPOSALS',
    'COMMITTEE_QC_QCS',
    'COMMITTEE_QC_FINALIZED_BLOCK',
    'AGGR_CERTIFIER_STATS',
    'AGGR_CERTIFIER_PENDING_REQUESTS',
    'ASSIGN_AUDIT_EVENTS',
    'AGGR_AUDIT_EVENTS',
    'ASSIGN_CHALLENGES',
    'AGGR_CHALLENGES',
    'ASSIGN_PENALTIES'
  ]) {
    assertIncludes(api, marker, `API config is missing ${marker}`);
  }

  for (const marker of [
    'export interface TxTaskDAGEvent',
    'export interface TxTaskDAGRecord',
    'export interface SchedulerStatsResponse',
    'export interface CertifierIssueBatchRequest',
    'export interface CommitteeQCStatus',
    'export interface CommitteeQC'
  ]) {
    assertIncludes(blockchain, marker, `blockchain types are missing ${marker}`);
  }

  for (const marker of ['fetchAggrCertifierStats', 'fetchAggrCertifierPendingRequests']) {
    assertIncludes(issuance, marker, `TXCer issuance service is missing ${marker}`);
  }

  for (const marker of [
    'fetchAssignSchedulerStats',
    'fetchCommitteeQCStatus',
    'fetchCommitteeQCProposals',
    'fetchCommitteeQCs',
    'fetchCommitteeQCFinalizedBlock',
    'fetchAssignSchedulerDAGRecords',
    'fetchAssignSchedulerDAGEvents',
    'fetchAssignAuditEvents',
    'fetchAggrAuditEvents',
    'fetchAssignChallenges',
    'fetchAggrChallenges',
    'fetchComChallenges',
    'fetchAssignPenalties'
  ]) {
    assertIncludes(diagnostics, marker, `protocol diagnostics service is missing ${marker}`);
  }
});

test('frontend TXCer spending attaches SettlementAuth before transaction signing and TXID calculation', () => {
  const blockchain = read('js/types/blockchain.ts');
  const signature = read('js/utils/signature.ts');
  const settlementAuth = read('js/services/settlementAuth.ts');
  const txHash = read('js/services/txHash.ts');
  const txBuilder = read('js/services/txBuilder.ts');

  for (const marker of ['export interface SettlementAuth', 'SourcePledgeAddress', 'SettlementAuth?: SettlementAuth']) {
    assertIncludes(blockchain, marker, `blockchain types are missing ${marker}`);
  }
  assertIncludes(signature, "'ConsumeIntentHash'", 'ConsumeIntentHash must serialize as Go []byte/base64');

  for (const marker of [
    'zeroSettlementAuth',
    'getSettlementIntentHash',
    'buildSettlementAuth',
    'attachSettlementAuths',
    'SettlementAuth: buildSettlementAuth'
  ]) {
    assertIncludes(settlementAuth, marker, `settlementAuth helper module is missing ${marker}`);
  }
  assertIncludes(
    txHash,
    "obj.UserSignatureV2 = { Algorithm: '', Signature: null }",
    'TXID hashing must exclude transaction UserSignatureV2'
  );
  assertIncludes(
    txHash,
    'TXInputsNormal: filteredInputs',
    'TXID hashing must mirror Go GetTXHash canonical empty-slice behavior'
  );

  const attachIndex = txBuilder.indexOf('attachSettlementAuths(transaction, accountPrivKey);');
  const signIndex = txBuilder.indexOf('transaction.UserSignatureV2 = signHashEnvelope', attachIndex);
  const txidIndex = txBuilder.indexOf('transaction.TXID = calculateTXID(transaction)', signIndex);
  assert.ok(attachIndex >= 0, 'transaction must attach SettlementAuths');
  assert.ok(signIndex > attachIndex, 'transaction UserSignatureV2 must be signed after SettlementAuth is attached');
  assert.ok(txidIndex > signIndex, 'TXID must be calculated after transaction UserSignatureV2 is signed');
});
