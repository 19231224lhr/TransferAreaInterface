/**
 * Transfer Transaction Builder Module
 * 
 * Handles transaction building, validation and submission
 */

import { t } from '../i18n/index.js';
import {
  loadUser,
  saveUser,
  User,
  AddressData,
  TxHistoryRecord,
  getJoinedGroup,
  getAddressProtocolIssues,
  hasAddressProtocolMetadata
} from '../utils/storage';
import { readAddressInterest } from '../utils/helpers.js';
import { showConfirmModal } from '../ui/modal';
import { BuildTXInfo } from './transaction';
import { buildTransactionFromLegacy, buildNormalTransaction, serializeUserNewTX, serializeAggregateGTX, submitTransaction, UserNewTX, waitForTXConfirmation, TXStatusResponse, AggregateGTXForSubmit, BuildTransactionParams } from './txBuilder';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';
import { validateAddress, validateTransferAmount, validateOrgId, createSubmissionGuard } from '../utils/security';
import { createCheckpoint, restoreCheckpoint, createDOMSnapshot, restoreFromSnapshot } from '../utils/transaction';
import { clearTransferDraft } from './transferDraft';
import { getCoinName, COIN_TO_PGC_RATES, CoinTypeId } from '../config/constants';
import { showLoading, hideLoading } from '../utils/loading';
import { showToast } from '../utils/toast';
import { DOM_IDS } from '../config/domIds';
import { hasEncryptedKey, getPrivateKey } from '../utils/keyEncryption';
import { showPasswordPrompt } from '../utils/keyEncryptionUI';
import { buildAssignNodeUrl } from './group';
import { lockUTXOs, LockedUTXO } from '../utils/utxoLock';
import { lockTXCers, unlockTXCers, markTXCersSubmitted, getLockedTXCerIdsByTxId } from './txCerLockManager';
import { getComNodeURL, clearComNodeCache } from './comNodeEndpoint';
import { addTxHistoryRecords, updateTxHistoryByTxId } from './txHistory';
import { isCapsuleAddress } from './capsule';
import { querySingleAddressGroup, type NormalizedAddressGroupInfo } from './accountQuery';

// ========================================
// Type Definitions
// ========================================

/** Bill structure for transfer */
export interface TransferBill {
  MoneyType: number;
  Value: number;
  GuarGroupID: string;
  PublicKey: { Curve: string; XHex: string; YHex: string };
  ToInterest: number;
  SeedAnchor?: number[] | string;
  SeedChainStep?: number;
  DefaultSpendAlgorithm?: string;
}

/** Wallet snapshot with strict AddressData typing */
interface WalletSnapshot {
  walletMap: Record<string, AddressData>;
  walletGasTotal: number;
}

/** Address info for optimization */
interface AddressInfo {
  addr: string;
  bal: Record<number, number>;
  totalRel: number;
}

// ========================================
// Helper Functions
// ========================================

/**
 * Normalize address input
 */
function normalizeAddrInput(addr: string): string {
  return addr ? String(addr).trim().toLowerCase() : '';
}

/**
 * Show transaction validation error as a toast notification
 */
function showTxValidationError(msg: string, focusEl: HTMLElement | null, title: string = '参数校验失败'): void {
  const txErr = document.getElementById(DOM_IDS.txError);
  if (txErr) {
    txErr.textContent = msg;
    txErr.classList.remove('hidden');
  }
  // Use toast notification instead of modal popup for better UX
  showToast(msg, 'error', title);
  if (focusEl && typeof focusEl.focus === 'function') focusEl.focus();
}

type HistoryStatus = 'success' | 'pending' | 'failed';

function buildOutgoingHistoryRecords(
  build: BuildTXInfo,
  fromAddresses: string[],
  txId: string,
  status: HistoryStatus,
  options: {
    failureReason?: string;
    guarantorOrg?: string;
    txMode?: 'normal' | 'quick' | 'cross' | 'incoming' | 'unknown' | string;
    transferMode?: TxHistoryRecord['transferMode'];
  } = {}
): TxHistoryRecord[] {
  const records: TxHistoryRecord[] = [];
  const timestamp = Date.now();
  const from = fromAddresses[0] || '';
  const gas = Number(build.InterestAssign?.Gas || 0) || 0;
  const txHash = txId || 'N/A';
  const baseId = txId || `temp_${timestamp}`;
  const fallbackMode: NonNullable<TxHistoryRecord['transferMode']> =
    options.txMode === 'cross' ? 'cross' : (options.txMode === 'quick' ? 'quick' : 'normal');
  const transferMode: NonNullable<TxHistoryRecord['transferMode']> = options.transferMode || fallbackMode;
  let idx = 0;

  for (const [to, bill] of Object.entries(build.Bill || {})) {
    const amount = Number(bill.Value || 0) || 0;
    records.push({
      id: `out_${baseId}_${idx}_${to}_${bill.MoneyType}`,
      type: 'send',
      status,
      transferMode,
      amount,
      currency: getCoinName(bill.MoneyType),
      from,
      to,
      timestamp,
      txHash,
      gas,
      guarantorOrg: bill.GuarGroupID || options.guarantorOrg || '',
      failureReason: options.failureReason || ''
    });
    idx += 1;
  }

  return records;
}

function collectPendingSeedAdvances(
  userNewTX: UserNewTX | null,
  aggregateGTX: AggregateGTXForSubmit | null,
  txId: string
): Array<{ address: string; step: number; nextStep: number; txId: string }> {
  const inputs = userNewTX?.TX?.TXInputsNormal
    || aggregateGTX?.AllTransactions?.[0]?.TXInputsNormal
    || [];
  const result = new Map<string, { address: string; step: number; nextStep: number; txId: string }>();

  for (const input of inputs as Array<any>) {
    const address = normalizeAddrInput(input?.FromAddress || '');
    const step = Number(input?.SeedChainStep || 0);
    if (!address || step <= 0) continue;
    if (!result.has(address)) {
      result.set(address, {
        address,
        step,
        nextStep: Math.max(0, step - 1),
        txId
      });
    }
  }

  return Array.from(result.values());
}

function setPendingSeedAdvances(
  entries: Array<{ address: string; step: number; nextStep: number; txId: string }>
): void {
  if (!entries.length) return;
  const user = loadUser();
  if (!user?.wallet?.addressMsg || !user.accountId) return;

  let changed = false;
  for (const entry of entries) {
    const meta = user.wallet.addressMsg[entry.address];
    if (!meta) continue;
    meta.pendingSeedStep = entry.step;
    meta.pendingNextSeedStep = entry.nextStep;
    meta.pendingSeedTxId = entry.txId;
    meta.pendingSeedAt = Date.now();
    changed = true;
  }

  if (changed) {
    saveUser(user);
  }
}

function clearPendingSeedAdvanceByTxId(txId: string): void {
  if (!txId) return;
  const user = loadUser();
  if (!user?.wallet?.addressMsg || !user.accountId) return;

  let changed = false;
  for (const meta of Object.values(user.wallet.addressMsg)) {
    if (meta?.pendingSeedTxId === txId) {
      delete (meta as any).pendingSeedStep;
      delete (meta as any).pendingNextSeedStep;
      delete (meta as any).pendingSeedTxId;
      delete (meta as any).pendingSeedAt;
      changed = true;
    }
  }

  if (changed) {
    saveUser(user);
  }
}

function humanizeProtocolError(errorMsg: string, errorCode?: string): string {
  if (errorCode === 'USER_NOT_IN_ORG') {
    return t('transfer.userNotInOrgHint') ||
      '您的账户未在后端担保组织中注册。请尝试退出当前组织后重新加入。';
  }
  if (errorCode === 'ADDRESS_REVOKED') {
    return t('error.addressAlreadyRevoked') || '使用的地址已被解绑，请选择其他地址';
  }
  if (errorCode === 'SIGNATURE_FAILED') {
    return t('error.signatureVerificationFailed') || '签名验证失败，请检查私钥是否正确';
  }
  if (errorCode === 'UTXO_SPENT') {
    return t('transfer.utxoAlreadySpent') || 'UTXO 已被使用，请刷新页面后重试';
  }
  if (errorCode === 'TX_V2_SIGNATURE_FAILED') {
    return '交易的 V2 用户签名验证失败，请重新登录后重试。';
  }
  if (errorCode === 'SEED_PROTOCOL_FAILED') {
    return '地址 seed/V2 协议状态异常，可能需要等待确认、刷新钱包或修复地址状态。';
  }
  if (
    errorMsg.includes('seed sweep required') ||
    errorMsg.includes('seed step pending lock conflict') ||
    errorMsg.includes('seed chain exhausted') ||
    errorMsg.includes('missing V2 input signature')
  ) {
    return '地址 seed 步骤状态不满足当前交易要求，请刷新钱包后重试。';
  }
  if (errorMsg.includes('address not registered') || errorMsg.includes('not registered')) {
    return '收款地址或发送地址尚未完成注册，当前无法发送。';
  }
  if (errorMsg.includes('missing SignPublicKeyV2')) {
    return '地址缺少 V2 验签公钥元数据，请重新同步地址状态。';
  }
  if (
    errorMsg.includes('can not find this peer') ||
    errorMsg.includes('cannot find this peer') ||
    errorMsg.includes('peer not found')
  ) {
    return t('transfer.peerNotReachableHint') || '担保节点未在线，暂时无法发送。';
  }
  if (errorMsg.includes('no alternative guarantor available') || errorMsg.includes('failed to reassign user')) {
    return t('error.guarantorReassignFailed') || '担保组织无法正确分配处理交易的担保人，请稍后';
  }
  if (errorMsg.includes('no available guarantor')) {
    return t('transfer.noAvailableGuarantorHint') || '没有可用的担保节点，暂时无法发送。';
  }
  return errorMsg;
}

