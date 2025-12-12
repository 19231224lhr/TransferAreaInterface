/**
 * Enhanced Router Module
 * 
 * Provides advanced routing features:
 * - Route guards (before/after navigation)
 * - Route transitions
 * - Route parameters parsing
 * - Navigation history
 * - Prefetching
 */

import { t } from '../i18n/index.js';
import { loadUser } from './storage';
import { announce } from './accessibility';

// ========================================
// Type Definitions
// ========================================

/** Route information */
export interface RouteInfo {
  path: string;
  hash: string;
  params: Record<string, string>;
  query: Record<string, string>;
}

/** Route guard function - returns true to allow, false to block, or string to redirect */
export type RouteGuard = (
  to: RouteInfo,
  from: RouteInfo | null
) => boolean | string | Promise<boolean | string>;

/** After navigation hook */
export type AfterNavigationHook = (to: RouteInfo, from: RouteInfo | null) => void;

/** Route transition configuration */
export interface TransitionConfig {
  enter?: string;
  leave?: string;
  duration?: number;
}

/** Router configuration */
export interface RouterConfig {
  guards?: RouteGuard[];
  afterHooks?: AfterNavigationHook[];
  transition?: TransitionConfig;
  scrollBehavior?: 'top' | 'restore' | 'none';
}

// ========================================
// Router State
// ========================================

/** Registered route guards */
const routeGuards: RouteGuard[] = [];

/** After navigation hooks */
const afterHooks: AfterNavigationHook[] = [];

/** Current route info */
let currentRoute: RouteInfo | null = null;

/** Navigation history */
const navigationHistory: RouteInfo[] = [];

/** Max history length */
const MAX_HISTORY_LENGTH = 50;

/** Transition config */
let transitionConfig: TransitionConfig = {
  enter: 'fade-in',
  leave: 'fade-out',
  duration: 300
};

/** Scroll positions for restore */
const scrollPositions: Map<string, number> = new Map();

// ========================================
// Route Parsing
// ========================================

/**
 * Parse route from hash
 */
