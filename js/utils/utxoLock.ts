/**
 * UTXO Lock Management Module
 * 
 * 管理前端 UTXO 锁定状态，用于防止双花。
 * 当用户发送交易后，使用到的 UTXO 会被锁定，直到：
 * 1. 用户点击刷新按钮（清除所有锁定）
 * 2. AssignNode 推送账户更新信息（未来实现）
 * 
 * @module utils/utxoLock
 */

import { loadUser } from './storage';

// ============================================================================
// Types
// ============================================================================

/**
 * 锁定的 UTXO 信息
 */
export interface LockedUTXO {
  /** UTXO 唯一标识 (格式: txid_indexZ 或 txid + indexZ) */
  utxoId: string;
  /** 所属地址 */
  address: string;
  /** UTXO 金额 */
  value: number;
  /** 币种类型: 0=PGC, 1=BTC, 2=ETH */
  type: number;
  /** 锁定时间戳 (毫秒) */
  lockTime: number;
  /** 关联的交易 ID (发送的交易) */
  txId: string;
}

/**
 * 锁定状态存储结构
 */
interface LockedUTXOStorage {
  /** 版本号，用于未来数据迁移 */
  version: number;
  /** 锁定的 UTXO 列表 */
  lockedUtxos: LockedUTXO[];
  /** 最后更新时间 */
  lastUpdate: number;
}

// ============================================================================
// Constants
// ============================================================================

/** 存储键前缀 */
const STORAGE_KEY_PREFIX = 'utxo_locks_';

/** 当前存储版本 */
const STORAGE_VERSION = 1;

/** 锁定过期时间 (24小时，毫秒) - 作为安全机制，超时自动解锁 */
const LOCK_EXPIRY_MS = 24 * 60 * 60 * 1000;

// ============================================================================
// Storage Helpers
// ============================================================================

/**
 * 获取当前用户的存储键
 */
function getStorageKey(): string | null {
  const user = loadUser();
  if (!user?.accountId) return null;
  return `${STORAGE_KEY_PREFIX}${user.accountId}`;
}

/**
 * 从 localStorage 读取锁定状态
 */
function readLockedStorage(): LockedUTXOStorage | null {
  const key = getStorageKey();
  if (!key) return null;
  
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    
    const data = JSON.parse(raw) as LockedUTXOStorage;
    
    // 版本检查
    if (data.version !== STORAGE_VERSION) {
      console.warn('[UTXOLock] Storage version mismatch, clearing');
      localStorage.removeItem(key);
      return null;
    }
    
    return data;
  } catch (e) {
    console.warn('[UTXOLock] Failed to read locked storage:', e);
    return null;
  }
}

/**
 * 写入锁定状态到 localStorage
 */
