// src/hooks/usePresence.js
import { useEffect, useState } from 'react';
import { ref, onValue, set, onDisconnect, serverTimestamp } from 'firebase/database';
import { db } from '../services/firebase';

let mountedCount = 0;
let unsubConnection = null;
let unsubPrivacy = null;
let heartbeatTimer = null;
let currentUid = null;
let lastSeenVisibility = 'everyone';

/**
 * Mount ONCE at App level (inside AppContent).
 *
 * Writes TWO nodes:
 *   presence/{uid}        ← full info, only you can read it
 *                           { online, lastSeen, visibility }
 *
 *   presencePublic/{uid}  ← privacy-filtered, readable by any signed-in user
 *                           if visibility === 'nobody' → { online: true, lastSeen: null, hidden: true }
 *                           else                        → { online: true, lastSeen: <ms> }
 *
 * Uses onDisconnect() so the node flips to offline when the tab closes.
 */
export const usePresence = (user) => {
  useEffect(() => {
    if (!user?.uid) return undefined;

    // React 18 StrictMode safety — only one writer per uid
    mountedCount += 1;
    if (mountedCount > 1) {
      return () => { mountedCount -= 1; };
    }

    currentUid = user.uid;

    const connectedRef = ref(db, '.info/connected');
    const myPresenceRef = ref(db, `presence/${currentUid}`);
    const myOnlineRef = ref(db, `presence/online/${currentUid}`);
    const myPublicRef = ref(db, `presencePublic/${currentUid}`);
    const myVisibilityRef = ref(db, `userSettings/${currentUid}/privacy/lastSeen`);

    // ── 1) Track the user's lastSeen privacy choice in real time ──────
    unsubPrivacy = onValue(myVisibilityRef, (snap) => {
      lastSeenVisibility = snap.val() || 'everyone';

      // Re-publish the public node the moment privacy changes
      const now = Date.now();
      const publicPayload = lastSeenVisibility === 'nobody'
        ? { online: true, lastSeen: null, hidden: true }
        : { online: true, lastSeen: now };

      set(myPublicRef, publicPayload).catch(() => {});
    });

    // ── 2) Wire up the connection lifecycle ───────────────────────────
    unsubConnection = onValue(connectedRef, (snap) => {
      if (snap.val() !== true) return;

      const now = Date.now();
      const publicPayload = lastSeenVisibility === 'nobody'
        ? { online: true, lastSeen: null, hidden: true }
        : { online: true, lastSeen: now };

      // Schedule the offline write for when we disconnect
      onDisconnect(myOnlineRef).set(null);
      onDisconnect(myPresenceRef).set({
        online: false,
        lastSeen: serverTimestamp(),
        visibility: lastSeenVisibility,
      });
      onDisconnect(myPublicRef).set({
        online: false,
        lastSeen: serverTimestamp(),
        hidden: lastSeenVisibility === 'nobody',
      });

      // Mark ourselves online right now
      set(myOnlineRef, true);
      set(myPresenceRef, {
        online: true,
        lastSeen: now,
        visibility: lastSeenVisibility,
      });
      set(myPublicRef, publicPayload);
    });

    // ── 3) Heartbeat every 30s (keeps lastSeen fresh while tab is open)
    heartbeatTimer = setInterval(() => {
      if (!currentUid) return;
      const now = Date.now();
      const publicPayload = lastSeenVisibility === 'nobody'
        ? { online: true, lastSeen: null, hidden: true }
        : { online: true, lastSeen: now };

      set(myPresenceRef, {
        online: true,
        lastSeen: now,
        visibility: lastSeenVisibility,
      }).catch(() => {});
      set(myPublicRef, publicPayload).catch(() => {});
    }, 30000);

    // ── 4) Tab close / visibility change ─────────────────────────────
    const goOffline = () => {
      if (!currentUid) return;
      const now = Date.now();
      try {
        set(myOnlineRef, null);
        set(myPresenceRef, {
          online: false,
          lastSeen: now,
          visibility: lastSeenVisibility,
        });
        set(myPublicRef, {
          online: false,
          lastSeen: now,
          hidden: lastSeenVisibility === 'nobody',
        });
      } catch (_) {}
    };

    const goOnline = () => {
      if (!currentUid) return;
      const now = Date.now();
      const publicPayload = lastSeenVisibility === 'nobody'
        ? { online: true, lastSeen: null, hidden: true }
        : { online: true, lastSeen: now };

      set(myOnlineRef, true);
      set(myPresenceRef, {
        online: true,
        lastSeen: now,
        visibility: lastSeenVisibility,
      }).catch(() => {});
      set(myPublicRef, publicPayload).catch(() => {});
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') goOffline();
      else goOnline();
    };

    window.addEventListener('beforeunload', goOffline);
    window.addEventListener('pagehide', goOffline);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      mountedCount -= 1;
      if (unsubConnection) unsubConnection();
      if (unsubPrivacy) unsubPrivacy();
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      window.removeEventListener('beforeunload', goOffline);
      window.removeEventListener('pagehide', goOffline);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      goOffline();
    };
  }, [user?.uid]);
};

/**
 * Read another user's PUBLIC (privacy-filtered) presence.
 * Always returns one of:
 *   null
 *   { online: true,  lastSeen: <ms> }
 *   { online: true,  lastSeen: null, hidden: true }   ← user chose "Nobody"
 *   { online: false, lastSeen: <ms> }
 *   { online: false, lastSeen: <ms>, hidden: true }
 */
export const useUserPresence = (uid) => {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!uid) {
      setData(null);
      return undefined;
    }
    const r = ref(db, `presencePublic/${uid}`);
    return onValue(r, (s) => setData(s.val() || null));
  }, [uid]);

  return data;
};
