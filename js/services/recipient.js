/**
 * Recipient Card Management Module
 * 
 * Handles recipient card creation, validation, and interactions
 */

import { t } from '../i18n/index.js';
import { showMiniToast, showInfoToast, showToast } from '../utils/toast.js';
import { DOM_IDS } from '../config/domIds';
import { html as viewHtml, renderInto } from '../utils/view';
import { querySingleAddressGroup, GROUP_ID_NOT_EXIST, GROUP_ID_RETAIL } from './accountQuery';

let billSeq = 0;

/**
 * Normalize address input
 */
function normalizeAddrInput(addr) {
  return addr ? String(addr).trim().toLowerCase().replace(/^0x/i, '') : '';
}

/**
 * Validate address format
 */
function isValidAddressFormat(addr) {
  return /^[0-9a-f]{40}$/.test(addr);
}

/**
 * Fetch address info from ComNode (query-address-group API)
 * 
 * @param {string} addr - Address to query (40 hex chars)
 * @returns {Promise<{groupId: string, pubKey: string} | null>} Address info or null if not found
 */
async function fetchAddrInfo(addr) {
  const normalized = normalizeAddrInput(addr);
  if (!normalized || !isValidAddressFormat(normalized)) {
    return null;
  }

  try {
    const result = await querySingleAddressGroup(normalized);

    if (!result.success) {
      console.error('[Recipient] Query address group failed:', result.error);
      return null;
    }

    const info = result.data;

    // Check if address exists
    if (!info.exists) {
      console.debug('[Recipient] Address not found on chain:', normalized);
      return null;
    }

    // Build public key string (X&Y format)
    // Note: accountQuery.ts now returns X/Y as 64-char hex strings
    let pubKey = '';
    if (info.publicKey && info.publicKey.x && info.publicKey.y) {
      // X and Y are already 64-char hex strings from accountQuery.ts
      const x = info.publicKey.x;
      const y = info.publicKey.y;
      // Format as "X&Y" for the public key input field
      pubKey = `${x}&${y}`;
    }

    // Get group ID (empty string for retail addresses)
    const groupId = info.isInGroup ? info.groupID : '';

    console.debug('[Recipient] Address info retrieved:', {
      address: normalized,
      groupId,
      isRetail: info.isRetail,
      isInGroup: info.isInGroup,
      hasPubKey: !!pubKey
    });

    return {
      groupId,
      pubKey,
      isRetail: info.isRetail,
      isInGroup: info.isInGroup
    };

  } catch (error) {
    console.error('[Recipient] Fetch address info error:', error);
    return null;
  }
}

/**
 * Show transaction validation error
 */
function showTxValidationError(msg, focusEl, title = '参数校验失败') {
  const txErr = document.getElementById(DOM_IDS.txError);
  if (txErr) {
    txErr.textContent = msg;
    txErr.classList.remove('hidden');
  }
  if (typeof window.PanguPay?.ui?.showModalTip === 'function') {
    window.PanguPay.ui.showModalTip(title, msg, true);
  }
  if (focusEl && typeof focusEl.focus === 'function') focusEl.focus();
}

/**
 * Update remove button state for recipient cards
 */
function updateRemoveState(billList) {
  const cards = Array.from(billList.querySelectorAll('.recipient-card'));
  const onlyOne = cards.length <= 1;
  cards.forEach(card => {
    const btn = card.querySelector('[data-role="remove"]');
    if (btn) {
      btn.disabled = onlyOne;
      if (onlyOne) {
        btn.setAttribute('title', t('transfer.cannotDeleteLast'));
        btn.setAttribute('aria-disabled', 'true');
      } else {
        btn.removeAttribute('title');
        btn.removeAttribute('aria-disabled');
      }
    }
  });
}

/**
 * Update card indices
 */
function updateCardIndices(billList) {
  const cards = billList.querySelectorAll('.recipient-card');
  cards.forEach((card, idx) => {
    card.setAttribute('data-index', idx + 1);
  });
}

/**
 * Create and add a recipient card
 */
