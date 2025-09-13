import React, { useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/apiClient';
import { initializeNotifications } from '../services/notificationService';

const AuthContext = React.createContext();

export const AuthProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState(null); // This is the accessToken
  const [userId, setUserId] = useState(null);
  const [username, setUsername] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0); // For general notifications
  const [unreadMessageCount, setUnreadMessageCount] = useState(0); // For private messages

  const login = async (email, password) => {
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      const { accessToken, refreshToken } = response.data;
      
      if (accessToken && refreshToken) {
        const decodedToken = jwtDecode(accessToken);
        
        setUserToken(accessToken);
        setUserId(decodedToken.userId);
        setUsername(decodedToken.username);

        await AsyncStorage.setItem('accessToken', accessToken);
        await AsyncStorage.setItem('refreshToken', refreshToken);
        
        await initializeNotifications();
        fetchUnreadCount();
        fetchUnreadMessageCount(); // Fetch count on login
      }
    } catch (error) {
      console.error('Login failed:', error);
      throw new Error('Login failed. Please check your credentials.');
    }
  };

  const logout = async () => {
    setUserToken(null);
    setUserId(null);
    setUsername(null);
    setUnreadCount(0);
    setUnreadMessageCount(0); // Reset on logout
    
    await AsyncStorage.removeItem('accessToken');
    await AsyncStorage.removeItem('refreshToken');
  };

  const isLoggedIn = async () => {
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      if (accessToken) {
        const decodedToken = jwtDecode(accessToken);
        setUserToken(accessToken);
        setUserId(decodedToken.userId);
        setUsername(decodedToken.username);
        
        fetchUnreadCount();
        fetchUnreadMessageCount(); // Fetch on startup
      }
    } catch (e) {
      console.log(`isLoggedIn error: ${e}. Clearing tokens.`);
      await logout();
    } finally {
      setIsLoading(false);
    }
  };
  
  const fetchUnreadCount = async () => {
    try {
      const response = await apiClient.get('/notifications/unread-count');
      setUnreadCount(response.data.count);
    } catch (error) { console.error("Failed to fetch unread notification count:", error); }
  };
  
  // This is the function that was missing from your context's value
  const fetchUnreadMessageCount = async () => {
    try {
      const response = await apiClient.get('/chat/unread-count');
      setUnreadMessageCount(response.data.count);
    } catch (error) { console.error("Failed to fetch unread message count:", error); }
  };

  useEffect(() => {
    isLoggedIn();
  }, []);

  return (
    // Ensure fetchUnreadMessageCount is included in the value
    <AuthContext.Provider value={{ 
      login, logout, userToken, isLoading, userId, username, 
      unreadCount, fetchUnreadCount, 
      unreadMessageCount, fetchUnreadMessageCount 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return React.useContext(AuthContext);
};