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
import { parseBigIntJson } from '../utils/bigIntJson';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';
import { saveUser, getJoinedGroup, User } from '../utils/storage';
import { store, selectUser } from '../utils/store.js';
import { showSuccessToast, showMiniToast, showErrorToast, showStatusToast } from '../utils/toast.js';
import { t } from '../i18n/index.js';
import { unlockUTXOs } from '../utils/utxoLock';
import { renderWallet, refreshSrcAddrList, updateWalletBrief, updateTotalGasBadge } from './wallet';
import { UTXOData, TxCertificate } from '../types/blockchain';
import { accrueWalletInterest, normalizeInterestFields } from '../utils/interestAccrual.js';
import { queryAddressBalances } from './accountQuery';
import { applyComNodeInterests } from '../utils/interestSync.js';
import { shouldBlockTXCerUpdate, cacheTXCerUpdate, unlockTXCers } from './txCerLockManager';
import { buildAssignNodeUrl } from './group';
import { getCoinName } from '../config/constants';
import { addTxHistoryRecords, hasOutgoingTx, normalizeHistoryTimestamp, updateTxHistoryByTxId } from './txHistory';

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
 * 跨组织TXCer接收信息
 * 对应 Go: TXCerToUser
 */
interface TXCerToUser {
  ToAddress: string;
  TXCer: TxCertificate;
}

/**
 * 跨组织TXCer轮询响应
 */
interface CrossOrgTXCerResponse {
  success: boolean;
  count: number;
  txcers: TXCerToUser[];
}

/**
 * TXCer变动轮询响应
 */
