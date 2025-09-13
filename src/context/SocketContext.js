import React, { createContext, useContext, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

// IMPORTANT: Double-check that this is your computer's correct IP address
const SOCKET_URL = 'http://192.168.1.4:3000'; 

const SocketContext = createContext();

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
  const socket = useRef(null);
  const { userToken,userId,fetchUnreadMessageCount,fetchUnreadCount   } = useAuth(); // We only connect if the user is logged in

  useEffect(() => {
    // If the user is logged in and there's no socket, create one
    if (userToken && userId && !socket.current) {
      socket.current = io(SOCKET_URL, { transports: ['websocket'] });
      
      socket.current.on('connect', () => {
        console.log('Global socket connected:', socket.current.id);
        // --- ADD THIS ---
        // After connecting, register this user with the server
        socket.current.emit('register_user', userId);
      });

       socket.current.on('receive_private_message', () => {
        console.log('SocketContext: Heard a new private message. Refreshing badge count.');
        // When a new message comes in, call the function from AuthContext to get the new count
        fetchUnreadMessageCount();
      });

      socket.current.on('disconnect', () => {
        console.log('Global socket disconnected.');
      });

    }

    // If the user logs out, disconnect the socket
    if (!userToken && socket.current) {
      socket.current.disconnect();
      socket.current = null;
    }
  }, [userToken, userId]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};