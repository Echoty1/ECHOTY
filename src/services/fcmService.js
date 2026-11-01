// src/services/fcmService.js
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { ref, set } from 'firebase/database';
import { app, db } from './firebase'; // Importing 'app' from the updated firebase.js

// 👇 YOUR NEW VAPID KEY
const VAPID_KEY = 'BDBlwKrHur1ThJQEmRP5fN--0d-wjHU_uAVDh2RY1JidWQI4ojtndM-fM4egmT-LwE2zG0RfTMVA6fxvWq71CYQBNaJXP5fHYsz1axBYdSRDEatGNCfN_kqgmzeWzWvjC9L-rQLY0Ppr4IeNVQvronwd0C95NQtMRPzWfmEmvdxeZM';

// This is the function causing the build error. It is now correctly exported.
export const registerFcmToken = async (userId) => {
  try {
    if (!('Notification' in window)) {
      console.warn('This browser does not support desktop notification');
      return false;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const messaging = getMessaging(app);
      const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });

      if (currentToken) {
        // Save token to Firebase so your backend knows where to send the push
        await set(ref(db, `users/${userId}/fcmTokens/${currentToken}`), true);
        console.log('FCM Token saved successfully');
        return true;
      } else {
        console.log('No registration token available. Request permission to generate one.');
        return false;
      }
    } else {
      console.warn('Notification permission denied');
      return false;
    }
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return false;
  }
};

// Keep this for foreground messages (if you want to show an in-app toast when the app is open)
export const listenForMessages = () => {
  try {
    const messaging = getMessaging(app);
    onMessage(messaging, (payload) => {
      console.log('Message received in foreground:', payload);
    });
  } catch (e) {
    console.warn('Messaging not supported in foreground', e);
  }
};
