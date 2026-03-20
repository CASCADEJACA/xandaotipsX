self.addEventListener('install', event => { event.waitUntil(caches.open('xtips-v1').then(cache => cache.addAll(['./','./index.html','./styles.css','./app.js','./manifest.json','./assets/icon-192.png','./assets/icon-512.png']))); self.skipWaiting();});
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim());});
self.addEventListener('fetch', event => { event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request))); });
