/**
 * Account Update Polling Service
 * 
 * 轮询 AssignNode 的账户更新接口，实时同步用户的 UTXO/TXCer 变动。
 * 仅对已加入担保组织的用户启用。
 * 
 * 功能：
 * - 自动轮询账户更新（AccountUpdateInfo）
 * - 处理 UTXO 新增/删除
 * - 处理 TXCer 状态变更
 * - 处理区块高度更新
 * - 解锁已确认的 UTXO
 * 
 * @module services/accountPolling
 */

import { apiClient, isNetworkError, isTimeoutError } from './api';
import { API_ENDPOINTS } from '../config/api';
import { saveUser, getJoinedGroup, User } from '../utils/storage';
import { store, selectUser } from '../utils/store.js';
import { showSuccessToast, showMiniToast, showErrorToast } from '../utils/toast.js';
import { t } from '../i18n/index.js';
import { unlockUTXOs } from '../utils/utxoLock';
import { renderWallet, refreshSrcAddrList, updateWalletBrief } from './wallet';
import { UTXOData } from '../types/blockchain';
import { accrueWalletInterest, normalizeInterestFields } from '../utils/interestAccrual.js';
import { queryAddressBalances } from './accountQuery';
import { applyComNodeInterests } from '../utils/interestSync.js';

// ============================================================================
// Types (匹配后端 Go 结构体)
// ============================================================================

/**
 * 新增 UTXO 信息
 * 对应 Go: InUTXO
 */
interface InUTXO {
  UTXOData: UTXOData;
  IsTXCerUTXO: boolean;
}

/**
 * 账户变动数据
 * 对应 Go: InfoChangeData
 */
interface InfoChangeData {
  /** 转入信息，新增本地账户信息 address -> []InUTXO */
  In: Record<string, InUTXO[]>;
  /** 转出信息，待确认核对信息 []utxo标识符(待确认) */
  Out: string[];
}

/**
 * TXCer 变动信息
 * 对应 Go: TXCerChangeToUser
 */
interface TXCerChangeToUser {
  TXCerID: string;
  /** 变动标识 0：前置交易已上链；1：验证错误，不能使用; 2 没有问题，解除怀疑交易 */
  Status: number;
  /** 当Status为0时，新增UTXO标识 */
  UTXO: string;
  Sig: {
    R: string;
    S: string;
  };
}

/**
 * 已使用 TXCer 变动数据
 * 对应 Go: UsedTXCerChangeData
 */
interface UsedTXCerChangeData {
  TXCerID: string;
  UTXO: UTXOData;
  ToAddress: string;
  ToInterest: number;
}

/**
 * 账户更新信息
 * 对应 Go: AccountUpdateInfo
 */
interface AccountUpdateInfo {
  UserID: string;
  WalletChangeData: InfoChangeData;
  TXCerChangeData: TXCerChangeToUser[];
  UsedTXCerChangeData: UsedTXCerChangeData[];
  Timestamp: number;
  BlockHeight: number;
  /** 是否没有账户变动，若为true，则只更新区块高度就行 */
  IsNoWalletChange: boolean;
  Sig: {
    R: string;
    S: string;
  };
}

/**
 * 轮询响应
 */
interface AccountUpdateResponse {
  success: boolean;
  count: number;
  updates: AccountUpdateInfo[];
}

// ============================================================================
// Module State
// ============================================================================

/** 轮询定时器 ID */
let pollingTimer: ReturnType<typeof setInterval> | null = null;

/** 轮询间隔（毫秒）- 建议 3-5 秒 */
const POLLING_INTERVAL = 3000;

/** 最后一次成功轮询的时间戳 */
let lastPollTimestamp = 0;

/** 连续失败次数 */
let consecutiveFailures = 0;

/** 最大连续失败次数（超过后暂停轮询） */
const MAX_CONSECUTIVE_FAILURES = 5;

/** 是否正在轮询中（防止重叠） */
let isPolling = false;

/** 轮询是否已启动 */
let isPollingStarted = false;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 获取当前用户
 */
function getCurrentUser(): User | null {
  return (selectUser(store.getState()) as User | null) || null;
}

