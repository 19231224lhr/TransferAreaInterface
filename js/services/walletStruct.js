/**
 * Wallet Structure Service
 * 
 * Provides wallet structure display functionality (copied from backup lines 3663-3850)
 */

import { t } from '../i18n/index.js';
import { loadUser } from '../utils/storage';
import { escapeHtml } from '../utils/security';

/**
 * Update wallet structure display (copied from backup lines 3663-3850)
 */
export function updateWalletStruct() {
  const box = document.getElementById('walletStructBox');
  const u = loadUser();
  if (!box || !u || !u.wallet) return;
  const w = u.wallet || {};
  const addr = w.addressMsg || {};
  const sums = { 0: 0, 1: 0, 2: 0 };
  Object.keys(addr).forEach((k) => {
    const m = addr[k] || {};
    const type = Number(m.type || 0);
    const val = Number(m.value && (m.value.totalValue || m.value.TotalValue) || 0);
    if (sums[type] !== undefined) sums[type] += val;
  });
  const totalPGC = Number(sums[0] || 0) + Number(sums[1] || 0) * 1000000 + Number(sums[2] || 0) * 1000;

  // Helper functions for rendering
  const getCoinLabel = (type) => {
    const labels = { 0: 'PGC', 1: 'BTC', 2: 'ETH' };
    const colors = { 0: '#10b981', 1: '#f59e0b', 2: '#3b82f6' };
    return `<span class="coin-tag" style="background:${colors[type] || '#6b7280'}20;color:${colors[type] || '#6b7280'};padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;">${labels[type] || 'UNKNOWN'}</span>`;
  };

  const renderValue = (val) => {
    if (typeof val === 'object' && val !== null) {
      if (Array.isArray(val)) return `<span style="color:#94a3b8;">[${val.length} items]</span>`;
      const keys = Object.keys(val);
      if (keys.length === 0) return `<span style="color:#94a3b8;">{}</span>`;
      return `<span style="color:#94a3b8;">{${keys.length} keys}</span>`;
    }
    if (typeof val === 'string') return `<span style="color:#0ea5e9;">"${val}"</span>`;
    if (typeof val === 'number') return `<span style="color:#8b5cf6;">${val}</span>`;
    if (typeof val === 'boolean') return `<span style="color:#ec4899;">${val}</span>`;
    return `<span style="color:#64748b;">${val}</span>`;
  };

  const createField = (label, value, isHighlight = false) => {
    return `<div style="display:flex;align-items:center;gap:8px;margin:4px 0;">
      <span style="color:#475569;font-size:12px;min-width:100px;">${label}:</span>
      ${isHighlight ? `<strong>${value}</strong>` : value}
    </div>`;
  };

  // Build HTML
  let html = '<div class="wb-inner-wrapper">';

  // Account Overview Section - 账户总览 (New Design)
  html += '<div class="wb-account-card">';
  html += '<h4 class="wb-account-header">账户总览</h4>';

  // Account ID Card
  html += '<div class="wb-account-id-box">';
  html += '<div class="wb-account-id-label">Account ID</div>';
  html += `<div class="wb-account-id-val">${escapeHtml(u.accountId || '未设置')}</div>`;
  html += '</div>';

  // Main Address Row
  html += '<div class="wb-info-row">';
  html += '<div class="wb-info-label">主地址</div>';
  html += `<div class="wb-info-val">${escapeHtml(u.address || '未设置')}</div>`;
  html += '</div>';

  // 获取担保组织信息 - 优先从 localStorage 读取
  let guarantorInfo = null;
  try {
    const guarChoice = localStorage.getItem('guarChoice');
    if (guarChoice) {
      const choice = JSON.parse(guarChoice);
      if (choice && choice.type === 'join' && choice.groupID) {
        guarantorInfo = choice;
      }
    }
  } catch (e) { }

  // 如果 localStorage 没有，尝试从用户对象获取
  if (!guarantorInfo) {
    const guarantorId = u.orgNumber || u.guarGroup?.groupID || u.GuarantorGroupID || '';
    if (guarantorId) {
      guarantorInfo = { groupID: guarantorId };
      if (u.guarGroup) {
        guarantorInfo.aggreNode = u.guarGroup.aggreNode || u.guarGroup.AggrID || '';
        guarantorInfo.assignNode = u.guarGroup.assignNode || u.guarGroup.AssiID || '';
        guarantorInfo.pledgeAddress = u.guarGroup.pledgeAddress || u.guarGroup.PledgeAddress || '';
      }
    }
  }

  if (guarantorInfo && guarantorInfo.groupID) {
    html += '<div class="wb-guar-box">';
    html += '<div class="wb-guar-label">担保组织</div>';
    html += `<div class="wb-guar-val">${escapeHtml(guarantorInfo.groupID)}</div>`;
    html += '</div>';
  } else {
    html += '<div class="wb-guar-box wb-guar-none">';
    html += '<div class="wb-guar-label">担保组织</div>';
    html += '<div class="wb-guar-val">未加入</div>';
    html += '</div>';
  }

  // Total Balance Row
  html += '<div class="wb-info-row">';
  html += '<div class="wb-info-label">总余额</div>';
  html += `<div class="wb-info-val wb-balance">${totalPGC.toLocaleString()} PGC</div>`;
  html += '</div>';

  html += '</div>'; // End of wb-account-card

  // Address Details
  const addrKeys = Object.keys(addr);
  if (addrKeys.length > 0) {
    html += '<div class="wb-section">';
    html += `<h4 class="wb-title">子地址 (${addrKeys.length})</h4>`;
    
    addrKeys.forEach((key, idx) => {
      const m = addr[key] || {};
      const typeId = Number(m.type || 0);
      const valObj = m.value || {};
      const utxos = m.utxos || {};
      const txCers = m.txCers || {};
      const utxoCount = Object.keys(utxos).length;
      const txCerCount = Object.keys(txCers).length;

      html += `<details class="wb-detail-card">`;
      html += `<summary class="wb-summary">
        <div class="wb-summary-content">
          <span class="wb-addr-short">${escapeHtml(key.slice(0, 8))}...${escapeHtml(key.slice(-8))}</span>
          <div class="wb-coin-tag-wrapper">${getCoinLabel(typeId)}</div>
          <span class="wb-balance-tag">${escapeHtml(String(valObj.totalValue || 0))} ${typeId === 0 ? 'PGC' : typeId === 1 ? 'BTC' : 'ETH'}</span>
        </div>
      </summary>`;

      html += '<div class="wb-content">';
      html += '<div style="margin-bottom:12px">';
      html += '<div class="wb-label wb-mb-sm">完整地址</div>';
      html += `<div class="wb-code-box">${escapeHtml(key)}</div>`;
      html += '</div>';

      html += `<div class="wb-row"><span class="wb-label">UTXO 价值</span><span class="wb-value wb-text-success">${valObj.utxoValue || 0}</span></div>`;
      html += `<div class="wb-row"><span class="wb-label">TXCer 价值</span><span class="wb-value wb-text-purple">${valObj.txCerValue || 0}</span></div>`;
      html += `<div class="wb-row"><span class="wb-label">总价值</span><span class="wb-value wb-text-blue-bold">${valObj.totalValue || 0}</span></div>`;
      html += `<div class="wb-row"><span class="wb-label">预估利息</span><span class="wb-value wb-text-warning">${m.estInterest || 0} GAS</span></div>`;

      // UTXOs subsection
      if (utxoCount > 0) {
        html += '<div class="wb-sub-section">';
        html += `<div class="wb-sub-title wb-sub-title-success">UTXOs (${utxoCount})</div>`;
        html += '<div class="wb-utxo-list">';
        Object.keys(utxos).forEach((utxoKey) => {
          const utxo = utxos[utxoKey];
          html += `<div class="wb-utxo-item">`;
          html += `<div class="wb-utxo-info">`;
          html += `<div class="wb-utxo-hash" title="${escapeHtml(utxoKey)}">${escapeHtml(utxoKey)}</div>`;
          html += `<div class="wb-utxo-val">${escapeHtml(String(utxo.Value))} ${getCoinLabel(utxo.Type || 0)}</div>`;
          html += `</div>`;
          html += `<button class="btn secondary wb-btn-xs" onclick="window.showUtxoDetail('${escapeHtml(key)}', '${escapeHtml(utxoKey)}')">详情</button>`;
          html += `</div>`;
        });
        html += '</div></div>';
      }

      // TXCers subsection
      if (txCerCount > 0) {
        html += '<div class="wb-sub-section">';
        html += `<div class="wb-sub-title wb-sub-title-purple">TXCers (${txCerCount})</div>`;
        html += '<div class="wb-utxo-list">';
        Object.keys(txCers).forEach((cerKey) => {
          const cer = txCers[cerKey];
          html += `<div class="wb-utxo-item">`;
          html += `<div class="wb-utxo-info">`;
          html += `<div class="wb-utxo-hash" title="${escapeHtml(cerKey)}">${escapeHtml(cerKey)}</div>`;
          html += `<div class="wb-utxo-val">${escapeHtml(String(cer.Value))} ${getCoinLabel(cer.Type || 0)}</div>`;
          html += `</div>`;
          html += `<button class="btn secondary wb-btn-xs" onclick="window.showTxCerDetail('${escapeHtml(key)}', '${escapeHtml(cerKey)}')">详情</button>`;
          html += `</div>`;
        });
        html += '</div></div>';
      }

      html += '</div></details>';
    });
    
    html += '</div>';
  }

  html += '</div>'; // End of wb-inner-wrapper
  
  box.innerHTML = html;
}