export function addRecipientCard(billList, computeCurrentOrgId) {
  if (!billList) return;

  const g = computeCurrentOrgId ? (computeCurrentOrgId() || '') : '';
  const card = document.createElement('div');
  card.className = 'recipient-card';
  const idBase = `bill_${Date.now()}_${billSeq++}`;
  const cardIndex = billList.querySelectorAll('.recipient-card').length + 1;
  card.setAttribute('data-index', cardIndex);

  // Use lit-html for safe and efficient rendering
  const template = viewHtml`
    <div class="recipient-content">
      <!-- Main area: Address -->
      <div class="recipient-main">
        <div class="recipient-addr-field">
          <span class="recipient-field-label">${t('transfer.recipientAddress')}</span>
          <div class="recipient-addr-input-wrap">
            <input id="${idBase}_to" name="recipient_to" class="input" type="text" placeholder="${t('transfer.enterRecipientAddress')}" aria-label="目标地址" data-name="to">
            <button type="button" class="recipient-lookup-btn" aria-label="查询地址信息" title="自动补全担保组织与公钥" data-role="addr-lookup">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
              <span class="lookup-spinner"></span>
            </button>
          </div>
        </div>
      </div>
      
      <!-- Amount and currency -->
      <div class="recipient-amount-row">
        <div class="recipient-field">
          <span class="recipient-field-label">${t('transfer.amount')}</span>
          <input id="${idBase}_val" name="recipient_val" class="input" type="number" min="0.00000001" step="any" placeholder="0.00" aria-label="金额" data-name="val">
        </div>
        <div class="recipient-field">
          <span class="recipient-field-label">${t('transfer.currency')}</span>
          <input type="hidden" name="recipient_mt" value="0" data-name="mt-hidden">
          <div id="${idBase}_mt" class="recipient-coin-select" role="button" aria-label="币种" data-name="mt" data-val="0">
            <div class="recipient-coin-value">
              <span class="coin-label">PGC</span>
              <span class="recipient-coin-arrow">▾</span>
            </div>
            <div class="recipient-coin-menu">
              <div class="recipient-coin-item" data-val="0"><span class="coin-label">PGC</span></div>
              <div class="recipient-coin-item" data-val="1"><span class="coin-label">BTC</span></div>
              <div class="recipient-coin-item" data-val="2"><span class="coin-label">ETH</span></div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Collapsible details -->
      <div class="recipient-details">
        <div class="recipient-details-inner">
          <div class="recipient-details-content">
            <div class="recipient-field">
              <span class="recipient-field-label">${t('transfer.publicKey')}</span>
              <input id="${idBase}_pub" name="recipient_pub" class="input" type="text" placeholder="04 + X + Y or X,Y" aria-label="公钥" data-name="pub">
            </div>
            <div class="recipient-details-row">
              <div class="recipient-field">
                <span class="recipient-field-label">${t('transfer.guarantorOrgId')}</span>
                <input id="${idBase}_gid" name="recipient_gid" class="input" type="text" placeholder="${t('transfer.optional')}" value="" aria-label="担保组织ID" data-name="gid">
              </div>
              <div class="recipient-field">
                <span class="recipient-field-label">${t('transfer.transferGas')}</span>
                <input id="${idBase}_gas" name="recipient_gas" class="input" type="number" min="0" step="any" placeholder="0" aria-label="转移Gas" data-name="gas">
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Bottom action bar -->
      <div class="recipient-actions">
        <button type="button" class="recipient-expand-btn" data-role="expand">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
          <span>${t('wallet.advancedOptions')}</span>
        </button>
        <button type="button" class="recipient-remove-btn" data-role="remove">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          <span>${t('transfer.delete')}</span>
        </button>
        <button type="button" class="recipient-add-btn" data-role="add">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>${t('transfer.addRecipient')}</span>
        </button>
      </div>
    </div>
  `;

  renderInto(card, template);

  const addrInputEl = card.querySelector('[data-name="to"]');
  const gidInputEl = card.querySelector('[data-name="gid"]');
  const pubInputEl = card.querySelector('[data-name="pub"]');
  const lookupBtn = card.querySelector('[data-role="addr-lookup"]');
  const expandBtn = card.querySelector('[data-role="expand"]');
  const removeBtn = card.querySelector('[data-role="remove"]');
  const addBtn = card.querySelector('[data-role="add"]');

  // Address lookup button
  if (lookupBtn && addrInputEl) {
    lookupBtn.addEventListener('click', async () => {
      if (lookupBtn.dataset.loading === '1') return;
      const raw = addrInputEl.value || '';
      const normalized = normalizeAddrInput(raw);
      if (!normalized) {
        showTxValidationError(t('transfer.enterRecipientAddress'), addrInputEl, t('tx.addressEmpty'));
        return;
      }
      if (!isValidAddressFormat(normalized)) {
        showTxValidationError(t('tx.addressFormatErrorDesc'), addrInputEl, t('tx.addressFormatError'));
        return;
      }
      lookupBtn.dataset.loading = '1';
      lookupBtn.classList.add('is-loading');
      lookupBtn.disabled = true;
      try {
        const started = Date.now();
        const info = await fetchAddrInfo(normalized);
        const elapsed = Date.now() - started;
        if (elapsed < 2000) {
          await new Promise((resolve) => setTimeout(resolve, 2000 - elapsed));
        }
        if (!info) {
          // GroupID = "0": Address does not exist
          showMiniToast(t('tx.addressNotFound'), 'error');
          return;
        }

        // Fill in public key if available
        if (pubInputEl && info.pubKey) {
          pubInputEl.value = info.pubKey;
        }

        // Fill in group ID (empty for retail addresses)
        if (gidInputEl) {
          gidInputEl.value = info.groupId || '';
        }

        // Auto-expand details section
        card.classList.add('expanded');

        // Show appropriate toast message based on address status
        if (info.isRetail) {
          // GroupID = "1": Address exists but not in any guarantor group
          if (info.pubKey) {
            showToast(t('tx.addressIsRetailWithPubKey'), 'info', '', 1000);
          } else {
            showToast(t('tx.addressIsRetail'), 'info', '', 1000);
          }
        } else if (info.isInGroup) {
          // GroupID = other: Address is in a guarantor group
          const items = [];
          if (info.pubKey) items.push(t('tx.publicKey'));
          if (info.groupId) items.push(t('tx.guarantorOrg'));
          const found = items.join(t('common.separator') || '、');
          showMiniToast(t('tx.infoRetrieved', { info: found }), 'success');
        }
      } catch (e) {
        showMiniToast(t('tx.queryFailed'), 'error');
      } finally {
        lookupBtn.disabled = false;
        lookupBtn.classList.remove('is-loading');
        delete lookupBtn.dataset.loading;
      }
    });
  }

  // Expand/collapse button
  if (expandBtn) {
    expandBtn.addEventListener('click', () => {
      card.classList.toggle('expanded');
      const label = expandBtn.querySelector('span');
      if (label) {
        label.textContent = card.classList.contains('expanded') ? t('transfer.collapseOptions') : t('wallet.advancedOptions');
      }
    });
  }

  // Remove button
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      const cards = billList.querySelectorAll('.recipient-card');
      if (cards.length <= 1) return;
      card.style.animation = 'recipientCardExit 0.25s ease forwards';
      setTimeout(() => {
        card.remove();
        updateCardIndices(billList);
        updateRemoveState(billList);
      }, 250);
    });
  }

  // Add button
  if (addBtn) {
    addBtn.addEventListener('click', () => { addRecipientCard(billList, computeCurrentOrgId); });
  }

  billList.appendChild(card);
  updateCardIndices(billList);
  updateRemoveState(billList);

  // Currency selector
  const cs = card.querySelector('#' + idBase + '_mt');
  if (cs) {
    cs.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpening = !cs.classList.contains('open');
      cs.classList.toggle('open');
      // Toggle overflow class on card for dropdown visibility
      card.classList.toggle('has-dropdown-open', isOpening);
    });
    const menu = cs.querySelector('.recipient-coin-menu');
    if (menu) {
      menu.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const item = ev.target.closest('.recipient-coin-item');
        if (!item) return;
        const v = item.getAttribute('data-val');
        cs.dataset.val = v;
        const hiddenMt = card.querySelector('[data-name="mt-hidden"]');
        if (hiddenMt) hiddenMt.value = v;
        const valEl = cs.querySelector('.recipient-coin-value');
        if (valEl) {
          const labels = { '0': { t: 'PGC' }, '1': { t: 'BTC' }, '2': { t: 'ETH' } };
          const lbl = labels[v] || labels['0'];
          valEl.querySelector('.coin-label').textContent = lbl.t;
        }
        cs.classList.remove('open');
        card.classList.remove('has-dropdown-open');
      });
    }
    document.addEventListener('click', () => {
      cs.classList.remove('open');
      card.classList.remove('has-dropdown-open');
    });
  }
}

