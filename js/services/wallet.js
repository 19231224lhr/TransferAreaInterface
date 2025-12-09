/**
 * Wallet Service Module
 * 
 * Provides wallet management functions including rendering, balance updates, and organization panel.
 */

import { t } from '../i18n/index.js';
import { loadUser, saveUser, getJoinedGroup, toAccount } from '../utils/storage.js';
import { readAddressInterest, BASE_LIFT, toPt } from '../utils/helpers.js';
import { getActionModalElements } from '../ui/modal.js';
import { updateWalletChart } from '../ui/charts.js';
import { showMiniToast, showErrorToast, showSuccessToast } from '../utils/toast.js';
import { importFromPrivHex } from './account.js';
import { initRecipientCards, initAdvancedOptions } from './recipient.js';

/**
 * Update wallet brief display (count and list)
 */
export function updateWalletBrief() {
  const u = loadUser();
  const countEl = document.getElementById('walletCount');
  const brief = document.getElementById('walletBriefList');
  const tip = document.getElementById('walletEmptyTip');
  const addrs = u && u.wallet ? Object.keys(u.wallet.addressMsg || {}) : [];
  
  if (countEl) {
    countEl.textContent = addrs.length;
  }
  
  if (brief) {
    if (addrs.length === 0) {
      brief.innerHTML = '';
      if (tip) tip.classList.remove('hidden');
    } else {
      if (tip) tip.classList.add('hidden');
      brief.innerHTML = addrs.slice(0, 3).map(addr => {
        const meta = u.wallet.addressMsg[addr] || {};
        const typeId = Number(meta.type || 0);
        const coinType = typeId === 1 ? 'BTC' : (typeId === 2 ? 'ETH' : 'PGC');
        const shortAddr = addr.length > 12 ? addr.slice(0, 6) + '...' + addr.slice(-4) : addr;
        return `<div class="wallet-brief-item"><span class="wallet-brief-addr">${shortAddr}</span><span class="wallet-brief-coin">${coinType}</span></div>`;
      }).join('');
    }
  }
}

/**
 * Refresh organization panel display
 */
export function refreshOrgPanel() {
  const woCard = document.getElementById('woCard');
  const woEmpty = document.getElementById('woEmpty');
  const woExit = document.getElementById('woExitBtn');
  const joinBtn = document.getElementById('woJoinBtn');
  const g = getJoinedGroup();
  const joined = !!(g && g.groupID);
  
  if (woCard) woCard.classList.toggle('hidden', !joined);
  if (woExit) woExit.classList.toggle('hidden', !joined);
  if (woEmpty) woEmpty.classList.toggle('hidden', joined);
  if (joinBtn) joinBtn.classList.toggle('hidden', joined);
  
  const tfMode = document.getElementById('tfMode');
  const tfModeQuick = document.getElementById('tfModeQuick');
  const tfModeCross = document.getElementById('tfModeCross');
  const tfModePledge = document.getElementById('tfModePledge');
  const isPledgeSel = document.getElementById('isPledge');
  const hasOrg = joined;
  
  // Update transfer mode tabs UI
  const modeTabsContainer = document.getElementById('transferModeTabs');
  
  if (modeTabsContainer) {
    if (hasOrg) {
      modeTabsContainer.classList.remove('no-org-mode');
    } else {
      modeTabsContainer.classList.add('no-org-mode');
    }
  }
  
  if (tfModeQuick && tfModeQuick.parentNode) {
    const quickLabel = tfModeQuick.parentNode;
    const span = quickLabel.querySelector('.segment-content');
    if (span) {
      span.textContent = hasOrg ? t('wallet.quickTransfer') : t('wallet.normalTransfer');
    } else {
      const last = quickLabel.lastChild;
      if (last && last.nodeType === 3) {
        last.textContent = hasOrg ? ` ${t('wallet.quickTransfer')}` : ` ${t('wallet.normalTransfer')}`;
      }
    }
  }
  
  if (tfMode && tfModeQuick) {
    if (!hasOrg) {
      if (tfModeCross) {
        tfModeCross.checked = false;
        tfModeCross.disabled = true;
        const l = tfModeCross.parentNode;
        if (l && l.style) l.style.display = 'none';
      }
      if (tfModePledge) {
        tfModePledge.checked = false;
        tfModePledge.disabled = true;
        const l2 = tfModePledge.parentNode;
        if (l2 && l2.style) l2.style.display = 'none';
      }
      tfMode.value = 'quick';
      tfModeQuick.checked = true;
      if (isPledgeSel) isPledgeSel.value = 'false';
    } else {
      if (tfModeCross) {
        tfModeCross.disabled = false;
        const l = tfModeCross.parentNode;
        if (l && l.style) l.style.display = '';
      }
      if (tfModePledge) {
        tfModePledge.disabled = false;
        const l2 = tfModePledge.parentNode;
        if (l2 && l2.style) l2.style.display = '';
      }
      if (!tfMode.value) tfMode.value = 'quick';
      if (tfMode.value === 'cross' && (!tfModeCross || tfModeCross.disabled)) tfMode.value = 'quick';
      if (tfMode.value === 'pledge' && (!tfModePledge || tfModePledge.disabled)) tfMode.value = 'quick';
      if (tfMode.value === 'quick') tfModeQuick.checked = true;
      if (isPledgeSel) isPledgeSel.value = tfMode.value === 'pledge' ? 'true' : 'false';
    }
    
    // Update organization info display
    [
      ['woGroupID', joined ? g.groupID : ''],
      ['woAggre', joined ? (g.aggreNode || '') : ''],
      ['woAssign', joined ? (g.assignNode || '') : ''],
      ['woPledge', joined ? (g.pledgeAddress || '') : '']
    ].forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    });
  }
}

