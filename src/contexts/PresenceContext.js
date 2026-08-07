import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { ref, onValue } from 'firebase/database';

const PresenceContext = createContext();

export const PresenceProvider = ({ children }) => {
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  useEffect(() => {
    const onlineRef = ref(db, 'presence/online');
    const unsub = onValue(onlineRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setOnlineUsers(new Set(Object.keys(data)));
      } else {
        setOnlineUsers(new Set());
      }
    });
    return () => unsub();
  }, []);

  const subscribeToUser = (uid) => {
    // Implement later – for now, just a placeholder
  };

  return (
    <PresenceContext.Provider value={{ onlineUsers, subscribeToUser }}>
      {children}
    </PresenceContext.Provider>
  );
};

export const usePresence = () => useContext(PresenceContext);