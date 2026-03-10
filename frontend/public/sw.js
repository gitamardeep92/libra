// LibraryDesk Service Worker v2.0
const CACHE_NAME = 'librarydesk-v2';
const STATIC_CACHE = 'librarydesk-static-v2';
const PRECACHE_ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(STATIC_CACHE).then(c=>c.addAll(PRECACHE_ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME&&k!==STATIC_CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const {request} = e; const url = new URL(request.url);
  if (request.method!=='GET'||url.protocol==='chrome-extension:') return;
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(request).then(r=>{if(r.ok){const c=r.clone();caches.open(CACHE_NAME).then(ca=>ca.put(request,c));}return r;}).catch(()=>caches.match(request)));
    return;
  }
  if (request.mode==='navigate') { e.respondWith(caches.match('/index.html').then(c=>c||fetch(request))); return; }
  e.respondWith(caches.match(request).then(c=>c||fetch(request).then(r=>{if(r.ok){const cl=r.clone();caches.open(CACHE_NAME).then(ca=>ca.put(request,cl));}return r;})));
});

// ── PUSH NOTIFICATIONS ──
self.addEventListener('push', e => {
  if (!e.data) return;
  let data = {};
  try { data = e.data.json(); } catch(err) { data = {title:'LibraryDesk', body:e.data.text()}; }
  e.waitUntil(self.registration.showNotification(data.title||'LibraryDesk', {
    body:    data.body||'',
    icon:    data.icon||'/icons/icon-192.png',
    badge:   data.badge||'/icons/icon-96.png',
    vibrate: [200,100,200],
    tag:     data.tag||'librarydesk-'+Date.now(),
    renotify:true,
    data:    {url: data.url||'/'},
  }));
});

// ── NOTIFICATION CLICK ──
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url||'/';
  e.waitUntil(
    clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
      for (const c of list) { if(c.url.includes(self.location.origin)&&'focus' in c){c.navigate(url);return c.focus();} }
      if(clients.openWindow) return clients.openWindow(url);
    })
  );
});