/**
 * Render wallet address list
 */
export function renderWallet() {
  const u = loadUser();
  const aid = document.getElementById('walletAccountId');
  const org = document.getElementById('walletOrg');
  const addr = document.getElementById('walletMainAddr');
  const priv = document.getElementById('walletPrivHex');
  const px = document.getElementById('walletPubX');
  const py = document.getElementById('walletPubY');
  
  if (!u) return;
  
  if (aid) aid.textContent = u.accountId || '';
  if (org) org.textContent = u.orgNumber || t('header.noOrg');
  if (addr) addr.textContent = u.address || '';
  if (priv) priv.textContent = u.privHex || '';
  if (px) px.textContent = u.pubXHex || '';
  if (py) py.textContent = u.pubYHex || '';
  
  const list = document.getElementById('walletAddrList');
  if (!list) return;
  
  const addresses = Object.keys((u.wallet && u.wallet.addressMsg) || {});
  list.innerHTML = '';
  
  addresses.forEach((a) => {
    const item = document.createElement('div');
    item.className = 'addr-card';
    const meta = (u.wallet && u.wallet.addressMsg && u.wallet.addressMsg[a]) || null;
    
    const typeId0 = Number(meta && meta.type !== undefined ? meta.type : 0);
    const amtCash0 = Number((meta && meta.value && meta.value.utxoValue) || 0);
    const gas0 = readAddressInterest(meta);
    const coinType = typeId0 === 1 ? 'BTC' : (typeId0 === 2 ? 'ETH' : 'PGC');
    const coinClass = typeId0 === 1 ? 'btc' : (typeId0 === 2 ? 'eth' : 'pgc');
    const shortAddr = a.length > 18 ? a.slice(0, 10) + '...' + a.slice(-6) : a;

    item.innerHTML = `
      <div class="addr-card-summary">
        <div class="addr-card-avatar coin--${coinClass}">${coinType}</div>
        <div class="addr-card-main">
          <span class="addr-card-hash" title="${a}">${shortAddr}</span>
          <span class="addr-card-balance">${amtCash0} ${coinType}</span>
        </div>
        <div class="addr-card-arrow">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
      </div>
      <div class="addr-card-detail">
        <div class="addr-card-detail-inner">
          <div class="addr-detail-row">
            <span class="addr-detail-label">${t('address.fullAddress')}</span>
            <span class="addr-detail-value">${a}</span>
          </div>
          <div class="addr-detail-row">
            <span class="addr-detail-label">${t('address.balance')}</span>
            <span class="addr-detail-value">${amtCash0} ${coinType}</span>
          </div>
          <div class="addr-detail-row">
            <span class="addr-detail-label">GAS</span>
            <span class="addr-detail-value gas">${gas0}</span>
          </div>
          <div class="addr-card-actions">
            <button class="addr-action-btn addr-action-btn--primary btn-add" data-addr="${a}" title="${t('address.add')}">
              <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              ${t('address.add')}
            </button>
            <button class="addr-action-btn addr-action-btn--secondary btn-zero" data-addr="${a}" title="${t('address.clear')}">
              <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              ${t('address.clear')}
            </button>
            <div class="addr-ops-container"></div>
          </div>
        </div>
      </div>
    `;
    
    // Add click to expand/collapse
    const summaryEl = item.querySelector('.addr-card-summary');
    if (summaryEl) {
      summaryEl.addEventListener('click', (e) => {
        e.stopPropagation();
        item.classList.toggle('expanded');
      });
    }
    
    list.appendChild(item);
    
    // Add operations menu
    const metaEl = item.querySelector('.addr-ops-container');
    if (metaEl) {
      addAddressOperationsMenu(metaEl, a, item);
    }
  });
  
  // Update wallet chart after rendering
  if (typeof window.updateWalletChart === 'function') {
    window.updateWalletChart(u);
  }
}

/**
 * Add operations menu to address card
 * @param {HTMLElement} container - Container element
 * @param {string} address - Address string
 * @param {HTMLElement} cardItem - Card item element
 */
function addAddressOperationsMenu(container, address, cardItem) {
  const ops = document.createElement('div');
  ops.className = 'addr-ops';
  
  const toggle = document.createElement('button');
  toggle.className = 'ops-toggle';
  toggle.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>';
  
  const menu = document.createElement('div');
  menu.className = 'ops-menu hidden';
  
  const delBtn = document.createElement('button');
  delBtn.className = 'ops-item danger';
  delBtn.textContent = t('wallet.deleteAddress');
  
  const expBtn = document.createElement('button');
  expBtn.className = 'ops-item';
  expBtn.textContent = t('wallet.exportPrivateKey');
  
  menu.appendChild(expBtn);
  menu.appendChild(delBtn);
  ops.appendChild(toggle);
  ops.appendChild(menu);
  container.appendChild(ops);
  
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('hidden');
  });
  
  document.addEventListener('click', () => {
    menu.classList.add('hidden');
  });
  
  // Delete handler
  delBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleDeleteAddress(address, menu);
  });
  
  // Export handler
  expBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleExportPrivateKey(address, menu);
  });
}

/**
 * Handle address deletion
 * @param {string} address - Address to delete
 * @param {HTMLElement} menu - Menu element to hide
 */
