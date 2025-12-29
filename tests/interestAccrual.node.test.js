import test from 'node:test';
import assert from 'node:assert/strict';

import {
  accrueWalletInterest,
  normalizeInterestFields,
  DEFAULT_INTEREST_RATE
} from '../js/utils/interestAccrual.js';

import { applyComNodeInterests } from '../js/utils/interestSync.js';

test('normalizeInterestFields mirrors gas <-> estInterest', () => {
  const meta1 = { gas: 10 };
  normalizeInterestFields(meta1);
  assert.equal(meta1.EstInterest, 10);
  assert.equal(meta1.estInterest, 10);

  const meta2 = { estInterest: 7.5 };
  normalizeInterestFields(meta2);
  assert.equal(meta2.EstInterest, 7.5);
  assert.equal(meta2.gas, 7.5);

  const meta3 = { EstInterest: 15.5 };
  normalizeInterestFields(meta3);
  assert.equal(meta3.estInterest, 15.5);
  assert.equal(meta3.gas, 15.5);
});

test('normalizeInterestFields prefers EstInterest (regression: prevents +2 drift)', () => {
  const meta = { EstInterest: 15.5, gas: 17.5, estInterest: 17.5 };
  normalizeInterestFields(meta);
  assert.equal(meta.EstInterest, 15.5);
  assert.equal(meta.estInterest, 15.5);
  assert.equal(meta.gas, 15.5);
});

test('accrueWalletInterest updates estInterest AND gas (stale gas bug)', () => {
  const wallet = {
    updateBlock: 100,
    addressMsg: {
      // Legacy data: UI previously read `gas` first, making it easy to go stale
      addr1: {
        type: 0,
        gas: 10,
        value: { utxoValue: 100 }
      }
    }
  };

  const deltaBlocks = 10;
  const { changed, totalInc } = accrueWalletInterest(wallet, deltaBlocks, DEFAULT_INTEREST_RATE);

  // Interest formula: 100 * 0.05 * 1 * 10 = 50
  assert.equal(changed, true);
  assert.equal(totalInc, 50);
  assert.equal(wallet.addressMsg.addr1.EstInterest, 60);
  assert.equal(wallet.addressMsg.addr1.estInterest, 60);
  assert.equal(wallet.addressMsg.addr1.gas, 60);
});

test('applyComNodeInterests refreshes canonical GAS after tx (10 -> 13)', () => {
  const wallet = {
    addressMsg: {
      b0b43b638f4bcc0fb941fca7e7b26d15612eb64d: {
        type: 0,
        gas: 10,
        value: { utxoValue: 90 }
      }
    }
  };

  const { changed, updated } = applyComNodeInterests(wallet, [
    { address: 'b0b43b638f4bcc0fb941fca7e7b26d15612eb64d', interest: 13, lastHeight: 123 }
  ]);

  assert.equal(updated, 1);
  assert.equal(changed, true);
  const meta = wallet.addressMsg.b0b43b638f4bcc0fb941fca7e7b26d15612eb64d;
  assert.equal(meta.EstInterest, 13);
  assert.equal(meta.estInterest, 13);
  assert.equal(meta.gas, 13);
  assert.equal(meta.LastHeight, 123);
});
