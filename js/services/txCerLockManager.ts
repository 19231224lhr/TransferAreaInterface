/**
 * TXCer Lock Manager
 * 
 * 解决 TXCer 前置交易上链与用户发送交易的 Race Condition 问题
 * 
 * 核心思路：
 * 1. **构造交易时加锁**：当用户开始构造使用TXCer的交易时，锁定这些TXCer
 * 2. **阻止自动替换**：在锁定期间，即使收到Status=0的通知，也不自动删除TXCer
 * 3. **交易发送后解锁**：交易成功发送到AssignNode后，解除锁定
 * 4. **锁定超时机制**：防止用户取消发送导致永久锁定
 * 5. **缓存待处理更新**：锁定期间收到的TXCer更新会被缓存，解锁后统一处理
 * 
 * @module services/txCerLockManager
 */

import { loadUser } from '../utils/storage';

// ============================================================================
// Types
// ============================================================================

/**
 * TXCer 锁定信息
 */
interface TXCerLock {
    /** TXCer ID */
    txCerId: string;
    /** 锁定时间戳 */
    lockTime: number;
    /** 锁定模式：draft=构造阶段短锁，submitted=已提交交易长锁 */
    mode: 'draft' | 'submitted';
    /** 锁定原因（用于调试） */
    reason: string;
    /** 关联的交易ID（如果已构造） */
    relatedTXID?: string;
}

/**
 * 缓存的 TXCer 状态变更
 */
interface PendingTXCerUpdate {
    txCerId: string;
    status: number;
    utxo?: string;
    receivedTime: number;
}

// ============================================================================
// Module State
// ============================================================================

/** 当前锁定的 TXCer（txCerId -> TXCerLock） */
const lockedTXCers: Map<string, TXCerLock> = new Map();

/** 待处理的 TXCer 更新（在锁定期间收到的更新） */
const pendingUpdates: Map<string, PendingTXCerUpdate> = new Map();

/** 构造阶段锁定超时（毫秒）- 默认 30 秒 */
const DRAFT_LOCK_TIMEOUT = 30000;

/** 已提交交易锁定超时（毫秒）- 默认 24 小时（与 UTXO 锁一致级别） */
const SUBMITTED_LOCK_TIMEOUT = 24 * 60 * 60 * 1000;

/** 存储键前缀 */
const STORAGE_KEY_PREFIX = 'txcer_locks_';
const STORAGE_VERSION = 1;

interface LockedTXCerStorage {
    version: number;
    locks: TXCerLock[];
    lastUpdate: number;
}

/**
 * Get storage key for current user
 */
function getStorageKey(): string | null {
    const user = loadUser();
    if (!user?.accountId) return null;
    return `${STORAGE_KEY_PREFIX}${user.accountId}`;
}

/**
 * Load locks from local storage
 */
function loadLocksFromStorage(): void {
    const key = getStorageKey();
    if (!key) return;

    try {
        const raw = localStorage.getItem(key);
        if (!raw) return;

        const data = JSON.parse(raw) as LockedTXCerStorage;
        if (data.version !== STORAGE_VERSION) {
            console.warn('[TXCerLock] Storage version mismatch, clearing');
            localStorage.removeItem(key);
            return;
        }

        const now = Date.now();
        let restoredCount = 0;

        for (const lock of data.locks) {
            // Check expiry during load
            const timeout = lock.mode === 'submitted' ? SUBMITTED_LOCK_TIMEOUT : DRAFT_LOCK_TIMEOUT;
            if (now - lock.lockTime < timeout) {
                lockedTXCers.set(lock.txCerId, lock);
                restoredCount++;
            }
        }

        if (restoredCount > 0) {
            console.info(`[TXCerLock] Restored ${restoredCount} locks from storage`);
            ensureCleanupTimer();
        }
    } catch (e) {
        console.error('[TXCerLock] Failed to load locks:', e);
    }
}

/**
 * Save locks to local storage
 */
function saveLocksToStorage(): void {
    const key = getStorageKey();
    if (!key) return;

    try {
        const data: LockedTXCerStorage = {
            version: STORAGE_VERSION,
            locks: Array.from(lockedTXCers.values()),
            lastUpdate: Date.now()
        };
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error('[TXCerLock] Failed to save locks:', e);
    }
}

// Initialize persistence
loadLocksFromStorage();

/** 清理定时器 */
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

// ============================================================================
// Core Functions
// ============================================================================

/**
 * 锁定一组 TXCer
 * 
 * 使用场景：用户点击"发送"按钮，开始构造交易
 * 
 * @param txCerIds TXCer ID 数组
 * @param reason 锁定原因（用于调试日志）
 * @param relatedTXID 关联的交易ID（可选）
 * @returns 成功锁定的 TXCer ID 数组
 */