function handleDeleteAddress(address, menu) {
  const modal = document.getElementById('confirmDelModal');
  const okBtn = document.getElementById('confirmDelOk');
  const cancelBtn = document.getElementById('confirmDelCancel');
  const textEl = document.getElementById('confirmDelText');
  
  if (textEl) textEl.textContent = `${t('address.confirmDelete')} ${address} ${t('address.confirmDeleteDesc')}`;
  if (modal) modal.classList.remove('hidden');
  
  const doDel = () => {
    if (modal) modal.classList.add('hidden');
    const u = loadUser();
    if (!u) return;
    
    const key = String(address).toLowerCase();
    const isMain = (u.address && u.address.toLowerCase() === key);
    
    if (u.wallet && u.wallet.addressMsg) {
      u.wallet.addressMsg = Object.fromEntries(
        Object.entries(u.wallet.addressMsg).filter(([k]) => String(k).toLowerCase() !== key)
      );
    }
    
    if (isMain) {
      u.address = '';
    }
    
    saveUser(u);
    
    // Refresh UI
    if (window.__refreshSrcAddrList) {
      try { window.__refreshSrcAddrList(); } catch (_) { }
    }
    
    renderWallet();
    updateWalletBrief();
    
    // Show success modal
    const { modal: am, titleEl: at, textEl: ax, okEl: ok1 } = getActionModalElements();
    if (at) at.textContent = t('wallet.deleteSuccess');
    if (ax) { ax.classList.remove('tip--error'); ax.textContent = t('wallet.deleteSuccessDesc'); }
    if (am) am.classList.remove('hidden');
    
    const h2 = () => { am.classList.add('hidden'); ok1 && ok1.removeEventListener('click', h2); };
    ok1 && ok1.addEventListener('click', h2);
    menu.classList.add('hidden');
  };
  
  const cancel = () => {
    if (modal) modal.classList.add('hidden');
    okBtn && okBtn.removeEventListener('click', doDel);
    cancelBtn && cancelBtn.removeEventListener('click', cancel);
  };
  
  okBtn && okBtn.addEventListener('click', doDel, { once: true });
  cancelBtn && cancelBtn.addEventListener('click', cancel, { once: true });
}

/**
 * Handle private key export
 * @param {string} address - Address to export key for
 * @param {HTMLElement} menu - Menu element to hide
 */
function handleExportPrivateKey(address, menu) {
  const u = loadUser();
  const key = String(address).toLowerCase();
  let priv = '';
  
  if (u) {
    const map = (u.wallet && u.wallet.addressMsg) || {};
    let found = map[address] || map[key] || null;
    
    if (!found) {
      for (const k in map) {
        if (String(k).toLowerCase() === key) {
          found = map[k];
          break;
        }
      }
    }
    
    if (found && found.privHex) {
      priv = found.privHex || '';
    } else if (u.address && String(u.address).toLowerCase() === key) {
      priv = (u.keys && u.keys.privHex) || u.privHex || '';
    }
  }
  
  const { modal, titleEl: title, textEl: text, okEl: ok } = getActionModalElements();
  
  if (priv) {
    if (title) title.textContent = t('wallet.exportPrivateKey');
    if (text) { text.classList.remove('tip--error'); text.innerHTML = `<code class="break">${priv}</code>`; }
  } else {
    if (title) title.textContent = t('wallet.exportFailed');
    if (text) { text.classList.add('tip--error'); text.textContent = t('wallet.noPrivateKey'); }
  }
  
  if (modal) modal.classList.remove('hidden');
  
  const handler = () => { modal.classList.add('hidden'); ok && ok.removeEventListener('click', handler); };
  ok && ok.addEventListener('click', handler);
  menu.classList.add('hidden');
}

/**
 * Update total GAS badge display
 * @param {object} u - User object
 */
export function updateTotalGasBadge(u) {
  const gasBadge = document.getElementById('walletGAS');
  if (gasBadge && u && u.wallet) {
    const sumGas = Object.keys(u.wallet.addressMsg || {}).reduce((s, k) => {
      const m = u.wallet.addressMsg[k];
      return s + readAddressInterest(m);
    }, 0);
    gasBadge.innerHTML = `<span class="amt">${sumGas.toLocaleString()}</span><span class="unit">GAS</span>`;
  }
}

/**
 * Handle add balance to address
 * @param {string} address - Address to add balance to
 */
