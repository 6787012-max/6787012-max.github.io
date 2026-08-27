/* network-first על ה-shell, cache-fallback. גרסה מעלים ביד בכל דיפלוי. */
var V = 'gm-v1';
var SHELL = ['./', './index.html', './css/main.css', './js/app.js',
             './js/config.js', './manifest.json', './img/logo-mark.svg',
             './img/icon-192.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(V).then(function (c) { return c.addAll(SHELL); })
    .then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (k) {
    return Promise.all(k.filter(function (x) { return x !== V; })
      .map(function (x) { return caches.delete(x); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  if (e.request.url.indexOf('supabase.co') >= 0) return;   // API — לא לשמור
  e.respondWith(
    fetch(e.request).then(function (r) {
      var cp = r.clone();
      caches.open(V).then(function (c) { c.put(e.request, cp); });
      return r;
    }).catch(function () { return caches.match(e.request); })
  );
});
