/**
 * Recipient Card Management Module
 * 
 * Handles recipient card creation, validation, and interactions
 */

import { t } from '../i18n/index.js';
import { showMiniToast } from '../utils/toast.js';
import { wait } from '../utils/helpers.js';

let billSeq = 0;

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
 * Mock address info lookup (replace with real API call)
 */
async function fetchAddrInfo(addr) {
  const MOCK_ADDR_INFO = {
    '299954ff8bbd78eda3a686abcf86732cd18533af': {
      groupId: '10000000',
      pubKey: '2b9edf25237d23a753ea8774ffbfb1b6d6bbbc2c96209d41ee59089528eb1566&c295d31bfd805e18b212fbbb726fc29a1bfc0762523789be70a2a1b737e63a80'
    },
    'd76ec4020140d58c35e999a730bea07bf74a7763': {
      groupId: '',
      pubKey: '11970dd5a7c3f6a131e24e8f066416941d79a177579c63d889ef9ce90ffd9ca8&037d81e8fb19883cc9e5ed8ebcc2b75e1696880c75a864099bec10a5821f69e0'
    }
  };
  
  const norm = normalizeAddrInput(addr);
  await wait(300);
  return MOCK_ADDR_INFO[norm] || null;
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
  if (typeof window.showModalTip === 'function') {
    window.showModalTip(title, msg, true);
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
  
  card.innerHTML = `
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
        showTxValidationError(t('modal.pleaseEnterPrivateKeyHex'), addrInputEl, t('tx.addressEmpty'));
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
          showMiniToast(t('tx.addressNotFound'), 'error');
          return;
        }
        if (pubInputEl && info.pubKey) {
          pubInputEl.value = info.pubKey;
        }
        if (gidInputEl) {
          gidInputEl.value = info.groupId || '';
        }
        // Auto-expand details after successful lookup
        if (info.pubKey || info.groupId) {
          card.classList.add('expanded');
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
    cs.addEventListener('click', (e) => { e.stopPropagation(); cs.classList.toggle('open'); });
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
      });
    }
    document.addEventListener('click', () => { cs.classList.remove('open'); });
  }
}

/**
 * Initialize recipient cards in transfer panel
 */
export function initRecipientCards() {
  const billList = document.getElementById('billList');
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
  const optionsToggle = document.getElementById('optionsToggle');
  const optionsContent = document.getElementById('optionsContent');
  
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
