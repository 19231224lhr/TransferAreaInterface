/**
 * Join Group Page Module
 * 
 * Handles the join guarantor organization page logic.
 */

import { loadUser, saveUser, getJoinedGroup, saveGuarChoice } from '../utils/storage.js';
import { t } from '../i18n/index.js';
import { DEFAULT_GROUP, GROUP_LIST } from '../config/constants.ts';
import { escapeHtml } from '../utils/security.js';

// Current selected group
let currentSelectedGroup = DEFAULT_GROUP;

/**
 * Reset inquiry page state
 */
export function resetInquiryState() {
  const steps = document.querySelectorAll('#inquirySteps .inquiry-step');
  const lines = document.querySelectorAll('#inquirySteps .inquiry-step-divider');
  const progressFill = document.getElementById('inquiryProgressFill');
  const icon = document.getElementById('inquiryIcon');
  const title = document.getElementById('inquiryTitle');
  const desc = document.getElementById('inquiryDesc');
  const tip = document.getElementById('inquiryTip');
  const tipText = document.getElementById('inquiryTipText');
  const page = document.getElementById('inquiryPage');
  
  // Reset progress bar
  if (progressFill) {
    progressFill.style.width = '0%';
    progressFill.classList.remove('complete');
  }
  
  // Reset steps
  steps.forEach((step, i) => {
    step.classList.remove('active', 'completed', 'waiting');
    if (i === 0) {
      step.classList.add('active');
    } else {
      step.classList.add('waiting');
    }
  });
  
  // Reset connection lines
  lines.forEach(line => {
    line.classList.remove('flowing', 'complete');
  });
  
  // Reset icon
  if (icon) {
    icon.classList.remove('success');
    const iconPulse = icon.querySelector('.icon-pulse');
    const iconCheck = icon.querySelector('.icon-check');
    if (iconPulse) iconPulse.style.display = 'block';
    if (iconCheck) iconCheck.style.display = 'none';
  }
  
  // Reset text
  if (title) {
    title.textContent = t('login.connectingNetwork');
    title.classList.remove('success');
  }
  if (desc) desc.textContent = t('login.establishingConnection');
  
  // Reset tip
  if (tip) tip.classList.remove('success');
  if (tipText) tipText.textContent = t('login.inquiringNetwork');
  
  // Reset page
  if (page) {
    page.classList.remove('success', 'fade-out');
  }
  
  // Reset orbit system
  const orbitSystem = document.getElementById('inquiryOrbitSystem');
  if (orbitSystem) {
    orbitSystem.classList.remove('success');
  }
}

/**
 * Start inquiry animation with stages
 * @param {Function} onComplete - Callback when animation completes
 */