/**
 * Get wallet snapshot with strict typing
 */
function getWalletSnapshot(): WalletSnapshot {
  const u0 = loadUser();
  let walletMap = (u0 && u0.wallet && u0.wallet.addressMsg) || {};

  // Debug: Log all address gas values
  console.debug('[Transfer] getWalletSnapshot - address gas values:',
    Object.entries(walletMap).map(([addr, meta]) => ({
      addr: addr.slice(0, 10) + '...',
      EstInterest: (meta as any).EstInterest,
      estInterest: (meta as any).estInterest,
      gas: (meta as any).gas,
      computed: readAddressInterest(meta as any)
    }))
  );

  const getWalletGasSum = (map: Record<string, AddressData>): number => Object.keys(map).reduce((sum, addr) => {
    const meta = map[addr];
    return sum + readAddressInterest(meta);
  }, 0);
  const walletGasTotal = getWalletGasSum(walletMap);

  return { walletMap, walletGasTotal };
}

/**
 * Get address metadata with strict typing
 */
function getAddrMeta(addr: string): AddressData | null {
  const { walletMap } = getWalletSnapshot();
  return walletMap[addr] || null;
}

/**
 * Parse public key from combined format
 */
function parsePub(raw: string): { x: string; y: string; ok: boolean } {
  const res = { x: '', y: '', ok: false };
  const rawStr = String(raw || '').trim();
  if (!rawStr) return res;
  const normalized = rawStr.replace(/^0x/i, '').toLowerCase();
  if (/^04[0-9a-f]{128}$/.test(normalized)) {
    res.x = normalized.slice(2, 66);
    res.y = normalized.slice(66);
    res.ok = true;
    return res;
  }
  const parts = normalized.split(/[,&\s]+/).filter(Boolean);
  if (parts.length === 2 && /^[0-9a-f]{64}$/.test(parts[0]) && /^[0-9a-f]{64}$/.test(parts[1])) {
    res.x = parts[0];
    res.y = parts[1];
    res.ok = true;
  }
  return res;
}

// ========================================
// Main Functions
// ========================================

/**
 * Update transfer button state based on user's organization membership
 * - For users in guarantor org: enable for quick and cross transfers
 * - For users NOT in guarantor org: enable for normal transfer (quick mode only)
 */
export function updateTransferButtonState(): void {
  const tfBtn = document.getElementById(DOM_IDS.tfSendBtn) as HTMLButtonElement | null;
  if (!tfBtn) return;

  const guarGroup = getJoinedGroup();
  const user = loadUser();
  const hasJoined = !!(guarGroup && guarGroup.groupID && (user?.orgNumber || user?.guarGroup?.groupID));
  const hasUsableSourceAddress = !!Object.values(user?.wallet?.addressMsg || {}).some((meta) => {
    if (!meta?.privHex) return false;
    if (meta.readOnly || meta.seedRepairRequired || meta.pendingSeedStep) return false;
    if (!hasJoined && meta.registrationState && meta.registrationState !== 'registered') return false;
    return true;
  });

  // Get the mode selector to check transfer type
  const tfMode = document.getElementById(DOM_IDS.tfMode) as HTMLSelectElement | null;
  let currentMode = tfMode?.value || 'quick';

  // Enforce normal-transfer-only when user is not in a guarantor org.
  if (!hasJoined && currentMode !== 'quick') {
    currentMode = 'quick';
    if (tfMode) tfMode.value = 'quick';

    const isPledgeSel = document.getElementById(DOM_IDS.isPledge) as HTMLSelectElement | null;
    if (isPledgeSel) isPledgeSel.value = 'false';

    const modeTabsContainer = document.getElementById(DOM_IDS.transferModeTabs);
    if (modeTabsContainer) {
      modeTabsContainer.setAttribute('data-active', '0');
      modeTabsContainer.querySelectorAll('.transfer-mode-tab').forEach((tab) => {
        const isQuick = (tab as HTMLElement).dataset.mode === 'quick';
        tab.classList.toggle('active', isQuick);
      });
    }
  }

  // Determine if button should be enabled
  let shouldEnable = false;
  let disableReason = '';

  if (hasJoined) {
    // User is in guarantor org: allow quick and cross transfer
    const isSupportedMode = currentMode === 'quick' || currentMode === 'cross';
    shouldEnable = isSupportedMode && hasUsableSourceAddress;
    if (!isSupportedMode) {
      disableReason = t('transfer.pledgeNotSupported') || '质押交易功能暂未开放';
    } else if (!hasUsableSourceAddress) {
      disableReason = '当前没有可转出的地址';
    }
  } else {
    // User is NOT in guarantor org: allow quick mode only (normal transfer to ComNode)
    shouldEnable = currentMode === 'quick' && hasUsableSourceAddress;
    if (!shouldEnable) {
      disableReason = hasUsableSourceAddress
        ? (t('transfer.normalTransferOnly') || '散户模式仅支持普通转账')
        : '当前没有已注册且可转出的地址';
    }
  }

  tfBtn.disabled = !shouldEnable;

  // Update button appearance
  if (shouldEnable) {
    tfBtn.classList.remove('btn-disabled');
    tfBtn.title = '';
  } else {
    tfBtn.classList.add('btn-disabled');
    tfBtn.title = disableReason;
  }
}

/**
 * Initialize transfer form submission
 */
