import assert from 'node:assert/strict';

const baseUrl = normalizeBaseUrl(process.env.PANGU_GATEWAY_BASE || 'http://127.0.0.1:3001');
const groupID = process.env.PANGU_GROUP_ID || '10000000';
const requireRealFlow = /^(1|true|yes)$/i.test(process.env.PANGU_REQUIRE_REAL_FLOW || '');

async function main() {
  const health = await getJSON('/health');
  assert.equal(health.status, 'ok', 'Gateway /health must return status=ok');
  await resolveNodeEndpoints();
  const assignBase = baseUrl;
  const aggrBase = baseUrl;

  const qcStatusReply = await getJSON('/api/v1/committee/qc/status');
  assert.equal(qcStatusReply.success, true, 'committee QC status query must succeed');
  assert.equal(typeof qcStatusReply.status, 'object', 'committee QC status must include status object');
  assert.equal(qcStatusReply.status.enabled, true, 'committee QC must be enabled by default on the real backend');
  assert.equal(typeof qcStatusReply.status.threshold, 'number', 'committee QC status must include numeric threshold');
  assert.ok(qcStatusReply.status.finalityProfile, 'committee QC status must include finalityProfile');
  const finalizedHeight = Number(qcStatusReply.status.finalizedHeight || 0);
  if (finalizedHeight > 0) {
    const proposals = await getJSON(`/api/v1/committee/qc/proposals?height=${finalizedHeight}`);
    assert.equal(proposals.success, true, 'committee QC proposals query must succeed for finalized height');
    assert.ok(Array.isArray(proposals.proposals), 'committee QC proposals must be an array');
    const qcs = await getJSON(`/api/v1/committee/qc/qcs?height=${finalizedHeight}`);
    assert.equal(qcs.success, true, 'committee QC qcs query must succeed for finalized height');
    assert.ok(Array.isArray(qcs.qcs), 'committee QC qcs must be an array');
    const finalizedBlock = await getJSON(`/api/v1/committee/qc/finalized-block/${finalizedHeight}`);
    assert.equal(finalizedBlock.success, true, 'committee QC finalized block query must succeed');
    assert.ok(finalizedBlock.block, 'committee QC finalized block response must include block');
    assert.ok(finalizedBlock.qc, 'committee QC finalized block response must include qc');
  }

  const aggrCertifiers = await getJSON(`/api/v1/${groupID}/aggr/certifiers`, aggrBase);
  assert.equal(aggrCertifiers.success, true, 'aggr certifiers query must succeed');
  assert.ok(Array.isArray(aggrCertifiers.certifiers), 'aggr certifiers must be an array');
  assert.ok(aggrCertifiers.certifiers.length > 0, 'real backend must expose at least one certifier');

  const assignCertifiers = await getJSON(`/api/v1/${groupID}/assign/certifiers`, assignBase);
  assert.equal(assignCertifiers.success, true, 'assign certifiers query must succeed');
  assert.ok(Array.isArray(assignCertifiers.certifiers), 'assign certifiers must be an array');

  const certifierStats = await getJSON(`/api/v1/${groupID}/aggr/certifier-stats`, aggrBase);
  assert.equal(certifierStats.success, true, 'aggr certifier stats query must succeed');
  assert.equal(typeof certifierStats.stats, 'object', 'certifier stats must be an object');

  const pendingRequests = await getJSON(`/api/v1/${groupID}/aggr/certifier-pending-requests`, aggrBase);
  assert.equal(pendingRequests.success, true, 'aggr certifier pending requests query must succeed');
  assert.ok(Array.isArray(pendingRequests.requests), 'certifier pending requests must be an array');

  const schedulerStats = await getJSON(`/api/v1/${groupID}/assign/scheduler-stats`, assignBase);
  assert.equal(schedulerStats.success, true, 'scheduler stats query must succeed');
  assert.equal(typeof schedulerStats.stats, 'object', 'scheduler stats must include stats object');

  const dagRecords = await getJSON(`/api/v1/${groupID}/assign/scheduler-dag-records?limit=50`, assignBase);
  assert.equal(dagRecords.success, true, 'scheduler DAG records query must succeed');
  assert.ok(Array.isArray(dagRecords.records), 'scheduler DAG records must be an array');

  const dagEvents = await getJSON(`/api/v1/${groupID}/assign/scheduler-dag-events?limit=200`, assignBase);
  assert.equal(dagEvents.success, true, 'scheduler DAG events query must succeed');
  assert.ok(Array.isArray(dagEvents.events), 'scheduler DAG events must be an array');

  await assertListEndpoint(`/api/v1/${groupID}/assign/audit-events?limit=20`, 'events', assignBase);
  await assertListEndpoint(`/api/v1/${groupID}/aggr/audit-events?limit=20`, 'events', aggrBase);
  await assertListEndpoint(`/api/v1/${groupID}/assign/challenges`, 'challenges', assignBase);
  await assertListEndpoint(`/api/v1/${groupID}/aggr/challenges`, 'challenges', aggrBase);
  await assertListEndpoint('/api/v1/com/challenges', 'challenges');
  await assertListEndpoint(`/api/v1/${groupID}/assign/penalties`, 'penalties', assignBase);

  if (requireRealFlow) {
    assert.ok(dagRecords.records.length > 0, 'real flow must leave scheduler DAG records');
    assert.ok(dagEvents.events.length > 0, 'real flow must leave scheduler DAG events');
    const eventTypes = new Set(dagEvents.events.map((event) => event.EventType || event.eventType).filter(Boolean));
    assert.ok(eventTypes.has('submitted'), 'real flow DAG must include submitted event');
    assert.ok(
      eventTypes.has('acquired') || eventTypes.has('queued') || eventTypes.has('dispatched'),
      'real flow DAG must include scheduler progress after submitted'
    );

    const issuanceRecords = await fetchIssuanceRecordsForDAGUsers(dagRecords.records, aggrBase);
    assert.ok(issuanceRecords.length > 0, 'real TXCer flow must expose issuance records for a DAG user');
    const withProof = issuanceRecords.find((record) => record.Proof || record.proof);
    assert.ok(withProof, 'real TXCer issuance record must include proof when includeProof=true');
    const certifierID = withProof.CertifierID || withProof.certifierID || withProof.Proof?.CertifierID || withProof.proof?.CertifierID;
    assert.ok(certifierID, 'real TXCer issuance proof must bind a certifier ID');
    const knownCertifiers = new Set(aggrCertifiers.certifiers.map((item) => item.CertifierID || item.certifierID).filter(Boolean));
    assert.ok(knownCertifiers.has(certifierID), `issuance proof certifier ${certifierID} must exist in aggr registry`);
  }

  console.log(`[real-backend] protocol diagnostics passed (${baseUrl}, group ${groupID})`);
}

