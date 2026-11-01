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
} catch (err) {
  console.warn('[SW] Firebase Messaging not available:', err);
}

// ─── FCM: Background Message Handler ──────────────────────
if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    const notification = payload.notification || {};
    const data = payload.data || {};

    const title = notification.title || data.title || 'New Message';
    const body = notification.body || data.body || 'You have a new message';

    // These options make it look native on Android and iOS
    const options = {
      body: body,
      icon: data.icon || '/logo192.png', // Ensure this exists in your public folder
      badge: '/logo192.png',
      vibrate: [200, 100, 200, 100, 200], // WhatsApp-style double buzz
      tag: data.partnerId ? `chat-${data.partnerId}` : 'echo-msg', // Prevents stacking multiple notifications from the same person
      renotify: true, // Alerts the user again if the tag matches
      data: {
        url: data.url || '/', // Where to go when clicked
        partnerId: data.partnerId || '',
      },
    };

    self.registration.showNotification(title, options);
  });
}

// ─── Notification Click Handler ───────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close(); // Close the notification

  const urlToOpen = new URL(event.notification.data?.url || '/', self.location.origin).href;

  const promiseChain = clients
    .matchAll({
      type: 'window',
      includeUncontrolled: true,
    })
    .then((windowClients) => {
      let matchingClient = null;

      // Check if the app is already open
      for (let i = 0; i < windowClients.length; i++) {
        const windowClient = windowClients[i];
        if (windowClient.url === urlToOpen) {
          matchingClient = windowClient;
          break;
        }
      }

      // If open, focus it. If not, open a new tab.
      if (matchingClient) {
        return matchingClient.focus();
      } else {
        return clients.openWindow(urlToOpen);
      }
    });

  event.waitUntil(promiseChain);
});

// ─── Existing caching logic (kept as-is) ──────────────────
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
    event.respondWith(fetch(request).then((response) => response).catch(() => caches.match(request)));
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