function writeLockedStorage(data: LockedUTXOStorage): void {
  const key = getStorageKey();
  if (!key) return;
  
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('[UTXOLock] Failed to write locked storage:', e);
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * 锁定指定的 UTXO 列表
 * 
 * @param utxos - 要锁定的 UTXO 信息列表
 * @param txId - 关联的交易 ID
 */
export function lockUTXOs(utxos: Omit<LockedUTXO, 'lockTime' | 'txId'>[], txId: string): void {
  if (!utxos.length) return;
  
  const now = Date.now();
  const storage = readLockedStorage() || {
    version: STORAGE_VERSION,
    lockedUtxos: [],
    lastUpdate: now
  };
  
  // 添加新的锁定 UTXO
  const newLocks: LockedUTXO[] = utxos.map(utxo => ({
    ...utxo,
    lockTime: now,
    txId
  }));
  
  // 合并，避免重复
  const existingIds = new Set(storage.lockedUtxos.map(u => u.utxoId));
  for (const lock of newLocks) {
    if (!existingIds.has(lock.utxoId)) {
      storage.lockedUtxos.push(lock);
      existingIds.add(lock.utxoId);
    }
  }
  
  storage.lastUpdate = now;
  writeLockedStorage(storage);
  
  console.info('[UTXOLock] Locked', newLocks.length, 'UTXOs for TX:', txId);
}

/**
 * 解锁指定的 UTXO 列表
 * 
 * @param utxoIds - 要解锁的 UTXO ID 列表
 */
export function unlockUTXOs(utxoIds: string[]): void {
  if (!utxoIds.length) return;
  
  const storage = readLockedStorage();
  if (!storage) return;
  
  const idsToUnlock = new Set(utxoIds);
  storage.lockedUtxos = storage.lockedUtxos.filter(u => !idsToUnlock.has(u.utxoId));
  storage.lastUpdate = Date.now();
  
  writeLockedStorage(storage);
  
  console.info('[UTXOLock] Unlocked', utxoIds.length, 'UTXOs');
}

/**
 * 按交易 ID 解锁 UTXO
 * 
 * 当交易验证失败时，解锁该交易锁定的所有 UTXO
 * 
 * @param txId - 交易 ID
 */
export function unlockUTXOsByTxId(txId: string): void {
  const storage = readLockedStorage();
  if (!storage) return;
  
  const normalizedTxId = txId.toLowerCase();
  const originalCount = storage.lockedUtxos.length;
  
  storage.lockedUtxos = storage.lockedUtxos.filter(
    u => u.txId.toLowerCase() !== normalizedTxId
  );
  
  const unlockedCount = originalCount - storage.lockedUtxos.length;
  
  if (unlockedCount > 0) {
    storage.lastUpdate = Date.now();
    writeLockedStorage(storage);
    console.info('[UTXOLock] Unlocked', unlockedCount, 'UTXOs for TX:', txId);
  } else {
    console.warn('[UTXOLock] No locked UTXOs found for TX:', txId);
  }
}

/**
 * 获取所有锁定的 UTXO
 * 
 * @param filterExpired - 是否过滤掉已过期的锁定（默认 true）
 * @returns 锁定的 UTXO 列表
 */
export function getLockedUTXOs(filterExpired: boolean = true): LockedUTXO[] {
  const storage = readLockedStorage();
  if (!storage) return [];
  
  const now = Date.now();
  
  if (filterExpired) {
    // 过滤掉过期的锁定
    const validLocks = storage.lockedUtxos.filter(u => 
      (now - u.lockTime) < LOCK_EXPIRY_MS
    );
    
    // 如果有过期的，更新存储
    if (validLocks.length !== storage.lockedUtxos.length) {
      storage.lockedUtxos = validLocks;
      storage.lastUpdate = now;
      writeLockedStorage(storage);
    }
    
    return validLocks;
  }
  
  return storage.lockedUtxos;
}

/**
 * 检查指定 UTXO 是否被锁定
 * 
 * @param utxoId - UTXO ID
 * @returns 是否被锁定
 */
export function isUTXOLocked(utxoId: string): boolean {
  const lockedUtxos = getLockedUTXOs();
  return lockedUtxos.some(u => u.utxoId === utxoId);
}

/**
 * 获取指定地址的锁定 UTXO
 * 
 * @param address - 地址
 * @returns 该地址下锁定的 UTXO 列表
 */
export function getLockedUTXOsByAddress(address: string): LockedUTXO[] {
  const lockedUtxos = getLockedUTXOs();
  const normalizedAddr = address.toLowerCase();
  return lockedUtxos.filter(u => u.address.toLowerCase() === normalizedAddr);
}

/**
 * 清除所有锁定的 UTXO
 * 
 * 当用户点击刷新按钮时调用，从后端获取最新数据后清除本地锁定状态
 */
export function clearAllLockedUTXOs(): void {
  const key = getStorageKey();
  if (!key) return;
  
  try {
    localStorage.removeItem(key);
    console.info('[UTXOLock] Cleared all locked UTXOs');
  } catch (e) {
    console.warn('[UTXOLock] Failed to clear locked storage:', e);
  }
}

/**
 * 清除指定地址的所有锁定 UTXO
 * 
 * 当用户清空某个地址的余额时调用
 * 
 * @param address - 要清除锁定的地址
 */
export function clearLockedUTXOsByAddress(address: string): void {
  const storage = readLockedStorage();
  if (!storage) return;
  
  const normalizedAddr = address.toLowerCase();
  const originalCount = storage.lockedUtxos.length;
  
  storage.lockedUtxos = storage.lockedUtxos.filter(
    u => u.address.toLowerCase() !== normalizedAddr
  );
  
  const removedCount = originalCount - storage.lockedUtxos.length;
  
  if (removedCount > 0) {
    storage.lastUpdate = Date.now();
    writeLockedStorage(storage);
    console.info('[UTXOLock] Cleared', removedCount, 'locked UTXOs for address:', address);
  }
}

/**
 * 获取锁定余额统计
 * 
 * @returns 按币种分类的锁定余额
 */
export function getLockedBalanceSummary(): {
  total: number;
  byType: Record<number, number>;
  count: number;
} {
  const lockedUtxos = getLockedUTXOs();
  
  const byType: Record<number, number> = { 0: 0, 1: 0, 2: 0 };
  let total = 0;
  
  for (const utxo of lockedUtxos) {
    const type = utxo.type;
    if (byType[type] !== undefined) {
      byType[type] += utxo.value;
    }
    total += utxo.value;
  }
  
  return {
    total,
    byType,
    count: lockedUtxos.length
  };
}

/**
 * 获取指定地址的锁定余额
 * 
 * @param address - 地址
 * @returns 锁定余额
 */
export function getLockedBalanceByAddress(address: string): number {
  const lockedUtxos = getLockedUTXOsByAddress(address);
  return lockedUtxos.reduce((sum, u) => sum + u.value, 0);
}

/**
 * 检查 UTXO 是否可用于交易
 * 
 * @param utxoId - UTXO ID
 * @returns 是否可用（未被锁定）
 */
export function isUTXOAvailable(utxoId: string): boolean {
  return !isUTXOLocked(utxoId);
}

/**
 * 获取锁定 UTXO 的详细信息（用于 tooltip 显示）
 * 
 * @param utxoId - UTXO ID
 * @returns 锁定信息或 null
 */
export function getLockedUTXOInfo(utxoId: string): LockedUTXO | null {
  const lockedUtxos = getLockedUTXOs();
  return lockedUtxos.find(u => u.utxoId === utxoId) || null;
}
