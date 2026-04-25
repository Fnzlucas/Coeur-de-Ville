// ============================================
// COEUR DE VILLE - Service Worker
// Version 1.0
// ============================================

const CACHE_NAME = 'coeurdeville-v1';

// Pages essentielles à mettre en cache au premier chargement
// (le visiteur peut accéder à ces pages même hors ligne)
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// ============================================
// INSTALLATION
// ============================================
self.addEventListener('install', (event) => {
  console.log('[SW] Installation...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Mise en cache des ressources essentielles');
        // On essaie de cacher mais on n'échoue pas si certaines ressources manquent
        return Promise.allSettled(
          URLS_TO_CACHE.map(url => cache.add(url).catch(err => {
            console.warn(`[SW] Impossible de cacher ${url}:`, err);
          }))
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ============================================
// ACTIVATION
// ============================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Suppression ancien cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ============================================
// STRATÉGIE DE FETCH
// Network-first avec fallback cache
// ============================================
self.addEventListener('fetch', (event) => {
  // On ignore les requêtes non-GET et les API externes
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Si la réponse est valide, on la met en cache
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Si offline, on cherche dans le cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Si la page n'est pas en cache, on retourne la home
          return caches.match('/');
        });
      })
  );
});
