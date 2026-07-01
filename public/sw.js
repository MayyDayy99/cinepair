/* CinePair service worker:
   - installable + offline support (network-first caching)
   - Firebase Cloud Messaging background handler (data-only -> exactly one notification) */

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

// Public Firebase web config (safe to ship; access is governed by Firestore rules).
firebase.initializeApp({
  apiKey: 'AIzaSyC8E5q9agK_utY_GZzvt9NIvIO0b1HV2Gk',
  authDomain: 'cinepair-31543.firebaseapp.com',
  projectId: 'cinepair-31543',
  messagingSenderId: '113009325170',
  appId: '1:113009325170:web:76cb08f667a371ddd8feeb',
});

try {
  const messaging = firebase.messaging();
  // Backend sends DATA-ONLY messages, so we render exactly one notification here
  // (a `notification` payload would auto-display AND fire this -> duplicates).
  messaging.onBackgroundMessage((payload) => {
    const d = (payload && payload.data) || {};
    self.registration.showNotification(d.title || 'CinePair', {
      body: d.body || 'Új találat! 🍿',
      icon: d.icon || self.registration.scope + 'icon-512.png',
      badge: self.registration.scope + 'icon-512.png',
      data: { link: d.link || self.registration.scope + '#/watchlist' },
    });
  });
} catch (e) {
  // messaging unsupported in this browser — offline caching still works.
}

const CACHE = 'cinepair-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// Network-first for same-origin GETs: always fresh online, cached copy offline.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (err) {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === 'navigate') {
          const shell = await caches.match(self.registration.scope);
          if (shell) return shell;
        }
        throw err;
      }
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => 'focus' in c);
      if (existing) {
        existing.focus();
        if ('navigate' in existing) existing.navigate(link).catch(() => {});
        return;
      }
      return self.clients.openWindow(link);
    })
  );
});
