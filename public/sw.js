const CACHE_NAME = 'shopafrica-pwa-v4';
const FILES_TO_CACHE = [
  '/logo.png',
  '/manifest.webmanifest'
];

// Skip caching index.html to always get fresh content
self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
          return Promise.resolve();
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (evt) => {
  if (evt.request.method !== 'GET') return;

  // Skip caching for API calls and Supabase
  const url = new URL(evt.request.url);
  if (url.hostname.includes('supabase') || url.pathname.startsWith('/api')) {
    return;
  }

  // Skip caching in development (localhost)
  if (self.location.hostname === 'localhost') {
    return;
  }

  // Skip caching for non-http(s) schemes
  try {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return;
    }
  } catch (e) {
    return;
  }

  // Network-first for all navigation (HTML pages)
  if (evt.request.mode === 'navigate') {
    evt.respondWith(
      fetch(evt.request)
        .catch(() => caches.match('/'))
    );
    return;
  }

  // For static assets only, use cache with network fallback
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2)$/)) {
    evt.respondWith(
      caches.match(evt.request).then((cached) => {
        if (cached) return cached;
        return fetch(evt.request).then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(evt.request, clone));
          }
          return response;
        });
      })
    );
  }
});
