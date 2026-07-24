import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import * as esbuild from 'esbuild';
import JSONbigFactory from 'json-bigint';

const root = process.cwd();
const JSONbig = JSONbigFactory({ useNativeBigInt: true, alwaysParseAsBig: false });
const goldenPath = path.join(root, 'tests', 'fixtures', 'protocol-v2-golden.json');

async function loadProtocolV2() {
  const result = await esbuild.build({
    stdin: {
      contents: `import * as protocol from './js/protocol-v2/index.ts'; import { serializeForBackend } from './js/utils/signature.ts'; globalThis.__protocolV2 = { ...protocol, serializeForBackend };`,
      resolveDir: root,
      sourcefile: 'protocol-v2-test-entry.ts',
      loader: 'ts'
    },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'es2022',
    write: false,
    logLevel: 'silent',
    packages: 'external'
  });
  const context = { console, Buffer, process, require: createRequire(import.meta.url) };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(result.outputFiles[0].text, context, { timeout: 10_000 });
  return context.__protocolV2;
}

function loadGolden() {
  return JSONbig.parse(fs.readFileSync(goldenPath, 'utf8'));
}

test('protocol-v2 amount and ratio parsing matches Go golden vectors', async () => {
  const protocol = await loadProtocolV2();
  const golden = loadGolden();
  for (const vector of golden.amounts) {
    if (!vector.valid) {
      assert.throws(() => protocol.parseAmount(vector.input));
      continue;
    }
    const units = protocol.parseAmount(vector.input);
    assert.equal(units.toString(), vector.units);
    assert.equal(protocol.formatAmount(units), vector.canonical);
  }
  for (const vector of golden.ratios) {
    if (!vector.valid) {
      assert.throws(() => protocol.parseRatio(vector.input));
      continue;
    }
    assert.equal(protocol.parseRatio(vector.input).toString(), vector.units);
  }
  assert.throws(() => protocol.parseAmount(Number.MAX_SAFE_INTEGER + 1));
});

test('protocol-v2 exact amount helpers never round scaled values through number', async () => {
  const protocol = await loadProtocolV2();
  assert.equal(protocol.addAmounts('90071992.54740991', '0.00000009'), '90071992.54741');
  assert.equal(protocol.compareAmounts('90071992.54740991', '90071992.5474099'), 1);
  assert.equal(protocol.isWholeAmount('9007199254'), true);
  assert.equal(protocol.isWholeAmount('9007199254.00000001'), false);
  assert.equal(protocol.normalizeStoredAmount(42), '42');
  assert.throws(() => protocol.normalizeStoredAmount(Number.MAX_SAFE_INTEGER + 1));
});