export function initTransferSubmit(): void {
  const tfBtn = document.getElementById(DOM_IDS.tfSendBtn) as HTMLButtonElement | null;
  const addrList = document.getElementById(DOM_IDS.srcAddrList);
  const billList = document.getElementById(DOM_IDS.billList);
  const tfMode = document.getElementById(DOM_IDS.tfMode) as HTMLSelectElement | null;
  const isPledge = document.getElementById(DOM_IDS.isPledge) as HTMLSelectElement | null;
  const useTXCer = document.getElementById(DOM_IDS.useTXCer) as HTMLSelectElement | null;
  const useTXCerChk = document.getElementById(DOM_IDS.useTXCerChk) as HTMLInputElement | null;
  const chPGC = document.getElementById(DOM_IDS.chAddrPGC) as HTMLSelectElement | null;
  const chBTC = document.getElementById(DOM_IDS.chAddrBTC) as HTMLSelectElement | null;
  const chETH = document.getElementById(DOM_IDS.chAddrETH) as HTMLSelectElement | null;
  const gasInput = document.getElementById(DOM_IDS.extraGasPGC) as HTMLInputElement | null;
  const txGasInput = document.getElementById(DOM_IDS.txGasInput) as HTMLInputElement | null;
  const txErr = document.getElementById(DOM_IDS.txError);

  if (!tfBtn) return;

  const existingHandler = (tfBtn as any)._transferSubmitHandler as ((event?: Event) => void) | undefined;
  if (existingHandler) {
    tfBtn.removeEventListener('click', existingHandler);
    delete (tfBtn as any)._transferSubmitHandler;
    delete tfBtn.dataset._bind;
  }

  if (tfBtn.dataset._bind) return;

  // Initial button state check
  updateTransferButtonState();

  // Keep hidden select `useTXCer` in sync with visible checkbox `useTXCerChk`.
  // Transfer building reads `useTXCer.value` -> BuildTXInfo.PriUseTXCer.
  const syncUseTXCer = (): void => {
    if (!useTXCer || !useTXCerChk) return;
    useTXCer.value = useTXCerChk.checked ? 'true' : 'false';
  };

  // Ensure useTXCerChk is checked by default for quick transfer mode
  if (useTXCerChk && !useTXCerChk.checked) {
    const currentMode = tfMode?.value || 'quick';
    if (currentMode === 'quick' || currentMode === 'pledge') {
      useTXCerChk.checked = true;
    }
  }

  syncUseTXCer();
  if (useTXCerChk) {
    useTXCerChk.addEventListener('change', syncUseTXCer);
  }

  // Listen for mode changes to update button state
  if (tfMode) {
    tfMode.addEventListener('change', updateTransferButtonState);
  }

  // Create submission guard to prevent double-submit
  const transferSubmitGuard = createSubmissionGuard('transfer-submit');

  const onTransferSubmit = async () => {
    const checkpointId = `transfer-generate-${Date.now()}`;
    // Persisted draft keys we may want to restore quickly on unexpected failure
    createCheckpoint(checkpointId, ['auto-save-transfer-v1', 'form-draft-transfer-v1']);

    // Prevent double-submit (check if already submitting)
    if (!transferSubmitGuard.start()) {
      return;
    }

    const loadingId = showLoading(t('common.processing') || '处理中...');

    // Add loading state to button (only modify span text to preserve SVG)
    const btnSpan = tfBtn.querySelector('span');
    const originalText = btnSpan ? btnSpan.textContent : tfBtn.textContent;
    tfBtn.disabled = true;
    if (btnSpan) {
      btnSpan.textContent = t('common.loading') || '处理中...';
    } else {
      tfBtn.textContent = t('common.loading') || '处理中...';
    }

    // Snapshot key UI elements so we can restore to a stable state if something throws unexpectedly.
    const snapTxErr = txErr ? createDOMSnapshot(txErr) : null;



    try {
      const { walletMap, walletGasTotal } = getWalletSnapshot();

      if (txErr) {
        txErr.textContent = '';
        txErr.classList.add('hidden');
      }

      // Hide previous transaction result buttons

      let sel = Array.from(addrList!.querySelectorAll('input[type="checkbox"]'))
        .filter((x: any) => x.checked)
        .map((x: any) => x.value);

      // ========== 自动选择 From 地址功能 ==========
      // 条件: 1) 没有选择 From 地址, 2) 只有1个收款人, 3) 收款人已验证币种
      const recipientRows = Array.from(billList!.querySelectorAll('.recipient-card'));

      if (sel.length === 0 && recipientRows.length === 1) {
        const row = recipientRows[0];
        const mtEl = row.querySelector('[data-name="mt"]') as HTMLElement | null;
        const valEl = row.querySelector('[data-name="val"]') as HTMLInputElement | null;
        const toEl = row.querySelector('[data-name="to"]') as HTMLInputElement | null;

        // 获取已验证的币种
        const verifiedType = toEl?.dataset?.verifiedType;
        const mtVal = mtEl?.dataset?.val;
        const targetType = verifiedType !== undefined ? Number(verifiedType) : (mtVal !== undefined ? Number(mtVal) : null);
        const amount = Number(valEl?.value || 0);

        // 只有当币种已确认且金额大于0时才尝试自动选择
        if (targetType !== null && !isNaN(targetType) && amount > 0) {
          const extraGas = Number(gasInput?.value || 0);
          const txGas = Number(txGasInput?.value || 1);

          // 获取所有匹配币种的地址
          interface AddressCandidate { addr: string; balance: number; gas: number; }
          const candidates: AddressCandidate[] = [];

          for (const [addr, meta] of Object.entries(walletMap)) {
            const addrType = Number((meta as AddressData).type || 0);
            if (addrType !== targetType) continue;

            const utxoVal = Number((meta as AddressData).value?.utxoValue || (meta as AddressData).value?.totalValue || 0);
            const txCerVal = Object.values((meta as AddressData).txCers || {}).reduce((sum: number, v) => sum + Number(v || 0), 0);
            const availableBalance = utxoVal + txCerVal;
            const availableGas = readAddressInterest(meta as AddressData);

            if (availableBalance > 0) {
              candidates.push({ addr, balance: availableBalance, gas: availableGas });
            }
          }

          if (candidates.length > 0) {
            candidates.sort((a, b) => b.balance - a.balance);

            let selectedAddrs: string[] = [];
            let totalBalance = 0;

            // 策略1: 找单个满足需求的地址
            const singleMatch = candidates.find(c => c.balance >= amount);
            if (singleMatch) {
              selectedAddrs = [singleMatch.addr];
              totalBalance = singleMatch.balance;
            } else {
              // 策略2: 贪婪地组合多个地址
              for (const c of candidates) {
                if (totalBalance >= amount) break;
                selectedAddrs.push(c.addr);
                totalBalance += c.balance;
              }
            }

            if (totalBalance >= amount - 1e-8) {
              // 自动选择这些地址
              const checkboxes = addrList!.querySelectorAll('input[type="checkbox"]');
              const labels = addrList!.querySelectorAll('label.src-addr-item');

              checkboxes.forEach((cb, idx) => {
                const input = cb as HTMLInputElement;
                const shouldCheck = selectedAddrs.includes(input.value);
                input.checked = shouldCheck;
                if (labels[idx]) {
                  labels[idx].classList.toggle('selected', shouldCheck);
                }
              });

              sel = selectedAddrs;
              addrList!.dispatchEvent(new Event('change', { bubbles: true }));

              showToast(
                t('transfer.autoSelectedAddressDesc', { count: String(selectedAddrs.length) }),
                'info',
                t('transfer.autoSelectedAddress'),
                3000
              );
            } else {
              showTxValidationError(t('tx.insufficientBalance'), null, t('transfer.autoSelectFailed'));
              return;
            }
          } else {
            showTxValidationError(t('transfer.noMatchingAddress'), null, t('transfer.autoSelectFailed'));
            return;
          }
        } else if (sel.length === 0) {
          showTxValidationError(t('toast.pleaseSelectSourceAddress'), null, t('tx.addressNotSelected'));
          return;
        }
      } else if (sel.length === 0) {
        showTxValidationError(t('toast.pleaseSelectSourceAddress'), null, t('tx.addressNotSelected'));
        return;
      }
      // ========== 自动选择结束 ==========

      for (const addr of sel) {
        if (!getAddrMeta(addr)) {
          showTxValidationError(t('toast.cannotParseAddress'), null, t('tx.addressError'));
          return;
        }
      }

      const rows = recipientRows;
      if (rows.length === 0) {
        showTxValidationError(t('wallet.addRecipient'), null, t('tx.missingTransferInfo'));
        return;
      }

      const isCross = tfMode?.value === 'cross';
      if (isCross && rows.length !== 1) {
        showTxValidationError(t('wallet.crossChain'), null, t('tx.crossChainLimit'));
        return;
      }

      const changeMap: Record<number, string> = {};
      if (chPGC?.value) changeMap[0] = chPGC.value;
      if (chBTC?.value) changeMap[1] = chBTC.value;
      if (chETH?.value) changeMap[2] = chETH.value;

      const bills: Record<string, TransferBill> = {};
      const vd: Record<number, number> = { 0: 0, 1: 0, 2: 0 };
      let outInterest = 0;
      const addrTypeCache = new Map<string, NormalizedAddressGroupInfo>();

      for (const r of rows) {
        const toEl = r.querySelector('[data-name="to"]') as HTMLInputElement | null;
        const mtEl = r.querySelector('[data-name="mt"]') as HTMLElement | null;
        const valEl = r.querySelector('[data-name="val"]') as HTMLInputElement | null;
        const gidEl = r.querySelector('[data-name="gid"]') as HTMLInputElement | null;
        const pubEl = r.querySelector('[data-name="pub"]') as HTMLInputElement | null;
        const gasEl = r.querySelector('[data-name="gas"]') as HTMLInputElement | null;

        const to = String((toEl && toEl.value) || '').trim();
        const isCapsule = isCapsuleAddress(to);
        const resolvedTo = isCapsule ? String(toEl?.dataset?.resolved || '').trim() : '';
        const normalizedTo = normalizeAddrInput(isCapsule ? resolvedTo : to);
        const mtRaw = (mtEl && mtEl.dataset && mtEl.dataset.val) || '0';
        const mt = Number(mtRaw);
        const val = Number((valEl && valEl.value) || 0);
        const gid = String((gidEl && gidEl.value) || '').trim();
        const comb = String((pubEl && pubEl.value) || '').trim();
        const parsedPub = parsePub(comb);
        const { x: px, y: py, ok: pubOk } = parsedPub;
        const tInt = Number((gasEl && gasEl.value) || 0);

        // Address validation using security.ts
        if (!to) {
          showTxValidationError(t('validation.addressRequired') || t('modal.inputIncomplete'), toEl, t('tx.addressEmpty'));
          return;
        }
        if (isCapsule && !resolvedTo) {
          showTxValidationError(t('capsule.notVerified', '请先验证胶囊地址'), toEl, t('capsule.invalidFormat', '胶囊地址格式不正确'));
          return;
        }
        if (isCross && isCapsule) {
          showTxValidationError(t('capsule.crossNotSupported', '跨链转账不支持胶囊地址'), toEl, t('tx.addressFormatError'));
          return;
        }
        const addrValidation = validateAddress(normalizedTo);
        if (!addrValidation.valid) {
          showTxValidationError(addrValidation.error!, toEl, t('tx.addressFormatError'));
          return;
        }

        // Cross-chain specific: Eth-style address validation (0x + 40 hex chars)
        if (isCross) {
          const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/i;
          if (!ethAddressRegex.test(to)) {
            showTxValidationError(t('tx.invalidEthAddress') || '跨链地址必须为以太坊格式 (0x...)', toEl, t('tx.crossChainAddressFormat') || '地址格式错误');
            return;
          }
        }

        // Currency validation
        if (![0, 1, 2].includes(mt)) {
          showTxValidationError(t('transfer.currency'), null, t('tx.currencyError'));
          return;
        }

        let resolvedRecipientInfo: NormalizedAddressGroupInfo | null = null;

        if (!isCross) {
          const verifiedType = toEl?.dataset?.verifiedType;
          if (verifiedType && Number(verifiedType) !== mt) {
            const expected = getCoinName(Number(verifiedType));
            const selected = getCoinName(mt);
            showTxValidationError(
              t('tx.coinTypeMismatch', { expected, selected }),
              mtEl,
              t('tx.currencyError')
            );
            return;
          }

          const cached = addrTypeCache.get(normalizedTo);
          if (cached) {
            resolvedRecipientInfo = cached;
            if (cached.exists && cached.type !== mt) {
              const expected = getCoinName(cached.type);
              const selected = getCoinName(mt);
              showTxValidationError(
                t('tx.coinTypeMismatch', { expected, selected }),
                mtEl,
                t('tx.currencyError')
              );
              return;
            }
          } else {
            const typeCheck = await querySingleAddressGroup(normalizedTo);
            if (!typeCheck.success) {
              showTxValidationError(
                typeCheck.error || t('tx.queryFailed'),
                toEl,
                t('tx.queryFailed')
              );
              return;
            }
            resolvedRecipientInfo = typeCheck.data;
            const exists = !!resolvedRecipientInfo.exists;
            const expectedType = Number(resolvedRecipientInfo.type ?? 0);
            addrTypeCache.set(normalizedTo, resolvedRecipientInfo);
            if (!exists) {
              showTxValidationError(
                t('tx.recipientAddressNotRegistered', '收款地址未在链上注册，当前协议不允许向未注册地址转账'),
                toEl,
                t('tx.addressError')
              );
              return;
            }
            if (!resolvedRecipientInfo.seedAnchor || !resolvedRecipientInfo.seedChainStep || !resolvedRecipientInfo.defaultSpendAlgorithm) {
              showTxValidationError(
                t('tx.recipientProtocolIncomplete', '收款地址协议状态不完整，缺少 seed/V2 元数据'),
                toEl,
                t('tx.addressError')
              );
              return;
            }
            if (exists && expectedType !== mt) {
              const expected = getCoinName(expectedType);
              const selected = getCoinName(mt);
              showTxValidationError(
                t('tx.coinTypeMismatch', { expected, selected }),
                mtEl,
                t('tx.currencyError')
              );
              return;
            }
          }
        }

        // Amount validation using security.ts (require amount > 0)
        const amountValidation = validateTransferAmount(val, { min: 0 });
        if (!amountValidation.valid) {
          showTxValidationError(amountValidation.error!, valEl, t('tx.amountError'));
          return;
        }

        // Cross-chain specific: Amount must be integer
        if (isCross && !Number.isInteger(val)) {
          showTxValidationError(t('tx.crossChainIntegerAmount') || '跨链金额必须为整数', valEl, t('tx.amountMustBeInteger') || '金额错误');
          return;
        }

        // Organization ID validation using security.ts
        if (gid) {
          const orgValidation = validateOrgId(gid);
          if (!orgValidation.valid) {
            showTxValidationError(orgValidation.error!, gidEl, t('tx.orgIdFormatError'));
            return;
          }
        }

        // Public key validation - skip for cross-chain transactions
        // Cross-chain transactions don't need recipient public key as per backend logic
        if (!isCross && !pubOk) {
          showTxValidationError(t('transfer.publicKey'), pubEl, t('tx.publicKeyFormatError'));
          return;
        }

        // Gas validation
        if (!Number.isFinite(tInt)) {
          showTxValidationError('Gas', gasEl, t('tx.gasParamError'));
          return;
        }
        if (tInt < 0) {
          showTxValidationError('Gas', gasEl, t('tx.gasCannotBeNegative'));
          return;
        }
        if (isCross && mt !== 0) {
          showTxValidationError(t('wallet.crossChain'), null, t('tx.crossChainLimit'));
          return;
        }
        // For cross-chain transactions, use empty/default values for fields not supported by backend
        const effectivePx = isCross ? '' : px;
        const effectivePy = isCross ? '' : py;
        const effectiveGid = isCross ? '' : gid;
        const effectiveInterest = isCross ? 0 : tInt;
        const effectiveSeedAnchor = isCross ? undefined : resolvedRecipientInfo?.seedAnchor;
        const effectiveSeedChainStep = isCross ? undefined : resolvedRecipientInfo?.seedChainStep;
        const effectiveDefaultSpendAlgorithm = isCross ? undefined : resolvedRecipientInfo?.defaultSpendAlgorithm;

        const existingBill = bills[normalizedTo];
        if (existingBill) {
          const sameType = existingBill.MoneyType === mt;
          const sameGroup = existingBill.GuarGroupID === effectiveGid;
          const samePubKey = existingBill.PublicKey.XHex === effectivePx
            && existingBill.PublicKey.YHex === effectivePy;
          const sameSeed = JSON.stringify(existingBill.SeedAnchor || []) === JSON.stringify(effectiveSeedAnchor || [])
            && Number(existingBill.SeedChainStep || 0) === Number(effectiveSeedChainStep || 0)
            && String(existingBill.DefaultSpendAlgorithm || '') === String(effectiveDefaultSpendAlgorithm || '');
          if (!sameType || !sameGroup || !samePubKey || !sameSeed) {
            showTxValidationError(t('tx.duplicateAddress'), null, t('tx.duplicateAddress'));
            return;
          }
          // Merge duplicate recipients for the same address
          existingBill.Value += val;
          existingBill.ToInterest += Math.max(0, effectiveInterest || 0);
        } else {
          bills[normalizedTo] = {
            MoneyType: mt,
            Value: val,
            GuarGroupID: effectiveGid,
            PublicKey: { Curve: 'P256', XHex: effectivePx, YHex: effectivePy },
            ToInterest: effectiveInterest,
            SeedAnchor: effectiveSeedAnchor,
            SeedChainStep: effectiveSeedChainStep,
            DefaultSpendAlgorithm: effectiveDefaultSpendAlgorithm
          };
        }
        vd[mt] += val;
        outInterest += Math.max(0, effectiveInterest || 0);
      }

      const extraPGC = Number(gasInput?.value || 0);
      if (!Number.isFinite(extraPGC) || extraPGC < 0) {
        showTxValidationError(t('wallet.extraGas'), gasInput, t('tx.gasParamError'));
        return;
      }

      const interestGas = extraPGC > 0 ? extraPGC : 0;
      vd[0] += extraPGC;

      const baseTxGas = Number((txGasInput && txGasInput.value) ? txGasInput.value : 1);
      if (!Number.isFinite(baseTxGas) || baseTxGas < 0) {
        showTxValidationError(t('wallet.txGas'), txGasInput, t('tx.gasParamError'));
        return;
      }

      const typeBalances: Record<number, number> = { 0: 0, 1: 0, 2: 0 };
      let availableGas = 0; // 只计算已选择源地址的 Gas

      sel.forEach((addr) => {
        const meta = getAddrMeta(addr);
        if (!meta) return;
        const type = Number(meta.type || 0);
        const val = Number(meta.value && (meta.value.totalValue || meta.value.TotalValue) || 0);
        if (typeBalances[type] !== undefined) {
          typeBalances[type] += val;
        }
        // 累加选中地址的 Gas（interest）
        availableGas += readAddressInterest(meta);
      });

      const ensureChangeAddrValid = (typeId: number): boolean => {
        const need = vd[typeId] || 0;
        if (need <= 0) return true;
        const addr = changeMap[typeId];
        if (!addr) {
          const coinName = getCoinName(typeId);
          showTxValidationError(`${coinName} ${t('transfer.pgcReceiveAddress')}`, null, t('tx.changeAddressMissing'));
          return false;
        }
        const meta = getAddrMeta(addr);
        if (!meta) {
          showTxValidationError(t('transfer.noAddressAvailable'), null, t('tx.changeAddressError'));
          return false;
        }
        if (Number(meta.type || 0) !== Number(typeId)) {
          const coinName = getCoinName(typeId);
          showTxValidationError(`${coinName} ${t('transfer.currency')}`, null, t('tx.changeAddressError'));
          return false;
        }
        return true;
      };

      if (![0, 1, 2].every((t) => (typeBalances[t] || 0) + 1e-8 >= (vd[t] || 0))) {
        const lackType = [0, 1, 2].find((t) => (typeBalances[t] || 0) + 1e-8 < (vd[t] || 0)) ?? 0;
        const coinName = getCoinName(lackType);
        showTxValidationError(`${coinName} ${t('tx.insufficientBalance')}`, null, t('tx.insufficientBalance'));
        return;
      }

      if (![0, 1, 2].every((t) => ensureChangeAddrValid(t))) return;

      const mintedGas = interestGas;
      const totalGasNeed = baseTxGas + outInterest;
      const totalGasBudget = availableGas + mintedGas;

      // Debug log for gas calculation
      console.debug('[Transfer] Gas calculation:', {
        availableGas,
        mintedGas,
        totalGasBudget,
        baseTxGas,
        outInterest,
        totalGasNeed,
        selectedAddresses: sel,
        addressGasDetails: sel.map(addr => {
          const meta = getAddrMeta(addr);
          return {
            addr: addr.slice(0, 10) + '...',
            gas: meta ? readAddressInterest(meta) : 0
          };
        })
      });

      if (totalGasNeed > totalGasBudget + 1e-8) {
        const msg = mintedGas > 0
          ? t('tx.insufficientGasWithMint')
          : t('tx.insufficientGasNoMint');
        console.warn('[Transfer] Gas insufficient:', {
          need: totalGasNeed,
          have: totalGasBudget,
          availableGas,
          mintedGas
        });
        showTxValidationError(t('tx.insufficientGas'), null, msg);
        return;
      }

      const usedTypes = [0, 1, 2].filter((t) => (vd[t] || 0) > 0);
      let finalSel = sel.slice();
      let removedAddrs: string[] = [];

      if (usedTypes.length) {
        const infos: AddressInfo[] = sel.map((addr) => {
          const meta = getAddrMeta(addr);
          const type = meta ? Number(meta.type || 0) : 0;
          const val = meta ? Number(meta.value && (meta.value.totalValue || meta.value.TotalValue) || 0) : 0;
          const bal: Record<number, number> = { 0: 0, 1: 0, 2: 0 };
          if (bal[type] !== undefined) bal[type] = val;

          const totalRel = usedTypes.reduce((s, t) => s + bal[t] * (COIN_TO_PGC_RATES[t as CoinTypeId] || 1), 0);
          return { addr, bal, totalRel };
        });

        const candidates = infos.filter((info) => usedTypes.some((t) => info.bal[t] > 0));
        if (candidates.length) {
          candidates.sort((a, b) => b.totalRel - a.totalRel);
          const remain: Record<number, number> = {};
          usedTypes.forEach((t) => { remain[t] = vd[t] || 0; });
          const chosen: string[] = [];

          for (const info of candidates) {
            if (usedTypes.every((t) => (remain[t] || 0) <= 0)) break;
            const helps = usedTypes.some((t) => (remain[t] || 0) > 0 && info.bal[t] > 0);
            if (!helps) continue;
            chosen.push(info.addr);
            usedTypes.forEach((t) => {
              if ((remain[t] || 0) > 0 && info.bal[t] > 0) {
                remain[t] = Math.max(0, (remain[t] || 0) - info.bal[t]);
              }
            });
          }

          if (usedTypes.every((t) => (remain[t] || 0) <= 0)) {
            const chosenSet = new Set(chosen);
            const optimizedSel = sel.filter((a) => chosenSet.has(a));
            const extra = sel.filter((a) => !chosenSet.has(a));
            if (optimizedSel.length && extra.length) {
              finalSel = optimizedSel;
              removedAddrs = extra;
              Array.from(addrList!.querySelectorAll('input[type="checkbox"]')).forEach((inp: any) => {
                const checked = finalSel.indexOf(inp.value) !== -1;
                inp.checked = checked;
                const label = inp.closest('label');
                if (label) label.classList.toggle('selected', checked);
              });
            }
          }
        }
      }

      if (removedAddrs.length) {
        // 使用 toast 提示，避免挡住后续的确认对话框
        // showToast(message, type, title, duration)
        showToast(
          t('transfer.optimizedAddresses', { count: String(removedAddrs.length) }),
          'info',
          t('toast.addressOptimized'),
          2000
        );
      }

      if (extraPGC > 0) {
        // Use t() function's built-in parameter substitution
        // The translation string has {amount} placeholders that t() will replace
        const exchangeDesc = t('transfer.exchangeGasDesc', { amount: String(extraPGC) });
        const confirmed = await showConfirmModal(
          t('transfer.confirmExchangeGas'),
          exchangeDesc,
          t('transfer.confirmExchange'),
          t('common.cancel')
        );
        if (!confirmed) return;
      }

      const backAssign: Record<string, number> = {};
      finalSel.forEach((a, i) => { backAssign[a] = i === 0 ? 1 : 0; });

      const valueTotal = Object.keys(vd).reduce((s, k) => s + vd[Number(k)] * (COIN_TO_PGC_RATES[Number(k) as CoinTypeId] || 1), 0);
      const wantsTXCer = String(useTXCer?.value) === 'true';
      const needsMainCurrency = (vd[0] || 0) > 0 || extraPGC > 0;

      const build: BuildTXInfo = {
        Value: valueTotal,
        ValueDivision: vd,
        Bill: bills,
        UserAddress: finalSel,
        PriUseTXCer: wantsTXCer && needsMainCurrency,
        ChangeAddress: changeMap,
        IsPledgeTX: String(isPledge?.value) === 'true',
        HowMuchPayForGas: extraPGC,
        IsCrossChainTX: isCross,
        Data: '',
        InterestAssign: { Gas: baseTxGas, Output: outInterest, BackAssign: backAssign }
      };

      if (isCross && finalSel.length !== 1) {
        showTxValidationError(t('transfer.crossChainSingleInput'), null, t('transfer.crossChainLimit'));
        return;
      }
      if (isCross && !changeMap[0]) {
        showTxValidationError(t('transfer.selectChangeAddress'), null, t('transfer.changeAddressMissing'));
        return;
      }



      // ========== 直接构造交易（合并原 buildTxBtn 的功能）==========
      console.log('[构造交易] ========== 开始构造 ==========');

      const user = loadUser();
      if (!user) {
        const errMsg = '用户数据不存在，请先登录';
        console.error('[构造交易] 错误:', errMsg);
        showToast(errMsg, 'error', t('common.notLoggedIn'), 2000);
        return;
      }

      if (!user.accountId) {
        const errMsg = '账户 ID 不存在，请重新登录';
        console.error('[构造交易] 错误:', errMsg);
        showToast(errMsg, 'error', t('common.notLoggedIn'), 2000);
        return;
      }

      // 检查是否是普通转账模式（未加入担保组织的用户）
      const isNormalTransferMode = !user.orgNumber && !user.guarGroup?.groupID;
      if (isNormalTransferMode) {
        console.log('[构造交易] 用户未加入担保组织，使用普通转账模式 (TXType=8)');
      }

      // 检查账户私钥（支持加密私钥）
      let accountPrivKey = user.keys?.privHex || user.privHex || '';

      // 如果没有明文私钥，检查是否有加密私钥
      if (!accountPrivKey && user.accountId && hasEncryptedKey(user.accountId)) {
        console.log('[构造交易] 检测到加密私钥，需要密码解密');
        hideLoading(loadingId);

        const password = await showPasswordPrompt({
          title: t('encryption.enterPassword') || '请输入密码',
          description: t('encryption.decryptForTx') || '需要密码解密私钥以签署交易',
          placeholder: t('encryption.passwordPlaceholder') || '请输入您的密码'
        });

        if (!password) {
          console.log('[构造交易] 用户取消密码输入');
          return;
        }

        const newLoadingId = showLoading(t('toast.buildingTx'));

        try {
          accountPrivKey = await getPrivateKey(user.accountId, password);
          console.log('[构造交易] 私钥解密成功');
          if (!user.keys) user.keys = { privHex: '', pubXHex: '', pubYHex: '' };
          user.keys.privHex = accountPrivKey;
        } catch (decryptErr) {
          hideLoading(newLoadingId);
          const errMsg = t('encryption.wrongPassword') || '密码错误，无法解密私钥';
          console.error('[构造交易] 私钥解密失败:', decryptErr);
          showToast(errMsg, 'error', t('toast.buildTxFailed'), 2000);
          return;
        }
      } else if (!accountPrivKey) {
        const errMsg = t('txBuilder.noAccountPrivKey') || '账户私钥不存在';
        console.error('[构造交易] 错误:', errMsg);
        showToast(errMsg, 'error', t('toast.buildTxFailed'), 2000);
        return;
      }

      // 检查钱包数据
      const walletData = user.wallet?.addressMsg || {};
      if (Object.keys(walletData).length === 0) {
        const errMsg = t('txBuilder.noWalletData') || '钱包数据为空';
        console.error('[构造交易] 错误:', errMsg);
        showToast(errMsg, 'error', t('toast.buildTxFailed'), 2000);
        return;
      }

      // 检查发送地址
      const fromAddresses = build.UserAddress || [];
      if (fromAddresses.length === 0) {
        const errMsg = t('txBuilder.noFromAddress') || '未选择发送地址';
        console.error('[构造交易] 错误:', errMsg);
        showToast(errMsg, 'error', t('toast.buildTxFailed'), 2000);
        return;
      }

      // 检查每个发送地址是否有私钥
      for (const addr of fromAddresses) {
        const addrData = walletData[addr];
        if (!addrData) {
          const errMsg = (t('txBuilder.addressNotFound') || '地址不存在: ') + addr.slice(0, 16) + '...';
          console.error('[构造交易] 错误:', errMsg);
          showToast(errMsg, 'error', t('toast.buildTxFailed'), 2000);
          return;
        }
        if (!addrData.privHex) {
          const errMsg = (t('txBuilder.noAddressPrivKey') || '地址缺少私钥: ') + addr.slice(0, 16) + '...';
          console.error('[构造交易] 错误:', errMsg);
          showToast(errMsg, 'error', t('toast.buildTxFailed'), 2000);
          return;
        }
        const protocolIssues = getAddressProtocolIssues(addr, addrData);
        if (!hasAddressProtocolMetadata(addrData) || protocolIssues.length > 0) {
          const errMsg = protocolIssues[0] || (t('tx.addressProtocolIncomplete', '地址协议状态不完整，无法转账'));
          console.error('[构造交易] 错误:', errMsg);
          showToast(errMsg, 'error', t('toast.buildTxFailed'), 2000);
          return;
        }
        if (addrData.readOnly || addrData.seedRepairRequired) {
          const errMsg = t('tx.addressReadOnly', '地址缺少可用 seed 私有状态，当前为只读');
          console.error('[构造交易] 错误:', errMsg);
          showToast(errMsg, 'error', t('toast.buildTxFailed'), 2000);
          return;
        }
        if (isNormalTransferMode && addrData.registrationState && addrData.registrationState !== 'registered') {
          const errMsg = t('tx.addressNotRegistered', '散户地址尚未完成注册，无法发起转账');
          console.error('[构造交易] 错误:', errMsg);
          showToast(errMsg, 'error', t('toast.buildTxFailed'), 2000);
          return;
        }
      }

      // 🔒 锁定可能使用的 TXCer（防止与轮询更新产生竞态条件）
      const lockedTXCerIds: string[] = [];
      try {
        for (const addr of fromAddresses) {
          const addrData = walletData[addr];
          if (addrData?.txCers && Object.keys(addrData.txCers).length > 0) {
            const txCerIds = Object.keys(addrData.txCers);
            const lockedIds = lockTXCers(txCerIds, `构造交易 - 地址 ${addr.slice(0, 8)}...`);
            lockedTXCerIds.push(...lockedIds);
            console.log(`[构造交易] 锁定地址 ${addr.slice(0, 8)}... 的 ${lockedIds.length} 个 TXCer`);
          }
        }
        if (lockedTXCerIds.length > 0) {
          console.log(`[构造交易] 共锁定 ${lockedTXCerIds.length} 个 TXCer`);
        }
      } catch (lockErr) {
        console.warn('[构造交易] TXCer 锁定失败:', lockErr);
        // 锁定失败不影响继续构造
      }

      // 使用新的交易构造器
      let userNewTX: UserNewTX | null = null;
      let aggregateGTX: AggregateGTXForSubmit | null = null;

      try {
        if (isNormalTransferMode) {
          // ========== 普通转账模式：构建 AggregateGTX ==========
          console.log('[构造交易] 普通转账模式，构建 AggregateGTX...');

          const buildParams: BuildTransactionParams = {
            fromAddresses: build.UserAddress,
            recipients: Object.entries(build.Bill).map(([address, bill]) => ({
              address,
              amount: bill.Value,
              coinType: bill.MoneyType,
              publicKeyX: bill.PublicKey?.XHex || '',
              publicKeyY: bill.PublicKey?.YHex || '',
              guarGroupID: bill.GuarGroupID || '',
              interest: bill.ToInterest || 0,
              seedAnchor: bill.SeedAnchor,
              seedChainStep: bill.SeedChainStep,
              defaultSpendAlgorithm: bill.DefaultSpendAlgorithm
            })),
            changeAddresses: build.ChangeAddress,
            gas: build.InterestAssign.Gas,
            isCrossChain: false,
            howMuchPayForGas: build.HowMuchPayForGas || 0,
            preferTXCer: false
          };

          aggregateGTX = await buildNormalTransaction(buildParams, user);
          console.log('[构造交易] 普通转账交易构造成功');
          console.log('[构造交易] TXHash:', aggregateGTX.TXHash);
        } else {
          // ========== 担保交易模式：构建 UserNewTX ==========
          userNewTX = await buildTransactionFromLegacy(build, user);
          console.log('[构造交易] 交易构造成功');
          console.log('[构造交易] TXID:', userNewTX.TX.TXID);
          console.log('[构造交易] TXType:', userNewTX.TX.TXType, userNewTX.TX.TXType === 1 ? '(使用了TXCer)' : '(仅UTXO)');
        }
      } catch (buildErr) {
        // 🔓 构造失败，解锁 TXCer
        if (lockedTXCerIds.length > 0) {
          unlockTXCers(lockedTXCerIds, false);
          console.log(`[构造交易] 构造失败，已解锁 ${lockedTXCerIds.length} 个 TXCer`);
        }
        throw buildErr;
      }

      // Save transaction data and show view button


      // ========== Step 2: 确认并发送交易 ==========
      // 获取交易ID用于显示
      let displayTxId = '';
      if (userNewTX) {
        displayTxId = userNewTX.TX.TXID;
      } else if (aggregateGTX && aggregateGTX.AllTransactions.length > 0) {
        displayTxId = aggregateGTX.AllTransactions[0].TXID || aggregateGTX.TXHash.substring(0, 16);
      }

      // 对于担保交易，检查担保组织信息
      let guarGroup: ReturnType<typeof getJoinedGroup> = null;
      if (!isNormalTransferMode) {
        guarGroup = getJoinedGroup();
        if (!guarGroup || !guarGroup.groupID) {
          // 🔓 无担保组织，解锁 TXCer
          if (lockedTXCerIds.length > 0) {
            unlockTXCers(lockedTXCerIds, false);
          }
          const errMsg = t('txBuilder.noGuarGroup') || '用户未加入担保组织，无法发送交易';
          console.error('[发送交易] 错误:', errMsg);
          showToast(errMsg, 'error', t('toast.sendTxFailed') || '发送失败', 2000);
          return;
        }
      }

      // 检查交易模式（仅对担保交易检查）
      const currentTfMode = tfMode?.value || 'quick';
      if (!isNormalTransferMode && currentTfMode !== 'quick' && currentTfMode !== 'cross') {
        // 🔓 不支持的模式，解锁 TXCer
        if (lockedTXCerIds.length > 0) {
          unlockTXCers(lockedTXCerIds, false);
        }
        if (currentTfMode === 'pledge') {
          const errMsg = t('transfer.pledgeNotSupported') || '目前不支持质押交易';
          showToast(errMsg, 'error', t('toast.sendTxFailed'), 2000);
        } else {
          const errMsg = t('transfer.onlyQuickTransferSupported') || '目前只支持快速转账类型的交易';
          showToast(errMsg, 'error', t('toast.sendTxFailed'), 2000);
        }
        return;
      }

      // 计算转账总金额用于显示
      const totalAmount = Object.values(bills).reduce((sum, bill) => sum + bill.Value, 0);
      const recipientCount = Object.keys(bills).length;

      // 显示确认对话框
      const confirmMessage = t('transfer.confirmSendTxDesc', {
        amount: totalAmount.toFixed(4),
        recipients: String(recipientCount),
        txid: displayTxId
      }) || `确认发送交易？\n\n交易ID: ${displayTxId}\n收款方数量: ${recipientCount}\n总金额: ${totalAmount.toFixed(4)}`;

      const confirmed = await showConfirmModal(
        t('transfer.confirmSendTx') || '确认发送交易',
        confirmMessage,
        t('transfer.send') || '发送',
        t('common.cancel') || '取消'
      );

      if (!confirmed) {
        // 🔓 用户取消，解锁 TXCer
        if (lockedTXCerIds.length > 0) {
          unlockTXCers(lockedTXCerIds, false);
          console.log(`[发送交易] 用户取消，已解锁 ${lockedTXCerIds.length} 个 TXCer`);
        }
        console.log('[发送交易] 用户取消发送');
        showToast(t('transfer.txBuildSuccess') || '交易已构造，稍后可手动发送', 'info');
        return;
      }

      // ========== Step 3: 发送交易到后端 ==========
      console.log('[发送交易] 开始发送交易到后端...');

      // 更新 loading 提示
      hideLoading(loadingId);
      const sendLoadingId = showLoading(t('transfer.sendingTx') || '正在发送交易...');

      try {
        let result: { success: boolean; tx_id?: string; error?: string };

        if (isNormalTransferMode && aggregateGTX) {
          // ========== 普通转账：发送到 ComNode ==========
          console.log('[发送交易] 普通转账模式，发送到 ComNode...');

          const comNodeBaseURL = await getComNodeURL(false, false);
          if (!comNodeBaseURL) {
            result = {
              success: false,
              error: t('comNode.notAvailable', 'ComNode 端点不可用，请稍后重试')
            };
          } else {
            const comNodeUrl = `${comNodeBaseURL}${API_ENDPOINTS.COM_SUBMIT_NOGUARGROUP_TX}`;
            console.log('[发送交易] ComNode URL:', comNodeUrl);

            const response = await fetch(comNodeUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: serializeAggregateGTX(aggregateGTX)
            });

            if (response.status === 503) {
              clearComNodeCache();
            }

            const respData = await response.json().catch(() => ({}));
            console.log('[发送交易] ComNode 响应:', respData);

            if (response.ok && respData.success) {
              result = {
                success: true,
                tx_id: respData.tx_hash || displayTxId
              };
            } else if (response.status === 503) {
              result = {
                success: false,
                error: t('error.leaderUnavailable', 'Leader 节点暂时不可用，请稍后重试')
              };
            } else {
              result = {
                success: false,
                error: respData.error || '提交失败'
              };
            }
          }
        } else if (userNewTX && guarGroup) {
          // ========== 担保交易：发送到 AssignNode ==========
          console.log('[发送交易] 担保组织ID:', guarGroup.groupID);

          let assignNodeUrl: string | undefined;
          if (guarGroup.assignAPIEndpoint) {
            assignNodeUrl = buildAssignNodeUrl(guarGroup.assignAPIEndpoint);
            console.log('[发送交易] AssignNode URL:', assignNodeUrl);
          } else {
            console.warn('[发送交易] 警告: 担保组织缺少 assignAPIEndpoint，将使用默认 API_BASE_URL');
          }

          result = await submitTransaction(userNewTX, guarGroup.groupID, assignNodeUrl);
        } else {
          throw new Error('交易数据不完整');
        }

        // 立即隐藏 loading，不等待轮询
        hideLoading(sendLoadingId);

        if (result.success) {
          console.log('[发送交易] 交易发送成功，TXID:', result.tx_id);

          // 🔒 发送成功 - TXCer 处理（仅担保交易使用 TXCer）
          if (lockedTXCerIds.length > 0 && userNewTX) {
            const usedTxCerIds: string[] = [];
            if (userNewTX.TX.TXInputsCertificate) {
              for (const txCer of userNewTX.TX.TXInputsCertificate as any[]) {
                if (txCer?.TXCerID) {
                  usedTxCerIds.push(String(txCer.TXCerID));
                }
              }
            }

            const unusedTxCerIds = lockedTXCerIds.filter(id => !usedTxCerIds.includes(id));
            if (unusedTxCerIds.length > 0) {
              unlockTXCers(unusedTxCerIds, false);
              console.log(`[发送交易] 已解锁 ${unusedTxCerIds.length} 个未使用的 TXCer`);
            }

            if (usedTxCerIds.length > 0) {
              markTXCersSubmitted(usedTxCerIds, result.tx_id || userNewTX.TX.TXID);
              console.log(`[发送交易] 已锁定 ${usedTxCerIds.length} 个已使用的 TXCer，等待确认`);
            }
          }

          const txIdToQuery = isNormalTransferMode ? displayTxId : (result.tx_id || displayTxId);
          const historyStatus: HistoryStatus = 'pending';
          const transferMode = isNormalTransferMode ? 'normal' : (currentTfMode === 'cross' ? 'cross' : 'quick');
          const historyRecords = buildOutgoingHistoryRecords(build, finalSel, txIdToQuery, historyStatus, {
            guarantorOrg: guarGroup?.groupID || '',
            txMode: currentTfMode,
            transferMode
          });
          if (historyRecords.length > 0) {
            addTxHistoryRecords(historyRecords);
          }

          const pendingSeedAdvances = collectPendingSeedAdvances(userNewTX, aggregateGTX, txIdToQuery);
          if (pendingSeedAdvances.length > 0) {
            setPendingSeedAdvances(pendingSeedAdvances);
          }

          // 🔒 锁定使用到的 UTXO（担保交易和散户普通转账都需要本地防重入）
          const txInputsForLock = userNewTX?.TX?.TXInputsNormal
            || aggregateGTX?.AllTransactions?.[0]?.TXInputsNormal
            || [];
          if (txInputsForLock.length > 0) {
            try {
              const utxosToLock: Omit<LockedUTXO, 'lockTime' | 'txId'>[] = [];

              for (const input of txInputsForLock as any[]) {
                const fromAddrHint = input.FromAddress?.toLowerCase() || '';
                const fromTxId = input.FromTXID || '';
                const indexZ = input.FromTxPosition?.IndexZ ?? 0;

                // 构造 UTXO ID (与 utxoLock.ts 中的格式一致)
                const utxoId = `${fromTxId}_${indexZ}`;

                if (!fromTxId) {
                  console.warn('[发送交易] 跳过锁定：TXInputsNormal 缺少 FromTXID');
                  continue;
                }

                // 兼容后端格式 key
                const backendKey = `${fromTxId} + ${indexZ}`;

                // 在钱包中定位该 UTXO（优先 FromAddress，其次全表扫描）
                let resolvedAddr = fromAddrHint;
                let resolvedAddrData: any = (user.wallet?.addressMsg as any)?.[resolvedAddr];

                let utxoData: any = resolvedAddrData?.utxos?.[utxoId] || resolvedAddrData?.utxos?.[backendKey];

                if (!utxoData) {
                  const allAddrs = (user.wallet?.addressMsg || {}) as Record<string, any>;
                  for (const [addrKey, addrData] of Object.entries(allAddrs)) {
                    const candidate = addrData?.utxos?.[utxoId] || addrData?.utxos?.[backendKey];
                    if (candidate) {
                      resolvedAddr = String(addrKey).toLowerCase();
                      resolvedAddrData = addrData;
                      utxoData = candidate;
                      break;
                    }
                  }
                }

                if (!resolvedAddr) {
                  // 兜底：仍然用 hint
                  resolvedAddr = fromAddrHint;
                }

                // 获取 UTXO 的金额和类型
                const value = Number(utxoData?.Value ?? 0) || 0;
                const type = Number(utxoData?.Type ?? resolvedAddrData?.type ?? 0) || 0;

                if (!utxoData) {
                  console.warn('[发送交易] 未在钱包中找到 UTXO，仍会锁定以防双花，但锁定金额可能为 0:', utxoId);
                }

                utxosToLock.push({
                  utxoId,
                  address: resolvedAddr,
                  value,
                  type
                });
              }

              if (utxosToLock.length > 0) {
                lockUTXOs(utxosToLock, txIdToQuery);
                console.log('[发送交易] 已锁定', utxosToLock.length, '个 UTXO');
              }
            } catch (lockErr) {
              console.warn('[发送交易] 锁定 UTXO 失败:', lockErr);
              // 锁定失败不影响交易发送
            }
          }

          // 显示成功提示，根据交易类型显示不同消息
          let successMsg: string;
          let successTitle: string;
          if (isCross) {
            successMsg = t('transfer.txSubmittedCrossChain') || '跨链转账交易已提交，正在后台等待确认...';
            successTitle = t('toast.sendTxSuccessCrossChain') || '跨链交易发送成功';
          } else if (isNormalTransferMode) {
            successMsg = t('transfer.txSubmittedNormal') || '普通转账交易已提交，正在后台等待确认...';
            successTitle = t('toast.sendTxSuccessNormal') || '普通转账发送成功';
          } else {
            successMsg = t('transfer.txSubmittedQuick') || '快速转账交易已提交，正在后台等待确认...';
            successTitle = t('toast.sendTxSuccessQuick') || '快速转账发送成功';
          }
          showToast(successMsg, 'success', successTitle);

          // 清除草稿（交易已提交）
          try { clearTransferDraft(); } catch (_) { }

          // 清空表单
          try {
            Array.from(addrList!.querySelectorAll('input[type="checkbox"]')).forEach((inp: any) => {
              inp.checked = false;
              const label = inp.closest('label');
              if (label) label.classList.remove('selected');
            });
            if (billList) {
              billList.innerHTML = '';
              // 重新添加一个空的收款人卡片
              try {
                const recipientModule = await import('./recipient.js');
                const computeCurrentOrgId = () => {
                  const guarGroup = getJoinedGroup();
                  return guarGroup?.groupID || '';
                };
                recipientModule.addRecipientCard(billList, computeCurrentOrgId);
              } catch (e) {
                console.warn('[发送交易] 重新添加收款人卡片失败:', e);
              }
            }
            if (gasInput) gasInput.value = '0';
            if (txGasInput) txGasInput.value = '1';
          } catch (_) { }

          // 🔄 重新渲染钱包以显示锁定状态
          try {
            const { renderWallet, refreshSrcAddrList } = await import('./wallet');
            renderWallet();
            refreshSrcAddrList();
          } catch (_) { }

          // 🔄 后台异步轮询交易状态（不阻塞用户界面）
          // 注：普通转账暂不支持状态轮询（ComNode 不提供此接口）
          if (!isNormalTransferMode && guarGroup) {
            console.log('[发送交易] 开始后台轮询交易状态:', txIdToQuery);

            const pollingAssignUrl = guarGroup.assignAPIEndpoint
              ? buildAssignNodeUrl(guarGroup.assignAPIEndpoint)
              : undefined;
            // 使用 setTimeout 0 确保 UI 先更新
            setTimeout(() => {
              pollTXStatusInBackground(txIdToQuery, guarGroup.groupID, pollingAssignUrl);
            }, 0);
          } else {
            console.log('[发送交易] 普通转账模式，跳过状态轮询');
          }

        } else {
          const errMsg = result.error || t('transfer.unknownError') || '未知错误';
          const errorCode = (result as any).errorCode;
          console.error('[发送交易] 发送失败:', errMsg, 'errorCode:', errorCode);

          // Provide more helpful error messages based on error code
          let userFriendlyMsg = errMsg;
          let title = t('toast.sendTxFailed') || '交易发送失败';

          if (errorCode === 'USER_NOT_IN_ORG') {
            title = t('error.userNotInGroup') || '用户不在担保组织内';
          }
          userFriendlyMsg = humanizeProtocolError(errMsg, errorCode);

          // 🔓 发送失败，解锁 TXCer（不删除）
          if (lockedTXCerIds.length > 0) {
            unlockTXCers(lockedTXCerIds, false);
            console.log(`[发送交易] 发送失败，已解锁 ${lockedTXCerIds.length} 个 TXCer`);
          }

          const transferMode = isNormalTransferMode ? 'normal' : (currentTfMode === 'cross' ? 'cross' : 'quick');
          const failedRecords = buildOutgoingHistoryRecords(build, finalSel, displayTxId, 'failed', {
            failureReason: userFriendlyMsg,
            guarantorOrg: guarGroup?.groupID || '',
            txMode: currentTfMode,
            transferMode
          });
          if (failedRecords.length > 0) {
            addTxHistoryRecords(failedRecords);
          }

          showToast(userFriendlyMsg, 'error', title);
        }
      } catch (sendErr: any) {
        hideLoading(sendLoadingId);

        // 🔓 发送异常，解锁 TXCer（不删除）
        if (lockedTXCerIds.length > 0) {
          unlockTXCers(lockedTXCerIds, false);
          console.log(`[发送交易] 发送异常，已解锁 ${lockedTXCerIds.length} 个 TXCer`);
        }

        const errMsg = sendErr?.message || String(sendErr);
        console.error('[发送交易] 发送异常:', errMsg);

        let finalDisplayMsg = humanizeProtocolError(
          errMsg,
          errMsg.includes('V2 user signature') ? 'TX_V2_SIGNATURE_FAILED' : undefined
        );
        if (finalDisplayMsg === errMsg) {
          finalDisplayMsg = t('transfer.networkError') || ('网络错误，请检查网络连接后重试：' + errMsg);
        }

        const transferMode = isNormalTransferMode ? 'normal' : (currentTfMode === 'cross' ? 'cross' : 'quick');
        const failedRecords = buildOutgoingHistoryRecords(build, finalSel, displayTxId, 'failed', {
          failureReason: finalDisplayMsg,
          guarantorOrg: guarGroup?.groupID || '',
          txMode: currentTfMode,
          transferMode
        });
        if (failedRecords.length > 0) {
          addTxHistoryRecords(failedRecords);
        }

        showToast(
          finalDisplayMsg,
          'error',
          t('toast.sendTxFailed') || '交易发送失败'
        );
      }
    } catch (err: any) {
      // Restore stable UI state and storage snapshot
      try { if (snapTxErr) restoreFromSnapshot(snapTxErr); } catch (_) { }
      try { if (snapTxErr) restoreFromSnapshot(snapTxErr); } catch (_) { }
      // try { if (snapActions) restoreFromSnapshot(snapActions); } catch (_) { }
      // try { if (snapViewTx) restoreFromSnapshot(snapViewTx); } catch (_) { }
      // try { if (snapViewBuild) restoreFromSnapshot(snapViewBuild); } catch (_) { }
      try { restoreCheckpoint(checkpointId); } catch (_) { }

      const msg = err?.message || String(err);
      showToast(msg, 'error', t('toast.buildTxFailed') || '操作失败');
    } finally {
      // Restore button state (restore span text to preserve SVG)
      tfBtn.disabled = false;
      const btnSpan = tfBtn.querySelector('span');
      if (btnSpan) {
        btnSpan.textContent = originalText;
      } else {
        tfBtn.textContent = originalText;
      }
      transferSubmitGuard.end();
      hideLoading(loadingId);
    }
  };

  (tfBtn as any)._transferSubmitHandler = onTransferSubmit;
  tfBtn.addEventListener('click', onTransferSubmit);

  tfBtn.dataset._bind = '1';
}

