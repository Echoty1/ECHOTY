/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */

// ─── FCM: Load Firebase compat SDKs ───────────────────────
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// ─── FCM: Initialize Firebase ─────────────────────────────
firebase.initializeApp({
  apiKey: 'AIzaSyCpnS3fhJJVI6csN7HoK9D0E_YA1MkChmE',
  authDomain: 'echo-a22c3.firebaseapp.com',
  databaseURL: 'https://echo-a22c3-default-rtdb.firebaseio.com',
  projectId: 'echo-a22c3',
  storageBucket: 'echo-a22c3.firebasestorage.app',
  messagingSenderId: '405798543827',
  appId: '1:405798543827:web:5ae9f3624a27bf2e304f26',
});

let messaging = null;
try {
  messaging = firebase.messaging();
  console.log('[SW] Firebase Messaging initialized');
} catch (err) {
  console.warn('[SW] Firebase Messaging not available:', err);
}

// ─── FCM: Background message handler (WhatsApp Style) ─────
if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Background message received:', payload);

    const notification = payload.notification || {};
    const data = payload.data || {};

    const title = notification.title || data.title || 'New Message';
    const body = notification.body || data.body || 'You have a new message';

    const options = {
      body: body,
      icon: data.icon || '/logo192.png', // Ensure this exists in your public folder
      badge: '/logo192.png',
      vibrate: [200, 100, 200], // Double buzz like WhatsApp
      tag: data.partnerId ? `chat-${data.partnerId}` : 'echo-msg', // Groups messages from same person
      renotify: true, // Vibrates again if a new message comes from the same person
      data: {
        partnerId: data.partnerId || '',
        url: data.partnerId ? `/chat/${data.partnerId}` : '/', // Deep link to chat
      },
    };

    self.registration.showNotification(title, options);
  });
}

// ─── Notification click handler ───────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 1. Check if the app is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // 2. If not open, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// ─── Existing caching logic ───────────────────────────────
const CACHE_NAME = 'echo-v2-cache-v4';

const PASS_THROUGH = [
  'googleapis.com', 'gstatic.com', 'google.com', 'firebaseio.com',
  'firebasestorage.googleapis.com', 'cloudinary.com', 'onrender.com', 'myhappr.com',
];

function shouldBypass(url) {
  try {
    const host = new URL(url).hostname;
    return PASS_THROUGH.some((part) => host.includes(part));
  } catch {
    return true;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || shouldBypass(request.url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => response).catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return networkResponse;
      })
      .catch(() => caches.match(request).then((cached) => cached || Response.error()))
  );
});
