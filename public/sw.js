// Service worker de FitTrack Pro
// v3 (2026-11-04): index.html SIEMPRE se pide primero a la red. Antes se servía desde
// caché a las peticiones normales, y el script de auto-actualización de index.html
// recibía una copia vieja → creía que había versión nueva → recargaba en ciclo infinito.
// Ver docs/BITACORA.md. Cambiar CACHE_NAME borra las cachés anteriores al activarse.
const CACHE_NAME = 'fittrack-pro-v3';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(['/'])));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Nunca interceptar APIs ni servicios externos
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Páginas e index.html: red primero; la copia guardada solo si no hay internet
  if (req.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copia = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('/', copia)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Archivos con hash (/assets/*), íconos, etc.: caché primero
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      if (res.ok && url.pathname.startsWith('/assets/')) {
        const copia = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copia)).catch(() => {});
      }
      return res;
    }))
  );
});
