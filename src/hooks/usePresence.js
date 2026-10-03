// src/hooks/usePresence.js
import { useEffect, useState } from 'react';
import { ref, onValue, set, onDisconnect, serverTimestamp } from 'firebase/database';
import { db } from '../services/firebase';

let mountedCount = 0;
let unsubConnection = null;
let currentUid = null;

export const usePresence = (user) => {
  useEffect(() => {
    if (!user?.uid) return undefined;

    mountedCount += 1;
    if (mountedCount > 1) return () => { mountedCount -= 1; };

    currentUid = user.uid;

    const connectedRef = ref(db, '.info/connected');
    const myPresenceRef = ref(db, `presence/${currentUid}`);
    const myOnlineRef = ref(db, `presence/online/${currentUid}`);

    unsubConnection = onValue(connectedRef, (snap) => {
      if (snap.val() !== true) return;
      onDisconnect(myOnlineRef).set(null);
      onDisconnect(myPresenceRef).set({ online: false, lastSeen: serverTimestamp() });
      set(myOnlineRef, true);
      set(myPresenceRef, { online: true, lastSeen: Date.now() });
    });

    const hb = setInterval(() => {
      if (currentUid) set(myPresenceRef, { online: true, lastSeen: Date.now() }).catch(() => {});
    }, 30000);

    const onUnload = () => {
      try {
        set(myOnlineRef, null);
        set(myPresenceRef, { online: false, lastSeen: Date.now() });
      } catch (_) {}
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') onUnload();
      else if (currentUid) {
        set(myOnlineRef, true);
        set(myPresenceRef, { online: true, lastSeen: Date.now() }).catch(() => {});
      }
    };
    window.addEventListener('beforeunload', onUnload);
    document.addEventListener('visibilitychange', onVis);

    return () => {
      mountedCount -= 1;
      if (unsubConnection) unsubConnection();
      if (hb) clearInterval(hb);
      window.removeEventListener('beforeunload', onUnload);
      document.removeEventListener('visibilitychange', onVis);
      onUnload();
    };
  }, [user?.uid]);
};

export const useUserPresence = (uid) => {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!uid) return undefined;
    const r = ref(db, `presence/${uid}`);
    return onValue(r, (s) => setData(s.val() || null));
  }, [uid]);
  return data;
};
