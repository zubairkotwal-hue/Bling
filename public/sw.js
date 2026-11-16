// Service worker for admin notifications.
//
// Deliberately does NOT cache anything. A cache here would serve a stale
// index.html after a deploy, which on a single-file app means shipping fixes
// that never reach the phone. Notifications only.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: 'Bling Happiness', body: 'Something new came in.', url: '/' };
  try {
    if (event.data) data = Object.assign(data, event.data.json());
  } catch (e) { /* keep the default wording */ }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      // One notification per kind, so ten stories replace each other rather
      // than stacking into ten separate alerts.
      tag: data.kind || 'general',
      renotify: true,
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // Focus a tab that is already open rather than piling up new ones.
      for (const client of list){
        if ('focus' in client){
          client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
