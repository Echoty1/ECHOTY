// src/services/fcmService.js
import { getToken, onMessage } from 'firebase/messaging';
import { ref, set, remove, serverTimestamp, get } from 'firebase/database';
import { db, getFirebaseMessaging } from './firebase';

const VAPID_KEY =
  process.env.REACT_APP_FIREBASE_VAPID_KEY ||
  process.env.REACT_APP_VAPID_PUBLIC_KEY;

const SW_URL = '/firebase-messaging-sw.js';
const SW_SCOPE = '/firebase-cloud-messaging-push-scope';

/**
 * Ensures the FCM service worker is registered and ACTIVE.
 * Resolves once the SW is ready.
 */
const ensureServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers not supported in this browser');
  }

  console.log('🔧 Ensuring service worker is registered...');

  // Check if it's already registered
  let registration = await navigator.serviceWorker.getRegistration(SW_SCOPE);

  if (!registration) {
    console.log('   Registering service worker at', SW_URL);
    registration = await navigator.serviceWorker.register(SW_URL, {
      scope: SW_SCOPE,
    });
    console.log('   ✅ Service worker registered');
  } else {
    console.log('   Service worker already registered');
  }

  // Wait for it to be active
  if (registration.installing) {
    console.log('   Waiting for SW to install...');
    await new Promise((resolve) => {
      registration.installing.addEventListener('statechange', (e) => {
        if (e.target.state === 'activated') resolve();
      });
    });
  } else if (registration.waiting) {
    console.log('   Waiting for SW to activate...');
    await new Promise((resolve) => {
      registration.waiting.addEventListener('statechange', (e) => {
        if (e.target.state === 'activated') resolve();
      });
    });
  }

  // Give the browser a moment to fully activate the SW
  await navigator.serviceWorker.ready;

  if (!registration.active) {
    throw new Error('Service worker registered but not active');
  }

  console.log('   ✅ Service worker is active');
  return registration;
};

export const registerFcmToken = async (uid) => {
  if (!uid) {
    console.warn('❌ registerFcmToken: no uid');
    return null;
  }

  console.log('🔔 registerFcmToken called for uid:', uid);
  console.log('   VAPID_KEY present:', !!VAPID_KEY);
  console.log('   VAPID_KEY prefix:', VAPID_KEY ? VAPID_KEY.slice(0, 20) : 'MISSING');

  if (!VAPID_KEY) {
    console.warn('❌ Missing VAPID key — FCM disabled');
    return null;
  }

  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('❌ Notifications not supported');
    return null;
  }

  try {
    console.log('   Requesting permission...');
    const permission = await Notification.requestPermission();
    console.log('   Permission result:', permission);
    if (permission !== 'granted') return null;

    // ─── KEY CHANGE: explicitly register SW before getToken ───
    await ensureServiceWorker();

    console.log('   Getting messaging instance...');
    const messaging = await getFirebaseMessaging();
    console.log('   Messaging instance:', messaging ? '✅' : '❌ null');
    if (!messaging) return null;

    console.log('   Calling getToken...');
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.getRegistration(SW_SCOPE),
    });
    console.log('   Token received:', token ? token.slice(0, 30) + '...' : '❌ null');

    if (!token) {
      console.warn('❌ No FCM token returned');
      return null;
    }

    console.log('   Saving token to Firebase...');
    await set(ref(db, `users/${uid}/fcmTokens/${token}`), {
      token,
      createdAt: serverTimestamp(),
      userAgent: (navigator.userAgent || '').slice(0, 200),
    });
    console.log('   ✅ Token saved to DB');

    try { localStorage.setItem('echo_fcm_token', token); } catch (_) {}

    console.log('✅ FCM registration complete');
    return token;
  } catch (err) {
    console.error('❌ FCM registration failed:');
    console.error('   Code:', err.code);
    console.error('   Message:', err.message);
    console.error('   Full:', err);
    return null;
  }
};

export const unregisterFcmToken = async (uid) => {
  if (!uid) return;
  let token = null;
  try { token = localStorage.getItem('echo_fcm_token'); } catch (_) {}
  if (!token) return;
  try {
    await remove(ref(db, `users/${uid}/fcmTokens/${token}`));
    localStorage.removeItem('echo_fcm_token');
  } catch (err) {
    console.warn('FCM unregister failed:', err);
  }
};

export const setupForegroundHandler = async () => {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return () => {};
  const unsub = onMessage(messaging, (payload) => {
    console.log('📩 Foreground FCM:', payload);
  });
  return unsub;
};

export const sendPushToUser = async ({ recipientUid, title, body, data = {} }) => {
  if (!recipientUid) return;
  try {
    const tokensSnap = await get(ref(db, `users/${recipientUid}/fcmTokens`));
    if (!tokensSnap.exists()) {
      console.warn('⚠️ No FCM tokens for user:', recipientUid);
      return;
    }

    const tokens = Object.keys(tokensSnap.val());
    if (!tokens.length) return;

    const FCM_KEY = process.env.REACT_APP_FIREBASE_API_KEY;
    if (!FCM_KEY) {
      console.warn('❌ Missing Firebase API key');
      return;
    }

    console.log('🔔 Sending push to', tokens.length, 'token(s) for user', recipientUid);

    const res = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `key=${FCM_KEY}`,
      },
      body: JSON.stringify({
        registration_ids: tokens,
        notification: { title, body, sound: 'default' },
        data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
        priority: 'high',
      }),
    });

    const result = await res.json();
    console.log('🔔 FCM response:', result);
  } catch (err) {
    console.warn('sendPushToUser failed:', err);
  }
};