/**
 * Initialize recipient cards in transfer panel
 */
export function initRecipientCards() {
  const billList = document.getElementById(DOM_IDS.billList);
  if (!billList || billList.dataset._recipientBind) return;

  // Compute current org ID helper
  const computeCurrentOrgId = () => {
    if (typeof window.computeCurrentOrgId === 'function') {
      return window.computeCurrentOrgId();
    }
    return '';
  };

  // Add first card if empty
  if (billList.querySelectorAll('.recipient-card').length === 0) {
    addRecipientCard(billList, computeCurrentOrgId);
  }

  billList.dataset._recipientBind = '1';
}

/**
 * Initialize advanced options (change address section) collapse/expand
 */
export function initAdvancedOptions() {
  const optionsToggle = document.getElementById(DOM_IDS.optionsToggle);
  const optionsContent = document.getElementById(DOM_IDS.optionsContent);

  if (!optionsToggle || !optionsContent) return;
  if (optionsToggle.dataset._bind) return;

  optionsToggle.addEventListener('click', () => {
    const isActive = optionsToggle.classList.contains('active');
    if (isActive) {
      optionsToggle.classList.remove('active');
      optionsContent.classList.remove('show');
    } else {
      optionsToggle.classList.add('active');
      optionsContent.classList.add('show');
    }
  });

  optionsToggle.dataset._bind = '1';
}
