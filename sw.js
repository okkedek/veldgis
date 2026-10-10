/* Veldgis service worker: maakt de app installeerbaar en start hem ook zonder bereik.
   App-bestanden: eerst netwerk (zodat updates direct binnenkomen), bij geen bereik uit de cache.
   Kaarttegels en data gaan gewoon via het netwerk. */
const CACHE = 'veldgis-v1';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'https://cdn.jsdelivr.net/npm/ol@9.2.4/ol.css',
  'https://cdn.jsdelivr.net/npm/ol@9.2.4/dist/ol.js',
  'https://cdn.jsdelivr.net/npm/proj4@2.11.0/dist/proj4.js',
  'https://cdn.jsdelivr.net/npm/geotiff@2.1.3/dist-browser/geotiff.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const isShell = (url) => url.origin === self.location.origin || url.hostname === 'cdn.jsdelivr.net';

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || !isShell(url)) return;  // kaarten en data: niet aankomen
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
