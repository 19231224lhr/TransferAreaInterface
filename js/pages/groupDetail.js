/**
 * Group Detail Page Module
 * 
 * Handles the group detail page logic including:
 * - Tab switching between "My Organization" and "Search Organization"
 * - Organization search functionality
 * - Leave organization functionality
 */

import { loadUser, saveUser, getJoinedGroup, clearGuarChoice } from '../utils/storage';
import { t } from '../i18n/index.js';
import { showModalTip, showConfirmModal, showUnifiedLoading, hideUnifiedOverlay, showUnifiedError } from '../ui/modal';
import { copyToClipboard, wait } from '../utils/helpers.js';
import { showMiniToast } from '../utils/toast.js';
import { routeTo } from '../router';
import { DOM_IDS, idSelector } from '../config/domIds';
import { leaveGuarGroup, queryGroupInfoSafe } from '../services/group';

// Current active tab
let currentTab = 'myorg';

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
 * Switch between tabs
 */
function switchTab(tabName) {
  currentTab = tabName;
  
  const tabs = document.getElementById(DOM_IDS.groupTabs);
  const myOrgPane = document.getElementById(DOM_IDS.groupMyOrgPane);
  const searchPane = document.getElementById(DOM_IDS.groupSearchPane);
  
  // Update tabs data attribute for slider animation
  if (tabs) {
    tabs.dataset.active = tabName;
  }
  
  // Update tab button states
  const tabButtons = document.querySelectorAll(`${idSelector(DOM_IDS.groupTabs)} .group-tab`);
  tabButtons.forEach(btn => {
    if (btn.dataset.tab === tabName) {
      btn.classList.add('group-tab--active');
    } else {
      btn.classList.remove('group-tab--active');
    }
  });
  
  // Show/hide panels
  if (tabName === 'myorg') {
    if (myOrgPane) myOrgPane.classList.remove('hidden');
    if (searchPane) searchPane.classList.add('hidden');
  } else if (tabName === 'search') {
    if (myOrgPane) myOrgPane.classList.add('hidden');
    if (searchPane) searchPane.classList.remove('hidden');
  }
}

/**
 * Handle organization search
 * Always uses BootNode API to query other organizations
 * (AssignNode's group-info endpoint only returns current group info)
 */
async function handleSearch() {
  const searchInput = document.getElementById(DOM_IDS.groupDetailSearch);
  const searchBtn = document.getElementById(DOM_IDS.groupDetailSearchBtn);
  const loadingEl = document.getElementById(DOM_IDS.groupSearchLoading);
  const notFoundEl = document.getElementById(DOM_IDS.groupSearchNotFound);
  const resultEl = document.getElementById(DOM_IDS.groupSearchResult);
  const emptyEl = document.getElementById(DOM_IDS.groupSearchEmpty);
  
  const groupId = searchInput?.value?.trim();
  if (!groupId) return;
  
  // Validate input (8 digits)
  if (!/^\d{8}$/.test(groupId)) {
    showMiniToast(t('groupDetail.invalidOrgId') || '请输入8位数字组织编号', 'error');
    return;
  }
  
  // Show loading state
  if (loadingEl) loadingEl.classList.remove('hidden');
  if (notFoundEl) notFoundEl.classList.add('hidden');
  if (resultEl) resultEl.classList.add('hidden');
  if (emptyEl) emptyEl.classList.add('hidden');
  if (searchBtn) searchBtn.disabled = true;
  
  try {
    // Always use BootNode API to query other organizations
    // AssignNode's group-info endpoint only returns current group info, not other groups
    console.debug(`[GroupDetail] Querying group ${groupId} via BootNode API`);
    const result = await queryGroupInfoSafe(groupId);
    
    // Hide loading
    if (loadingEl) loadingEl.classList.add('hidden');
    if (searchBtn) searchBtn.disabled = false;
    
    if (result.success && result.data) {
      // Show result
      if (resultEl) resultEl.classList.remove('hidden');
      
      const idEl = document.getElementById(DOM_IDS.groupSearchResultID);
      const aggreEl = document.getElementById(DOM_IDS.groupSearchResultAggre);
      const assignEl = document.getElementById(DOM_IDS.groupSearchResultAssign);
      const aggrAPIEl = document.getElementById(DOM_IDS.groupSearchResultAggrAPI);
      const assignAPIEl = document.getElementById(DOM_IDS.groupSearchResultAssignAPI);
      const pledgeEl = document.getElementById(DOM_IDS.groupSearchResultPledge);
      
      if (idEl) idEl.textContent = result.data.groupID || groupId;
      if (aggreEl) aggreEl.textContent = result.data.aggreNode || '-';
      if (assignEl) assignEl.textContent = result.data.assignNode || '-';
      if (aggrAPIEl) aggrAPIEl.textContent = (result.data.aggrAPIEndpoint || '-').replace(/^:/, '');
      if (assignAPIEl) assignAPIEl.textContent = (result.data.assignAPIEndpoint || '-').replace(/^:/, '');
      if (pledgeEl) pledgeEl.textContent = result.data.pledgeAddress || '-';
    } else {
      // Show not found
      if (notFoundEl) notFoundEl.classList.remove('hidden');
    }
  } catch (error) {
    console.error('[GroupDetail] Search error:', error);
    if (loadingEl) loadingEl.classList.add('hidden');
    if (searchBtn) searchBtn.disabled = false;
    if (notFoundEl) notFoundEl.classList.remove('hidden');
  }
}

