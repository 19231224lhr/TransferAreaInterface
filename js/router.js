/**
 * Router Module
 * 
 * Provides hash-based routing for the SPA.
 */

import { updatePageTranslations } from './i18n/index.js';
import { loadUser, saveUser, getJoinedGroup } from './utils/storage.js';
import { DEFAULT_GROUP, GROUP_LIST } from './config/constants.js';
import { updateHeaderUser } from './ui/header.js';

// Page modules - imported for initialization
import { updateWelcomeButtons } from './pages/welcome.js';
import { updateWalletBrief } from './pages/entry.js';
import { resetLoginPageState } from './pages/login.js';
import { handleCreate, resetCreatingFlag } from './pages/newUser.js';
import { resetImportState } from './pages/import.js';
import { handleMainRoute } from './pages/main.js';
import { startInquiryAnimation } from './pages/joinGroup.js';
import { updateGroupDetailDisplay } from './pages/groupDetail.js';
import { renderWallet, refreshOrgPanel } from './services/wallet.js';
import { initProfilePage } from './ui/profile.js';

// ========================================
// Card References (will be populated on init)
// ========================================
let welcomeCard, entryCard, newUserCard, loginCard, importCard;

/**
 * Initialize card references
 */
function initCardRefs() {
  welcomeCard = document.getElementById('welcomeCard');
  entryCard = document.getElementById('entryCard');
  newUserCard = document.getElementById('newUserCard');
  loginCard = document.getElementById('loginCard');
  importCard = document.getElementById('importCard');
}

/**
 * Show a specific card and hide all others
 * @param {HTMLElement} card - Card element to show
 */
export function showCard(card) {
  if (!card) return;
  
  // Hide all cards
  const allCardIds = [
    'welcomeCard', 'entryCard', 'newUserCard', 'loginCard', 'importCard',
    'nextCard', 'finalCard', 'walletCard', 'importNextCard', 'inquiryCard',
    'memberInfoCard', 'profileCard', 'groupDetailCard'
  ];
  
  allCardIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
  
  // Hide overlays and modals
  const overlayIds = [
    'newLoader', 'importLoader', 'groupSuggest', 'joinOverlay',
    'confirmSkipModal', 'actionOverlay', 'actionModal'
  ];
  
  overlayIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
  
  // Reset search state
  const joinSearchBtn = document.getElementById('joinSearchBtn');
  if (joinSearchBtn) joinSearchBtn.disabled = true;
  const searchResult = document.getElementById('searchResult');
  if (searchResult) searchResult.classList.add('hidden');
  const recPane = document.getElementById('recPane');
  if (recPane) recPane.classList.remove('collapsed');
  const groupSearch = document.getElementById('groupSearch');
  if (groupSearch) groupSearch.value = '';
  
  // Show the specified card
  card.classList.remove('hidden');
  
  // Ensure inner page container is also visible
  const innerPage = card.querySelector('.entry-page, .login-page, .import-page, .new-page, .profile-page');
  if (innerPage) innerPage.classList.remove('hidden');
  
  // Scroll to top
  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });
  
  // Add fade-in animation
  card.classList.remove('fade-in');
  requestAnimationFrame(() => card.classList.add('fade-in'));
}

/**
 * Navigate to a hash route
 * @param {string} hash - Hash route (e.g., '#/welcome')
 */
export function routeTo(hash) {
  if (location.hash !== hash) {
    location.hash = hash;
  }
  // Execute router immediately as fallback
  router();
}

/**
 * Main router function - handles hash changes
 */
