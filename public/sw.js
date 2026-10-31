self.addEventListener('push', event => {
  let data = {}; try { data = event.data?.json() || {}; } catch { data = { body: event.data?.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || 'Common Ground · Agenda watch', {
    body: data.body || 'A published agenda may relate to your saved topics.',
    icon: '/favicon.svg', tag: data.tag || data.id || 'common-ground-agenda',
    data: { url: '/?view=evidence' },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    const window = windows.find(client => new URL(client.url).origin === self.location.origin);
    return window ? window.focus().then(() => window.navigate('/?view=evidence')) : clients.openWindow('/?view=evidence');
  }));
});
