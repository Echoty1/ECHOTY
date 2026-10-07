// src/services/fcmService.js
import { getToken, onMessage } from 'firebase/messaging';
import { ref, set, remove, serverTimestamp, get } from 'firebase/database';
import { db, getFirebaseMessaging } from './firebase';

const VAPID_KEY =
  process.env.REACT_APP_FIREBASE_VAPID_KEY ||
  process.env.REACT_APP_VAPID_PUBLIC_KEY;

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

    console.log('   Getting messaging instance...');
    const messaging = await getFirebaseMessaging();
    console.log('   Messaging instance:', messaging ? '✅' : '❌ null');
    if (!messaging) return null;

    console.log('   Calling getToken...');
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
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
