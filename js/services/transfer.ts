/**
 * Transfer Transaction Builder Module
 * 
 * Handles transaction building, validation and submission
 */

import { t } from '../i18n/index.js';
import { loadUser, User, AddressData, getJoinedGroup } from '../utils/storage';
import { readAddressInterest } from '../utils/helpers.js';
import { showModalTip, showConfirmModal } from '../ui/modal';
import { BuildTXInfo } from './transaction';
import { buildTransactionFromLegacy, serializeUserNewTX, submitTransaction, UserNewTX, waitForTXConfirmation, TXStatusResponse } from './txBuilder';
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
 * Show transaction validation error
 */
function showTxValidationError(msg: string, focusEl: HTMLElement | null, title: string = '参数校验失败'): void {
  const txErr = document.getElementById(DOM_IDS.txError);
  if (txErr) {
    txErr.textContent = msg;
    txErr.classList.remove('hidden');
  }
  showModalTip(title, msg, true);
  if (focusEl && typeof focusEl.focus === 'function') focusEl.focus();
}

/**
 * Get wallet snapshot with strict typing
 */
function getWalletSnapshot(): WalletSnapshot {
  const u0 = loadUser();
  let walletMap = (u0 && u0.wallet && u0.wallet.addressMsg) || {};
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
 * Disables the button if user hasn't joined a guarantor organization
 */
export function updateTransferButtonState(): void {
  const tfBtn = document.getElementById(DOM_IDS.tfSendBtn) as HTMLButtonElement | null;
  if (!tfBtn) return;

  const guarGroup = getJoinedGroup();
  const user = loadUser();
  const hasJoined = !!(guarGroup && guarGroup.groupID && (user?.orgNumber || user?.guarGroup?.groupID));

  // Get the mode selector to check if it's quick transfer
  const tfMode = document.getElementById(DOM_IDS.tfMode) as HTMLSelectElement | null;
  const currentMode = tfMode?.value || 'quick';
  const isQuickTransfer = currentMode === 'quick';

  // Enable button only if user has joined org AND is using quick transfer mode
  const shouldEnable = hasJoined && isQuickTransfer;

  tfBtn.disabled = !shouldEnable;

  // Update button appearance
  if (shouldEnable) {
    tfBtn.classList.remove('btn-disabled');
    tfBtn.title = '';
  } else {
    tfBtn.classList.add('btn-disabled');
    if (!hasJoined) {
      tfBtn.title = t('transfer.joinOrgFirst') || '请先加入担保组织后才能发送交易';
    } else if (!isQuickTransfer) {
      tfBtn.title = t('transfer.onlyQuickTransferSupported') || '目前只支持快速转账类型';
    }
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

  if (!tfBtn || tfBtn.dataset._bind) return;

  // Initial button state check
  updateTransferButtonState();

  // Keep hidden select `useTXCer` in sync with visible checkbox `useTXCerChk`.
  // Transfer building reads `useTXCer.value` -> BuildTXInfo.PriUseTXCer.
  const syncUseTXCer = (): void => {
    if (!useTXCer || !useTXCerChk) return;
    useTXCer.value = useTXCerChk.checked ? 'true' : 'false';
  };
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

  tfBtn.addEventListener('click', async () => {
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
    const txResultActions = document.getElementById(DOM_IDS.txResultActions);
    const viewTxInfoBtn = document.getElementById(DOM_IDS.viewTxInfoBtn);
    const viewBuildInfoBtn = document.getElementById(DOM_IDS.viewBuildInfoBtn);
    const snapActions = txResultActions ? createDOMSnapshot(txResultActions) : null;
    const snapViewTx = viewTxInfoBtn ? createDOMSnapshot(viewTxInfoBtn) : null;
    const snapViewBuild = viewBuildInfoBtn ? createDOMSnapshot(viewBuildInfoBtn) : null;

    try {
      const { walletMap, walletGasTotal } = getWalletSnapshot();

      if (txErr) {
        txErr.textContent = '';
        txErr.classList.add('hidden');
      }

      // Hide previous transaction result buttons
      if (txResultActions) txResultActions.classList.add('hidden');
      if (viewTxInfoBtn) viewTxInfoBtn.classList.add('hidden');

      const sel = Array.from(addrList!.querySelectorAll('input[type="checkbox"]'))
        .filter((x: any) => x.checked)
        .map((x: any) => x.value);

      if (sel.length === 0) {
        showTxValidationError(t('modal.pleaseLoginFirst'), null, t('tx.addressNotSelected'));
        return;
      }

      for (const addr of sel) {
        if (!getAddrMeta(addr)) {
          showTxValidationError(t('toast.cannotParseAddress'), null, t('tx.addressError'));
          return;
        }
      }

      const rows = Array.from(billList!.querySelectorAll('.recipient-card'));
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

      for (const r of rows) {
        const toEl = r.querySelector('[data-name="to"]') as HTMLInputElement | null;
        const mtEl = r.querySelector('[data-name="mt"]') as HTMLElement | null;
        const valEl = r.querySelector('[data-name="val"]') as HTMLInputElement | null;
        const gidEl = r.querySelector('[data-name="gid"]') as HTMLInputElement | null;
        const pubEl = r.querySelector('[data-name="pub"]') as HTMLInputElement | null;
        const gasEl = r.querySelector('[data-name="gas"]') as HTMLInputElement | null;

        const to = String((toEl && toEl.value) || '').trim();
        const normalizedTo = normalizeAddrInput(to);
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
        const addrValidation = validateAddress(normalizedTo);
        if (!addrValidation.valid) {
          showTxValidationError(addrValidation.error!, toEl, t('tx.addressFormatError'));
          return;
        }

        // Currency validation
        if (![0, 1, 2].includes(mt)) {
          showTxValidationError(t('transfer.currency'), null, t('tx.currencyError'));
          return;
        }

        // Amount validation using security.ts (require amount > 0)
        const amountValidation = validateTransferAmount(val, { min: 0.00000001 });
        if (!amountValidation.valid) {
          showTxValidationError(amountValidation.error!, valEl, t('tx.amountError'));
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

        // Public key validation
        if (!pubOk) {
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
        if (bills[normalizedTo]) {
          showTxValidationError(t('toast.addressExists'), null, t('tx.duplicateAddress'));
          return;
        }

        bills[normalizedTo] = {
          MoneyType: mt,
          Value: val,
          GuarGroupID: gid,
          PublicKey: { Curve: 'P256', XHex: px, YHex: py },
          ToInterest: tInt
        };
        vd[mt] += val;
        outInterest += Math.max(0, tInt || 0);
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

      if (totalGasNeed > totalGasBudget + 1e-8) {
        const msg = mintedGas > 0
          ? t('tx.insufficientGasWithMint')
          : t('tx.insufficientGasNoMint');
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
          t('toast.addressOptimized')
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

      const build: BuildTXInfo = {
        Value: valueTotal,
        ValueDivision: vd,
        Bill: bills,
        UserAddress: finalSel,
        PriUseTXCer: String(useTXCer?.value) === 'true',
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

      // Save transaction structure and show view button
      if (txResultActions) {
        txResultActions.classList.remove('hidden');
        const viewBuildInfoBtn = document.getElementById(DOM_IDS.viewBuildInfoBtn);
        if (viewBuildInfoBtn) {
          viewBuildInfoBtn.dataset.txData = JSON.stringify(build, null, 2);
        }
      }

      // ========== 直接构造交易（合并原 buildTxBtn 的功能）==========
      console.log('[构造交易] ========== 开始构造 ==========');

      const user = loadUser();
      if (!user) {
        const errMsg = '用户数据不存在，请先登录';
        console.error('[构造交易] 错误:', errMsg);
        showModalTip(t('common.notLoggedIn'), errMsg, true);
        return;
      }

      if (!user.accountId) {
        const errMsg = '账户 ID 不存在，请重新登录';
        console.error('[构造交易] 错误:', errMsg);
        showModalTip(t('common.notLoggedIn'), errMsg, true);
        return;
      }

      // 检查必要条件
      if (!user.orgNumber && !user.guarGroup?.groupID) {
        const errMsg = t('txBuilder.noGuarGroup') || '用户未加入担保组织';
        console.error('[构造交易] 错误:', errMsg);
        showModalTip(t('toast.buildTxFailed'), errMsg, true);
        return;
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
          showModalTip(t('toast.buildTxFailed'), errMsg, true);
          return;
        }
      } else if (!accountPrivKey) {
        const errMsg = t('txBuilder.noAccountPrivKey') || '账户私钥不存在';
        console.error('[构造交易] 错误:', errMsg);
        showModalTip(t('toast.buildTxFailed'), errMsg, true);
        return;
      }

      // 检查钱包数据
      const walletData = user.wallet?.addressMsg || {};
      if (Object.keys(walletData).length === 0) {
        const errMsg = t('txBuilder.noWalletData') || '钱包数据为空';
        console.error('[构造交易] 错误:', errMsg);
        showModalTip(t('toast.buildTxFailed'), errMsg, true);
        return;
      }

      // 检查发送地址
      const fromAddresses = build.UserAddress || [];
      if (fromAddresses.length === 0) {
        const errMsg = t('txBuilder.noFromAddress') || '未选择发送地址';
        console.error('[构造交易] 错误:', errMsg);
        showModalTip(t('toast.buildTxFailed'), errMsg, true);
        return;
      }

      // 检查每个发送地址是否有私钥
      for (const addr of fromAddresses) {
        const addrData = walletData[addr];
        if (!addrData) {
          const errMsg = (t('txBuilder.addressNotFound') || '地址不存在: ') + addr.slice(0, 16) + '...';
          console.error('[构造交易] 错误:', errMsg);
          showModalTip(t('toast.buildTxFailed'), errMsg, true);
          return;
        }
        if (!addrData.privHex) {
          const errMsg = (t('txBuilder.noAddressPrivKey') || '地址缺少私钥: ') + addr.slice(0, 16) + '...';
          console.error('[构造交易] 错误:', errMsg);
          showModalTip(t('toast.buildTxFailed'), errMsg, true);
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
      let userNewTX: UserNewTX;
      try {
        userNewTX = await buildTransactionFromLegacy(build, user);
        console.log('[构造交易] 交易构造成功');
        console.log('[构造交易] TXID:', userNewTX.TX.TXID);
        console.log('[构造交易] TXType:', userNewTX.TX.TXType, userNewTX.TX.TXType === 1 ? '(使用了TXCer)' : '(仅UTXO)');
      } catch (buildErr) {
        // 🔓 构造失败，解锁 TXCer
        if (lockedTXCerIds.length > 0) {
          unlockTXCers(lockedTXCerIds, false);
          console.log(`[构造交易] 构造失败，已解锁 ${lockedTXCerIds.length} 个 TXCer`);
        }
        throw buildErr;
      }

      // Save transaction data and show view button
      const txInfoBtn = document.getElementById(DOM_IDS.viewTxInfoBtn);
      if (txInfoBtn) {
        txInfoBtn.dataset.txData = serializeUserNewTX(userNewTX);
        txInfoBtn.classList.remove('hidden');
      }

      // ========== Step 2: 确认并发送交易 ==========
      // 获取担保组织信息
      const guarGroup = getJoinedGroup();
      if (!guarGroup || !guarGroup.groupID) {
        // 🔓 无担保组织，解锁 TXCer
        if (lockedTXCerIds.length > 0) {
          unlockTXCers(lockedTXCerIds, false);
        }
        const errMsg = t('txBuilder.noGuarGroup') || '用户未加入担保组织，无法发送交易';
        console.error('[发送交易] 错误:', errMsg);
        showModalTip(t('toast.sendTxFailed') || '发送失败', errMsg, true);
        return;
      }

      // 检查交易模式，只支持快速转账
      const currentTfMode = tfMode?.value || 'quick';
      if (currentTfMode !== 'quick') {
        // 🔓 不支持的模式，解锁 TXCer
        if (lockedTXCerIds.length > 0) {
          unlockTXCers(lockedTXCerIds, false);
        }
        const errMsg = t('transfer.onlyQuickTransferSupported') || '目前只支持快速转账类型的交易';
        console.error('[发送交易] 错误:', errMsg);
        showModalTip(t('toast.sendTxFailed') || '发送失败', errMsg, true);
        return;
      }

      // 计算转账总金额用于显示
      const totalAmount = Object.values(bills).reduce((sum, bill) => sum + bill.Value, 0);
      const recipientCount = Object.keys(bills).length;

      // 显示确认对话框
      const confirmMessage = t('transfer.confirmSendTxDesc', {
        amount: totalAmount.toFixed(4),
        recipients: String(recipientCount),
        txid: userNewTX.TX.TXID
      }) || `确认发送交易？\n\n交易ID: ${userNewTX.TX.TXID}\n收款方数量: ${recipientCount}\n总金额: ${totalAmount.toFixed(4)}`;

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
      console.log('[发送交易] 担保组织ID:', guarGroup.groupID);

      // 获取 AssignNode URL
      let assignNodeUrl: string | undefined;
      if (guarGroup.assignAPIEndpoint) {
        assignNodeUrl = buildAssignNodeUrl(guarGroup.assignAPIEndpoint);
        console.log('[发送交易] AssignNode URL:', assignNodeUrl);
      } else {
        console.warn('[发送交易] 警告: 担保组织缺少 assignAPIEndpoint，将使用默认 API_BASE_URL');
      }

      // 更新 loading 提示
      hideLoading(loadingId);
      const sendLoadingId = showLoading(t('transfer.sendingTx') || '正在发送交易...');

      try {
        const result = await submitTransaction(userNewTX, guarGroup.groupID, assignNodeUrl);

        // 立即隐藏 loading，不等待轮询
        hideLoading(sendLoadingId);

        if (result.success) {
          console.log('[发送交易] 交易发送成功，TXID:', result.tx_id);

          // 🔒 发送成功：
          // - 未使用的 TXCer 立即解锁（可再次选择）
          // - 已使用的 TXCer 进入“已提交交易长锁”，直到明确成功/失败才解锁/处理
          if (lockedTXCerIds.length > 0) {
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

          const txIdToQuery = result.tx_id || userNewTX.TX.TXID;

          // 🔒 锁定使用到的 UTXO
          try {
            const utxosToLock: Omit<LockedUTXO, 'lockTime' | 'txId'>[] = [];
            const txInputs = userNewTX.TX.TXInputsNormal || [];

            for (const input of txInputs) {
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

          // 显示成功提示，告知用户交易已提交
          showToast(
            t('transfer.txSubmittedWaitingConfirm') || '交易已提交，正在后台等待确认...',
            'success',
            t('toast.sendTxSuccess') || '交易发送成功'
          );

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
          console.log('[发送交易] 开始后台轮询交易状态:', txIdToQuery);

          // 使用 setTimeout 0 确保 UI 先更新
          setTimeout(() => {
            pollTXStatusInBackground(txIdToQuery, guarGroup.groupID, assignNodeUrl);
          }, 0);

        } else {
          const errMsg = result.error || t('transfer.unknownError') || '未知错误';
          const errorCode = (result as any).errorCode;
          console.error('[发送交易] 发送失败:', errMsg, 'errorCode:', errorCode);

          // Provide more helpful error messages based on error code
          let userFriendlyMsg = errMsg;
          let title = t('toast.sendTxFailed') || '交易发送失败';

          if (errorCode === 'USER_NOT_IN_ORG') {
            // User not in organization - this is a critical state mismatch
            title = t('error.userNotInGroup') || '用户不在担保组织内';
            userFriendlyMsg = t('transfer.userNotInOrgHint') ||
              '您的账户未在后端担保组织中注册。这可能是因为：\n' +
              '1. 您导入的地址已属于其他组织\n' +
              '2. 加入组织时发生了错误\n\n' +
              '请尝试：退出当前组织，然后重新加入正确的组织。';
          } else if (errorCode === 'ADDRESS_REVOKED') {
            userFriendlyMsg = t('error.addressAlreadyRevoked') || '使用的地址已被解绑，请选择其他地址';
          } else if (errorCode === 'SIGNATURE_FAILED') {
            userFriendlyMsg = t('error.signatureVerificationFailed') || '签名验证失败，请检查私钥是否正确';
          } else if (errorCode === 'UTXO_SPENT') {
            userFriendlyMsg = t('transfer.utxoAlreadySpent') || 'UTXO 已被使用，请刷新页面后重试';
          }

          // 🔓 发送失败，解锁 TXCer（不删除）
          if (lockedTXCerIds.length > 0) {
            unlockTXCers(lockedTXCerIds, false);
            console.log(`[发送交易] 发送失败，已解锁 ${lockedTXCerIds.length} 个 TXCer`);
          }

          showModalTip(title, userFriendlyMsg, true);
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
        showModalTip(
          t('toast.sendTxFailed') || '交易发送失败',
          t('transfer.networkError') || '网络错误，请检查网络连接后重试：' + errMsg,
          true
        );
      }
    } catch (err: any) {
      // Restore stable UI state and storage snapshot
      try { if (snapTxErr) restoreFromSnapshot(snapTxErr); } catch (_) { }
      try { if (snapActions) restoreFromSnapshot(snapActions); } catch (_) { }
      try { if (snapViewTx) restoreFromSnapshot(snapViewTx); } catch (_) { }
      try { if (snapViewBuild) restoreFromSnapshot(snapViewBuild); } catch (_) { }
      try { restoreCheckpoint(checkpointId); } catch (_) { }

      const msg = err?.message || String(err);
      showModalTip(t('toast.buildTxFailed') || '操作失败', msg, true);
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
  });

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
  assignNodeUrl?: string
): Promise<void> {
  console.log('[后台轮询] 开始轮询交易状态:', txID);

  try {
    const confirmResult = await waitForTXConfirmation(
      txID,
      groupID,
      assignNodeUrl,
      {
        pollInterval: 2000,   // 每 2 秒轮询一次
        maxWaitTime: 60000,   // 最多等待 60 秒
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
      // 交易确认成功 - 显示成功 toast
      console.log('[后台轮询] 交易确认成功:', txID);
      showToast(
        t('transfer.txConfirmedSuccessShort', { txid: txID.slice(0, 8) + '...' }) ||
        `交易 ${txID.slice(0, 8)}... 已确认成功！`,
        'success',
        t('transfer.txConfirmedSuccess') || '交易确认成功',
        5000  // 显示 5 秒
      );

      // ✅ 确认成功：允许 TXCer 状态更新（并处理缓存），让已使用的 TXCer 正常消失/变更
      try {
        const lockedTxCers = getLockedTXCerIdsByTxId(txID);
        if (lockedTxCers.length > 0) {
          unlockTXCers(lockedTxCers, true);
          console.log('[后台轮询] 已解锁并处理 TXCer 更新, txID=', txID, 'count=', lockedTxCers.length);
        }
      } catch (e) {
        console.warn('[后台轮询] 处理 TXCer 解锁失败:', e);
      }

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
      console.log('[后台轮询] 交易验证失败:', txID, errorReason);

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
        t('transfer.txVerificationFailedShort', { reason: errorReason }) ||
        `交易验证失败: ${errorReason}`,
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
