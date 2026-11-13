/* Cotonou City Race — cache hors ligne léger, sans intercepter les API externes. */
const CCR_CACHE_PREFIX = 'ccr-pwa-';
const CCR_CACHE_VERSION = 'v1';
const CCR_CACHE = CCR_CACHE_PREFIX + CCR_CACHE_VERSION;
const CCR_SHELL = ['/', '/manifest.webmanifest', '/ccr-icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CCR_CACHE)
      .then((cache) => cache.addAll(CCR_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith(CCR_CACHE_PREFIX) && key !== CCR_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Ne jamais mettre en cache Firebase, paiements ou autres ressources tierces.
  if (url.origin !== self.location.origin) return;

  // Le document du jeu est réseau d'abord, avec repli hors connexion.
  if (request.mode === 'navigate' && (url.pathname === '/' || url.pathname === '/index.html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CCR_CACHE).then((cache) => cache.put('/', copy));
          }
          return response;
        })
        .catch(async () => (await caches.match('/')) || Response.error())
    );
    return;
  }

  // Cache progressif des ressources locales du jeu (JS, CSS, modèles, textures, sons et polices).
  // Stale-while-revalidate : affichage rapide depuis le cache, mise à jour en arrière-plan.
  if (/\.(?:js|mjs|css|glb|gltf|bin|png|jpe?g|webp|avif|svg|woff2?|ttf|otf|mp3|ogg|wav)$/i.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CCR_CACHE);
      const cached = await cache.match(request);
      const networkUpdate = fetch(request).then((response) => {
        if (response.ok) cache.put(request, response.clone());
        return response;
      });
      if (cached) {
        event.waitUntil(networkUpdate.catch(() => undefined));
        return cached;
      }
      try {
        return await networkUpdate;
      } catch {
        return Response.error();
      }
    })());
  }
});
