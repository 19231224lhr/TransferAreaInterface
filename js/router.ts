/**
 * Router Module (TypeScript)
 *
 * Provides hash-based routing for the SPA with dynamic page loading support.
 *
 * Note: This is the single source of truth for routing.
 */

import { t, updatePageTranslations } from './i18n/index.js';
import { loadUser, saveUser, getJoinedGroup, resetOrgSelectionForNewUser } from './utils/storage';
import { DEFAULT_GROUP } from './config/constants';
import { updateHeaderUser, initUserMenu } from './ui/header';
import { cleanupPageListeners } from './utils/eventUtils.js';
import { setRoute } from './utils/store.js';
import { withLoading } from './utils/loading';
import { navigateTo as enhancedNavigateTo } from './utils/enhancedRouter';
import { pageManager } from './utils/pageManager';
import { getPageConfig, getAllContainerIds } from './config/pageTemplates';
import { resetWalletBindings } from './services/wallet';
import { html as viewHtml, renderInto } from './utils/view';
import { DOM_IDS } from './config/domIds';
import { startAccountPolling } from './services/accountPolling';

type PageModule = Record<string, unknown>;

type RoutePath =
  | '/welcome'
  | '/entry'
  | '/login'
  | '/new'
  | '/set-password'
  | '/import'
  | '/wallet-import'
  | '/main'
  | '/join-group'
  | '/inquiry'
  | '/inquiry-main'
  | '/group-detail'
  | '/profile'
  | '/history';

// Lazy page loaders (registered on demand)
const pageLoaders: Record<RoutePath, () => Promise<PageModule>> = {
  '/welcome': () => import('./pages/welcome.js'),
  '/entry': () => import('./pages/entry'),
  '/login': () => import('./pages/login'),
  '/new': () => import('./pages/newUser.js'),
  '/set-password': () => import('./pages/setPassword'),
  '/import': () => import('./pages/import'),
  '/wallet-import': () => import('./pages/import'),
  '/main': () => import('./pages/main.js'),
  '/join-group': () => import('./pages/joinGroup'),
  '/inquiry': () => import('./pages/joinGroup'),
  '/inquiry-main': () => import('./pages/joinGroup'),
  '/group-detail': () => import('./pages/groupDetail.js'),
  '/profile': () => import('./ui/profile'),
  '/history': () => import('./pages/history.js')
};

