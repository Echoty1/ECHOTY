/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */

// ─── Monetag Push Notifications Listener ──────────────────
// This allows Monetag to show push notifications
try {
  importScripts('https://5gvci.com/act/files/sw.js?z=12169371');
} catch (e) {
  console.warn('Monetag SW failed to load', e);
}

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

// ─── FCM: Background message handler ──────────────────────
if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Background message received:', payload);

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
}

// ─── FCM: Notification click handler ──────────────────────
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

// ─── Existing caching logic (kept as-is) ──────────────────
const CACHE_NAME = 'echo-v2-cache-v4';

const PASS_THROUGH = [
  'googleapis.com',
  'gstatic.com',
  'google.com',
  'firebaseio.com',
  'firebasestorage.googleapis.com',
  'cloudinary.com',
  'onrender.com',
  'myhappr.com',
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
  if (request.method !== 'GET' || shouldBypass(request.url)) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() => caches.match(request))
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
