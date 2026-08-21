// src/services/presenceService.js
import { ref, onValue, set, onDisconnect, remove } from 'firebase/database';
import { db } from './firebase';

/**
 * Marks the user online while connected; sets offline on disconnect.
 * Correct order: onDisconnect first, then set true (avoids race).
 */
export const initPresence = (uid) => {
  if (!uid) return () => {};

  const presenceRef = ref(db, `presence/online/${uid}`);
  const connectedRef = ref(db, '.info/connected');

  const unsub = onValue(connectedRef, (snap) => {
    if (snap.val() !== true) return;

    // Register disconnect BEFORE marking online
    onDisconnect(presenceRef)
      .set(false)
      .then(() => set(presenceRef, true))
      .catch((err) => {
        console.warn('[Presence] onDisconnect failed, still marking online', err);
        set(presenceRef, true).catch(() => {});
      });
  });

  // Heartbeat every 25s so presence stays fresh if tab is backgrounded
  const heartbeat = setInterval(() => {
    set(presenceRef, true).catch(() => {});
  }, 25000);

  return () => {
    clearInterval(heartbeat);
    unsub();
    // Mark offline immediately on logout / unmount
    set(presenceRef, false).catch(() => {});
  };
};

export const listenPresence = (callback) => {
  const presenceRef = ref(db, 'presence/online');
  return onValue(presenceRef, (snapshot) => {
    const data = snapshot.val() || {};
    callback(data);
  });
};
