import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = resolve(webRoot, '..');
const backendRoot = resolve(process.env.UTXO_AREA_REPO || join(workspaceRoot, 'UTXO-Area'));
const extensionRoot = resolve(process.env.PANGUPAY_EXTENSION_REPO || join(workspaceRoot, 'PanguPayExtension'));
const checkOnly = process.argv.includes('--check');

const sourceDir = join(webRoot, 'js', 'protocol-v2');
const mirrorDir = join(extensionRoot, 'src', 'protocol-v2');
const goldenSource = join(backendRoot, 'core', 'testdata', 'protocol-v2-golden.json');
const copies = [
  ...readdirSync(sourceDir)
    .filter(name => name.endsWith('.ts'))
    .sort()
    .map(name => [join(sourceDir, name), join(mirrorDir, name)]),
  [goldenSource, join(webRoot, 'tests', 'fixtures', 'protocol-v2-golden.json')],
  [goldenSource, join(extensionRoot, 'tests', 'fixtures', 'protocol-v2-golden.json')]
];

const expectedMirrorFiles = new Set(copies
  .filter(([, target]) => dirname(target) === mirrorDir)
  .map(([, target]) => target));

let mismatch = false;
for (const [source, target] of copies) {
  if (!existsSync(source)) throw new Error(`protocol-v2 source is missing: ${source}`);
  const sourceBytes = readFileSync(source);
  const equal = existsSync(target) && sourceBytes.equals(readFileSync(target));
  if (checkOnly) {
    if (!equal) {
      mismatch = true;
      console.error(`[protocol-v2] mismatch: ${target}`);
    }
    continue;
  }
  if (!equal) {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, sourceBytes);
    console.log(`[protocol-v2] synced: ${target}`);
  }
}

if (existsSync(mirrorDir)) {
  for (const name of readdirSync(mirrorDir)) {
    const target = join(mirrorDir, name);
    if (!name.endsWith('.ts') || expectedMirrorFiles.has(target)) continue;
    if (checkOnly) {
      mismatch = true;
      console.error(`[protocol-v2] unexpected mirror file: ${target}`);
    } else {
      rmSync(target);
      console.log(`[protocol-v2] removed stale mirror: ${target}`);
    }
  }
}

if (mismatch) process.exit(1);
console.log(checkOnly ? '[protocol-v2] mirror is current' : '[protocol-v2] sync complete');
