import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user) return;

    // Use environment variable for socket URL, fallback to localhost for development
    const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000';
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('🟢 Socket connected to', SOCKET_URL);
      newSocket.emit('join', user.uid, user.username);
    });

    newSocket.on('online-users', (userIds) => {
      // Store online users globally
      window._onlineUsers = userIds;
      // Dispatch event for components to update
      window.dispatchEvent(new CustomEvent('online-users-update', { detail: userIds }));
    });

    return () => newSocket.disconnect();
  }, [user]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);