export function handleAddToAddress(address) {
  const u = loadUser();
  if (!u || !u.wallet || !u.wallet.addressMsg) return;
  
  const key = String(address).toLowerCase();
  const found = u.wallet.addressMsg[address] || u.wallet.addressMsg[key];
  if (!found) return;
  
  const typeId = Number(found && found.type !== undefined ? found.type : 0);
  const inc = typeId === 1 ? 1 : (typeId === 2 ? 5 : 10);

  // Ensure structures exist
  found.value = found.value || { totalValue: 0, utxoValue: 0, txCerValue: 0 };
  found.utxos = found.utxos || {};

  // Construct SubATX
  const subTx = {
    TXID: '',
    TXType: 0,
    TXInputsNormal: [{ IsCommitteeMake: true }],
    TXOutputs: [{
      ToAddress: key,
      ToValue: inc,
      ToGuarGroupID: u.guarGroup || u.orgNumber || '',
      ToPublicKey: {
        Curve: 'P256',
        XHex: found.pubXHex || '',
        YHex: found.pubYHex || ''
      },
      ToInterest: 10,
      Type: typeId,
      ToPeerID: "QmXov7TjwVKoNqK9wQxnpTXsngphe1iCWSm57ikgHnJD9D",
      IsPayForGas: false,
      IsCrossChain: false,
      IsGuarMake: false
    }],
    Data: []
  };

  // Calculate TXID with random bytes for uniqueness
  const randomBytes = new Uint8Array(8);
  crypto.getRandomValues(randomBytes);
  subTx.TXID = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');

  // Construct UTXOData
  const utxoKey = `${subTx.TXID}_0`;
  const utxoData = {
    UTXO: subTx,
    Value: inc,
    Type: typeId,
    Time: Date.now(),
    Position: {
      Blocknum: 0,
      IndexX: 0,
      IndexY: 0,
      IndexZ: 0
    },
    IsTXCerUTXO: false
  };

  // Add to UTXOs
  found.utxos[utxoKey] = utxoData;

  // Update Balance
  const newUtxoVal = Object.values(found.utxos).reduce((s, u) => s + (Number(u.Value) || 0), 0);
  found.value.utxoValue = newUtxoVal;
  found.value.totalValue = newUtxoVal + Number(found.value.txCerValue || 0);
  found.estInterest = Number(found.estInterest || 0) + 10;
  found.gas = Number(found.estInterest || 0);

  // Recalculate Wallet ValueDivision
  const sumVD = { 0: 0, 1: 0, 2: 0 };
  Object.keys(u.wallet.addressMsg || {}).forEach((addrK) => {
    const m = u.wallet.addressMsg[addrK] || {};
    const t = Number(m.type || 0);
    const val = Number(m.value && (m.value.totalValue || m.value.TotalValue) || 0);
    if (sumVD[t] !== undefined) {
      sumVD[t] += val;
    }
  });
  u.wallet.valueDivision = sumVD;
  u.wallet.ValueDivision = sumVD;

  const pgcTotal = Number(sumVD[0] || 0);
  const btcTotal = Number(sumVD[1] || 0);
  const ethTotal = Number(sumVD[2] || 0);
  const valueTotalPGC = pgcTotal + btcTotal * 1000000 + ethTotal * 1000;
  u.wallet.totalValue = valueTotalPGC;
  u.wallet.TotalValue = valueTotalPGC;

  saveUser(u);
  updateTotalGasBadge(u);

  // Update UI
  const coinType = typeId === 1 ? 'BTC' : (typeId === 2 ? 'ETH' : 'PGC');
  
  // Show Toast
  showMiniToast(`+${inc} ${coinType}`, 'success');
  
  // Update currency breakdown display
  const walletPGCEl = document.getElementById('walletPGC');
  const walletBTCEl = document.getElementById('walletBTC');
  const walletETHEl = document.getElementById('walletETH');
  const vdUpdated = u.wallet.valueDivision || { 0: 0, 1: 0, 2: 0 };
  if (walletPGCEl) walletPGCEl.textContent = Number(vdUpdated[0] || 0).toLocaleString();
  if (walletBTCEl) walletBTCEl.textContent = Number(vdUpdated[1] || 0).toLocaleString();
  if (walletETHEl) walletETHEl.textContent = Number(vdUpdated[2] || 0).toLocaleString();

  // Update USDT display
  updateUSDTDisplay(u);
  
  // Update address card display without re-rendering (to keep card expanded)
  updateAddressCardDisplay(address, found);
  
  // Update source address list
  if (typeof window.__refreshSrcAddrList === 'function') {
    try { window.__refreshSrcAddrList(); } catch (_) { }
  }
  
  updateWalletBrief();
}

/**
 * Handle clear address balance
 * @param {string} address - Address to clear
 */
export function handleZeroAddress(address) {
  const u = loadUser();
  if (!u || !u.wallet || !u.wallet.addressMsg) return;
  
  const key = String(address).toLowerCase();
  const found = u.wallet.addressMsg[address] || u.wallet.addressMsg[key];
  if (!found) return;

  // Clear UTXOs
  found.utxos = {};
  found.value = found.value || { totalValue: 0, utxoValue: 0, txCerValue: 0 };
  found.value.utxoValue = 0;
  found.value.totalValue = Number(found.value.txCerValue || 0);
  found.estInterest = 0;
  found.gas = 0;

  // Recalculate ValueDivision
  const sumVD = { 0: 0, 1: 0, 2: 0 };
  Object.keys(u.wallet.addressMsg || {}).forEach((addrK) => {
    const m = u.wallet.addressMsg[addrK] || {};
    const t = Number(m.type || 0);
    const val = Number(m.value && (m.value.totalValue || m.value.TotalValue) || 0);
    if (sumVD[t] !== undefined) {
      sumVD[t] += val;
    }
  });
  u.wallet.valueDivision = sumVD;
  
  const pgcTotal = Number(sumVD[0] || 0);
  const btcTotal = Number(sumVD[1] || 0);
  const ethTotal = Number(sumVD[2] || 0);
  const valueTotalPGC = pgcTotal + btcTotal * 1000000 + ethTotal * 1000;
  u.wallet.totalValue = valueTotalPGC;
  u.wallet.TotalValue = valueTotalPGC;
  
  saveUser(u);
  updateTotalGasBadge(u);
  
  // Update UI
  const typeId = Number(found && found.type !== undefined ? found.type : 0);
  const coinType = typeId === 1 ? 'BTC' : (typeId === 2 ? 'ETH' : 'PGC');
  
  // Show Toast
  showMiniToast(t('address.clear'), 'info');
  
  // Update currency breakdown display
  const walletPGCEl = document.getElementById('walletPGC');
  const walletBTCEl = document.getElementById('walletBTC');
  const walletETHEl = document.getElementById('walletETH');
  const vdUpdated = u.wallet.valueDivision || { 0: 0, 1: 0, 2: 0 };
  if (walletPGCEl) walletPGCEl.textContent = Number(vdUpdated[0] || 0).toLocaleString();
  if (walletBTCEl) walletBTCEl.textContent = Number(vdUpdated[1] || 0).toLocaleString();
  if (walletETHEl) walletETHEl.textContent = Number(vdUpdated[2] || 0).toLocaleString();

  // Update USDT display
  updateUSDTDisplay(u);
  
  // Update address card display without re-rendering (to keep card expanded)
  updateAddressCardDisplay(address, found);
  
  // Update source address list
  if (typeof window.__refreshSrcAddrList === 'function') {
    try { window.__refreshSrcAddrList(); } catch (_) { }
  }
  
  updateWalletBrief();
}

