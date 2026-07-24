import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn, spawnSync } from 'node:child_process';

const root = process.cwd();
const backendRoot = path.resolve(process.env.PANGU_UTXO_AREA_ROOT || path.join(root, '..', 'UTXO-Area'));
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pangu-web-real-browser-'));
const readyFile = path.join(tempDir, 'backend-ready.json');
const stopFile = path.join(tempDir, 'backend-stop');
const fixtureFile = path.join(tempDir, 'fixture.json');
const profileDir = path.join(tempDir, 'edge-profile');
const debugPort = Number(process.env.PANGU_WEB_EDGE_DEBUG_PORT || 11300 + Math.floor(Math.random() * 500));
const webPort = Number(process.env.PANGU_WEB_VITE_PORT || 21300 + Math.floor(Math.random() * 500));
const holdSeconds = Number(process.env.PANGU_WEB_BACKEND_HOLD_SECONDS || 420);
const commitDelaySeconds = Number(process.env.PANGU_WEB_COMMIT_DELAY_SECONDS || 25);

let backendProcess = null;
let viteProcess = null;
let edgeProcess = null;
const openClients = new Set();

function log(message) {
  console.log(`[test:real-browser] ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findEdgePath() {
  return [
    process.env.PANGUPAY_EDGE_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft\\Edge\\Application\\msedge.exe'),
  ].filter(Boolean).find((candidate) => fs.existsSync(candidate));
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

async function waitForFile(file, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fs.existsSync(file)) return;
    await sleep(500);
  }
  throw new Error(`timed out waiting for ${file}`);
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Service is still starting.
    }
    await sleep(250);
  }
  throw new Error(`timed out waiting for ${url}`);
}

function startBackend() {
  const smokeScript = path.join(backendRoot, 'scripts', 'dev-backend-smoke.ps1');
  if (!fs.existsSync(smokeScript)) throw new Error(`backend smoke script not found: ${smokeScript}`);
  backendProcess = spawn('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', smokeScript,
    '-RunGQNCFlow',
    '-ExternalBusinessFlow',
    '-CommitteeNodeCount', '4',
    '-GuarBlockCommitDelaySec', String(commitDelaySeconds),
    '-HoldSeconds', String(holdSeconds),
    '-ReadyFile', readyFile,
    '-StopFile', stopFile,
  ], {
    cwd: backendRoot,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  backendProcess.stdout.on('data', (chunk) => process.stdout.write(chunk));
  backendProcess.stderr.on('data', (chunk) => process.stderr.write(chunk));
}

function prepareFixture(ready) {
  run('go', [
    'run', './tools/dev-http-e2e',
    '-config', ready.configPath,
    '-gateway', ready.gatewayBase,
    '-group', ready.groupID,
    '-prepare-only',
    '-fixture-json', fixtureFile,
  ], { cwd: backendRoot });
  return JSON.parse(fs.readFileSync(fixtureFile, 'utf8').replace(/^\uFEFF/, ''));
}

function startVite() {
  const viteEntry = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!fs.existsSync(viteEntry)) throw new Error(`Vite entry not found: ${viteEntry}`);
  viteProcess = spawn(process.execPath, [
    viteEntry,
    '--host', '127.0.0.1',
    '--port', String(webPort),
    '--strictPort',
  ], {
    cwd: root,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  viteProcess.stdout.on('data', (chunk) => process.stdout.write(chunk));
  viteProcess.stderr.on('data', (chunk) => process.stderr.write(chunk));
}

function startEdge(edgePath) {
  edgeProcess = spawn(edgePath, [
    `--user-data-dir=${profileDir}`,
    `--remote-debugging-port=${debugPort}`,
    '--remote-allow-origins=*',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-popup-blocking',
    '--window-position=-32000,-32000',
    '--window-size=900,700',
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
}

function stopProcessTree(process) {
  if (!process?.pid) return;
  try {
    execFileSync('taskkill', ['/PID', String(process.pid), '/T', '/F'], { stdio: 'ignore' });
  } catch {
    // Process may already be stopped.
  }
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let nextId = 1;
    const pending = new Map();
    const listeners = new Map();
    ws.addEventListener('open', () => {
      const client = {
        send(method, params = {}) {
          const id = nextId++;
          ws.send(JSON.stringify({ id, method, params }));
          return new Promise((res, rej) => pending.set(id, { res, rej, method }));
        },
        on(method, listener) {
          const values = listeners.get(method) || [];
          values.push(listener);
          listeners.set(method, values);
        },
        close() {
          openClients.delete(client);
          try { ws.close(); } catch { /* best effort */ }
        },
      };
      openClients.add(client);
      resolve(client);
    });
    ws.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      if (data.id && pending.has(data.id)) {
        const entry = pending.get(data.id);
        pending.delete(data.id);
        if (data.error) entry.rej(new Error(`${entry.method}: ${data.error.message}`));
        else entry.res(data.result);
        return;
      }
      for (const listener of listeners.get(data.method) || []) {
        Promise.resolve(listener(data.params || {})).catch(() => {});
      }
    });
    ws.addEventListener('error', reject);
  });
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    const details = result.exceptionDetails;
    throw new Error(details.exception?.description || details.text || JSON.stringify(details));
  }
  return result.result.value;
}

async function waitForDevTools() {
  const url = `http://127.0.0.1:${debugPort}/json/list`;
  await waitForHttp(url, 30000);
  return fetch(url).then((response) => response.json());
}

async function closeEdgeGracefully() {
  try {
    const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
    if (!response.ok) return;
    const version = await response.json();
    if (!version?.webSocketDebuggerUrl) return;
    const browser = await connect(version.webSocketDebuggerUrl);
    try {
      await Promise.race([
        browser.send('Browser.close'),
        sleep(2000),
      ]);
    } finally {
      browser.close();
    }
  } catch {
    // The force-kill fallback below handles an unavailable DevTools endpoint.
  }
}

async function openWebPage(fixture, { blockIssuance = false } = {}) {
  await waitForDevTools();
  const response = await fetch(
    `http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent('about:blank')}`,
    { method: 'PUT' },
  );
  if (!response.ok) throw new Error(`failed to create Edge target: ${response.status}`);
  const target = await response.json();
  const client = await connect(target.webSocketDebuggerUrl);
  await client.send('Runtime.enable');
  await client.send('Page.enable');
  const apiBase = JSON.stringify(String(fixture.gatewayBase).replace(/\/$/, ''));
  const fixtureJSON = JSON.stringify(fixture);
  await client.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      (() => {
        const apiBase = ${apiBase};
        const runtime = Object.freeze({
          devMode: true,
          devApiBaseUrl: apiBase,
          prodApiBaseUrl: apiBase,
        });
        Object.defineProperty(window, '__PANGU_RUNTIME__', {
          configurable: true,
          get: () => runtime,
          set: () => {},
        });
        Object.defineProperty(window, '__API_BASE_URL__', {
          configurable: true,
          get: () => apiBase,
          set: () => {},
        });
        Object.defineProperty(window, '__PANGU_DEV__', {
          configurable: true,
          get: () => true,
          set: () => {},
        });
        window.__PANGU_REAL_BROWSER_FIXTURE__ = ${fixtureJSON};
      })();
    `,
  });
  if (blockIssuance) {
    client.on('Fetch.requestPaused', async ({ requestId }) => {
      await client.send('Fetch.failRequest', { requestId, errorReason: 'Failed' });
    });
    await client.send('Fetch.enable', {
      patterns: [{ urlPattern: '*txcer-issuance-record*', requestStage: 'Request' }],
    });
  }
  await client.send('Page.navigate', { url: `http://127.0.0.1:${webPort}/` });
  await waitForPage(client, 'document.readyState === "complete"', 'Web page load', 120);
  await waitForPage(client, 'Boolean(window.PanguPay)', 'Web application bootstrap', 120);
  return client;
}

async function waitForPage(client, expression, label, attempts = 240) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      if (await evaluate(client, `Boolean(${expression})`)) return;
    } catch {
      // Page may still be navigating.
    }
    await sleep(250);
  }
  throw new Error(`timed out waiting for ${label}`);
}

