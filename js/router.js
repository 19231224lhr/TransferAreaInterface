/**
 * Router Module
 * 
 * Provides hash-based routing for the SPA with dynamic page loading support.
 */

import { t, updatePageTranslations } from './i18n/index.js';
import { loadUser, saveUser, getJoinedGroup } from './utils/storage';
import { DEFAULT_GROUP, GROUP_LIST } from './config/constants.ts';
import { updateHeaderUser, initUserMenu } from './ui/header';
import { cleanupPageListeners } from './utils/eventUtils.js';
import { store, setRoute } from './utils/store.js';
import { withLoading } from './utils/loading';
import { navigateTo as enhancedNavigateTo } from './utils/enhancedRouter';
import { pageManager } from './utils/pageManager';
import { getPageConfig, getAllContainerIds } from './config/pageTemplates';

// Lazy page loaders (registered on demand)
const pageLoaders = {
  '/welcome': () => import('./pages/welcome.js'),
  '/entry': () => import('./pages/entry.js'),
  '/login': () => import('./pages/login.ts'),
  '/new': () => import('./pages/newUser.js'),
  '/set-password': () => import('./pages/setPassword.js'),
  '/import': () => import('./pages/import'),
  '/wallet-import': () => import('./pages/import'),
  '/main': () => import('./pages/main.js'),
  '/join-group': () => import('./pages/joinGroup'),
  '/inquiry': () => import('./pages/joinGroup'),
  '/inquiry-main': () => import('./pages/joinGroup'),
  '/group-detail': () => import('./pages/groupDetail.js'),
  '/profile': () => import('./ui/profile.js'),
  '/history': () => import('./pages/history.js')
};

// Route to page config mapping
const routeToPageId = {
  '/welcome': 'welcome',
  '/entry': 'entry',
  '/new': 'new',
  '/set-password': 'set-password',
  '/login': 'login',
  '/import': 'import',
  '/wallet-import': 'import',
  '/main': 'main',
  '/join-group': 'join-group',
  '/inquiry': 'inquiry',
  '/inquiry-main': 'inquiry',
  '/group-detail': 'group-detail',
  '/profile': 'profile',
  '/history': 'history'
};

/**
 * Dynamically load a page module for the given route
 * @param {string} route
 * @returns {Promise<any|null>}
 */