/**
 * 生成 UTXO 唯一标识符（前端格式）
 * 格式: txid_indexZ (下划线分隔)
 */
function generateUTXOId(utxo: UTXOData): string {
  const txid = utxo.UTXO?.TXID || utxo.TXID || '';
  const indexZ = utxo.Position?.IndexZ ?? 0;
  return `${txid}_${indexZ}`;
}

/**
 * 生成 UTXO 唯一标识符（后端格式）
 * 格式: txid + indexZ (空格+加号+空格)
 * 用于兼容后端存储的 UTXO ID
 */
function generateBackendUTXOId(utxo: UTXOData): string {
  const txid = utxo.UTXO?.TXID || utxo.TXID || '';
  const indexZ = utxo.Position?.IndexZ ?? 0;
  return `${txid} + ${indexZ}`;
}

/**
 * 将后端格式的 UTXO ID 转换为前端格式
 * "txid + indexZ" -> "txid_indexZ"
 */
function normalizeUtxoId(id: string): string {
  if (id.includes(' + ')) {
    return id.replace(' + ', '_');
  }
  return id;
}

// ============================================================================
// Core Polling Logic
// ============================================================================

/**
 * 执行一次账户更新轮询
 */
async function pollAccountUpdates(): Promise<void> {
  // 防止重叠轮询
  if (isPolling) {
    console.debug('[AccountPolling] Skipping poll - already in progress');
    return;
  }

  const user = getCurrentUser();
  if (!user?.accountId) {
    console.debug('[AccountPolling] No user logged in, skipping poll');
    return;
  }

  // 检查是否加入了担保组织
  const group = getJoinedGroup();
  if (!group?.groupID) {
    console.debug('[AccountPolling] User not in organization, skipping poll');
    return;
  }

  isPolling = true;

  try {
    const endpoint = `${API_ENDPOINTS.ASSIGN_ACCOUNT_UPDATE(group.groupID)}?userID=${user.accountId}&consume=true`;
    
    // ⚠️ 重要：启用 BigInt 安全解析
    // 后端发送的 UTXO 数据中包含 PublicKeyNew，其 X/Y 坐标是 256 位整数
    // JavaScript 原生 JSON.parse 会丢失精度，导致 TXOutputHash 计算错误
    const response = await apiClient.get<AccountUpdateResponse>(endpoint, {
      timeout: 5000,
      retries: 0,
      silent: true,
      useBigIntParsing: true
    });

    // 重置失败计数
    consecutiveFailures = 0;
    lastPollTimestamp = Date.now();

    if (response.success && response.count > 0) {
      console.info(`[AccountPolling] Received ${response.count} updates`);
      
      for (const update of response.updates) {
        await processAccountUpdate(update);
      }
    }
  } catch (error) {
    consecutiveFailures++;
    
    if (isNetworkError(error)) {
      console.warn('[AccountPolling] Network error - backend may be offline');
    } else if (isTimeoutError(error)) {
      console.warn('[AccountPolling] Request timeout');
    } else {
      console.warn('[AccountPolling] Poll failed:', error);
    }

    // 连续失败过多，暂停轮询
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.warn(`[AccountPolling] Too many failures (${consecutiveFailures}), pausing polling`);
      stopAccountPolling();
      showErrorToast(t('polling.tooManyFailures') || '账户同步暂停，请稍后刷新');
    }
  } finally {
    isPolling = false;
  }
}

/**
 * 处理单个账户更新
 */
