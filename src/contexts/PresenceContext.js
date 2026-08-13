// src/contexts/PresenceContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { listenPresence } from '../services/presenceService';

const PresenceContext = createContext();

export const PresenceProvider = ({ children }) => {
  const [onlineUsers, setOnlineUsers] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = listenPresence((data) => {
      setOnlineUsers(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const isOnline = (uid) => {
    if (!uid) return false;
    return onlineUsers[uid] === true;
  };

  return (
    <PresenceContext.Provider value={{ onlineUsers, isOnline, loading }}>
      {children}
    </PresenceContext.Provider>
  );
};

export const usePresence = () => {
  const ctx = useContext(PresenceContext);
  if (!ctx) throw new Error('usePresence must be used within PresenceProvider');
  return ctx;
};