export function parseRoute(hash: string): RouteInfo {
  // Remove leading #
  const normalizedHash = hash.replace(/^#/, '');
  
  // Split path and query
  const [pathPart, queryPart] = normalizedHash.split('?');
  
  // Parse path
  const path = pathPart || '/welcome';
  
  // Parse query parameters
  const query: Record<string, string> = {};
  if (queryPart) {
    const searchParams = new URLSearchParams(queryPart);
    for (const [key, value] of searchParams) {
      query[key] = value;
    }
  }
  
  // Parse path parameters (e.g., /user/:id)
  const params: Record<string, string> = {};
  // Note: Path parameters would be extracted here if we had defined routes
  
  return {
    path,
    hash: normalizedHash,
    params,
    query
  };
}

/**
 * Get current route info
 */
export function getCurrentRoute(): RouteInfo | null {
  return currentRoute;
}

/**
 * Get navigation history
 */
export function getNavigationHistory(): RouteInfo[] {
  return [...navigationHistory];
}

// ========================================
// Route Guards
// ========================================

/**
 * Add a route guard
 */
export function addRouteGuard(guard: RouteGuard): () => void {
  routeGuards.push(guard);
  
  return () => {
    const index = routeGuards.indexOf(guard);
    if (index > -1) {
      routeGuards.splice(index, 1);
    }
  };
}

/**
 * Add after navigation hook
 */
export function addAfterHook(hook: AfterNavigationHook): () => void {
  afterHooks.push(hook);
  
  return () => {
    const index = afterHooks.indexOf(hook);
    if (index > -1) {
      afterHooks.splice(index, 1);
    }
  };
}

/**
 * Execute route guards
 */
async function executeGuards(to: RouteInfo, from: RouteInfo | null): Promise<boolean | string> {
  for (const guard of routeGuards) {
    try {
      const result = await guard(to, from);
      
      if (result === false) {
        return false;
      }
      
      if (typeof result === 'string') {
        return result; // Redirect path
      }
    } catch (error) {
      console.error('Route guard error:', error);
      return false;
    }
  }
  
  return true;
}

/**
 * Execute after hooks
 */
function executeAfterHooks(to: RouteInfo, from: RouteInfo | null): void {
  for (const hook of afterHooks) {
    try {
      hook(to, from);
    } catch (error) {
      console.error('After hook error:', error);
    }
  }
}

// ========================================
// Built-in Guards
// ========================================

/** Routes that require authentication */
const protectedRoutes = ['/main', '/history', '/group-detail', '/entry'];

/** Routes accessible without authentication */
/** Public routes that don't require authentication */
export const publicRoutes = ['/welcome', '/login', '/new', '/import', '/profile'];

/**
 * Authentication guard
 */
export const authGuard: RouteGuard = (to, from) => {
  const user = loadUser();
  const isProtected = protectedRoutes.includes(to.path);
  
  // If route requires auth and user is not logged in
  if (isProtected && !user) {
    // Show warning
    if (typeof window.showWarningToast === 'function') {
      window.showWarningToast(
        t('auth.loginRequired') || '请先登录',
        t('auth.loginRequiredDesc') || '您需要登录才能访问此页面'
      );
    }
    return '/welcome';
  }
  
  return true;
};

/**
 * Initialize authentication guard
 */
export function initAuthGuard(): () => void {
  return addRouteGuard(authGuard);
}

// ========================================
// Route Transitions
// ========================================

/**
 * Configure route transitions
 */
export function configureTransition(config: TransitionConfig): void {
  transitionConfig = { ...transitionConfig, ...config };
}

/**
 * Apply leave transition to element
 * @internal Used internally for route transitions
 */
function applyLeaveTransition(element: HTMLElement): Promise<void> {
  if (!transitionConfig.leave) return Promise.resolve();
  
  return new Promise(resolve => {
    element.classList.add(transitionConfig.leave!);
    
    setTimeout(() => {
      element.classList.remove(transitionConfig.leave!);
      resolve();
    }, transitionConfig.duration || 300);
  });
}

/**
 * Apply enter transition to element
 * @internal Used internally for route transitions
 */
function applyEnterTransition(element: HTMLElement): void {
  if (!transitionConfig.enter) return;
  
  // Remove and re-add to trigger animation
  element.classList.remove(transitionConfig.enter!);
  
  // Force reflow
  void element.offsetHeight;
  
  element.classList.add(transitionConfig.enter!);
}

// Export transition functions for use in navigateTo
export { applyLeaveTransition, applyEnterTransition };

// ========================================
// Scroll Management
// ========================================

/** Scroll behavior setting */
let scrollBehavior: 'top' | 'restore' | 'none' = 'top';

/**
 * Set scroll behavior
 */
export function setScrollBehavior(behavior: 'top' | 'restore' | 'none'): void {
  scrollBehavior = behavior;
}

/**
 * Save current scroll position
 */
function saveScrollPosition(path: string): void {
  scrollPositions.set(path, window.scrollY);
}

/**
 * Restore scroll position
 */
function restoreScrollPosition(path: string): void {
  const position = scrollPositions.get(path);
  
  requestAnimationFrame(() => {
    if (scrollBehavior === 'restore' && position !== undefined) {
      window.scrollTo({ top: position, behavior: 'instant' });
    } else if (scrollBehavior === 'top') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  });
}

// ========================================
// Navigation
// ========================================

/** Navigation lock to prevent concurrent navigations */
let isNavigating = false;

/**
 * Navigate to a route with guards
 */
export async function navigateTo(
  path: string,
  options: { replace?: boolean; silent?: boolean } = {}
): Promise<boolean> {
  const { replace = false, silent = false } = options;
  
  // Prevent concurrent navigation
  if (isNavigating) {
    return false;
  }
  
  isNavigating = true;
  
  try {
    // Parse target route
    const hash = path.startsWith('#') ? path : `#${path}`;
    const to = parseRoute(hash);
    const from = currentRoute;
    
    // Execute guards
    const guardResult = await executeGuards(to, from);
    
    if (guardResult === false) {
      return false;
    }
    
    if (typeof guardResult === 'string') {
      // Redirect
      isNavigating = false;
      return navigateTo(guardResult, { replace: true });
    }
    
    // Save scroll position for current route
    if (from) {
      saveScrollPosition(from.path);
    }
    
    // Update URL
    if (!silent) {
      if (replace) {
        history.replaceState(null, '', hash);
      } else {
        if (location.hash !== hash) {
          location.hash = hash;
        }
      }
    }
    
    // Update current route
    currentRoute = to;
    
    // Add to history
    navigationHistory.push(to);
    if (navigationHistory.length > MAX_HISTORY_LENGTH) {
      navigationHistory.shift();
    }
    
    // Restore scroll position
    restoreScrollPosition(to.path);
    
    // Execute after hooks
    executeAfterHooks(to, from);
    
    // Announce navigation for screen readers
    announce(t('a11y.navigatedTo') || `已导航到 ${to.path}`, 'polite');
    
    return true;
  } finally {
    isNavigating = false;
  }
}

/**
 * Go back in history
 */
export function goBack(): void {
  if (navigationHistory.length > 1) {
    history.back();
  } else {
    navigateTo('/welcome');
  }
}

/**
 * Go forward in history
 */
export function goForward(): void {
  history.forward();
}

/**
 * Check if can go back
 */
export function canGoBack(): boolean {
  return navigationHistory.length > 1;
}

// ========================================
// Route Prefetching
// ========================================

/** Prefetched routes */
const prefetchedRoutes: Set<string> = new Set();

/**
 * Prefetch a route's module
 */
export async function prefetchRoute(path: string): Promise<void> {
  if (prefetchedRoutes.has(path)) return;
  
  prefetchedRoutes.add(path);
  
  // Use requestIdleCallback for non-urgent prefetching
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(() => {
      // Import page module based on path
      switch (path) {
        case '/main':
          import('../pages/main.js').catch(() => {});
          break;
        case '/history':
          import('../pages/history.js').catch(() => {});
          break;
        case '/join-group':
          import('../pages/joinGroup.js').catch(() => {});
          break;
        // Add more routes as needed
      }
    });
  }
}

