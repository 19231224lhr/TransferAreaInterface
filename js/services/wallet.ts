/**
 * Wallet Service Module (Reactive Version)
 * 
 * 使用响应式绑定系统重构的钱包服务模块。
 * 提供钱包管理功能，包括渲染、余额更新和组织面板。
 * 
 * 性能优化：
 * - 使用 scheduleBatchUpdate 进行批量 DOM 更新
 * - 使用 rafDebounce 进行输入验证防抖
 * - 使用 DocumentFragment 优化列表渲染
 * 
 * @module services/wallet
 */

import { t } from '../i18n/index.js';
import { loadUser, saveUser, getJoinedGroup, toAccount, User } from '../utils/storage';
import { readAddressInterest } from '../utils/helpers.js';
import { getActionModalElements } from '../ui/modal';
import { showMiniToast, showErrorToast, showSuccessToast } from '../utils/toast.js';
import { importFromPrivHex } from './account';
import { initRecipientCards, initAdvancedOptions } from './recipient.js';
import { escapeHtml } from '../utils/security';
import { getCoinName, getCoinClass, getCoinInfo } from '../config/constants';
import { scheduleBatchUpdate } from '../utils/performanceMode.js';
import { globalEventManager } from '../utils/eventUtils.js';
import { encryptAndSavePrivateKey, hasEncryptedKey } from '../utils/keyEncryptionUI';

// ============================================================================
// Types
// ============================================================================

interface AddressMetadata {
  type?: number;
  value?: {
    totalValue?: number;
    TotalValue?: number;
    utxoValue?: number;
    txCerValue?: number;
  };
  utxos?: Record<string, unknown>;
  txCers?: Record<string, unknown>;
  estInterest?: number;
  gas?: number;
  origin?: string;
  privHex?: string;
  pubXHex?: string;
  pubYHex?: string;
}

interface WalletSnapshot {
  addressMsg: Record<string, AddressMetadata>;
}

// ============================================================================
// Module State
// ============================================================================

let walletMap: Record<string, AddressMetadata> = {};
let srcAddrs: string[] = [];
let __addrMode: 'create' | 'import' = 'create';

// ============================================================================
// Binding Reset Function
// ============================================================================

/**
 * Reset all wallet-related event binding flags.
 * Call this when globalEventManager.cleanup() is called to ensure
 * events can be re-bound on the next initialization.
 */
export function resetWalletBindings(): void {
  // Reset transfer mode tabs binding
  const modeTabsContainer = document.querySelector('.transfer-mode-tabs') as HTMLElement | null;
  if (modeTabsContainer) {
    delete modeTabsContainer.dataset._bind;
  }
  
  // Reset address list change binding
  const addrList = document.getElementById('srcAddrList');
  if (addrList) {
    delete addrList.dataset._changeBind;
  }
  
  // Reset custom select bindings
  const customSelects = ['csChPGC', 'csChBTC', 'csChETH'];
  customSelects.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      delete el.dataset._bind;
    }
  });
}

// ============================================================================
// Wallet Brief Functions
// ============================================================================

/**
 * Update wallet brief display (count and list)
 */
export function updateWalletBrief(): void {
  const u = loadUser();
  const countEl = document.getElementById('walletCount');
  const brief = document.getElementById('walletBriefList');
  const tip = document.getElementById('walletEmptyTip');
  const addrs = u?.wallet ? Object.keys(u.wallet.addressMsg || {}) : [];
  
  if (countEl) {
    countEl.textContent = String(addrs.length);
  }
  
  if (brief) {
    if (addrs.length === 0) {
      brief.innerHTML = '';
      if (tip) tip.classList.remove('hidden');
    } else {
      if (tip) tip.classList.add('hidden');
      brief.innerHTML = addrs.slice(0, 3).map(addr => {
        const meta = (u?.wallet?.addressMsg?.[addr] || {}) as AddressMetadata;
        const typeId = Number(meta.type || 0);
        const coinType = getCoinName(typeId);
        const shortAddr = addr.length > 12 ? addr.slice(0, 6) + '...' + addr.slice(-4) : addr;
        return `<div class="wallet-brief-item"><span class="wallet-brief-addr">${escapeHtml(shortAddr)}</span><span class="wallet-brief-coin">${escapeHtml(coinType)}</span></div>`;
      }).join('');
    }
  }
}

// ============================================================================
// Organization Panel Functions
// ============================================================================

/**
 * Refresh organization panel display
 */
