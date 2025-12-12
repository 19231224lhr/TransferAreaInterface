/**
 * History Page Module
 * 
 * Handles the transaction history page logic.
 */

import { t } from '../i18n/index.js';
import { escapeHtml } from '../utils/security.ts';

// 模拟交易数据
const MOCK_TRANSACTIONS = [
  {
    id: 'tx_001',
    type: 'send',
    status: 'success',
    amount: 150.50,
    currency: 'PGC',
    from: '02dde4e42353b57b16ab904762d6b01ca0ce2d2e',
    to: '8f3a7c9e1b4d6f2a5e8c0d3b7a9f1e4c6d2b8a5f',
    timestamp: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
    txHash: '0x7f9fade1c0d57a7af66ab4ead79fade1c0d57a7af66ab4ead7c2c2eb7b11a91385',
    gas: 0.5,
    guarantorOrg: '12345678',
    blockNumber: 1234567,
    confirmations: 24
  },
  {
    id: 'tx_002',
    type: 'receive',
    status: 'success',
    amount: 500.00,
    currency: 'PGC',
    from: '3e7b9f2c5a8d1e6b4f7c0a3d9e2b5f8c1a4d7e0b',
    to: '02dde4e42353b57b16ab904762d6b01ca0ce2d2e',
    timestamp: Date.now() - 5 * 60 * 60 * 1000, // 5 hours ago
    txHash: '0x3c2c2eb7b11a91385f9fade1c0d57a7af66ab4ead79fade1c0d57a7af66ab4ea',
    gas: 0.3,
    guarantorOrg: '87654321',
    blockNumber: 1234550,
    confirmations: 48
  },
  {
    id: 'tx_003',
    type: 'send',
    status: 'pending',
    amount: 75.25,
    currency: 'BTC',
    from: '02dde4e42353b57b16ab904762d6b01ca0ce2d2e',
    to: '1a4d7e0b3e7b9f2c5a8d1e6b4f7c0a3d9e2b5f8c',
    timestamp: Date.now() - 30 * 60 * 1000, // 30 minutes ago
    txHash: '0xd57a7af66ab4ead79fade1c0d57a7af66ab4ead7c2c2eb7b11a91385f9fade1c0',
    gas: 0.8,
    guarantorOrg: '12345678',
    blockNumber: null,
    confirmations: 0
  },
  {
    id: 'tx_004',
    type: 'receive',
    status: 'success',
    amount: 1200.00,
    currency: 'ETH',
    from: '5f8c1a4d7e0b3e7b9f2c5a8d1e6b4f7c0a3d9e2b',
    to: '02dde4e42353b57b16ab904762d6b01ca0ce2d2e',
    timestamp: Date.now() - 24 * 60 * 60 * 1000, // 1 day ago
    txHash: '0xab4ead79fade1c0d57a7af66ab4ead7c2c2eb7b11a91385f9fade1c0d57a7af66',
    gas: 1.2,
    guarantorOrg: '87654321',
    blockNumber: 1234400,
    confirmations: 120
  },
  {
    id: 'tx_005',
    type: 'send',
    status: 'failed',
    amount: 250.00,
    currency: 'PGC',
    from: '02dde4e42353b57b16ab904762d6b01ca0ce2d2e',
    to: '9e2b5f8c1a4d7e0b3e7b9f2c5a8d1e6b4f7c0a3d',
    timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000, // 3 days ago
    txHash: '0x1a91385f9fade1c0d57a7af66ab4ead7c2c2eb7b11a91385f9fade1c0d57a7af6',
    gas: 0.4,
    guarantorOrg: '12345678',
    blockNumber: 1234200,
    confirmations: 0,
    failureReason: 'Insufficient gas'
  }
];

let currentFilter = 'all';
let selectedTransaction = null;

/**
 * Format timestamp to readable date
 */
