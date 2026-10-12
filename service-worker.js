const CACHE_VERSION = 'smart-revision-v2';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;
const APP_BASE = new URL('./', self.location.href);
const BOOTSTRAP_CSS = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css';
const APP_FILES = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './offline.html',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
  './english.json',
  './question-banks/marathi.json',
  './question-banks/hindi.json',
  './question-banks/mathematics.json',
  './question-banks/computer.json',
  './question-banks/evs1.json',
  './question-banks/evs2.json'
];
const APP_URLS = new Set(APP_FILES.map(path => new URL(path, APP_BASE).href));

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(APP_FILES.map(path => new URL(path, APP_BASE)));
    try {
      const response = await fetch(BOOTSTRAP_CSS, { mode: 'cors', cache: 'reload' });
      if (response.ok) {
        await cache.put(BOOTSTRAP_CSS, response);
      }
    } catch (error) {
      console.warn('Bootstrap CDN stylesheet was not available for offline caching.', error);
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter(name => name.startsWith('smart-revision-') && name !== SHELL_CACHE && name !== ASSET_CACHE)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.href === BOOTSTRAP_CSS) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
  if (APP_URLS.has(url.href)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (url.pathname.endsWith('.json')) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(ASSET_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    if (request.mode === 'navigate') {
      return (await caches.match(new URL('./offline.html', APP_BASE))) || Response.error();
    }
    throw error;
  }
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request) || await caches.match(new URL('./index.html', APP_BASE));
    return cached || await caches.match(new URL('./offline.html', APP_BASE)) || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request) || await caches.match(request);
  const refresh = fetch(request).then(response => {
    if (response.ok) return cache.put(request, response.clone()).then(() => response);
    return response;
  });
  if (cached) {
    refresh.catch(error => console.info('Question bank refresh deferred while offline.', error));
    return cached;
  }
  try {
    return await refresh;
  } catch (error) {
    throw error;
  }
}