export function refreshOrgPanel(): void {
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
  
  const tfMode = document.getElementById('tfMode') as HTMLSelectElement | null;
  const tfModeQuick = document.getElementById('tfModeQuick') as HTMLInputElement | null;
  const tfModeCross = document.getElementById('tfModeCross') as HTMLInputElement | null;
  const tfModePledge = document.getElementById('tfModePledge') as HTMLInputElement | null;
  const isPledgeSel = document.getElementById('isPledge') as HTMLSelectElement | null;
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
  
  if (tfModeQuick?.parentNode) {
    const quickLabel = tfModeQuick.parentNode as HTMLElement;
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
        const l = tfModeCross.parentNode as HTMLElement | null;
        if (l?.style) l.style.display = 'none';
      }
      if (tfModePledge) {
        tfModePledge.checked = false;
        tfModePledge.disabled = true;
        const l2 = tfModePledge.parentNode as HTMLElement | null;
        if (l2?.style) l2.style.display = 'none';
      }
      tfMode.value = 'quick';
      tfModeQuick.checked = true;
      if (isPledgeSel) isPledgeSel.value = 'false';
    } else {
      if (tfModeCross) {
        tfModeCross.disabled = false;
        const l = tfModeCross.parentNode as HTMLElement | null;
        if (l?.style) l.style.display = '';
      }
      if (tfModePledge) {
        tfModePledge.disabled = false;
        const l2 = tfModePledge.parentNode as HTMLElement | null;
        if (l2?.style) l2.style.display = '';
      }
      if (!tfMode.value) tfMode.value = 'quick';
      if (tfMode.value === 'cross' && (!tfModeCross || tfModeCross.disabled)) tfMode.value = 'quick';
      if (tfMode.value === 'pledge' && (!tfModePledge || tfModePledge.disabled)) tfMode.value = 'quick';
      if (tfMode.value === 'quick') tfModeQuick.checked = true;
      if (isPledgeSel) isPledgeSel.value = tfMode.value === 'pledge' ? 'true' : 'false';
    }
    
    // Update organization info display
    const orgFields: [string, string][] = [
      ['woGroupID', joined && g ? g.groupID : ''],
      ['woAggre', joined && g ? (g.aggreNode || '') : ''],
      ['woAssign', joined && g ? (g.assignNode || '') : ''],
      ['woPledge', joined && g ? (g.pledgeAddress || '') : '']
    ];
    
    orgFields.forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    });
  }
}

// ============================================================================
// Wallet Rendering Functions
// ============================================================================

/**
 * Render wallet address list
 */
export function renderWallet(): void {
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
  
  const addresses = Object.keys((u.wallet?.addressMsg) || {});
  
  // Use DocumentFragment for better performance
  const fragment = document.createDocumentFragment();
  
  addresses.forEach((a) => {
    const item = document.createElement('div');
    item.className = 'addr-card';
    const meta = u.wallet?.addressMsg?.[a] || null;
    
    const typeId0 = Number(meta?.type ?? 0);
    const amtCash0 = Number(meta?.value?.utxoValue || 0);
    const gas0 = readAddressInterest(meta);
    const coinType = getCoinName(typeId0);
    const coinClass = getCoinClass(typeId0);
    const shortAddr = a.length > 18 ? a.slice(0, 10) + '...' + a.slice(-6) : a;

    item.innerHTML = `
      <div class="addr-card-summary">
        <div class="addr-card-avatar coin--${coinClass}">${escapeHtml(coinType)}</div>
        <div class="addr-card-main">
          <span class="addr-card-hash" title="${escapeHtml(a)}">${escapeHtml(shortAddr)}</span>
          <span class="addr-card-balance">${escapeHtml(String(amtCash0))} ${escapeHtml(coinType)}</span>
        </div>
        <div class="addr-card-arrow">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
      </div>
      <div class="addr-card-detail">
        <div class="addr-card-detail-inner">
          <div class="addr-detail-row">
            <span class="addr-detail-label">${t('address.fullAddress')}</span>
            <span class="addr-detail-value">${escapeHtml(a)}</span>
          </div>
          <div class="addr-detail-row">
            <span class="addr-detail-label">${t('address.balance')}</span>
            <span class="addr-detail-value">${escapeHtml(String(amtCash0))} ${escapeHtml(coinType)}</span>
          </div>
          <div class="addr-detail-row">
            <span class="addr-detail-label">GAS</span>
            <span class="addr-detail-value gas">${escapeHtml(String(gas0))}</span>
          </div>
          <div class="addr-card-actions">
            <button class="addr-action-btn addr-action-btn--primary btn-add" data-addr="${escapeHtml(a)}" title="${t('address.add')}">
              <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              ${t('address.add')}
            </button>
            <button class="addr-action-btn addr-action-btn--secondary btn-zero" data-addr="${escapeHtml(a)}" title="${t('address.clear')}">
              <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              ${t('address.clear')}
            </button>
            <div class="addr-ops-container"></div>
          </div>
        </div>
      </div>
    `;
    
    // Add click to expand/collapse using globalEventManager
    const summaryEl = item.querySelector('.addr-card-summary');
    if (summaryEl) {
      globalEventManager.add(summaryEl, 'click', (e: Event) => {
        e.stopPropagation();
        item.classList.toggle('expanded');
      });
    }
    
    // Add operations menu
    const metaEl = item.querySelector('.addr-ops-container');
    if (metaEl) {
      addAddressOperationsMenu(metaEl as HTMLElement, a, item);
    }
    
    // Append to fragment instead of directly to DOM
    fragment.appendChild(item);
  });
  
  // Single DOM update
  list.innerHTML = '';
  list.appendChild(fragment);
  
  // Update wallet chart after rendering
  try { (window as any).PanguPay?.charts?.updateWalletChart?.(u); } catch (_) { }
}