/**
 * Update a specific address card display without re-rendering entire wallet
 * @param {string} address - Address to update
 * @param {object} found - Address metadata
 */
function updateAddressCardDisplay(address, found) {
  const key = String(address).toLowerCase();
  const typeId = Number(found && found.type !== undefined ? found.type : 0);
  const coinType = typeId === 1 ? 'BTC' : (typeId === 2 ? 'ETH' : 'PGC');
  const balance = Number((found && found.value && found.value.utxoValue) || 0);
  const gas = Number(found.estInterest || found.gas || 0);
  
  // Find the address card
  const list = document.getElementById('walletAddrList');
  if (!list) return;
  
  const cards = list.querySelectorAll('.addr-card');
  cards.forEach(card => {
    const btn = card.querySelector('.btn-add') || card.querySelector('.btn-zero');
    if (btn && btn.dataset.addr && btn.dataset.addr.toLowerCase() === key) {
      // Update balance in summary
      const balanceEl = card.querySelector('.addr-card-balance');
      if (balanceEl) {
        balanceEl.textContent = `${balance} ${coinType}`;
      }
      
      // Update detail rows
      const detailRows = card.querySelectorAll('.addr-detail-row');
      detailRows.forEach(row => {
        const label = row.querySelector('.addr-detail-label');
        const value = row.querySelector('.addr-detail-value');
        if (label && value) {
          const labelText = label.textContent;
          if (labelText === t('address.balance') || labelText === '余额') {
            value.textContent = `${balance} ${coinType}`;
          } else if (labelText === 'GAS') {
            value.textContent = gas;
          }
        }
      });
    }
  });
}

/**
 * Update USDT and breakdown display
 * @param {object} u - User object
 */
function updateUSDTDisplay(u) {
  const usdtEl = document.getElementById('walletUSDT');
  if (usdtEl && u && u.wallet) {
    const vdAll = u.wallet.valueDivision || { 0: 0, 1: 0, 2: 0 };
    const pgcA = Number(vdAll[0] || 0);
    const btcA = Number(vdAll[1] || 0);
    const ethA = Number(vdAll[2] || 0);
    const usdt = Math.round(pgcA * 1 + btcA * 100 + ethA * 10);
    // Only show the number, not the unit (unit is shown in smaller text elsewhere)
    usdtEl.textContent = usdt.toLocaleString();
    
    const bd = document.querySelector('.currency-breakdown');
    if (bd) {
      const pgcV = bd.querySelector('.tag--pgc');
      const btcV = bd.querySelector('.tag--btc');
      const ethV = bd.querySelector('.tag--eth');
      if (pgcV) pgcV.textContent = pgcA;
      if (btcV) btcV.textContent = btcA;
      if (ethV) ethV.textContent = ethA;
    }
  }
}

// ========================================
// Address Modal Functions
// ========================================

let __addrMode = 'create';

/**
 * Show address modal (create or import)
 * @param {string} mode - 'create' or 'import'
 */
export function showAddrModal(mode) {
  __addrMode = mode;
  const addrModal = document.getElementById('addrModal');
  const addrTitle = document.getElementById('addrModalTitle');
  const addrCreateBox = document.getElementById('addrCreateBox');
  const addrImportBox = document.getElementById('addrImportBox');
  
  if (addrTitle) addrTitle.textContent = mode === 'import' ? t('walletModal.importAddress') : t('walletModal.createAddress');
  if (addrCreateBox) addrCreateBox.classList.toggle('hidden', mode !== 'create');
  if (addrImportBox) addrImportBox.classList.toggle('hidden', mode !== 'import');
  
  if (mode === 'import') {
    const input = document.getElementById('addrPrivHex');
    if (input) input.value = '';
  }
  
  if (addrModal) addrModal.classList.remove('hidden');
  setAddrError('');
}

/**
 * Hide address modal
 */
export function hideAddrModal() {
  const addrModal = document.getElementById('addrModal');
  if (addrModal) addrModal.classList.add('hidden');
  setAddrError('');
}

/**
 * Set address error message
 * @param {string} msg - Error message (empty to clear)
 */
function setAddrError(msg) {
  const box = document.getElementById('addrError');
  if (!box) return;
  if (msg) {
    box.textContent = msg;
    box.classList.remove('hidden');
  } else {
    box.textContent = '';
    box.classList.add('hidden');
  }
}

/**
 * Import address in place (from modal)
 * @param {string} priv - Private key hex
 */
