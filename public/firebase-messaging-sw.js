/* eslint-disable no-undef */
// public/firebase-messaging-sw.js
// FCM background message handler — runs even when the app is closed

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// ⚠️ Values must be hard-coded here — service workers can't read .env
firebase.initializeApp({
  apiKey: 'AIzaSyCMLsv58es_SWlvvm9Ky-cRHJXHTgNNKbc',
  authDomain: 'echoty-fa3ca.firebaseapp.com',
  projectId: 'echoty-fa3ca',
  databaseURL: 'https://echoty-fa3ca-default-rtdb.firebaseio.com',
  storageBucket: 'echoty-fa3ca.firebasestorage.app',
  messagingSenderId: '506340369217',
  appId: '1:506340369217:android:4f41079ebe3928daaab7c0',
});

const messaging = firebase.messaging();

// Handle background messages
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

// Notification click — open the chat
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