// ============================================================================
// Address Operations Menu
// ============================================================================

/**
 * Add operations menu to address card
 */
function addAddressOperationsMenu(container: HTMLElement, address: string, cardItem: HTMLElement): void {
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
  
  globalEventManager.add(toggle, 'click', (e: Event) => {
    e.stopPropagation();
    menu.classList.toggle('hidden');
  });
  
  globalEventManager.add(document.body, 'click', () => {
    menu.classList.add('hidden');
  });
  
  // Delete handler
  globalEventManager.add(delBtn, 'click', (e: Event) => {
    e.stopPropagation();
    handleDeleteAddress(address, menu);
  });
  
  // Export handler
  globalEventManager.add(expBtn, 'click', (e: Event) => {
    e.stopPropagation();
    handleExportPrivateKey(address, menu);
  });
}


// ============================================================================
// Address Delete & Export Functions
// ============================================================================

/**
 * Handle address deletion
 */
function handleDeleteAddress(address: string, menu: HTMLElement): void {
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
    
    if (u.wallet?.addressMsg) {
      u.wallet.addressMsg = Object.fromEntries(
        Object.entries(u.wallet.addressMsg).filter(([k]) => String(k).toLowerCase() !== key)
      );
    }
    
    if (isMain) {
      u.address = '';
    }
    
    saveUser(u);
    
    // Refresh UI
    try { (window as any).PanguPay?.wallet?.refreshSrcAddrList?.(); } catch (_) { }
    
    renderWallet();
    updateWalletBrief();
    
    // Show success modal
    const { modal: am, titleEl: at, textEl: ax, okEl: ok1 } = getActionModalElements();
    if (at) at.textContent = t('wallet.deleteSuccess');
    if (ax) { ax.classList.remove('tip--error'); ax.textContent = t('wallet.deleteSuccessDesc'); }
    if (am) am.classList.remove('hidden');
    
    const h2 = () => { am?.classList.add('hidden'); ok1?.removeEventListener('click', h2); };
    ok1?.addEventListener('click', h2);
    menu.classList.add('hidden');
  };
  
  const cancel = () => {
    if (modal) modal.classList.add('hidden');
    okBtn?.removeEventListener('click', doDel);
    cancelBtn?.removeEventListener('click', cancel);
  };
  
  okBtn?.addEventListener('click', doDel, { once: true });
  cancelBtn?.addEventListener('click', cancel, { once: true });
}


/**
 * Handle private key export
 */
function handleExportPrivateKey(address: string, menu: HTMLElement): void {
  const u = loadUser();
  const key = String(address).toLowerCase();
  let priv = '';
  
  if (u) {
    const map = u.wallet?.addressMsg || {};
    let found = map[address] || map[key] || null;
    
    if (!found) {
      for (const k in map) {
        if (String(k).toLowerCase() === key) {
          found = map[k];
          break;
        }
      }
    }
    
    if (found && (found as any).privHex) {
      priv = (found as any).privHex || '';
    } else if (u.address && String(u.address).toLowerCase() === key) {
      priv = (u.keys?.privHex) || u.privHex || '';
    }
  }
  
  const { modal, titleEl: title, textEl: text, okEl: ok } = getActionModalElements();
  
  if (priv) {
    if (title) title.textContent = t('wallet.exportPrivateKey');
    if (text) { text.classList.remove('tip--error'); text.innerHTML = `<code class="break">${escapeHtml(priv)}</code>`; }
  } else {
    if (title) title.textContent = t('wallet.exportFailed');
    if (text) { text.classList.add('tip--error'); text.textContent = t('wallet.noPrivateKey'); }
  }
  
  if (modal) modal.classList.remove('hidden');
  
  const handler = () => { modal?.classList.add('hidden'); ok?.removeEventListener('click', handler); };
  ok?.addEventListener('click', handler);
  menu.classList.add('hidden');
}

/**
 * Update total GAS badge display
 */
