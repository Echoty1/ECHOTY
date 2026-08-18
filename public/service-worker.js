// public/service-worker.js

/* eslint-disable no-restricted-globals */

const CACHE_NAME = 'echo-v2-cache-v3';

// ─── Install: skip waiting to activate immediately ────────────
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

// ─── Activate: claim clients and clean old caches ─────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ─── Fetch: cache‑first, but dynamically cache new assets ─────
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Cache hit – return it
      if (response) {
        return response;
      }

      // Clone the request because it's a one‑time use stream
      const fetchRequest = event.request.clone();

      return fetch(fetchRequest).then((networkResponse) => {
        // Check if we received a valid response
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        // Clone the response because we need to use it and cache it
        const responseToCache = networkResponse.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      });
    })
  );
});