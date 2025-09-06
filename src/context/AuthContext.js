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

  const login = async (email, password) => {
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      
      // --- THIS IS THE UPDATED LOGIC ---
      const { accessToken, refreshToken } = response.data;
      
      if (accessToken && refreshToken) {
        const decodedToken = jwtDecode(accessToken);

        // Set state
        setUserToken(accessToken);
        setUserId(decodedToken.userId);

        // Save BOTH tokens to storage
        await AsyncStorage.setItem('accessToken', accessToken);
        await AsyncStorage.setItem('refreshToken', refreshToken);
        await AsyncStorage.setItem('userId', String(decodedToken.userId));
        
        // After successful login, initialize notifications
        await initializeNotifications();
        fetchUnreadCount();
      }
    } catch (error) {
      console.error('Login failed:', error);
      throw new Error('Login failed. Please check your credentials.');
    }
  };

  const logout = async () => {
    // Clear the state
    setUserToken(null);
    setUserId(null);
    setUnreadCount(0);
    
    // Remove all auth-related items from storage
    await AsyncStorage.removeItem('accessToken');
    await AsyncStorage.removeItem('refreshToken');
    await AsyncStorage.removeItem('userId');
  };

  const isLoggedIn = async () => {
    try {
      // Check for the accessToken to determine if logged in
      const accessToken = await AsyncStorage.getItem('accessToken');
      const storedUserId = await AsyncStorage.getItem('userId');
      
      setUserToken(accessToken);
      setUserId(storedUserId);
      
      if (accessToken) {
        fetchUnreadCount();
      }
    } catch (e) {
      console.log(`isLoggedIn error ${e}`);
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
    <AuthContext.Provider value={{ login, logout, userToken, isLoading, userId, unreadCount, fetchUnreadCount }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return React.useContext(AuthContext);
};