export function updateTotalGasBadge(u: User | null): void {
  const gasBadge = document.getElementById('walletGAS');
  if (gasBadge && u?.wallet) {
    const sumGas = Object.keys(u.wallet.addressMsg || {}).reduce((s, k) => {
      const m = u.wallet.addressMsg[k];
      return s + readAddressInterest(m);
    }, 0);
    gasBadge.innerHTML = `<span class="amt">${sumGas.toLocaleString()}</span><span class="unit">GAS</span>`;
  }
}


// ============================================================================
// Balance Operations
// ============================================================================

/**
 * Handle add balance to address
 */
export function handleAddToAddress(address: string): void {
  const u = loadUser();
  if (!u?.wallet?.addressMsg) return;
  
  const key = String(address).toLowerCase();
  const found = u.wallet.addressMsg[address] || u.wallet.addressMsg[key];
  if (!found) return;
  
  const typeId = Number(found.type ?? 0);
  const inc = typeId === 1 ? 1 : (typeId === 2 ? 5 : 10);

  // Ensure structures exist
  found.value = found.value || { totalValue: 0, utxoValue: 0, txCerValue: 0 };
  found.utxos = found.utxos || {};

  // Construct SubATX
  const randomBytes = new Uint8Array(8);
  crypto.getRandomValues(randomBytes);
  const txid = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');

  // Construct UTXOData
  const utxoKey = `${txid}_0`;
  const utxoData = {
    UTXO: { TXID: txid, TXType: 0 },
    Value: inc,
    Type: typeId,
    Time: Date.now(),
    Position: { Blocknum: 0, IndexX: 0, IndexY: 0, IndexZ: 0 },
    IsTXCerUTXO: false
  };

  // Add to UTXOs
  (found.utxos as Record<string, unknown>)[utxoKey] = utxoData;

  // Update Balance
  const newUtxoVal = Object.values(found.utxos as Record<string, any>).reduce((s, u) => s + (Number(u.Value) || 0), 0);
  found.value.utxoValue = newUtxoVal;
  found.value.totalValue = newUtxoVal + Number(found.value.txCerValue || 0);
  found.estInterest = Number(found.estInterest || 0) + 10;
  found.gas = Number(found.estInterest || 0);

  // Recalculate Wallet ValueDivision
  recalculateWalletValue(u);
  saveUser(u);
  updateTotalGasBadge(u);

  // Update UI
  const coinType = getCoinName(typeId);
  showMiniToast(`+${inc} ${coinType}`, 'success');
  updateCurrencyDisplay(u);
  updateAddressCardDisplay(address, found);
  
  try { (window as any).PanguPay?.wallet?.refreshSrcAddrList?.(); } catch (_) { }
  
  updateWalletBrief();
}


/**
 * Handle clear address balance
 */
export function handleZeroAddress(address: string): void {
  const u = loadUser();
  if (!u?.wallet?.addressMsg) return;
  
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
  recalculateWalletValue(u);
  saveUser(u);
  updateTotalGasBadge(u);
  
  // Update UI
  showMiniToast(t('address.clear'), 'info');
  updateCurrencyDisplay(u);
  updateAddressCardDisplay(address, found);
  
  try { (window as any).PanguPay?.wallet?.refreshSrcAddrList?.(); } catch (_) { }
  
  updateWalletBrief();
}

/**
 * Recalculate wallet value division
 */
function recalculateWalletValue(u: User): void {
  const sumVD: Record<number, number> = { 0: 0, 1: 0, 2: 0 };
  Object.keys(u.wallet?.addressMsg || {}).forEach((addrK) => {
    const m = (u.wallet.addressMsg[addrK] || {}) as AddressMetadata;
    const t = Number(m.type || 0);
    const val = Number(m.value?.totalValue || m.value?.TotalValue || 0);
    if (sumVD[t] !== undefined) {
      sumVD[t] += val;
    }
  });
  u.wallet.valueDivision = sumVD;
  (u.wallet as any).ValueDivision = sumVD;

  const pgcTotal = Number(sumVD[0] || 0);
  const btcTotal = Number(sumVD[1] || 0);
  const ethTotal = Number(sumVD[2] || 0);
  const valueTotalPGC = pgcTotal + btcTotal * 1000000 + ethTotal * 1000;
  u.wallet.totalValue = valueTotalPGC;
  (u.wallet as any).TotalValue = valueTotalPGC;
}


/**
 * Update currency breakdown display
 */
function updateCurrencyDisplay(u: User): void {
  const walletPGCEl = document.getElementById('walletPGC');
  const walletBTCEl = document.getElementById('walletBTC');
  const walletETHEl = document.getElementById('walletETH');
  const vdUpdated = u.wallet?.valueDivision || { 0: 0, 1: 0, 2: 0 };
  
  if (walletPGCEl) walletPGCEl.textContent = Number(vdUpdated[0] || 0).toLocaleString();
  if (walletBTCEl) walletBTCEl.textContent = Number(vdUpdated[1] || 0).toLocaleString();
  if (walletETHEl) walletETHEl.textContent = Number(vdUpdated[2] || 0).toLocaleString();

  // Update USDT display
  updateUSDTDisplay(u);
}

