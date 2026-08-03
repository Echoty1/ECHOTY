import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { db } from '../services/firebase';
import { ref, onValue, set, onDisconnect, serverTimestamp } from 'firebase/database';
import { useAuth } from '../hooks/useAuth';

const PresenceContext = createContext();

export const PresenceProvider = ({ children }) => {
  const { user } = useAuth();
  const [presenceMap, setPresenceMap] = useState({});
  const subscriptionsRef = useRef({});

  // 1. Update own presence
  useEffect(() => {
    if (!user) return;

    const userStatusRef = ref(db, `users/${user.uid}/status`);
    const userOnlineRef = ref(db, `users/${user.uid}/online`);
    const userLastSeenRef = ref(db, `users/${user.uid}/lastSeen`);

    // Listen to Firebase connection state
    const connectedRef = ref(db, '.info/connected');
    const unsub = onValue(connectedRef, (snap) => {
      const connected = snap.val();
      if (connected) {
        // User is online – set online = true, status = 'online'
        set(userOnlineRef, true);
        set(userStatusRef, 'online');
        // When the client disconnects, update these fields
        onDisconnect(userOnlineRef).set(false);
        onDisconnect(userStatusRef).set('offline');
        onDisconnect(userLastSeenRef).set(serverTimestamp());
      }
    });

    return () => unsub();
  }, [user]);

  // 2. Subscribe to other users' presence
  const subscribeToUser = (uid) => {
    if (!uid) return;
    if (subscriptionsRef.current[uid]) return; // already subscribed

    const userRef = ref(db, `users/${uid}`);
    const unsub = onValue(userRef, (snap) => {
      const data = snap.val();
      if (data) {
        setPresenceMap((prev) => ({
          ...prev,
          [uid]: {
            online: data.online || false,
            lastSeen: data.lastSeen || null,
            status: data.status || 'offline',
          },
        }));
      }
    });

    subscriptionsRef.current[uid] = unsub;
  };

  // 3. Unsubscribe all when unmounting
  useEffect(() => {
    return () => {
      Object.values(subscriptionsRef.current).forEach((unsub) => unsub());
      subscriptionsRef.current = {};
    };
  }, []);

  // 4. Helper to get list of online user IDs
  const getOnlineUsers = () => {
    return Object.keys(presenceMap).filter((uid) => presenceMap[uid].online);
  };

  const value = {
    presenceMap,
    onlineUsers: getOnlineUsers(),
    subscribeToUser,
  };

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  );
};

export const usePresence = () => useContext(PresenceContext);