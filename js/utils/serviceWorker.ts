/**
 * Service Worker Registration Module
 * 
 * Handles service worker registration and lifecycle management
 */

// ========================================
// Type Definitions
// ========================================

/** Service worker status */
export type ServiceWorkerStatus = 'unsupported' | 'installing' | 'waiting' | 'active' | 'error';

/** Update callback */
export type UpdateCallback = (registration: ServiceWorkerRegistration) => void;

// ========================================
// State
// ========================================

/** Current registration */
let swRegistration: ServiceWorkerRegistration | null = null;

/** Update callbacks */
const updateCallbacks: UpdateCallback[] = [];

/** Status change callbacks */
const statusCallbacks: ((status: ServiceWorkerStatus) => void)[] = [];

// ========================================
// Registration
// ========================================

/**
 * Register the service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  // Check if service workers are supported
  if (!('serviceWorker' in navigator)) {
    notifyStatus('unsupported');
    return null;
  }

  try {
    notifyStatus('installing');

    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });

    swRegistration = registration;

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;

      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New service worker installed, waiting to activate
            notifyStatus('waiting');
            notifyUpdate(registration);
          }
        });
      }
    });

    // Check if there's an active service worker
    if (registration.active) {
      notifyStatus('active');
    }

    // Check for updates periodically (every hour)
    setInterval(() => {
      registration.update().catch(console.error);
    }, 60 * 60 * 1000);

    return registration;
  } catch (error) {
    console.error('[SW] Service worker registration failed:', error);
    notifyStatus('error');
    return null;
  }
}

/**
 * Unregister the service worker
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!swRegistration) {
    return false;
  }

  try {
    const success = await swRegistration.unregister();
    if (success) {
      swRegistration = null;
    }
    return success;
  } catch (error) {
    return false;
  }
}

// ========================================
// Updates
// ========================================

/**
 * Check for service worker updates
 */
export async function checkForUpdates(): Promise<void> {
  if (!swRegistration) {
    return;
  }

  try {
    await swRegistration.update();
  } catch (error) {
    // Silent fail
  }
}

/**
 * Skip waiting and activate new service worker immediately
 */
export function skipWaiting(): void {
  if (swRegistration?.waiting) {
    swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
}

/**
 * Register callback for when update is available
 */
export function onUpdateAvailable(callback: UpdateCallback): () => void {
  updateCallbacks.push(callback);

  return () => {
    const index = updateCallbacks.indexOf(callback);
    if (index > -1) {
      updateCallbacks.splice(index, 1);
    }
  };
}

/**
 * Register callback for status changes
 */
export function onStatusChange(callback: (status: ServiceWorkerStatus) => void): () => void {
  statusCallbacks.push(callback);

  return () => {
    const index = statusCallbacks.indexOf(callback);
    if (index > -1) {
      statusCallbacks.splice(index, 1);
    }
  };
}

/**
 * Notify update callbacks
 */
function notifyUpdate(registration: ServiceWorkerRegistration): void {
  for (const callback of updateCallbacks) {
    try {
      callback(registration);
    } catch (error) {
      console.error('[SW] Update callback error:', error);
    }
  }
}

/**
 * Notify status callbacks
 */
function notifyStatus(status: ServiceWorkerStatus): void {
  for (const callback of statusCallbacks) {
    try {
      callback(status);
    } catch (error) {
      console.error('[SW] Status callback error:', error);
    }
  }
}

// ========================================
// Messaging
// ========================================

/**
 * Send message to service worker
 */
export function sendMessage(message: any): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!navigator.serviceWorker.controller) {
      reject(new Error('No active service worker'));
      return;
    }

    const messageChannel = new MessageChannel();

    messageChannel.port1.onmessage = (event) => {
      resolve(event.data);
    };

    navigator.serviceWorker.controller.postMessage(message, [messageChannel.port2]);
  });
}

/**
 * Get service worker version
 */
export async function getServiceWorkerVersion(): Promise<string | null> {
  try {
    const response = await sendMessage({ type: 'GET_VERSION' });
    return response?.version || null;
  } catch {
    return null;
  }
}

