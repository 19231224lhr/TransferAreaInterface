import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import * as esbuild from 'esbuild';

const root = process.cwd();

async function loadMutationModule() {
  const result = await esbuild.build({
    stdin: {
      contents: `import * as mutation from './js/utils/serializedMutation.ts'; globalThis.__mutation = mutation;`,
      resolveDir: root,
      sourcefile: 'serialized-mutation-test-entry.ts',
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
  const context = { console, structuredClone, require: createRequire(import.meta.url) };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(result.outputFiles[0].text, context, { timeout: 10_000 });
  return context.__mutation;
}

test('serialized record mutations reload the latest state and preserve concurrent fields', async () => {
  const { createSerializedRecordMutator } = await loadMutationModule();
  let stored = { accountId: 'bob', registrationState: 'pending', txCers: {} };
  let releaseFirst;
  let firstStarted;
  const firstStartedPromise = new Promise((resolve) => { firstStarted = resolve; });
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
  const mutate = createSerializedRecordMutator({
    load: async () => structuredClone(stored),
    save: async (_id, value) => { stored = structuredClone(value); },
    verify: async () => structuredClone(stored),
  });

  const registration = mutate('bob', async (latest) => {
    firstStarted();
    await firstGate;
    latest.registrationState = 'registered';
    return latest;
  });
  await firstStartedPromise;
  const delivery = mutate('bob', (latest) => {
    latest.txCers['txcer-1'] = '12';
    return latest;
  });
  releaseFirst();
  await Promise.all([registration, delivery]);

  assert.equal(stored.registrationState, 'registered');
  assert.equal(stored.txCers['txcer-1'], '12');
});
