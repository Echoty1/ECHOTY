import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState([]);
  const socketRef = useRef(null);
  const reconnectAttempts = useRef(0);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setOnlineUsers([]);
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
      console.log('🟢 Socket connected to', SOCKET_URL);
      socket.emit('join', user.uid, user.username);
      reconnectAttempts.current = 0;
    });

    socket.on('online-users', (ids) => {
      console.log('🔥 Online users from server:', ids);
      setOnlineUsers(ids);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔴 Socket disconnected:', reason);
      if (reason === 'io server disconnect') {
        // server disconnected us – reconnect manually
        socket.connect();
      }
    });

    socket.on('connect_error', (error) => {
      console.log('❌ Socket connection error:', error);
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  const value = { socket: socketRef.current, onlineUsers };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);