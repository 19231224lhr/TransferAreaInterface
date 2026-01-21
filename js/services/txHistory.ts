/**
 * Transaction history storage and helpers.
 *
 * Stores history on the user object; login/new entry resets it and logout clears storage.
 */

import { loadUser, saveUser, TxHistoryRecord } from '../utils/storage';

const HISTORY_LIMIT = 200;
const HISTORY_EVENT = 'pangu_tx_history_change';
const CUSTOM_START_TIME = new Date('2020-01-01T00:00:00Z').getTime();
const CUSTOM_START_SECONDS = Math.floor(CUSTOM_START_TIME / 1000);

function normalizeTimestamp(ts?: number | string): number {
  let raw = typeof ts === 'string' ? Number(ts) : (ts ?? 0);
  if (!Number.isFinite(raw) || raw <= 0) {
    return Date.now();
  }

  // Fix accidental millisecond * 1000 values (far future).
  while (raw > 1e13) {
    raw = Math.floor(raw / 1000);
  }

  if (raw < 1e12) {
    if (raw < CUSTOM_START_SECONDS) {
      return CUSTOM_START_TIME + raw * 1000;
    }
    if (raw < 1e10) {
      return raw * 1000;
    }
    return CUSTOM_START_TIME + raw;
  }

  if (raw < CUSTOM_START_TIME) {
    return CUSTOM_START_TIME + raw;
  }

  return raw;
}

function getRawHistory(): TxHistoryRecord[] {
  const user = loadUser();
  const history = user?.txHistory;
  const list = Array.isArray(history) ? [...history] : [];
  if (!list.length || !user?.accountId) return list;

  let changed = false;
  for (const item of list) {
    const normalized = normalizeTimestamp(item.timestamp);
    if (normalized !== item.timestamp) {
      item.timestamp = normalized;
      changed = true;
    }
  }

  if (changed) {
    saveUser({ accountId: user.accountId, txHistory: list });
  }

  return list;
}

function sortHistory(list: TxHistoryRecord[]): TxHistoryRecord[] {
  return list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

function dispatchHistoryUpdate(list: TxHistoryRecord[]): void {
  try {
    window.dispatchEvent(new CustomEvent(HISTORY_EVENT, { detail: list }));
  } catch {
    // ignore
  }
}

function saveHistory(list: TxHistoryRecord[]): TxHistoryRecord[] {
  const sorted = sortHistory(list);
  const trimmed = sorted.slice(0, HISTORY_LIMIT);
  const user = loadUser();
  if (user?.accountId) {
    console.debug('[TxHistory/saveHistory] Saving', trimmed.length, 'records for', user.accountId);
    saveUser({ accountId: user.accountId, txHistory: trimmed });
  }
  dispatchHistoryUpdate(trimmed);
  return trimmed;
}

export function getTxHistory(): TxHistoryRecord[] {
  const history = sortHistory(getRawHistory());
  console.debug('[TxHistory/getTxHistory] Returning', history.length, 'records');
  return history;
}

export function addTxHistoryRecords(
  records: TxHistoryRecord | TxHistoryRecord[]
): TxHistoryRecord[] {
  const user = loadUser();
  if (!user) return [];

  const list = getRawHistory();
  const map = new Map(list.map((item) => [item.id, item]));
  const incoming = Array.isArray(records) ? records : [records];
  let changed = false;

  console.debug('[TxHistory/addTxHistoryRecords] Adding', incoming.length, 'records. Current history has', list.length, 'records');

  for (const record of incoming) {
    if (!record || !record.id) continue;
    if (map.has(record.id)) {
      console.debug('[TxHistory/addTxHistoryRecords] Skipping duplicate:', record.id);
      continue;
    }
    const normalized: TxHistoryRecord = {
      ...record,
      timestamp: normalizeTimestamp(record.timestamp)
    };
    console.debug('[TxHistory/addTxHistoryRecords] Adding new record:', record.id, record.type, record.transferMode);
    list.push(normalized);
    map.set(record.id, normalized);
    changed = true;
  }

  if (changed) {
    console.debug('[TxHistory/addTxHistoryRecords] Changes detected, saving history');
  }
  return changed ? saveHistory(list) : list;
}

export function updateTxHistoryById(
  id: string,
  patch: Partial<TxHistoryRecord>
): boolean {
  if (!id) return false;
  const user = loadUser();
  if (!user) return false;

  const list = getRawHistory();
  let changed = false;

  for (const item of list) {
    if (item.id === id) {
      Object.assign(item, patch);
      if (patch.timestamp !== undefined) {
        item.timestamp = normalizeTimestamp(patch.timestamp);
      }
      changed = true;
    }
  }

  if (changed) {
    saveHistory(list);
  }
  return changed;
}

export function updateTxHistoryByTxId(
  txId: string,
  patch: Partial<TxHistoryRecord>
): boolean {
  if (!txId) return false;
  const user = loadUser();
  if (!user) return false;

  const list = getRawHistory();
  let changed = false;

  for (const item of list) {
    if (item.txHash === txId) {
      Object.assign(item, patch);
      if (patch.timestamp !== undefined) {
        item.timestamp = normalizeTimestamp(patch.timestamp);
      }
      changed = true;
    }
  }

  if (changed) {
    saveHistory(list);
  }
  return changed;
}

export function hasOutgoingTx(txId: string): boolean {
  if (!txId) return false;
  const list = getRawHistory();
  return list.some((item) => item.type === 'send' && item.txHash === txId);
}

export function getTxHistoryEventName(): string {
  return HISTORY_EVENT;
}

export function normalizeHistoryTimestamp(ts?: number | string): number {
  return normalizeTimestamp(ts);
}
