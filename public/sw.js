const CACHE_NAME = 'shopafrica-pwa-v1';
const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/logo.png',
  '/manifest.webmanifest'
];

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
  evt.respondWith(
    caches.match(evt.request).then((cached) => {
      if (cached) return cached;
      return fetch(evt.request).then((response) => {
        return caches.open(CACHE_NAME).then((cache) => {
          try {
            cache.put(evt.request, response.clone());
          } catch (e) {}
          return response;
        });
      }).catch(() => caches.match('/'));
    })
  );
});
