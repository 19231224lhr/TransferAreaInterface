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
    'ASSIGN_TXCER_STATUS_CHANGE'
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
    "getTXCerStatus(user, txCerID) === 'Active' && !isTXCerLocked(txCerID)",
    'spendable helper must require backend Active status plus local construction lock'
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
