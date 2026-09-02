// Service Worker minimaliste PWA
// Purge systématiquement tous les anciens caches pour éliminer les résidus des versions antérieures

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Nettoyage complet de tous les caches existants
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    })
  );
});

// Écouteur fetch minimal requis pour satisfaire les critères d'éligibilité PWA du navigateur,
// sans intercepter ni altérer aucune requête réseau.
self.addEventListener('fetch', () => {
  // Laisser le navigateur gérer toutes les requêtes de façon 100% native
});

