/* Sports X Arena — Service Worker
 * Strategy:
 *  - NETWORK-FIRST for navigations (index.html) so phones always run the
 *    latest app version when they have signal; cache is offline fallback only.
 *  - Supabase requests are NEVER cached or intercepted — availability must
 *    always be live.
 *  - Bump CACHE_VERSION on every deploy to purge old caches.
 */
const CACHE_VERSION = 'sxa-v2';
const APP_SHELL = ['./', './index.html'];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // take over immediately, don't wait for old tabs
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never touch Supabase (or any cross-origin API) — must always be live
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== 'GET') return;

  // Navigations + the app shell: network first, cache fallback
  if (event.request.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(event.request).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  // Other same-origin GETs (icons etc): cache first, then network
  event.respondWith(
    caches.match(event.request).then((hit) =>
      hit ||
      fetch(event.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
        return res;
      })
    )
  );
});
