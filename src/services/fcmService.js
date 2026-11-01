// src/services/fcmService.js
import { getMessaging, getToken } from 'firebase/messaging';
import { ref, set } from 'firebase/database';
import { app, db } from './firebase'; 

const VAPID_KEY = 'BDBlwKrHur1ThJQEmRP5fN--0d-wjHU_uAVDh2RY1JidWQI4ojtndM-fM4egmT-LwE2zG0RfTMVA6fxvWq71CYQBNaJXP5fHYsz1axBYdSRDEatGNCfN_kqgmzeWzWvjC9L-rQLY0Ppr4IeNVQvronwd0C95NQtMRPzWfmEmvdxeZM';

export const registerFcmToken = async (userId) => {
  try {
    if (!('Notification' in window)) {
      return false;
    }

    // Check if permission is already granted before asking
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return false;
    } else if (Notification.permission === 'denied') {
      return false;
    }

    const messaging = getMessaging(app);
    const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });

    if (currentToken) {
      await set(ref(db, `users/${userId}/fcmTokens/${currentToken}`), true);
      console.log('FCM Token saved successfully');
      return true;
    }
    return false;
  } catch (error) {
    // Silently ignore errors so it doesn't break the send message logic
    console.warn('FCM registration failed:', error);
    return false;
  }
};
