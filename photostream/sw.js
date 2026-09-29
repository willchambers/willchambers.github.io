// Photostream service worker. Scope: /photostream/.
//
// - The app's own files are cached on install, one cache per release, so the
//   app opens instantly and with no signal. The list comes from shell.json
//   (written by the release script; the dev server makes it on the fly).
// - Site photos (/img/…, /assets/uploads/…) are cached as they're viewed.
//   /img/ names are content hashes, so a cached copy never goes stale.
// - Fonts from Google are cached the first time they load.
// - Everything else goes straight to the network. The page keeps its own
//   saved copies of /photos.json and the library (js/saved.js), and GitHub
//   API calls, which carry the token, are never touched here.
//
// Locally VERSION is "dev": the app's files then come from the network
// first, so edits show up, and from the cache only when offline.

const VERSION = '5f17f99'; // stamped by the release script
const DEV = VERSION === 'dev';

const SHELL = `photostream-shell-${VERSION}`;
const PHOTOS = 'photostream-photos-v1';
const FONTS = 'photostream-fonts-v1';
const PHOTO_LIMIT = 400;
const SCOPE = new URL(self.registration.scope).pathname; // "/photostream/"

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const list = await (await fetch('shell.json', { cache: 'no-store' })).json();
    const cache = await caches.open(SHELL);
    // Revalidate past the browser's HTTP cache, so a release never mixes
    // new and old files.
    await cache.addAll(list.map((path) => new Request(path, { cache: 'no-cache' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('photostream-shell-') && name !== SHELL) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith(SCOPE)) {
      // /photostream/__data/ and __library/ are cache keys, not files.
      if (url.pathname.startsWith(`${SCOPE}__`)) return;
      event.respondWith(appFile(request, url));
    } else if (url.pathname.startsWith('/img/') || url.pathname.startsWith('/assets/uploads/')) {
      event.respondWith(photo(request));
    }
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(FONTS, request));
  }
});

async function appFile(request, url) {
  const cache = await caches.open(SHELL);
  // Any page in the scope is the app's one page.
  const key = request.mode === 'navigate' ? SCOPE : request;
  const cached = await cache.match(key, { ignoreSearch: request.mode === 'navigate' });

  if (!DEV && cached) return cached;
  try {
    const res = await fetch(request);
    if (res.ok && url.pathname !== `${SCOPE}shell.json`) cache.put(key, res.clone());
    return res;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

async function photo(request) {
  const cache = await caches.open(PHOTOS);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) {
    await cache.put(request, res.clone());
    trim(cache, PHOTO_LIMIT);
  }
  return res;
}

async function cacheFirst(name, request) {
  const cache = await caches.open(name);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
  return res;
}

// Keep the newest `limit` entries (Cache Storage lists oldest first).
async function trim(cache, limit) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - limit))) await cache.delete(key);
}
