/**
 * Lazy Loader Module
 * 
 * P2-20: 代码分割和懒加载
 * 
 * Features:
 * - Dynamic module imports
 * - Route-based code splitting
 * - Component lazy loading
 * - Preloading strategies
 * - Loading state management
 */

import { showLoading, hideLoading } from './loading';
import { DOM_IDS } from '../config/domIds';

// ========================================
// Types
// ========================================

/** Module loader function type */
type ModuleLoader<T = unknown> = () => Promise<{ default: T } | T>;

/** Lazy module configuration */
interface LazyModuleConfig {
  /** Module loader function */
  loader: ModuleLoader;
  /** Whether to preload on idle */
  preloadOnIdle?: boolean;
  /** Priority for preloading (lower = higher priority) */
  preloadPriority?: number;
  /** Timeout for loading (ms) */
  timeout?: number;
  /** Retry count on failure */
  retryCount?: number;
}

/** Preload strategy */
type PreloadStrategy = 'idle' | 'hover' | 'visible' | 'immediate';

/** Module cache entry */
interface CacheEntry<T = unknown> {
  module: T;
  loadedAt: number;
}

// ========================================
// Module Registry
// ========================================

/** Registry of lazy modules */
const moduleRegistry = new Map<string, LazyModuleConfig>();

/** Loaded module cache */
const moduleCache = new Map<string, CacheEntry>();

/** Pending module loads */
const pendingLoads = new Map<string, Promise<unknown>>();

/** Preload queue */
const preloadQueue: Array<{ id: string; priority: number }> = [];

/** Whether preloading is enabled */
let preloadingEnabled = true;

// ========================================
// Core Functions
// ========================================

/**
 * Register a lazy module
 */
export function registerLazyModule(
  id: string,
  config: LazyModuleConfig
): void {
  moduleRegistry.set(id, {
    timeout: 30000,
    retryCount: 2,
    preloadOnIdle: false,
    preloadPriority: 10,
    ...config
  });
  
  // Add to preload queue if configured
  if (config.preloadOnIdle) {
    preloadQueue.push({
      id,
      priority: config.preloadPriority ?? 10
    });
    // Sort by priority
    preloadQueue.sort((a, b) => a.priority - b.priority);
  }
}

/**
 * Load a lazy module
 */
export async function loadModule<T = unknown>(
  id: string,
  showLoadingIndicator = true
): Promise<T> {
  // Check cache
  const cached = moduleCache.get(id);
  if (cached) {
    return cached.module as T;
  }
  
  // Check pending loads
  const pending = pendingLoads.get(id);
  if (pending) {
    return pending as Promise<T>;
  }
  
  // Get module config
  const config = moduleRegistry.get(id);
  if (!config) {
    throw new Error(`Module '${id}' is not registered`);
  }
  
  // Create loading promise
  const loadPromise = loadModuleInternal<T>(id, config, showLoadingIndicator);
  pendingLoads.set(id, loadPromise);
  
  try {
    const module = await loadPromise;
    return module;
  } finally {
    pendingLoads.delete(id);
  }
}

/**
 * Internal module loading with retry and timeout
 */
