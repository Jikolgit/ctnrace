/* Cotonou City Race — cache hors ligne léger, sans intercepter les API externes. */
const CCR_CACHE_PREFIX = 'ccr-pwa-';
const CCR_CACHE_VERSION = 'v2'; // v2 : supprime les anciens caches (models.glb périmé qui cachait de nouveaux modèles)
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

  // Ressources locales du jeu (JS, CSS, modèles, textures, sons et polices).
  // - /assets/… : fichiers générés par Vite, au nom unique à chaque version : cache d'abord (rapide, jamais périmé).
  // - les autres (models.glb, textures, sons… au nom FIXE) : on redemande toujours au serveur s'il y a une nouvelle
  //   version (`no-cache` : requête conditionnelle, réponse 304 sans retéléchargement si rien n'a changé), et on
  //   garde la copie en cache seulement pour jouer hors connexion. Sinon un ancien models.glb restait en cache et
  //   les nouveaux modèles n'apparaissaient jamais.
  if (/\.(?:js|mjs|css|glb|gltf|bin|png|jpe?g|webp|avif|svg|woff2?|ttf|otf|mp3|ogg|wav)$/i.test(url.pathname)) {
    const hashed = url.pathname.startsWith('/assets/');
    event.respondWith((async () => {
      const cache = await caches.open(CCR_CACHE);
      if (hashed) {
        const cached = await cache.match(request);
        if (cached) return cached;
      }
      try {
        const response = await fetch(request, hashed ? undefined : { cache: 'no-cache' });
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return (await cache.match(request)) || Response.error();
      }
    })());
  }
});
