// src/hooks/usePresence.js
import { useEffect } from 'react';
import { ref, onValue, set, onDisconnect, serverTimestamp } from 'firebase/database';
import { db } from '../services/firebase';

let mountedCount = 0;
let unsubConnection = null;
let currentUid = null;

/**
 * Mount ONCE at the App level. Writes:
 *   presence/{uid}       = { online, lastSeen }         ← read by UserProfile / ChatView
 *   presence/online/{uid}= true                          ← read by Chats.jsx (existing)
 * Cleans up on tab close via onDisconnect().
 */
export const usePresence = (user) => {
  useEffect(() => {
    if (!user?.uid) return;

    // Prevent double-mounting in React 18 StrictMode
    mountedCount += 1;
    if (mountedCount > 1) return () => { mountedCount -= 1; };

    currentUid = user.uid;

    const connectedRef = ref(db, '.info/connected');
    const myPresenceRef = ref(db, `presence/${currentUid}`);
    const myOnlineRef = ref(db, `presence/online/${currentUid}`);

    unsubConnection = onValue(connectedRef, (snap) => {
      if (snap.val() !== true) return;

      // When we disconnect, Firebase flips these to false/null
      onDisconnect(myOnlineRef).set(null);
      onDisconnect(myPresenceRef).set({
        online: false,
        lastSeen: serverTimestamp(),
      });

      // Now mark ourselves online
      set(myOnlineRef, true);
      set(myPresenceRef, {
        online: true,
        lastSeen: Date.now(),
      });
    });

    // Heartbeat every 30s so lastSeen stays fresh while tab is open
    const hb = setInterval(() => {
      if (currentUid) {
        set(myPresenceRef, { online: true, lastSeen: Date.now() }).catch(() => {});
      }
    }, 30000);

    const onUnload = () => {
      try {
        set(myOnlineRef, null);
        set(myPresenceRef, { online: false, lastSeen: Date.now() });
      } catch (_) {}
    };
    window.addEventListener('beforeunload', onUnload);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') onUnload();
      else if (document.visibilityState === 'visible' && currentUid) {
        set(myOnlineRef, true);
        set(myPresenceRef, { online: true, lastSeen: Date.now() }).catch(() => {});
      }
    });

    return () => {
      mountedCount -= 1;
      if (unsubConnection) unsubConnection();
      if (hb) clearInterval(hb);
      window.removeEventListener('beforeunload', onUnload);
      onUnload();
    };
  }, [user?.uid]);
};

/** Hook to read another user's presence. */
export const useUserPresence = (uid) => {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!uid) return;
    const r = ref(db, `presence/${uid}`);
    return onValue(r, (s) => setData(s.val() || null));
  }, [uid]);
  return data;
};
