// Minimal service worker: precache the app shell so the app opens (and the
// pins/notes work) even with a flaky connection. Map tiles stay network-first
// — caching OSM tiles aggressively is against their usage policy.
const CACHE = 'promptrip-v80';
// Durable runtime caches (not wiped on version bump) so map tiles and photos
// you've already viewed stay available offline. Cache-as-you-browse: whatever
// you pan/zoom over and whatever photos load get tucked away for next time.
const TILE_CACHE = 'vienna-tiles-v1';
const IMG_CACHE = 'vienna-photos-v1';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './data.js',
  './lz-string.min.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.svg',
  './icons/favicon-32.png',
  './icons/favicon-16.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

const KEEP = [CACHE, TILE_CACHE, IMG_CACHE];
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first, then fill a durable cache — used for map tiles and photos so
// anything you've seen still works offline, without an upfront bulk download.
function cacheAsYouBrowse(request, cacheName) {
  return fetch(request)
    .then((resp) => {
      if (resp && resp.ok) {
        const copy = resp.clone();
        caches.open(cacheName).then((c) => c.put(request, copy));
      }
      return resp;
    })
    .catch(() => caches.match(request).then((hit) => hit || Promise.reject('offline')));
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Map tiles: cache the ones you actually pan/zoom over (gentle on the tile
  // servers — no bulk scraping), serve from cache when offline.
  if (url.hostname.endsWith('cartocdn.com') || url.hostname.endsWith('tile.openstreetmap.org')) {
    e.respondWith(cacheAsYouBrowse(e.request, TILE_CACHE));
    return;
  }
  // Wikimedia photos (freely licensed): cache-first so revisits are instant
  // and offline-safe.
  if (url.hostname.endsWith('wikimedia.org') && /\/(thumb|commons)\//.test(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then((hit) => hit || cacheAsYouBrowse(e.request, IMG_CACHE))
    );
    return;
  }
  // App shell: cache-first.
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});

// Tapping the lock-screen shortcut reopens the app on its resolved target.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    (async () => {
      const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of all) {
        if ('focus' in c) {
          c.postMessage({ type: 'open-target' });
          return c.focus();
        }
      }
      return clients.openWindow('./');
    })()
  );
});