test('protocol-v2 builds address registration materials in authoritative Go field order', async () => {
  const protocol = await loadProtocolV2();
  const common = {
    address: '0123456789abcdef0123456789abcdef01234567',
    publicKeyNew: { CurveName: 'P256', X: '11', Y: '13' },
    signPublicKeyV2: { Algorithm: 'ecdsa_p256', PublicKey: [4, 1, 2, 3] },
    seedAnchor: [9, 8, 7],
    seedChainStep: 1000,
    defaultSpendAlgorithm: 'ecdsa_p256',
    type: 0,
  };

  const assign = protocol.buildAssignAddressRegistrationMaterial({
    ...common,
    userID: '92319817',
  });
  assert.deepEqual(Object.keys(assign), [
    'NewAddress',
    'PublicKeyNew',
    'UserID',
    'Type',
    'SignPublicKeyV2',
    'SeedAnchor',
    'SeedChainStep',
    'DefaultSpendAlgorithm',
  ]);

  const retail = protocol.buildRetailAddressOwnershipMaterial({
    ...common,
    timestamp: 1_700_000_000,
  });
  assert.deepEqual(Object.keys(retail), [
    'Address',
    'PublicKeyNew',
    'GroupID',
    'TimeStamp',
    'Type',
    'SeedAnchor',
    'SeedChainStep',
    'DefaultSpendAlgorithm',
    'SignPublicKeyV2',
  ]);

  const request = protocol.buildRetailAddressRegistrationRequest(retail, {
    Algorithm: 'ecdsa_p256',
    Signature: [1, 2, 3],
  });
  assert.equal('Sig' in request, false);
  assert.deepEqual(request.AddressOwnershipSig.Signature, [1, 2, 3]);

  const golden = loadGolden().addressRegistration;
  const assignRequest = golden.assignRequest;
  const assignMaterial = protocol.buildAssignAddressRegistrationMaterial({
    address: assignRequest.NewAddress,
    publicKeyNew: assignRequest.PublicKeyNew,
    userID: assignRequest.UserID,
    type: assignRequest.Type,
    signPublicKeyV2: assignRequest.SignPublicKeyV2,
    seedAnchor: assignRequest.SeedAnchor,
    seedChainStep: assignRequest.SeedChainStep,
    defaultSpendAlgorithm: assignRequest.DefaultSpendAlgorithm,
  });
  const assignJSON = protocol.serializeForBackend({ ...assignMaterial, Sig: { R: null, S: null } });
  assert.equal(assignJSON, golden.assignSigningJSON);
  assert.equal(protocol.bytesToHex(protocol.sha256Bytes(assignJSON)), golden.assignHashHex);

  const retailRequest = golden.retailRequest;
  const retailMaterial = protocol.buildRetailAddressOwnershipMaterial({
    address: retailRequest.Address,
    publicKeyNew: retailRequest.PublicKeyNew,
    timestamp: retailRequest.TimeStamp,
    type: retailRequest.Type,
    signPublicKeyV2: retailRequest.SignPublicKeyV2,
    seedAnchor: retailRequest.SeedAnchor,
    seedChainStep: retailRequest.SeedChainStep,
    defaultSpendAlgorithm: retailRequest.DefaultSpendAlgorithm,
  });
  const retailJSON = protocol.serializeForBackend(retailMaterial);
  assert.equal(retailJSON, golden.retailOwnershipJSON);
  assert.equal(protocol.bytesToHex(protocol.sha256Bytes(retailJSON)), golden.retailHashHex);
});

test('protocol-v2 transaction hashes match all Go golden vectors', async () => {
  const protocol = await loadProtocolV2();
  const golden = loadGolden();
  for (const vector of golden.transactions) {
    assert.equal(protocol.canonicalJSONStringify(protocol.canonicalizeTransactionV2(vector.transaction)), vector.canonicalJSON, vector.name);
    assert.equal(protocol.bytesToHex(protocol.computeTransactionHashV2(vector.transaction)), vector.hashHex, vector.name);
    assert.equal(protocol.computeTransactionIDV2(vector.transaction), vector.txID, vector.name);
    assert.equal(vector.txID.length, 64, vector.name);
    assert.notEqual(vector.txID, vector.txID.slice(0, 16), vector.name);
    assert.equal(
      protocol.verifySignatureEnvelopeV2(
        protocol.computeTransactionHashV2(vector.transaction),
        vector.transaction.UserSignatureV2,
        vector.userPublicKeyV2
      ),
      true,
      `${vector.name} Go signature`
    );
    assert.equal(
      protocol.bytesToHex(protocol.computeSettlementIntentHashV2(vector.transaction, vector.settlementTXCerID)),
      vector.settlementIntentHashHex,
      vector.name
    );
  }
});

test('protocol-v2 normalizes map order and Go byte representations', async () => {
  const protocol = await loadProtocolV2();
  const golden = loadGolden();
  for (const vector of golden.transactions) {
    const variant = structuredClone(vector.transaction);
    variant.ValueDivision = Object.fromEntries(Object.entries(variant.ValueDivision || {}).reverse());
    variant.NewValueDiv = Object.fromEntries(Object.entries(variant.NewValueDiv || {}).reverse());
    variant.InterestAssign.BackAssign = Object.fromEntries(Object.entries(variant.InterestAssign.BackAssign || {}).reverse());
    variant.Data = [];
    for (const input of variant.TXInputsNormal || []) {
      if (typeof input.TXOutputHash === 'string') input.TXOutputHash = Array.from(Buffer.from(input.TXOutputHash, 'base64'));
      if (input.SeedReveal === '') input.SeedReveal = [];
    }
    assert.equal(protocol.computeTransactionIDV2(variant), vector.txID, vector.name);
  }
});