async function processAccountUpdate(update: AccountUpdateInfo): Promise<void> {
  const user = getCurrentUser();
  if (!user) return;

  console.info('[AccountPolling] Processing update:', {
    userID: update.UserID,
    blockHeight: update.BlockHeight,
    isNoWalletChange: update.IsNoWalletChange,
    inCount: Object.keys(update.WalletChangeData?.In || {}).length,
    outCount: update.WalletChangeData?.Out?.length || 0,
    txCerChangeCount: update.TXCerChangeData?.length || 0
  });

  // Ensure wallet exists
  if (!user.wallet) {
    console.warn('[AccountPolling] User has no wallet, skipping update');
    return;
  }

  const prevHeight = Number(user.wallet.updateBlock || 0);
  const nextHeight = Number(update.BlockHeight || 0);
  const deltaHeight = nextHeight > prevHeight && prevHeight > 0 ? (nextHeight - prevHeight) : 0;

  // Accrue interest BEFORE applying wallet changes (new UTXO shouldn't generate interest until next block)
  if (deltaHeight > 0) {
    // Normalize legacy fields first so reads/writes are consistent
    for (const meta of Object.values(user.wallet.addressMsg || {})) {
      normalizeInterestFields(meta as any);
    }
    accrueWalletInterest(user.wallet as any, deltaHeight);
  } else {
    // Still normalize fields so UI won't be stuck on stale `gas`
    for (const meta of Object.values(user.wallet.addressMsg || {})) {
      normalizeInterestFields(meta as any);
    }
  }

  // 只更新区块高度
  if (update.IsNoWalletChange) {
    if (nextHeight > prevHeight) {
      user.wallet.updateBlock = nextHeight;
      saveUser(user);

      // If we don't have a solid baseline yet, refresh canonical interest once.
      // (ComNode returns current interest; AssignNode update doesn't.)
      if (!prevHeight || prevHeight <= 0) {
        try {
          const addrs = Object.keys(user.wallet.addressMsg || {});
          if (addrs.length) {
            const qr = await queryAddressBalances(addrs);
            if (qr.success) {
              applyComNodeInterests(user.wallet as any, qr.data as any);
              saveUser(user);
            }
          }
        } catch (e) {
          console.debug('[AccountPolling] ComNode interest refresh skipped (no-change update):', e);
        }
      }

      // Refresh UI so GAS line updates
      renderWallet();
      refreshSrcAddrList();
      updateWalletBrief();

      // Keep the toast but avoid spam if height didn't advance
      showMiniToast(t('polling.blockHeightUpdated', { height: nextHeight }) || `区块高度更新: ${nextHeight}`);
    }
    return;
  }

  let hasChanges = false;

  // 处理转入（新增 UTXO）
  if (update.WalletChangeData?.In) {
    for (const [address, inUtxos] of Object.entries(update.WalletChangeData.In)) {
      if (!inUtxos || inUtxos.length === 0) continue;
      
      const normalizedAddr = address.toLowerCase();
      
      // 确保地址存在于钱包中
      if (!user.wallet.addressMsg[normalizedAddr]) {
        console.warn(`[AccountPolling] Address ${address} not found in wallet, skipping`);
        continue;
      }

      const addrData = user.wallet.addressMsg[normalizedAddr];
      if (!addrData.utxos) {
        addrData.utxos = {};
      }

      for (const inUtxo of inUtxos) {
        // 🔧 使用前端格式的 UTXO ID (txid_indexZ)
        const utxoId = generateUTXOId(inUtxo.UTXOData);
        
        // 🔧 同时检查后端格式的 ID，如果存在则先删除（避免重复）
        const backendFormatId = generateBackendUTXOId(inUtxo.UTXOData);
        if (addrData.utxos[backendFormatId]) {
          console.info(`[AccountPolling] Removing old backend-format UTXO: ${backendFormatId}`);
          delete addrData.utxos[backendFormatId];
        }
        
        // 检查是否已存在（前端格式）
        if (addrData.utxos[utxoId]) {
          console.debug(`[AccountPolling] UTXO ${utxoId} already exists, skipping`);
          continue;
        }

        // [DEBUG] 打印接收到的完整 UTXO 数据，特别是 TXOutputs
        console.info(`[AccountPolling] ========== 接收到新 UTXO ==========`);
        console.info(`[AccountPolling] UTXO ID: ${utxoId}`);
        console.info(`[AccountPolling] Value: ${inUtxo.UTXOData.Value}`);
        console.info(`[AccountPolling] Type: ${inUtxo.UTXOData.Type}`);
        console.info(`[AccountPolling] Position: ${JSON.stringify(inUtxo.UTXOData.Position)}`);
        console.info(`[AccountPolling] UTXO.TXID: ${inUtxo.UTXOData.UTXO?.TXID}`);
        console.info(`[AccountPolling] UTXO.TXOutputs 数量: ${inUtxo.UTXOData.UTXO?.TXOutputs?.length || 0}`);
        if (inUtxo.UTXOData.UTXO?.TXOutputs) {
          inUtxo.UTXOData.UTXO.TXOutputs.forEach((output: any, idx: number) => {
            console.info(`[AccountPolling]   TXOutput[${idx}]: ToAddress=${output.ToAddress?.slice(0, 16)}..., ToValue=${output.ToValue}, Type=${output.Type}`);
          });
        }
        console.info(`[AccountPolling] =====================================`);

        // 添加新 UTXO（使用前端格式 ID）
        addrData.utxos[utxoId] = inUtxo.UTXOData;
        hasChanges = true;
        
        console.info(`[AccountPolling] Added new UTXO: ${utxoId}, value: ${inUtxo.UTXOData.Value}, type: ${inUtxo.UTXOData.Type}`);
      }

      // 重新计算地址余额
      recalculateAddressBalance(addrData);
    }
  }

  // 处理转出（删除/确认 UTXO）
  if (update.WalletChangeData?.Out && update.WalletChangeData.Out.length > 0) {
    const outUtxoIds = update.WalletChangeData.Out;
    
    // 🔧 转换后端 UTXO ID 格式为前端格式
    // 后端格式: "txid + indexZ" (空格+加号+空格)
    // 前端格式: "txid_indexZ" (下划线)
    const normalizedUtxoIds = outUtxoIds.map(normalizeUtxoId);
    
    console.info('[AccountPolling] Out UTXO IDs (original):', outUtxoIds);
    console.info('[AccountPolling] Out UTXO IDs (normalized):', normalizedUtxoIds);
    
    // 解锁这些 UTXO（它们已经被确认使用）
    // 使用转换后的前端格式 ID
    unlockUTXOs(normalizedUtxoIds);
    hasChanges = true; // 解锁操作本身就是一个变化，需要刷新 UI
    
    // 从本地钱包中删除这些 UTXO
    // 🔧 同时尝试删除两种格式的 ID（兼容旧数据）
    for (const [address, addrData] of Object.entries(user.wallet.addressMsg)) {
      if (!addrData.utxos) continue;
      
      for (let i = 0; i < outUtxoIds.length; i++) {
        const backendId = outUtxoIds[i];
        const frontendId = normalizedUtxoIds[i];
        
        // 尝试删除后端格式 ID
        if (addrData.utxos[backendId]) {
          delete addrData.utxos[backendId];
          console.info(`[AccountPolling] Removed UTXO (backend format): ${backendId} from address ${address}`);
        }
        
        // 尝试删除前端格式 ID
        if (addrData.utxos[frontendId]) {
          delete addrData.utxos[frontendId];
          console.info(`[AccountPolling] Removed UTXO (frontend format): ${frontendId} from address ${address}`);
        }
      }

      // 重新计算地址余额
      recalculateAddressBalance(addrData);
    }
  }

  // 处理 TXCer 状态变更
  if (update.TXCerChangeData && update.TXCerChangeData.length > 0) {
    for (const txCerChange of update.TXCerChangeData) {
      processTXCerChange(user, txCerChange);
      hasChanges = true;
    }
  }

  // 处理已使用 TXCer 的利息返还
  if (update.UsedTXCerChangeData && update.UsedTXCerChangeData.length > 0) {
    for (const usedTxCer of update.UsedTXCerChangeData) {
      processUsedTXCerChange(user, usedTxCer);
      hasChanges = true;
    }
  }

  // 更新区块高度 (interest already accrued above)
  if (nextHeight > prevHeight) {
    user.wallet.updateBlock = nextHeight;
    hasChanges = true;
  }

  // 保存并刷新 UI
  if (hasChanges) {
    // 重新计算总余额
    recalculateTotalBalance(user);

    // IMPORTANT: AssignNode account-update doesn't include per-address interest snapshots.
    // After a tx is verified by GuarNode, interest is re-assigned (gas deducted) even if
    // there is no explicit interest delta in WalletChangeData. Refresh canonical interest
    // from ComNode so UI shows the correct GAS (e.g. 13.00 instead of stale 10.00).
    try {
      const addrs = Object.keys(user.wallet.addressMsg || {});
      if (addrs.length) {
        const qr = await queryAddressBalances(addrs);
        if (qr.success) {
          applyComNodeInterests(user.wallet as any, qr.data as any);
        }
      }
    } catch (e) {
      console.debug('[AccountPolling] ComNode interest refresh failed, using local accrual only:', e);
    }
    
    saveUser(user);
    
    // 刷新钱包 UI
    renderWallet();
    refreshSrcAddrList();
    updateWalletBrief();
    
    showSuccessToast(t('polling.accountUpdated') || '账户信息已更新');
  }
}

