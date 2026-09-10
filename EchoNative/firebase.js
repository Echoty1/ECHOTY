// Firebase JS SDK — works in Expo Go (no native modules needed)
import { initializeApp, getApps } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
} from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Same project as the main ECHO app (from google-services.json / Firebase console)
const firebaseConfig = {
  apiKey: 'AIzaSyCMLsv58es_SWlvvm9Ky-cRHJXHTgNNKbc',
  authDomain: 'echoty-fa3ca.firebaseapp.com',
  projectId: 'echoty-fa3ca',
  databaseURL: 'https://echoty-fa3ca-default-rtdb.firebaseio.com',
  storageBucket: 'echoty-fa3ca.firebasestorage.app',
  messagingSenderId: '506340369217',
  appId: '1:506340369217:android:4f41079ebe3928daaab7c0',
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app);
}

export { auth };
export const db = getDatabase(app);