async function importAddressInPlace(priv) {
  const u2 = loadUser();
  if (!u2 || !u2.accountId) { 
    showErrorToast(t('modal.pleaseLoginFirst'), t('common.notLoggedIn')); 
    return; 
  }
  
  const ov = document.getElementById('actionOverlay');
  const ovt = document.getElementById('actionOverlayText');
  if (ovt) ovt.textContent = t('modal.addingWalletAddress');
  if (ov) ov.classList.remove('hidden');
  
  try {
    const data = await importFromPrivHex(priv);
    const acc = toAccount({ accountId: u2.accountId, address: u2.address }, u2);
    const addr = (data.address || '').toLowerCase();
    
    if (!addr) { 
      showErrorToast(t('toast.cannotParseAddress'), t('toast.importFailed')); 
      return; 
    }
    
    const map = (acc.wallet && acc.wallet.addressMsg) || {};
    let dup = false;
    const lowerMain = (u2.address || '').toLowerCase();
    
    if (lowerMain && lowerMain === addr) dup = true;
    if (!dup) {
      for (const k in map) { 
        if (Object.prototype.hasOwnProperty.call(map, k)) { 
          if (String(k).toLowerCase() === addr) { 
            dup = true; 
            break; 
          } 
        } 
      }
    }
    
    if (dup) { 
      showErrorToast(t('toast.addressExists'), t('toast.importFailed')); 
      return; 
    }
    
    acc.wallet.addressMsg[addr] = acc.wallet.addressMsg[addr] || { 
      type: 0, 
      utxos: {}, 
      txCers: {}, 
      value: { totalValue: 0, utxoValue: 0, txCerValue: 0 }, 
      estInterest: 0, 
      origin: 'imported' 
    };
    
    const normPriv = (data.privHex || priv).replace(/^0x/i, '');
    acc.wallet.addressMsg[addr].privHex = normPriv;
    acc.wallet.addressMsg[addr].pubXHex = data.pubXHex || acc.wallet.addressMsg[addr].pubXHex || '';
    acc.wallet.addressMsg[addr].pubYHex = data.pubYHex || acc.wallet.addressMsg[addr].pubYHex || '';
    
    saveUser(acc);
    
    if (window.__refreshSrcAddrList) { 
      try { window.__refreshSrcAddrList(); } catch (_) { } 
    }
    
    renderWallet();
    try { updateWalletBrief(); } catch { }
    
    showSuccessToast(t('toast.importSuccessDesc'), t('toast.importSuccess'));
  } catch (err) {
    showErrorToast((err && err.message ? err.message : String(err)), t('toast.importFailed'));
  } finally {
    if (ov) ov.classList.add('hidden');
  }
}

/**
 * Handle address modal OK button
 */
export async function handleAddrModalOk() {
  if (__addrMode === 'create') { 
    hideAddrModal(); 
    if (typeof window.addNewSubWallet === 'function') {
      window.addNewSubWallet();
    }
  } else {
    const input = document.getElementById('addrPrivHex');
    const v = input ? input.value.trim() : '';
    
    if (!v) {
      showErrorToast(t('walletModal.pleaseEnterPrivateKey'), t('toast.importFailed'));
      if (input) input.focus();
      return;
    }
    
    const normalized = v.replace(/^0x/i, '');
    if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
      showErrorToast(t('walletModal.privateKeyFormatError'), t('toast.importFailed'));
      if (input) input.focus();
      return;
    }
    
    setAddrError('');
    hideAddrModal();
    await importAddressInPlace(v);
  }
}

/**
 * Initialize address modal buttons
 */
export function initAddressModal() {
  const openCreateAddrBtn = document.getElementById('openCreateAddrBtn');
  const openImportAddrBtn = document.getElementById('openImportAddrBtn');
  const addrCancelBtn = document.getElementById('addrCancelBtn');
  const addrOkBtn = document.getElementById('addrOkBtn');
  
  if (openCreateAddrBtn && !openCreateAddrBtn.dataset._walletBind) {
    openCreateAddrBtn.onclick = () => showAddrModal('create');
    openCreateAddrBtn.dataset._walletBind = '1';
  }
  
  if (openImportAddrBtn && !openImportAddrBtn.dataset._walletBind) {
    openImportAddrBtn.onclick = () => showAddrModal('import');
    openImportAddrBtn.dataset._walletBind = '1';
  }
  
  if (addrCancelBtn && !addrCancelBtn.dataset._walletBind) {
    addrCancelBtn.onclick = hideAddrModal;
    addrCancelBtn.dataset._walletBind = '1';
  }
  
  if (addrOkBtn && !addrOkBtn.dataset._walletBind) {
    addrOkBtn.onclick = handleAddrModalOk;
    addrOkBtn.dataset._walletBind = '1';
  }
}

// ========================================
// Transfer Mode Functions
// ========================================

let walletMap = {};
let srcAddrs = [];

/**
 * Refresh wallet snapshot from localStorage
 */
function refreshWalletSnapshot() {
  const latest = loadUser();
  walletMap = (latest && latest.wallet && latest.wallet.addressMsg) || {};
  srcAddrs = Object.keys(walletMap);
  return walletMap;
}

/**
 * Fill change address dropdowns based on selected addresses
 */