async function loadModuleInternal<T>(
  id: string,
  config: LazyModuleConfig,
  showLoadingIndicator: boolean
): Promise<T> {
  const { loader, timeout, retryCount } = config;
  let lastError: Error | null = null;
  
  if (showLoadingIndicator) {
    showLoading('加载模块中...');
  }
  
  try {
    for (let attempt = 0; attempt <= (retryCount ?? 0); attempt++) {
      try {
        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Module '${id}' load timed out`));
          }, timeout ?? 30000);
        });
        
        // Race loader against timeout
        const result = await Promise.race([
          loader(),
          timeoutPromise
        ]);
        
        // Extract module (handle both default export and direct export)
        const module = (result && typeof result === 'object' && 'default' in result)
          ? (result as { default: T }).default
          : result as T;
        
        // Cache the module
        moduleCache.set(id, {
          module,
          loadedAt: Date.now()
        });
        
        return module;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Wait before retry (exponential backoff)
        if (attempt < (retryCount ?? 0)) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }
    
    throw lastError ?? new Error(`Failed to load module '${id}'`);
  } finally {
    if (showLoadingIndicator) {
      hideLoading();
    }
  }
}

/**
 * Preload a module without blocking
 */
export function preloadModule(id: string): void {
  // Skip if already cached or loading
  if (moduleCache.has(id) || pendingLoads.has(id)) {
    return;
  }
  
  // Load in background without showing indicator
  loadModule(id, false).catch(error => {
    console.warn(`Failed to preload module '${id}':`, error);
  });
}

/**
 * Check if a module is loaded
 */
export function isModuleLoaded(id: string): boolean {
  return moduleCache.has(id);
}

/**
 * Clear module cache
 */
export function clearModuleCache(id?: string): void {
  if (id) {
    moduleCache.delete(id);
  } else {
    moduleCache.clear();
  }
}

// ========================================
// Page Loaders
// ========================================

/** Page module type */
type PageModule = {
  render: () => void | Promise<void>;
  cleanup?: () => void;
};

/** Page registry */
const pageLoaders = new Map<string, ModuleLoader<PageModule>>();

/**
 * Register a page loader
 */
export function registerPageLoader(
  route: string,
  loader: ModuleLoader<PageModule>,
  options: Partial<LazyModuleConfig> = {}
): void {
  pageLoaders.set(route, loader);
  
  registerLazyModule(`page:${route}`, {
    loader,
    preloadOnIdle: true,
    preloadPriority: 5,
    ...options
  });
}

/**
 * Load and render a page
 */
export async function loadPage(route: string): Promise<PageModule | null> {
  const moduleId = `page:${route}`;
  
  if (!moduleRegistry.has(moduleId)) {
    console.warn(`Page '${route}' is not registered for lazy loading`);
    return null;
  }
  
  try {
    const pageModule = await loadModule<PageModule>(moduleId);
    return pageModule;
  } catch (error) {
    console.error(`Failed to load page '${route}':`, error);
    return null;
  }
}

/**
 * Preload a page
 */
export function preloadPage(route: string): void {
  preloadModule(`page:${route}`);
}

// ========================================
// Component Lazy Loading
// ========================================

/**
 * Create a lazy component wrapper
 */
export function lazyComponent<T extends (...args: unknown[]) => unknown>(
  loader: ModuleLoader<T>,
  fallback?: () => HTMLElement
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let cachedComponent: T | null = null;
  let loadPromise: Promise<T> | null = null;
  
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    // Return cached component
    if (cachedComponent) {
      return cachedComponent(...args) as ReturnType<T>;
    }
    
    // Show fallback if provided
    if (fallback) {
      const container = document.getElementById(DOM_IDS.app);
      if (container) {
        container.appendChild(fallback());
      }
    }
    
    // Load component
    if (!loadPromise) {
      loadPromise = loader().then(result => {
        cachedComponent = (result && typeof result === 'object' && 'default' in result)
          ? (result as { default: T }).default
          : result as T;
        return cachedComponent;
      });
    }
    
    const component = await loadPromise;
    return component(...args) as ReturnType<T>;
  };
}

// ========================================
// Preload Strategies
// ========================================

/**
 * Setup preloading based on strategy
 */
export function setupPreloading(
  elementId: string,
  moduleId: string,
  strategy: PreloadStrategy
): void {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  switch (strategy) {
    case 'hover':
      element.addEventListener('mouseenter', () => preloadModule(moduleId), { once: true });
      element.addEventListener('touchstart', () => preloadModule(moduleId), { once: true, passive: true });
      break;
      
    case 'visible':
      setupVisibilityPreload(element, moduleId);
      break;
      
    case 'immediate':
      preloadModule(moduleId);
      break;
      
    case 'idle':
    default:
      // Will be handled by idle callback
      break;
  }
}

/**
 * Setup visibility-based preloading using IntersectionObserver
 */
function setupVisibilityPreload(element: Element, moduleId: string): void {
  if (!('IntersectionObserver' in window)) {
    // Fallback: preload immediately
    preloadModule(moduleId);
    return;
  }
  
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          preloadModule(moduleId);
          observer.disconnect();
        }
      });
    },
    { rootMargin: '100px' }
  );
  
  observer.observe(element);
}

/**
 * Process preload queue during idle time
 */
function processPreloadQueue(): void {
  if (!preloadingEnabled || preloadQueue.length === 0) return;
  
  const item = preloadQueue.shift();
  if (item) {
    preloadModule(item.id);
  }
  
  // Schedule next preload
  if (preloadQueue.length > 0) {
    scheduleIdlePreload();
  }
}

/**
 * Schedule idle preloading
 */
function scheduleIdlePreload(): void {
  if ('requestIdleCallback' in window) {
    (window as unknown as { requestIdleCallback: (cb: () => void) => void })
      .requestIdleCallback(processPreloadQueue);
  } else {
    setTimeout(processPreloadQueue, 200);
  }
}

/**
 * Enable or disable preloading
 */
export function setPreloadingEnabled(enabled: boolean): void {
  preloadingEnabled = enabled;
  
  if (enabled && preloadQueue.length > 0) {
    scheduleIdlePreload();
  }
}

// ========================================
// Dynamic Imports Helper
// ========================================

/**
 * Create a dynamic import function with error handling
 */
export function dynamicImport<T>(
  importFn: () => Promise<{ default: T } | T>,
  fallbackValue?: T
): () => Promise<T> {
  return async () => {
    try {
      const result = await importFn();
      return (result && typeof result === 'object' && 'default' in result)
        ? (result as { default: T }).default
        : result as T;
    } catch (error) {
      console.error('Dynamic import failed:', error);
      if (fallbackValue !== undefined) {
        return fallbackValue;
      }
      throw error;
    }
  };
}

// ========================================
// Resource Prefetching
// ========================================

/**
 * Prefetch a resource using link preload
 */
export function prefetchResource(url: string, as: 'script' | 'style' | 'fetch' = 'script'): void {
  // Check if already prefetched
  const existing = document.querySelector(`link[rel="prefetch"][href="${url}"]`);
  if (existing) return;
  
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = url;
  link.as = as;
  document.head.appendChild(link);
}

/**
 * Preload a resource (higher priority than prefetch)
 */
export function preloadResource(url: string, as: 'script' | 'style' | 'fetch' = 'script'): void {
  // Check if already preloaded
  const existing = document.querySelector(`link[rel="preload"][href="${url}"]`);
  if (existing) return;
  
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = url;
  link.as = as;
  if (as === 'script') {
    link.setAttribute('crossorigin', 'anonymous');
  }
  document.head.appendChild(link);
}

// ========================================
// Initialization
// ========================================

/**
 * Initialize lazy loader
 */
export function initLazyLoader(): void {
  // Start processing preload queue on idle
  if (document.readyState === 'complete') {
    scheduleIdlePreload();
  } else {
    window.addEventListener('load', () => {
      // Wait a bit after load before starting preloads
      setTimeout(scheduleIdlePreload, 1000);
    });
  }
  
  // Disable preloading on slow connections
  const connection = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (connection) {
    if (connection.saveData || connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
      setPreloadingEnabled(false);
    }
  }
}

// ========================================
// Export
// ========================================

export const lazyLoader = {
  registerModule: registerLazyModule,
  loadModule,
  preloadModule,
  isModuleLoaded,
  clearCache: clearModuleCache,
  registerPage: registerPageLoader,
  loadPage,
  preloadPage,
  lazyComponent,
  setupPreloading,
  setPreloadingEnabled,
  dynamicImport,
  prefetchResource,
  preloadResource,
  init: initLazyLoader
};

export default lazyLoader;