export function startInquiryAnimation(onComplete) {
  // Reset state
  resetInquiryState();
  
  const steps = document.querySelectorAll('#inquirySteps .inquiry-step');
  const lines = document.querySelectorAll('#inquirySteps .inquiry-step-divider');
  const progressFill = document.getElementById('inquiryProgressFill');
  const icon = document.getElementById('inquiryIcon');
  const title = document.getElementById('inquiryTitle');
  const desc = document.getElementById('inquiryDesc');
  const tip = document.getElementById('inquiryTip');
  const tipText = document.getElementById('inquiryTipText');
  const page = document.getElementById('inquiryPage');
  
  // Stage texts
  const stageTexts = [
    { title: t('loading.initializing'), desc: t('loading.initializingDesc') },
    { title: t('loading.connecting'), desc: t('loading.connectingDesc') },
    { title: t('loading.verifying'), desc: t('loading.verifyingDesc') },
    { title: t('loading.success'), desc: t('loading.successDesc') }
  ];
  
  // Update progress and stage status
  function updateStage(stageIndex) {
    // Update progress bar
    const progress = ((stageIndex + 1) / 3) * 100;
    if (progressFill) {
      progressFill.style.width = Math.min(progress, 95) + '%';
    }
    
    // Update text
    if (title && stageTexts[stageIndex]) {
      title.textContent = stageTexts[stageIndex].title;
    }
    if (desc && stageTexts[stageIndex]) {
      desc.textContent = stageTexts[stageIndex].desc;
    }
    
    // Update step status
    steps.forEach((step, i) => {
      step.classList.remove('active', 'completed', 'waiting');
      if (i < stageIndex) {
        step.classList.add('completed');
      } else if (i === stageIndex) {
        step.classList.add('active');
      } else {
        step.classList.add('waiting');
      }
    });
    
    // Update connection lines
    lines.forEach((line, i) => {
      line.classList.remove('flowing', 'complete');
      if (i < stageIndex) {
        line.classList.add('complete');
      } else if (i === stageIndex - 1) {
        line.classList.add('flowing');
      }
    });
  }
  
  // Show success state
  function showSuccess() {
    // Orbit system success state
    const orbitSystem = document.getElementById('inquiryOrbitSystem');
    if (orbitSystem) {
      orbitSystem.classList.add('success');
    }
    
    // Progress bar complete
    if (progressFill) {
      progressFill.style.width = '100%';
      progressFill.classList.add('complete');
    }
    
    // All steps complete
    steps.forEach(step => {
      step.classList.remove('active', 'waiting');
      step.classList.add('completed');
    });
    
    // All connection lines complete
    lines.forEach(line => {
      line.classList.remove('flowing');
      line.classList.add('complete');
    });
    
    // Icon changes to checkmark
    if (icon) {
      icon.classList.add('success');
      const iconPulse = icon.querySelector('.icon-pulse');
      const iconCheck = icon.querySelector('.icon-check');
      if (iconPulse) iconPulse.style.display = 'none';
      if (iconCheck) iconCheck.style.display = 'block';
    }
    
    // Title turns green
    if (title) {
      title.textContent = stageTexts[3].title;
      title.classList.add('success');
    }
    if (desc) {
      desc.textContent = stageTexts[3].desc;
    }
    
    // Tip turns green
    if (tip) tip.classList.add('success');
    if (tipText) tipText.textContent = t('login.verifyingAndRedirecting');
    
    // Page pulse effect
    if (page) page.classList.add('success');
  }
  
  // Fade out and navigate
  function fadeOutAndNavigate() {
    if (page) {
      page.classList.add('fade-out');
    }
    setTimeout(() => {
      if (onComplete) onComplete();
    }, 500);
  }
  
  // Start animation sequence
  // Stage 1: Initialize (0-600ms)
  updateStage(0);
  
  setTimeout(() => {
    // Stage 2: Connect network (600-1600ms)
    updateStage(1);
  }, 600);
  
  setTimeout(() => {
    // Stage 3: Verify account (1600-2600ms)
    updateStage(2);
  }, 1600);
  
  setTimeout(() => {
    // Success state (2600ms)
    showSuccess();
  }, 2600);
  
  setTimeout(() => {
    // Fade out and navigate (3200ms)
    fadeOutAndNavigate();
  }, 3200);
}

/**
 * Get current selected group
 * @returns {Object} Current selected group
 */
export function getCurrentSelectedGroup() {
  return currentSelectedGroup;
}

/**
 * Set current selected group
 * @param {Object} group - Group to set
 */
export function setCurrentSelectedGroup(group) {
  currentSelectedGroup = group;
}

/**
 * Initialize join group page
 */