// Route to page config mapping
const routeToPageId: Record<RoutePath, string> = {
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

function getWindowFn(name: string): (() => void) | null {
  const w = window as unknown as Record<string, unknown>;
  const candidate = w[name];
  return typeof candidate === 'function' ? (candidate as () => void) : null;
}

/**
 * Dynamically load a page module for the given route
 */
async function loadPageModule(route: RoutePath): Promise<PageModule | null> {
  const loader = pageLoaders[route];
  if (!loader) return null;

  try {
    return await withLoading(loader(), t('common.loading') || '加载中...');
  } catch (err) {
    console.warn(`[router] failed to load page '${route}'`, err);
    return null;
  }
}

/**
 * Best-effort helper to call a function exposed either on window or on the lazy-loaded module
 */
async function callPageFn(
  route: RoutePath,
  fnName: string,
  fallbackFnName?: string
): Promise<void> {
  const mod = await loadPageModule(route);

  const fn = getWindowFn(fnName) || (mod && typeof mod[fnName] === 'function' ? (mod[fnName] as () => void) : null);
  const fb =
    fallbackFnName
      ? getWindowFn(fallbackFnName) ||
        (mod && typeof mod[fallbackFnName] === 'function' ? (mod[fallbackFnName] as () => void) : null)
      : null;

  if (fn) fn();
  else if (fb) fb();
}

/**
 * Ensure a page is loaded (using pageManager for dynamic loading)
 * Templates are loaded from /assets/templates/pages/
 */
async function ensurePageLoaded(pageId: string): Promise<HTMLElement | null> {
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
function bindHashLinkNavigation(): void {
  if (window._hashLinkNavBind) return;
  window._hashLinkNavBind = true;

  document.addEventListener('click', (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const anchor = target.closest('a[href^="#"]');
    if (!(anchor instanceof HTMLAnchorElement)) return;

    // Allow opting out
    if (anchor.dataset.routerBypass === 'true') return;

    const href = anchor.getAttribute('href') || '';
    const hash = href.replace(/^#/, '');
    if (!hash) return;

    event.preventDefault();

    void enhancedNavigateTo(hash)
      .then((result) => {
        // If navigation was blocked, keep current view
        if (result === false) return;

        // If hash didn't actually change, force UI refresh
        const current = (location.hash || '#').replace(/^#/, '');
        if (current === hash) {
          void router();
        }
      })
      .catch(() => {
        // Fallback to legacy routing on error
        void router();
      });
  });
}

/**
 * Show a specific card and hide all others
 */
export function showCard(card: HTMLElement): void {
  if (!card) return;

  // Hide all cards - use dynamic list from config
  const allCardIds = getAllContainerIds();

  allCardIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  // Hide overlays and modals
  const overlayIds = [
    DOM_IDS.newLoader,
    DOM_IDS.importLoader,
    DOM_IDS.groupSuggest,
    DOM_IDS.confirmSkipModal,
    DOM_IDS.actionOverlay,
    DOM_IDS.actionModal
  ];

  overlayIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  // Reset search state
  const joinSearchBtn = document.getElementById(DOM_IDS.joinSearchBtn) as HTMLButtonElement | null;
  if (joinSearchBtn) joinSearchBtn.disabled = true;
  const searchResult = document.getElementById(DOM_IDS.searchResult);
  if (searchResult) searchResult.classList.add('hidden');
  const recPane = document.getElementById(DOM_IDS.recPane);
  if (recPane) recPane.classList.remove('collapsed');
  const groupSearch = document.getElementById(DOM_IDS.groupSearch) as HTMLInputElement | null;
  if (groupSearch) groupSearch.value = '';

  // Show the specified card
  card.classList.remove('hidden');

  // Ensure inner page container is also visible
  const innerPage = card.querySelector(
    '.entry-page, .login-page, .import-page, .new-page, .profile-page, .setpwd-page, .group-page, .history-page, .join-page, .inquiry-page, .wallet-main'
  );
  if (innerPage) innerPage.classList.remove('hidden');

  // Control footer visibility (hide on welcome page, show on others)
  const pageFooter = document.getElementById(DOM_IDS.pageFooter);
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
 */
export function routeTo(hash: string): void {
  const targetPath = (hash || '#/welcome').replace(/^#/, '');
  const previous = (location.hash || '#').replace(/^#/, '');

  void enhancedNavigateTo(targetPath)
    .then((result) => {
      // If navigation was blocked, do nothing
      if (result === false) {
        return;
      }

      // If hash did not change (same route), manually run router to refresh UI
      const current = (location.hash || '#').replace(/^#/, '');
      if (current === previous && current === targetPath) {
        void router();
      }
    })
    .catch(() => {
      // Fallback to original behavior on error
      void router();
    });
}

/**
 * Main router function - handles hash changes with dynamic page loading
 */
export async function router(): Promise<void> {
  // Reset wallet binding flags before cleanup so events can be re-bound
  resetWalletBindings();

  // Clean up page-level event listeners from previous page to prevent memory leaks
  cleanupPageListeners();
  
  // Reinitialize header user menu after cleanup
  initUserMenu();

  const h = (location.hash || '#/welcome').replace(/^#/, '') as RoutePath | string;
  const u = loadUser();
  const allowNoUser: string[] = ['/welcome', '/login', '/new', '/set-password', '/profile'];

  // Update route state in store for centralized state management
  setRoute(h);

  // Redirect to welcome if not logged in and route requires login
  if (!u && allowNoUser.indexOf(h) === -1) {
    routeTo('#/welcome');
    return;
  }

  if (u?.accountId) {
    startAccountPolling();
  }

  const route = (Object.prototype.hasOwnProperty.call(pageLoaders, h) ? (h as RoutePath) : '/welcome');

  // Get page ID for the route
  const pageId = routeToPageId[route] || 'welcome';

  // Ensure page is loaded
  const pageElement = await ensurePageLoaded(pageId);

  // If page failed to load, show error and return
  if (!pageElement) {
    console.error(`[router] Page not loaded for route: ${h}`);

    // Try to show a fallback error message
    const main = document.getElementById(DOM_IDS.main);
    if (main && !document.getElementById(DOM_IDS.pageLoadError)) {
      const errorDiv = document.createElement('div');
      errorDiv.id = DOM_IDS.pageLoadError;
      errorDiv.className = 'page-load-error';
        renderInto(errorDiv, viewHtml`
          <div style="text-align:center;padding:60px 20px;">
            <h2 style="color:#ef4444;margin-bottom:16px;">页面加载失败</h2>
            <p style="color:#64748b;margin-bottom:24px;">无法加载页面模板，请刷新重试</p>
            <button data-action="reload" style="padding:12px 24px;background:#0ea5e9;color:white;border:none;border-radius:8px;cursor:pointer;">刷新页面</button>
          </div>
        `);
      main.appendChild(errorDiv);
    }
    return;
  }

  // Remove any previous error message
  const errorEl = document.getElementById(DOM_IDS.pageLoadError);
  if (errorEl) errorEl.remove();

  switch (route) {
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
      void callPageFn('/entry', 'initEntryPage');
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
        const resetFn =
          (mod && typeof mod.resetImportState === 'function'
            ? (mod.resetImportState as (mode?: string) => void)
            : null) ||
          ((window as unknown as Record<string, unknown>).resetImportState as
            | ((mode?: string) => void)
            | undefined);

        if (typeof resetFn === 'function') resetFn('wallet');

        const initFn =
          (mod && typeof mod.initImportPage === 'function' ? (mod.initImportPage as () => void) : null) ||
          getWindowFn('initImportPage');

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
        const candidate =
          (mod && typeof mod.startInquiryAnimation === 'function'
            ? (mod.startInquiryAnimation as (cb: () => void) => void)
            : null) ||
          ((window as unknown as Record<string, unknown>).startInquiryAnimation as
            | ((cb: () => void) => void)
            | undefined);

        if (typeof candidate !== 'function') return;

        candidate(() => {
          const u3 = loadUser();
          if (u3 && u3.accountId) {
            saveUser({ accountId: u3.accountId, orgNumber: '10000000' });
          }
          routeTo('#/main');
        });
      });
      break;

    case '/inquiry-main':
      showCard(pageElement);
      void loadPageModule('/inquiry-main').then((mod) => {
        const candidate =
          (mod && typeof mod.startInquiryAnimation === 'function'
            ? (mod.startInquiryAnimation as (cb: () => void) => void)
            : null) ||
          ((window as unknown as Record<string, unknown>).startInquiryAnimation as
            | ((cb: () => void) => void)
            | undefined);

        if (typeof candidate !== 'function') return;

        candidate(() => {
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
 * Handle /new route
 */
function handleNewUserRoute(): void {
  const doReset = async () => {
    const mod = await loadPageModule('/new');
    const fn =
      (mod && typeof mod.resetCreatingFlag === 'function' ? (mod.resetCreatingFlag as () => void) : null) ||
      getWindowFn('resetCreatingFlag');
    if (fn) fn();
  };
  void doReset();

  const resultEl = document.getElementById(DOM_IDS.result);
  const createBtn = document.getElementById(DOM_IDS.createBtn);
  const newNextBtn = document.getElementById(DOM_IDS.newNextBtn);
  const newLoader = document.getElementById(DOM_IDS.newLoader);

  if (newLoader) newLoader.classList.add('hidden');

  const accountIdEl = document.getElementById(DOM_IDS.accountId);
  const hasData = !!(accountIdEl && (accountIdEl.textContent || '').trim() !== '');

  if (hasData) {
    if (resultEl) resultEl.classList.remove('hidden');
    if (createBtn) createBtn.classList.remove('hidden');
    if (newNextBtn) newNextBtn.classList.remove('hidden');
  } else {
    if (resultEl) resultEl.classList.add('hidden');
    const startCreate = async () => {
      const mod = await loadPageModule('/new');
      const fn =
        (mod && typeof mod.handleCreate === 'function'
          ? (mod.handleCreate as (isRetry?: boolean) => Promise<void>)
          : null) ||
        (((window as unknown as Record<string, unknown>).handleCreate as
          | ((isRetry?: boolean) => Promise<void>)
          | undefined) ??
          null);

      if (fn) {
        try {
          await fn(false);
        } catch {
          // ignore
        }
      }
    };
    void startCreate();
  }
}

/**
 * Handle /join-group route
 */
async function handleJoinGroupRoute(preloadedElement: HTMLElement): Promise<void> {
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
    const recGroupID = document.getElementById(DOM_IDS.recGroupID);
    const recAggre = document.getElementById(DOM_IDS.recAggre);
    const recAssign = document.getElementById(DOM_IDS.recAssign);
    const recPledge = document.getElementById(DOM_IDS.recPledge);

    if (recGroupID) recGroupID.textContent = DEFAULT_GROUP.groupID;
    if (recAggre) recAggre.textContent = DEFAULT_GROUP.aggreNode;
    if (recAssign) recAssign.textContent = DEFAULT_GROUP.assignNode;
    if (recPledge) recPledge.textContent = DEFAULT_GROUP.pledgeAddress;
  }
}

/**
 * Initialize router
 */
export function initRouter(): void {
  bindHashLinkNavigation();

  // Listen for hash changes - only bind once
  if (!window._routerHashChangeBind) {
    window.addEventListener('hashchange', () => {
      void router();
    });
    window._routerHashChangeBind = true;
  }

  // Initial route
  void router();
}
