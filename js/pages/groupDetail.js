/**
 * Group Detail Page Module
 * 
 * Handles the group detail page logic.
 */

import { loadUser, saveUser, getJoinedGroup, clearGuarChoice } from '../utils/storage';
import { t } from '../i18n/index.js';
import { showModalTip, showConfirmModal, showUnifiedLoading, hideUnifiedOverlay, showUnifiedError } from '../ui/modal';
import { copyToClipboard, wait } from '../utils/helpers.js';
import { showMiniToast } from '../utils/toast.js';
import { routeTo } from '../router';
import { DOM_IDS, idSelector } from '../config/domIds';
import { leaveGuarGroup } from '../services/group';

/**
 * Update group detail page display
 */
export function updateGroupDetailDisplay() {
  const g1 = getJoinedGroup();
  const joined1 = !!(g1 && g1.groupID);
  
  const groupJoinedPane = document.getElementById(DOM_IDS.groupJoinedPane);
  const groupEmptyPane = document.getElementById(DOM_IDS.groupEmptyPane);
  
  if (joined1) {
    if (groupJoinedPane) groupJoinedPane.classList.remove('hidden');
    if (groupEmptyPane) groupEmptyPane.classList.add('hidden');
    
    const groupDetailID = document.getElementById(DOM_IDS.groupDetailID);
    const groupDetailAggre = document.getElementById(DOM_IDS.groupDetailAggre);
    const groupDetailAssign = document.getElementById(DOM_IDS.groupDetailAssign);
    const groupDetailPledge = document.getElementById(DOM_IDS.groupDetailPledge);
    
    if (groupDetailID) groupDetailID.textContent = g1.groupID || '-';
    if (groupDetailAggre) groupDetailAggre.textContent = g1.aggreNode || '-';
    if (groupDetailAssign) groupDetailAssign.textContent = g1.assignNode || '-';
    if (groupDetailPledge) groupDetailPledge.textContent = g1.pledgeAddress || '-';
  } else {
    if (groupJoinedPane) groupJoinedPane.classList.add('hidden');
    if (groupEmptyPane) groupEmptyPane.classList.remove('hidden');
  }
}

/**
 * Handle leaving organization (with real API call)
 */
export async function handleLeaveOrg() {
  const u = loadUser();
  if (!u || !u.accountId) {
    showModalTip(t('common.notLoggedIn'), t('modal.pleaseLoginFirst'), true);
    return;
  }
  
  // Get current group info
  const group = getJoinedGroup();
  if (!group || !group.groupID) {
    showModalTip(t('toast.notInOrg') || '未加入组织', t('toast.notInOrgDesc') || '您当前未加入任何担保组织', true);
    return;
  }
  
  try {
    // Show loading animation
    showUnifiedLoading(t('join.leavingOrg') || '正在退出组织...');
    
    console.info(`[GroupDetail] 🚀 Attempting to leave organization ${group.groupID}...`);
    
    // Build GroupInfo for API call
    const groupInfo = {
      groupID: group.groupID,
      peerGroupID: '',
      aggreNode: group.aggreNode || '',
      aggrePeerID: '',
      assignNode: group.assignNode || '',
      assignPeerID: '',
      pledgeAddress: group.pledgeAddress || '',
      assignAPIEndpoint: group.assignAPIEndpoint,
      aggrAPIEndpoint: group.aggrAPIEndpoint
    };
    
    // Call leave API
    const result = await leaveGuarGroup(group.groupID, groupInfo);
    
    // Hide loading
    hideUnifiedOverlay();
    
    if (!result.success) {
      console.error(`[GroupDetail] ✗ Failed to leave organization:`, result.error);
      showUnifiedError(
        t('join.leaveFailed') || '退出失败',
        result.error || t('join.leaveFailedDesc') || '退出担保组织失败，请稍后重试'
      );
      return;
    }
    
    console.info(`[GroupDetail] ✓ Successfully left organization ${group.groupID}`);
    
    // Clear local storage
    if (u.accountId) {
      saveUser({ accountId: u.accountId, orgNumber: '', guarGroup: null });
    }
    clearGuarChoice();
    
    // Update UI
    if (typeof window.PanguPay?.wallet?.updateWalletBrief === 'function') {
      window.PanguPay.wallet.updateWalletBrief();
    }
    if (typeof window.PanguPay?.wallet?.refreshOrgPanel === 'function') {
      window.PanguPay.wallet.refreshOrgPanel();
    }
    if (typeof window.updateOrgDisplay === 'function') {
      window.updateOrgDisplay();
    }
    
    showModalTip(t('toast.leftOrg'), t('toast.leftOrgDesc'), false);
    
    // Navigate back to main
    if (typeof window.PanguPay?.router?.routeTo === 'function') {
      window.PanguPay.router.routeTo('#/main');
    }
    
  } catch (error) {
    console.error(`[GroupDetail] ✗ Unexpected error:`, error);
    hideUnifiedOverlay();
    showUnifiedError(
      t('join.leaveFailed') || '退出失败',
      error instanceof Error ? error.message : '未知错误'
    );
  }
}

