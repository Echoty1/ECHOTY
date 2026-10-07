/* eslint-disable no-undef */
// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCpnS3fhJJVI6csN7HoK9D0E_YA1MkChmE',
  authDomain: 'echo-a22c3.firebaseapp.com',
  databaseURL: 'https://echo-a22c3-default-rtdb.firebaseio.com',
  projectId: 'echo-a22c3',
  storageBucket: 'echo-a22c3.firebasestorage.app',
  messagingSenderId: '405798543827',
  appId: '1:405798543827:web:5ae9f3624a27bf2e304f26',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  const data = payload.data || {};

  const title = notification.title || data.title || 'New message';
  const body = notification.body || data.body || 'You have a new message';

  self.registration.showNotification(title, {
    body,
    icon: data.icon || '/logo192.png',
    badge: '/logo192.png',
    tag: data.partnerId ? `chat-${data.partnerId}` : 'echo-msg',
    renotify: true,
    vibrate: [200, 100, 200],
    data: {
      partnerId: data.partnerId || '',
      url: data.partnerId ? `/chat/${data.partnerId}` : '/',
    },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