interface TXCerChangeResponse {
  success: boolean;
  count: number;
  changes: TXCerChangeToUser[];
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
  /** 每个地址的最新利息（Interest/GAS），address -> interest */
  AddressInterest?: Record<string, number>;
  TXCerChangeData: TXCerChangeToUser[];
  UsedTXCerChangeData: UsedTXCerChangeData[];
  Timestamp: number;
  BlockHeight: number;
  ConfirmedTxIDs?: string[];
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

/**
 * 跨组织TXCer轮询响应
 */
interface CrossOrgTXCerResponse {
  success: boolean;
  count: number;
  txcers: TXCerToUser[];
}

// ============================================================================
// Module State
// ============================================================================

/** 轮询定时器 ID */
let pollingTimer: ReturnType<typeof setInterval> | null = null;

/** 轮询间隔（毫秒）- 建议 3-5 秒 */
const POLLING_INTERVAL = 3000;

/** TXCer变动轮询定时器 */
let txCerPollingTimer: ReturnType<typeof setInterval> | null = null;

/** TXCer变动轮询间隔（毫秒） */
const TXCER_POLLING_INTERVAL = 4000;

/** 最后一次成功轮询的时间戳 */
let lastPollTimestamp = 0;

/** 连续失败次数 */
let consecutiveFailures = 0;

/** 最大连续失败次数（超过后暂停轮询） */
const MAX_CONSECUTIVE_FAILURES = 5;

/** 是否正在轮询中（防止重叠） */
let isPolling = false;

/** 是否正在轮询TXCer变动 */
let isPollingTXCer = false;

/** TXCer变动轮询连续失败次数 */
let txcerFailures = 0;

/** 轮询是否已启动 */
let isPollingStarted = false;

/** Flag to track if AssignNode connected toast has been shown this session */
let hasShownAssignNodeConnectedToast = false;

/** Canonical interest sync timer (ComNode query-address) */
let interestSyncTimer: ReturnType<typeof setInterval> | null = null;

/** Prevent overlapping canonical interest sync requests */
let isInterestSyncing = false;

/** Background interest sync interval (ms) */
const INTEREST_SYNC_INTERVAL = 10000;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 获取当前用户
 */
function getCurrentUser(): User | null {
  return (selectUser(store.getState()) as User | null) || null;
}

async function syncCanonicalInterests(force = false): Promise<void> {
  if (isInterestSyncing) {
    return;
  }

  const user = getCurrentUser();
  const addresses = Object.keys(user?.wallet?.addressMsg || {});
  if (!user?.accountId || addresses.length === 0) {
    return;
  }

  if (!force && typeof document !== 'undefined' && document.hidden) {
    return;
  }

  isInterestSyncing = true;

  try {
    const result = await queryAddressBalances(addresses);
    if (!result.success) {
      return;
    }

    const wallet = user.wallet as any;
    const { changed } = applyComNodeInterests(wallet, result.data as any);
    if (!changed) {
      return;
    }

    const syncAt = Date.now();
    for (const balance of result.data) {
      const normalizedAddr = String(balance.address || '').toLowerCase();
      const meta = wallet?.addressMsg?.[normalizedAddr];
      if (!meta) continue;
      (meta as any).lastProtocolSyncAt = syncAt;
    }

    const latestUser = getCurrentUser();
    if (latestUser) {
      latestUser.wallet = user.wallet;
      saveUser(latestUser);
      updateTotalGasBadge(latestUser);
    } else {
      saveUser(user);
      updateTotalGasBadge(user);
    }

    renderWallet();
    refreshSrcAddrList();
    updateWalletBrief();
  } catch (error) {
    console.debug('[AccountPolling] Canonical interest sync skipped:', error);
  } finally {
    isInterestSyncing = false;
  }
}

function startInterestSyncPolling(): void {
  if (interestSyncTimer) {
    return;
  }

  void syncCanonicalInterests(true);
  interestSyncTimer = setInterval(() => {
    void syncCanonicalInterests(false);
  }, INTEREST_SYNC_INTERVAL);
}

function stopInterestSyncPolling(): void {
  if (interestSyncTimer) {
    clearInterval(interestSyncTimer);
    interestSyncTimer = null;
  }
  isInterestSyncing = false;
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

function applyConfirmedTxIDs(update: AccountUpdateInfo): void {
  const confirmed = update.ConfirmedTxIDs;
  if (!Array.isArray(confirmed) || confirmed.length === 0) return;

  for (const txId of confirmed) {
    if (!txId || !hasOutgoingTx(txId)) continue;
    updateTxHistoryByTxId(txId, {
      status: 'success',
      blockNumber: update.BlockHeight || undefined,
      confirmations: 1,
      failureReason: ''
    });
  }
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
async function pollAccountUpdates(force = false): Promise<void> {
  // 防止重叠轮询
  if (isPolling) {
    console.debug('[AccountPolling] Skipping poll - already in progress');
    return;
  }

  if (!force && isSSEActive()) {
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
    // 🔧 Distributed Gateway Support: Use direct AssignNode URL if available
    let baseUrl = '';
    if (group.assignAPIEndpoint) {
      baseUrl = buildAssignNodeUrl(group.assignAPIEndpoint);
      console.debug(`[AccountPolling] Using direct AssignNode URL: ${baseUrl}`);
    }

    // If baseUrl is set (e.g. http://localhost:8082), prepend it.
    // If not, it will be empty and apiClient (via makeRequest) might use default base,
    // BUT api.ts makeRequest logic is: if url is absolute, use it.
    // So we just construct the full URL here.

    const path = API_ENDPOINTS.ASSIGN_ACCOUNT_UPDATE(group.groupID);
    const endpoint = baseUrl ? `${baseUrl}${path}?userID=${user.accountId}&consume=true`
      : `${path}?userID=${user.accountId}&consume=true`;

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
    txCerChangeCount: update.TXCerChangeData?.length || 0,
    addressInterestCount: Object.keys(update.AddressInterest || {}).length
  });

  // Ensure wallet exists
  if (!user.wallet) {
    console.warn('[AccountPolling] User has no wallet, skipping update');
    return;
  }

  applyConfirmedTxIDs(update);

  const prevHeight = Number(user.wallet.updateBlock || 0);
  const nextHeight = Number(update.BlockHeight || 0);
  const deltaHeight = nextHeight > prevHeight && prevHeight > 0 ? (nextHeight - prevHeight) : 0;

  // Accrue interest BEFORE applying wallet changes (new UTXO shouldn't generate interest until next block)
  let interestAccrued = false;
  if (deltaHeight > 0) {
    // Normalize legacy fields first so reads/writes are consistent
    for (const meta of Object.values(user.wallet.addressMsg || {})) {
      normalizeInterestFields(meta as any);
    }
    const { changed } = accrueWalletInterest(user.wallet as any, deltaHeight);
    interestAccrued = changed;
  } else {
    // Still normalize fields so UI won't be stuck on stale `gas`
    for (const meta of Object.values(user.wallet.addressMsg || {})) {
      normalizeInterestFields(meta as any);
    }
  }

  // IMPORTANT: If interest was accrued, save immediately to ensure Store consistency
  // This prevents the mismatch between UI display (reading mutated object) and 
  // transfer validation (reading from Store which might have stale data)
  if (interestAccrued) {
    // IMPORTANT: 重新获取最新用户数据以包含 txHistory
    const latestUser = getCurrentUser();
    if (latestUser) {
      latestUser.wallet = user.wallet;
      saveUser(latestUser);
    } else {
      saveUser(user);
    }
  }

  // 只更新区块高度（无钱包 UTXO 变化）
  if (update.IsNoWalletChange) {
    let hasChangesInNoWallet = false;
    
    if (nextHeight > prevHeight) {
      user.wallet.updateBlock = nextHeight;
      hasChangesInNoWallet = true;
    }

    // 🔧 关键修复：即使没有钱包 UTXO 变化，也要处理 AddressInterest 更新
    // 后端在每个区块后都会返回最新的利息数据，必须同步到前端
    if (update.AddressInterest && Object.keys(update.AddressInterest).length > 0) {
      console.info('[AccountPolling] IsNoWalletChange=true, but applying AddressInterest:', update.AddressInterest);

      for (const [address, interest] of Object.entries(update.AddressInterest)) {
        const normalizedAddr = address.toLowerCase();
        const addrData = user.wallet.addressMsg[normalizedAddr];

        if (addrData) {
          const prevInterest = Number((addrData as any).EstInterest ?? (addrData as any).estInterest ?? (addrData as any).gas ?? 0);
          const newInterest = Number(interest);

          // 更新所有利息字段（保持一致性）
          (addrData as any).EstInterest = newInterest;
          (addrData as any).estInterest = newInterest;
          (addrData as any).gas = newInterest;

          console.info(`[AccountPolling] Updated interest for ${normalizedAddr.slice(0, 10)}...: ${prevInterest.toFixed(4)} -> ${newInterest.toFixed(4)}`);
          hasChangesInNoWallet = true;
        }
      }
    }

    if (hasChangesInNoWallet) {
      // IMPORTANT: 重新获取最新用户数据以包含 txHistory
      let latestUser = getCurrentUser();
      if (latestUser) {
        latestUser.wallet = user.wallet;
        saveUser(latestUser);
      } else {
        saveUser(user);
      }

      // If we don't have a solid baseline yet, refresh canonical interest once.
      // (ComNode returns current interest; AssignNode update doesn't.)
      if (!prevHeight || prevHeight <= 0) {
        try {
          const addrs = Object.keys(user.wallet.addressMsg || {});
          if (addrs.length) {
            const qr = await queryAddressBalances(addrs);
            if (qr.success) {
              applyComNodeInterests(user.wallet as any, qr.data as any);
              
              // 再次重新获取最新用户
              latestUser = getCurrentUser();
              if (latestUser) {
                latestUser.wallet = user.wallet;
                saveUser(latestUser);
              } else {
                saveUser(user);
              }
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

      showSuccessToast(
        t('polling.accountUpdated') || '账户信息已更新',
        t('notification.accountUpdate') || '账户更新'
      );
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
        const incomingOutput = inUtxo.UTXOData?.UTXO?.TXOutputs?.[inUtxo.UTXOData?.Position?.IndexZ ?? 0];
        if (incomingOutput?.SeedAnchor) {
          (addrData as any).seedAnchor = incomingOutput.SeedAnchor;
        }
        if (incomingOutput?.SeedChainStep) {
          (addrData as any).seedChainStep = incomingOutput.SeedChainStep;
          if ((addrData as any).pendingNextSeedStep && Number((addrData as any).pendingNextSeedStep) === Number(incomingOutput.SeedChainStep)) {
            delete (addrData as any).pendingSeedStep;
            delete (addrData as any).pendingNextSeedStep;
            delete (addrData as any).pendingSeedTxId;
            delete (addrData as any).pendingSeedAt;
          }
        }
        if (incomingOutput?.DefaultSpendAlgorithm) {
          (addrData as any).defaultSpendAlgorithm = incomingOutput.DefaultSpendAlgorithm;
        }
        hasChanges = true;

        console.info(`[AccountPolling] Added new UTXO: ${utxoId}, value: ${inUtxo.UTXOData.Value}, type: ${inUtxo.UTXOData.Type}`);

        // 🔔 跨链转入通知：如果是来自轻计算区的交易 (TXType 7 或 FromAddress="Lightweight Computing Zone")
        const tx = inUtxo.UTXOData.UTXO;
        const inboundTxId = tx?.TXID || inUtxo.UTXOData.TXID || '';
        const isCrossChainInbound = tx?.TXType === 7 ||
          (tx?.TXInputsNormal && tx.TXInputsNormal.length > 0 && tx.TXInputsNormal[0].FromAddress === "Lightweight Computing Zone");
        const inferredMode = isCrossChainInbound
          ? 'cross'
          : (tx?.TXType === 8 ? 'normal' : 'quick');
        
        // 添加接收记录的条件：
        // 1. 必须有交易 ID
        // 2. 这个交易不是本地发起的发送交易（避免重复记录）
        if (inboundTxId && !hasOutgoingTx(inboundTxId)) {
          const fromAddr = tx?.TXInputsNormal?.[0]?.FromAddress || '-';
          const blockNumber = Number(inUtxo.UTXOData.Position?.Blocknum || update.BlockHeight || 0);
          const confirmations = blockNumber && update.BlockHeight
            ? Math.max(1, Number(update.BlockHeight) - blockNumber + 1)
            : undefined;
          
          console.info(`[AccountPolling] Adding receive history: id=in_${utxoId}, mode=${inferredMode}, from=${fromAddr.slice(0, 16)}...`);
          
          addTxHistoryRecords({
            id: `in_${utxoId}`,
            type: 'receive',
            status: 'success',
            transferMode: inferredMode,
            amount: Number(inUtxo.UTXOData.Value || 0) || 0,
            currency: getCoinName(inUtxo.UTXOData.Type),
            from: fromAddr,
            to: normalizedAddr,
            timestamp: normalizeHistoryTimestamp(inUtxo.UTXOData.Time),
            txHash: inboundTxId || utxoId,
            gas: 0,
            blockNumber: blockNumber || undefined,
            confirmations
          });
        } else if (!inboundTxId) {
          console.warn('[AccountPolling] No transaction ID for incoming UTXO:', utxoId);
        } else {
          console.debug('[AccountPolling] Skipping duplicate receive record (outgoing tx exists):', inboundTxId);
        }

        if (isCrossChainInbound) {
          showSuccessToast(
            t('notification.receivedCrossChain') || '收到跨链转账交易',
            t('notification.accountUpdate') || '账户更新'
          );
        } else {
          showSuccessToast(
            t('notification.receivedTransfer') || '收到转账交易',
            t('notification.accountUpdate') || '账户更新'
          );
        }
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
  // [DECOUPLED] TXCerChangeData is now sent via separate 'txcer_change' SSE events.
  // We no longer process it inside account_update to ensure single responsibility.
  // if (update.TXCerChangeData && update.TXCerChangeData.length > 0) { ... }

  // 处理已使用 TXCer 的利息返还
  if (update.UsedTXCerChangeData && update.UsedTXCerChangeData.length > 0) {
    for (const usedTxCer of update.UsedTXCerChangeData) {
      processUsedTXCerChange(user, usedTxCer);
      hasChanges = true;
    }
  }

  // 🔧 处理 AddressInterest - 从后端同步最新的利息（GAS）数据
  // 这是确保 UI 显示正确 GAS 的关键步骤
  if (update.AddressInterest && Object.keys(update.AddressInterest).length > 0) {
    console.info('[AccountPolling] Applying AddressInterest from backend:', update.AddressInterest);

    for (const [address, interest] of Object.entries(update.AddressInterest)) {
      const normalizedAddr = address.toLowerCase();
      const addrData = user.wallet.addressMsg[normalizedAddr];

      if (addrData) {
        const prevInterest = Number((addrData as any).EstInterest ?? (addrData as any).estInterest ?? (addrData as any).gas ?? 0);
        const newInterest = Number(interest);

        // 更新所有利息字段（保持一致性）
        (addrData as any).EstInterest = newInterest;
        (addrData as any).estInterest = newInterest;
        (addrData as any).gas = newInterest;

        console.info(`[AccountPolling] Updated interest for ${normalizedAddr.slice(0, 10)}...: ${prevInterest.toFixed(4)} -> ${newInterest.toFixed(4)}`);
        hasChanges = true;
      }
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

    // ✅ 利息同步已通过 AddressInterest 字段完成
    // 后端在 account_update 中直接返回每个地址的最新利息，无需额外查询 ComNode

    // IMPORTANT: 重新获取最新用户数据以包含可能通过 addTxHistoryRecords 更新的 txHistory
    // 避免覆盖刚刚添加的交易历史记录
    const latestUser = getCurrentUser();
    if (latestUser) {
      // 将计算后的 wallet 数据合并到最新用户对象中
      latestUser.wallet = user.wallet;
      saveUser(latestUser);
    } else {
      saveUser(user);
    }

    // 刷新钱包 UI
    renderWallet();
    refreshSrcAddrList();
    updateWalletBrief();

    // 账户更新成功，无需 Toast 通知（避免干扰）
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
      // 终态更新必须解锁，否则会出现“TXCer 已被链上替换但前端仍显示锁定”的永久锁问题。
      unlockTXCers([change.TXCerID], false);
      showSuccessToast(
        'TXCer 已上链',
        `ID: ${change.TXCerID.slice(0, 8)}... 已转换为 UTXO`
      );
      break;

    case 1:
      // 验证错误，TXCer 不能使用
      markTXCerAsInvalid(user, change.TXCerID);
      // 验证失败同样是终态：解锁并清理本地锁，避免永久锁定。
      unlockTXCers([change.TXCerID], false);
      showErrorToast(`❌ TXCer 验证失败\nID: ${change.TXCerID.slice(0, 8)}...`);
      break;


    case 2:
      // 解除怀疑，TXCer 可以正常使用
      markTXCerAsValid(user, change.TXCerID);
      showMiniToast(
        `🔓 TXCer 已解除怀疑\nID: ${change.TXCerID.slice(0, 8)}...`,
        'info'
      );
      break;

    default:
      console.warn(`[AccountPolling] Unknown TXCer status: ${change.Status}`);
  }
}

/**
 * 直接处理 TXCer 状态变更（供 txCerLockManager 调用）
 * 
 * 此函数用于处理缓存的更新，在 TXCer 解锁后调用
 * 
 * @param change TXCer 变更数据
 */
export function processTXCerChangeDirectly(change: TXCerChangeToUser): void {
  const user = getCurrentUser();
  if (!user) {
    console.warn('[AccountPolling] processTXCerChangeDirectly: No user logged in');
    return;
  }

  console.info(`[AccountPolling] 处理缓存的 TXCer 更新: ${change.TXCerID}, status: ${change.Status}`);

  processTXCerChange(user, change);

  // 重新计算并保存
  recalculateTotalBalance(user);
  
  // IMPORTANT: 重新获取最新用户数据以包含 txHistory
  const latestUser = getCurrentUser();
  if (latestUser) {
    latestUser.wallet = user.wallet;
    saveUser(latestUser);
  } else {
    saveUser(user);
  }

  // 刷新 UI
  renderWallet();
  refreshSrcAddrList();
  updateWalletBrief();
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
    // 利息自动累加，无需 Toast 通知（避免干扰）
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
* SSE 连接实例
*/
let eventSource: EventSource | null = null;
let eventSourceUserId: string | null = null;
let eventSourceGroupId: string | null = null;

function isSSEActive(): boolean {
  return eventSource !== null && eventSource.readyState === EventSource.OPEN;
}

/**
* 启动 SSE 实时同步
*/
function startSSESync(userId: string, group: any): void {
  if (eventSource) {
    // 如果已经连接且参数一致，则复用
    if (eventSourceUserId === userId && eventSourceGroupId === group.groupID && eventSource.readyState !== EventSource.CLOSED) {
      console.debug('[AccountSSE] Already connected');
      return;
    }
    // 否则先关闭旧连接
    stopSSESync();
  }

  eventSourceUserId = userId;
  eventSourceGroupId = group.groupID;

  // 构造 SSE URL
  let baseUrl = '';
  if (group.assignAPIEndpoint) {
    baseUrl = buildAssignNodeUrl(group.assignAPIEndpoint);
  } else {
    // Fallback using API_BASE_URL via relative path if needed, 
    // but direct URL is preferred.
    // Note: API_ENDPOINTS.ASSIGN_ACCOUNT_UPDATE returns path without host.
    // We need to construct the full URL for EventSource.

    // If no direct endpoint, we assume we can't use SSE efficiently or at all properly via proxy if proxy doesn't support it,
    // but let's try relative path if running on same origin.
    // Ideally assignAPIEndpoint should be present.
    baseUrl = API_BASE_URL || '';
  }

  const url = `${baseUrl}/api/v1/${group.groupID}/assign/account-update-stream?userID=${userId}`;
  console.info(`[AccountSSE] Connecting to ${url}`);

  try {
    eventSource = new EventSource(url);

    eventSource.onopen = () => {
      console.info('[AccountSSE] Connection opened');
      consecutiveFailures = 0;
      // Show connection status toast only on first connection per session
      if (!hasShownAssignNodeConnectedToast) {
        hasShownAssignNodeConnectedToast = true;
        showStatusToast(t('assignNode.connected') || '已连接到担保组织节点', 'success');
      }
    };

    eventSource.onerror = (err) => {
      console.error('[AccountSSE] Connection error:', err);
      // EventSource automatically retries, but we might want to handle persistent failures
      // For now, let it retry.
    };

    // 1. Account Update Events
    eventSource.addEventListener('account_update', (event) => {
      try {
        // ⚠️ 使用 BigInt 安全解析，防止 PublicKeyNew X/Y 精度丢失
        const data = parseBigIntJson<AccountUpdateInfo>(event.data);
        // console.debug('[AccountSSE] Received account_update:', data);
        processAccountUpdate(data);
      } catch (e) {
        console.error('[AccountSSE] Failed to parse account_update:', e);
      }
    });

    // 2. TXCer Change Events
    eventSource.addEventListener('txcer_change', (event) => {
      try {
        const user = getCurrentUser();
        if (user) {
          // ⚠️ 使用 BigInt 安全解析
          const data = parseBigIntJson<TXCerChangeToUser>(event.data);
          // console.debug('[AccountSSE] Received txcer_change:', data);
          processTXCerChange(user, data);

          // Trigger UI refresh if needed (processTXCerChange handles logic but we might need to recalculate totals)
          recalculateTotalBalance(user);
          
          // IMPORTANT: 重新获取最新用户数据以包含可能通过 addTxHistoryRecords 更新的 txHistory
          const latestUser = getCurrentUser();
          if (latestUser) {
            latestUser.wallet = user.wallet;
            saveUser(latestUser);
          } else {
            saveUser(user);
          }
          
          renderWallet();
          refreshSrcAddrList();
          updateWalletBrief();
        }
      } catch (e) {
        console.error('[AccountSSE] Failed to parse txcer_change:', e);
      }
    });

    // 3. Cross-Org TXCer Events
    eventSource.addEventListener('cross_org_txcer', (event) => {
      try {
        const user = getCurrentUser();
        if (user) {
          // ⚠️ 使用 BigInt 安全解析
          const data = parseBigIntJson(event.data);
          console.info('[AccountSSE] Received cross_org_txcer');
          const result = processTXCerToUser(user, data as any);
          if (result) {
            recalculateTotalBalance(user);
            
            // IMPORTANT: 重新获取最新用户数据以包含 txHistory
            const latestUser = getCurrentUser();
            if (latestUser) {
              latestUser.wallet = user.wallet;
              saveUser(latestUser);
            } else {
              saveUser(user);
            }
            
            renderWallet();
            refreshSrcAddrList();
            updateWalletBrief();
          }
        }
      } catch (e) {
        console.error('[AccountSSE] Failed to parse cross_org_txcer:', e);
      }
    });

    // 4. TX Status Change Events
    eventSource.addEventListener('tx_status_change', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.info('[AccountSSE] Received tx_status_change:', data);

        // Dispatch global event for listeners (e.g. txBuilder)
        const customEvent = new CustomEvent('pangu_tx_status', {
          detail: data
        });
        window.dispatchEvent(customEvent);
      } catch (e) {
        console.error('[AccountSSE] Failed to parse tx_status_change:', e);
      }
    });

  } catch (e) {
    console.error('[AccountSSE] Failed to create EventSource:', e);
    isPollingStarted = false;
  }
}

function stopSSESync(): void {
  if (eventSource) {
    console.info('[AccountSSE] Closing connection');
    eventSource.close();
    eventSource = null;
    eventSourceUserId = null;
    eventSourceGroupId = null;
  }
}

/**
* 启动账户更新 (SSE 模式)
* 
* 仅对已加入担保组织的用户启用
*/
export function startAccountPolling(): void {
  const user = getCurrentUser();
  if (!user?.accountId) {
    console.info('[AccountPolling] No user logged in, polling not started');
    stopInterestSyncPolling();
    return;
  }

  // Canonical interest/GAS sync should run for any logged-in wallet page,
  // regardless of whether AssignNode polling is available.
  startInterestSyncPolling();

  // 检查是否已启动 (SSE 也会设置 isPollingStarted 标志)
  if (isPollingStarted) {
    console.debug('[AccountPolling] Already started (checking connection...)');
    // 如果 SSE 断了，这里也可以尝试重连，但 startSSESync 内部有检查
  }
  if (user.isInGroup === false || !user.orgNumber) {
    console.info('[AccountPolling] User not in organization, polling not started');
    return;
  }

  // 检查用户是否加入了担保组织
  const group = getJoinedGroup() || { groupID: user.orgNumber };

  console.info(`[AccountPolling] Starting SSE Sync for user ${user.accountId} in group ${group.groupID}`);

  isPollingStarted = true;
  consecutiveFailures = 0;

  // 1. 立即执行一次传统轮询，以获取离线期间的消息并消耗队列
  pollAccountUpdates(!isSSEActive());
  if (!pollingTimer) {
    pollingTimer = setInterval(pollAccountUpdates, POLLING_INTERVAL);
  }

  startTXCerChangePolling();
  startCrossOrgTXCerPolling();

  // 2. 启动 SSE 长连接
  startSSESync(user.accountId, group);
}

/**
* 停止账户更新
*/
export function stopAccountPolling(): void {
  stopInterestSyncPolling();
  stopSSESync();

  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }

  isPollingStarted = false;
  isPolling = false;

  // 同时停止跨组织TXCer轮询 (legacy timer)
  stopTXCerChangePolling();
  stopCrossOrgTXCerPolling();

  console.info('[AccountPolling] SSE Sync stopped');
}

/**
 * 重置连接通知标记
 * 
 * 用于退出登录或切换组织时
 */
export function resetAssignNodeConnectFlag(): void {
  hasShownAssignNodeConnectedToast = false;
  console.debug('[AccountPolling] Connection toast flag reset');
}

/**
* 重启账户更新
* 
* 用于用户加入组织后或手动刷新后
*/
export function restartAccountPolling(): void {
  stopAccountPolling();
  consecutiveFailures = 0;
  startAccountPolling();
}

/**
* 检查是否正在运行
*/
export function isAccountPollingActive(): boolean {
  return isPollingStarted && (eventSource !== null && eventSource.readyState !== EventSource.CLOSED);
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
  await pollAccountUpdates(true);
}

// ============================================================================
// TXCer变动轮询 (TXCerChange)
// ============================================================================

/**
 * 执行一次TXCer变动轮询
 */
async function pollTXCerChanges(force = false): Promise<void> {
  if (isPollingTXCer) {
    console.debug('[TXCerChange] Skipping poll - already in progress');
    return;
  }

  if (!force && isSSEActive()) {
    return;
  }

  const user = getCurrentUser();
  if (!user?.accountId) {
    console.debug('[TXCerChange] No user logged in, skipping poll');
    return;
  }

  const group = getJoinedGroup();
  if (!group?.groupID) {
    console.debug('[TXCerChange] User not in organization, skipping poll');
    return;
  }

  isPollingTXCer = true;

  try {
    const endpoint = `${API_ENDPOINTS.ASSIGN_TXCER_CHANGE(group.groupID)}?userID=${user.accountId}&limit=10&consume=true`;

    const response = await apiClient.get<TXCerChangeResponse>(endpoint, {
      timeout: 5000,
      retries: 0,
      silent: true,
      useBigIntParsing: true
    });

    txcerFailures = 0;

    if (response.success && response.count > 0) {
      console.info(`[TXCerChange] Received ${response.count} changes`);

      let hasChanges = false;

      for (const change of response.changes) {
        processTXCerChange(user, change);
        hasChanges = true;
      }

      if (hasChanges) {
        recalculateTotalBalance(user);
        
        // IMPORTANT: 重新获取最新用户数据以包含 txHistory
        const latestUser = getCurrentUser();
        if (latestUser) {
          latestUser.wallet = user.wallet;
          saveUser(latestUser);
        } else {
          saveUser(user);
        }
        
        renderWallet();
        refreshSrcAddrList();
        updateWalletBrief();
      }
    }
  } catch (error) {
    txcerFailures++;

    if (isNetworkError(error)) {
      console.debug('[TXCerChange] Network error');
    } else if (isTimeoutError(error)) {
      console.debug('[TXCerChange] Request timeout');
    } else {
      console.warn('[TXCerChange] Poll failed:', error);
    }

    if (txcerFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.warn(`[TXCerChange] Too many failures (${txcerFailures}), pausing`);
      stopTXCerChangePolling();
    }
  } finally {
    isPollingTXCer = false;
  }
}

/**
 * 启动TXCer变动轮询
 */
export function startTXCerChangePolling(): void {
  if (txCerPollingTimer) {
    console.debug('[TXCerChange] Already started');
    return;
  }

  const group = getJoinedGroup();
  if (!group?.groupID) {
    console.info('[TXCerChange] User not in organization, polling not started');
    return;
  }

  const user = getCurrentUser();
  if (!user?.accountId) {
    console.info('[TXCerChange] No user logged in, polling not started');
    return;
  }

  console.info('[TXCerChange] Starting polling');
  txcerFailures = 0;

  pollTXCerChanges(!isSSEActive());
  txCerPollingTimer = setInterval(pollTXCerChanges, TXCER_POLLING_INTERVAL);
}

/**
 * 停止TXCer变动轮询
 */
export function stopTXCerChangePolling(): void {
  if (txCerPollingTimer) {
    clearInterval(txCerPollingTimer);
    txCerPollingTimer = null;
  }

  isPollingTXCer = false;
  console.info('[TXCerChange] Polling stopped');
}

/**
 * 重启TXCer变动轮询
 */
export function restartTXCerChangePolling(): void {
  stopTXCerChangePolling();
  txcerFailures = 0;
  startTXCerChangePolling();
}

// ============================================================================
// 跨组织 TXCer 轮询 (TXCerToUser)
// ============================================================================

/** 跨组织TXCer轮询定时器 */
let crossOrgTxCerTimer: ReturnType<typeof setInterval> | null = null;

/** 跨组织TXCer轮询间隔（毫秒）*/
const CROSS_ORG_TXCER_POLLING_INTERVAL = 5000; // 5秒轮询一次

/** 是否正在轮询跨组织TXCer */
let isPollingCrossOrgTxCer = false;

/** 跨组织TXCer轮询连续失败次数 */
let crossOrgTxCerFailures = 0;

/**
 * 执行一次跨组织TXCer轮询
 * 
 * 轮询接收来自其他担保组织的TXCer
 */
async function pollCrossOrgTXCers(force = false): Promise<void> {
  if (isPollingCrossOrgTxCer) {
    console.debug('[CrossOrgTXCer] Skipping poll - already in progress');
    return;
  }

  if (!force && isSSEActive()) {
    return;
  }

  const user = getCurrentUser();
  if (!user?.accountId) {
    console.debug('[CrossOrgTXCer] No user logged in, skipping poll');
    return;
  }

  const group = getJoinedGroup();
  if (!group?.groupID) {
    console.debug('[CrossOrgTXCer] User not in organization, skipping poll');
    return;
  }

  isPollingCrossOrgTxCer = true;

  try {
    const endpoint = `${API_ENDPOINTS.ASSIGN_CROSS_ORG_TXCER(group.groupID)}?userID=${user.accountId}&limit=10&consume=true`;

    const response = await apiClient.get<CrossOrgTXCerResponse>(endpoint, {
      timeout: 5000,
      retries: 0,
      silent: true,
      useBigIntParsing: true
    });

    crossOrgTxCerFailures = 0;

    if (response.success && response.count > 0) {
      console.info(`[CrossOrgTXCer] Received ${response.count} TXCers`);

      let hasChanges = false;

      for (const txCerToUser of response.txcers) {
        const result = processTXCerToUser(user, txCerToUser);
        if (result) {
          hasChanges = true;
        }
      }

      if (hasChanges) {
        // 重新计算总余额
        recalculateTotalBalance(user);
        
        // IMPORTANT: 重新获取最新用户数据以包含 txHistory
        const latestUser = getCurrentUser();
        if (latestUser) {
          latestUser.wallet = user.wallet;
          saveUser(latestUser);
        } else {
          saveUser(user);
        }

        // 刷新UI
        renderWallet();
        refreshSrcAddrList();
        updateWalletBrief();

        // TXCer 接收通知已在 processTXCerToUser 中显示，这里不再重复
        console.info(`[CrossOrgTXCer] ${response.count} TXCers processed and UI updated`);
      }
    }
  } catch (error) {
    crossOrgTxCerFailures++;

    if (isNetworkError(error)) {
      console.debug('[CrossOrgTXCer] Network error');
    } else if (isTimeoutError(error)) {
      console.debug('[CrossOrgTXCer] Request timeout');
    } else {
      console.warn('[CrossOrgTXCer] Poll failed:', error);
    }

    // 连续失败过多，暂停轮询
    if (crossOrgTxCerFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.warn(`[CrossOrgTXCer] Too many failures (${crossOrgTxCerFailures}), pausing`);
      stopCrossOrgTXCerPolling();
    }
  } finally {
    isPollingCrossOrgTxCer = false;
  }
}

/**
 * 处理接收到的 TXCer
 * 
 * 将 TXCer 存储到对应地址的 txCers 字段和 wallet.totalTXCers 中
 * 
 * @param user 当前用户
 * @param txCerToUser 接收到的 TXCer 信息
 * @returns 是否处理成功
 */
function processTXCerToUser(user: User, txCerToUser: TXCerToUser): boolean {
  const { ToAddress, TXCer } = txCerToUser;
  const normalizedAddr = ToAddress.toLowerCase();
  const txCerId = TXCer.TXCerID;

  console.info(`[CrossOrgTXCer] Processing TXCer ${txCerId.slice(0, 8)}... for address ${normalizedAddr.slice(0, 16)}...`);
  console.info(`[CrossOrgTXCer] TXCer details: Value=${TXCer.Value}, ToInterest=${TXCer.ToInterest}, From=${TXCer.FromGuarGroupID.slice(0, 8)}...`);

  // 确保钱包存在
  if (!user.wallet) {
    console.warn('[CrossOrgTXCer] User has no wallet');
    return false;
  }

  // 检查地址是否属于用户
  const addrData = user.wallet.addressMsg[normalizedAddr];
  if (!addrData) {
    console.warn(`[CrossOrgTXCer] Address ${normalizedAddr.slice(0, 16)}... not found in wallet`);
    return false;
  }

  // TXCer 只能用于主货币（type=0）地址
  if (addrData.type !== 0) {
    console.warn(`[CrossOrgTXCer] TXCer can only be used for main currency addresses, but address type is ${addrData.type}`);
    return false;
  }

  // 初始化 txCers 字段
  if (!addrData.txCers) {
    addrData.txCers = {};
  }

  // 检查是否已存在
  if (addrData.txCers[txCerId] !== undefined) {
    console.debug(`[CrossOrgTXCer] TXCer ${txCerId.slice(0, 8)}... already exists`);
    return false;
  }

  // 存储 TXCer 金额到地址的 txCers 字段
  addrData.txCers[txCerId] = TXCer.Value;

  // 初始化并存储完整 TXCer 到 totalTXCers
  if (!user.wallet.totalTXCers) {
    user.wallet.totalTXCers = {};
  }
  user.wallet.totalTXCers[txCerId] = TXCer;

  // 重新计算地址余额
  recalculateAddressBalance(addrData);

  console.info(`[CrossOrgTXCer] TXCer ${txCerId.slice(0, 8)}... stored successfully`);

  // 显示 TXCer 接收提示
  showSuccessToast(`📥 收到 TXCer: ${TXCer.Value.toFixed(4)} PGC`);

  return true;
}

/**
 * 启动跨组织TXCer轮询
 */
export function startCrossOrgTXCerPolling(): void {
  if (crossOrgTxCerTimer) {
    console.debug('[CrossOrgTXCer] Already started');
    return;
  }

  const group = getJoinedGroup();
  if (!group?.groupID) {
    console.info('[CrossOrgTXCer] User not in organization, polling not started');
    return;
  }

  const user = getCurrentUser();
  if (!user?.accountId) {
    console.info('[CrossOrgTXCer] No user logged in, polling not started');
    return;
  }

  console.info('[CrossOrgTXCer] Starting cross-org TXCer polling');

  crossOrgTxCerFailures = 0;

  // 立即执行一次
  pollCrossOrgTXCers(!isSSEActive());

  // 设置定时轮询
  crossOrgTxCerTimer = setInterval(pollCrossOrgTXCers, CROSS_ORG_TXCER_POLLING_INTERVAL);
}

/**
 * 停止跨组织TXCer轮询
 */
export function stopCrossOrgTXCerPolling(): void {
  if (crossOrgTxCerTimer) {
    clearInterval(crossOrgTxCerTimer);
    crossOrgTxCerTimer = null;
  }

  isPollingCrossOrgTxCer = false;

  console.info('[CrossOrgTXCer] Polling stopped');
}

/**
 * 重启跨组织TXCer轮询
 */
export function restartCrossOrgTXCerPolling(): void {
  stopCrossOrgTXCerPolling();
  crossOrgTxCerFailures = 0;
  startCrossOrgTXCerPolling();
}
