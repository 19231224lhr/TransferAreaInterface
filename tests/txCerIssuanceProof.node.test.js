import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as esbuild from 'esbuild';

async function loadFixture() {
  const source = `
    import { sha256 } from 'js-sha256';
    import {
      buildTXCerIssueLeaf,
      verifyTXCerIssueProof
    } from './js/services/txCerIssuanceProof.ts';
    import {
      buildTXCerIssuanceMetadata,
      buildTXCerIssuanceMetadataFromRegistry
    } from './js/services/txCerIssuance.ts';
    import {
      bytesToHex,
      getPublicKeyFromPrivate,
      signStruct
    } from './js/utils/signature.ts';

    const privateKey = '0000000000000000000000000000000000000000000000000000000000000001';
    const publicKey = getPublicKeyFromPrivate(privateKey);
    const record = {
      recordID: 'record-fixture',
      issueKey: 'group-source:tx-fixture:0:addr-fixture',
      txID: 'tx-fixture',
      outputIndex: 0,
      txCerID: 'txcer-fixture',
      userID: 'user-fixture',
      toAddress: 'addr-fixture',
      value: 12.5,
      status: 'Issued',
      batchID: '',
      certifierID: 'certifier-0',
      guarGroupID: 'group-source',
      targetBlock: 1,
      guarTXIndex: 0,
      updatedAt: 1
    };
    const leaf = buildTXCerIssueLeaf(record);
    const batchID = bytesToHex(sha256.array(leaf));
    const batch = {
      BatchID: batchID,
      CertifierID: 'certifier-0',
      Root: leaf,
      Signature: { R: null, S: null }
    };
    const signature = signStruct(batch, privateKey, ['Signature', 'RecordIDs', 'CreatedAt']);
    const proof = {
      LeafHash: leaf,
      MerkleRoot: leaf,
      Steps: [],
      BatchID: batchID,
      BatchSignature: signature,
      CertifierID: 'certifier-0'
    };
    globalThis.__fixture = { record, proof, publicKey };
    globalThis.__verify = verifyTXCerIssueProof;
    globalThis.__metadata = buildTXCerIssuanceMetadata({ ...record, proof }, publicKey);
    globalThis.__metadataFromRegistry = buildTXCerIssuanceMetadataFromRegistry({ ...record, proof }, [
      { certifierID: 'certifier-0', publicKey }
    ]);
  `;
  const result = await esbuild.build({
    stdin: {
      contents: source,
      resolveDir: process.cwd(),
      loader: 'ts',
      sourcefile: 'txCerIssuanceProofFixture.ts'
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    target: 'es2022'
  });
  const context = {
    console,
    globalThis: {},
    Buffer,
    crypto: globalThis.crypto
  };
  context.globalThis = context;
  vm.createContext(context);
  await vm.runInContext(result.outputFiles[0].text, context, { timeout: 5000 });
  return context;
}

test('frontend verifies TXCer issuance proof and rejects tampering', async () => {
  const context = await loadFixture();
  const { record, proof, publicKey } = context.__fixture;
  const verify = context.__verify;
  const metadata = context.__metadata;
  const metadataFromRegistry = context.__metadataFromRegistry;

  assert.equal(verify(record, proof, publicKey), true);
  assert.equal(metadata.proofStatus, 'verified');
  assert.equal(metadataFromRegistry.proofStatus, 'verified');
  assert.equal(metadata.issuanceRecordID, record.recordID);
  assert.equal(metadata.issueBatchID, proof.BatchID);

  const tamperedRoot = {
    ...proof,
    MerkleRoot: [...proof.MerkleRoot]
  };
  tamperedRoot.MerkleRoot[0] ^= 1;
  assert.equal(verify(record, tamperedRoot, publicKey), false);

  const tamperedSignature = {
    ...proof,
    BatchSignature: {
      ...proof.BatchSignature,
      R: String(BigInt(proof.BatchSignature.R) + 1n)
    }
  };
  assert.equal(verify(record, tamperedSignature, publicKey), false);

  const mismatchedCertifier = {
    ...proof,
    CertifierID: 'certifier-other'
  };
  assert.equal(verify(record, mismatchedCertifier, publicKey), false);
});
