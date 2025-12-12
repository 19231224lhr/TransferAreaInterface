/**
 * PanguPay Service Worker
 * 
 * Provides offline support and caching for the application:
 * - Static asset caching
 * - Network-first for API calls
 * - Offline fallback page
 */

// Cache version - update this when assets change
const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `pangupay-${CACHE_VERSION}`;

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/logo.png',
  // CSS files
  '/css/base.css',
  '/css/animations.css',
  '/css/utilities.css',
  '/css/components.css',
  '/css/header.css',
  '/css/welcome.css',
  '/css/toast.css',
  '/css/entry.css',
  '/css/new-user.css',
  '/css/login.css',
  '/css/wallet.css',
  '/css/transaction.css',
  '/css/import-wallet.css',
  '/css/join-group.css',
  '/css/group.css',
  '/css/inquiry.css',
  '/css/profile.css',
  '/css/main-v2.css',
  '/css/history.css',
  '/css/footer.css',
  '/css/energy-saving.css',
  '/css/wallet_struct_styles.css'
];

// API paths that should use network-first strategy
const API_PATHS = ['/api/', '/api/account', '/api/transfer'];

// ========================================
// Install Event
// ========================================

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        // Cache static assets, but don't fail if some don't exist
        return Promise.allSettled(
          STATIC_ASSETS.map(url => 
            cache.add(url).catch(err => {
              console.warn(`[SW] Failed to cache ${url}:`, err);
            })
          )
        );
      })
      .then(() => {
        console.log('[SW] Service worker installed');
        // Skip waiting to activate immediately
        return self.skipWaiting();
      })
  );
});

// ========================================
// Activate Event
// ========================================

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    // Clean up old caches
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(name => name.startsWith('pangupay-') && name !== CACHE_NAME)
            .map(name => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        // Take control of all clients immediately
        return self.clients.claim();
      })
  );
});

// ========================================
// Fetch Event
// ========================================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }
  
  // Check if this is an API request
  const isApiRequest = API_PATHS.some(path => url.pathname.startsWith(path));
  
  if (isApiRequest) {
    // Network-first for API requests
    event.respondWith(networkFirst(request));
  } else {
    // Cache-first for static assets
    event.respondWith(cacheFirst(request));
  }
});

// ========================================
// Caching Strategies
// ========================================

/**
 * Cache-first strategy
 * Good for static assets that don't change often
 */
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    // Return cached response and update cache in background
    updateCache(request);
    return cachedResponse;
  }
  
  // If not in cache, fetch from network
  try {
    const networkResponse = await fetch(request);
    
    // Cache the response if successful
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Return offline fallback for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/index.html');
    }
    
    throw error;
  }
}

/**
 * Network-first strategy
 * Good for API calls and dynamic content
 */
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Don't cache API responses in this basic implementation
    // You could add caching here for specific endpoints if needed
    
    return networkResponse;
  } catch (error) {
    // Try cache as fallback
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return error response
    return new Response(JSON.stringify({
      error: 'Network unavailable',
      offline: true
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Stale-while-revalidate strategy
 * Returns cached response immediately, then updates cache in background
 */
async function staleWhileRevalidate(request) {
  const cachedResponse = await caches.match(request);
  
  const fetchPromise = fetch(request)
    .then(networkResponse => {
      if (networkResponse.ok) {
        const cache = caches.open(CACHE_NAME);
        cache.then(c => c.put(request, networkResponse.clone()));
      }
      return networkResponse;
    })
    .catch(() => cachedResponse);
  
  return cachedResponse || fetchPromise;
}

/**
 * Update cache in background
 */
async function updateCache(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse);
    }
  } catch (error) {
    // Silently fail - cache update is not critical
  }
}

// ========================================
// Message Handling
// ========================================

self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_VERSION':
      event.ports[0]?.postMessage({ version: CACHE_VERSION });
      break;
      
    case 'CLEAR_CACHE':
      caches.delete(CACHE_NAME).then(() => {
        event.ports[0]?.postMessage({ success: true });
      });
      break;
      
    case 'CACHE_URLS':
      if (payload?.urls) {
        caches.open(CACHE_NAME).then(cache => {
          return cache.addAll(payload.urls);
        }).then(() => {
          event.ports[0]?.postMessage({ success: true });
        });
      }
      break;
  }
});

// ========================================
// Background Sync (if supported)
// ========================================

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-transactions') {
    event.waitUntil(syncPendingTransactions());
  }
});

/**
 * Sync pending transactions when back online
 */
async function syncPendingTransactions() {
  // This would be implemented to sync any transactions
  // that were made while offline
  console.log('[SW] Syncing pending transactions...');
}

// ========================================
// Push Notifications (if needed)
// ========================================

self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  
  const options = {
    body: data.body || '',
    icon: '/assets/logo.png',
    badge: '/assets/logo.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'PanguPay', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then(windowClients => {
        // Focus existing window if available
        for (const client of windowClients) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open new window
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

console.log('[SW] Service worker script loaded');