/**
 * Clear service worker cache
 */
export async function clearCache(): Promise<boolean> {
  try {
    const response = await sendMessage({ type: 'CLEAR_CACHE' });
    return response?.success || false;
  } catch {
    return false;
  }
}

/**
 * Pre-cache specific URLs
 */
export async function preCacheUrls(urls: string[]): Promise<boolean> {
  try {
    const response = await sendMessage({ type: 'CACHE_URLS', payload: { urls } });
    return response?.success || false;
  } catch {
    return false;
  }
}

// ========================================
// Online/Offline Detection
// ========================================

/** Online status callbacks */
const onlineCallbacks: ((isOnline: boolean) => void)[] = [];

let lastKnownOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

const DEFAULT_PROBE_URL = 'https://www.baidu.com/favicon.ico';

async function probeInternetReachability(timeoutMs: number = 2500): Promise<boolean> {
  // Some setups keep `navigator.onLine=true` even when the Internet is unreachable (e.g., connected to LAN/localhost).
  // We probe a tiny external resource; `no-cors` avoids CORS blocking and still rejects on network failure.
  // Allow overrides for restricted networks.
  const probeUrl =
    (globalThis as any).__CONNECTIVITY_PROBE_URL__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('connectivityProbeUrl') : null) ||
    DEFAULT_PROBE_URL;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(`${probeUrl}${String(probeUrl).includes('?') ? '&' : '?'}_=${Date.now()}`, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal
    });
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Check if currently online
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Register callback for online status changes
 */
export function onOnlineStatusChange(callback: (isOnline: boolean) => void): () => void {
  onlineCallbacks.push(callback);

  // Immediately notify so callers don't depend on a future event.
  try {
    callback(isOnline());
  } catch {
    // best-effort
  }

  return () => {
    const index = onlineCallbacks.indexOf(callback);
    if (index > -1) {
      onlineCallbacks.splice(index, 1);
    }
  };
}

/**
 * Initialize online/offline detection
 */
function initOnlineDetection(): void {
  const notifyOnlineStatus = (isOnline: boolean) => {
    lastKnownOnline = isOnline;
    for (const callback of onlineCallbacks) {
      try {
        callback(isOnline);
      } catch (error) {
        // Silent fail
      }
    }
  };

  window.addEventListener('online', () => {
    notifyOnlineStatus(true);
  });

  window.addEventListener('offline', () => {
    notifyOnlineStatus(false);
  });

  // Heartbeat: combines browser signal + external probe.
  // Goal: show offline indicator when the Internet is actually unreachable (common expectation for “断网”),
  // even if localhost remains reachable.
  /* 
   * [MODIFIED] Active probing (Baidu favicon) disabled per user request to avoid network log spam.
   * Relying on native navigator.onLine for now.
   */
  // let intervalId: number | null = null;
  // const schedule = (ms: number) => {
  //   if (intervalId !== null) window.clearInterval(intervalId);
  //   intervalId = window.setInterval(() => {
  //     tick().catch(() => {});
  //   }, ms);
  // };

  // const tick = async () => {
  //   // Fast path: if the browser reports offline, trust it.
  //   if (!navigator.onLine) {
  //     if (lastKnownOnline !== false) notifyOnlineStatus(false);
  //     schedule(5000);
  //     return;
  //   }

  //   const reachable = await probeInternetReachability();
  //   if (reachable !== lastKnownOnline) {
  //     notifyOnlineStatus(reachable);
  //   }
  //   // Probe less often when stable online to reduce traffic.
  //   schedule(reachable ? 15000 : 5000);
  // };

  // // Run once soon after init.
  // tick().catch(() => {});
  // schedule(15000);
}

// ========================================
// Initialization
// ========================================

/**
 * Initialize service worker module
 */
export function initServiceWorker(): void {
  // Initialize online detection
  initOnlineDetection();

  // Handle controller change (when new SW takes over)
  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    // Optionally reload the page when new SW takes control
    // window.location.reload();
  });
}

// ========================================
// Auto-initialization
// ========================================

// Initialize on import
if (typeof window !== 'undefined') {
  initServiceWorker();
}