/**
 * Update a specific address card display without re-rendering entire wallet
 */
function updateAddressCardDisplay(address: string, found: AddressMetadata): void {
  const key = String(address).toLowerCase();
  const typeId = Number(found.type ?? 0);
  const coinType = getCoinName(typeId);
  const balance = Number(found.value?.utxoValue || 0);
  const gas = Number(found.estInterest || found.gas || 0);
  
  const list = document.getElementById('walletAddrList');
  if (!list) return;
  
  const cards = list.querySelectorAll('.addr-card');
  cards.forEach(card => {
    const btn = card.querySelector('.btn-add') || card.querySelector('.btn-zero');
    if (btn && (btn as HTMLElement).dataset.addr?.toLowerCase() === key) {
      scheduleBatchUpdate(`addr-card-balance-${key}`, () => {
        const balanceEl = card.querySelector('.addr-card-balance');
        if (balanceEl) {
          balanceEl.textContent = `${balance} ${coinType}`;
        }
      });
      
      scheduleBatchUpdate(`addr-card-details-${key}`, () => {
        const detailRows = card.querySelectorAll('.addr-detail-row');
        detailRows.forEach(row => {
          const label = row.querySelector('.addr-detail-label');
          const value = row.querySelector('.addr-detail-value');
          if (label && value) {
            const labelText = label.textContent;
            if (labelText === t('address.balance') || labelText === '余额') {
              value.textContent = `${balance} ${coinType}`;
            } else if (labelText === 'GAS') {
              value.textContent = String(gas);
            }
          }
        });
      });
    }
  });
}


/**
 * Update USDT and breakdown display
 */
function updateUSDTDisplay(u: User): void {
  const usdtEl = document.getElementById('walletUSDT');
  if (usdtEl && u?.wallet) {
    const vdAll = u.wallet.valueDivision || { 0: 0, 1: 0, 2: 0 };
    const pgcA = Number(vdAll[0] || 0);
    const btcA = Number(vdAll[1] || 0);
    const ethA = Number(vdAll[2] || 0);
    const usdt = Math.round(pgcA * 1 + btcA * 100 + ethA * 10);
    
    scheduleBatchUpdate('usdt-display', () => {
      usdtEl.textContent = usdt.toLocaleString();
    });
    
    const bd = document.querySelector('.currency-breakdown');
    if (bd) {
      scheduleBatchUpdate('currency-breakdown', () => {
        const pgcV = bd.querySelector('.tag--pgc');
        const btcV = bd.querySelector('.tag--btc');
        const ethV = bd.querySelector('.tag--eth');
        if (pgcV) pgcV.textContent = String(pgcA);
        if (btcV) btcV.textContent = String(btcA);
        if (ethV) ethV.textContent = String(ethA);
      });
    }
  }
}

// ============================================================================
// Address Modal Functions
// ============================================================================

/**
 * Show address modal (create or import)
 */
export function showAddrModal(mode: 'create' | 'import'): void {
  __addrMode = mode;
  const addrModal = document.getElementById('addrModal');
  const addrTitle = document.getElementById('addrModalTitle');
  const addrCreateBox = document.getElementById('addrCreateBox');
  const addrImportBox = document.getElementById('addrImportBox');
  
  if (addrTitle) addrTitle.textContent = mode === 'import' ? t('walletModal.importAddress') : t('walletModal.createAddress');
  if (addrCreateBox) addrCreateBox.classList.toggle('hidden', mode !== 'create');
  if (addrImportBox) addrImportBox.classList.toggle('hidden', mode !== 'import');
  
  if (mode === 'import') {
    const input = document.getElementById('addrPrivHex') as HTMLInputElement | null;
    if (input) input.value = '';
  }
  
  if (addrModal) addrModal.classList.remove('hidden');
  setAddrError('');
}


/**
 * Hide address modal
 */
export function hideAddrModal(): void {
  const addrModal = document.getElementById('addrModal');
  if (addrModal) addrModal.classList.add('hidden');
  setAddrError('');
}

/**
 * Set address error message
 */
