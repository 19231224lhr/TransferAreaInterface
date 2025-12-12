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
    console.log('[SW] Service workers not supported');
    notifyStatus('unsupported');
    return null;
  }
  
  try {
    console.log('[SW] Registering service worker...');
    notifyStatus('installing');
    
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    
    swRegistration = registration;
    
    console.log('[SW] Service worker registered:', registration.scope);
    
    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New service worker installed, waiting to activate
            console.log('[SW] New service worker available');
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
      console.log('[SW] Service worker unregistered');
    }
    return success;
  } catch (error) {
    console.error('[SW] Failed to unregister service worker:', error);
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
    console.log('[SW] Checked for updates');
  } catch (error) {
    console.error('[SW] Failed to check for updates:', error);
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
    for (const callback of onlineCallbacks) {
      try {
        callback(isOnline);
      } catch (error) {
        console.error('[SW] Online status callback error:', error);
      }
    }
  };
  
  window.addEventListener('online', () => {
    console.log('[SW] Back online');
    notifyOnlineStatus(true);
  });
  
  window.addEventListener('offline', () => {
    console.log('[SW] Gone offline');
    notifyOnlineStatus(false);
  });
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
    console.log('[SW] Controller changed, reloading...');
    // Optionally reload the page when new SW takes control
    // window.location.reload();
  });
  
  console.log('[SW] Service worker module initialized');
}

// ========================================
// Auto-initialization
// ========================================

// Initialize on import
if (typeof window !== 'undefined') {
  initServiceWorker();
}
