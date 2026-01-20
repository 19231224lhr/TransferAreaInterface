/**
 * ComNode Endpoint Service
 * 
 * Manages the discovery and caching of ComNode (Leader) API endpoint.
 * The ComNode port is dynamically assigned, so we need to query BootNode
 * to get the correct endpoint.
 * 
 * @module services/comNodeEndpoint
 */

import { API_BASE_URL, API_ENDPOINTS } from '../config/api';
import { t } from '../i18n/index.js';
import { showErrorToast, showSuccessToast, showMiniToast, showStatusToast } from '../utils/toast.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Response from committee endpoint query
 */
interface CommitteeEndpointResponse {
  success: boolean;
  endpoint: string;
  message: string;
}

/**
 * Cached endpoint data with timestamp
 */
interface CachedEndpoint {
  url: string;
  timestamp: number;
}

/**
 * ComNode status
 */
export interface ComNodeStatus {
  isAvailable: boolean;
  endpoint: string | null;
  lastCheck: number;
  errorMessage: string | null;
}

// ============================================================================
// Constants
// ============================================================================

/** LocalStorage key for cached endpoint */
const CACHE_KEY = 'comNodeEndpoint';

/** Cache TTL: 24 hours */
const CACHE_TTL = 24 * 60 * 60 * 1000;

/** Cached endpoint health check interval */
const HEALTH_CHECK_TTL = 60 * 1000;

/** Health check timeout in milliseconds */
const HEALTH_CHECK_TIMEOUT = 2000;

// ============================================================================
// Module State
// ============================================================================

/** In-memory cache for ComNode URL */
let cachedComNodeURL: string | null = null;

/** Current status */
let comNodeStatus: ComNodeStatus = {
  isAvailable: false,
  endpoint: null,
  lastCheck: 0,
  errorMessage: null
};

/** Flag to track if connection toast has been shown this session */
let hasShownConnectedToast = false;

/** Cached health check state */
let lastHealthCheckAt = 0;
let lastHealthCheckOk = true;

/** Status change listeners */
const statusListeners: Set<(status: ComNodeStatus) => void> = new Set();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize endpoint format to full URL
 * - ":8081" -> "http://localhost:8081"
 * - "192.168.1.10:8081" -> "http://192.168.1.10:8081"
 */
function normalizeEndpoint(endpoint: string): string {
  const { protocol, host: currentHost } = getBaseHostAndProtocol();

  if (endpoint.startsWith(':')) {
    // ":8081" -> "http://<current-host>:8081"
    return `${protocol}//${currentHost}${endpoint}`;
  }
  if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
    // "192.168.1.10:8081" -> "http://192.168.1.10:8081"
    const colonIndex = endpoint.lastIndexOf(':');
    if (colonIndex > 0) {
      const hostPart = endpoint.substring(0, colonIndex);
      const portPart = endpoint.substring(colonIndex + 1);
      const resolvedHost = isLocalHost(hostPart) ? currentHost : hostPart;
      return `${protocol}//${resolvedHost}:${portPart}`;
    }
    const resolvedHost = isLocalHost(endpoint) ? currentHost : endpoint;
    return `${protocol}//${resolvedHost}`;
  }
  try {
    const url = new URL(endpoint);
    const resolvedHost = isLocalHost(url.hostname) ? currentHost : url.hostname;
    const portPart = url.port ? `:${url.port}` : '';
    return `${url.protocol}//${resolvedHost}${portPart}${url.pathname}`;
  } catch {
    return endpoint;
  }
}

/**
 * Read cached endpoint from localStorage
 */
