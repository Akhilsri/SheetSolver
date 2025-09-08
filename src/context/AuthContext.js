import React, { useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/apiClient';
import { initializeNotifications } from '../services/notificationService';

// Create the context
const AuthContext = React.createContext();

// Create a provider component
export const AuthProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState(null); // This will now be the accessToken
  const [userId, setUserId] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [username, setUsername] = useState(null);

  const login = async (email, password) => {
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      const { accessToken, refreshToken } = response.data;
      
      if (accessToken && refreshToken) {
        const decodedToken = jwtDecode(accessToken);
        
        setUserToken(accessToken);
        setUserId(decodedToken.userId);
        setUsername(decodedToken.username);

        // We only need to store the tokens. The rest is derived from the token.
        await AsyncStorage.setItem('accessToken', accessToken);
        await AsyncStorage.setItem('refreshToken', refreshToken);
        
        await initializeNotifications();
        fetchUnreadCount();
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
    
    // We only need to remove the tokens from storage
    await AsyncStorage.removeItem('accessToken');
    await AsyncStorage.removeItem('refreshToken');
  };

  // --- THIS IS THE NEW, MORE ROBUST STARTUP LOGIC ---
  const isLoggedIn = async () => {
    try {
      // 1. Only get the access token from storage.
      const accessToken = await AsyncStorage.getItem('accessToken');

      if (accessToken) {
        // 2. If a token exists, decode it to get the user info.
        const decodedToken = jwtDecode(accessToken);
        
        // 3. Set all the user state from this single source of truth.
        setUserToken(accessToken);
        setUserId(decodedToken.userId);
        setUsername(decodedToken.username);
        
        fetchUnreadCount(); // Fetch count on app startup if logged in
      }
    } catch (e) {
      // This might happen if the token is invalid, so we clear it.
      console.log(`isLoggedIn error: ${e}. Clearing tokens.`);
      await logout(); // Ensure a clean state if token is bad
    } finally {
      setIsLoading(false);
    }
  };
  
  const fetchUnreadCount = async () => {
    try {
      const response = await apiClient.get('/notifications/unread-count');
      setUnreadCount(response.data.count);
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
    }
  };

  useEffect(() => {
    isLoggedIn();
  }, []);

  return (
    <AuthContext.Provider value={{ login, logout, userToken, isLoading, userId, username, unreadCount, fetchUnreadCount }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return React.useContext(AuthContext);
};