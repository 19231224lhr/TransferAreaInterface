/**
 * Transfer Transaction Builder Module
 * 
 * Handles transaction building and validation
 */

import { t } from '../i18n/index.js';
import { loadUser, User } from '../utils/storage';
import { readAddressInterest } from '../utils/helpers.js';
import { showModalTip, showConfirmModal } from '../ui/modal';
import { html as viewHtml } from '../utils/view';
import { buildNewTX, BuildTXInfo } from './transaction';
import { validateAddress, validateTransferAmount, validateOrgId, createSubmissionGuard } from '../utils/security';
import { createCheckpoint, restoreCheckpoint, createDOMSnapshot, restoreFromSnapshot } from '../utils/transaction';
import { clearTransferDraft } from './transferDraft';
import { getCoinName, COIN_TO_PGC_RATES, CoinTypeId } from '../config/constants';
import { showLoading, hideLoading } from '../utils/loading';
import { DOM_IDS } from '../config/domIds';

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

/** Wallet snapshot */
interface WalletSnapshot {
  walletMap: Record<string, any>;
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
 * Get wallet snapshot
 */
function getWalletSnapshot(): WalletSnapshot {
  const u0 = loadUser();
  let walletMap = (u0 && u0.wallet && u0.wallet.addressMsg) || {};
  const getWalletGasSum = (map: Record<string, any>): number => Object.keys(map).reduce((sum, addr) => {
    const meta = map[addr];
    return sum + readAddressInterest(meta);
  }, 0);
  const walletGasTotal = getWalletGasSum(walletMap);
  
  return { walletMap, walletGasTotal };
}

/**
 * Get address metadata
 */
function getAddrMeta(addr: string): any {
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
 * Initialize transfer form submission
 */
export function initTransferSubmit(): void {
  const tfBtn = document.getElementById(DOM_IDS.tfSendBtn) as HTMLButtonElement | null;
  const addrList = document.getElementById(DOM_IDS.srcAddrList);
  const billList = document.getElementById(DOM_IDS.billList);
  const tfMode = document.getElementById(DOM_IDS.tfMode) as HTMLSelectElement | null;
  const isPledge = document.getElementById(DOM_IDS.isPledge) as HTMLSelectElement | null;
  const useTXCer = document.getElementById(DOM_IDS.useTXCer) as HTMLSelectElement | null;
  const chPGC = document.getElementById(DOM_IDS.chAddrPGC) as HTMLSelectElement | null;
  const chBTC = document.getElementById(DOM_IDS.chAddrBTC) as HTMLSelectElement | null;
  const chETH = document.getElementById(DOM_IDS.chAddrETH) as HTMLSelectElement | null;
  const gasInput = document.getElementById(DOM_IDS.extraGasPGC) as HTMLInputElement | null;
  const txGasInput = document.getElementById(DOM_IDS.txGasInput) as HTMLInputElement | null;
  const txErr = document.getElementById(DOM_IDS.txError);
  
  if (!tfBtn || (tfBtn as any).dataset._bind) return;
  
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
    const buildTxBtn = document.getElementById(DOM_IDS.buildTxBtn);
    const snapActions = txResultActions ? createDOMSnapshot(txResultActions) : null;
    const snapViewTx = viewTxInfoBtn ? createDOMSnapshot(viewTxInfoBtn) : null;
    const snapViewBuild = viewBuildInfoBtn ? createDOMSnapshot(viewBuildInfoBtn) : null;
    const snapBuildBtn = buildTxBtn ? createDOMSnapshot(buildTxBtn as any) : null;

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
      const availableGas = walletGasTotal;
      
      sel.forEach((addr) => {
        const meta = getAddrMeta(addr) || {};
        const type = Number(meta.type || 0);
        const val = Number(meta.value && (meta.value.totalValue || meta.value.TotalValue) || 0);
        if (typeBalances[type] !== undefined) {
          typeBalances[type] += val;
        }
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
          const meta = getAddrMeta(addr) || {};
          const type = Number(meta.type || 0);
          const val = Number(meta.value && (meta.value.totalValue || meta.value.TotalValue) || 0);
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
        const raw = t('transfer.optimizedAddresses', { count: String(removedAddrs.length) });
        const marker = '__COUNT__MARKER__';
        const withMarker = raw.replace('{count}', marker);
        const parts = withMarker.split(marker);
        const tipContent = parts.length === 2
          ? viewHtml`${parts[0]}<strong>${removedAddrs.length}</strong>${parts[1]}`
          : viewHtml`${raw} <strong>${removedAddrs.length}</strong>`;
        showModalTip(t('toast.addressOptimized'), tipContent, false);
      }
      
      if (extraPGC > 0) {
        const raw = t('transfer.exchangeGasDesc', { amount: String(extraPGC) });
        const marker = '__AMOUNT__MARKER__';
        const withMarker = raw.replace(/\{amount\}/g, marker);
        const parts = withMarker.split(marker);
        const exchangeDesc = parts.length === 2
          ? viewHtml`${parts[0]}<strong>${extraPGC}</strong>${parts[1]}`
          : viewHtml`${raw} <strong>${extraPGC}</strong>`;
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
          (viewBuildInfoBtn as any).dataset.txData = JSON.stringify(build, null, 2);
        }
      }

      // Show "Build Transaction" button and save BuildTXInfo
      if (buildTxBtn) {
        buildTxBtn.classList.remove('hidden');
        (buildTxBtn as any).dataset.buildInfo = JSON.stringify(build);
      }
    } catch (err: any) {
      // Restore stable UI state and storage snapshot
      try { if (snapTxErr) restoreFromSnapshot(snapTxErr); } catch (_) { }
      try { if (snapActions) restoreFromSnapshot(snapActions); } catch (_) { }
      try { if (snapViewTx) restoreFromSnapshot(snapViewTx); } catch (_) { }
      try { if (snapViewBuild) restoreFromSnapshot(snapViewBuild); } catch (_) { }
      try { if (snapBuildBtn) restoreFromSnapshot(snapBuildBtn); } catch (_) { }
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
  
  (tfBtn as any).dataset._bind = '1';
}

/**
 * Initialize build transaction button
 */
export function initBuildTransaction(): void {
  const buildTxBtn = document.getElementById(DOM_IDS.buildTxBtn) as HTMLButtonElement | null;
  if (!buildTxBtn || (buildTxBtn as any).dataset._buildBind) return;
  
  buildTxBtn.addEventListener('click', async () => {
    const checkpointId = `transfer-build-${Date.now()}`;
    createCheckpoint(checkpointId, ['auto-save-transfer-v1', 'form-draft-transfer-v1']);
    const txResultActions = document.getElementById(DOM_IDS.txResultActions);
    const viewTxInfoBtn = document.getElementById(DOM_IDS.viewTxInfoBtn);
    const snapActions = txResultActions ? createDOMSnapshot(txResultActions) : null;
    const snapViewTx = viewTxInfoBtn ? createDOMSnapshot(viewTxInfoBtn) : null;
    const loadingId = showLoading(t('toast.buildingTx'));

    try {
      const buildInfoStr = (buildTxBtn as any).dataset.buildInfo || '{}';
      const buildInfo: BuildTXInfo = JSON.parse(buildInfoStr);
      const user = loadUser();

      if (!user || !user.accountId) {
        showModalTip(t('common.notLoggedIn'), t('modal.pleaseLoginFirst'), true);
        return;
      }

      // Call buildNewTX to construct transaction
      const transaction = await buildNewTX(buildInfo, user);

      // Save transaction data and show view button
      const viewTxInfoBtn = document.getElementById(DOM_IDS.viewTxInfoBtn);
      if (viewTxInfoBtn) {
        (viewTxInfoBtn as any).dataset.txData = JSON.stringify(transaction, null, 2);
        viewTxInfoBtn.classList.remove('hidden');
      }

      showModalTip(t('toast.buildTxSuccess'), t('toast.buildTxSuccessDesc'), false);

      // On successful build, clear drafts to reduce confusion and stale restores.
      clearTransferDraft();
    } catch (err: any) {
      const errMsg = err.message || String(err);
      try { if (snapActions) restoreFromSnapshot(snapActions); } catch (_) { }
      try { if (snapViewTx) restoreFromSnapshot(snapViewTx); } catch (_) { }
      try { restoreCheckpoint(checkpointId); } catch (_) { }
      showModalTip(t('toast.buildTxFailed'), errMsg, true);
    } finally {
      hideLoading(loadingId);
    }
  });
  
  (buildTxBtn as any).dataset._buildBind = '1';
}
