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
import { saveUser, getJoinedGroup, toAccount, User } from '../utils/storage';
import { store, selectUser, setUser } from '../utils/store.js';
import { readAddressInterest } from '../utils/helpers.js';
import { getActionModalElements } from '../ui/modal';
import { showMiniToast, showErrorToast, showSuccessToast } from '../utils/toast.js';
import { importFromPrivHex } from './account';
import { initRecipientCards, initAdvancedOptions } from './recipient.js';
import { escapeHtml } from '../utils/security';
import { getCoinName, getCoinClass, getCoinInfo } from '../config/constants';
import { DOM_IDS } from '../config/domIds';
import { scheduleBatchUpdate } from '../utils/performanceMode.js';
import { html as viewHtml, renderInto } from '../utils/view';
import { globalEventManager } from '../utils/eventUtils.js';
import { encryptAndSavePrivateKey, hasEncryptedKey } from '../utils/keyEncryptionUI';
import {
  showAddressListSkeleton,
  showSrcAddrSkeleton,
  clearSkeletonState,
  isShowingSkeleton
} from '../utils/walletSkeleton';
import { UTXOData, TxCertificate } from '../types/blockchain';
import { createNewAddressOnBackend, isUserInOrganization } from './address';
import { updateTransferButtonState } from './transfer';
import { getTxHistory, updateTxHistoryByTxId } from './txHistory';
import {
  getLockedUTXOsByAddress,
  getLockedBalanceByAddress,
  isUTXOLocked,
  clearAllLockedUTXOs,
  clearLockedUTXOsByAddress,
  getLockedBalanceSummary,
  getLockedUTXOInfo,
  lockUTXOs
} from '../utils/utxoLock';
import { isTXCerLocked } from './txCerLockManager';

// ============================================================================
// Types
// ============================================================================

interface AddressValue {
  totalValue?: number;
  TotalValue?: number;
  utxoValue?: number;
  txCerValue?: number;
}

/**
 * Address metadata with strict UTXO typing
 * Ensures type safety for blockchain data operations
 */
interface AddressMetadata {
  type?: number;
  value?: AddressValue;
  utxos?: Record<string, UTXOData>;  // Strict UTXO type
  txCers?: Record<string, number>;   // TXCer ID -> value mapping
  estInterest?: number;
  gas?: number;
  origin?: string;
  /** Private key hex for this address (imported addresses) */
  privHex?: string;
  /** Public key X coordinate hex */
  pubXHex?: string;
  /** Public key Y coordinate hex */
  pubYHex?: string;
}

/**
 * Extended Wallet interface with both camelCase and PascalCase fields
 * for backward compatibility with backend API responses
 */