function browserBootstrapUserExpression(name) {
  return `(async () => {
    const fixture = window.__PANGU_REAL_BROWSER_FIXTURE__;
    const source = fixture[${JSON.stringify(name)}];
    if (fixture.comNodeEndpoint) {
      localStorage.setItem('comNodeEndpoint', JSON.stringify({
        url: String(fixture.comNodeEndpoint),
        timestamp: Date.now(),
      }));
    }
    const storage = await import('/js/utils/storage.ts');
    const query = await import('/js/services/accountQuery.ts');
    const result = await query.querySingleAddress(String(source.address).toLowerCase());
    if (!result.success || !result.data?.exists) {
      throw new Error('address query failed for ${name}: ' + JSON.stringify(result));
    }
    const balance = String(result.data.balance ?? source.balance ?? '0');
    const address = String(source.address).toLowerCase();
    const accountAddress = String(source.accountAddress || '').toLowerCase();
    const emptyValue = { totalValue: '0', utxoValue: '0', txCerValue: '0' };
    const addressValue = { totalValue: balance, utxoValue: balance, txCerValue: '0' };
    const user = {
      accountId: String(source.accountID),
      address: accountAddress,
      orgNumber: String(fixture.groupID),
      flowOrigin: 'real-browser',
      keys: {
        privHex: String(source.accountPrivateKey),
        pubXHex: String(source.accountPublicKeyXHex || ''),
        pubYHex: String(source.accountPublicKeyYHex || ''),
      },
      privHex: String(source.accountPrivateKey),
      pubXHex: String(source.accountPublicKeyXHex || ''),
      pubYHex: String(source.accountPublicKeyYHex || ''),
      guarGroup: {
        groupID: String(fixture.groupID),
        aggreNode: String(fixture.gatewayBase),
        assignNode: String(fixture.gatewayBase),
        pledgeAddress: String(fixture.pledgeAddress || ''),
        assignAPIEndpoint: String(fixture.gatewayBase),
        aggrAPIEndpoint: String(fixture.gatewayBase),
      },
      isInGroup: true,
      mainAddressRegistered: true,
      wallet: {
        addressMsg: {
          ...(accountAddress ? {
            [accountAddress]: {
              type: 0, utxos: {}, txCers: {}, value: emptyValue, estInterest: 0,
            },
          } : {}),
          [address]: {
            type: Number(source.addressType || 0),
            utxos: query.convertUtxosForStorage(result.data),
            txCers: {},
            value: addressValue,
            estInterest: 0,
            privHex: String(source.addressPrivateKey),
            pubXHex: String(source.addressPublicKeyXHex || ''),
            pubYHex: String(source.addressPublicKeyYHex || ''),
            addressRootSeedHex: String(source.addressRootSeedHex || ''),
            publicKeyNew: result.data.publicKey || null,
            signPublicKeyV2: source.signPublicKeyV2 || null,
            seedAnchor: source.seedAnchor || [],
            seedChainStep: Number(source.seedChainStep || 0),
            defaultSpendAlgorithm: String(source.defaultSpendAlgorithm || 'ecdsa_p256'),
            registrationState: 'registered',
          },
        },
        totalTXCers: {},
        txCerStatuses: {},
        txCerIssuanceRecords: {},
        totalValue: balance,
        valueDivision: { 0: balance, 1: '0', 2: '0' },
        updateTime: Date.now(),
        updateBlock: Number(result.data.lastHeight || 0),
      },
    };
    localStorage.setItem('activeAccountId', String(source.accountID));
    sessionStorage.setItem('sessionUserId', String(source.accountID));
    storage.saveUser(user);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const saved = storage.loadUser();
    if (saved?.accountId !== String(source.accountID)) {
      throw new Error('failed to activate ${name} account');
    }
    return { accountId: saved.accountId, balance, utxoCount: Object.keys(saved.wallet.addressMsg[address].utxos || {}).length };
  })()`;
}

