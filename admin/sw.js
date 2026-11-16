const CACHE_NAME = 'ctnracer-admin-v1';
const APP_SHELL = ['/admin/', '/admin/index.html', '/admin/manifest.webmanifest', '/admin/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith('ctnracer-admin-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Les API, authentifications et écritures doivent toujours passer par le réseau.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return;
  }

  // Pour l'écran admin, privilégier la version en ligne et utiliser le cache en secours hors connexion.
  if (request.mode === 'navigate' && (url.pathname === '/admin' || url.pathname === '/admin/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/admin/', copy));
          }
          return response;
        })
        .catch(async () => (await caches.match('/admin/')) || Response.error())
    );
    return;
  }

  // Les fichiers statiques déjà chargés sont disponibles hors connexion.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