interface ExtendedWallet {
  addressMsg: Record<string, AddressMetadata>;
  totalTXCers?: Record<string, TxCertificate>;  // TXCer ID -> full TXCer object
  totalValue?: number;
  TotalValue?: number;
  valueDivision?: Record<number, number>;
  ValueDivision?: Record<number, number>;
  updateTime?: number;
  updateBlock?: number;
  history?: Array<{ t: number; v: number }>;
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

/**
 * Pending import data for preview modal
 */
interface PendingImportData {
  privHex: string;
  address: string;
  pubXHex: string;
  pubYHex: string;
  coinType: number;
}

let __pendingImport: PendingImportData | null = null;

function getCurrentUser(): User | null {
  return (selectUser(store.getState()) as User | null) || null;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

// ============================================================================
// Binding Reset Function (DEPRECATED)
// ============================================================================

/**
 * @deprecated This function is no longer needed after migrating to event delegation.
 * All dynamic element events are now handled via data-action attributes and the
 * global event delegation system in js/core/eventDelegate.ts.
 * 
 * Kept for backward compatibility - will be removed in future versions.
 */
export function resetWalletBindings(): void {
  // Reset binding flags so events can be re-bound when returning to main page
  // This is necessary because cleanupPageListeners() removes the event handlers
  // but the dataset flags remain, preventing re-binding

  // Reset transfer mode tabs binding
  const modeTabsContainer = document.querySelector('.transfer-mode-tabs') as HTMLElement | null;
  if (modeTabsContainer) {
    delete modeTabsContainer.dataset._bind;
  }

  // Reset custom select bindings
  document.querySelectorAll('.custom-select').forEach((el) => {
    delete (el as HTMLElement).dataset._bind;
  });

  // Reset source address list change binding
  const srcAddrList = document.getElementById(DOM_IDS.srcAddrList) as HTMLElement | null;
  if (srcAddrList) {
    delete srcAddrList.dataset._changeBind;
  }

  // Reset wallet button bindings
  const walletButtons = [
    DOM_IDS.openCreateAddrBtn,
    DOM_IDS.openImportAddrBtn,
    DOM_IDS.openHistoryBtn,
    DOM_IDS.refreshWalletBtn,
    DOM_IDS.addrCancelBtn,
    DOM_IDS.addrOkBtn
  ];
  walletButtons.forEach((id) => {
    const el = document.getElementById(id) as HTMLElement | null;
    if (el) {
      delete el.dataset._walletBind;
    }
  });

  // Reset transfer submit button binding
  const tfSendBtn = document.getElementById(DOM_IDS.tfSendBtn) as HTMLElement | null;
  if (tfSendBtn) {
    const handler = (tfSendBtn as any)._transferSubmitHandler as ((event?: Event) => void) | undefined;
    if (handler) {
      tfSendBtn.removeEventListener('click', handler);
      delete (tfSendBtn as any)._transferSubmitHandler;
    } else if (tfSendBtn.dataset._bind) {
      const cloned = tfSendBtn.cloneNode(true) as HTMLElement;
      delete cloned.dataset._bind;
      tfSendBtn.replaceWith(cloned);
    }
    delete tfSendBtn.dataset._bind;
  }

  // Reset recipient list binding
  const billList = document.getElementById(DOM_IDS.billList) as HTMLElement | null;
  if (billList) {
    delete billList.dataset._recipientBind;
  }
}

// ============================================================================
// Wallet Brief Functions
// ============================================================================

/**
 * Update wallet brief display (count and list)
 */
export function updateWalletBrief(): void {
  const u = getCurrentUser();
  const countEl = document.getElementById(DOM_IDS.walletCount);
  const brief = document.getElementById(DOM_IDS.walletBriefList);
  const tip = document.getElementById(DOM_IDS.walletEmptyTip);
  const addrs = u?.wallet ? Object.keys(u.wallet.addressMsg || {}) : [];

  if (countEl) {
    countEl.textContent = String(addrs.length);
  }

  if (brief) {
    if (addrs.length === 0) {
      brief.replaceChildren();
      if (tip) tip.classList.remove('hidden');
    } else {
      if (tip) tip.classList.add('hidden');
      brief.replaceChildren();
      addrs.slice(0, 3).forEach(addr => {
        const meta = (u?.wallet?.addressMsg?.[addr] || {}) as AddressMetadata;
        const typeId = Number(meta.type || 0);
        const coinType = getCoinName(typeId);
        const shortAddr = addr.length > 12 ? addr.slice(0, 6) + '...' + addr.slice(-4) : addr;

        const item = document.createElement('div');
        item.className = 'wallet-brief-item';
        const addrEl = document.createElement('span');
        addrEl.className = 'wallet-brief-addr';
        addrEl.textContent = shortAddr;
        const coinEl = document.createElement('span');
        coinEl.className = 'wallet-brief-coin';
        coinEl.textContent = coinType;
        item.appendChild(addrEl);
        item.appendChild(coinEl);
        brief.appendChild(item);
      });
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
  const woCard = document.getElementById(DOM_IDS.woCard);
  const woEmpty = document.getElementById(DOM_IDS.woEmpty);
  const woExit = document.getElementById(DOM_IDS.woExitBtn);
  const joinBtn = document.getElementById(DOM_IDS.woJoinBtn);
  const u = getCurrentUser();
  const hasJoined = !!(u?.orgNumber || u?.guarGroup?.groupID);
  const g = hasJoined ? getJoinedGroup() : null;
  const joined = hasJoined;

  if (woCard) woCard.classList.toggle('hidden', !joined);
  if (woExit) woExit.classList.toggle('hidden', !joined);
  if (woEmpty) woEmpty.classList.toggle('hidden', joined);
  if (joinBtn) joinBtn.classList.toggle('hidden', joined);

  const tfMode = document.getElementById(DOM_IDS.tfMode) as HTMLSelectElement | null;
  const tfModeQuick = document.getElementById(DOM_IDS.tfModeQuick) as HTMLInputElement | null;
  const tfModeCross = document.getElementById(DOM_IDS.tfModeCross) as HTMLInputElement | null;
  const tfModePledge = document.getElementById(DOM_IDS.tfModePledge) as HTMLInputElement | null;
  const isPledgeSel = document.getElementById(DOM_IDS.isPledge) as HTMLSelectElement | null;
  const hasOrg = joined;

  // Update transfer mode tabs UI
  const modeTabsContainer = document.getElementById(DOM_IDS.transferModeTabs);

  if (modeTabsContainer) {
    if (hasOrg) {
      modeTabsContainer.classList.remove('no-org-mode');
    } else {
      modeTabsContainer.classList.add('no-org-mode');
      modeTabsContainer.classList.remove('open');
      const dd = modeTabsContainer.querySelector('.mode-dropdown');
      if (dd) dd.remove();
    }
  }

  const noOrgWarning = document.getElementById('noOrgWarning');
  if (noOrgWarning) {
    noOrgWarning.classList.toggle('hidden', hasOrg);
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
      [DOM_IDS.woGroupID, joined && g ? g.groupID : ''],
      [DOM_IDS.woAggre, joined && g ? (g.aggreNode || '') : ''],
      [DOM_IDS.woAssign, joined && g ? (g.assignNode || '') : ''],
      [DOM_IDS.woPledge, joined && g ? (g.pledgeAddress || '') : '']
    ];

    orgFields.forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    });
  }

  // Update transfer button state based on organization membership
  updateTransferButtonState();
}

// ============================================================================
// Wallet Rendering Functions
// ============================================================================

/**
 * Render wallet address list
 * 
 * Uses event delegation via data-action attributes for all interactive elements.
 * No manual event binding needed - the global event delegate handles everything.
 */
export function renderWallet(): void {
  const u = getCurrentUser();
  const aid = document.getElementById(DOM_IDS.walletAccountId);
  const org = document.getElementById(DOM_IDS.walletOrg);
  const addr = document.getElementById(DOM_IDS.walletMainAddr);
  const priv = document.getElementById(DOM_IDS.walletPrivHex);
  const px = document.getElementById(DOM_IDS.walletPubX);
  const py = document.getElementById(DOM_IDS.walletPubY);

  if (!u) return;

  if (aid) aid.textContent = u.accountId || '';
  if (org) org.textContent = u.orgNumber || t('header.noOrg');
  if (addr) addr.textContent = u.address || '';
  if (priv) priv.textContent = u.privHex || '';
  if (px) px.textContent = u.pubXHex || '';
  if (py) py.textContent = u.pubYHex || '';

  const list = document.getElementById(DOM_IDS.walletAddrList);
  if (!list) return;

  // Preserve expanded state across re-renders (e.g., when TXCer arrives)
  const expandedBeforeRender = getExpandedAddresses();

  const addresses = Object.keys((u.wallet?.addressMsg) || {});

  // 更新地址数量显示
  const addrCountEl = document.getElementById(DOM_IDS.addrCount);
  if (addrCountEl) {
    addrCountEl.textContent = t('wallet.addressCount', { count: addresses.length }) || `${addresses.length} 个地址`;
  }

  // Use DocumentFragment for better performance
  const fragment = document.createDocumentFragment();

  addresses.forEach((a) => {
    const item = document.createElement('div');
    item.className = 'addr-card';
    item.dataset.addr = a; // Store address on card for event delegation
    const meta = u.wallet?.addressMsg?.[a] || null;

    const typeId0 = Number(meta?.type ?? 0);
    const amtCash0 = Number(meta?.value?.utxoValue || 0);
    const gas0 = readAddressInterest(meta);

    // Debug: Log gas values for comparison with transfer.ts
    console.debug('[Wallet] renderWallet - address gas values:', {
      addr: a.slice(0, 10) + '...',
      EstInterest: (meta as any)?.EstInterest,
      estInterest: (meta as any)?.estInterest,
      gas: (meta as any)?.gas,
      computed: gas0
    });
    const coinType = getCoinName(typeId0);
    const coinClass = getCoinClass(typeId0);
    const shortAddr = a.length > 18 ? a.slice(0, 10) + '...' + a.slice(-6) : a;

    // 获取锁定 UTXO 信息
    const lockedUtxos = getLockedUTXOsByAddress(a);
    const lockedBalance = getLockedBalanceByAddress(a);
    const hasLockedUtxos = lockedUtxos.length > 0;
    const unlockedUtxoBalance = Math.max(0, amtCash0 - lockedBalance);

    // 获取 TXCer 信息（仅主货币地址有 TXCer）
    const txCers = meta?.txCers || {};
    const txCerIds = Object.keys(txCers);
    const hasTXCers = txCerIds.length > 0;
    const txCerBalance = Object.values(txCers).reduce((sum, val) => sum + (val as number), 0);
    const txCerCount = txCerIds.length;

    // 锁定中的 TXCer 不应计入“可用余额”（pending 交易占用）
    const lockedTxCerBalance = txCerIds.reduce((sum, id) => {
      if (!isTXCerLocked(id)) return sum;
      return sum + (Number((txCers as any)[id]) || 0);
    }, 0);
    const unlockedTxCerBalance = Math.max(0, txCerBalance - lockedTxCerBalance);

    // 总余额 = 所有 UTXO（包括锁定） + TXCer（包括锁定）
    const totalBalance = amtCash0 + txCerBalance;
    // 可用余额 = 未锁定 UTXO + 未锁定 TXCer
    const availableBalance = unlockedUtxoBalance + unlockedTxCerBalance;

    // 如果有锁定的 UTXO，添加标记类
    if (hasLockedUtxos) {
      item.classList.add('has-locked-utxos');
    }

    // 如果有 TXCer，添加标记类
    if (hasTXCers) {
      item.classList.add('has-txcers');
    }

    // 锁定图标 SVG
    const lockIconSvg = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;

    // Use lit-html for safe and efficient rendering
    const template = viewHtml`
      <div class="addr-card-summary" data-action="toggleAddrCard" data-addr="${a}">
        <div class="addr-card-avatar coin--${coinClass}">${coinType}</div>
        <div class="addr-card-main">
          <span class="addr-card-hash" title="${a}">${shortAddr}</span>
          <span class="addr-card-balance">
            ${String(availableBalance)} ${coinType}
            ${hasLockedUtxos ? viewHtml`
              <span class="utxo-locked-indicator" title="${t('wallet.utxoLockedTooltip')}">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <span class="utxo-locked-tooltip">${t('wallet.lockedUtxoCount', { count: lockedUtxos.length })}</span>
              </span>
            ` : ''}
            ${hasTXCers ? viewHtml`
              <span class="txcer-indicator" title="${t('wallet.txCerTooltip') || 'TXCer 待转换'}">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <span class="txcer-tooltip">TXCer: ${txCerCount}个 可用${unlockedTxCerBalance.toFixed(2)} / 总${txCerBalance.toFixed(2)}</span>
              </span>
            ` : ''}
          </span>
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
          <div class="balance-breakdown">
            <div class="balance-row">
              <span class="balance-label">${t('wallet.totalBalance')}</span>
              <span class="balance-value">${String(totalBalance)} ${coinType}</span>
            </div>
            <div class="balance-row available">
              <span class="balance-label">${t('wallet.availableBalance')}</span>
              <span class="balance-value">${String(availableBalance)} ${coinType}</span>
            </div>
            ${amtCash0 > 0 ? viewHtml`
              <div class="balance-row utxo">
                <span class="balance-label">UTXO 余额</span>
                <span class="balance-value">${String(amtCash0)} ${coinType}</span>
              </div>
            ` : ''}
            ${hasLockedUtxos ? viewHtml`
              <div class="balance-row locked">
                <span class="balance-label">
                  <svg class="lock-icon" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                  ${t('wallet.lockedBalance')}
                </span>
                <span class="balance-value">${String(lockedBalance)} ${coinType}</span>
              </div>
            ` : ''}
            ${hasTXCers ? viewHtml`
              <div class="balance-row txcer">
                <span class="balance-label">
                  <svg class="txcer-icon" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  TXCer 余额
                </span>
                <span class="balance-value">${String(txCerBalance)} ${coinType}</span>
              </div>
            ` : ''}
            ${hasTXCers && lockedTxCerBalance > 0 ? viewHtml`
              <div class="balance-row locked">
                <span class="balance-label">
                  <svg class="lock-icon" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                  TXCer 锁定
                </span>
                <span class="balance-value">${String(lockedTxCerBalance)} ${coinType}</span>
              </div>
            ` : ''}
          </div>
          <div class="addr-detail-row">
            <span class="addr-detail-label">GAS</span>
            <span class="addr-detail-value gas">${String(gas0)}</span>
          </div>
          ${hasTXCers ? viewHtml`
            <div class="txcer-breakdown">
              <div class="txcer-header">
                <span class="txcer-header-label">
                  <svg class="txcer-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  TXCer（待转换）
                </span>
                <span class="txcer-header-value">${txCerCount}个 / ${txCerBalance.toFixed(4)} ${coinType}</span>
              </div>
              <div class="txcer-list">
                ${txCerIds.map(id => {
      const value = txCers[id] as number;
      const locked = isTXCerLocked(id);
      return viewHtml`
                    <div class="txcer-item">
                      <span class="txcer-id" title="${id}">${id.slice(0, 8)}...${id.slice(-6)}</span>
                      <span class="txcer-value">${value.toFixed(4)}${locked ? ' (锁定)' : ''}</span>
                    </div>
                  `;
    })}
              </div>
            </div>
          ` : ''}
          <div class="addr-card-actions">
            <button class="addr-action-btn addr-action-btn--primary btn-add" data-action="addToAddress" data-addr="${a}" title="${t('address.add')}">
              <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              ${t('address.add')}
            </button>
            <button class="addr-action-btn addr-action-btn--secondary btn-zero" data-action="zeroAddress" data-addr="${a}" title="${t('address.clear')}">
              <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              ${t('address.clear')}
            </button>
            <div class="addr-ops-container"></div>
          </div>
        </div>
      </div>
    `;

    renderInto(item, template);

    // Add operations menu (also uses event delegation)
    const metaEl = item.querySelector('.addr-ops-container');
    if (metaEl) {
      addAddressOperationsMenu(metaEl as HTMLElement, a);
    }

    // Append to fragment instead of directly to DOM
    fragment.appendChild(item);
  });

  // 清除骨架屏状态
  clearSkeletonState(list);

  // Single DOM update
  list.replaceChildren();
  list.appendChild(fragment);

  // Restore expanded state after re-render
  restoreExpandedAddresses(expandedBeforeRender);

  // Update wallet chart after rendering
  try { window.PanguPay?.charts?.updateWalletChart?.(u); } catch (_) { }
}


// ============================================================================
// Address Operations Menu
// ============================================================================

/**
 * Add operations menu to address card
 * Uses event delegation via data-action attributes - no manual event binding needed.
 */
function addAddressOperationsMenu(container: HTMLElement, address: string): void {
  const ops = document.createElement('div');
  ops.className = 'addr-ops';
  ops.dataset.addr = address;

  // Use innerHTML with data-action for event delegation
  ops.innerHTML = `
    <button class="ops-toggle" data-action="toggleOpsMenu" data-addr="${escapeHtml(address)}">
      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
        <circle cx="12" cy="12" r="1"></circle>
        <circle cx="12" cy="5" r="1"></circle>
        <circle cx="12" cy="19" r="1"></circle>
      </svg>
    </button>
    <div class="ops-menu hidden">
      <button class="ops-item" data-action="exportPrivateKey" data-addr="${escapeHtml(address)}">${escapeHtml(t('wallet.exportPrivateKey'))}</button>
      <button class="ops-item danger" data-action="deleteAddress" data-addr="${escapeHtml(address)}">${escapeHtml(t('wallet.deleteAddress'))}</button>
    </div>
  `;

  container.appendChild(ops);
}


// ============================================================================
// Address Delete & Export Functions
// ============================================================================

/**
 * Handle address deletion
 * Exported for use by event delegation system
 * 
 * If user is in a guarantor organization, this will:
 * 1. Show confirmation modal
 * 2. Call backend unbind-address API
 * 3. Only delete locally if backend succeeds
 * 
 * If user is NOT in an organization, it will just delete locally.
 */
export function handleDeleteAddress(address: string): void {
  const modal = document.getElementById(DOM_IDS.confirmDelModal);
  const okBtn = document.getElementById(DOM_IDS.confirmDelOk);
  const cancelBtn = document.getElementById(DOM_IDS.confirmDelCancel);
  const textEl = document.getElementById(DOM_IDS.confirmDelText);

  // Close any open ops menus
  closeAllOpsMenus();

  // Check if address has balance
  const current = getCurrentUser();
  const key = String(address).toLowerCase();
  const addrData = current?.wallet?.addressMsg?.[address] ||
    current?.wallet?.addressMsg?.[key] ||
    Object.entries(current?.wallet?.addressMsg || {}).find(
      ([k]) => String(k).toLowerCase() === key
    )?.[1];
  const balance = addrData?.value?.TotalValue ?? 0;
  const coinType = addrData?.type === 1 ? 'BTC' : addrData?.type === 2 ? 'ETH' : 'PGC';

  // Build confirmation text with balance warning if needed
  let confirmText = `${t('address.confirmDelete')} ${address} ${t('address.confirmDeleteDesc')}`;
  if (balance > 0) {
    confirmText = `⚠️ 该地址仍有 ${balance} ${coinType} 余额，删除后将无法直接访问这些资产！\n\n${confirmText}`;
  }
  if (textEl) textEl.textContent = confirmText;
  if (modal) modal.classList.remove('hidden');

  const doDel = async () => {
    if (modal) modal.classList.add('hidden');
    const current = getCurrentUser();
    if (!current) return;

    const key = String(address).toLowerCase();

    // Get address metadata for backend API
    const addressData = current.wallet?.addressMsg?.[address] ||
      current.wallet?.addressMsg?.[key] ||
      Object.entries(current.wallet?.addressMsg || {}).find(
        ([k]) => String(k).toLowerCase() === key
      )?.[1];

    // Check if user is in a guarantor organization
    const group = getJoinedGroup();
    const isInOrg = !!(group && group.groupID);

    if (isInOrg && addressData) {
      // User is in organization - need to call backend API first
      const pubXHex = addressData.pubXHex;
      const pubYHex = addressData.pubYHex;
      const addressType = Number(addressData.type || 0);

      if (!pubXHex || !pubYHex) {
        // No public key info - show error
        const { modal: am, titleEl: at, textEl: ax, okEl: ok1 } = getActionModalElements();
        if (at) at.textContent = t('wallet.deleteFailed', '删除失败');
        if (ax) {
          ax.classList.add('tip--error');
          ax.textContent = t('error.addressPublicKeyMissing', '地址公钥信息缺失，无法解绑');
        }
        if (am) am.classList.remove('hidden');
        const h2 = () => { am?.classList.add('hidden'); ok1?.removeEventListener('click', h2); };
        ok1?.addEventListener('click', h2);
        return;
      }

      // Show loading animation
      const { showUnifiedLoading, hideUnifiedOverlay, showUnifiedError } = await import('../ui/modal.js');
      showUnifiedLoading(t('address.unbinding', '正在解绑地址...'));

      try {
        // Call backend unbind API
        const { unbindAddressOnBackend } = await import('./address');
        const result = await unbindAddressOnBackend(address, pubXHex, pubYHex, addressType);

        hideUnifiedOverlay();

        if (!result.success) {
          // Type narrowing: result is now { success: false; error: string }
          const errorMsg = 'error' in result ? result.error : t('error.unknownError', '未知错误');

          // Check if user cancelled password input
          if (errorMsg === 'USER_CANCELLED') {
            console.info('[Wallet] User cancelled password input for unbind');
            showMiniToast(t('common.operationCancelled') || '操作已取消', 'info');
            return;
          }

          // Backend failed - show error toast, don't delete locally
          showErrorToast(`${t('wallet.deleteFailed', 'Delete Failed')}: ${errorMsg}`);
          return;
        }

        // Backend succeeded - proceed with local deletion
        console.info('[Wallet] ✓ Address unbound on backend, proceeding with local deletion');

      } catch (error) {
        hideUnifiedOverlay();
        console.error('[Wallet] ✗ Unbind address error:', error);
        const errMsg = error instanceof Error ? error.message : t('error.unknownError', 'Unknown error');
        showErrorToast(`${t('wallet.deleteFailed', 'Delete Failed')}: ${errMsg}`);
        return;
      }
    }

    // Proceed with local deletion (either not in org, or backend succeeded)
    const u = deepClone(current);
    const isMain = (u.address && u.address.toLowerCase() === key);

    if (u.wallet?.addressMsg) {
      u.wallet.addressMsg = Object.fromEntries(
        Object.entries(u.wallet.addressMsg).filter(([k]) => String(k).toLowerCase() !== key)
      );
    }

    if (isMain) {
      u.address = '';
    }

    // Single Source of Truth: Update Store, let subscriptions handle UI updates
    setUser(u);
    saveUser(u);

    // Address deletion requires full re-render since DOM structure changes
    // This is an exception where we call renderWallet directly because:
    // 1. We're removing elements from DOM, not just updating values
    // 2. Store subscription can't know which specific card to remove
    renderWallet();

    // Show success toast (supports dark mode automatically via CSS)
    showSuccessToast(
      t('wallet.deleteSuccessDesc', '已删除该地址及其相关本地数据'),
      t('wallet.deleteSuccess', '删除成功')
    );
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
 * Close all open operations menus
 * Used when clicking outside or performing an action
 */
export function closeAllOpsMenus(): void {
  document.querySelectorAll('.ops-menu').forEach(menu => {
    menu.classList.add('hidden');
  });
}

/**
 * Toggle operations menu for a specific address
 * Exported for use by event delegation system
 */
export function toggleOpsMenu(address: string, element: HTMLElement): void {
  // Find the menu within the same ops container
  const opsContainer = element.closest('.addr-ops');
  const menu = opsContainer?.querySelector('.ops-menu');

  if (!menu) return;

  // Close all other menus first
  document.querySelectorAll('.ops-menu').forEach(m => {
    if (m !== menu) m.classList.add('hidden');
  });

  // Toggle this menu
  menu.classList.toggle('hidden');
}

/**
 * Toggle address card expand/collapse
 * Exported for use by event delegation system
 */
export function toggleAddrCard(address: string, element: HTMLElement): void {
  const card = element.closest('.addr-card');
  if (card) {
    card.classList.toggle('expanded');
  }
}

/**
 * Handle private key export
 * Exported for use by event delegation system
 */
export function handleExportPrivateKey(address: string): void {
  const u = getCurrentUser();
  const key = String(address).toLowerCase();
  let priv = '';

  // Close any open ops menus
  closeAllOpsMenus();

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

    // AddressMetadata interface includes privHex field
    if (found && found.privHex) {
      priv = found.privHex;
    } else if (u.address && String(u.address).toLowerCase() === key) {
      priv = (u.keys?.privHex) || u.privHex || '';
    }
  }

  const { modal, titleEl: title, textEl: text, okEl: ok } = getActionModalElements();

  const keyRow = document.getElementById(DOM_IDS.successKeyRow);
  const keyCode = document.getElementById(DOM_IDS.successKeyCode);
  const copyBtn = document.getElementById(DOM_IDS.successCopyBtn);

  if (priv) {
    if (title) title.textContent = t('wallet.exportPrivateKey');
    // 隐藏普通文本，显示私钥行
    if (text) {
      text.classList.add('hidden');
      text.classList.remove('tip--error');
    }

    // 显示私钥行
    if (keyRow) keyRow.classList.remove('hidden');
    if (keyCode) keyCode.textContent = priv;

    if (copyBtn) {
      copyBtn.classList.remove('copied');

      copyBtn.onclick = () => {
        navigator.clipboard.writeText(priv).then(() => {
          copyBtn.classList.add('copied');
          setTimeout(() => {
            copyBtn.classList.remove('copied');
          }, 2000);
        }).catch(() => {
          const textarea = document.createElement('textarea');
          textarea.value = priv;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
          copyBtn.classList.add('copied');
          setTimeout(() => {
            copyBtn.classList.remove('copied');
          }, 2000);
        });
      };
    }
  } else {
    if (title) title.textContent = t('wallet.exportFailed');
    if (text) {
      text.classList.remove('hidden');
      text.classList.add('tip--error');
      text.textContent = t('wallet.noPrivateKey');
    }
    if (keyRow) keyRow.classList.add('hidden');
  }

  if (modal) modal.classList.remove('hidden');

  const handler = () => {
    modal?.classList.add('hidden');
    ok?.removeEventListener('click', handler);
    // 重置状态
    if (keyRow) keyRow.classList.add('hidden');
    if (text) text.classList.remove('hidden');
    if (copyBtn) {
      copyBtn.classList.remove('copied');
      copyBtn.onclick = null;
    }
  };
  ok?.addEventListener('click', handler);
}

/**
 * Update total GAS badge display
 * Exported for store subscription in bootstrap.ts
 */
export function updateTotalGasBadge(u: User | null): void {
  const gasBadge = document.getElementById(DOM_IDS.walletGAS);
  if (gasBadge && u?.wallet) {
    const sumGas = Object.keys(u.wallet.addressMsg || {}).reduce((s, k) => {
      const m = u.wallet.addressMsg[k];
      return s + readAddressInterest(m);
    }, 0);
    const amt = document.createElement('span');
    amt.className = 'amt';
    amt.textContent = sumGas.toLocaleString();
    const unit = document.createElement('span');
    unit.className = 'unit';
    unit.textContent = 'GAS';
    gasBadge.replaceChildren(amt, unit);
  }
}

// Register UI update functions globally for store subscription access
if (typeof window !== 'undefined') {
  (window as any).__updateCurrencyDisplay = updateCurrencyDisplay;
  (window as any).__updateTotalGasBadge = updateTotalGasBadge;
}


// ============================================================================
// Balance Operations
// ============================================================================

/**
 * 生成随机十六进制字符串
 */
function generateRandomHex(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 生成模拟的 ECDSA 签名 (用于测试数据)
 */
function generateMockSignature(): { R: string; S: string } {
  // 生成64位十六进制的 R 和 S 值 (模拟256位大整数)
  return {
    R: generateRandomHex(32),
    S: generateRandomHex(32)
  };
}

/**
 * 获取当前展开的地址卡片列表
 */
function getExpandedAddresses(): string[] {
  const expandedCards = document.querySelectorAll('.addr-card.expanded');
  return Array.from(expandedCards).map(card => (card as HTMLElement).dataset.addr || '').filter(Boolean);
}

/**
 * 恢复地址卡片的展开状态
 */
function restoreExpandedAddresses(addresses: string[]): void {
  if (!addresses.length) return;

  const addrSet = new Set(addresses.map(a => a.toLowerCase()));
  const cards = document.querySelectorAll('.addr-card');

  cards.forEach(card => {
    const addr = (card as HTMLElement).dataset.addr?.toLowerCase();
    if (addr && addrSet.has(addr)) {
      card.classList.add('expanded');
    }
  });
}

/**
 * Handle add balance to address
 * 创建逼真的测试 UTXO 数据，包含完整的交易结构
 * 
 * 【测试模式】新增的 UTXO 会被自动锁定，用于测试锁定 UI
 */
export function handleAddToAddress(address: string): void {
  const current = getCurrentUser();
  if (!current?.wallet?.addressMsg) return;
  const u = deepClone(current);

  const key = String(address).toLowerCase();
  const found = u.wallet.addressMsg[address] || u.wallet.addressMsg[key];
  if (!found) return;

  const typeId = Number(found.type ?? 0);
  const inc = typeId === 1 ? 1 : (typeId === 2 ? 5 : 10);

  // Ensure structures exist
  found.value = found.value || { totalValue: 0, utxoValue: 0, txCerValue: 0 };
  found.utxos = found.utxos || {};

  // 获取地址公钥用于构造 TXOutput
  const pubXHex = found.pubXHex || '';
  const pubYHex = found.pubYHex || '';
  const guarGroupID = u.orgNumber || u.guarGroup?.groupID || '';

  // 生成逼真的交易数据
  const txid = generateRandomHex(8); // 16字符的TXID
  const prevTxid = generateRandomHex(8); // 模拟前置交易ID

  // 模拟逼真的区块位置 (随机生成合理范围内的值)
  const blockNum = Math.floor(Math.random() * 10000) + 1000; // 区块号 1000-11000
  const indexX = Math.floor(Math.random() * 50); // 担保交易序号 0-49
  const indexY = Math.floor(Math.random() * 10); // 内部序号 0-9

  // 模拟时间戳 (最近7天内的随机时间)
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const randomTime = Math.floor(Math.random() * (now - sevenDaysAgo)) + sevenDaysAgo;

  // 构造逼真的 TXOutput
  const txOutput = {
    ToAddress: key,
    ToValue: inc,
    ToGuarGroupID: guarGroupID,
    ToPublicKey: {
      Curve: 'P256',
      X: pubXHex ? BigInt('0x' + pubXHex).toString() : '0',
      Y: pubYHex ? BigInt('0x' + pubYHex).toString() : '0',
      XHex: pubXHex,
      YHex: pubYHex
    },
    ToInterest: Math.random() * 0.5, // 随机小额利息
    Type: typeId,
    ToCoinType: typeId,
    ToPeerID: '',
    IsPayForGas: false,
    IsGuarMake: false,
    IsCrossChain: false
  };

  // 构造逼真的 TXInputNormal (模拟这笔 UTXO 的来源)
  const mockInput = {
    FromTXID: prevTxid,
    FromTxPosition: {
      Blocknum: blockNum - Math.floor(Math.random() * 100) - 1,
      IndexX: Math.floor(Math.random() * 30),
      IndexY: Math.floor(Math.random() * 5),
      IndexZ: 0
    },
    FromAddress: generateRandomHex(20), // 模拟来源地址
    IsGuarMake: false,
    IsCommitteeMake: false,
    IsCrossChain: false,
    InputSignature: generateMockSignature(),
    TXOutputHash: generateRandomHex(32) // 32字节哈希
  };

  // 构造完整的 UTXOData
  const utxoKey = `${txid}_0`;
  const utxoData: UTXOData = {
    UTXO: {
      TXID: txid,
      TXType: 0,
      TXInputsNormal: [mockInput],
      TXInputsCertificate: [],
      TXOutputs: [txOutput],
      InterestAssign: {
        Gas: 0.1, // 模拟Gas费
        Output: 0,
        BackAssign: { [key]: 1.0 } // 利息回退给当前地址
      },
      ExTXCerID: [],
      Data: []
    },
    TXID: txid, // 兼容旧字段
    Value: inc,
    Type: typeId,
    Time: randomTime,
    Position: {
      Blocknum: blockNum,
      IndexX: indexX,
      IndexY: indexY,
      IndexZ: 0
    },
    IsTXCerUTXO: false,
    TXOutputHash: generateRandomHex(32) // 输出哈希
  };

  // Add to UTXOs (no type assertion needed)
  found.utxos![utxoKey] = utxoData;

  // 【测试模式】锁定新增的 UTXO，用于测试锁定 UI
  lockUTXOs([{
    utxoId: utxoKey,
    address: key,
    value: inc,
    type: typeId
  }], `test_tx_${txid}`);
  console.info('[测试] 已锁定新增的 UTXO:', utxoKey);

  // Update Balance with type-safe reduction
  const newUtxoVal = Object.values(found.utxos!).reduce((sum, utxo) => sum + utxo.Value, 0);
  found.value.utxoValue = newUtxoVal;
  found.value.totalValue = newUtxoVal + Number(found.value.txCerValue || 0);
  found.estInterest = Number(found.estInterest || 0) + 10;
  found.gas = Number(found.estInterest || 0);

  // Recalculate Wallet ValueDivision
  recalculateWalletValue(u);

  // Single Source of Truth: Only update Store, let subscriptions handle all UI updates
  setUser(u);

  // Legacy persistence for backward compatibility (Store persistence will also run)
  saveUser(u);

  // 保存展开状态，重新渲染后恢复
  const expandedAddrs = getExpandedAddresses();
  renderWallet();
  restoreExpandedAddresses(expandedAddrs);

  // Show toast notification (not a state-driven UI element)
  const coinType = getCoinName(typeId);
  showMiniToast(`+${inc} ${coinType} (已锁定)`, 'success');

  // All other UI updates (currency display, address cards, charts, etc.) 
  // are handled by store.subscribe() in bootstrap.ts
}


/**
 * Handle clear address balance
 */
export function handleZeroAddress(address: string): void {
  const current = getCurrentUser();
  if (!current?.wallet?.addressMsg) return;
  const u = deepClone(current);

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

  // 清除该地址的锁定 UTXO
  clearLockedUTXOsByAddress(key);

  // Recalculate ValueDivision
  recalculateWalletValue(u);

  // Single Source of Truth: Only update Store, let subscriptions handle all UI updates
  setUser(u);

  // Legacy persistence for backward compatibility
  saveUser(u);

  // 保存展开状态，重新渲染后恢复
  const expandedAddrs = getExpandedAddresses();
  renderWallet();
  restoreExpandedAddresses(expandedAddrs);

  // Show toast notification (not a state-driven UI element)
  showMiniToast(t('address.clear'), 'info');

  // All other UI updates (currency display, address cards, charts, etc.) 
  // are handled by store.subscribe() in bootstrap.ts
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
  // Also set PascalCase version for backward compatibility with backend API
  const extWallet = u.wallet as ExtendedWallet;
  extWallet.ValueDivision = sumVD;

  const pgcTotal = Number(sumVD[0] || 0);
  const btcTotal = Number(sumVD[1] || 0);
  const ethTotal = Number(sumVD[2] || 0);
  const valueTotalPGC = pgcTotal + btcTotal * 1000000 + ethTotal * 1000;
  u.wallet.totalValue = valueTotalPGC;
  // Also set PascalCase version for backward compatibility
  extWallet.TotalValue = valueTotalPGC;
}


/**
 * Update currency breakdown display (PGC/BTC/ETH badges)
 * Exported for store subscription in bootstrap.ts
 */
export function updateCurrencyDisplay(u: User): void {
  const walletPGCEl = document.getElementById(DOM_IDS.walletPGC);
  const walletBTCEl = document.getElementById(DOM_IDS.walletBTC);
  const walletETHEl = document.getElementById(DOM_IDS.walletETH);
  const vdUpdated = u.wallet?.valueDivision || { 0: 0, 1: 0, 2: 0 };

  if (walletPGCEl) walletPGCEl.textContent = Number(vdUpdated[0] || 0).toLocaleString();
  if (walletBTCEl) walletBTCEl.textContent = Number(vdUpdated[1] || 0).toLocaleString();
  if (walletETHEl) walletETHEl.textContent = Number(vdUpdated[2] || 0).toLocaleString();

  // Update USDT display
  updateUSDTDisplay(u);
}

/**
 * Update a specific address card display without re-rendering entire wallet
 * 直接更新 DOM，不使用 scheduleBatchUpdate 以避免延迟导致的状态问题
 */
function updateAddressCardDisplay(address: string, found: AddressMetadata): void {
  const key = String(address).toLowerCase();
  const typeId = Number(found.type ?? 0);
  const coinType = getCoinName(typeId);
  const utxoBalance = Number(found.value?.utxoValue || 0);
  const lockedBalance = getLockedBalanceByAddress(address);
  const unlockedUtxoBalance = Math.max(0, utxoBalance - lockedBalance);
  const txCers = found.txCers || {};
  const txCerIds = Object.keys(txCers);
  const txCerBalance = Object.values(txCers).reduce((sum: number, val) => sum + Number(val || 0), 0);
  const lockedTxCerBalance = txCerIds.reduce((sum, id) => {
    if (!isTXCerLocked(id)) return sum;
    return sum + (Number((txCers as any)[id]) || 0);
  }, 0);
  const unlockedTxCerBalance = Math.max(0, txCerBalance - lockedTxCerBalance);
  const availableBalance = unlockedUtxoBalance + unlockedTxCerBalance;
  const totalBalance = utxoBalance + txCerBalance;
  const gas = Number(found.estInterest || found.gas || 0);

  const list = document.getElementById(DOM_IDS.walletAddrList);
  if (!list) return;

  const cards = list.querySelectorAll('.addr-card');
  cards.forEach(card => {
    const btn = card.querySelector('.btn-add') || card.querySelector('.btn-zero');
    if (btn && (btn as HTMLElement).dataset.addr?.toLowerCase() === key) {
      // 直接更新余额显示，不使用 scheduleBatchUpdate
      const balanceEl = card.querySelector('.addr-card-balance');
      if (balanceEl) {
        // Update only one non-empty text node to avoid destroying lock/TXCer indicators,
        // and clear any other non-empty text nodes to prevent duplicated "70 PGC 70 PGC".
        const prefix = `${availableBalance} ${coinType} `;
        const textNodes = Array.from(balanceEl.childNodes)
          .filter(n => n.nodeType === Node.TEXT_NODE)
          .map(n => n as Text);
        const primary = textNodes.find(t => (t.textContent || '').trim().length > 0) || textNodes[0] || null;
        if (primary) {
          primary.textContent = prefix;
          for (const t of textNodes) {
            if (t !== primary && (t.textContent || '').trim().length > 0) {
              t.textContent = ' ';
            }
          }
        } else {
          balanceEl.insertBefore(document.createTextNode(prefix), balanceEl.firstChild);
        }
      }

      // Update breakdown values when expanded (or present)
      const totalEl = card.querySelector('.balance-row .balance-value');
      const totalRow = card.querySelector('.balance-row:not(.available):not(.locked):not(.txcer):not(.utxo) .balance-value');
      const availableRow = card.querySelector('.balance-row.available .balance-value');
      const utxoRow = card.querySelector('.balance-row.utxo .balance-value');
      const txcerRow = card.querySelector('.balance-row.txcer .balance-value');
      if (totalRow) totalRow.textContent = `${totalBalance} ${coinType}`;
      else if (totalEl) totalEl.textContent = `${totalBalance} ${coinType}`;
      if (availableRow) availableRow.textContent = `${availableBalance} ${coinType}`;
      if (utxoRow) utxoRow.textContent = `${utxoBalance} ${coinType}`;
      if (txcerRow) txcerRow.textContent = `${txCerBalance} ${coinType}`;

      // Update locked rows (UTXO locked vs TXCer locked share the same CSS class)
      const lockedRows = card.querySelectorAll('.balance-row.locked');
      lockedRows.forEach((row) => {
        const labelEl = row.querySelector('.balance-label');
        const valueEl = row.querySelector('.balance-value');
        if (!valueEl) return;
        const labelText = (labelEl?.textContent || '').trim();
        if (labelText.includes('TXCer')) {
          valueEl.textContent = `${lockedTxCerBalance} ${coinType}`;
        } else {
          valueEl.textContent = `${lockedBalance} ${coinType}`;
        }
      });

      // Keep TXCer tooltip/header in sync (locks affect available)
      const txcerTooltip = card.querySelector('.txcer-tooltip');
      if (txcerTooltip) {
        txcerTooltip.textContent = `TXCer: ${txCerIds.length}个 可用${unlockedTxCerBalance.toFixed(2)} / 总${txCerBalance.toFixed(2)}`;
      }
      const txcerHeaderValue = card.querySelector('.txcer-header-value');
      if (txcerHeaderValue) {
        txcerHeaderValue.textContent = `${txCerIds.length}个 / ${txCerBalance.toFixed(4)} ${coinType}`;
      }

      // 直接更新详情行
      const detailRows = card.querySelectorAll('.addr-detail-row');
      detailRows.forEach(row => {
        const label = row.querySelector('.addr-detail-label');
        const value = row.querySelector('.addr-detail-value');
        if (label && value) {
          const labelText = label.textContent;
          if (labelText === t('address.balance') || labelText === '余额') {
            value.textContent = `${availableBalance} ${coinType}`;
          } else if (labelText === 'GAS') {
            value.textContent = String(gas);
          }
        }
      });
    }
  });
}


/**
 * Update all address card balances from current user data
 * 用于 store 订阅时实时更新地址卡片余额
 */
export function updateAllAddressCardBalances(u: User | null): void {
  if (!u?.wallet?.addressMsg) return;

  const addressMsg = u.wallet.addressMsg;
  for (const [address, data] of Object.entries(addressMsg)) {
    if (data) {
      updateAddressCardDisplay(address, data as AddressMetadata);
    }
  }
}

/**
 * Update USDT and breakdown display
 */
function updateUSDTDisplay(u: User): void {
  const usdtEl = document.getElementById(DOM_IDS.walletUSDT);
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
  const addrModal = document.getElementById(DOM_IDS.addrModal);
  const addrTitle = document.getElementById(DOM_IDS.addrModalTitle);
  const addrCreateBox = document.getElementById(DOM_IDS.addrCreateBox);
  const addrImportBox = document.getElementById(DOM_IDS.addrImportBox);

  if (addrTitle) addrTitle.textContent = mode === 'import' ? t('walletModal.importAddress') : t('walletModal.createAddress');
  if (addrCreateBox) addrCreateBox.classList.toggle('hidden', mode !== 'create');
  if (addrImportBox) addrImportBox.classList.toggle('hidden', mode !== 'import');

  if (mode === 'import') {
    const input = document.getElementById(DOM_IDS.addrPrivHex) as HTMLInputElement | null;
    if (input) input.value = '';
  }

  if (addrModal) addrModal.classList.remove('hidden');
  setAddrError('');
}


/**
 * Hide address modal
 */
export function hideAddrModal(): void {
  const addrModal = document.getElementById(DOM_IDS.addrModal);
  if (addrModal) addrModal.classList.add('hidden');
  setAddrError('');
}

// ============================================================================
// Import Preview Modal Functions
// ============================================================================

/**
 * Show import preview modal with parsed address data
 */
function showImportPreviewModal(data: PendingImportData): void {
  const modal = document.getElementById(DOM_IDS.importPreviewModal);
  const addressEl = document.getElementById(DOM_IDS.importPreviewAddress);
  const pubXEl = document.getElementById(DOM_IDS.importPreviewPubX);
  const pubYEl = document.getElementById(DOM_IDS.importPreviewPubY);
  const coinTypeEl = document.getElementById(DOM_IDS.importPreviewCoinType);

  if (addressEl) addressEl.textContent = data.address;
  if (pubXEl) pubXEl.textContent = data.pubXHex || '-';
  if (pubYEl) pubYEl.textContent = data.pubYHex || '-';
  if (coinTypeEl) coinTypeEl.textContent = getCoinName(data.coinType);

  if (modal) modal.classList.remove('hidden');
}

/**
 * Hide import preview modal
 */
function hideImportPreviewModal(): void {
  const modal = document.getElementById(DOM_IDS.importPreviewModal);
  if (modal) modal.classList.add('hidden');
  __pendingImport = null;
}

/**
 * Handle import preview confirm button
 * Calls backend API if user is in organization, then saves locally
 */
async function handleImportPreviewConfirm(): Promise<void> {
  if (!__pendingImport) {
    hideImportPreviewModal();
    return;
  }

  const { privHex, address, pubXHex, pubYHex, coinType } = __pendingImport;

  hideImportPreviewModal();

  // Show loading animation
  const { showUnifiedLoading, hideUnifiedOverlay, showUnifiedError } = await import('../ui/modal.js');
  showUnifiedLoading(t('walletModal.importing', '正在导入...'));

  try {
    // Check if user is in organization - if so, sync with backend first
    if (isUserInOrganization()) {
      console.debug('[Wallet] User is in organization, syncing with backend...');

      const result = await createNewAddressOnBackend(address, pubXHex, pubYHex, coinType);

      if (!result.success) {
        hideUnifiedOverlay();
        // Type narrowing: result is now { success: false; error: string }
        const errorMsg = 'error' in result ? result.error : t('error.unknownError');

        // Check if user cancelled password input
        if (errorMsg === 'USER_CANCELLED') {
          console.info('[Wallet] User cancelled password input for import');
          showMiniToast(t('common.operationCancelled') || '操作已取消', 'info');
          return;
        }

        showUnifiedError(
          t('toast.importFailed', '导入失败'),
          errorMsg
        );
        return;
      }

      console.info('[Wallet] ✓ Address synced with backend');
    }

    // Proceed with local import
    await importAddressInPlaceWithData(privHex, address, pubXHex, pubYHex, coinType);

    hideUnifiedOverlay();
    showSuccessToast(t('toast.importSuccessDesc'), t('toast.importSuccess'));

  } catch (error) {
    hideUnifiedOverlay();
    console.error('[Wallet] ✗ Import address error:', error);
    showUnifiedError(
      t('toast.importFailed', '导入失败'),
      error instanceof Error ? error.message : t('error.unknownError')
    );
  }
}

/**
 * Import address with pre-parsed data (used by preview modal confirm)
 */
async function importAddressInPlaceWithData(
  priv: string,
  address: string,
  pubXHex: string,
  pubYHex: string,
  coinType: number
): Promise<void> {
  const u2 = getCurrentUser();
  if (!u2?.accountId) {
    throw new Error(t('modal.pleaseLoginFirst'));
  }

  const acc = toAccount({ accountId: u2.accountId, address: u2.address }, u2);
  const addr = address.toLowerCase();

  acc.wallet.addressMsg[addr] = acc.wallet.addressMsg[addr] || {
    type: coinType,
    utxos: {},
    txCers: {},
    value: { totalValue: 0, utxoValue: 0, txCerValue: 0 },
    estInterest: 0,
    origin: 'imported'
  };

  const normPriv = priv.replace(/^0x/i, '');
  const addrMeta = acc.wallet.addressMsg[addr] as AddressMetadata;
  addrMeta.privHex = normPriv;
  addrMeta.pubXHex = pubXHex;
  addrMeta.pubYHex = pubYHex;

  saveUser(acc);

  // Encrypt the imported address private key
  try {
    if (normPriv && u2.accountId && !hasEncryptedKey(u2.accountId)) {
      await encryptAndSavePrivateKey(`${u2.accountId}_${addr}`, normPriv);
    }
  } catch (encryptErr) {
    console.warn('Imported address key encryption skipped:', encryptErr);
  }

  try { window.PanguPay?.wallet?.refreshSrcAddrList?.(); } catch (_) { }

  renderWallet();
  try { updateWalletBrief(); } catch { }
}

/**
 * Initialize import preview modal buttons
 */
export function initImportPreviewModal(): void {
  const cancelBtn = document.getElementById(DOM_IDS.importPreviewCancelBtn);
  const confirmBtn = document.getElementById(DOM_IDS.importPreviewConfirmBtn);

  if (cancelBtn && !cancelBtn.dataset._previewBind) {
    cancelBtn.onclick = hideImportPreviewModal;
    cancelBtn.dataset._previewBind = '1';
  }

  if (confirmBtn && !confirmBtn.dataset._previewBind) {
    confirmBtn.onclick = handleImportPreviewConfirm;
    confirmBtn.dataset._previewBind = '1';
  }
}

/**
 * Set address error message
 */
function setAddrError(msg: string): void {
  const box = document.getElementById(DOM_IDS.addrError);
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
  const u2 = getCurrentUser();
  if (!u2?.accountId) {
    showErrorToast(t('modal.pleaseLoginFirst'), t('common.notLoggedIn'));
    return;
  }

  const ov = document.getElementById(DOM_IDS.actionOverlay);
  const ovt = document.getElementById(DOM_IDS.actionOverlayText);
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
    // AddressMetadata interface includes these fields
    const addrMeta = acc.wallet.addressMsg[addr] as AddressMetadata;
    addrMeta.privHex = normPriv;
    addrMeta.pubXHex = data.pubXHex || '';
    addrMeta.pubYHex = data.pubYHex || '';

    saveUser(acc);

    // Encrypt the imported address private key
    try {
      if (normPriv && u2.accountId && !hasEncryptedKey(u2.accountId)) {
        await encryptAndSavePrivateKey(`${u2.accountId}_${addr}`, normPriv);
      }
    } catch (encryptErr) {
      console.warn('Imported address key encryption skipped:', encryptErr);
    }

    try { window.PanguPay?.wallet?.refreshSrcAddrList?.(); } catch (_) { }

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
    const input = document.getElementById(DOM_IDS.addrPrivHex) as HTMLInputElement | null;
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

    // Parse the private key to get address info for preview
    try {
      const data = await importFromPrivHex(v);
      const addr = (data.address || '').toLowerCase();

      if (!addr) {
        showErrorToast(t('toast.cannotParseAddress'), t('toast.importFailed'));
        return;
      }

      // Check for duplicate address
      const u2 = getCurrentUser();
      if (u2) {
        const map = u2.wallet?.addressMsg || {};
        const lowerMain = (u2.address || '').toLowerCase();

        if (lowerMain && lowerMain === addr) {
          showErrorToast(t('toast.addressExists'), t('toast.importFailed'));
          return;
        }

        for (const k in map) {
          if (Object.prototype.hasOwnProperty.call(map, k)) {
            if (String(k).toLowerCase() === addr) {
              showErrorToast(t('toast.addressExists'), t('toast.importFailed'));
              return;
            }
          }
        }
      }

      // Store pending import data and show preview modal
      __pendingImport = {
        privHex: v,
        address: addr,
        pubXHex: data.pubXHex || '',
        pubYHex: data.pubYHex || '',
        coinType: 0 // Default to PGC
      };

      hideAddrModal();
      showImportPreviewModal(__pendingImport);

    } catch (err) {
      showErrorToast((err as Error).message || String(err), t('toast.importFailed'));
    }
  }
}

/**
 * Initialize address modal buttons
 */
export function initAddressModal(): void {
  const openCreateAddrBtn = document.getElementById(DOM_IDS.openCreateAddrBtn);
  const openImportAddrBtn = document.getElementById(DOM_IDS.openImportAddrBtn);
  const openHistoryBtn = document.getElementById(DOM_IDS.openHistoryBtn);
  const refreshWalletBtn = document.getElementById(DOM_IDS.refreshWalletBtn);
  const addrCancelBtn = document.getElementById(DOM_IDS.addrCancelBtn);
  const addrOkBtn = document.getElementById(DOM_IDS.addrOkBtn);

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
      // Import routeTo at the top of file and use directly to avoid timing issues
      import('../router').then(({ routeTo }) => {
        routeTo('#/history');
      }).catch(err => {
        console.error('Failed to navigate to history:', err);
      });
    };
    openHistoryBtn.dataset._walletBind = '1';
  }

