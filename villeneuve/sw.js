// Cœur de Ville — Service Worker
// Gère les notifications push reçues par le navigateur

self.addEventListener('install', event => {
  console.log('[SW] Installed');
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('[SW] Activated');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', event => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    payload = { title: 'Cœur de Ville', body: event.data.text() };
  }

  const options = {
    body: payload.body || '',
    icon: '/villeneuve/icon-192.png',
    badge: '/villeneuve/icon-badge.png',
    tag: 'cdv-' + (payload.timestamp || Date.now()),
    requireInteraction: false,
    data: {
      url: payload.url || '/',
      category: payload.category || ''
    },
    actions: payload.url ? [
      { action: 'open', title: 'Ouvrir' },
      { action: 'close', title: 'Fermer' }
    ] : []
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Cœur de Ville', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'close') return;

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Cherche un onglet déjà ouvert
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      // Sinon ouvre un nouvel onglet
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