async function resolveNodeEndpoints() {
  const groupsReply = await getJSON('/api/v1/groups');
  assert.equal(groupsReply.success, true, 'groups query must succeed');
  assert.ok(Array.isArray(groupsReply.groups), 'groups query must return groups array');
  const group = groupsReply.groups.find((item) => String(item.group_id || item.groupID || item.GroupID || '') === groupID);
  assert.ok(group, `group ${groupID} must be discoverable from BootNode`);
  return {
    assignBase: buildNodeBase(group.assign_api_endpoint || group.assignApiEndpoint || group.AssignAPIEndpoint) || baseUrl,
    aggrBase: buildNodeBase(group.aggr_api_endpoint || group.aggrApiEndpoint || group.AggrAPIEndpoint) || baseUrl,
  };
}

async function fetchIssuanceRecordsForDAGUsers(records, aggrBase) {
  const userIDs = Array.from(new Set(records.map((record) => record.UserID || record.userID).filter(Boolean)));
  const all = [];
  for (const userID of userIDs) {
    const reply = await getJSON(`/api/v1/${groupID}/aggr/txcer-issuance-records?userID=${encodeURIComponent(userID)}&includeProof=true`, aggrBase);
    assert.equal(reply.success, true, `issuance records query must succeed for ${userID}`);
    if (Array.isArray(reply.records)) {
      all.push(...reply.records);
    }
  }
  return all;
}

async function assertListEndpoint(path, field, targetBase = baseUrl) {
  const reply = await getJSON(path, targetBase);
  assert.equal(reply.success, true, `${path} must return success=true`);
  assert.ok(Array.isArray(reply[field]), `${path} must return array field ${field}`);
}

async function getJSON(path, targetBase = baseUrl) {
  const response = await fetch(`${targetBase}${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const body = await response.text();
    assert.fail(`${path} returned HTTP ${response.status}: ${body}`);
  }
  return response.json();
}

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/$/, '');
}

function buildNodeBase(endpoint) {
  const raw = String(endpoint || '').trim();
  if (!raw) return '';
  const base = new URL(baseUrl);
  if (raw.startsWith(':')) {
    return `${base.protocol}//${base.hostname}${raw}`;
  }
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
    const colonIndex = raw.lastIndexOf(':');
    if (colonIndex > 0) {
      const hostPart = raw.slice(0, colonIndex);
      const portPart = raw.slice(colonIndex + 1);
      const resolvedHost = isLocalHost(hostPart) ? base.hostname : hostPart;
      return `${base.protocol}//${resolvedHost}:${portPart}`;
    }
    const resolvedHost = isLocalHost(raw) ? base.hostname : raw;
    return `${base.protocol}//${resolvedHost}`;
  }
  const url = new URL(raw);
  const resolvedHost = isLocalHost(url.hostname) ? base.hostname : url.hostname;
  const port = url.port ? `:${url.port}` : '';
  return `${url.protocol}//${resolvedHost}${port}`;
}

function isLocalHost(host) {
  const value = String(host || '').trim().toLowerCase();
  return value === 'localhost' || value === '127.0.0.1';
}

main().catch((error) => {
  console.error('[real-backend] protocol diagnostics failed:', error);
  process.exitCode = 1;
});