  // Refresh wallet balances button
  if (refreshWalletBtn && !refreshWalletBtn.dataset._walletBind) {
    refreshWalletBtn.onclick = () => {
      refreshWalletBalances().catch(err => {
        console.error('Failed to refresh wallet balances:', err);
      });
    };
    refreshWalletBtn.dataset._walletBind = '1';
  }

  if (addrCancelBtn && !addrCancelBtn.dataset._walletBind) {
    addrCancelBtn.onclick = hideAddrModal;
    addrCancelBtn.dataset._walletBind = '1';
  }

  if (addrOkBtn && !addrOkBtn.dataset._walletBind) {
    addrOkBtn.onclick = handleAddrModalOk;
    addrOkBtn.dataset._walletBind = '1';
  }

  // Initialize import preview modal buttons
  initImportPreviewModal();
}


// ============================================================================
// Transfer Mode Functions
// ============================================================================

/**
 * Refresh wallet snapshot from localStorage
 */
function refreshWalletSnapshot(): Record<string, AddressMetadata> {
  const latest = getCurrentUser();
  walletMap = (latest?.wallet?.addressMsg) || {};
  srcAddrs = Object.keys(walletMap);
  return walletMap;
}

function extractTxIdFromUtxoKey(key: string): string {
  if (!key) return '';
  if (key.includes(' + ')) return key.split(' + ')[0].trim();
  if (key.includes(':')) return key.split(':')[0].trim();
  if (key.includes('_')) return key.split('_')[0].trim();
  return key.trim();
}

