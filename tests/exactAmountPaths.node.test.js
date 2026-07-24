import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function findInputTag(source, marker) {
  return source.match(new RegExp(`<input\\b[^>]*${marker}[^>]*>`, 's'))?.[0] || '';
}

test('web transfer and TXCer caches keep protocol amounts exact', () => {
  const transfer = read('js/services/transfer.ts');
  const storage = read('js/utils/storage.ts');
  const blockchain = read('js/types/blockchain.ts');
  const polling = read('js/services/accountPolling.ts');
  const history = read('js/pages/history.js');
  const utxoLock = read('js/utils/utxoLock.ts');

  assert.match(transfer, /Value:\s*AmountDecimal/);
  assert.match(transfer, /ToInterest:\s*AmountDecimal/);
  assert.doesNotMatch(transfer, /Number\(valEl\?\.value/);
  assert.doesNotMatch(transfer, /existingBill\.Value\s*\+=/);
  assert.doesNotMatch(transfer, /1e-8/);
  assert.doesNotMatch(transfer, /const value = Number\(utxoData\?\.Value/);
  assert.match(utxoLock, /value:\s*AmountDecimal/);
  assert.match(utxoLock, /value:\s*formatAmount\(parseAmount\(utxo\.value\)\)/);
  assert.match(storage, /txCers:\s*Record<string,\s*AmountDecimal>/);
  assert.match(blockchain, /value:\s*ProtocolAmount/);
  assert.doesNotMatch(polling, /txCers\[txCerId\]\s*=\s*toAmountNumber\(TXCer\.Value\)/);
  assert.doesNotMatch(polling, /markTXCerActive\([^\n]*toAmountNumber\(TXCer\.Value\)/);
  assert.doesNotMatch(polling, /markTXCerActive\([^\n]*toAmountNumber\(/);
  assert.match(history, /formatAmount\(parseAmount\(tx\.amount\)\)/);
  assert.doesNotMatch(history, /tx\.amount\.toLocaleString\(\)/);
});

test('web wallet persistence and polling never aggregate protocol amounts as number', () => {
  const storage = read('js/utils/storage.ts');
  const polling = read('js/services/accountPolling.ts');
  const wallet = read('js/services/wallet.ts');

  assert.match(storage, /interface AddressValue[\s\S]*totalValue:\s*AmountDecimal[\s\S]*utxoValue:\s*AmountDecimal[\s\S]*txCerValue:\s*AmountDecimal/);
  assert.match(storage, /interface Wallet[\s\S]*totalValue:\s*AmountDecimal[\s\S]*valueDivision:\s*Record<number,\s*AmountDecimal>/);
  const normalizeAddressValue = storage.match(/function normalizeAddressValue[\s\S]*?\n}\n\nfunction normalizeTXCerAmountMap/)?.[0] || '';
  assert.doesNotMatch(normalizeAddressValue, /Number\(/);
  assert.doesNotMatch(storage, /normalized\.wallet\.totalValue\s*=\s*Number\(/);

  const recalcAddress = polling.match(/function recalculateAddressBalance[\s\S]*?\n}\n/)?.[0] || '';
  const recalcTotal = polling.match(/function recalculateTotalBalance[\s\S]*?\n}\n/)?.[0] || '';
  assert.match(recalcAddress, /parseAmount\(/);
  assert.match(recalcAddress, /formatAmount\(/);
  assert.doesNotMatch(recalcAddress, /toAmountNumber\(/);
  assert.match(recalcTotal, /parseAmount\(/);
  assert.match(recalcTotal, /formatAmount\(/);
  assert.doesNotMatch(recalcTotal, /toAmountNumber\(/);

  const totalsStart = wallet.indexOf('function getAvailableTotals');
  const availableTotals = wallet.slice(totalsStart, wallet.indexOf('// ============================================================================', totalsStart));
  assert.match(availableTotals, /parseAmount\(/);
  assert.match(availableTotals, /bigint/);
  assert.doesNotMatch(availableTotals, /Number\([^\n]*(raw|\.Value|\.value|balance|txCer)|parseFloat\(|\.toFixed\(/i);
});

test('web monetary inputs preserve decimal text for exact bigint parsing', () => {
  const recipient = read('js/services/recipient.js');
  const walletTemplate = read('assets/templates/pages/wallet.html');
  const tags = [
    findInputTag(recipient, 'name="recipient_val"'),
    findInputTag(recipient, 'name="recipient_gas"'),
    findInputTag(walletTemplate, 'id="extraGasPGC"'),
    findInputTag(walletTemplate, 'id="txGasInput"'),
  ];

  for (const tag of tags) {
    assert.ok(tag, 'expected monetary input to exist');
    assert.match(tag, /type="text"/);
    assert.match(tag, /inputmode="decimal"/);
    assert.doesNotMatch(tag, /type="number"/);
  }
});

test('web shell exposes readable modal labels and an explicit docs back action', () => {
  const index = read('index.html').replace(/<!--[\s\S]*?-->/g, '');
  const docsTemplate = read('assets/templates/pages/docs.html');
  const docsPage = read('js/pages/docs.ts');

  assert.doesNotMatch(index, /\?{2,}|鍙栨秷|鎿嶄綔|宸插畬|浜ゆ槗|杩欎釜/);
  assert.match(index, /id="txDetailClose"[^>]*aria-label="关闭"/);
  assert.match(index, /id="confirmGasCancel"[^>]*>取消<\/button>/);
  assert.match(index, /id="confirmGasOk"[^>]*>确认<\/button>/);

  assert.match(docsTemplate, /id="docsBackBtn"/);
  assert.doesNotMatch(docsTemplate, /\bonclick=/);
  assert.match(docsPage, /docsBackBtn/);
  assert.match(docsPage, /history\.length/);
  assert.match(docsPage, /#\/welcome/);
});

test('web preserves absolute Assign and Aggregation endpoints', () => {
  const group = read('js/services/group.ts');
  const assign = group.slice(group.indexOf('export function buildAssignNodeUrl'), group.indexOf('export function buildAggrNodeUrl'));
  const aggr = group.slice(group.indexOf('export function buildAggrNodeUrl'), group.indexOf('/**\n * Join', group.indexOf('export function buildAggrNodeUrl')));
  for (const source of [assign, aggr]) {
    assert.match(source, /\^https\?:\\\/\\\//);
    assert.ok(source.includes("return raw.replace(/\\/+$/, '');"));
  }
});
