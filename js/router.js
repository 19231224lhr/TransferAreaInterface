/**
 * Router Module
 * 
 * Provides hash-based routing for the SPA.
 */

import { updatePageTranslations } from './i18n/index.js';
import { loadUser, saveUser, getJoinedGroup } from './utils/storage';
import { DEFAULT_GROUP, GROUP_LIST } from './config/constants.ts';
import { updateHeaderUser, initUserMenu } from './ui/header.js';
import { cleanupPageListeners } from './utils/eventUtils.js';
import { store, setRoute } from './utils/store.js';

// Lazy page loaders (registered on demand)
const pageLoaders = {
  '/welcome': () => import('./pages/welcome.js'),
  '/entry': () => import('./pages/entry.js'),
  '/login': () => import('./pages/login.js'),
  '/new': () => import('./pages/newUser.js'),
  '/import': () => import('./pages/import.js'),
  '/wallet-import': () => import('./pages/import.js'),
  '/main': () => import('./pages/main.js'),
  '/join-group': () => import('./pages/joinGroup.js'),
  '/inquiry': () => import('./pages/joinGroup.js'),
  '/inquiry-main': () => import('./pages/joinGroup.js'),
  '/group-detail': () => import('./pages/groupDetail.js'),
  '/profile': () => import('./ui/profile.js'),
  '/history': () => import('./pages/history.js')
};

// ========================================
// Card References (will be populated on init)
// ========================================
let welcomeCard, entryCard, newUserCard, loginCard, importCard;

/**
 * Dynamically load a page module for the given route
 * @param {string} route
 * @returns {Promise<any|null>}
 */
async function loadPageModule(route) {
  const loader = pageLoaders[route];
  if (!loader) return null;
  try {
    return await loader();
  } catch (err) {
    console.warn(`[router] failed to load page '${route}'`, err);
    return null;
  }
}

/**
 * Best-effort helper to call a function exposed either on window or on the lazy-loaded module
 */