function buildUtxoKeySet(utxos?: Record<string, unknown>): Set<string> {
  return new Set(Object.keys(utxos || {}));
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const val of a) {
    if (!b.has(val)) return false;
  }
  return true;
}

/**
 * Fill change address dropdowns based on selected addresses
 */
function fillChange(): void {
  const addrList = document.getElementById(DOM_IDS.srcAddrList);
  if (!addrList) return;

  const chPGC = document.getElementById(DOM_IDS.chAddrPGC) as HTMLSelectElement | null;
  const chBTC = document.getElementById(DOM_IDS.chAddrBTC) as HTMLSelectElement | null;
  const chETH = document.getElementById(DOM_IDS.chAddrETH) as HTMLSelectElement | null;
  const csPGC = document.getElementById(DOM_IDS.csChPGC);
  const csBTC = document.getElementById(DOM_IDS.csChBTC);
  const csETH = document.getElementById(DOM_IDS.csChETH);

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

  const fillSelect = (selEl: HTMLSelectElement | null, opts: string[]): void => {
    if (!selEl) return;
    selEl.replaceChildren(...opts.map(a => {
      const opt = document.createElement('option');
      opt.value = a;
      opt.textContent = a;
      return opt;
    }));
  };

  fillSelect(chPGC, optsPGC);
  fillSelect(chBTC, optsBTC);
  fillSelect(chETH, optsETH);

  const buildMenu = (box: HTMLElement | null, optsArr: string[], hidden: HTMLSelectElement | null): void => {
    if (!box) return;
    const menu = box.querySelector('.custom-select__menu');
    const valEl = box.querySelector('.addr-val');

    if (optsArr.length === 0) {
      if (menu) {
        const item = document.createElement('div');
        item.className = 'custom-select__item disabled';
        item.textContent = t('transfer.noAddressAvailable');
        (menu as HTMLElement).replaceChildren(item);
      }
      if (valEl) valEl.textContent = t('transfer.noAddressAvailable');
      if (hidden) hidden.value = '';
      const ico0 = box.querySelector('.coin-icon');
      if (ico0) ico0.remove();
      return;
    }

    if (menu) {
      const items = optsArr.map(a => {
        const div = document.createElement('div');
        div.className = 'custom-select__item';
        div.setAttribute('data-val', a);
        const code = document.createElement('code');
        code.className = 'break';
        code.textContent = a;
        div.appendChild(code);
        return div;
      });
      (menu as HTMLElement).replaceChildren(...items);
    }

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
  const addrList = document.getElementById(DOM_IDS.srcAddrList);
  if (!addrList) return;

  // 清除骨架屏状态
  clearSkeletonState(addrList);

  const fragment = document.createDocumentFragment();

  srcAddrs.forEach(a => {
    const meta = walletMap[a] || {};
    const tId = Number(meta.type ?? 0);
    const utxoAmt = Number(meta.value?.utxoValue || 0);

    // 获取锁定信息
    const lockedUtxos = getLockedUTXOsByAddress(a);
    const lockedBalance = getLockedBalanceByAddress(a);
    const hasLockedUtxos = lockedUtxos.length > 0;
    const unlockedUtxoBalance = Math.max(0, utxoAmt - lockedBalance);

    // 获取 TXCer 余额
    const txCers = meta.txCers || {};
    const txCerIds = Object.keys(txCers);
    const txCerBalance = Object.values(txCers).reduce((sum: number, val) => sum + Number(val || 0), 0);
    const lockedTxCerBalance = txCerIds.reduce((sum, id) => {
      if (!isTXCerLocked(id)) return sum;
      return sum + (Number((txCers as any)[id]) || 0);
    }, 0);
    const unlockedTxCerBalance = Math.max(0, txCerBalance - lockedTxCerBalance);

    // 可用余额 = 未锁定 UTXO + 未锁定 TXCer
    const availableBalance = unlockedUtxoBalance + unlockedTxCerBalance;

    const coinInfo = getCoinInfo(tId);
    const color = coinInfo.className;
    const coinName = coinInfo.name;
    const coinLetter = coinName.charAt(0);
    const shortAddr = a;

    const label = document.createElement('label');
    label.className = `src-addr-item item-type-${color}`;
    label.dataset.addr = a;

    // Use lit-html for safe and efficient rendering
    const template = viewHtml`
      <input type="checkbox" name="srcAddr" value="${a}">
      <div class="item-backdrop"></div>
      <div class="item-content">
        <div class="item-left">
          <div class="coin-icon coin-icon--${color}">${coinLetter}</div>
          <div class="addr-info">
            <span class="addr-text" title="${a}">${shortAddr}</span>
            <span class="coin-name-tiny">${coinName}</span>
            ${hasLockedUtxos ? viewHtml`
              <span class="src-addr-locked-info">
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                ${t('wallet.availableBalance')}: ${String(availableBalance)}
              </span>
            ` : ''}
          </div>
        </div>
        <div class="item-right">
          <span class="amount-num" title="${String(availableBalance)}">${String(availableBalance)}</span>
          <div class="check-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
        </div>
      </div>
      <div class="selection-outline"></div>
    `;

    renderInto(label, template);

    fragment.appendChild(label);
  });

  addrList.replaceChildren();
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
    const utxoAmt = Number(meta?.value?.utxoValue || 0);
    const lockedBalance = getLockedBalanceByAddress(addr);
    const unlockedUtxo = Math.max(0, utxoAmt - lockedBalance);
    const txCers = meta?.txCers || {};
    const txCerIds = Object.keys(txCers);
    const txCerBalance = Object.values(txCers).reduce((sum: number, val) => sum + Number(val || 0), 0);
    const lockedTxCerBalance = txCerIds.reduce((sum, id) => {
      if (!isTXCerLocked(id)) return sum;
      return sum + (Number((txCers as any)[id]) || 0);
    }, 0);
    const unlockedTxCerBalance = Math.max(0, txCerBalance - lockedTxCerBalance);
    const availableBalance = unlockedUtxo + unlockedTxCerBalance;
    return availableBalance > 0;
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
  const isNoOrgMode = () => modeTabsContainer.classList.contains('no-org-mode');

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
    if (isNoOrgMode()) {
      const dd = modeTabsContainer.querySelector('.mode-dropdown');
      if (dd) dd.remove();
      modeTabsContainer.classList.remove('open');
      return;
    }
    const dd = ensureDropdown();
    const btns: HTMLButtonElement[] = [];
    modeTabsContainer.querySelectorAll('.transfer-mode-tab').forEach(b => {
      if (b.classList.contains('active')) return;
      const btn = document.createElement('button');
      btn.className = 'mode-item';
      btn.setAttribute('data-mode', (b as HTMLElement).dataset.mode || '');
      btn.textContent = b.textContent || '';
      btns.push(btn);
    });
    dd.replaceChildren(...btns);
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
    const tfModeSelect = document.getElementById(DOM_IDS.tfMode) as HTMLSelectElement | null;
    const isPledgeSelect = document.getElementById(DOM_IDS.isPledge) as HTMLSelectElement | null;
    if (tfModeSelect) {
      tfModeSelect.value = mode;
      // Trigger change event so transfer.ts updateTransferButtonState gets called
      tfModeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (isPledgeSelect) isPledgeSelect.value = mode === 'pledge' ? 'true' : 'false';
    const radios = document.querySelectorAll('input[name="tfModeChoice"]');
    radios.forEach(r => { (r as HTMLInputElement).checked = (r as HTMLInputElement).value === mode; });

    // Cross-chain mode: Hide unnecessary fields (public key, guarantor org ID, transfer gas)
    // These fields are not used in cross-chain transactions as per backend logic
    const isCrossChainMode = mode === 'cross';

    // Hide/show fields in recipient cards
    const billList = document.getElementById(DOM_IDS.billList);
    if (billList) {
      // Public key fields
      billList.querySelectorAll('[data-name="pub"]').forEach(el => {
        const field = (el as HTMLElement).closest('.recipient-field');
        if (field) (field as HTMLElement).style.display = isCrossChainMode ? 'none' : '';
      });
      // Guarantor org ID fields
      billList.querySelectorAll('[data-name="gid"]').forEach(el => {
        const field = (el as HTMLElement).closest('.recipient-field');
        if (field) (field as HTMLElement).style.display = isCrossChainMode ? 'none' : '';
      });
      // Transfer gas fields
      billList.querySelectorAll('[data-name="gas"]').forEach(el => {
        const field = (el as HTMLElement).closest('.recipient-field');
        if (field) (field as HTMLElement).style.display = isCrossChainMode ? 'none' : '';
      });

      // For cross-chain, also hide the expand button since there are no advanced options
      billList.querySelectorAll('[data-role="expand"]').forEach(el => {
        (el as HTMLElement).style.display = isCrossChainMode ? 'none' : '';
      });
      // Collapse any expanded cards in cross-chain mode
      if (isCrossChainMode) {
        billList.querySelectorAll('.recipient-card.expanded').forEach(card => {
          card.classList.remove('expanded');
        });
      }
    }

    // Hide/show "Use TXCer" checkbox (cross-chain doesn't support TXCer)
    const useTXCerChk = document.getElementById(DOM_IDS.useTXCerChk) as HTMLInputElement | null;
    if (useTXCerChk) {
      // Logic update: PreTXCer option is now hidden from UI but defaults to true for Quick Transfer
      // We no longer toggle display style here since it's hidden by default in HTML

      // Auto-set state based on mode:
      // Cross-Chain -> unchecked (not supported)
      // Quick Transfer -> checked (default requirement)
      const shouldBeChecked = !isCrossChainMode;

      if (useTXCerChk.checked !== shouldBeChecked) {
        useTXCerChk.checked = shouldBeChecked;
        useTXCerChk.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
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

  // Automatically sync state with active tab on init
  // This fixes the issue where browser autofill might set tfMode to 'cross' while UI shows 'quick'
  const initialActiveTab = modeTabsContainer.querySelector('.transfer-mode-tab.active');
  if (initialActiveTab) {
    // Force apply mode to ensure tfMode input matches the UI tab
    const mode = (initialActiveTab as HTMLElement).dataset.mode || '';
    if (mode) applyMode(mode);
  }

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
  const chPGC = document.getElementById(DOM_IDS.chAddrPGC) as HTMLSelectElement | null;
  const chBTC = document.getElementById(DOM_IDS.chAddrBTC) as HTMLSelectElement | null;
  const chETH = document.getElementById(DOM_IDS.chAddrETH) as HTMLSelectElement | null;
  const csPGC = document.getElementById(DOM_IDS.csChPGC);
  const csBTC = document.getElementById(DOM_IDS.csChBTC);
  const csETH = document.getElementById(DOM_IDS.csChETH);

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

// ============================================================================
// Skeleton Loading Functions
// ============================================================================

/**
 * 显示钱包页面骨架屏
 * 在页面首次加载时调用，提供更好的加载体验
 */
export function showWalletSkeletons(): void {
  // 地址列表骨架屏
  const addrList = document.getElementById(DOM_IDS.walletAddrList);
  if (addrList && !isShowingSkeleton(addrList)) {
    showAddressListSkeleton(addrList, { count: 3 });
  }

  // 转账来源地址骨架屏
  const srcAddrList = document.getElementById(DOM_IDS.srcAddrList);
  if (srcAddrList && !isShowingSkeleton(srcAddrList)) {
    showSrcAddrSkeleton(srcAddrList, { count: 2 });
  }
}

/**
 * 隐藏钱包页面骨架屏
 * 在数据加载完成后调用
 */
export function hideWalletSkeletons(): void {
  const addrList = document.getElementById(DOM_IDS.walletAddrList);
  if (addrList) {
    clearSkeletonState(addrList);
  }

  const srcAddrList = document.getElementById(DOM_IDS.srcAddrList);
  if (srcAddrList) {
    clearSkeletonState(srcAddrList);
  }
}

// ============================================================================
// Wallet Balance Refresh Functions
// ============================================================================

/**
 * Refresh wallet balances from backend
 * 
 * This function:
 * 1. Gets all addresses from user's wallet
 * 2. Calls the query-address API to fetch real balances
 * 3. Updates local storage with real data (balance, interest, UTXOs)
 * 4. Shows success/error toast
 * 
 * @returns Promise<boolean> - true if refresh was successful
 */
export async function refreshWalletBalances(): Promise<boolean> {
  const current = getCurrentUser();
  if (!current?.wallet?.addressMsg) {
    showErrorToast(
      t('wallet.noAddressToRefreshDesc', '请先添加钱包地址'),
      t('wallet.noAddressToRefresh', '没有地址')
    );
    return false;
  }

  const addresses = Object.keys(current.wallet.addressMsg);
  if (addresses.length === 0) {
    showErrorToast(
      t('wallet.noAddressToRefreshDesc', '请先添加钱包地址'),
      t('wallet.noAddressToRefresh', '没有地址')
    );
    return false;
  }

  const prevUtxoByAddr: Record<string, Set<string>> = {};
  for (const [addr, meta] of Object.entries(current.wallet.addressMsg)) {
    prevUtxoByAddr[addr.toLowerCase()] = buildUtxoKeySet(meta?.utxos as Record<string, unknown>);
  }

  // NOTE: We no longer clear locked UTXOs before refresh.
  // Locked UTXOs represent in-flight transactions and must be preserved
  // until the transaction is confirmed on-chain.
  console.info('[Wallet] Refreshing balances (locked UTXOs will be preserved)');

  // Show loading state on refresh button
  const refreshBtn = document.getElementById(DOM_IDS.refreshWalletBtn);
  if (refreshBtn) {
    refreshBtn.classList.add('loading');
    refreshBtn.setAttribute('disabled', 'true');
  }

  try {
    // Import the query function dynamically to avoid circular dependencies
    const { queryAddressBalances, convertUtxosForStorage, calculateTotalBalance } = await import('./accountQuery');

    console.info('[Wallet] Refreshing balances for', addresses.length, 'addresses');

    const result = await queryAddressBalances(addresses);

    if (!result.success) {
      // Type narrowing: result is now { success: false; error: string }
      const errorMsg = 'error' in result ? result.error : t('error.unknownError', '未知错误');
      showErrorToast(
        errorMsg,
        t('wallet.refreshFailed', '刷新失败')
      );
      return false;
    }

    // Update local storage with fetched data
    const u = deepClone(current);
    const balances = result.data;

    const pendingSendTxs = getTxHistory()
      .filter(tx => tx.type === 'send' && tx.status === 'pending')
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    const txIdsToConfirm: string[] = [];
    if (pendingSendTxs.length > 0) {
      const observedTxIds = new Set<string>();
      const changedAddresses = new Set<string>();

      for (const balanceInfo of balances) {
        const addr = String(balanceInfo.address || '').toLowerCase();
        const utxoKeys = Object.keys(balanceInfo.utxos || {});

        for (const key of utxoKeys) {
          const txId = extractTxIdFromUtxoKey(key);
          if (txId) observedTxIds.add(txId);
        }

        const beforeSet = prevUtxoByAddr[addr] || new Set<string>();
        const afterSet = buildUtxoKeySet(balanceInfo.utxos as Record<string, unknown>);
        if (!setsEqual(beforeSet, afterSet)) {
          changedAddresses.add(addr);
        }
      }

      const usedFallbackAddress = new Set<string>();
      for (const tx of pendingSendTxs) {
        const txId = String(tx.txHash || '').trim();
        if (!txId) continue;

        if (observedTxIds.has(txId)) {
          txIdsToConfirm.push(txId);
          continue;
        }

        const fromAddr = String(tx.from || '').toLowerCase();
        const canFallback = !tx.guarantorOrg || String(tx.guarantorOrg).trim() === '';
        if (canFallback && fromAddr && changedAddresses.has(fromAddr) && !usedFallbackAddress.has(fromAddr)) {
          txIdsToConfirm.push(txId);
          usedFallbackAddress.add(fromAddr);
        }
      }
    }

    let updatedCount = 0;

    for (const balanceInfo of balances) {
      const addr = balanceInfo.address.toLowerCase();

      // Find the address in wallet (case-insensitive)
      let foundKey: string | null = null;
      for (const key of Object.keys(u.wallet?.addressMsg || {})) {
        if (key.toLowerCase() === addr) {
          foundKey = key;
          break;
        }
      }

      if (foundKey && u.wallet?.addressMsg?.[foundKey]) {
        const meta = u.wallet.addressMsg[foundKey] as AddressMetadata;

        // Update balance
        if (!meta.value) {
          meta.value = { totalValue: 0, utxoValue: 0, txCerValue: 0 };
        }
        meta.value.utxoValue = balanceInfo.balance;
        // totalValue should be balance only, NOT including interest/gas
        // Interest/gas is stored separately in meta.gas/meta.estInterest
        meta.value.totalValue = balanceInfo.balance;

        // Update interest/gas (stored separately, not included in totalValue)
        // IMPORTANT: Must update canonical 'EstInterest' field too, as readAddressInterest checks it first!
        (meta as any).EstInterest = balanceInfo.interest;
        meta.estInterest = balanceInfo.interest;
        meta.gas = balanceInfo.interest;

        // Update type
        meta.type = balanceInfo.type;

        // Update UTXOs if available, but PRESERVE locked UTXOs
        if (balanceInfo.utxoCount > 0) {
          const newUtxos = convertUtxosForStorage(balanceInfo);
          const existingUtxos = meta.utxos || {};
          const { isUTXOLocked } = await import('../utils/utxoLock');

          // Merge logic: keep locked UTXOs from existing, update/add non-locked
          const mergedUtxos: Record<string, UTXOData> = {};

          // First, preserve all locked existing UTXOs
          for (const [key, utxo] of Object.entries(existingUtxos)) {
            if (isUTXOLocked(key)) {
              mergedUtxos[key] = utxo as UTXOData;
              console.debug(`[Wallet] Preserving locked UTXO: ${key.slice(0, 16)}...`);
            }
          }

          // Then, add/update non-locked UTXOs from backend
          for (const [key, utxo] of Object.entries(newUtxos)) {
            if (!isUTXOLocked(key)) {
              mergedUtxos[key] = utxo;
            }
          }

          meta.utxos = mergedUtxos;
        }

        updatedCount++;
      }
    }

    // Recalculate totals
    recalculateWalletValue(u);

    // Update Store (SSOT) - this will trigger UI updates via subscriptions
    setUser(u);
    saveUser(u);

    if (txIdsToConfirm.length > 0) {
      const uniqueTxIds = Array.from(new Set(txIdsToConfirm));
      for (const txId of uniqueTxIds) {
        updateTxHistoryByTxId(txId, { status: 'success', failureReason: '' });
      }
    }

    // Force re-render wallet to show updated balances
    renderWallet();

    // Update currency display
    updateCurrencyDisplay(u);
    updateTotalGasBadge(u);

    // Refresh source address list
    try { window.PanguPay?.wallet?.refreshSrcAddrList?.(); } catch (_) { }

    // Calculate and log totals
    const totals = calculateTotalBalance(balances);
    console.info('[Wallet] ✓ Refresh complete:', {
      addressesUpdated: updatedCount,
      totalBalance: totals.totalBalance,
      totalInterest: totals.totalInterest,
      byType: totals.byType
    });

    showSuccessToast(
      t('wallet.refreshSuccessDesc', { count: updatedCount }),
      t('wallet.refreshSuccess', '刷新成功')
    );

    return true;

  } catch (error) {
    console.error('[Wallet] ✗ Refresh failed:', error);
    showErrorToast(
      error instanceof Error ? error.message : t('error.unknownError', '未知错误'),
      t('wallet.refreshFailed', '刷新失败')
    );
    return false;

  } finally {
    // Remove loading state from refresh button
    if (refreshBtn) {
      refreshBtn.classList.remove('loading');
      refreshBtn.removeAttribute('disabled');
    }
  }
}

// ============================================================================
// Global Click Handler for Closing Menus
// ============================================================================

/**
 * Initialize global click handler to close ops menus when clicking outside.
 * This is called once at app startup from app.js.
 */
let globalClickHandlerInitialized = false;

export function initGlobalClickHandler(): void {
  if (globalClickHandlerInitialized) return;

  // Use setTimeout to ensure this runs after event delegation handlers
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;

    // Don't close if clicking on ops-toggle or inside ops-menu
    if (target.closest('.ops-toggle') || target.closest('.ops-menu')) {
      return;
    }

    // Don't close if clicking on addr-card-summary (card toggle)
    if (target.closest('.addr-card-summary')) {
      return;
    }

    // Close all ops menus
    closeAllOpsMenus();
  }, { capture: false });

  globalClickHandlerInitialized = true;
}