/**
 * Handle search input change
 * Validates input format (8 digits only)
 */
function handleSearchInputChange() {
  const searchInput = document.getElementById(DOM_IDS.groupDetailSearch);
  const searchBtn = document.getElementById(DOM_IDS.groupDetailSearchBtn);
  const emptyEl = document.getElementById(DOM_IDS.groupSearchEmpty);
  const notFoundEl = document.getElementById(DOM_IDS.groupSearchNotFound);
  const resultEl = document.getElementById(DOM_IDS.groupSearchResult);
  
  let value = searchInput?.value || '';
  
  // Only allow digits, remove any non-digit characters
  const digitsOnly = value.replace(/\D/g, '');
  
  // Limit to 8 digits
  const limitedValue = digitsOnly.slice(0, 8);
  
  // Update input value if it was modified
  if (searchInput && value !== limitedValue) {
    searchInput.value = limitedValue;
    value = limitedValue;
  }
  
  // Enable button only when exactly 8 digits
  const isValid = /^\d{8}$/.test(value);
  
  if (searchBtn) {
    searchBtn.disabled = !isValid;
  }
  
  // Reset states when input changes
  if (value.length === 0) {
    if (emptyEl) emptyEl.classList.remove('hidden');
    if (notFoundEl) notFoundEl.classList.add('hidden');
    if (resultEl) resultEl.classList.add('hidden');
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
      // Check if user cancelled password input
      if (result.error === 'USER_CANCELLED') {
        console.info(`[GroupDetail] User cancelled password input for leave`);
        showMiniToast(t('common.operationCancelled') || '操作已取消', 'info');
        return;
      }
      
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
  
  // Initialize tab switching
  const tabButtons = document.querySelectorAll(`${idSelector(DOM_IDS.groupTabs)} .group-tab`);
  tabButtons.forEach(btn => {
    if (!btn.dataset._groupBind) {
      btn.dataset._groupBind = 'true';
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab) switchTab(tab);
      });
    }
  });
  
  // Initialize search functionality
  const searchInput = document.getElementById(DOM_IDS.groupDetailSearch);
  const searchBtn = document.getElementById(DOM_IDS.groupDetailSearchBtn);
  
  if (searchInput && !searchInput.dataset._groupBind) {
    searchInput.dataset._groupBind = 'true';
    searchInput.addEventListener('input', handleSearchInputChange);
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !searchBtn?.disabled) {
        handleSearch();
      }
    });
  }
  
  if (searchBtn && !searchBtn.dataset._groupBind) {
    searchBtn.dataset._groupBind = 'true';
    searchBtn.addEventListener('click', handleSearch);
  }
  
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
        const target = btn.dataset.copy;
        const el = target ? document.getElementById(target) : null;
        const text = el ? el.textContent : '';
        if (text && text !== '-') {
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
