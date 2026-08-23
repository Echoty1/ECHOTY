// src/services/presenceService.js
import { ref, onValue, set, onDisconnect, remove, get } from 'firebase/database';
import { db } from './firebase';
import { isRealDisplayName } from '../utils/userIntegrity';

/**
 * Marks the user online while connected; sets offline on disconnect.
 * Skips presence if profile was wiped / has no real name.
 */
export const initPresence = (uid) => {
  if (!uid) return () => {};

  const presenceRef = ref(db, `presence/online/${uid}`);
  const connectedRef = ref(db, '.info/connected');
  let heartbeat = null;

  const unsub = onValue(connectedRef, async (snap) => {
    if (snap.val() !== true) return;

    // Don't go online if profile is missing or placeholder
    try {
      const prof = await get(ref(db, `profiles/${uid}`));
      if (!prof.exists() || !isRealDisplayName((prof.val() || {}).name)) {
        console.warn('[Presence] No real profile – staying offline');
        await remove(presenceRef).catch(() => {});
        return;
      }
    } catch (_) {}

    onDisconnect(presenceRef)
      .set(false)
      .then(() => set(presenceRef, true))
      .catch(() => {
        set(presenceRef, true).catch(() => {});
      });
  });

  heartbeat = setInterval(async () => {
    try {
      const prof = await get(ref(db, `profiles/${uid}`));
      if (!prof.exists() || !isRealDisplayName((prof.val() || {}).name)) {
        await remove(presenceRef).catch(() => {});
        return;
      }
      await set(presenceRef, true);
    } catch (_) {}
  }, 25000);

  return () => {
    if (heartbeat) clearInterval(heartbeat);
    unsub();
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
