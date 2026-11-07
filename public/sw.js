const CACHE_NAME = 'bikeready-cache-v6';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/manifest.json',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
  '/screenshot-narrow.png',
  '/screenshot-wide.png',
  '/icon.svg',
];

// Install: Cache App Shell immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        STATIC_ASSETS.map((asset) =>
          cache.add(asset).catch((err) => console.warn('PWA asset cache item warning:', asset, err))
        )
      );
    })
  );
  self.skipWaiting();
});

// Activate: Immediately purge all older caches & claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Purging old service worker cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Resilient Cache-First App Shell strategy for offline & 5G/4G network handover
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // CRITICAL: NEVER cache or intercept dev-server modules, node_modules, HMR or vite assets
  // This prevents dual-instance React issues (e.g. TypeError: Cannot read properties of null reading useState)
  if (
    url.pathname.startsWith('/@') ||
    url.pathname.includes('/node_modules/') ||
    url.pathname.includes('/.vite/') ||
    url.pathname.includes('hot-update') ||
    url.search.includes('v=') ||
    url.hostname.includes('supabase.co')
  ) {
    return;
  }

  // Navigation requests (HTML / App Shell): Cache-First / Stale-While-Revalidate
  // Guarantees that 5G/4G network handovers NEVER crash the page with ERR_NETWORK_CHANGED!
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((cachedIndex) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put('/index.html', clone);
                cache.put('/', clone.clone());
              });
            }
            return networkResponse;
          })
          .catch(() => cachedIndex);

        return cachedIndex || fetchPromise;
      })
    );
    return;
  }

  // Static assets (images, icons, manifest, built JS/CSS chunks): Cache-First
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|ico|webp|woff|woff2|webmanifest|json|js|css)$/) || url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }
});