/**
 * 处理 TXCer 状态变更
 */
function processTXCerChange(user: User, change: TXCerChangeToUser): void {
  console.info(`[AccountPolling] TXCer change: ${change.TXCerID}, status: ${change.Status}`);

  switch (change.Status) {
    case 0:
      // 前置交易已上链，TXCer 转换为 UTXO
      // 需要从 TXCer 列表中移除，UTXO 会通过 In 字段添加
      removeTXCerFromWallet(user, change.TXCerID);
      showMiniToast(t('polling.txCerConfirmed', { id: change.TXCerID.slice(0, 8) }) || `TXCer ${change.TXCerID.slice(0, 8)}... 已确认`);
      break;
    
    case 1:
      // 验证错误，TXCer 不能使用
      markTXCerAsInvalid(user, change.TXCerID);
      showErrorToast(t('polling.txCerInvalid', { id: change.TXCerID.slice(0, 8) }) || `TXCer ${change.TXCerID.slice(0, 8)}... 验证失败`);
      break;
    
    case 2:
      // 解除怀疑，TXCer 可以正常使用
      markTXCerAsValid(user, change.TXCerID);
      showMiniToast(t('polling.txCerCleared', { id: change.TXCerID.slice(0, 8) }) || `TXCer ${change.TXCerID.slice(0, 8)}... 已解除怀疑`);
      break;
    
    default:
      console.warn(`[AccountPolling] Unknown TXCer status: ${change.Status}`);
  }
}