function browserSubmitExpression(senderName, recipientName, amount, preferTXCer) {
  return `(async () => {
    const fixture = window.__PANGU_REAL_BROWSER_FIXTURE__;
    const sender = fixture[${JSON.stringify(senderName)}];
    const recipient = fixture[${JSON.stringify(recipientName)}];
    const storage = await import('/js/utils/storage.ts');
    const txBuilder = await import('/js/services/txBuilder.ts');
    const user = storage.loadUser();
    if (user?.accountId !== String(sender.accountID)) {
      throw new Error('unexpected active sender: ' + String(user?.accountId || ''));
    }
    const built = await txBuilder.buildTransaction({
      fromAddresses: [String(sender.address).toLowerCase()],
      recipients: [{
        address: String(recipient.address).toLowerCase(),
        amount: ${JSON.stringify(String(amount))},
        coinType: 0,
        publicKeyX: String(recipient.addressPublicKeyXHex || ''),
        publicKeyY: String(recipient.addressPublicKeyYHex || ''),
        guarGroupID: String(fixture.groupID),
        seedAnchor: recipient.seedAnchor || [],
        seedChainStep: Number(recipient.seedChainStep || 0),
        defaultSpendAlgorithm: String(recipient.defaultSpendAlgorithm || 'ecdsa_p256'),
      }],
      changeAddresses: { 0: String(sender.address).toLowerCase() },
      gas: '0',
      preferTXCer: ${preferTXCer ? 'true' : 'false'},
      txCerLockOwner: 'web-real-browser-' + Date.now(),
    }, user);
    const reply = await txBuilder.submitTransaction(
      built,
      String(fixture.groupID),
      String(fixture.gatewayBase).replace(/\\/$/, ''),
    );
    if (!reply.success) throw new Error('submit failed: ' + JSON.stringify(reply));
    const wire = txBuilder.serializeUserNewTX(built);
    const wireTX = JSON.parse(wire).TX;
    return {
      tx: {
        TXID: String(wireTX?.TXID || ''),
        TXType: Number(wireTX?.TXType),
        normalInputCount: Array.isArray(wireTX?.TXInputsNormal) ? wireTX.TXInputsNormal.length : -1,
        certificateInputs: (wireTX?.TXInputsCertificate || []).map((input) => ({
          TXCerID: String(input?.TXCerID || ''),
          SettlementAuth: {
            TXCerID: String(input?.SettlementAuth?.TXCerID || ''),
            ConsumeIntentHash: String(input?.SettlementAuth?.ConsumeIntentHash || ''),
            Algorithm: String(input?.SettlementAuth?.UserSignatureV2?.Algorithm || ''),
            HasSignature: Boolean(input?.SettlementAuth?.UserSignatureV2?.Signature),
          },
        })),
      },
      reply: {
        success: true,
        tx_id: String(reply?.tx_id || wireTX?.TXID || ''),
      },
    };
  })()`;
}

