import React, { createContext, useContext, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

// IMPORTANT: Double-check that this is your computer's correct IP address
const SOCKET_URL = 'http://192.168.1.8:3000'; 

const SocketContext = createContext();

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
  const socket = useRef(null);
  const { userToken } = useAuth(); // We only connect if the user is logged in

  useEffect(() => {
    // If the user is logged in and there's no socket, create one
    if (userToken && !socket.current) {
      socket.current = io(SOCKET_URL, { transports: ['websocket'] });
      socket.current.on('connect', () => {
        console.log('Global socket connected:', socket.current.id);
      });
    }

    // If the user logs out, disconnect the socket
    if (!userToken && socket.current) {
      socket.current.disconnect();
      socket.current = null;
    }
  }, [userToken]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};