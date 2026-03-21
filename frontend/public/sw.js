// LibraryDesk Service Worker v4.0
// Strategy: Network-first for app files (always get latest on deploy)
//           Cache-first only for static assets (icons, fonts)
//           Never cache API calls

const CACHE_NAME = 'librarydesk-v4';
const STATIC_CACHE = 'librarydesk-static-v4';

// Only cache truly static assets that never change
const IMMUTABLE_ASSETS = [
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/manifest.json',
];

// ── INSTALL: cache only immutable assets ──────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC_CACHE)
      .then(c => c.addAll(IMMUTABLE_ASSETS.filter(a => {
        // Don't fail install if an asset is missing
        return fetch(a).then(() => true).catch(() => false);
      })))
      .then(() => self.skipWaiting()) // activate immediately, don't wait for old sw to die
  );
});

// ── ACTIVATE: delete ALL old caches ──────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== STATIC_CACHE)
          .map(k => {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      ))
      .then(() => self.clients.claim()) // take control of all open tabs immediately
  );
});

// ── FETCH: smart caching strategy ─────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // Skip non-GET, chrome extensions, cross-origin requests
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;
  if (url.origin !== self.location.origin) return;

  // Never cache API calls — always network
  if (url.pathname.startsWith('/api/')) return;

  // For HTML navigation (page loads) — network first, fall back to cache
  // This ensures users always get the latest index.html after a deploy
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then(res => {
          // Cache the fresh response
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
          return res;
        })
        .catch(() => {
          // Offline fallback — serve cached index.html
          return caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }

  // For JS/CSS assets with hash in filename (e.g. /assets/index-Abc123.js)
  // Vite adds content hash to filenames — these are immutable, safe to cache
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // For icons and manifest — cache first (they rarely change)
  if (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.json') {
    e.respondWith(
      caches.match(request).then(cached => cached || fetch(request))
    );
    return;
  }

  // Everything else — network first
  e.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
        }
        return res;
      })
      .catch(() => caches.match(request))
  );
});

// ── PUSH NOTIFICATIONS ────────────────────────────────────────────────────────
self.addEventListener('push', e => {
  if (!e.data) return;
  let data = {};
  try { data = e.data.json(); } catch(err) { data = { title: 'LibraryDesk', body: e.data.text() }; }
  e.waitUntil(
    self.registration.showNotification(data.title || 'LibraryDesk', {
      body:     data.body || '',
      icon:     data.icon  || '/icons/icon-192.png',
      badge:    data.badge || '/icons/icon-96.png',
      vibrate:  [200, 100, 200],
      tag:      data.tag   || 'librarydesk-' + Date.now(),
      renotify: true,
      data:     { url: data.url || '/' },
    })
  );
});

// ── NOTIFICATION CLICK ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ── MESSAGE: force update from app ───────────────────────────────────────────
// App can send { type: 'SKIP_WAITING' } to force sw update immediately
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