async function loadPageModule(route) {
  const loader = pageLoaders[route];
  if (!loader) return null;
  try {
    return await withLoading(
      loader(),
      t('common.loading') || '加载中...'
    );
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
 * Ensure a page is loaded (using pageManager for dynamic loading)
 * Templates are loaded from /assets/templates/pages/
 * @param {string} pageId - Page identifier
 * @returns {Promise<HTMLElement|null>}
 */
async function ensurePageLoaded(pageId) {
  const config = getPageConfig(pageId);
  if (!config) {
    console.warn(`[router] No config for page: ${pageId}`);
    return null;
  }

  // Check if already loaded in DOM (from previous navigation)
  let element = document.getElementById(config.containerId);
  if (element) {
    return element;
  }

  // Use pageManager to load dynamically from template files
  if (!pageManager.isInitialized()) {
    console.error('[router] pageManager not initialized, cannot load page:', pageId);
    return null;
  }

  try {
    element = await pageManager.ensureLoaded(pageId);
    if (!element) {
      console.error(`[router] Failed to load page template: ${pageId}`);
    }
    return element;
  } catch (err) {
    console.error(`[router] Error loading page ${pageId}:`, err);
    return null;
  }
}

/**
 * Intercept hash anchor clicks so navigation goes through enhanced router/guards
 */
function bindHashLinkNavigation() {
  if (window._hashLinkNavBind) return;
  window._hashLinkNavBind = true;

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const anchor = target.closest('a[href^="#"]');
    if (!anchor) return;

    // Allow opting out
    if (anchor.dataset.routerBypass === 'true') return;

    const href = anchor.getAttribute('href') || '';
    const hash = href.replace(/^#/, '');
    if (!hash) return;

    event.preventDefault();

    void enhancedNavigateTo(hash).then((result) => {
      // If navigation was blocked, keep current view
      if (result === false) return;

      // If hash didn't actually change, force UI refresh
      const current = (location.hash || '#').replace(/^#/, '');
      if (current === hash) {
        router();
      }
    }).catch(() => {
      // Fallback to legacy routing on error
      router();
    });
  });
}

/**
 * Show a specific card and hide all others
 * @param {HTMLElement} card - Card element to show
 */
export function showCard(card) {
  if (!card) return;

  // Hide all cards - use dynamic list from config
  const allCardIds = getAllContainerIds();

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
  const innerPage = card.querySelector('.entry-page, .login-page, .import-page, .new-page, .profile-page, .setpwd-page, .group-page, .history-page, .join-page, .inquiry-page, .wallet-main');
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
  const targetPath = (hash || '#/welcome').replace(/^#/, '');
  const previous = (location.hash || '#').replace(/^#/, '');

  void enhancedNavigateTo(targetPath).then((result) => {
    // If navigation was blocked, do nothing
    if (result === false) {
      return;
    }

    // If hash did not change (same route), manually run router to refresh UI
    const current = (location.hash || '#').replace(/^#/, '');
    if (current === previous && current === targetPath) {
      router();
    }
  }).catch(() => {
    // Fallback to original behavior on error
    router();
  });
}

/**
 * Main router function - handles hash changes with dynamic page loading
 */
export async function router() {
  // Clean up page-level event listeners from previous page to prevent memory leaks
  cleanupPageListeners();

  // Reinitialize header user menu after cleanup
  initUserMenu();

  const h = (location.hash || '#/welcome').replace(/^#/, '');
  const u = loadUser();
  const allowNoUser = ['/welcome', '/login', '/new', '/set-password', '/profile'];

  // Update route state in store for centralized state management
  setRoute(h);

  // Redirect to welcome if not logged in and route requires login
  if (!u && allowNoUser.indexOf(h) === -1) {
    routeTo('#/welcome');
    return;
  }

  // Get page ID for the route
  const pageId = routeToPageId[h] || 'welcome';

  // Ensure page is loaded
  const pageElement = await ensurePageLoaded(pageId);

  // If page failed to load, show error and return
  if (!pageElement) {
    console.error(`[router] Page not loaded for route: ${h}`);
    // Try to show a fallback error message
    const main = document.getElementById('main');
    if (main && !document.getElementById('pageLoadError')) {
      const errorDiv = document.createElement('div');
      errorDiv.id = 'pageLoadError';
      errorDiv.className = 'page-load-error';
      errorDiv.innerHTML = `
        <div style="text-align:center;padding:60px 20px;">
          <h2 style="color:#ef4444;margin-bottom:16px;">页面加载失败</h2>
          <p style="color:#64748b;margin-bottom:24px;">无法加载页面模板，请刷新重试</p>
          <button onclick="location.reload()" style="padding:12px 24px;background:#0ea5e9;color:white;border:none;border-radius:8px;cursor:pointer;">刷新页面</button>
        </div>
      `;
      main.appendChild(errorDiv);
    }
    return;
  }

  // Remove any previous error message
  const errorEl = document.getElementById('pageLoadError');
  if (errorEl) errorEl.remove();

  switch (h) {
    case '/welcome':
      showCard(pageElement);
      void callPageFn('/welcome', 'initWelcomePage', 'updateWelcomeButtons');
      break;

    case '/main':
      showCard(pageElement);
      void callPageFn('/main', 'initMainPage', 'handleMainRoute');
      break;

    case '/entry':
      showCard(pageElement);
      void callPageFn('/entry', 'initEntryPage', 'updateWalletBrief');
      break;

    case '/login':
      showCard(pageElement);
      void callPageFn('/login', 'initLoginPage', 'resetLoginPageState');
      break;

    case '/new':
      resetOrgSelectionForNewUser();
      showCard(pageElement);
      void callPageFn('/new', 'initNewUserPage');
      handleNewUserRoute();
      break;

    case '/set-password':
      showCard(pageElement);
      void callPageFn('/set-password', 'initSetPasswordPage');
      break;

    case '/import':
      showCard(pageElement);
      void callPageFn('/import', 'initImportPage', 'resetImportState');
      break;

    case '/wallet-import':
      showCard(pageElement);
      void loadPageModule('/wallet-import').then((mod) => {
        const resetFn = (mod && typeof mod.resetImportState === 'function') ? mod.resetImportState : (typeof window.resetImportState === 'function' ? window.resetImportState : null);
        if (resetFn) resetFn('wallet');
        const initFn = (mod && typeof mod.initImportPage === 'function') ? mod.initImportPage : (typeof window.initImportPage === 'function' ? window.initImportPage : null);
        if (initFn) initFn();
      });
      break;

    case '/join-group':
      await handleJoinGroupRoute(pageElement);
      void callPageFn('/join-group', 'initJoinGroupPage');
      break;

    case '/group-detail':
      showCard(pageElement);
      void callPageFn('/group-detail', 'initGroupDetailPage', 'updateGroupDetailDisplay');
      break;

    case '/inquiry':
      showCard(pageElement);
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
      showCard(pageElement);
      void loadPageModule('/inquiry-main').then((mod) => {
        const fn = (mod && typeof mod.startInquiryAnimation === 'function') ? mod.startInquiryAnimation : (typeof window.startInquiryAnimation === 'function' ? window.startInquiryAnimation : null);
        if (!fn) return;
        fn(() => {
          routeTo('#/main');
        });
      });
      break;

    case '/profile':
      showCard(pageElement);
      void callPageFn('/profile', 'initProfilePage');
      break;

    case '/history':
      showCard(pageElement);
      void callPageFn('/history', 'initHistoryPage', 'resetHistoryPageState');
      break;

    default:
      showCard(pageElement);
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
async function handleJoinGroupRoute(preloadedElement) {
  const g0 = getJoinedGroup();
  const joined = !!(g0 && g0.groupID);

  if (joined) {
    routeTo('#/inquiry-main');
    return;
  }

  // Use preloaded element (already loaded by router)
  if (preloadedElement) {
    showCard(preloadedElement);

    // Set default group info (elements are now in the loaded template)
    const recGroupID = document.getElementById('recGroupID');
    const recAggre = document.getElementById('recAggre');
    const recAssign = document.getElementById('recAssign');
    const recPledge = document.getElementById('recPledge');

    if (recGroupID) recGroupID.textContent = DEFAULT_GROUP.groupID;
    if (recAggre) recAggre.textContent = DEFAULT_GROUP.aggreNode;
    if (recAssign) recAssign.textContent = DEFAULT_GROUP.assignNode;
    if (recPledge) recPledge.textContent = DEFAULT_GROUP.pledgeAddress;
  }
}

/**
 * Initialize router
 */
export function initRouter() {
  bindHashLinkNavigation();

  // Listen for hash changes - only bind once
  if (!window._routerHashChangeBind) {
    window.addEventListener('hashchange', () => {
      router();
    });
    window._routerHashChangeBind = true;
  }

  // Initial route
  router();
}