export function lockTXCers(
    txCerIds: string[],
    reason: string = '构造交易中',
    relatedTXID?: string
): string[] {
    const lockedIds: string[] = [];
    const now = Date.now();

    for (const txCerId of txCerIds) {
        // 检查是否已经被锁定
        if (lockedTXCers.has(txCerId)) {
            console.warn(`[TXCerLock] TXCer ${txCerId.slice(0, 8)}... 已被锁定，跳过`);
            continue;
        }

        // 添加锁定
        lockedTXCers.set(txCerId, {
            txCerId,
            lockTime: now,
            mode: 'draft',
            reason,
            relatedTXID
        });

        lockedIds.push(txCerId);
        console.info(`[TXCerLock] ✅ 锁定 TXCer: ${txCerId.slice(0, 8)}... (${reason})`);
    }

    // 启动清理定时器（如果还没启动）
    ensureCleanupTimer();

    // 保存到本地存储
    if (lockedIds.length > 0) {
        saveLocksToStorage();
    }

    return lockedIds;
}

/**
 * 标记一组 TXCer 已随交易提交（长锁），并绑定交易ID。
 *
 * 语义：TXCer 已被某笔 pending 交易消耗，直到交易明确失败/成功前，不应再次被选择。
 */
export function markTXCersSubmitted(txCerIds: string[], relatedTXID: string, reason: string = '交易已提交'): void {
    const now = Date.now();
    for (const txCerId of txCerIds) {
        const existing = lockedTXCers.get(txCerId);
        lockedTXCers.set(txCerId, {
            txCerId,
            lockTime: existing?.lockTime ?? now,
            mode: 'submitted',
            reason,
            relatedTXID
        });

        // 如果构造阶段缓存到了“终态更新”（0/1），提交后应立即放行并处理。
        // 否则可能因为不再收到新的 update 而永远卡在 pendingUpdates 里。
        const pending = pendingUpdates.get(txCerId);
        if (pending && (pending.status === 0 || pending.status === 1)) {
            console.info(
                `[TXCerLock] 📌 TXCer ${txCerId.slice(0, 8)}... 已提交，但已收到终态更新 status=${pending.status}，立即处理并解锁`
            );
            unlockTXCers([txCerId], true);
        }
    }
    ensureCleanupTimer();
    saveLocksToStorage(); // 保存状态变更
}

/** 获取某笔交易关联锁定的 TXCer IDs */
export function getLockedTXCerIdsByTxId(txId: string): string[] {
    const normalized = String(txId || '').toLowerCase();
    if (!normalized) return [];
    const ids: string[] = [];
    for (const lock of lockedTXCers.values()) {
        if ((lock.relatedTXID || '').toLowerCase() === normalized) {
            ids.push(lock.txCerId);
        }
    }
    return ids;
}

/**
 * 解锁一组 TXCer
 * 
 * 使用场景：
 * 1. 交易成功发送到 AssignNode
 * 2. 用户取消发送交易
 * 3. 交易构造失败
 * 
 * @param txCerIds TXCer ID 数组
 * @param processsPending 是否处理缓存的更新（默认true）
 * @returns 成功解锁的数量
 */
export function unlockTXCers(
    txCerIds: string[],
    processPending: boolean = true
): number {
    let unlocked = 0;

    for (const txCerId of txCerIds) {
        if (!lockedTXCers.has(txCerId)) {
            console.debug(`[TXCerLock] TXCer ${txCerId.slice(0, 8)}... 未被锁定，跳过解锁`);
            continue;
        }

        lockedTXCers.delete(txCerId);
        unlocked++;
        console.info(`[TXCerLock] 🔓 解锁 TXCer: ${txCerId.slice(0, 8)}...`);

        // 处理缓存的更新
        if (processPending && pendingUpdates.has(txCerId)) {
            const update = pendingUpdates.get(txCerId)!;
            console.info(`[TXCerLock] 处理缓存的更新: ${txCerId.slice(0, 8)}... status=${update.status}`);

            // 触发延迟的状态变更处理
            processPendingUpdateNow(update);

            // 删除已处理的更新
            pendingUpdates.delete(txCerId);
        }
    }

    if (unlocked > 0) {
        saveLocksToStorage(); // 保存解锁状态
    }

    return unlocked;
}

/**
 * 检查 TXCer 是否被锁定
 * 
 * @param txCerId TXCer ID
 * @returns 是否被锁定
 */
export function isTXCerLocked(txCerId: string): boolean {
    return lockedTXCers.has(txCerId);
}

/**
 * 检查 TXCer 更新是否应该被阻止
 * 
 * 在 accountPolling.ts 的 processTXCerChange 中调用
 * 
 * @param txCerId TXCer ID
 * @param status 状态码
 * @returns 如果返回 true，表示应该缓存此更新而不是立即处理
 */
export function shouldBlockTXCerUpdate(txCerId: string, status: number): boolean {
    const lock = lockedTXCers.get(txCerId);
    if (!lock) {
        return false; // 未锁定，不阻止
    }

    // draft: 构造阶段需要保护，避免“自动替换/删除”打断用户发送。
    // submitted: 交易已提交后，Status=0/1 属于链上/验证的终态信号，必须放行，否则会永久锁住。
    if (status === 0 || status === 1) {
        if (lock.mode === 'draft') {
            console.warn(
                `[TXCerLock] ⚠️ TXCer ${txCerId.slice(0, 8)}... draft 模式被使用中，阻止 status=${status} 的更新（已缓存）`
            );
            return true;
        }
        return false;
    }

    // Status=2（解除怀疑）可以立即处理
    return false;
}

