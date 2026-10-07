// src/services/fcmService.js
import { getToken, onMessage } from 'firebase/messaging';
import { ref, set, remove, serverTimestamp } from 'firebase/database';
import { db, getFirebaseMessaging } from './firebase';

const VAPID_KEY = process.env.REACT_APP_FIREBASE_VAPID_KEY;

/**
 * Request permission and register this device's FCM token for the user.
 * Safe to call multiple times — token is idempotent.
 */
export const registerFcmToken = async (uid) => {
  if (!uid) return null;
  if (!VAPID_KEY) {
    console.warn('Missing REACT_APP_FIREBASE_VAPID_KEY — FCM disabled');
    return null;
  }
  if (!('Notification' in window)) {
    console.warn('Notifications not supported in this browser');
    return null;
  }

  try {
    // Ask user for permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }

    // Get the messaging instance
    const messaging = await getFirebaseMessaging();
    if (!messaging) return null;

    // Get the FCM token
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!token) {
      console.warn('No FCM token returned');
      return null;
    }

    // Save token to Firebase under the user
    // Path: /users/{uid}/fcmTokens/{token}
    await set(ref(db, `users/${uid}/fcmTokens/${token}`), {
      token,
      createdAt: serverTimestamp(),
      userAgent: navigator.userAgent.slice(0, 200),
    });

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
export const unregisterFcmToken = async (uid, token) => {
  if (!uid || !token) return;
  try {
    await remove(ref(db, `users/${uid}/fcmTokens/${token}`));
  } catch (err) {
    console.warn('FCM unregister failed:', err);
  }
};

/**
 * Foreground message handler — fires when app is open.
 * We already show in-app banners via useGlobalMessageListener,
 * so we suppress duplicate OS notifications here.
 */
export const setupForegroundHandler = async () => {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return () => {};

  const unsub = onMessage(messaging, (payload) => {
    // Foreground push — we don't show OS notification
    // because the in-app banner already handles it.
    console.log('📩 Foreground FCM:', payload);
  });

  return unsub;
};

/**
 * Send a push notification to a recipient via FCM v1 HTTP API.
 * ⚠️ This uses the Web API key (public), so it's rate-limited by Google.
 *
 * For production security, move this to a Cloud Function.
 */
export const sendPushToUser = async ({ recipientUid, title, body, data = {} }) => {
  if (!recipientUid) return;

  try {
    // Fetch recipient's FCM tokens from DB
    const { get } = await import('firebase/database');
    const tokensSnap = await get(ref(db, `users/${recipientUid}/fcmTokens`));
    if (!tokensSnap.exists()) return;

    const tokens = Object.keys(tokensSnap.val());
    if (!tokens.length) return;

    // Send to FCM (legacy endpoint works with API key)
    // NOTE: This is the free, no-server approach.
    const FCM_KEY = process.env.REACT_APP_FIREBASE_API_KEY;
    const PROJECT_ID = process.env.REACT_APP_FIREBASE_PROJECT_ID;

    // Use FCM legacy endpoint (still supported for basic sends)
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
          projectId: PROJECT_ID,
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
        },
        priority: 'high',
      }),
    });
  } catch (err) {
    console.warn('sendPushToUser failed:', err);
  }
};