function browserEvidenceExpression() {
  return `(async () => {
    const storage = await import('/js/utils/storage.ts');
    const user = storage.loadUser();
    const records = user?.wallet?.txCerIssuanceRecords || {};
    const statuses = user?.wallet?.txCerStatuses || {};
    return Object.entries(records).map(([txCerID, metadata]) => ({
      txCerID,
      lifecycleStatus: statuses[txCerID]?.status || metadata?.lifecycleStatus || metadata?.issuanceStatus || '',
      fastEvidenceStatus: metadata?.security?.fastEvidenceStatus || '',
      cfaaAuditStatus: metadata?.security?.cfaaAuditStatus || '',
      hasFastEvidence: Boolean(metadata?.fastEvidence || metadata?.issuanceRecord?.FastEvidence),
      hasAck: Boolean(metadata?.assignAck || metadata?.issuanceRecord?.Ack),
      hasReceipt: Boolean(metadata?.liabilityReceipt || metadata?.issuanceRecord?.LiabilityReceipt),
      exposureShareCount: (metadata?.txCer?.ExposureShares || metadata?.issuanceRecord?.TXCer?.ExposureShares || []).length,
    }));
  })()`;
}

function browserTXCerStateExpression() {
  return `(async () => {
    const storage = await import('/js/utils/storage.ts');
    const user = storage.loadUser();
    const group = storage.getJoinedGroup();
    const wallet = user?.wallet || {};
    return {
      accountID: String(user?.accountId || ''),
      groupID: String(group?.groupID || ''),
      txCerIDs: Object.keys(wallet.totalTXCers || {}),
      issuanceRecordIDs: Object.keys(wallet.txCerIssuanceRecords || {}),
      lifecycleIDs: Object.keys(wallet.txCerStatuses || {}),
    };
  })()`;
}

async function readQueuedTXCerSummary(base, groupID, userID) {
  const url = new URL(`/api/v1/${encodeURIComponent(groupID)}/assign/poll-cross-org-txcers`, base);
  url.searchParams.set('userID', String(userID));
  url.searchParams.set('limit', '10');
  url.searchParams.set('consume', 'false');
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`cross-org TXCer queue query failed: ${response.status} ${await response.text()}`);
  }
  const payload = await response.json();
  return {
    count: Number(payload?.count || 0),
    txCerIDs: (payload?.txcers || []).map((item) => String(item?.TXCer?.TXCerID || '')),
    hasIssuanceRecord: (payload?.txcers || []).map((item) => Boolean(item?.IssuanceRecordID)),
  };
}