/**
 * 处理已使用 TXCer 的利息返还
 */
function processUsedTXCerChange(user: User, usedTxCer: UsedTXCerChangeData): void {
  console.info(`[AccountPolling] Used TXCer interest: ${usedTxCer.TXCerID}, address: ${usedTxCer.ToAddress}, interest: ${usedTxCer.ToInterest}`);

  const normalizedAddr = usedTxCer.ToAddress.toLowerCase();
  const addrData = user.wallet.addressMsg[normalizedAddr];
  
  if (addrData) {
    // 增加利息（保持 EstInterest/estInterest/gas 一致）
    normalizeInterestFields(addrData as any);
    const base = Number((addrData as any).EstInterest ?? (addrData as any).estInterest ?? (addrData as any).gas ?? 0) || 0;
    const next = base + usedTxCer.ToInterest;
    (addrData as any).EstInterest = next;
    (addrData as any).estInterest = next;
    (addrData as any).gas = next;
    showMiniToast(t('polling.interestReceived', { amount: usedTxCer.ToInterest.toFixed(2) }) || `收到利息: ${usedTxCer.ToInterest.toFixed(2)}`);
  }
}

/**
 * 从钱包中移除 TXCer
 */
function removeTXCerFromWallet(user: User, txCerId: string): void {
  for (const addrData of Object.values(user.wallet.addressMsg)) {
    if (addrData.txCers && addrData.txCers[txCerId] !== undefined) {
      delete addrData.txCers[txCerId];
      recalculateAddressBalance(addrData);
      return;
    }
  }
  
  // 也检查总 TXCer 列表
  if (user.wallet.totalTXCers && user.wallet.totalTXCers[txCerId] !== undefined) {
    delete user.wallet.totalTXCers[txCerId];
  }
}