function formatDate(timestamp) {
  const date = new Date(timestamp);
  
  // Format as specific date and time
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * Format address (show first 6 and last 4 characters)
 */
function formatAddress(address) {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Filter transactions by time period
 */
function filterTransactions(period) {
  const now = Date.now();
  
  switch (period) {
    case 'today':
      return MOCK_TRANSACTIONS.filter(tx => 
        now - tx.timestamp < 24 * 60 * 60 * 1000
      );
    case 'week':
      return MOCK_TRANSACTIONS.filter(tx => 
        now - tx.timestamp < 7 * 24 * 60 * 60 * 1000
      );
    case 'month':
      return MOCK_TRANSACTIONS.filter(tx => 
        now - tx.timestamp < 30 * 24 * 60 * 60 * 1000
      );
    case 'all':
    default:
      return MOCK_TRANSACTIONS;
  }
}

/**
 * Render transaction list
 */
function renderTransactionList(transactions) {
  const listEl = document.getElementById('historyList');
  if (!listEl) return;
  
  if (transactions.length === 0) {
    listEl.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; color: #94a3b8;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 48px; height: 48px; margin: 0 auto 16px; opacity: 0.5;">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <p style="font-size: 15px; font-weight: 600; margin: 0;">${t('history.noTransactions')}</p>
      </div>
    `;
    return;
  }
  
  // Use DocumentFragment for better performance
  const fragment = document.createDocumentFragment();
  
  transactions.forEach(tx => {
    const item = document.createElement('div');
    item.className = `history-item ${selectedTransaction?.id === tx.id ? 'expanded' : ''}`;
    item.dataset.txId = tx.id;
    
    item.innerHTML = `
      <div class="history-item-header">
        <div class="history-item-type">
          <div class="history-item-icon ${escapeHtml(tx.type)}">
            ${tx.type === 'send' ? '↑' : '↓'}
          </div>
          <span class="history-item-label">
            ${tx.type === 'send' ? t('history.send') : t('history.receive')} ${escapeHtml(tx.currency)}
          </span>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <span class="history-item-status ${escapeHtml(tx.status)}">
            ${t(`history.status.${tx.status}`)}
          </span>
          <svg class="history-item-expand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>
      <div class="history-item-body">
        <div class="history-item-info">
          <span class="history-item-info-label">${tx.type === 'send' ? t('history.to') : t('history.from')}</span>
          <span class="history-item-info-value">${escapeHtml(formatAddress(tx.type === 'send' ? tx.to : tx.from))}</span>
        </div>
        <div class="history-item-info">
          <span class="history-item-info-label">${t('history.txHash')}</span>
          <span class="history-item-info-value">${escapeHtml(formatAddress(tx.txHash))}</span>
        </div>
      </div>
      <div class="history-item-footer">
        <span class="history-item-amount ${escapeHtml(tx.type)}">
          ${tx.type === 'send' ? '-' : '+'} ${escapeHtml(String(tx.amount.toLocaleString()))} ${escapeHtml(tx.currency)}
        </span>
        <span class="history-item-time">${escapeHtml(formatDate(tx.timestamp))}</span>
      </div>
      <div class="history-item-detail">
        ${renderTransactionDetail(tx)}
      </div>
    `;
    
    // Bind click event
    item.addEventListener('click', (e) => {
      // Prevent default behavior and stop propagation
      e.preventDefault();
      e.stopPropagation();
      
      if (tx) {
        toggleTransactionDetail(item, tx);
      }
    });
    
    fragment.appendChild(item);
  });
  
  // Single DOM update
  listEl.innerHTML = '';
  listEl.appendChild(fragment);
}

/**
 * Render transaction detail content
 */
function renderTransactionDetail(tx) {
  return `
    <div class="history-detail-section">
      <h4 class="history-detail-section-title">${t('history.basicInfo')}</h4>
      <div class="history-detail-card">
        <div class="history-detail-row">
          <span class="history-detail-label">${t('history.transactionType')}</span>
          <span class="history-detail-value">${tx.type === 'send' ? t('history.send') : t('history.receive')}</span>
        </div>
        <div class="history-detail-row">
          <span class="history-detail-label">${t('history.status')}</span>
          <span class="history-detail-value">${t(`history.status.${tx.status}`)}</span>
        </div>
        <div class="history-detail-row">
          <span class="history-detail-label">${t('history.amount')}</span>
          <span class="history-detail-value">${escapeHtml(String(tx.amount.toLocaleString()))} ${escapeHtml(tx.currency)}</span>
        </div>
        <div class="history-detail-row">
          <span class="history-detail-label">${t('history.gas')}</span>
          <span class="history-detail-value">${escapeHtml(String(tx.gas))} PGC</span>
        </div>
        <div class="history-detail-row">
          <span class="history-detail-label">${t('history.time')}</span>
          <span class="history-detail-value">${escapeHtml(new Date(tx.timestamp).toLocaleString('zh-CN'))}</span>
        </div>
      </div>
    </div>
    
    <div class="history-detail-section">
      <h4 class="history-detail-section-title">${t('history.addressInfo')}</h4>
      <div class="history-detail-card">
        <div class="history-detail-row">
          <span class="history-detail-label">${t('history.from')}</span>
          <span class="history-detail-value">${escapeHtml(tx.from)}</span>
        </div>
        <div class="history-detail-row">
          <span class="history-detail-label">${t('history.to')}</span>
          <span class="history-detail-value">${escapeHtml(tx.to)}</span>
        </div>
        <div class="history-detail-row">
          <span class="history-detail-label">${t('history.guarantorOrg')}</span>
          <span class="history-detail-value">${escapeHtml(tx.guarantorOrg)}</span>
        </div>
      </div>
    </div>
    
    <div class="history-detail-section">
      <h4 class="history-detail-section-title">${t('history.blockchainInfo')}</h4>
      <div class="history-detail-card">
        <div class="history-detail-row">
          <span class="history-detail-label">${t('history.txHash')}</span>
          <span class="history-detail-value">${escapeHtml(tx.txHash)}</span>
        </div>
        ${tx.blockNumber ? `
          <div class="history-detail-row">
            <span class="history-detail-label">${t('history.blockNumber')}</span>
            <span class="history-detail-value">${escapeHtml(String(tx.blockNumber.toLocaleString()))}</span>
          </div>
          <div class="history-detail-row">
            <span class="history-detail-label">${t('history.confirmations')}</span>
            <span class="history-detail-value">${escapeHtml(String(tx.confirmations))}</span>
          </div>
        ` : ''}
        ${tx.failureReason ? `
          <div class="history-detail-row">
            <span class="history-detail-label">${t('history.failureReason')}</span>
            <span class="history-detail-value" style="color: #ef4444;">${escapeHtml(tx.failureReason)}</span>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Toggle transaction detail (accordion style)
 */
function toggleTransactionDetail(itemEl, tx) {
  const isExpanded = itemEl.classList.contains('expanded');
  
  // Save current scroll position
  const scrollContainer = document.querySelector('.history-list-container');
  const currentScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
  
  // Collapse all other items
  document.querySelectorAll('.history-item.expanded').forEach(el => {
    if (el !== itemEl) {
      el.classList.remove('expanded');
    }
  });
  
  // Toggle current item
  if (isExpanded) {
    itemEl.classList.remove('expanded');
    selectedTransaction = null;
  } else {
    itemEl.classList.add('expanded');
    selectedTransaction = tx;
  }
  
  // Restore scroll position after a short delay to allow DOM update
  if (scrollContainer) {
    requestAnimationFrame(() => {
      scrollContainer.scrollTop = currentScrollTop;
    });
  }
}

/**
 * Update statistics
 */
function updateStatistics(transactions) {
  const totalCountEl = document.getElementById('historyTotalCount');
  const totalVolumeEl = document.getElementById('historyTotalVolume');
  
  if (totalCountEl) {
    totalCountEl.textContent = transactions.length;
  }
  
  if (totalVolumeEl) {
    const totalVolume = transactions.reduce((sum, tx) => {
      if (tx.status === 'success') {
        // Convert to USDT equivalent (simplified)
        const rates = { PGC: 1, BTC: 100, ETH: 10 };
        return sum + (tx.amount * (rates[tx.currency] || 1));
      }
      return sum;
    }, 0);
    
    totalVolumeEl.textContent = totalVolume.toLocaleString();
  }
}

/**
 * Initialize history page
 */
export function initHistoryPage() {
  // Bind back button
  const backBtn = document.getElementById('historyBackBtn');
  if (backBtn && !backBtn.dataset._historyBind) {
    backBtn.dataset._historyBind = 'true';
    backBtn.addEventListener('click', () => {
      if (typeof window.routeTo === 'function') {
        window.routeTo('#/main');
      }
    });
  }
  
  // Bind filter buttons
  const filterButtons = document.querySelectorAll('.history-filter-btn');
  filterButtons.forEach(btn => {
    if (!btn.dataset._historyBind) {
      btn.dataset._historyBind = 'true';
      btn.addEventListener('click', () => {
        const period = btn.dataset.period;
        currentFilter = period;
        
        // Update active state
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Filter and render
        const filtered = filterTransactions(period);
        renderTransactionList(filtered);
        updateStatistics(filtered);
        
        // Reset selected transaction when filtering
        selectedTransaction = null;
      });
    }
  });
  
  // Initial render
  const transactions = filterTransactions(currentFilter);
  renderTransactionList(transactions);
  updateStatistics(MOCK_TRANSACTIONS);
}

/**
 * Reset history page state
 */
export function resetHistoryPageState() {
  currentFilter = 'all';
  selectedTransaction = null;
  
  // Collapse all expanded items
  document.querySelectorAll('.history-item.expanded').forEach(item => {
    item.classList.remove('expanded');
  });
  
  // Reset filter buttons
  document.querySelectorAll('.history-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.period === 'all');
  });
}