test('protocol-v2 rebuilds persisted TXCer values in Go struct field order before outer signing', async () => {
  const protocol = await loadProtocolV2();
  const sortedTXCer = {
    ConstructionTime: 206954687,
    ExposureShares: [{
      Amount: '12',
      GroupID: '10000000',
      LeafID: 'leaf-1',
      PledgeAddress: 'pledge-1',
      RootID: 'root-1',
    }],
    FromGuarGroupID: '10000000',
    GuarGroupSignature: { R: '11', S: '13' },
    SettlementAuth: {
      AuthTime: 206954700,
      ConsumeIntentHash: [1, 2, 3],
      FromGuarGroupID: '10000000',
      PledgeAddress: 'pledge-1',
      SourcePosition: { BlockHeight: 1, InIndex: 2, Index: 3 },
      SourceTXID: 'source-tx',
      ToGuarGroupID: '10000000',
      TXCerID: 'txcer-1',
      UserSignatureV2: { Algorithm: 'ecdsa_p256', Signature: [4, 5, 6] },
      Value: '12',
      Version: 1,
    },
    Size: 0,
    SourcePledgeAddress: 'pledge-1',
    TXCerID: 'txcer-1',
    TXID: 'source-tx',
    ToAddress: 'recipient-1',
    ToGuarGroupID: '10000000',
    ToInterest: '0',
    TxCerPosition: { BlockHeight: 1, InIndex: 2, Index: 3 },
    UserSignature: { R: null, S: null },
    UserSignatureV2: { Algorithm: 'ecdsa_p256', Signature: [7, 8, 9] },
    Value: '12',
  };

  const normalized = protocol.normalizeTXCerForGoStructJSON(sortedTXCer);
  assert.deepEqual(Object.keys(normalized), [
    'TXCerID',
    'ToAddress',
    'Value',
    'ToInterest',
    'FromGuarGroupID',
    'ToGuarGroupID',
    'SourcePledgeAddress',
    'ConstructionTime',
    'Size',
    'ExposureShares',
    'TXID',
    'TxCerPosition',
    'GuarGroupSignature',
    'UserSignature',
    'UserSignatureV2',
    'SettlementAuth',
  ]);
  assert.deepEqual(Object.keys(normalized.ExposureShares[0]), [
    'RootID',
    'LeafID',
    'GroupID',
    'PledgeAddress',
    'Amount',
  ]);
  assert.deepEqual(Object.keys(normalized.TxCerPosition), ['BlockHeight', 'Index', 'InIndex']);
  assert.deepEqual(Object.keys(normalized.SettlementAuth.SourcePosition), ['BlockHeight', 'Index', 'InIndex']);
});

test('protocol-v2 output and SettlementAuth hashes match Go and verify signatures', async () => {
  const protocol = await loadProtocolV2();
  const golden = loadGolden();
  for (const vector of golden.outputs) {
    assert.equal(
      protocol.canonicalJSONStringify(protocol.canonicalizeTXOutputHashMaterialV2(vector.output)),
      vector.canonicalJSON,
      vector.name
    );
    assert.equal(protocol.bytesToHex(protocol.computeTXOutputHashCompatV2(vector.output)), vector.hashHex, vector.name);
  }
  const vector = golden.settlementAuth;
  assert.equal(
    protocol.canonicalJSONStringify(protocol.canonicalizeSettlementAuthSignatureMaterialV2(vector.settlementAuth)),
    vector.canonicalJSON
  );
  const hash = protocol.computeSettlementAuthHashV2(vector.settlementAuth);
  assert.equal(protocol.bytesToHex(hash), vector.hashHex);
  assert.equal(protocol.verifySignatureEnvelopeV2(hash, vector.settlementAuth.UserSignatureV2, vector.publicKey), true);
});