export function router() {
  initCardRefs();
  
  const h = (location.hash || '#/welcome').replace(/^#/, '');
  const u = loadUser();
  const allowNoUser = ['/welcome', '/login', '/new', '/profile'];
  
  // Redirect to welcome if not logged in and route requires login
  if (!u && allowNoUser.indexOf(h) === -1) {
    routeTo('#/welcome');
    return;
  }
  
  switch (h) {
    case '/welcome':
      showCard(welcomeCard);
      // Call init function from window to ensure it's available
      if (typeof window.initWelcomePage === 'function') {
        window.initWelcomePage();
      } else {
        updateWelcomeButtons();
      }
      break;
      
    case '/main':
      showCard(document.getElementById('walletCard'));
      if (typeof window.initMainPage === 'function') {
        window.initMainPage();
      } else {
        handleMainRoute();
      }
      break;
      
    case '/entry':
      showCard(entryCard);
      if (typeof window.initEntryPage === 'function') {
        window.initEntryPage();
      } else {
        updateWalletBrief();
      }
      break;
      
    case '/login':
      showCard(loginCard);
      if (typeof window.initLoginPage === 'function') {
        window.initLoginPage();
      } else {
        resetLoginPageState();
      }
      break;
      
    case '/new':
      resetOrgSelectionForNewUser();
      showCard(newUserCard);
      if (typeof window.initNewUserPage === 'function') {
        window.initNewUserPage();
      }
      handleNewUserRoute();
      break;
      
    case '/import':
      showCard(importCard);
      if (typeof window.initImportPage === 'function') {
        window.initImportPage();
      } else {
        resetImportState('account');
      }
      break;
      
    case '/wallet-import':
      showCard(importCard);
      if (typeof window.resetImportState === 'function') {
        window.resetImportState('wallet');
      }
      if (typeof window.initImportPage === 'function') {
        window.initImportPage();
      }
      break;
      
    case '/join-group':
      handleJoinGroupRoute();
      if (typeof window.initJoinGroupPage === 'function') {
        window.initJoinGroupPage();
      }
      break;
      
    case '/group-detail':
      showCard(document.getElementById('groupDetailCard'));
      if (typeof window.initGroupDetailPage === 'function') {
        window.initGroupDetailPage();
      } else {
        updateGroupDetailDisplay();
      }
      break;
      
    case '/inquiry':
      showCard(document.getElementById('inquiryCard'));
      startInquiryAnimation(() => {
        const u3 = loadUser();
        if (u3) {
          u3.orgNumber = '10000000';
          saveUser(u3);
        }
        // 直接跳转到 main 页面，不显示 member-info 页面
        routeTo('#/main');
      });
      break;
      
    case '/inquiry-main':
      showCard(document.getElementById('inquiryCard'));
      startInquiryAnimation(() => {
        routeTo('#/main');
      });
      break;
      
    case '/member-info':
      showCard(document.getElementById('memberInfoCard'));
      handleMemberInfoRoute();
      break;
      
    case '/profile':
      showCard(document.getElementById('profileCard'));
      initProfilePage();
      break;
      
    default:
      showCard(welcomeCard);
      updateWelcomeButtons();
  }
  
  // Update translations after route change
  updatePageTranslations();
  
  // Update header user display
  const currentUser = loadUser();
  updateHeaderUser(currentUser);
}

/**
 * Reset organization selection for new user
 */
function resetOrgSelectionForNewUser() {
  try {
    localStorage.removeItem('guarChoice');
  } catch (_) { }
}



/**
 * Handle /new route
 */
function handleNewUserRoute() {
  resetCreatingFlag();
  
  const resultEl = document.getElementById('result');
  const createBtn = document.getElementById('createBtn');
  const newNextBtn = document.getElementById('newNextBtn');
  const newLoader = document.getElementById('newLoader');
  
  if (newLoader) newLoader.classList.add('hidden');
  
  const accountIdEl = document.getElementById('accountId');
  const hasData = accountIdEl && accountIdEl.textContent.trim() !== '';
  
  if (hasData) {
    if (resultEl) resultEl.classList.remove('hidden');
    if (createBtn) createBtn.classList.remove('hidden');
    if (newNextBtn) newNextBtn.classList.remove('hidden');
  } else {
    if (resultEl) resultEl.classList.add('hidden');
    handleCreate(false).catch(() => { });
  }
}

/**
 * Handle /join-group route
 */
function handleJoinGroupRoute() {
  const g0 = getJoinedGroup();
  const joined = !!(g0 && g0.groupID);
  
  if (joined) {
    routeTo('#/inquiry-main');
    return;
  }
  
  showCard(document.getElementById('nextCard'));
  
  // Set default group info
  const recGroupID = document.getElementById('recGroupID');
  const recAggre = document.getElementById('recAggre');
  const recAssign = document.getElementById('recAssign');
  const recPledge = document.getElementById('recPledge');
  
  if (recGroupID) recGroupID.textContent = DEFAULT_GROUP.groupID;
  if (recAggre) recAggre.textContent = DEFAULT_GROUP.aggreNode;
  if (recAssign) recAssign.textContent = DEFAULT_GROUP.assignNode;
  if (recPledge) recPledge.textContent = DEFAULT_GROUP.pledgeAddress;
}

/**
 * Handle /member-info route
 */
function handleMemberInfoRoute() {
  const u4 = loadUser();
  const aEl = document.getElementById('miAccountId');
  const addrEl = document.getElementById('miAddress');
  const orgEl = document.getElementById('miOrg');
  
  if (aEl) aEl.textContent = u4?.accountId || '-';
  if (addrEl) addrEl.textContent = u4?.address || '-';
  if (orgEl) orgEl.textContent = u4?.orgNumber || '-';
  
  // Bind confirm button to go to main page
  const miConfirmBtn = document.getElementById('miConfirmBtn');
  if (miConfirmBtn && !miConfirmBtn.dataset._bind) {
    miConfirmBtn.dataset._bind = '1';
    miConfirmBtn.addEventListener('click', () => routeTo('#/main'));
  }
}

/**
 * Initialize router
 */
export function initRouter() {
  initCardRefs();
  
  // Listen for hash changes
  window.addEventListener('hashchange', router);
  
  // Initial route
  router();
}