export function initJoinGroupPage() {
  const g0 = getJoinedGroup();
  const joined = !!(g0 && g0.groupID);
  
  if (joined) {
    // Already joined, redirect to inquiry-main
    if (typeof window.routeTo === 'function') {
      window.routeTo('#/inquiry-main');
    }
    return;
  }
  
  currentSelectedGroup = DEFAULT_GROUP;
  
  // Set default group info
  const recGroupID = document.getElementById('recGroupID');
  const recAggre = document.getElementById('recAggre');
  const recAssign = document.getElementById('recAssign');
  const recPledge = document.getElementById('recPledge');
  
  if (recGroupID) recGroupID.textContent = DEFAULT_GROUP.groupID;
  if (recAggre) recAggre.textContent = DEFAULT_GROUP.aggreNode;
  if (recAssign) recAssign.textContent = DEFAULT_GROUP.assignNode;
  if (recPledge) recPledge.textContent = DEFAULT_GROUP.pledgeAddress;
  
  // Initialize tab switching (copied from backup)
  initJoinTabs();
  
  // Initialize group search input
  initGroupSearch();
  
  // Bind join button event
  const joinRecBtn = document.getElementById('joinRecBtn');
  if (joinRecBtn && !joinRecBtn.dataset._joinBind) {
    joinRecBtn.dataset._joinBind = 'true';
    joinRecBtn.addEventListener('click', () => {
      handleJoinGroup(currentSelectedGroup);
    });
  }
  
  // Bind join search result button event
  const joinSearchBtn = document.getElementById('joinSearchBtn');
  if (joinSearchBtn && !joinSearchBtn.dataset._joinBind) {
    joinSearchBtn.dataset._joinBind = 'true';
    joinSearchBtn.addEventListener('click', async () => {
      if (joinSearchBtn.disabled) return;
      const g = currentSelectedGroup || DEFAULT_GROUP;
      try {
        showUnifiedLoading(t('join.joiningOrg'));
        if (joinRecBtn) joinRecBtn.disabled = true;
        joinSearchBtn.disabled = true;
        await wait(2000);
      } finally {
        hideUnifiedOverlay();
        if (joinRecBtn) joinRecBtn.disabled = false;
        joinSearchBtn.disabled = false;
      }

      // Save to localStorage
      try {
        localStorage.setItem('guarChoice', JSON.stringify({
          type: 'join',
          groupID: g.groupID,
          aggreNode: g.aggreNode,
          assignNode: g.assignNode,
          pledgeAddress: g.pledgeAddress
        }));
      } catch { }

      // Save to user account
      const u = loadUser();
      if (u) {
        u.guarGroup = {
          groupID: g.groupID,
          aggreNode: g.aggreNode,
          assignNode: g.assignNode,
          pledgeAddress: g.pledgeAddress
        };
        u.orgNumber = g.groupID;
        saveUser(u);
      }

      // Navigate to inquiry page
      if (typeof window.routeTo === 'function') {
        window.routeTo('#/inquiry-main');
      }
    });
  }
  
  // Bind skip button event
  const skipJoinBtn = document.getElementById('skipJoinBtn');
  if (skipJoinBtn && !skipJoinBtn.dataset._joinBind) {
    skipJoinBtn.dataset._joinBind = 'true';
    skipJoinBtn.addEventListener('click', () => {
      // Show confirm modal
      const modal = document.getElementById('confirmSkipModal');
      if (modal) modal.classList.remove('hidden');
    });
  }
}

/**
 * Initialize join group tabs with slider effect
 */
function initJoinTabs() {
  const recPane = document.getElementById('recPane');
  const searchPane = document.getElementById('searchPane');
  const joinTabs = document.querySelectorAll('.join-tab');
  const tabsContainer = document.querySelector('.join-tabs');
  
  // Set initial slider position
  if (tabsContainer) {
    tabsContainer.setAttribute('data-active', 'recommend');
  }
  
  joinTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab');
      
      // Update tab state
      joinTabs.forEach(t => t.classList.remove('join-tab--active'));
      tab.classList.add('join-tab--active');
      
      // Update slider position
      if (tabsContainer) {
        tabsContainer.setAttribute('data-active', target);
      }
      
      // Switch panel
      if (target === 'recommend') {
        if (recPane) recPane.classList.remove('hidden');
        if (searchPane) searchPane.classList.add('hidden');
      } else {
        if (recPane) recPane.classList.add('hidden');
        if (searchPane) searchPane.classList.remove('hidden');
      }
    });
  });
}

/**
 * Initialize group search input (copied from backup lines 4215-4241)
 */
