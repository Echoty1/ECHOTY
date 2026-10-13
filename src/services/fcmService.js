// src/services/fcmService.js
import { getToken, onMessage } from 'firebase/messaging';
import { ref, set, remove, serverTimestamp, get } from 'firebase/database';
import { db, getFirebaseMessaging } from './firebase';

const VAPID_KEY =
  process.env.REACT_APP_FIREBASE_VAPID_KEY ||
  process.env.REACT_APP_VAPID_PUBLIC_KEY;

const SW_URL = '/firebase-messaging-sw.js';
const SW_SCOPE = '/firebase-cloud-messaging-push-scope';

const BACKEND =
  process.env.REACT_APP_BACKEND_URL ||
  'https://echo-backend.onrender.com'; // ← change to your actual backend URL

/**
 * Ensures the FCM service worker is registered and ACTIVE.
 */
const ensureServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers not supported in this browser');
  }

  console.log('🔧 Ensuring service worker is registered...');

  let registration = await navigator.serviceWorker.getRegistration(SW_SCOPE);

  if (!registration) {
    console.log('   Registering service worker at', SW_URL);
    registration = await navigator.serviceWorker.register(SW_URL, {
      scope: SW_SCOPE,
    });
  }

  if (registration.installing) {
    await new Promise((resolve) => {
      registration.installing.addEventListener('statechange', (e) => {
        if (e.target.state === 'activated') resolve();
      });
    });
  } else if (registration.waiting) {
    await new Promise((resolve) => {
      registration.waiting.addEventListener('statechange', (e) => {
        if (e.target.state === 'activated') resolve();
      });
    });
  }

  await navigator.serviceWorker.ready;

  if (!registration.active) {
    throw new Error('Service worker registered but not active');
  }

  console.log('   ✅ Service worker is active');
  return registration;
};

/**
 * Detects the "version 1 vs 2" installations error and nukes the
 * conflicting IndexedDB records so we can start fresh.
 */
const clearInstallationCache = async () => {
  console.log('🧹 Clearing stale Firebase Installations records...');
  try {
    const dbs = await indexedDB.databases();
    for (const db of dbs) {
      if (
        db.name &&
        (db.name.includes('firebase') || db.name.includes('firebase-installations'))
      ) {
        await new Promise((resolve) => {
          const req = indexedDB.deleteDatabase(db.name);
          req.onsuccess = resolve;
          req.onerror = resolve;
          req.onblocked = resolve;
        });
        console.log('  ✅ Deleted:', db.name);
      }
    }
  } catch (err) {
    console.warn('  ⚠️ Could not clear IndexedDB:', err);
  }
};

/**
 * Register the FCM token for the given user.
 */
export const registerFcmToken = async (uid, _retried = false) => {
  if (!uid) {
    console.warn('❌ registerFcmToken: no uid');
    return null;
  }

  console.log('🔔 registerFcmToken called for uid:', uid);
  console.log('   VAPID_KEY present:', !!VAPID_KEY);

  if (!VAPID_KEY) {
    console.warn('❌ Missing VAPID key — FCM disabled');
    return null;
  }

  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('❌ Notifications not supported');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    await ensureServiceWorker();

    const messaging = await getFirebaseMessaging();
    if (!messaging) return null;

    const registration = await navigator.serviceWorker.getRegistration(SW_SCOPE);

    console.log('   Calling getToken...');
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      console.warn('❌ No FCM token returned');
      return null;
    }

    console.log('   Token received:', token.slice(0, 30) + '...');

    await set(ref(db, `users/${uid}/fcmTokens/${token}`), {
      token,
      createdAt: serverTimestamp(),
      userAgent: (navigator.userAgent || '').slice(0, 200),
    });
    console.log('   ✅ Token saved to DB');

    try {
      localStorage.setItem('echo_fcm_token', token);
    } catch (_) {}

    console.log('✅ FCM registration complete');
    return token;
  } catch (err) {
    console.error('❌ FCM registration failed:');
    console.error('   Code:', err.code);
    console.error('   Message:', err.message);

    const isVersionError =
      err.message?.includes('less than the existing version') ||
      err.message?.includes('version (1)') ||
      err.message?.includes('version (2)');

    if (isVersionError && !_retried) {
      console.log('🔁 Version conflict detected — clearing cache and retrying...');
      await clearInstallationCache();
      await new Promise((r) => setTimeout(r, 800));
      return registerFcmToken(uid, true);
    }

    return null;
  }
};

/**
 * Remove this device's FCM token from the DB.
 */
export const unregisterFcmToken = async (uid) => {
  if (!uid) return;
  let token = null;
  try {
    token = localStorage.getItem('echo_fcm_token');
  } catch (_) {}
  if (!token) return;
  try {
    await remove(ref(db, `users/${uid}/fcmTokens/${token}`));
    localStorage.removeItem('echo_fcm_token');
  } catch (err) {
    console.warn('FCM unregister failed:', err);
  }
};

/**
 * Foreground FCM handler — called when the app is open and focused.
 * Shows an in-app notification (or you can leave it as a console log).
 */
export const setupForegroundHandler = async () => {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return () => {};

  const unsub = onMessage(messaging, (payload) => {
    console.log('📩 Foreground FCM:', payload);

    const title = payload.notification?.title || payload.data?.title;
    const body = payload.notification?.body || payload.data?.body;
    const partnerId = payload.data?.partnerId;

    // Browser notifications work even in foreground if permission granted
    if (Notification.permission === 'granted' && title) {
      try {
        const notif = new Notification(title, {
          body,
          icon: '/logo192.png',
          tag: payload.data?.tag || partnerId || 'echo-msg',
        });
        notif.onclick = () => {
          window.focus();
          if (partnerId) window.location.hash = `#/chat/${partnerId}`;
        };
      } catch (_) {}
    }
  });

  return unsub;
};

/**
 * Send a push to a user via the backend.
 * The backend uses Firebase Admin (FCM v1) — this is the modern, working path.
 */
export const sendPushToUser = async ({ recipientUid, title, body, data = {} }) => {
  if (!recipientUid) return;

  try {
    // Get a fresh ID token so the backend can verify the request
    const { auth } = await import('./firebase');
    const token = await auth.currentUser?.getIdToken?.();

    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${BACKEND}/api/send-notification`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ recipientUid, title, body, data }),
    });

    if (!res.ok) {
      console.warn('Push backend returned', res.status);
      return;
    }

    const result = await res.json().catch(() => ({}));
    console.log('🔔 Push sent:', result);
  } catch (err) {
    console.warn('sendPushToUser failed:', err);
  }
};
