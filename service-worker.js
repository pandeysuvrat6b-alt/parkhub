// ParkHub Service Worker - Enables offline functionality and app-like caching
const CACHE_NAME = 'parkhub-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install event - cache essential files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version if available
        if (response) {
          return response;
        }

        return fetch(event.request).then(response => {
          // Don't cache if not a success response
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }

          // Clone the response before caching
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });

          return response;
        });
      })
      .catch(() => {
        // Return offline page or fallback response
        return new Response(
          'You are currently offline. Please check your internet connection.',
          {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain'
            })
          }
        );
      })
  );
});

// Background sync for offline bookings
self.addEventListener('sync', event => {
  if (event.tag === 'sync-bookings') {
    event.waitUntil(
      // Sync pending bookings when connection is restored
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SYNC_BOOKINGS',
            message: 'Syncing your bookings...'
          });
        });
      })
    );
  }
});

// Push notifications for booking updates
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'ParkHub parking app notification',
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect fill="%23667eea" width="192" height="192"/><text x="50%" y="50%" font-size="100" font-weight="bold" fill="white" text-anchor="middle" dy=".3em">🅿️</text></svg>',
    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect fill="%23667eea" width="96" height="96"/><text x="50%" y="50%" font-size="50" fill="white" text-anchor="middle" dy=".3em">🅿️</text></svg>',
    tag: 'parkhub-notification',
    requireInteraction: false
  };

  event.waitUntil(
    self.registration.showNotification('ParkHub', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      // Check if app is already open
      for (let client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // Open app if not already open
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