async function waitForQueuedTXCer(base, groupID, userID, attempts = 80) {
  let last = { count: 0, txCerIDs: [], hasIssuanceRecord: [] };
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    last = await readQueuedTXCerSummary(base, groupID, userID);
    if (last.count > 0) return last;
    await sleep(250);
  }
  throw new Error(`backend did not expose a queued TXCer for ${userID}: ${JSON.stringify(last)}`);
}

async function waitForReceivedTXCer(client, label, attempts = 240) {
  let last = {};
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    last = await evaluate(client, browserTXCerStateExpression());
    if (last.txCerIDs.length > 0) return last;
    await sleep(250);
  }
  throw new Error(`timed out waiting for ${label}: ${JSON.stringify(last)}`);
}

async function waitForEvidence(client, state, label, attempts = 240) {
  let last = [];
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    last = await evaluate(client, browserEvidenceExpression());
    const found = last.find((entry) => entry.fastEvidenceStatus === state);
    if (found) return found;
    await sleep(250);
  }
  const wallet = await evaluate(client, browserTXCerStateExpression());
  throw new Error(`timed out waiting for ${label}: ${JSON.stringify({ records: last, wallet })}`);
}

async function activatePolling(client) {
  return evaluate(client, `(async () => {
    const polling = await import('/js/services/accountPolling.ts');
    polling.restartCrossOrgTXCerPolling();
    polling.restartAccountPolling();
    return true;
  })()`);
}

async function flushBrowserWalletPersistence(client, accountID) {
  return evaluate(client, `(async () => {
    const storage = await import('/js/utils/storage.ts');
    const persistence = await import('/js/utils/statePersistence.ts');
    const user = storage.loadUser();
    if (!user || String(user.accountId) !== ${JSON.stringify(String(accountID))}) {
      throw new Error('cannot flush unexpected browser account: ' + String(user?.accountId || ''));
    }
    persistence.flushUserPersistence();
    await new Promise((resolve) => setTimeout(resolve, 0));
    return {
      accountID: String(user.accountId),
      txCerIDs: Object.keys(user.wallet?.totalTXCers || {}),
      issuanceRecordIDs: Object.keys(user.wallet?.txCerIssuanceRecords || {}),
    };
  })()`);
}

function assertPureTXCer(tx) {
  if (tx?.TXType !== 1) throw new Error(`second payment is not TXType=1: ${JSON.stringify(tx)}`);
  if (tx.normalInputCount !== 0) {
    throw new Error('second payment has normal UTXO inputs');
  }
  if (!Array.isArray(tx.certificateInputs) || tx.certificateInputs.length === 0) {
    throw new Error('second payment has no TXCer inputs');
  }
  if (!/^[0-9a-f]{64}$/i.test(String(tx.TXID || ''))) {
    throw new Error(`second payment TXID is not 64 hex: ${tx.TXID}`);
  }
  for (const input of tx.certificateInputs) {
    const auth = input?.SettlementAuth;
    if (!auth?.TXCerID || auth.TXCerID !== input.TXCerID || !auth.ConsumeIntentHash
      || !auth.Algorithm || !auth.HasSignature) {
      throw new Error(`incomplete SettlementAuth: ${JSON.stringify(input)}`);
    }
  }
}

async function assertDiscoveredCommitteeHealthy(endpoint) {
  const base = String(endpoint || '').replace(/\/$/, '');
  const response = await fetch(`${base}/api/v1/com/health`);
  if (!response.ok) {
    throw new Error(`node discovery is not ready: ${base}/api/v1/com/health returned ${response.status} ${await response.text()}`);
  }
}

async function readGQNC(base) {
  const [status, safety, actions] = await Promise.all([
    fetch(`${base}/api/v1/committee/gqnc/status`).then((response) => response.json()),
    fetch(`${base}/api/v1/committee/gqnc/safety`).then((response) => response.json()),
    fetch(`${base}/api/v1/committee/gqnc/actions`).then((response) => response.json()),
  ]);
  return {
    status,
    safety,
    actions,
    height: Number(status?.status?.certifiedHeight || 0),
    rejected: (actions?.actions || [])
      .filter((action) => String(action?.status || '') === 'Rejected')
      .map((action) => String(action?.actionID || '')),
  };
}