/**
 * 标记 TXCer 为无效
 */
function markTXCerAsInvalid(user: User, txCerId: string): void {
  // 从钱包中移除无效的 TXCer
  removeTXCerFromWallet(user, txCerId);
}

/**
 * 标记 TXCer 为有效（解除怀疑）
 */
function markTXCerAsValid(_user: User, txCerId: string): void {
  // TXCer 保持在钱包中，无需特殊处理
  console.info(`[AccountPolling] TXCer ${txCerId} marked as valid`);
}

/**
 * 重新计算地址余额
 */
function recalculateAddressBalance(addrData: any): void {
  let utxoValue = 0;
  let txCerValue = 0;

  // 计算 UTXO 余额
  if (addrData.utxos) {
    for (const utxo of Object.values(addrData.utxos) as UTXOData[]) {
      utxoValue += utxo.Value || 0;
    }
  }

  // 计算 TXCer 余额
  if (addrData.txCers) {
    for (const value of Object.values(addrData.txCers) as number[]) {
      txCerValue += value || 0;
    }
  }

  addrData.value = {
    totalValue: utxoValue + txCerValue,
    TotalValue: utxoValue + txCerValue,
    utxoValue,
    txCerValue
  };
}

/**
 * 重新计算总余额
 */
function recalculateTotalBalance(user: User): void {
  const valueDivision: Record<number, number> = { 0: 0, 1: 0, 2: 0 };
  let totalValue = 0;

  for (const addrData of Object.values(user.wallet.addressMsg)) {
    const type = addrData.type || 0;
    const value = addrData.value?.totalValue || addrData.value?.TotalValue || 0;
    
    if (valueDivision[type] !== undefined) {
      valueDivision[type] += value;
    }
    totalValue += value;
  }

  user.wallet.valueDivision = valueDivision;
  user.wallet.ValueDivision = valueDivision;
  user.wallet.totalValue = totalValue;
  user.wallet.TotalValue = totalValue;
  user.wallet.updateTime = Date.now();
}

// ============================================================================
// Public API
// ============================================================================

/**
 * 启动账户更新轮询
 * 
 * 仅对已加入担保组织的用户启用
 */
export function startAccountPolling(): void {
  // 检查是否已启动
  if (isPollingStarted) {
    console.debug('[AccountPolling] Already started');
    return;
  }

  // 检查用户是否加入了担保组织
  const group = getJoinedGroup();
  if (!group?.groupID) {
    console.info('[AccountPolling] User not in organization, polling not started');
    return;
  }

  const user = getCurrentUser();
  if (!user?.accountId) {
    console.info('[AccountPolling] No user logged in, polling not started');
    return;
  }

  console.info(`[AccountPolling] Starting polling for user ${user.accountId} in group ${group.groupID}`);
  
  isPollingStarted = true;
  consecutiveFailures = 0;

  // 立即执行一次
  pollAccountUpdates();

  // 设置定时轮询
  pollingTimer = setInterval(pollAccountUpdates, POLLING_INTERVAL);
}

/**
 * 停止账户更新轮询
 */
export function stopAccountPolling(): void {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
  
  isPollingStarted = false;
  isPolling = false;
  
  console.info('[AccountPolling] Polling stopped');
}

/**
 * 重启账户更新轮询
 * 
 * 用于用户加入组织后或手动刷新后
 */
export function restartAccountPolling(): void {
  stopAccountPolling();
  consecutiveFailures = 0;
  startAccountPolling();
}

/**
 * 检查轮询是否正在运行
 */
export function isAccountPollingActive(): boolean {
  return isPollingStarted && pollingTimer !== null;
}

/**
 * 获取轮询状态信息
 */
export function getPollingStatus(): {
  isActive: boolean;
  lastPollTime: number;
  consecutiveFailures: number;
} {
  return {
    isActive: isAccountPollingActive(),
    lastPollTime: lastPollTimestamp,
    consecutiveFailures
  };
}

/**
 * 手动触发一次轮询
 */
export async function triggerManualPoll(): Promise<void> {
  await pollAccountUpdates();
}