function readCache(): CachedEndpoint | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const data = JSON.parse(cached) as CachedEndpoint;
    const age = Date.now() - data.timestamp;

    // Check if cache is expired
    if (age > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

/**
 * Write endpoint to cache
 */
function writeCache(url: string): void {
  const data: CachedEndpoint = {
    url,
    timestamp: Date.now()
  };
  localStorage.setItem(CACHE_KEY, JSON.stringify(data));
}

function getBaseHostAndProtocol(): { host: string; protocol: string } {
  try {
    const base = new URL(API_BASE_URL);
    return {
      host: base.hostname || 'localhost',
      protocol: base.protocol || 'http:'
    };
  } catch {
    // fallback to window
  }
  if (typeof window !== 'undefined' && window.location) {
    return {
      host: window.location.hostname || 'localhost',
      protocol: window.location.protocol || 'http:'
    };
  }
  return { host: 'localhost', protocol: 'http:' };
}

function isLocalHost(host: string): boolean {
  const h = host.trim().toLowerCase();
  return h === 'localhost' || h === '127.0.0.1';
}

function joinUrl(base: string, path: string): string {
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

async function checkComNodeHealth(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

  try {
    const healthUrl = joinUrl(url, API_ENDPOINTS.COM_HEALTH);
    const resp = await fetch(healthUrl, { method: 'GET', signal: controller.signal });
    return resp.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function validateCachedEndpoint(url: string): Promise<boolean> {
  const now = Date.now();
  if (now-lastHealthCheckAt < HEALTH_CHECK_TTL) {
    return lastHealthCheckOk;
  }

  const ok = await checkComNodeHealth(url);
  lastHealthCheckAt = now;
  lastHealthCheckOk = ok;

  updateStatus({
    isAvailable: ok,
    endpoint: ok ? url : null,
    errorMessage: ok ? null : t('comNode.notAvailable', 'ComNode 端点不可用，请稍后重试'),
    lastCheck: Date.now()
  });

  return ok;
}

/**
 * Update status and notify listeners
 */
function updateStatus(partial: Partial<ComNodeStatus>): void {
  comNodeStatus = { ...comNodeStatus, ...partial };
  statusListeners.forEach(listener => listener(comNodeStatus));
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Query ComNode endpoint from BootNode
 * 
 * This function:
 * 1. Sends GET request to BootNode's /api/v1/committee/endpoint
 * 2. Normalizes the returned endpoint to full URL
 * 3. Caches the result in localStorage and memory
 * 
 * @param showToast - Whether to show toast notifications (default: true)
 * @returns The ComNode URL or null if failed
 */
export async function queryComNodeEndpoint(showToast: boolean = true): Promise<string | null> {
  try {
    console.info('[ComNodeEndpoint] Querying BootNode for ComNode endpoint...');

    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.COMMITTEE_ENDPOINT}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      let errorMsg = '';

      if (response.status === 404) {
        errorMsg = t('comNode.notRegistered', 'ComNode 尚未启动或未注册');
      } else if (response.status === 503) {
        errorMsg = t('comNode.bootNodeUnavailable', 'BootNode 服务不可用');
      } else {
        errorMsg = t('comNode.queryFailed', '查询 ComNode 端点失败');
      }

      console.error('[ComNodeEndpoint] ✗ Query failed:', response.status, errorMsg);

      updateStatus({
        isAvailable: false,
        errorMessage: errorMsg,
        lastCheck: Date.now()
      });

      if (showToast) {
        showErrorToast(errorMsg, t('comNode.error', '服务连接失败'));
      }

      return null;
    }

    const data = await response.json() as CommitteeEndpointResponse;
    const comNodeURL = normalizeEndpoint(data.endpoint);

    // Cache the result
    cachedComNodeURL = comNodeURL;
    writeCache(comNodeURL);

    updateStatus({
      isAvailable: true,
      endpoint: comNodeURL,
      errorMessage: null,
      lastCheck: Date.now()
    });

    console.info('[ComNodeEndpoint] ✓ ComNode endpoint:', comNodeURL);

    if (showToast && !hasShownConnectedToast) {
      hasShownConnectedToast = true;
      showStatusToast(t('comNode.connected', '已连接到担保委员会节点'), 'success');
    }

    return comNodeURL;

  } catch (error) {
    console.error('[ComNodeEndpoint] ✗ Query error:', error);

    const errorMsg = error instanceof Error
      ? error.message
      : t('error.networkError', '网络连接失败');

    updateStatus({
      isAvailable: false,
      errorMessage: errorMsg,
      lastCheck: Date.now()
    });

    if (showToast) {
      showErrorToast(
        t('comNode.connectionFailed', '无法连接到区块链节点，请检查网络连接或节点是否启动'),
        t('comNode.error', '服务连接失败')
      );
    }

    return null;
  }
}

/**
 * Get ComNode URL (with caching)
 * 
 * Priority:
 * 1. In-memory cache
 * 2. localStorage cache (if not expired)
 * 3. Query BootNode
 * 
 * @param forceRefresh - Force refresh from BootNode (default: false)
 * @param showToast - Whether to show toast notifications (default: true)
 * @returns The ComNode URL or null if unavailable
 */
export async function getComNodeURL(
  forceRefresh: boolean = false,
  showToast: boolean = true
): Promise<string | null> {
  // 1. Check in-memory cache (unless force refresh)
  if (!forceRefresh && cachedComNodeURL) {
    const ok = await validateCachedEndpoint(cachedComNodeURL);
    if (ok) {
      console.debug('[ComNodeEndpoint] Using in-memory cache:', cachedComNodeURL);
      return cachedComNodeURL;
    }
    clearComNodeCache();
  }

  // 2. Check localStorage cache (unless force refresh)
  if (!forceRefresh) {
    const cached = readCache();
    if (cached) {
      cachedComNodeURL = cached.url;
      const ok = await validateCachedEndpoint(cached.url);
      if (ok) {
        console.debug('[ComNodeEndpoint] Using localStorage cache:', cached.url);
        return cached.url;
      }
      clearComNodeCache();
    }
  }

  // 3. Query BootNode
  return await queryComNodeEndpoint(showToast);
}

/**
 * Clear cached endpoint
 * Call this when ComNode returns 503 or other errors indicating endpoint change
 */
export function clearComNodeCache(): void {
  cachedComNodeURL = null;
  localStorage.removeItem(CACHE_KEY);
  hasShownConnectedToast = false; // Reset toast flag for new session
  lastHealthCheckAt = 0;
  lastHealthCheckOk = true;
  updateStatus({
    isAvailable: false,
    endpoint: null,
    errorMessage: null,
    lastCheck: Date.now()
  });
  console.info('[ComNodeEndpoint] Cache cleared');
}

/**
 * Reset connection toast flag
 * Call this on logout or full app reset
 */
export function resetComNodeConnectFlag(): void {
  hasShownConnectedToast = false;
  console.debug('[ComNodeEndpoint] Connection toast flag reset');
}

/**
 * Get current ComNode status
 */
export function getComNodeStatus(): ComNodeStatus {
  return { ...comNodeStatus };
}

/**
 * Subscribe to ComNode status changes
 * @returns Unsubscribe function
 */
export function onComNodeStatusChange(
  listener: (status: ComNodeStatus) => void
): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

/**
 * Check if ComNode endpoint is available (from cache)
 */
export function isComNodeAvailable(): boolean {
  return cachedComNodeURL !== null || readCache() !== null;
}

/**
 * Check if the current page load is a refresh (F5 or browser refresh)
 */
function isPageRefresh(): boolean {
  // Modern browsers: use PerformanceNavigationTiming
  if (typeof performance !== 'undefined' && performance.getEntriesByType) {
    const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (navEntries.length > 0) {
      return navEntries[0].type === 'reload';
    }
  }

  // Fallback for older browsers: use deprecated performance.navigation
  // @ts-ignore - deprecated but still works in many browsers
  if (typeof performance !== 'undefined' && performance.navigation) {
    // @ts-ignore
    return performance.navigation.type === 1; // 1 = TYPE_RELOAD
  }

  return false;
}

/**
 * Initialize ComNode endpoint on app startup
 * This should be called when user enters the main wallet page
 * 
 * If the page was refreshed (F5 or browser refresh), it will force
 * re-query the endpoint from BootNode to ensure we have the latest port.
 * 
 * @returns true if endpoint is available, false otherwise
 */
export async function initComNodeEndpoint(): Promise<boolean> {
  // Check if this is a page refresh
  const forceRefresh = isPageRefresh();

  if (forceRefresh) {
    console.info('[ComNodeEndpoint] Page refresh detected, forcing endpoint refresh from BootNode');
  }

  const url = await getComNodeURL(forceRefresh, true);
  return url !== null;
}