function assertGQNCHealthy(checkpoint, baselineRejected) {
  const encoded = JSON.stringify(checkpoint);
  if (encoded.includes('WAIT_EXTERNAL_RECOVERY') || encoded.includes('SAFETY_BREACH')) {
    throw new Error(`GQNC entered fail-closed recovery: ${encoded.slice(0, 4000)}`);
  }
  const baseline = new Set(baselineRejected);
  const newlyRejected = checkpoint.rejected.filter((actionID) => !baseline.has(actionID));
  if (newlyRejected.length > 0) {
    throw new Error(`GQNC rejected new actions: ${JSON.stringify(newlyRejected)}`);
  }
}

async function waitForCertifiedTransactions(base, txIDs, baseline) {
  const wanted = new Set(txIDs);
  const found = new Map();
  let nextHeight = baseline.height + 1;
  const deadline = Date.now() + Number(process.env.PANGU_WEB_GQNC_TIMEOUT_MS || 120000);
  while (Date.now() < deadline) {
    const checkpoint = await readGQNC(base);
    assertGQNCHealthy(checkpoint, baseline.rejected);
    while (nextHeight <= checkpoint.height) {
      const reply = await fetch(`${base}/api/v1/committee/gqnc/certified-block/${nextHeight}`)
        .then((response) => response.json());
      const encoded = JSON.stringify(reply?.envelope || {});
      for (const txID of wanted) {
        if (!found.has(txID) && encoded.includes(txID)) {
          found.set(txID, {
            height: nextHeight,
            qcID: String(reply?.envelope?.QC?.QCID || ''),
          });
        }
      }
      nextHeight += 1;
    }
    if (found.size === wanted.size) return Object.fromEntries(found);
    await sleep(500);
  }
  throw new Error(`timed out waiting for GQNC certification: ${JSON.stringify({
    wanted: [...wanted], found: [...found],
  })}`);
}

async function closeEdge() {
  const process = edgeProcess;
  for (const client of [...openClients]) client.close();
  await closeEdgeGracefully();
  const deadline = Date.now() + 5000;
  while (process?.exitCode === null && Date.now() < deadline) {
    await sleep(100);
  }
  if (process?.exitCode === null) stopProcessTree(process);
  edgeProcess = null;
  await sleep(250);
}