function fillChange() {
  const addrList = document.getElementById('srcAddrList');
  if (!addrList) return;
  
  const chPGC = document.getElementById('chAddrPGC');
  const chBTC = document.getElementById('chAddrBTC');
  const chETH = document.getElementById('chAddrETH');
  const csPGC = document.getElementById('csChPGC');
  const csBTC = document.getElementById('csChBTC');
  const csETH = document.getElementById('csChETH');
  
  const sel = Array.from(addrList.querySelectorAll('input[type="checkbox"]')).filter(x => x.checked).map(x => x.value);
  
  // Update label selected state
  Array.from(addrList.querySelectorAll('label')).forEach(l => { 
    const inp = l.querySelector('input[type="checkbox"]'); 
    if (inp) l.classList.toggle('selected', inp.checked); 
  });

  // Filter addresses by type
  const getAddrsByType = (typeId) => {
    const pool = sel.length ? sel : srcAddrs;
    return pool.filter(addr => {
      const meta = walletMap[addr];
      return meta && Number(meta.type) === typeId;
    });
  };

  const optsPGC = getAddrsByType(0);
  const optsBTC = getAddrsByType(1);
  const optsETH = getAddrsByType(2);

  const buildOptions = (opts) => opts.map(a => `<option value="${a}">${a}</option>`).join('');

  if (chPGC) chPGC.innerHTML = buildOptions(optsPGC);
  if (chBTC) chBTC.innerHTML = buildOptions(optsBTC);
  if (chETH) chETH.innerHTML = buildOptions(optsETH);

  const buildMenu = (box, optsArr, hidden) => {
    if (!box) return;
    const menu = box.querySelector('.custom-select__menu');
    const valEl = box.querySelector('.addr-val');

    if (optsArr.length === 0) {
      if (menu) menu.innerHTML = `<div class="custom-select__item disabled">${t('transfer.noAddressAvailable')}</div>`;
      if (valEl) valEl.textContent = t('transfer.noAddressAvailable');
      if (hidden) hidden.value = '';
      const ico0 = box.querySelector('.coin-icon');
      if (ico0) ico0.remove();
      return;
    }

    if (menu) menu.innerHTML = optsArr.map(a => `<div class="custom-select__item" data-val="${a}"><code class="break">${a}</code></div>`).join('');

    // Preserve existing selection if valid, otherwise select first
    const currentVal = hidden ? hidden.value : '';
    const isValid = optsArr.includes(currentVal);
    const first = isValid ? currentVal : (optsArr[0] || '');

    if (valEl) valEl.textContent = first;
    if (hidden) hidden.value = first;
    const ico = box.querySelector('.coin-icon');
    if (ico) ico.remove();
  };

  buildMenu(csPGC, optsPGC, chPGC);
  buildMenu(csBTC, optsBTC, chBTC);
  buildMenu(csETH, optsETH, chETH);
  
  if (typeof window.updateSummaryAddr === 'function') {
    window.updateSummaryAddr();
  }
}

/**
 * Rebuild the source address list in transfer panel
 */
export function rebuildAddrList() {
  refreshWalletSnapshot();
  const addrList = document.getElementById('srcAddrList');
  if (!addrList) return;
  
  addrList.innerHTML = srcAddrs.map(a => {
    const meta = walletMap[a] || {};
    const tId = Number(meta && meta.type !== undefined ? meta.type : 0);
    const amt = Number((meta && meta.value && meta.value.utxoValue) || 0);
    
    // Coin icons and colors
    const coinColors = { 0: 'pgc', 1: 'btc', 2: 'eth' };
    const coinNames = { 0: 'PGC', 1: 'BTC', 2: 'ETH' };
    
    const color = coinColors[tId] || 'pgc';
    const coinName = coinNames[tId] || 'PGC';
    const coinLetter = coinName.charAt(0);
    const shortAddr = a;
    
    return `<label class="src-addr-item item-type-${color}" data-addr="${a}">
      <input type="checkbox" value="${a}">
      <div class="item-backdrop"></div>
      
      <div class="item-content">
        <div class="item-left">
          <div class="coin-icon coin-icon--${color}">${coinLetter}</div>
          <div class="addr-info">
            <span class="addr-text" title="${a}">${shortAddr}</span>
            <span class="coin-name-tiny">${coinName}</span>
          </div>
        </div>
        
        <div class="item-right">
          <span class="amount-num" title="${amt}">${amt}</span>
          <div class="check-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
        </div>
      </div>
      
      <div class="selection-outline"></div>
    </label>`;
  }).join('');
  
  // Auto-select logic
  autoSelectFromAddress(addrList);
  
  // Bind change event
  if (!addrList.dataset._changeBind) {
    addrList.addEventListener('change', fillChange);
    addrList.dataset._changeBind = '1';
  }
  
  // Initial fill
  fillChange();
}

/**
 * Auto-select from address based on balance
 * @param {HTMLElement} addrList - Address list element
 */
function autoSelectFromAddress(addrList) {
  const checkboxes = addrList.querySelectorAll('input[type="checkbox"]');
  const labels = addrList.querySelectorAll('label.src-addr-item');
  
  // If already selected, don't auto-select
  const alreadySelected = Array.from(checkboxes).some(cb => cb.checked);
  if (alreadySelected) return;
  
  // Case 1: Only one address, auto-select
  if (srcAddrs.length === 1) {
    const cb = checkboxes[0];
    const label = labels[0];
    if (cb && label) {
      cb.checked = true;
      label.classList.add('selected');
    }
    return;
  }
  
  // Case 2: Multiple addresses, only one has balance, auto-select that one
  const addrsWithBalance = srcAddrs.filter(addr => {
    const meta = walletMap[addr];
    const amt = Number((meta && meta.value && meta.value.utxoValue) || 0);
    return amt > 0;
  });
  
  if (addrsWithBalance.length === 1) {
    const targetAddr = addrsWithBalance[0];
    labels.forEach((label, idx) => {
      if (label.dataset.addr === targetAddr) {
        const cb = checkboxes[idx];
        if (cb) {
          cb.checked = true;
          label.classList.add('selected');
        }
      }
    });
  }
}

/**
 * Initialize transfer mode tabs (quick/cross/pledge)
 */