function initGroupSearch() {
  const groupSearch = document.getElementById('groupSearch');
  const groupSuggest = document.getElementById('groupSuggest');
  const joinSearchBtn = document.getElementById('joinSearchBtn');
  
  if (!groupSearch) return;
  
  groupSearch.addEventListener('input', () => {
    const q = groupSearch.value.trim();
    if (!q) {
      if (groupSuggest) groupSuggest.classList.add('hidden');
      const sr = document.getElementById('searchResult');
      const searchEmpty = document.getElementById('searchEmpty');
      if (sr) sr.classList.add('hidden');
      if (searchEmpty) searchEmpty.classList.remove('hidden');
      if (joinSearchBtn) joinSearchBtn.disabled = true;
      return;
    }
    const list = GROUP_LIST.filter(g => g.groupID.includes(q)).slice(0, 6);
    if (list.length === 0) { 
      if (groupSuggest) groupSuggest.classList.add('hidden'); 
      return; 
    }
    if (groupSuggest) {
      groupSuggest.innerHTML = list.map(g => `<div class="item" data-id="${escapeHtml(g.groupID)}"><span class="suggest-id"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><span class="suggest-id-text">${escapeHtml(g.groupID)}</span></span><span class="suggest-nodes"><span class="node-badge aggre">${escapeHtml(g.aggreNode)}</span><span class="node-badge assign">${escapeHtml(g.assignNode)}</span></span><span class="suggest-arrow">→</span></div>`).join('');
      groupSuggest.classList.remove('hidden');
    }
  });
  
  groupSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      doSearchById();
    }
  });
  
  if (groupSuggest) {
    groupSuggest.addEventListener('click', (e) => {
      const t = e.target.closest('.item');
      if (!t) return;
      const id = t.getAttribute('data-id');
      const g = GROUP_LIST.find(x => x.groupID === id);
      if (g) showGroupInfo(g);
    });
  }
}

/**
 * Search by group ID
 */
function doSearchById() {
  const groupSearch = document.getElementById('groupSearch');
  const q = groupSearch?.value.trim();
  if (!q) return;
  
  const g = GROUP_LIST.find(x => x.groupID === q);
  if (g) {
    showGroupInfo(g);
  }
}

/**
 * Show group info in search result
 */
function showGroupInfo(group) {
  currentSelectedGroup = group;
  
  const sr = document.getElementById('searchResult');
  const searchEmpty = document.getElementById('searchEmpty');
  const groupSuggest = document.getElementById('groupSuggest');
  const joinSearchBtn = document.getElementById('joinSearchBtn');
  
  if (groupSuggest) groupSuggest.classList.add('hidden');
  if (searchEmpty) searchEmpty.classList.add('hidden');
  
  // Update search result display with correct sr* IDs
  if (sr) {
    const sg = document.getElementById('srGroupID');
    const sa = document.getElementById('srAggre');
    const ss = document.getElementById('srAssign');
    const sp = document.getElementById('srPledge');
    
    if (sg) sg.textContent = group.groupID;
    if (sa) sa.textContent = group.aggreNode;
    if (ss) ss.textContent = group.assignNode;
    if (sp) sp.textContent = group.pledgeAddress;
    
    sr.classList.remove('hidden');
    sr.classList.remove('reveal');
    requestAnimationFrame(() => sr.classList.add('reveal'));
  }
  
  // Enable join button
  if (joinSearchBtn) joinSearchBtn.disabled = false;
}

/**
 * Handle joining a group
 * @param {Object} group - Group to join
 */
export function handleJoinGroup(group) {
  if (!group || !group.groupID) return;
  
  // Save choice
  saveGuarChoice({ type: 'join', groupID: group.groupID });
  
  // Update user
  const u = loadUser();
  if (u) {
    u.orgNumber = group.groupID;
    u.guarGroup = group;
    saveUser(u);
  }
  
  // Navigate to inquiry
  if (typeof window.routeTo === 'function') {
    window.routeTo('#/inquiry');
  }
}
