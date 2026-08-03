import React, { createContext, useContext, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const socketRef = useRef(null);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000';
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🟢 Socket connected (typing only) to', SOCKET_URL);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔴 Socket disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.log('❌ Socket connection error:', error);
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  const value = { socket: socketRef.current };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);