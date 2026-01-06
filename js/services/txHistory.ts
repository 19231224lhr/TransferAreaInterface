/**
 * Transaction history storage and helpers.
 *
 * Stores history on the user object so it is cleared on logout.
 */

import { loadUser, saveUser, TxHistoryRecord } from '../utils/storage';

const HISTORY_LIMIT = 200;
const HISTORY_EVENT = 'pangu_tx_history_change';

function normalizeTimestamp(ts?: number | string): number {
  const raw = typeof ts === 'string' ? Number(ts) : (ts ?? 0);
  if (!Number.isFinite(raw) || raw <= 0) {
    return Date.now();
  }
  return raw < 1e12 ? raw * 1000 : raw;
}

function getRawHistory(): TxHistoryRecord[] {
  const user = loadUser();
  const history = user?.txHistory;
  return Array.isArray(history) ? [...history] : [];
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
    saveUser({ accountId: user.accountId, txHistory: trimmed });
  }
  dispatchHistoryUpdate(trimmed);
  return trimmed;
}

export function getTxHistory(): TxHistoryRecord[] {
  return sortHistory(getRawHistory());
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

  for (const record of incoming) {
    if (!record || !record.id) continue;
    if (map.has(record.id)) continue;
    const normalized: TxHistoryRecord = {
      ...record,
      timestamp: normalizeTimestamp(record.timestamp)
    };
    list.push(normalized);
    map.set(record.id, normalized);
    changed = true;
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