test('legacy client adapters delegate signing hashes to protocol-v2', () => {
  const txBuilderSource = fs.readFileSync(path.join(root, 'js', 'services', 'txBuilder.ts'), 'utf8');
  const settlementSource = fs.readFileSync(path.join(root, 'js', 'services', 'settlementAuth.ts'), 'utf8');
  assert.match(txBuilderSource, /return computeTXOutputHashCompatV2\(output\)/);
  assert.match(settlementSource, /computeSettlementAuthHashV2\(auth\)/);
});

test('protocol-v2 verifies current TXCer evidence and rejects field tampering', async () => {
  const protocol = await loadProtocolV2();
  const { evidence } = loadGolden();
  const authority = {
    publicKeys: {
      aggregation: evidence.publicKey,
      certifier: evidence.publicKey,
      'aggregation-v2': evidence.publicKey,
      'assign-target': evidence.publicKey,
      'certifier-v2': evidence.publicKey
    },
    members: evidence.liabilityAuthority,
    threshold: evidence.liabilityThreshold,
    sourceAggregationPublicKey: evidence.publicKey,
    sourceAssignPublicKey: evidence.publicKey
  };
  assert.equal(protocol.computeTXCerIDV2(evidence.txCer), evidence.txCerID);
  assert.equal(protocol.verifyTXCerFastEvidence(evidence.issuanceRecord, evidence.fastEvidence, authority), true);
  assert.equal(protocol.verifyTXCerIssuanceAck(evidence.assignAck, evidence.fastEvidence, authority.publicKeys['assign-target']), true);
  assert.equal(protocol.verifyFastLiabilityReceipt(evidence.liabilityReceipt, authority), true);
  assert.equal(protocol.verifyTXCerIssueProof(evidence.issuanceRecord, evidence.issueProof, authority.publicKeys['certifier-v2']), true);

  const tamperedShare = structuredClone(evidence.issuanceRecord);
  tamperedShare.TXCer.ExposureShares[0].Amount = '1';
  assert.equal(protocol.verifyTXCerFastEvidence(tamperedShare, evidence.fastEvidence, authority), false);
  const tamperedRoot = structuredClone(evidence.issuanceRecord);
  tamperedRoot.TXCer.ExposureShares[0].RootID = 'other-root';
  assert.equal(protocol.verifyTXCerFastEvidence(tamperedRoot, evidence.fastEvidence, authority), false);
  const tamperedReceipt = structuredClone(evidence.liabilityReceipt);
  tamperedReceipt.OutstandingAfter = '1';
  assert.equal(protocol.verifyFastLiabilityReceipt(tamperedReceipt, authority), false);
  assert.equal(protocol.verifyFastLiabilityReceipt(evidence.liabilityReceipt, { ...authority, threshold: 1 }), false);
  const tamperedAck = structuredClone(evidence.assignAck);
  tamperedAck.evidenceHash = '';
  assert.equal(protocol.verifyTXCerIssuanceAck(tamperedAck, evidence.fastEvidence, authority.publicKeys['assign-target']), false);
  const tamperedAckStatus = structuredClone(evidence.assignAck);
  tamperedAckStatus.status = 'Rejected';
  assert.equal(protocol.verifyTXCerIssuanceAck(tamperedAckStatus, evidence.fastEvidence, authority.publicKeys['assign-target']), false);
  const tamperedProof = structuredClone(evidence.issueProof);
  tamperedProof.MerkleRoot = '';
  assert.equal(protocol.verifyTXCerIssueProof(evidence.issuanceRecord, tamperedProof, authority.publicKeys['certifier-v2']), false);
});

