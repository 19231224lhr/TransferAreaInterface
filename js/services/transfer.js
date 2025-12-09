/**
 * Transfer Transaction Builder Module
 * 
 * Handles transaction building and validation (copied from backup)
 */

import { t } from '../i18n/index.js';
import { loadUser } from '../utils/storage.js';
import { readAddressInterest } from '../utils/helpers.js';
import { showModalTip, showConfirmModal } from '../ui/modal.js';
import { buildNewTX } from './transaction.js';

/**
 * Normalize address input
 */
function normalizeAddrInput(addr) {
  return addr ? String(addr).trim().toLowerCase() : '';
}

/**
 * Validate address format
 */
function isValidAddressFormat(addr) {
  return /^[0-9a-f]{40}$/.test(addr);
}

/**
 * Show transaction validation error
 */
function showTxValidationError(msg, focusEl, title = '参数校验失败') {
  const txErr = document.getElementById('txError');
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
function getWalletSnapshot() {
  const u0 = loadUser();
  let walletMap = (u0 && u0.wallet && u0.wallet.addressMsg) || {};
  const getWalletGasSum = (map) => Object.keys(map).reduce((sum, addr) => {
    const meta = map[addr];
    return sum + readAddressInterest(meta);
  }, 0);
  const walletGasTotal = getWalletGasSum(walletMap);
  
  return { walletMap, walletGasTotal };
}

/**
 * Get address metadata
 */
function getAddrMeta(addr) {
  const { walletMap } = getWalletSnapshot();
  return walletMap[addr] || null;
}

/**
 * Initialize transfer form submission
 */
export function initTransferSubmit() {
  const tfBtn = document.getElementById('tfSendBtn');
  const addrList = document.getElementById('srcAddrList');
  const billList = document.getElementById('billList');
  const tfMode = document.getElementById('tfMode');
  const isPledge = document.getElementById('isPledge');
  const useTXCer = document.getElementById('useTXCer');
  const chPGC = document.getElementById('chAddrPGC');
  const chBTC = document.getElementById('chAddrBTC');
  const chETH = document.getElementById('chAddrETH');
  const gasInput = document.getElementById('extraGasPGC');
  const txGasInput = document.getElementById('txGasInput');
  const txErr = document.getElementById('txError');
  
  if (!tfBtn || tfBtn.dataset._bind) return;
  
  const currencyLabels = { 0: 'PGC', 1: 'BTC', 2: 'ETH' };
  const rates = { 0: 1, 1: 1000000, 2: 1000 };
  
  const parsePub = (raw) => {
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
  };
  
  tfBtn.addEventListener('click', async () => {
    const { walletMap, walletGasTotal } = getWalletSnapshot();
    
    if (txErr) {
      txErr.textContent = '';
      txErr.classList.add('hidden');
    }
    
    // Hide previous transaction result buttons
    const txResultActions = document.getElementById('txResultActions');
    const viewTxInfoBtn = document.getElementById('viewTxInfoBtn');
    if (txResultActions) txResultActions.classList.add('hidden');
    if (viewTxInfoBtn) viewTxInfoBtn.classList.add('hidden');
    
    const sel = Array.from(addrList.querySelectorAll('input[type="checkbox"]'))
      .filter(x => x.checked)
      .map(x => x.value);
    
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
    
    const rows = Array.from(billList.querySelectorAll('.recipient-card'));
    if (rows.length === 0) {
      showTxValidationError(t('wallet.addRecipient'), null, t('tx.missingTransferInfo'));
      return;
    }
    
    const isCross = tfMode.value === 'cross';
    if (isCross && rows.length !== 1) {
      showTxValidationError(t('wallet.crossChain'), null, t('tx.crossChainLimit'));
      return;
    }
    
    const changeMap = {};
    if (chPGC.value) changeMap[0] = chPGC.value;
    if (chBTC.value) changeMap[1] = chBTC.value;
    if (chETH.value) changeMap[2] = chETH.value;
    
    const bills = {};
    const vd = { 0: 0, 1: 0, 2: 0 };
    let outInterest = 0;
    
    for (const r of rows) {
      const toEl = r.querySelector('[data-name="to"]');
      const mtEl = r.querySelector('[data-name="mt"]');
      const valEl = r.querySelector('[data-name="val"]');
      const gidEl = r.querySelector('[data-name="gid"]');
      const pubEl = r.querySelector('[data-name="pub"]');
      const gasEl = r.querySelector('[data-name="gas"]');
      
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
      
      if (!to) {
        showTxValidationError(t('modal.inputIncomplete'), toEl, t('tx.addressEmpty'));
        return;
      }
      if (!isValidAddressFormat(normalizedTo)) {
        showTxValidationError(t('toast.cannotParseAddress'), toEl, t('tx.addressFormatError'));
        return;
      }
      if (![0, 1, 2].includes(mt)) {
        showTxValidationError(t('transfer.currency'), null, t('tx.currencyError'));
        return;
      }
      if (!Number.isFinite(val)) {
        showTxValidationError(t('transfer.amount'), valEl, t('tx.amountError'));
        return;
      }
      if (val === 0) {
        showTxValidationError(t('transfer.amount'), valEl, t('tx.amountCannotBeZero'));
        return;
      }
      if (val < 0) {
        showTxValidationError(t('transfer.amount'), valEl, t('tx.amountCannotBeNegative'));
        return;
      }
      if (gid && !/^\d{8}$/.test(gid)) {
        showTxValidationError(t('transfer.guarantorOrgId'), gidEl, t('tx.orgIdFormatError'));
        return;
      }
      if (!pubOk) {
        showTxValidationError(t('transfer.publicKey'), pubEl, t('tx.publicKeyFormatError'));
        return;
      }
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
    
    const extraPGC = Number(gasInput.value || 0);
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
    
    const typeBalances = { 0: 0, 1: 0, 2: 0 };
    const availableGas = walletGasTotal;
    
    sel.forEach((addr) => {
      const meta = getAddrMeta(addr) || {};
      const type = Number(meta.type || 0);
      const val = Number(meta.value && (meta.value.totalValue || meta.value.TotalValue) || 0);
      if (typeBalances[type] !== undefined) {
        typeBalances[type] += val;
      }
    });
    
    const ensureChangeAddrValid = (typeId) => {
      const need = vd[typeId] || 0;
      if (need <= 0) return true;
      const addr = changeMap[typeId];
      if (!addr) {
        showTxValidationError(`${currencyLabels[typeId]} ${t('transfer.pgcReceiveAddress')}`, null, t('tx.changeAddressMissing'));
        return false;
      }
      const meta = getAddrMeta(addr);
      if (!meta) {
        showTxValidationError(t('transfer.noAddressAvailable'), null, t('tx.changeAddressError'));
        return false;
      }
      if (Number(meta.type || 0) !== Number(typeId)) {
        showTxValidationError(`${currencyLabels[typeId]} ${t('transfer.currency')}`, null, t('tx.changeAddressError'));
        return false;
      }
      return true;
    };
    
    if (![0, 1, 2].every((t) => (typeBalances[t] || 0) + 1e-8 >= (vd[t] || 0))) {
      const lackType = [0, 1, 2].find((t) => (typeBalances[t] || 0) + 1e-8 < (vd[t] || 0)) ?? 0;
      showTxValidationError(`${currencyLabels[lackType]} ${t('tx.insufficientBalance')}`, null, t('tx.insufficientBalance'));
      return;
    }
    
    if (![0, 1, 2].every((t) => ensureChangeAddrValid(t))) return;
    
    const mintedGas = interestGas;
    const totalGasNeed = baseTxGas + outInterest;
    const totalGasBudget = availableGas + mintedGas;
    
    if (totalGasNeed > totalGasBudget + 1e-8) {
      const msg = mintedGas > 0
        ? 'Gas 不足：即使兑换额外 Gas，交易Gas 与转移Gas 仍超出钱包可用 Gas'
        : 'Gas 不足：交易Gas 与转移Gas 超出钱包可用 Gas';
      showTxValidationError(msg);
      return;
    }
    
    const usedTypes = [0, 1, 2].filter((t) => (vd[t] || 0) > 0);
    let finalSel = sel.slice();
    let removedAddrs = [];
    
    if (usedTypes.length) {
      const infos = sel.map((addr) => {
        const meta = getAddrMeta(addr) || {};
        const type = Number(meta.type || 0);
        const val = Number(meta.value && (meta.value.totalValue || meta.value.TotalValue) || 0);
        const bal = { 0: 0, 1: 0, 2: 0 };
        if (bal[type] !== undefined) bal[type] = val;

        const totalRel = usedTypes.reduce((s, t) => s + bal[t] * rates[t], 0);
        return { addr, bal, totalRel };
      });
      
      const candidates = infos.filter((info) => usedTypes.some((t) => info.bal[t] > 0));
      if (candidates.length) {
        candidates.sort((a, b) => b.totalRel - a.totalRel);
        const remain = {};
        usedTypes.forEach((t) => { remain[t] = vd[t] || 0; });
        const chosen = [];
        
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
            Array.from(addrList.querySelectorAll('input[type="checkbox"]')).forEach((inp) => {
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
      const tipHtml = `检测到本次转账中有 <strong>${removedAddrs.length}</strong> 个来源地址在本次转账中未被实际使用，已自动为你保留余额更高且能够覆盖本次转账的地址集合。`;
      showModalTip(t('toast.addressOptimized'), tipHtml, false);
    }
    
    if (extraPGC > 0) {
      const confirmed = await showConfirmModal('确认兑换 Gas', `将使用 <strong>${extraPGC}</strong> PGC 兑换 <strong>${extraPGC}</strong> Gas，用于本次交易。确认继续？`, '确认兑换', '取消');
      if (!confirmed) return;
    }
    
    const backAssign = {};
    finalSel.forEach((a, i) => { backAssign[a] = i === 0 ? 1 : 0; });
    
    const valueTotal = Object.keys(vd).reduce((s, k) => s + vd[k] * rates[k], 0);
    
    const build = {
      Value: valueTotal,
      ValueDivision: vd,
      Bill: bills,
      UserAddress: finalSel,
      PriUseTXCer: String(useTXCer.value) === 'true',
      ChangeAddress: changeMap,
      IsPledgeTX: String(isPledge.value) === 'true',
      HowMuchPayForGas: extraPGC,
      IsCrossChainTX: isCross,
      Data: '',
      InterestAssign: { Gas: baseTxGas, Output: outInterest, BackAssign: backAssign }
    };
    
    if (isCross && finalSel.length !== 1) {
      showTxValidationError('跨链交易只能有一个来源地址', null, '跨链交易限制');
      return;
    }
    if (isCross && !changeMap[0]) {
      showTxValidationError('请为跨链交易选择主货币找零地址', null, '找零地址缺失');
      return;
    }
    
    // Save transaction structure and show view button
    if (txResultActions) {
      txResultActions.classList.remove('hidden');
      const viewBuildInfoBtn = document.getElementById('viewBuildInfoBtn');
      if (viewBuildInfoBtn) {
        viewBuildInfoBtn.dataset.txData = JSON.stringify(build, null, 2);
      }
    }

    // Show "Build Transaction" button and save BuildTXInfo
    const buildTxBtn = document.getElementById('buildTxBtn');
    if (buildTxBtn) {
      buildTxBtn.classList.remove('hidden');
      buildTxBtn.dataset.buildInfo = JSON.stringify(build);
    }
  });
  
  tfBtn.dataset._bind = '1';
}

/**
 * Initialize build transaction button
 */
export function initBuildTransaction() {
  const buildTxBtn = document.getElementById('buildTxBtn');
  if (!buildTxBtn || buildTxBtn.dataset._buildBind) return;
  
  buildTxBtn.addEventListener('click', async () => {
    try {
      showModalTip(t('transfer.generateTxStruct'), t('toast.buildingTx'), false);

      const buildInfoStr = buildTxBtn.dataset.buildInfo || '{}';
      const buildInfo = JSON.parse(buildInfoStr);
      const user = loadUser();

      if (!user || !user.accountId) {
        showModalTip(t('common.notLoggedIn'), t('modal.pleaseLoginFirst'), true);
        return;
      }

      // Call buildNewTX to construct transaction
      const transaction = await buildNewTX(buildInfo, user);

      // Save transaction data and show view button
      const viewTxInfoBtn = document.getElementById('viewTxInfoBtn');
      if (viewTxInfoBtn) {
        viewTxInfoBtn.dataset.txData = JSON.stringify(transaction, null, 2);
        viewTxInfoBtn.classList.remove('hidden');
      }

      showModalTip(t('toast.buildTxSuccess'), t('toast.buildTxSuccessDesc'), false);
    } catch (err) {
      const errMsg = err.message || String(err);
      showModalTip(t('toast.buildTxFailed'), errMsg, true);
    }
  });
  
  buildTxBtn.dataset._buildBind = '1';
}
