// src/services/fcmService.js
import { getToken, onMessage } from 'firebase/messaging';
import { ref, set, remove, serverTimestamp, get } from 'firebase/database';
import { db, getFirebaseMessaging } from './firebase';

const VAPID_KEY =
  process.env.REACT_APP_FIREBASE_VAPID_KEY ||
  process.env.REACT_APP_VAPID_PUBLIC_KEY;

/**
 * Register this device's FCM token for the user.
 * Idempotent — safe to call multiple times.
 */
export const registerFcmToken = async (uid) => {
  if (!uid) return null;
  if (!VAPID_KEY) {
    console.warn('Missing VAPID key — FCM disabled');
    return null;
  }
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('Notifications not supported in this environment');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }

    const messaging = await getFirebaseMessaging();
    if (!messaging) return null;

    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!token) {
      console.warn('No FCM token returned');
      return null;
    }

    // Save token to Firebase under the user
    await set(ref(db, `users/${uid}/fcmTokens/${token}`), {
      token,
      createdAt: serverTimestamp(),
      userAgent: (navigator.userAgent || '').slice(0, 200),
    });

    // Cache token locally for logout cleanup
    try { localStorage.setItem('echo_fcm_token', token); } catch (_) {}

    console.log('✅ FCM token registered:', token.slice(0, 20) + '...');
    return token;
  } catch (err) {
    console.error('FCM registration failed:', err);
    return null;
  }
};

/**
 * Remove token on logout.
 */
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

/**
 * Foreground message handler.
 */
export const setupForegroundHandler = async () => {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return () => {};

  const unsub = onMessage(messaging, (payload) => {
    console.log('📩 Foreground FCM:', payload);
  });

  return unsub;
};

/**
 * Send a push notification to a recipient via FCM.
 * Uses Firebase Web API key (public, rate-limited by Google).
 * Free — no Cloud Functions needed.
 */
export const sendPushToUser = async ({ recipientUid, title, body, data = {} }) => {
  if (!recipientUid) return;
  try {
    const tokensSnap = await get(ref(db, `users/${recipientUid}/fcmTokens`));
    if (!tokensSnap.exists()) return;

    const tokens = Object.keys(tokensSnap.val());
    if (!tokens.length) return;

    const FCM_KEY = process.env.REACT_APP_FIREBASE_API_KEY;
    if (!FCM_KEY) {
      console.warn('Missing Firebase API key — cannot send FCM');
      return;
    }

    await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `key=${FCM_KEY}`,
      },
      body: JSON.stringify({
        registration_ids: tokens,
        notification: { title, body, sound: 'default' },
        data: {
          ...data,
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
        },
        priority: 'high',
      }),
    });
  } catch (err) {
    console.warn('sendPushToUser failed:', err);
  }
};
