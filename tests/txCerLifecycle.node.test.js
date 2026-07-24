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

test('frontend full send flow keeps CFAA asynchronous and quarantines failed fast evidence', () => {
  const txCerStatus = read('js/services/txCerStatus.ts');
  const txBuilder = read('js/services/txBuilder.ts');
  const transfer = read('js/services/transfer.ts');

  assertIncludes(
    txCerStatus,
    "metadata?.security?.fastEvidenceStatus === 'Failed'",
    'spendable helper must quarantine TXCers whose fast evidence failed verification'
  );
  assertIncludes(
    txCerStatus,
    "!metadata?.security && metadata?.proofStatus === 'invalid'",
    'legacy caches without the independent security model must remain fail closed'
  );
  assert.ok(
    !/cfaaAuditStatus\s*===\s*['\"]Failed['\"]/.test(txCerStatus),
    'asynchronous CFAA audit status must not gate fast TXCer spendability'
  );
  assertIncludes(
    txCerStatus,
    'TXCER_TERMINAL_STATUSES.includes(view.status)',
    'terminal lifecycle states must remove TXCer from spendable stores'
  );
  assertIncludes(
    txBuilder,
    'isTXCerSpendable(user, txCerId, txCerLockOwner)',
    'transaction builder must filter TXCers through lifecycle availability while honoring its own draft lock'
  );
  assertIncludes(
    transfer,
    'isTXCerSpendable(user, id)',
    'transfer locking must only lock TXCers that are authoritative Active'
  );
  assertIncludes(
    transfer,
    'sumSpendableTXCerUnits(user, meta.txCers',
    'automatic source selection must calculate TXCer balance through lifecycle state'
  );
});

test('frontend wallet and send balances use lifecycle spendable TXCer value instead of raw local txCers', () => {
  const wallet = read('js/services/wallet.ts');
  const send = read('js/services/transfer.ts');

  assertIncludes(wallet, 'sumSpendableTXCerUnits(u, txCers)', 'wallet balance must calculate exact available TXCer units from lifecycle cache');
  assertIncludes(wallet, 'getTXCerStatus(u, id)', 'wallet TXCer list must expose lifecycle state');
  assertIncludes(send, 'sumSpendableTXCerUnits(user, meta.txCers', 'send source selection must ignore non-Active TXCers without losing amount precision');
});

test('frontend TXCer details expose exact identity and independent safety states', () => {
  const wallet = read('js/services/wallet.ts');
  for (const marker of ['txcer-full-id', 'FastEvidence', 'CFAA', 'ExposureShares']) {
    assertIncludes(wallet, marker, `wallet TXCer details are missing ${marker}`);
  }
});

test('frontend persists a unified TXCer client record with lifecycle and complete evidence', () => {
  const blockchain = read('js/types/blockchain.ts');
  const issuance = read('js/services/txCerIssuance.ts');
  assertIncludes(blockchain, 'export interface TXCerClientRecord', 'client record type is missing');
  for (const marker of ['txCer?: TxCertificate', 'lifecycleStatus?:', 'authoritySnapshot?: TXCerAuthoritySnapshot']) {
    assertIncludes(blockchain, marker, `TXCer client record is missing ${marker}`);
  }
  assertIncludes(issuance, 'txCer: protocolRecord.TXCer', 'issuance metadata must preserve the complete TXCer');
  assertIncludes(issuance, 'lifecycleStatus', 'issuance metadata must preserve the Assign lifecycle state');
});

test('frontend startup preserves complete TXCer evidence and marks cached verification for replay', () => {
  const storage = read('js/utils/storage.ts');

  assertIncludes(storage, 'markTXCerEvidenceForReverification', 'startup must invalidate cached verification results');
  assert.ok(!/user\.wallet\.txCerIssuanceRecords\s*=\s*\{\s*\}/.test(storage), 'startup cleanup must not delete issuance metadata');
  assert.ok(!/user\.wallet\.totalTXCers\s*=\s*\{\s*\}/.test(storage), 'startup must preserve complete TXCer objects');
  assert.ok(!/user\.wallet\.txCerStatuses\s*=\s*\{\s*\}/.test(storage), 'startup must preserve lifecycle cache until authoritative refresh');
});

test('frontend restart verification never promotes cached evidence when authority fetch is blocked', () => {
  const issuance = read('js/services/txCerIssuance.ts');
  const refresh = issuance.slice(
    issuance.indexOf('export async function refreshTXCerIssuanceMetadata'),
    issuance.indexOf('export async function refreshTXCerIssuanceMetadata') + 3500,
  );
  assert.doesNotMatch(refresh, /catch\s*\{\s*detail\s*=\s*current/);
  assert.match(refresh, /authority replay unavailable/);
  assert.match(refresh, /fastEvidenceStatus:[^\n]*['"]Failed['"][^\n]*['"]Pending['"]/);
});

test('frontend cross-org TXCer delivery keeps polling while account SSE is active', () => {
  const polling = read('js/services/accountPolling.ts');
  const pollCrossOrg = polling.slice(
    polling.indexOf('async function pollCrossOrgTXCers'),
    polling.indexOf('function stopCrossOrgTXCerPolling'),
  );
  const startCrossOrg = polling.slice(
    polling.indexOf('export function startCrossOrgTXCerPolling'),
    polling.indexOf('export function stopCrossOrgTXCerPolling'),
  );

  assert.doesNotMatch(
    pollCrossOrg,
    /if\s*\(!force\s*&&\s*isSSEActive\(\)\)/,
    'generic account SSE cannot suppress retries for the independent cross-org TXCer queue',
  );
  assert.match(startCrossOrg, /pollCrossOrgTXCers\(true\)/);
  assert.match(startCrossOrg, /setInterval\(pollCrossOrgTXCers,/);
});

test('frontend removes obsolete AreaQC endpoints while retaining current issuance helpers', () => {
  const api = read('js/config/api.ts');
  const blockchain = read('js/types/blockchain.ts');
  const issuance = read('js/services/txCerIssuance.ts');
  const diagnostics = read('js/services/protocolDiagnostics.ts');

  for (const marker of ['COMMITTEE_QC_', 'AGGR_TXCER:', 'COM_UTXO_CHANGE']) {
    assert.ok(!api.includes(marker), `obsolete API constant remains: ${marker}`);
  }
  for (const marker of [
    'AGGR_TXCER_ISSUANCE_RECORDS',
    'AGGR_TXCER_ISSUANCE_RECORD',
    'AGGR_TXCER_ISSUANCE_BATCH',
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

  for (const marker of ['export interface CommitteeQCStatus', 'export interface CommitteeQC']) {
    assert.ok(!blockchain.includes(marker), `obsolete AreaQC type remains: ${marker}`);
  }
  for (const marker of [
    'export interface TxTaskDAGEvent',
    'export interface TxTaskDAGRecord',
    'export interface SchedulerStatsResponse',
    'export interface CertifierIssueBatchRequest'
  ]) {
    assertIncludes(blockchain, marker, `blockchain types are missing ${marker}`);
  }

  for (const marker of ['fetchAggrCertifierStats', 'fetchAggrCertifierPendingRequests']) {
    assertIncludes(issuance, marker, `TXCer issuance service is missing ${marker}`);
  }

  for (const marker of ['fetchCommitteeQCStatus', 'fetchCommitteeQCProposals', 'fetchCommitteeQCs', 'fetchCommitteeQCFinalizedBlock']) {
    assert.ok(!diagnostics.includes(marker), `obsolete AreaQC diagnostic remains: ${marker}`);
  }
  for (const marker of [
    'fetchAssignSchedulerStats',
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
    'computeTransactionHashV2(tx)',
    'TXID hashing must use the protocol-v2 canonical material'
  );
  assertIncludes(
    txHash,
    'computeTransactionIDV2(tx)',
    'TXID must use the full protocol-v2 SHA-256 identifier'
  );

  const attachIndex = txBuilder.indexOf('attachSettlementAuths(transaction, accountPrivKey);');
  const signIndex = txBuilder.indexOf('transaction.UserSignatureV2 = signHashEnvelope', attachIndex);
  const txidIndex = txBuilder.indexOf('transaction.TXID = calculateTXID(transaction)', signIndex);
  assert.ok(attachIndex >= 0, 'transaction must attach SettlementAuths');
  assert.ok(signIndex > attachIndex, 'transaction UserSignatureV2 must be signed after SettlementAuth is attached');
  assert.ok(txidIndex > signIndex, 'TXID must be calculated after transaction UserSignatureV2 is signed');
});
