import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import elliptic from 'elliptic';

const { ec: EC } = elliptic;

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendRoot = path.resolve(process.env.UTXO_AREA_REPO || path.join(webRoot, '..', 'UTXO-Area'));
const goldenPath = path.join(backendRoot, 'core', 'testdata', 'protocol-v2-golden.json');
const outputPath = path.join(backendRoot, 'core', 'testdata', 'protocol-v2-client-signature.json');
const checkOnly = process.argv.includes('--check');

const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));
const vector = golden.transactions.find(item => item.name === 'normal-utxo');
if (!vector) throw new Error('normal-utxo golden vector is missing');

const ec = new EC('p256');
const key = ec.keyFromPrivate('7'.padStart(64, '0'), 'hex');
const hash = Buffer.from(vector.hashHex, 'hex');
const signature = key.sign(Array.from(hash));
const fixture = `${JSON.stringify({
  schemaVersion: 'protocol-v2-client-signature/v1',
  transactionName: vector.name,
  hashHex: vector.hashHex,
  publicKey: {
    Algorithm: 'ecdsa_p256',
    PublicKey: Buffer.from(key.getPublic().encode('array', false)).toString('base64')
  },
  signature: {
    Algorithm: 'ecdsa_p256',
    Signature: Buffer.from(signature.toDER()).toString('base64')
  }
}, null, 2)}\n`;

if (checkOnly) {
  const existing = fs.readFileSync(outputPath, 'utf8');
  if (existing !== fixture) throw new Error(`${outputPath} is stale; regenerate it intentionally`);
  console.log('[protocol-v2] TypeScript signature fixture is current');
} else {
  fs.writeFileSync(outputPath, fixture);
  console.log(`[protocol-v2] wrote ${outputPath}`);
}