function setAddrError(msg: string): void {
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
 */
async function importAddressInPlace(priv: string): Promise<void> {
  const u2 = loadUser();
  if (!u2?.accountId) { 
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
    
    const map = acc.wallet?.addressMsg || {};
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
    (acc.wallet.addressMsg[addr] as any).privHex = normPriv;
    (acc.wallet.addressMsg[addr] as any).pubXHex = data.pubXHex || '';
    (acc.wallet.addressMsg[addr] as any).pubYHex = data.pubYHex || '';
    
    saveUser(acc);
    
    // Encrypt the imported address private key
    try {
      if (normPriv && u2.accountId && !hasEncryptedKey(u2.accountId)) {
        await encryptAndSavePrivateKey(`${u2.accountId}_${addr}`, normPriv);
      }
    } catch (encryptErr) {
      console.warn('Imported address key encryption skipped:', encryptErr);
    }
    
    try { (window as any).PanguPay?.wallet?.refreshSrcAddrList?.(); } catch (_) { }
    
    renderWallet();
    try { updateWalletBrief(); } catch { }
    
    showSuccessToast(t('toast.importSuccessDesc'), t('toast.importSuccess'));
  } catch (err) {
    showErrorToast((err as Error).message || String(err), t('toast.importFailed'));
  } finally {
    if (ov) ov.classList.add('hidden');
  }
}


/**
 * Handle address modal OK button
 */
export async function handleAddrModalOk(): Promise<void> {
  if (__addrMode === 'create') { 
    hideAddrModal(); 
    if (typeof window.PanguPay?.account?.addNewSubWallet === 'function') {
      await window.PanguPay.account.addNewSubWallet();
    }
  } else {
    const input = document.getElementById('addrPrivHex') as HTMLInputElement | null;
    const v = input?.value.trim() || '';
    
    if (!v) {
      showErrorToast(t('walletModal.pleaseEnterPrivateKey'), t('toast.importFailed'));
      input?.focus();
      return;
    }
    
    const normalized = v.replace(/^0x/i, '');
    if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
      showErrorToast(t('walletModal.privateKeyFormatError'), t('toast.importFailed'));
      input?.focus();
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
export function initAddressModal(): void {
  const openCreateAddrBtn = document.getElementById('openCreateAddrBtn');
  const openImportAddrBtn = document.getElementById('openImportAddrBtn');
  const openHistoryBtn = document.getElementById('openHistoryBtn');
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
  
  if (openHistoryBtn && !openHistoryBtn.dataset._walletBind) {
    openHistoryBtn.onclick = () => {
      if (typeof window.PanguPay?.router?.routeTo === 'function') {
        window.PanguPay.router.routeTo('#/history');
      }
    };
    openHistoryBtn.dataset._walletBind = '1';
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


// ============================================================================
// Transfer Mode Functions
// ============================================================================

/**
 * Refresh wallet snapshot from localStorage
 */
function refreshWalletSnapshot(): Record<string, AddressMetadata> {
  const latest = loadUser();
  walletMap = (latest?.wallet?.addressMsg) || {};
  srcAddrs = Object.keys(walletMap);
  return walletMap;
}

/**
 * Fill change address dropdowns based on selected addresses
 */
function fillChange(): void {
  const addrList = document.getElementById('srcAddrList');
  if (!addrList) return;
  
  const chPGC = document.getElementById('chAddrPGC') as HTMLSelectElement | null;
  const chBTC = document.getElementById('chAddrBTC') as HTMLSelectElement | null;
  const chETH = document.getElementById('chAddrETH') as HTMLSelectElement | null;
  const csPGC = document.getElementById('csChPGC');
  const csBTC = document.getElementById('csChBTC');
  const csETH = document.getElementById('csChETH');
  
  const sel = Array.from(addrList.querySelectorAll('input[type="checkbox"]'))
    .filter((x: Element) => (x as HTMLInputElement).checked)
    .map((x: Element) => (x as HTMLInputElement).value);
  
  // Update label selected state
  Array.from(addrList.querySelectorAll('label')).forEach(l => { 
    const inp = l.querySelector('input[type="checkbox"]') as HTMLInputElement | null; 
    if (inp) l.classList.toggle('selected', inp.checked); 
  });

  // Filter addresses by type
  const getAddrsByType = (typeId: number): string[] => {
    const pool = sel.length ? sel : srcAddrs;
    return pool.filter(addr => {
      const meta = walletMap[addr];
      return meta && Number(meta.type) === typeId;
    });
  };

  const optsPGC = getAddrsByType(0);
  const optsBTC = getAddrsByType(1);
  const optsETH = getAddrsByType(2);

  const buildOptions = (opts: string[]): string => opts.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('');

  if (chPGC) chPGC.innerHTML = buildOptions(optsPGC);
  if (chBTC) chBTC.innerHTML = buildOptions(optsBTC);
  if (chETH) chETH.innerHTML = buildOptions(optsETH);

  const buildMenu = (box: HTMLElement | null, optsArr: string[], hidden: HTMLSelectElement | null): void => {
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

    if (menu) menu.innerHTML = optsArr.map(a => `<div class="custom-select__item" data-val="${escapeHtml(a)}"><code class="break">${escapeHtml(a)}</code></div>`).join('');

    const currentVal = hidden?.value || '';
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
  
  // summary UI is updated by transfer panel code when present
}


/**
 * Rebuild the source address list in transfer panel
 */
export function rebuildAddrList(): void {
  refreshWalletSnapshot();
  const addrList = document.getElementById('srcAddrList');
  if (!addrList) return;
  
  const fragment = document.createDocumentFragment();
  
  srcAddrs.forEach(a => {
    const meta = walletMap[a] || {};
    const tId = Number(meta.type ?? 0);
    const amt = Number(meta.value?.utxoValue || 0);
    
    const coinInfo = getCoinInfo(tId);
    const color = coinInfo.className;
    const coinName = coinInfo.name;
    const coinLetter = coinName.charAt(0);
    const shortAddr = a;
    
    const label = document.createElement('label');
    label.className = `src-addr-item item-type-${color}`;
    label.dataset.addr = a;
    label.innerHTML = `
      <input type="checkbox" name="srcAddr" value="${escapeHtml(a)}">
      <div class="item-backdrop"></div>
      <div class="item-content">
        <div class="item-left">
          <div class="coin-icon coin-icon--${escapeHtml(color)}">${escapeHtml(coinLetter)}</div>
          <div class="addr-info">
            <span class="addr-text" title="${escapeHtml(a)}">${escapeHtml(shortAddr)}</span>
            <span class="coin-name-tiny">${escapeHtml(coinName)}</span>
          </div>
        </div>
        <div class="item-right">
          <span class="amount-num" title="${escapeHtml(String(amt))}">${escapeHtml(String(amt))}</span>
          <div class="check-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
        </div>
      </div>
      <div class="selection-outline"></div>
    `;
    
    fragment.appendChild(label);
  });
  
  addrList.innerHTML = '';
  addrList.appendChild(fragment);
  
  autoSelectFromAddress(addrList);
  
  if (!addrList.dataset._changeBind) {
    globalEventManager.add(addrList, 'change', fillChange);
    addrList.dataset._changeBind = '1';
  }
  
  fillChange();
}

/**
 * Auto-select from address based on balance
 */
function autoSelectFromAddress(addrList: HTMLElement): void {
  const checkboxes = addrList.querySelectorAll('input[type="checkbox"]');
  const labels = addrList.querySelectorAll('label.src-addr-item');
  
  const alreadySelected = Array.from(checkboxes).some(cb => (cb as HTMLInputElement).checked);
  if (alreadySelected) return;
  
  if (srcAddrs.length === 1) {
    const cb = checkboxes[0] as HTMLInputElement;
    const label = labels[0];
    if (cb && label) {
      cb.checked = true;
      label.classList.add('selected');
    }
    return;
  }
  
  const addrsWithBalance = srcAddrs.filter(addr => {
    const meta = walletMap[addr];
    const amt = Number(meta?.value?.utxoValue || 0);
    return amt > 0;
  });
  
  if (addrsWithBalance.length === 1) {
    const targetAddr = addrsWithBalance[0];
    labels.forEach((label, idx) => {
      if ((label as HTMLElement).dataset.addr === targetAddr) {
        const cb = checkboxes[idx] as HTMLInputElement;
        if (cb) {
          cb.checked = true;
          label.classList.add('selected');
        }
      }
    });
  }
}


// ============================================================================
// Transfer Mode Tabs
// ============================================================================

/**
 * Initialize transfer mode tabs (quick/cross/pledge)
 */
export function initTransferModeTabs(): void {
  const modeTabsContainer = document.querySelector('.transfer-mode-tabs') as HTMLElement | null;
  if (!modeTabsContainer || modeTabsContainer.dataset._bind) return;

  const isCompactMode = () => window.matchMedia('(max-width: 860px)').matches;
  
  const ensureDropdown = (): HTMLElement => {
    let dd = modeTabsContainer.querySelector('.mode-dropdown') as HTMLElement | null;
    if (!dd) {
      dd = document.createElement('div');
      dd.className = 'mode-dropdown';
      modeTabsContainer.appendChild(dd);
    }
    return dd;
  };
  
  const rebuildDropdown = (): void => {
    const dd = ensureDropdown();
    const items: string[] = [];
    modeTabsContainer.querySelectorAll('.transfer-mode-tab').forEach(b => {
      if (!b.classList.contains('active')) {
        items.push(`<button class="mode-item" data-mode="${(b as HTMLElement).dataset.mode}">${b.textContent}</button>`);
      }
    });
    dd.innerHTML = items.join('');
  };
  
  const applyMode = (mode: string): void => {
    modeTabsContainer.querySelectorAll('.transfer-mode-tab, .mode-tab').forEach(t => t.classList.remove('active'));
    const btn = modeTabsContainer.querySelector(`.transfer-mode-tab[data-mode="${mode}"]`);
    if (btn) {
      btn.classList.add('active');
      const allTabs = Array.from(modeTabsContainer.querySelectorAll('.transfer-mode-tab'));
      const activeIndex = allTabs.indexOf(btn);
      if (activeIndex !== -1) {
        modeTabsContainer.setAttribute('data-active', String(activeIndex));
      }
    }
    const tfModeSelect = document.getElementById('tfMode') as HTMLSelectElement | null;
    const isPledgeSelect = document.getElementById('isPledge') as HTMLSelectElement | null;
    if (tfModeSelect) tfModeSelect.value = mode;
    if (isPledgeSelect) isPledgeSelect.value = mode === 'pledge' ? 'true' : 'false';
    const radios = document.querySelectorAll('input[name="tfModeChoice"]');
    radios.forEach(r => { (r as HTMLInputElement).checked = (r as HTMLInputElement).value === mode; });
  };
  
  const updateModeTabsLayout = (): void => {
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
  
  globalEventManager.add(modeTabsContainer, 'click', (e: Event) => {
    const tab = (e.target as HTMLElement).closest('.transfer-mode-tab') || (e.target as HTMLElement).closest('.mode-tab');
    if (tab) {
      if (modeTabsContainer.classList.contains('compact') && tab.classList.contains('active')) {
        rebuildDropdown();
        modeTabsContainer.classList.toggle('open');
        return;
      }
      applyMode((tab as HTMLElement).dataset.mode || '');
      return;
    }
    const item = (e.target as HTMLElement).closest('.mode-item');
    if (item) {
      applyMode((item as HTMLElement).dataset.mode || '');
      modeTabsContainer.classList.remove('open');
    }
  });
  
  let layoutTimer: ReturnType<typeof setTimeout>;
  const onResize = () => { clearTimeout(layoutTimer); layoutTimer = setTimeout(updateModeTabsLayout, 50); };
  // Use native addEventListener for window events (globalEventManager expects Element)
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  updateModeTabsLayout();
  
  const activeTab = modeTabsContainer.querySelector('.transfer-mode-tab.active');
  if (activeTab) {
    const allTabs = Array.from(modeTabsContainer.querySelectorAll('.transfer-mode-tab'));
    const activeIndex = allTabs.indexOf(activeTab);
    if (activeIndex !== -1) {
      modeTabsContainer.setAttribute('data-active', String(activeIndex));
    }
  } else {
    modeTabsContainer.setAttribute('data-active', '0');
  }
  
  modeTabsContainer.dataset._bind = '1';
}


// ============================================================================
// Custom Select Functions
// ============================================================================

/**
 * Bind custom select dropdowns
 */
function bindCustomSelect(box: HTMLElement | null, hidden: HTMLSelectElement | null): void {
  if (!box || box.dataset._bind) return;
  
  globalEventManager.add(box, 'click', (e: Event) => { 
    e.stopPropagation(); 
    const sec = box.closest('.tx-section'); 
    const opening = !box.classList.contains('open'); 
    box.classList.toggle('open'); 
    if (sec) sec.classList.toggle('has-open', opening); 
  });
  
  const menu = box.querySelector('.custom-select__menu');
  if (menu) {
    globalEventManager.add(menu, 'click', (ev: Event) => {
      ev.stopPropagation();
      const item = (ev.target as HTMLElement).closest('.custom-select__item');
      if (!item) return;
      const v = item.getAttribute('data-val');
      const valEl = box.querySelector('.addr-val');
      if (valEl) valEl.textContent = v || '';
      if (hidden) hidden.value = v || '';
      box.classList.remove('open'); 
      const sec = box.closest('.tx-section'); 
      if (sec) sec.classList.remove('has-open'); 
      // summary UI is updated by transfer panel code when present
    });
  }
  
  globalEventManager.add(document.body, 'click', () => { 
    box.classList.remove('open'); 
    const sec = box.closest('.tx-section'); 
    if (sec) sec.classList.remove('has-open'); 
  });
  
  box.dataset._bind = '1';
}

/**
 * Initialize custom select dropdowns for change addresses
 */
export function initChangeAddressSelects(): void {
  const chPGC = document.getElementById('chAddrPGC') as HTMLSelectElement | null;
  const chBTC = document.getElementById('chAddrBTC') as HTMLSelectElement | null;
  const chETH = document.getElementById('chAddrETH') as HTMLSelectElement | null;
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
export function initRefreshSrcAddrList(): void {
  // Kept for compatibility with existing call sites; no longer publishes window globals.
  // Use window.PanguPay.wallet.refreshSrcAddrList() instead.
}

/**
 * Refresh source address list & dependent UI (namespace-safe)
 */
export function refreshSrcAddrList(): void {
  try {
    refreshWalletSnapshot();
    rebuildAddrList();
    fillChange();
  } catch (_) { }
}

// Re-export recipient functions
export { initRecipientCards, initAdvancedOptions };
