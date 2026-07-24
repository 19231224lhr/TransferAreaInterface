import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('cross-organization TXCer polling is non-destructive and account-scoped', () => {
  const source = fs.readFileSync('js/services/accountPolling.ts', 'utf8');
  const start = source.indexOf('async function pollCrossOrgTXCers');
  const end = source.indexOf('function processTXCerToUser', start);
  const poll = source.slice(start, end);
  assert.match(poll, /consume=false/);
  assert.doesNotMatch(poll, /consume=true/);
  assert.match(poll, /const requestAccountId = user\.accountId/);
  assert.match(poll, /mutateUser\(requestAccountId/);
});

test('retail GQNC address registration carries no legacy Sig', () => {
  const source = fs.readFileSync('js/services/address.ts', 'utf8');
  const start = source.indexOf('export async function registerAddressOnComNode');
  const end = source.indexOf('export async function registerAddressesOnMainEntry', start);
  const registration = source.slice(start, end);
  assert.match(registration, /buildRetailAddressRegistrationRequest/);
  assert.doesNotMatch(registration, /requestBody\.Sig\s*=/);
});

test('address registration and evidence refresh patch the latest account atomically', () => {
  const address = fs.readFileSync('js/services/address.ts', 'utf8');
  const polling = fs.readFileSync('js/services/accountPolling.ts', 'utf8');
  assert.match(address, /await mutateUser\(user\.accountId/);
  assert.doesNotMatch(address, /latestUser\.wallet\s*=\s*user\.wallet/);
  const evidenceStart = polling.indexOf('function scheduleTXCerEvidenceRefresh');
  const evidenceEnd = polling.indexOf('function schedulePendingTXCerEvidenceRefreshes', evidenceStart);
  assert.match(polling.slice(evidenceStart, evidenceEnd), /await mutateUser\(accountID/);
});

test('evidence refresh uses the joined organization endpoint instead of the global API base', () => {
  const polling = fs.readFileSync('js/services/accountPolling.ts', 'utf8');
  const issuance = fs.readFileSync('js/services/txCerIssuance.ts', 'utf8');
  const evidenceStart = polling.indexOf('function scheduleTXCerEvidenceRefresh');
  const evidenceEnd = polling.indexOf('function schedulePendingTXCerEvidenceRefreshes', evidenceStart);
  const evidenceRefresh = polling.slice(evidenceStart, evidenceEnd);
  assert.match(evidenceRefresh, /getJoinedGroup\(\)/);
  assert.match(evidenceRefresh, /refreshTXCerIssuanceMetadata\([\s\S]*authorityBaseUrl/);
  assert.match(issuance, /function buildAuthorityUrl/);
  assert.match(issuance, /authorityBaseUrl\?: string/);
  assert.match(issuance, /fetchTXCerIssuanceRecord\([\s\S]*authorityBaseUrl/);
  assert.match(issuance, /resolveTXCerAuthoritySnapshot\([\s\S]*authorityBaseUrl/);
});

test('a transfer may spend TXCers protected by its own draft lock only', () => {
  const transfer = fs.readFileSync('js/services/transfer.ts', 'utf8');
  const builder = fs.readFileSync('js/services/txBuilder.ts', 'utf8');
  const status = fs.readFileSync('js/services/txCerStatus.ts', 'utf8');
  const locks = fs.readFileSync('js/services/txCerLockManager.ts', 'utf8');

  assert.match(transfer, /const txCerLockOwner = `draft:/);
  assert.match(transfer, /lockTXCers\(\s*txCerIds,[\s\S]*txCerLockOwner[\s,]*\)/);
  assert.match(transfer, /buildTransactionFromLegacy\(build,\s*user,\s*txCerLockOwner\)/);
  assert.match(builder, /isTXCerSpendable\(user,\s*txCerId,\s*txCerLockOwner\)/);
  assert.match(status, /isTXCerSpendable\([\s\S]*allowedDraftLockOwner/);
  assert.match(locks, /lock\.mode === 'draft'[\s\S]*lock\.relatedTXID === allowedDraftLockOwner/);
});