export function initTransferModeTabs() {
  const modeTabsContainer = document.querySelector('.transfer-mode-tabs');
  if (!modeTabsContainer || modeTabsContainer.dataset._bind) return;

  // Compact mode detection
  const isCompactMode = () => window.matchMedia('(max-width: 860px)').matches;
  
  const ensureDropdown = () => {
    let dd = modeTabsContainer.querySelector('.mode-dropdown');
    if (!dd) {
      dd = document.createElement('div');
      dd.className = 'mode-dropdown';
      modeTabsContainer.appendChild(dd);
    }
    return dd;
  };
  
  const rebuildDropdown = () => {
    const dd = ensureDropdown();
    const items = [];
    modeTabsContainer.querySelectorAll('.transfer-mode-tab').forEach(b => {
      if (!b.classList.contains('active')) {
        items.push(`<button class="mode-item" data-mode="${b.dataset.mode}">${b.textContent}</button>`);
      }
    });
    dd.innerHTML = items.join('');
  };
  
  const applyMode = (mode) => {
    modeTabsContainer.querySelectorAll('.transfer-mode-tab, .mode-tab').forEach(t => t.classList.remove('active'));
    const btn = modeTabsContainer.querySelector(`.transfer-mode-tab[data-mode="${mode}"]`);
    if (btn) {
      btn.classList.add('active');
      // Update slider indicator position
      const allTabs = Array.from(modeTabsContainer.querySelectorAll('.transfer-mode-tab'));
      const activeIndex = allTabs.indexOf(btn);
      if (activeIndex !== -1) {
        modeTabsContainer.setAttribute('data-active', activeIndex);
      }
    }
    const tfModeSelect = document.getElementById('tfMode');
    const isPledgeSelect = document.getElementById('isPledge');
    if (tfModeSelect) tfModeSelect.value = mode;
    if (isPledgeSelect) isPledgeSelect.value = mode === 'pledge' ? 'true' : 'false';
    const radios = document.querySelectorAll('input[name="tfModeChoice"]');
    radios.forEach(r => { r.checked = r.value === mode; });
  };
  
  const updateModeTabsLayout = () => {
    if (isCompactMode()) {
      modeTabsContainer.classList.add('compact');
      rebuildDropdown();
    } else {
      modeTabsContainer.classList.remove('compact');
      modeTabsContainer.classList.remove('open');
      const dd = modeTabsContainer.querySelector('.mode-dropdown');
      if (dd) dd.remove();
    }
  };
  
  modeTabsContainer.addEventListener('click', (e) => {
    const tab = e.target.closest('.transfer-mode-tab') || e.target.closest('.mode-tab');
    if (tab) {
      if (modeTabsContainer.classList.contains('compact') && tab.classList.contains('active')) {
        rebuildDropdown();
        modeTabsContainer.classList.toggle('open');
        return;
      }
      applyMode(tab.dataset.mode);
      return;
    }
    const item = e.target.closest('.mode-item');
    if (item) {
      applyMode(item.dataset.mode);
      modeTabsContainer.classList.remove('open');
    }
  });
  
  let layoutTimer;
  const onResize = () => { clearTimeout(layoutTimer); layoutTimer = setTimeout(updateModeTabsLayout, 50); };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  updateModeTabsLayout();
  
  // Initialize slider position
  const activeTab = modeTabsContainer.querySelector('.transfer-mode-tab.active');
  if (activeTab) {
    const allTabs = Array.from(modeTabsContainer.querySelectorAll('.transfer-mode-tab'));
    const activeIndex = allTabs.indexOf(activeTab);
    if (activeIndex !== -1) {
      modeTabsContainer.setAttribute('data-active', activeIndex);
    }
  } else {
    modeTabsContainer.setAttribute('data-active', '0');
  }
  
  modeTabsContainer.dataset._bind = '1';
}

/**
 * Bind custom select dropdowns
 * @param {HTMLElement} box - Custom select box
 * @param {HTMLElement} hidden - Hidden input
 */
function bindCustomSelect(box, hidden) {
  if (!box || box.dataset._bind) return;
  
  box.addEventListener('click', (e) => { 
    e.stopPropagation(); 
    const sec = box.closest('.tx-section'); 
    const opening = !box.classList.contains('open'); 
    box.classList.toggle('open'); 
    if (sec) sec.classList.toggle('has-open', opening); 
  });
  
  const menu = box.querySelector('.custom-select__menu');
  if (menu) {
    menu.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const item = ev.target.closest('.custom-select__item');
      if (!item) return;
      const v = item.getAttribute('data-val');
      const valEl = box.querySelector('.addr-val');
      if (valEl) valEl.textContent = v;
      if (hidden) hidden.value = v;
      box.classList.remove('open'); 
      const sec = box.closest('.tx-section'); 
      if (sec) sec.classList.remove('has-open'); 
      if (typeof window.updateSummaryAddr === 'function') {
        window.updateSummaryAddr();
      }
    });
  }
  
  document.addEventListener('click', () => { 
    box.classList.remove('open'); 
    const sec = box.closest('.tx-section'); 
    if (sec) sec.classList.remove('has-open'); 
  });
  
  box.dataset._bind = '1';
}

/**
 * Initialize custom select dropdowns for change addresses
 */
export function initChangeAddressSelects() {
  const chPGC = document.getElementById('chAddrPGC');
  const chBTC = document.getElementById('chAddrBTC');
  const chETH = document.getElementById('chAddrETH');
  const csPGC = document.getElementById('csChPGC');
  const csBTC = document.getElementById('csChBTC');
  const csETH = document.getElementById('csChETH');
  
  bindCustomSelect(csPGC, chPGC);
  bindCustomSelect(csBTC, chBTC);
  bindCustomSelect(csETH, chETH);
}

/**
 * Initialize refresh source address list function
 */
export function initRefreshSrcAddrList() {
  window.__refreshSrcAddrList = () => {
    try {
      refreshWalletSnapshot();
      rebuildAddrList();
      fillChange();
    } catch (_) { }
  };
}

// Re-export recipient functions
export { initRecipientCards, initAdvancedOptions };
