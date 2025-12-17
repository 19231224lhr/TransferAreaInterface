/**
 * Group Detail Page Module
 * 
 * Handles the group detail page logic.
 */

import { loadUser, saveUser, getJoinedGroup, clearGuarChoice } from '../utils/storage';
import { t } from '../i18n/index.js';
import { showModalTip, showConfirmModal } from '../ui/modal';
import { copyToClipboard, wait } from '../utils/helpers.js';
import { showMiniToast } from '../utils/toast.js';
import { routeTo } from '../router';

/**
 * Update group detail page display
 */
export function updateGroupDetailDisplay() {
  const g1 = getJoinedGroup();
  const joined1 = !!(g1 && g1.groupID);
  
  const groupJoinedPane = document.getElementById('groupJoinedPane');
  const groupEmptyPane = document.getElementById('groupEmptyPane');
  
  if (joined1) {
    if (groupJoinedPane) groupJoinedPane.classList.remove('hidden');
    if (groupEmptyPane) groupEmptyPane.classList.add('hidden');
    
    const groupDetailID = document.getElementById('groupDetailID');
    const groupDetailAggre = document.getElementById('groupDetailAggre');
    const groupDetailAssign = document.getElementById('groupDetailAssign');
    const groupDetailPledge = document.getElementById('groupDetailPledge');
    
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
 * Handle leaving organization
 */
export function handleLeaveOrg() {
  const u = loadUser();
  if (u) {
    u.orgNumber = '';
    u.guarGroup = null;
    saveUser(u);
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
}

/**
 * Initialize group detail page
 */
export function initGroupDetailPage() {
  updateGroupDetailDisplay();
  
  // Bind leave button event
  const leaveBtn = document.getElementById('groupLeaveBtn');
  if (leaveBtn && !leaveBtn.dataset._groupBind) {
    leaveBtn.dataset._groupBind = 'true';
    leaveBtn.addEventListener('click', () => {
      // Show confirm modal
      const modal = document.getElementById('leaveOrgModal');
      if (modal) modal.classList.remove('hidden');
    });
  }
  
  // Bind confirm leave button
  const confirmLeaveBtn = document.getElementById('confirmLeaveBtn');
  if (confirmLeaveBtn && !confirmLeaveBtn.dataset._groupBind) {
    confirmLeaveBtn.dataset._groupBind = 'true';
    confirmLeaveBtn.addEventListener('click', () => {
      const modal = document.getElementById('leaveOrgModal');
      if (modal) modal.classList.add('hidden');
      handleLeaveOrg();
    });
  }
  
  // Bind cancel leave button
  const cancelLeaveBtn = document.getElementById('cancelLeaveBtn');
  if (cancelLeaveBtn && !cancelLeaveBtn.dataset._groupBind) {
    cancelLeaveBtn.dataset._groupBind = 'true';
    cancelLeaveBtn.addEventListener('click', () => {
      const modal = document.getElementById('leaveOrgModal');
      if (modal) modal.classList.add('hidden');
    });
  }
  
  // Bind copy buttons
  const groupCopyBtns = document.querySelectorAll('#groupDetailCard .info-copy-btn');
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
  const backBtn = document.getElementById('groupDetailBackBtn');
  if (backBtn && !backBtn.dataset._groupBind) {
    backBtn.dataset._groupBind = 'true';
    backBtn.addEventListener('click', () => {
      if (typeof window.PanguPay?.router?.routeTo === 'function') {
        window.PanguPay.router.routeTo('#/main');
      }
    });
  }
  
  // Bind join now button (for empty state)
  const joinNowBtn = document.getElementById('groupJoinNowBtn');
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
  const groupExitBtn = document.getElementById('groupExitBtn');
  const groupBackBtn = document.getElementById('groupBackBtn');
  const groupJoinBtn = document.getElementById('groupJoinBtn');
  const groupEmptyBackBtn = document.getElementById('groupEmptyBackBtn');
  
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
      
      const ov = document.getElementById('actionOverlay');
      const ovt = document.getElementById('actionOverlayText');
      if (ovt) ovt.textContent = t('join.leavingOrg');
      if (ov) ov.classList.remove('hidden');
      await wait(2000);
      if (ov) ov.classList.add('hidden');
      
      const latest = loadUser();
      if (latest) {
        try {
          localStorage.removeItem('guarChoice');
        } catch { }
        latest.guarGroup = null;
        latest.orgNumber = '';
        saveUser(latest);
      }
      
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
      
      // Refresh current page state
      routeTo('#/group-detail');
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