/**
 * Initialize group detail page
 */
export function initGroupDetailPage() {
  updateGroupDetailDisplay();
  
  // Bind leave button event
  const leaveBtn = document.getElementById(DOM_IDS.groupLeaveBtn);
  if (leaveBtn && !leaveBtn.dataset._groupBind) {
    leaveBtn.dataset._groupBind = 'true';
    leaveBtn.addEventListener('click', () => {
      // Show confirm modal
      const modal = document.getElementById(DOM_IDS.leaveOrgModal);
      if (modal) modal.classList.remove('hidden');
    });
  }
  
  // Bind confirm leave button
  const confirmLeaveBtn = document.getElementById(DOM_IDS.confirmLeaveBtn);
  if (confirmLeaveBtn && !confirmLeaveBtn.dataset._groupBind) {
    confirmLeaveBtn.dataset._groupBind = 'true';
    confirmLeaveBtn.addEventListener('click', () => {
      const modal = document.getElementById(DOM_IDS.leaveOrgModal);
      if (modal) modal.classList.add('hidden');
      handleLeaveOrg();
    });
  }
  
  // Bind cancel leave button
  const cancelLeaveBtn = document.getElementById(DOM_IDS.cancelLeaveBtn);
  if (cancelLeaveBtn && !cancelLeaveBtn.dataset._groupBind) {
    cancelLeaveBtn.dataset._groupBind = 'true';
    cancelLeaveBtn.addEventListener('click', () => {
      const modal = document.getElementById(DOM_IDS.leaveOrgModal);
      if (modal) modal.classList.add('hidden');
    });
  }
  
  // Bind copy buttons
  const groupCopyBtns = document.querySelectorAll(`${idSelector(DOM_IDS.groupDetailCard)} .info-copy-btn`);
  groupCopyBtns.forEach(btn => {
    if (!btn.dataset._groupBind) {
      btn.dataset._groupBind = 'true';
      btn.addEventListener('click', async () => {
        const target = btn.dataset.target;
        const el = target ? document.getElementById(target) : null;
        const text = el ? el.textContent : '';
        if (text) {
          const ok = await copyToClipboard(text);
          if (ok) {
            showMiniToast(t('wallet.copied'), 'success');
          }
        }
      });
    }
  });
  
  // Bind back button
  const backBtn = document.getElementById(DOM_IDS.groupDetailBackBtn);
  if (backBtn && !backBtn.dataset._groupBind) {
    backBtn.dataset._groupBind = 'true';
    backBtn.addEventListener('click', () => {
      if (typeof window.PanguPay?.router?.routeTo === 'function') {
        window.PanguPay.router.routeTo('#/main');
      }
    });
  }
  
  // Bind join now button (for empty state)
  const joinNowBtn = document.getElementById(DOM_IDS.groupJoinNowBtn);
  if (joinNowBtn && !joinNowBtn.dataset._groupBind) {
    joinNowBtn.dataset._groupBind = 'true';
    joinNowBtn.addEventListener('click', () => {
      if (typeof window.PanguPay?.router?.routeTo === 'function') {
        window.PanguPay.router.routeTo('#/join-group');
      }
    });
  }
  
  // Initialize additional group detail buttons (copied from backup)
  initGroupDetailButtons();
}

/**
 * Initialize group detail page buttons (copied from backup)
 */
function initGroupDetailButtons() {
  const groupExitBtn = document.getElementById(DOM_IDS.groupExitBtn);
  const groupBackBtn = document.getElementById(DOM_IDS.groupBackBtn);
  const groupJoinBtn = document.getElementById(DOM_IDS.groupJoinBtn);
  const groupEmptyBackBtn = document.getElementById(DOM_IDS.groupEmptyBackBtn);
  
  if (groupExitBtn && !groupExitBtn.dataset._bind) {
    groupExitBtn.addEventListener('click', async () => {
      const u3 = loadUser();
      if (!u3 || !u3.accountId) {
        showModalTip(t('common.notLoggedIn'), t('modal.pleaseLoginFirst'), true);
        return;
      }
      const confirmed = await showConfirmModal(
        t('modal.leaveOrgTitle'),
        t('modal.leaveOrgDesc'),
        t('common.confirm'),
        t('common.cancel')
      );
      if (!confirmed) return;
      
      // Call the API-backed leave function
      await handleLeaveOrg();
    });
    groupExitBtn.dataset._bind = '1';
  }
  
  if (groupBackBtn && !groupBackBtn.dataset._bind) {
    groupBackBtn.addEventListener('click', () => {
      routeTo('#/main');
    });
    groupBackBtn.dataset._bind = '1';
  }
  
  if (groupJoinBtn && !groupJoinBtn.dataset._bind) {
    groupJoinBtn.addEventListener('click', () => {
      routeTo('#/join-group');
    });
    groupJoinBtn.dataset._bind = '1';
  }
  
  if (groupEmptyBackBtn && !groupEmptyBackBtn.dataset._bind) {
    groupEmptyBackBtn.addEventListener('click', () => {
      routeTo('#/main');
    });
    groupEmptyBackBtn.dataset._bind = '1';
  }
}
