import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import * as esbuild from 'esbuild';

const root = process.cwd();

async function loadAuthorityBuilder() {
  const result = await esbuild.build({
    stdin: {
      contents: `import { buildTXCerAuthoritySnapshot } from './js/services/txCerIssuance.ts'; globalThis.__authorityBuilder = buildTXCerAuthoritySnapshot;`,
      resolveDir: root,
      sourcefile: 'liability-authority-test-entry.ts',
      loader: 'ts',
    },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'es2022',
    write: false,
    logLevel: 'silent',
    packages: 'external',
  });
  const storage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  const context = {
    console,
    Buffer,
    process,
    require: createRequire(import.meta.url),
    localStorage: storage,
    sessionStorage: storage,
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(result.outputFiles[0].text, context, { timeout: 10_000 });
  return context.__authorityBuilder;
}

const key = (x, y) => ({ CurveName: 'P256', X: String(x), Y: String(y) });

function fixture(signers, threshold) {
  return {
    record: {
      GuarGroupID: 'group-source',
      TXCer: { FromGuarGroupID: 'group-source' },
      LiabilityReceipt: {
        SignerSetID: 'group-source:liability:v1',
        Signers: signers,
        Threshold: threshold,
      },
    },
    source: {
      groupID: 'group-source',
      aggrNodeID: 'aggr-source',
      assignNodeID: 'assign-source',
      aggrPublicKey: key(11, 13),
      assignPublicKey: key(17, 19),
    },
    target: {
      groupID: 'group-target',
      aggrNodeID: 'aggr-target',
      assignNodeID: 'assign-target',
      aggrPublicKey: key(23, 29),
      assignPublicKey: key(31, 37),
    },
    certifiers: [{
      CertifierID: 'certifier-0',
      PublicKey: key(41, 43),
      Status: 'Active',
    }],
  };
}

test('CFAA certifiers are not implicitly liability receipt signers', async () => {
  const build = await loadAuthorityBuilder();
  const value = fixture(['aggr'], 1);
  const snapshot = build(value.record, value.source, value.target, value.certifiers, 1);
  assert.deepEqual(Array.from(snapshot.members), ['aggr']);
  assert.equal(snapshot.threshold, 1);
  assert.ok(snapshot.publicKeys['certifier:certifier-0']);
});

test('receipt-selected known liability signers retain authoritative public keys', async () => {
  const build = await loadAuthorityBuilder();
  const value = fixture(['certifier:certifier-0', 'aggr'], 2);
  const snapshot = build(value.record, value.source, value.target, value.certifiers, 1);
  assert.deepEqual(Array.from(snapshot.members), ['aggr', 'certifier:certifier-0']);
  assert.equal(snapshot.threshold, 2);
  assert.ok(snapshot.publicKeys.aggr);
  assert.ok(snapshot.publicKeys['certifier:certifier-0']);
});
