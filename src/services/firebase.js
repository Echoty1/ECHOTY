// src/services/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage'; // ADD THIS

const firebaseConfig = {
  apiKey: "AIzaSyA5T5cw7nH8Yf0JEeu6n7VQqtC5ogSdMMA",
  authDomain: "echoty-fa3ca.firebaseapp.com",
  projectId: "echoty-fa3ca",
  databaseURL: "https://echoty-fa3ca-default-rtdb.firebaseio.com",
  storageBucket: "echoty-fa3ca.firebasestorage.app",
  messagingSenderId: "506340369217",
  appId: "1:506340369217:web:2aaf853f792d7a83aab7c0",
  measurementId: "G-XW4HCPM9T3",
};

// Validate required config
const missingKeys = Object.entries(firebaseConfig)
  .filter(([key, value]) => !value && key !== 'measurementId') // measurementId is optional
  .map(([key]) => key);

if (missingKeys.length > 0) {
  console.error(
    `❌ Firebase config missing required keys: ${missingKeys.join(', ')}. ` +
    `Please set them in your environment variables (REACT_APP_FIREBASE_*).`
  );
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app); // ADD THIS