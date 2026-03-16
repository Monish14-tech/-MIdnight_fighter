const CACHE_NAME = 'midnight-fighter-v4';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './ranks.css',
  './main.js',
  './game.js',
  './notifications.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  const isHttp = requestUrl.protocol === 'http:' || requestUrl.protocol === 'https:';
  if (!isHttp) {
    return;
  }

  const isSameOrigin = requestUrl.origin === self.location.origin;
  const isDocument = event.request.mode === 'navigate';
  const isHotAsset = /\.(html|js|css)$/i.test(requestUrl.pathname);

  // Keep startup and script/style files fresh to avoid stale startup logic.
  if (isDocument || isHotAsset) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const copy = networkResponse.clone();
          if (isSameOrigin && networkResponse.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((networkResponse) => {
        const copy = networkResponse.clone();
        if (isSameOrigin && networkResponse.ok) {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        }
        return networkResponse;
      });
    })
  );
});
