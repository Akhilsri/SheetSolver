import React, { createContext, useContext, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

const SOCKET_URL = 'https://sheetsolver-backend-715219399445.asia-south1.run.app'; 
// const SOCKET_URL = 'http://192.168.1.10:3000'; 

const SocketContext = createContext();

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
  const socket = useRef(null);
  const { userToken, userId, fetchUnreadMessageCount } = useAuth();

  useEffect(() => {
    if (userToken && userId && !socket.current) {
      socket.current = io(SOCKET_URL, {
        path: '/socket.io',
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        timeout: 20000,
        autoConnect: true,
        forceNew: true,
      });

      socket.current.on('connect', () => {
        console.log('Global socket connected:', socket.current.id);
        socket.current.emit('register_user', userId);
      });

      socket.current.on('connect_error', (err) => {
        console.log('Socket connect_error', err && err.message, err);
      });

      socket.current.on('connect_timeout', (timeout) => {
        console.log('Socket connect_timeout', timeout);
      });

      socket.current.on('reconnect_attempt', (attempt) => {
        console.log('Socket reconnect_attempt', attempt);
      });

      socket.current.on('reconnect_failed', () => {
        console.log('Socket reconnect_failed');
      });

      socket.current.on('disconnect', (reason) => {
        console.log('Global socket disconnected:', reason);
      });

      socket.current.on('receive_private_message', () => {
        console.log('SocketContext: Heard a new private message. Refreshing badge count.');
        fetchUnreadMessageCount?.();
      });
    }

    return () => {
      if (socket.current) {
        console.log('Socket cleanup: Disconnecting old socket instance.');
        socket.current.disconnect();
        socket.current = null;
      }
    };
  }, [userToken, userId, fetchUnreadMessageCount]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};