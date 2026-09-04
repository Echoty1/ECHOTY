/* eslint-disable no-restricted-globals */
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