test('protocol-v2 derives independent spendability, fast-evidence and CFAA states', async () => {
  const protocol = await loadProtocolV2();
  const { evidence } = loadGolden();
  const snapshot = {
    groupID: evidence.issuanceRecord.GuarGroupID,
    signerSetID: evidence.liabilityReceipt.SignerSetID,
    members: evidence.liabilityAuthority,
    threshold: evidence.liabilityThreshold,
    publicKeys: {
      aggregation: evidence.publicKey,
      certifier: evidence.publicKey,
      'aggregation-v2': evidence.publicKey,
      'assign-target': evidence.publicKey,
      'certifier-v2': evidence.publicKey
    },
    sourceAggregationPublicKey: evidence.publicKey,
    sourceAssignPublicKey: evidence.publicKey,
    targetAssignPublicKey: evidence.publicKey,
    capturedAt: 1_700_000_000_100
  };
  const bundle = {
    issuanceRecord: evidence.issuanceRecord,
    fastEvidence: evidence.fastEvidence,
    assignAck: evidence.assignAck,
    liabilityReceipt: evidence.liabilityReceipt,
    issuanceProof: evidence.issueProof,
    authoritySnapshot: snapshot
  };

  const verified = protocol.evaluateTXCerSecurity(bundle, 'Active', 1_700_000_000_200);
  assert.equal(verified.spendabilityStatus, 'Active');
  assert.equal(verified.fastEvidenceStatus, 'Verified');
  assert.equal(verified.cfaaAuditStatus, 'Verified');
  assert.equal(verified.fastEvidenceError, '');
  assert.equal(verified.cfaaAuditError, '');
  assert.equal(verified.checkedAt, 1_700_000_000_200);

  const withoutAudit = structuredClone(bundle);
  delete withoutAudit.issuanceProof;
  const pendingAudit = protocol.evaluateTXCerSecurity(withoutAudit, 'Active', 10);
  assert.equal(pendingAudit.fastEvidenceStatus, 'Verified');
  assert.equal(pendingAudit.cfaaAuditStatus, 'Pending');

  const withoutAuthority = structuredClone(bundle);
  delete withoutAuthority.authoritySnapshot;
  const pendingAuthority = protocol.evaluateTXCerSecurity(withoutAuthority, 'Active', 11);
  assert.equal(pendingAuthority.fastEvidenceStatus, 'Pending');
  assert.equal(pendingAuthority.cfaaAuditStatus, 'Unavailable');

  const tampered = structuredClone(bundle);
  tampered.fastEvidence.TXCerID = 'tampered';
  const failed = protocol.evaluateTXCerSecurity(tampered, 'Active', 12);
  assert.equal(failed.fastEvidenceStatus, 'Failed');
  assert.match(failed.fastEvidenceError, /FastEvidence/);
  assert.equal(protocol.isTXCerLocallySpendable(failed), false);
  assert.equal(protocol.isTXCerLocallySpendable(pendingAuthority), true);
});

test('protocol-v2 evidence persistence merge is idempotent and never loses richer evidence', async () => {
  const protocol = await loadProtocolV2();
  const { evidence } = loadGolden();
  const existing = {
    issuanceRecordID: evidence.issuanceRecord.RecordID,
    issuanceRecord: evidence.issuanceRecord,
    fastEvidence: evidence.fastEvidence,
    assignAck: evidence.assignAck,
    liabilityReceipt: evidence.liabilityReceipt,
    security: {
      spendabilityStatus: 'Active',
      fastEvidenceStatus: 'Verified',
      cfaaAuditStatus: 'Pending',
      checkedAt: 20
    }
  };
  const incoming = {
    issuanceRecordID: evidence.issuanceRecord.RecordID,
    issuanceProof: evidence.issueProof,
    security: {
      spendabilityStatus: 'Active',
      fastEvidenceStatus: 'Pending',
      cfaaAuditStatus: 'Verified',
      checkedAt: 21
    }
  };
  const merged = protocol.mergeTXCerEvidenceMetadata(existing, incoming);
  assert.deepEqual(merged.issuanceRecord, existing.issuanceRecord);
  assert.deepEqual(merged.fastEvidence, existing.fastEvidence);
  assert.deepEqual(merged.assignAck, existing.assignAck);
  assert.deepEqual(merged.liabilityReceipt, existing.liabilityReceipt);
  assert.deepEqual(merged.issuanceProof, incoming.issuanceProof);
  assert.equal(merged.security.fastEvidenceStatus, 'Verified');
  assert.equal(merged.security.cfaaAuditStatus, 'Verified');
  assert.deepEqual(protocol.mergeTXCerEvidenceMetadata(merged, incoming), merged);
});
