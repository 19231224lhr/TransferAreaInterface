import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(testDir, '..', 'scripts', 'check-real-browser-flow.js'), 'utf8');

test('real browser flow returns a wire-derived transaction summary instead of a BigInt-bearing transaction object', () => {
  assert.match(source, /const wire = txBuilder\.serializeUserNewTX\(built\);/);
  assert.match(source, /const wireTX = JSON\.parse\(wire\)\.TX;/);
  assert.doesNotMatch(source, /JSON\.parse\(JSON\.stringify\(\{ tx: built\.TX, reply \}\)\)/);
});

test('real browser flow rejects an unavailable discovered committee endpoint before account lookup', () => {
  assert.match(source, /\/api\/v1\/com\/health/);
  assert.match(source, /node discovery is not ready/i);
});

test('real browser flow pins its local test API endpoint before runtime-config loads', () => {
  assert.match(source, /Object\.defineProperty\(window, '__PANGU_RUNTIME__'/);
  assert.match(source, /Object\.defineProperty\(window, '__API_BASE_URL__'/);
  assert.match(source, /devApiBaseUrl: apiBase/);
  assert.match(source, /prodApiBaseUrl: apiBase/);
});

test('real browser flow flushes the production wallet persistence before force-closing Edge', () => {
  assert.match(source, /async function flushBrowserWalletPersistence/);
  assert.match(source, /persistence\.flushUserPersistence\(\)/);
  assert.match(source, /await flushBrowserWalletPersistence\(page, fixture\.bob\.accountID\);/);
});

test('real browser flow requests a graceful CDP browser close before its force-kill fallback', () => {
  assert.match(source, /async function closeEdgeGracefully/);
  assert.match(source, /browser\.send\('Browser\.close'\)/);
  assert.match(source, /await closeEdgeGracefully\(\);/);
});
