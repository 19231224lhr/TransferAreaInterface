/**
 * Main Wallet Page Module
 * 
 * Handles the main wallet page logic.
 */

import { loadUser, saveUser, getJoinedGroup } from '../utils/storage.ts';
import { renderWallet, refreshOrgPanel, initAddressModal, initTransferModeTabs, rebuildAddrList, initRefreshSrcAddrList, initChangeAddressSelects, initRecipientCards, initAdvancedOptions, showWalletSkeletons } from '../services/wallet';
import { initTransferSubmit, initBuildTransaction } from '../services/transfer.ts';
import { initTransferDraftPersistence, restoreTransferDraft } from '../services/transferDraft.ts';
import { initWalletStructToggle, initTxDetailModal } from '../ui/walletStruct.js';
import { initNetworkChart, cleanupNetworkChart } from '../ui/networkChart.js';
import { DEFAULT_GROUP, GROUP_LIST } from '../config/constants.ts';

// Re-export for convenience
export { renderWallet };

/**
 * Handle main route initialization
 * Processes any pending organization choice and renders wallet
 */
export function handleMainRoute() {
  // 首先显示骨架屏，提供更好的加载体验
  showWalletSkeletons();
  
  try {
    const raw = localStorage.getItem('guarChoice');
    const choice = raw ? JSON.parse(raw) : null;
    if (choice && choice.type === 'join') {
      const u2 = loadUser();
      if (u2 && u2.accountId) {
        const g = Array.isArray(GROUP_LIST) ? GROUP_LIST.find(x => x.groupID === choice.groupID) : null;
        saveUser({
          accountId: u2.accountId,
          orgNumber: choice.groupID,
          guarGroup: g || DEFAULT_GROUP
        });
      }
    }
  } catch (_) { }
  
  // 渲染实际内容（会自动替换骨架屏）
  renderWallet();
  refreshOrgPanel();
  
  // Initialize wallet chart after rendering
  if (typeof window.PanguPay?.charts?.initWalletChart === 'function') {
    window.PanguPay.charts.initWalletChart();
  }
  
  // Initialize network chart for transfer panel
  initNetworkChart();
  
  // Initialize address modal buttons
  initAddressModal();
  
  // Initialize transfer mode tabs
  initTransferModeTabs();
  
  // Initialize change address custom selects
  initChangeAddressSelects();
  
  // Initialize recipient cards
  initRecipientCards();
  
  // Initialize advanced options collapse
  initAdvancedOptions();
  
  // Initialize and rebuild source address list
  initRefreshSrcAddrList();
  rebuildAddrList();

  // Restore transfer draft after UI is ready (best-effort)
  restoreTransferDraft().catch(() => {});
  
  // Initialize transfer submit and build transaction
  initTransferSubmit();
  initBuildTransaction();

  // Start transfer draft auto-save
  try {
    const stop = initTransferDraftPersistence();
    window._stopTransferDraft = stop;
  } catch (_) {
    // ignore
  }
  
  // Initialize wallet structure toggle
  initWalletStructToggle();
  
  // Initialize transaction detail modal
  initTxDetailModal();
  
  // Initialize no-org-warn button (copied from backup lines 6227-6281)
  initNoOrgWarnBtn();
}

/**
 * Initialize main wallet page
 */
export function initMainPage() {
  handleMainRoute();
  // 按钮事件已在 wallet.ts 的 renderWallet 中直接绑定
}

/**
 * Initialize no-org-warn button (copied from backup lines 6227-6281)
 */
function initNoOrgWarnBtn() {
  const noOrgWarnBtn = document.getElementById('noOrgWarnBtn');
  const noOrgModal = document.getElementById('noOrgModal');
  const noOrgModalCancel = document.getElementById('noOrgModalCancel');
  const noOrgModalOk = document.getElementById('noOrgModalOk');
  
  if (noOrgWarnBtn && noOrgModal && !noOrgWarnBtn.dataset._bind) {
    // Show modal
    const showNoOrgModal = () => {
      noOrgModal.classList.remove('hidden');
    };
    
    // Hide modal
    const hideNoOrgModal = () => {
      noOrgModal.classList.add('hidden');
    };
    
    // Warning button click event
    noOrgWarnBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showNoOrgModal();
    });
    
    // Click overlay to close
    noOrgModal.addEventListener('click', (e) => {
      if (e.target === noOrgModal) {
        hideNoOrgModal();
      }
    });
    
    // Cancel button
    if (noOrgModalCancel) {
      noOrgModalCancel.addEventListener('click', hideNoOrgModal);
    }
    
    // Confirm button - go to join guarantor organization
    if (noOrgModalOk) {
      noOrgModalOk.addEventListener('click', () => {
        hideNoOrgModal();
        if (typeof window.PanguPay?.router?.routeTo === 'function') {
          window.PanguPay.router.routeTo('#/join-group');
        } else {
          window.location.hash = '#/join-group';
        }
      });
    }
    
    // ESC key to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !noOrgModal.classList.contains('hidden')) {
        hideNoOrgModal();
      }
    });
    
    noOrgWarnBtn.dataset._bind = '1';
  }
}
