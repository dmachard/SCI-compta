const CACHE_NAME = 'sci-compta-__SW_VERSION__';
const STATIC_ASSETS = [
  '/manifest.webmanifest',
  '/logo.svg',
  '/favicon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512.png',
  '/apple-touch-icon.png',
];

// Installation du Service Worker : mise en cache des assets statiques purs (icônes/manifest)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Cache prefetch warning:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activation : nettoyage immédiat et systématique des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Interception des requêtes
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. NE JAMAIS intercepter ni mettre en cache les requêtes API (données fraîches impératives)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 2. Navigation HTML (SPA) : toujours réseau en priorité, pas de cache stale
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html');
      })
    );
    return;
  }

  // 3. Assets statiques immuables (images / polices uniquement)
  // Note : les scripts JS et styles CSS sont gérés directement par Nginx avec leurs hashs Vite
  if (
    event.request.method === 'GET' &&
    (url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.svg') ||
      url.pathname.endsWith('.woff2') ||
      url.hostname.includes('fonts.gstatic.com'))
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return (
          cached ||
          fetch(event.request).then((response) => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return response;
          })
        );
      })
    );
  }
});