async function callPageFn(route, fnName, fallbackFnName) {
  const mod = await loadPageModule(route);
  const fn = (typeof window[fnName] === 'function') ? window[fnName] : (mod && typeof mod[fnName] === 'function' ? mod[fnName] : null);
  const fb = fallbackFnName ? ((typeof window[fallbackFnName] === 'function') ? window[fallbackFnName] : (mod && typeof mod[fallbackFnName] === 'function' ? mod[fallbackFnName] : null)) : null;
  if (fn) {
    fn();
  } else if (fb) {
    fb();
  }
}

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
    'nextCard', 'walletCard', 'inquiryCard',
    'profileCard', 'groupDetailCard', 'historyCard'
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
  
  // Control footer visibility (hide on welcome page, show on others)
  const pageFooter = document.getElementById('pageFooter');
  if (pageFooter) {
    if (card.id === 'welcomeCard') {
      pageFooter.classList.add('hidden');
    } else {
      pageFooter.classList.remove('hidden');
    }
  }
  
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
  // Clean up page-level event listeners from previous page to prevent memory leaks
  cleanupPageListeners();
  
  // Reinitialize header user menu after cleanup
  initUserMenu();
  
  initCardRefs();
  
  const h = (location.hash || '#/welcome').replace(/^#/, '');
  const u = loadUser();
  const allowNoUser = ['/welcome', '/login', '/new', '/profile'];
  
  // Update route state in store for centralized state management
  setRoute(h);
  
  // Redirect to welcome if not logged in and route requires login
  if (!u && allowNoUser.indexOf(h) === -1) {
    routeTo('#/welcome');
    return;
  }
  
  switch (h) {
    case '/welcome':
      showCard(welcomeCard);
      void callPageFn('/welcome', 'initWelcomePage', 'updateWelcomeButtons');
      break;
      
    case '/main':
      showCard(document.getElementById('walletCard'));
      void callPageFn('/main', 'initMainPage', 'handleMainRoute');
      break;
      
    case '/entry':
      showCard(entryCard);
      void callPageFn('/entry', 'initEntryPage', 'updateWalletBrief');
      break;
      
    case '/login':
      showCard(loginCard);
      void callPageFn('/login', 'initLoginPage', 'resetLoginPageState');
      break;
      
    case '/new':
      resetOrgSelectionForNewUser();
      showCard(newUserCard);
      void callPageFn('/new', 'initNewUserPage');
      handleNewUserRoute();
      break;
      
    case '/import':
      showCard(importCard);
      void callPageFn('/import', 'initImportPage', 'resetImportState');
      break;
      
    case '/wallet-import':
      showCard(importCard);
      void loadPageModule('/wallet-import').then((mod) => {
        const resetFn = (mod && typeof mod.resetImportState === 'function') ? mod.resetImportState : (typeof window.resetImportState === 'function' ? window.resetImportState : null);
        if (resetFn) resetFn('wallet');
        const initFn = (mod && typeof mod.initImportPage === 'function') ? mod.initImportPage : (typeof window.initImportPage === 'function' ? window.initImportPage : null);
        if (initFn) initFn();
      });
      break;
      
    case '/join-group':
      handleJoinGroupRoute();
      void callPageFn('/join-group', 'initJoinGroupPage');
      break;
      
    case '/group-detail':
      showCard(document.getElementById('groupDetailCard'));
      void callPageFn('/group-detail', 'initGroupDetailPage', 'updateGroupDetailDisplay');
      break;
      
    case '/inquiry':
      showCard(document.getElementById('inquiryCard'));
      void loadPageModule('/inquiry').then((mod) => {
        const fn = (mod && typeof mod.startInquiryAnimation === 'function') ? mod.startInquiryAnimation : (typeof window.startInquiryAnimation === 'function' ? window.startInquiryAnimation : null);
        if (!fn) return;
        fn(() => {
          const u3 = loadUser();
          if (u3) {
            u3.orgNumber = '10000000';
            saveUser(u3);
          }
          routeTo('#/main');
        });
      });
      break;
      
    case '/inquiry-main':
      showCard(document.getElementById('inquiryCard'));
      void loadPageModule('/inquiry-main').then((mod) => {
        const fn = (mod && typeof mod.startInquiryAnimation === 'function') ? mod.startInquiryAnimation : (typeof window.startInquiryAnimation === 'function' ? window.startInquiryAnimation : null);
        if (!fn) return;
        fn(() => {
          routeTo('#/main');
        });
      });
      break;
      
    case '/profile':
      showCard(document.getElementById('profileCard'));
      void callPageFn('/profile', 'initProfilePage');
      break;
      
    case '/history':
      showCard(document.getElementById('historyCard'));
      void callPageFn('/history', 'initHistoryPage', 'resetHistoryPageState');
      break;
      
    default:
      showCard(welcomeCard);
      void callPageFn('/welcome', 'updateWelcomeButtons');
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
  const doReset = async () => {
    const mod = await loadPageModule('/new');
    const fn = (mod && typeof mod.resetCreatingFlag === 'function') ? mod.resetCreatingFlag : (typeof window.resetCreatingFlag === 'function' ? window.resetCreatingFlag : null);
    if (fn) fn();
  };
  void doReset();
  
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
    const startCreate = async () => {
      const mod = await loadPageModule('/new');
      const fn = (mod && typeof mod.handleCreate === 'function') ? mod.handleCreate : (typeof window.handleCreate === 'function' ? window.handleCreate : null);
      if (fn) {
        try { await fn(false); } catch (_) { }
      }
    };
    void startCreate();
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
 * Initialize router
 */
export function initRouter() {
  initCardRefs();
  
  // Listen for hash changes - only bind once
  if (!window._routerHashChangeBind) {
    window.addEventListener('hashchange', router);
    window._routerHashChangeBind = true;
  }
  
  // Initial route
  router();
}