async function runFlow() {
  if (!fs.existsSync(backendRoot)) throw new Error(`UTXO-Area root not found: ${backendRoot}`);
  const edgePath = findEdgePath();
  if (!edgePath) throw new Error('Microsoft Edge was not found');

  log('starting a fresh 4-validator backend');
  startBackend();
  await waitForFile(readyFile, Number(process.env.PANGU_WEB_BACKEND_READY_TIMEOUT_MS || 480000));
  const ready = JSON.parse(fs.readFileSync(readyFile, 'utf8').replace(/^\uFEFF/, ''));
  if (!ready?.ready || !ready?.gatewayBase || !ready?.groupID || !ready?.configPath) {
    throw new Error(`invalid backend ready payload: ${JSON.stringify(ready)}`);
  }
  const fixture = prepareFixture(ready);
  const gatewayBase = String(fixture.gatewayBase).replace(/\/$/, '');
  const committeeReply = await fetch(`${gatewayBase}/api/v1/committee/endpoint`)
    .then(async (response) => {
      if (!response.ok) throw new Error(`committee endpoint query failed: ${response.status} ${await response.text()}`);
      return response.json();
    });
  const rawCommitteeEndpoint = String(committeeReply?.endpoint || '').trim();
  if (!rawCommitteeEndpoint) throw new Error(`committee endpoint is empty: ${JSON.stringify(committeeReply)}`);
  fixture.comNodeEndpoint = /^https?:\/\//i.test(rawCommitteeEndpoint)
    ? rawCommitteeEndpoint
    : `http://${rawCommitteeEndpoint.replace(/^:/, '127.0.0.1:')}`;
  await assertDiscoveredCommitteeHealthy(fixture.comNodeEndpoint);
  const baseline = await readGQNC(gatewayBase);
  const timings = {};

  log('starting Vite and Edge');
  startVite();
  await waitForHttp(`http://127.0.0.1:${webPort}/`, 30000);
  startEdge(edgePath);
  let page = await openWebPage(fixture);

  log('bootstrapping Alice and submitting A→B');
  await evaluate(page, browserBootstrapUserExpression('alice'));
  const firstSubmissionStartedAt = Date.now();
  const first = await evaluate(page, browserSubmitExpression('alice', 'bob', '12', false));
  timings.firstAssignAcceptedMs = Date.now() - firstSubmissionStartedAt;
  if (!first?.reply?.success || !/^[0-9a-f]{64}$/i.test(String(first?.tx?.TXID || ''))) {
    throw new Error(`invalid first submission: ${JSON.stringify(first)}`);
  }

  log('switching to Bob and waiting for Active TXCer + FastEvidence');
  const queuedBeforeDelivery = await waitForQueuedTXCer(gatewayBase, fixture.groupID, fixture.bob.accountID);
  log(`backend queued TXCer delivery: ${JSON.stringify(queuedBeforeDelivery)}`);
  await evaluate(page, browserBootstrapUserExpression('bob'));
  await activatePolling(page);
  const receivedBeforeRestart = await waitForReceivedTXCer(page, 'Bob Active TXCer before evidence verification');
  log(`Bob stored TXCer delivery: ${JSON.stringify(receivedBeforeRestart)}`);
  const beforeRestart = await waitForEvidence(page, 'Verified', 'Bob FastEvidence before restart');
  timings.firstTXCerVerifiedMs = Date.now() - firstSubmissionStartedAt;
  if (!beforeRestart.hasFastEvidence || !beforeRestart.hasAck || !beforeRestart.hasReceipt) {
    throw new Error(`Bob evidence is incomplete: ${JSON.stringify(beforeRestart)}`);
  }
  const persistedBeforeRestart = await flushBrowserWalletPersistence(page, fixture.bob.accountID);
  log(`Bob persisted wallet before restart: ${JSON.stringify(persistedBeforeRestart)}`);

  log('restarting Edge with the same profile; issuance endpoint is temporarily blocked');
  await closeEdge();
  startEdge(edgePath);
  page = await openWebPage(fixture, { blockIssuance: true });
  const pending = await waitForEvidence(page, 'Pending', 'Bob evidence Pending after restart');

  log('unblocking authority lookup and re-verifying cached evidence');
  await page.send('Fetch.disable');
  await activatePolling(page);
  const afterRestart = await waitForEvidence(page, 'Verified', 'Bob FastEvidence after replay');
  timings.evidenceReverifiedMs = Date.now() - firstSubmissionStartedAt;
  if (beforeRestart.txCerID !== pending.txCerID || pending.txCerID !== afterRestart.txCerID) {
    throw new Error('TXCerID changed across browser restart');
  }

  log('submitting Bob→Alice with pure TXCer input');
  const secondSubmissionStartedAt = Date.now();
  const second = await evaluate(page, browserSubmitExpression('bob', 'alice', '5', true));
  timings.secondAssignAcceptedMs = Date.now() - secondSubmissionStartedAt;
  assertPureTXCer(second?.tx);

  log('waiting for exact GQNC certification of both transactions');
  const certified = await waitForCertifiedTransactions(
    gatewayBase,
    [String(first.tx.TXID), String(second.tx.TXID)],
    baseline,
  );
  timings.gqncCertifiedMs = Date.now() - firstSubmissionStartedAt;
  log(`passed: ${JSON.stringify({
    firstTXID: first.tx.TXID,
    secondTXID: second.tx.TXID,
    txCerID: afterRestart.txCerID,
    evidenceReplay: ['Verified', 'Pending', 'Verified'],
    certified,
    timings,
  })}`);
}

async function cleanup() {
  try { fs.writeFileSync(stopFile, 'stop\n'); } catch { /* best effort */ }
  await closeEdge();
  stopProcessTree(viteProcess);
  if (backendProcess && backendProcess.exitCode === null) {
    const deadline = Date.now() + 60000;
    while (backendProcess.exitCode === null && Date.now() < deadline) await sleep(500);
    if (backendProcess.exitCode === null) stopProcessTree(backendProcess);
  }
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* best effort */ }
}

runFlow()
  .catch((error) => {
    console.error(`[test:real-browser] ${error.stack || error.message || error}`);
    process.exitCode = 1;
  })
  .finally(cleanup);