// ========================================
// 后台轮询交易状态
// ========================================

/**
 * 后台异步轮询交易状态
 * 
 * 不阻塞用户界面，通过 toast 通知用户状态变化
 * 
 * @param txID 交易ID
 * @param groupID 担保组织ID
 * @param assignNodeUrl AssignNode URL（可选）
 */
async function pollTXStatusInBackground(
  txID: string,
  groupID: string,
  assignNodeUrl?: string,
  minBlockHeight?: number
): Promise<void> {
  console.log('[后台轮询] 开始轮询交易状态:', txID);

  try {
    const confirmResult = await waitForTXConfirmation(
      txID,
      groupID,
      assignNodeUrl,
      {
        pollInterval: 2000,   // 每 2 秒轮询一次
        maxWaitTime: 60000,
        minBlockHeight: typeof minBlockHeight === 'number' ? minBlockHeight : 0,   // 最多等待 60 秒
        onStatusChange: (status: TXStatusResponse) => {
          // 状态变化时通过 toast 通知用户
          if (status.status === 'pending') {
            console.log('[后台轮询] 交易处理中...');
            // 不频繁弹 toast，避免打扰用户
          }
        }
      }
    );

    if (confirmResult.success) {
      // AssignNode 验证通过并不代表已上链，保持 pending，等待 account_update 确认
      console.log('[后台轮询] 交易已通过验证，等待上链确认:', txID);
    } else if (confirmResult.timeout) {

      // 超时 - 显示提示 toast
      console.log('[后台轮询] 交易确认超时:', txID);
      showToast(
        t('transfer.txConfirmationTimeoutShort', { txid: txID.slice(0, 8) + '...' }) ||
        `交易 ${txID.slice(0, 8)}... 确认超时，请稍后查看交易历史`,
        'warning',
        t('transfer.txConfirmationTimeout') || '确认超时',
        5000
      );

    } else {
      // 交易验证失败 - 显示错误 toast 并解锁 UTXO
      const errorReason = confirmResult.errorReason || t('transfer.unknownError') || '未知错误';
      const humanizedReason = humanizeProtocolError(errorReason);
      console.log('[后台轮询] 交易验证失败:', txID, humanizedReason);
      clearPendingSeedAdvanceByTxId(txID);
      updateTxHistoryByTxId(txID, {
        status: 'failed',
        failureReason: humanizedReason
      });

      // 🔓 解锁与此交易相关的 UTXO（交易失败，UTXO 可以再次使用）
      try {
        const { unlockUTXOsByTxId } = await import('../utils/utxoLock');
        unlockUTXOsByTxId(txID);
        console.log('[后台轮询] 已解锁交易', txID, '的 UTXO');

        // 刷新 UI 显示最新的锁定状态
        const { renderWallet, refreshSrcAddrList } = await import('./wallet');
        renderWallet();
        refreshSrcAddrList();
      } catch (unlockErr) {
        console.warn('[后台轮询] 解锁 UTXO 失败:', unlockErr);
      }

      // 🔓 交易失败：解锁这笔交易占用的 TXCer（不处理缓存，避免误删）
      try {
        const lockedTxCers = getLockedTXCerIdsByTxId(txID);
        if (lockedTxCers.length > 0) {
          unlockTXCers(lockedTxCers, false);
          console.log('[后台轮询] 已解锁交易', txID, '占用的 TXCer', lockedTxCers.length);
        }
      } catch (e) {
        console.warn('[后台轮询] 解锁 TXCer 失败:', e);
      }

      showToast(
        t('transfer.txVerificationFailedShort', { reason: humanizedReason }) ||
        `交易验证失败: ${humanizedReason}`,
        'error',
        t('transfer.txVerificationFailed') || '交易验证失败',
        8000  // 错误信息显示更久
      );
    }

  } catch (err: any) {
    console.warn('[后台轮询] 轮询异常:', err);
    // 轮询失败不需要特别提示，用户可以在交易历史中查看
  }
}

// initBuildTransaction 已合并到 initTransferSubmit 中，不再需要单独的函数
