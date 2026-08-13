// src/services/presenceService.js
import { ref, onValue, set, onDisconnect } from 'firebase/database';
import { db } from './firebase';

/**
 * Initialize presence for a user.
 * Call this when the user logs in.
 * Returns a cleanup function.
 */
export const initPresence = (uid) => {
  if (!uid) return () => {};
  const presenceRef = ref(db, `presence/online/${uid}`);
  const connectedRef = ref(db, '.info/connected');

  const unsub = onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
      set(presenceRef, true);
      onDisconnect(presenceRef).set(false);
    }
  });

  return () => {
    unsub();
    set(presenceRef, false);
  };
};

/**
 * Listen to presence changes.
 * Returns an unsubscribe function.
 */
export const listenPresence = (callback) => {
  const presenceRef = ref(db, 'presence/online');
  return onValue(presenceRef, (snapshot) => {
    const data = snapshot.val() || {};
    callback(data);
  });
};