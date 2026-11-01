// src/services/fcmService.js
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { ref, set } from 'firebase/database';
import { db } from './firebase';
import { app } from './firebase'; // Your initialized firebase app

const VAPID_KEY = 'YOUR_PUBLIC_VAPID_KEY_FROM_FIREBASE_CONSOLE'; // Get this from Firebase Settings -> Cloud Messaging

export const requestNotificationPermission = async (userId) => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const messaging = getMessaging(app);
      const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });

      if (currentToken) {
        // Save token to Firebase so your backend can send to this device
        await set(ref(db, `users/${userId}/fcmTokens/${currentToken}`), true);
        console.log('FCM Token saved successfully');
        return true;
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

// Listen for foreground messages (when the app is open)
export const listenForMessages = () => {
  const messaging = getMessaging(app);
  onMessage(messaging, (payload) => {
    console.log('Message received in foreground:', payload);
    // You can trigger a custom in-app toast here if you want!
  });
};