/**
 * 缓存 TXCer 状态更新
 * 
 * 在被阻止的更新中调用
 * 
 * @param txCerId TXCer ID
 * @param status 状态码
 * @param utxo 对应的 UTXO ID（status=0 时）
 */
export function cacheTXCerUpdate(txCerId: string, status: number, utxo?: string): void {
    pendingUpdates.set(txCerId, {
        txCerId,
        status,
        utxo,
        receivedTime: Date.now()
    });

    console.info(
        `[TXCerLock] 📦 缓存更新: ${txCerId.slice(0, 8)}... status=${status}${utxo ? ` utxo=${utxo.slice(0, 16)}...` : ''}`
    );
}

/**
 * 清理超时的锁定
 * 
 * 防止用户取消发送导致永久锁定
 */
function cleanupTimeoutLocks(): void {
    const now = Date.now();
    const toUnlock: string[] = [];

    for (const [txCerId, lock] of lockedTXCers.entries()) {
        const elapsed = now - lock.lockTime;
        const timeout = lock.mode === 'submitted' ? SUBMITTED_LOCK_TIMEOUT : DRAFT_LOCK_TIMEOUT;
        if (elapsed > timeout) {
            console.warn(
                `[TXCerLock] ⏰ TXCer ${txCerId.slice(0, 8)}... 锁定超时 (${Math.round(elapsed / 1000)}s, mode=${lock.mode})，自动解锁`
            );
            toUnlock.push(txCerId);
        }
    }

    if (toUnlock.length > 0) {
        unlockTXCers(toUnlock, true);
    }

    // 如果没有锁定的 TXCer 了，停止定时器
    if (lockedTXCers.size === 0 && cleanupTimer) {
        clearInterval(cleanupTimer);
        cleanupTimer = null;
        console.debug('[TXCerLock] 清理定时器已停止');
    }
}

/**
 * 确保清理定时器运行
 */
function ensureCleanupTimer(): void {
    if (cleanupTimer === null) {
        cleanupTimer = setInterval(cleanupTimeoutLocks, 5000); // 每 5 秒检查一次
        console.debug('[TXCerLock] 清理定时器已启动');
    }
}

/**
 * 立即处理缓存的更新
 * 
 * 这个函数会调用 accountPolling.ts 中的处理函数
 * 
 * @param update 缓存的更新
 */
function processPendingUpdateNow(update: PendingTXCerUpdate): void {
    // 动态导入避免循环依赖
    import('./accountPolling').then(({ processTXCerChangeDirectly }) => {
        if (typeof processTXCerChangeDirectly === 'function') {
            processTXCerChangeDirectly({
                TXCerID: update.txCerId,
                Status: update.status,
                UTXO: update.utxo || '',
                Sig: { R: '', S: '' }
            });
        } else {
            console.warn('[TXCerLock] processTXCerChangeDirectly 函数不存在，跳过处理');
        }
    }).catch(err => {
        console.error('[TXCerLock] 处理缓存更新失败:', err);
    });
}

// ============================================================================
// Public API - 调试与监控
// ============================================================================

/**
 * 获取当前锁定状态
 * 
 * @returns 锁定状态信息
 */
export function getLockStatus(): {
    lockedCount: number;
    pendingCount: number;
    locks: TXCerLock[];
    pending: PendingTXCerUpdate[];
} {
    return {
        lockedCount: lockedTXCers.size,
        pendingCount: pendingUpdates.size,
        locks: Array.from(lockedTXCers.values()),
        pending: Array.from(pendingUpdates.values())
    };
}

/**
 * 强制解锁所有 TXCer（仅用于调试/紧急情况）
 */
export function forceUnlockAll(): void {
    const count = lockedTXCers.size;
    lockedTXCers.clear();
    pendingUpdates.clear();

    if (cleanupTimer) {
        clearInterval(cleanupTimer);
        cleanupTimer = null;
    }

    console.warn(`[TXCerLock] 强制解锁所有 TXCer (${count} 个)`);
    saveLocksToStorage(); // 保存清空状态
}

/**
 * 批量锁定钱包中所有使用的 TXCer
 * 
 * 使用场景：从 transfer.ts 的交易构造参数中提取 TXCer
 * 
 * @param txCers TXCer 对象数组（从 wallet 中提取）
 * @param reason 锁定原因
 * @returns 锁定的 TXCer ID 数组
 */
export function lockTXCersFromWallet(
    txCers: Record<string, number>,
    reason: string = '构造交易'
): string[] {
    const txCerIds = Object.keys(txCers);
    lockTXCers(txCerIds, reason);
    return txCerIds;
}
