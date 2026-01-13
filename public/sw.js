/**
 * Service Worker for Speedometer
 * Handles offline caching and resource management
 */

const CACHE_NAME = 'speedometer-v1.0.4';
const CACHE_ASSETS = [
  '/',
  '/index.html',
  '/src/css/speedometer.css',
  '/src/js/app.js',
  '/src/js/gps.js',
  '/src/js/speed.js',
  '/src/js/animation.js',
  '/src/js/ui.js',
  '/src/utils/haversine.js',
  '/src/utils/kalman.js',
  '/public/manifest.json',
  '/public/icons/icon.svg'
];

/**
 * Install event - Cache all static assets
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell');
        return cache.addAll(CACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch((error) => console.error('[SW] Cache install failed:', error))
  );
});

/**
 * Activate event - Clean up old caches
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

/**
 * Fetch event - Network first, fallback to cache
 */
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone and cache successful responses
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request);
      })
  );
});