/**
 * Prefetch likely next routes based on current route
 */
export function prefetchLikelyRoutes(): void {
  const current = currentRoute?.path;
  
  // Prefetch based on likely navigation patterns
  if (current === '/welcome') {
    prefetchRoute('/login');
    prefetchRoute('/new');
  } else if (current === '/entry') {
    prefetchRoute('/main');
    prefetchRoute('/join-group');
  } else if (current === '/main') {
    prefetchRoute('/history');
  }
}

// ========================================
// Route Metadata
// ========================================

/** Route metadata registry */
const routeMetadata: Map<string, Record<string, any>> = new Map();

/**
 * Set route metadata
 */
export function setRouteMetadata(path: string, metadata: Record<string, any>): void {
  routeMetadata.set(path, metadata);
}

/**
 * Get route metadata
 */
export function getRouteMetadata(path: string): Record<string, any> | undefined {
  return routeMetadata.get(path);
}

// Initialize default route metadata
setRouteMetadata('/welcome', { title: 'PanguPay - Welcome', requiresAuth: false });
setRouteMetadata('/login', { title: 'PanguPay - Login', requiresAuth: false });
setRouteMetadata('/new', { title: 'PanguPay - Create Account', requiresAuth: false });
setRouteMetadata('/main', { title: 'PanguPay - Wallet', requiresAuth: true });
setRouteMetadata('/history', { title: 'PanguPay - History', requiresAuth: true });

// ========================================
// Initialize Enhanced Router
// ========================================

/**
 * Initialize the enhanced router
 */
export function initEnhancedRouter(config: RouterConfig = {}): void {
  // Register provided guards
  if (config.guards) {
    for (const guard of config.guards) {
      addRouteGuard(guard);
    }
  }
  
  // Register after hooks
  if (config.afterHooks) {
    for (const hook of config.afterHooks) {
      addAfterHook(hook);
    }
  }
  
  // Configure transition
  if (config.transition) {
    configureTransition(config.transition);
  }
  
  // Set scroll behavior
  if (config.scrollBehavior) {
    setScrollBehavior(config.scrollBehavior);
  }
  
  // Initialize auth guard by default
  initAuthGuard();
  
  // Listen for hash changes
  window.addEventListener('hashchange', () => {
    const route = parseRoute(location.hash);
    currentRoute = route;
    
    // Prefetch likely next routes
    requestAnimationFrame(prefetchLikelyRoutes);
  });
  
  // Parse initial route
  currentRoute = parseRoute(location.hash || '#/welcome');
  
  // Add after hook for page title updates
  addAfterHook((to) => {
    const metadata = getRouteMetadata(to.path);
    if (metadata?.title) {
      document.title = metadata.title;
    }
  });
  
  console.log('Enhanced router initialized');
}
