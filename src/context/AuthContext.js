import { initializeNotifications } from '../services/notificationService';
import React, { useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/apiClient';

// Create the context
const AuthContext = React.createContext();

// Create a provider component
export const AuthProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = React.useState(null);
  const [userId, setUserId] = React.useState(null);
   const [unreadCount, setUnreadCount] = useState(0);

   const fetchUnreadCount = async () => {
    try {
      const response = await apiClient.get('/notifications/unread-count');
      setUnreadCount(response.data.count);
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      const token = response.data.token;
      
      const decodedToken = jwtDecode(token);

      setUserToken(token);
      setUserId(decodedToken.userId);

      await AsyncStorage.setItem('userToken', token);
      await AsyncStorage.setItem('userId', String(decodedToken.userId));

      // --- ADD THIS LINE ---
      // After a successful login, initialize notifications and send token
      await initializeNotifications();
      fetchUnreadCount();

    } catch (error) {
      console.error('Login failed:', error);
      throw new Error('Login failed. Please check your credentials.');
    }
};

  const logout = async () => {
    // Clear the state
    setUserToken(null);
    setUserId(null); // <-- FIX: Clear the userId from state
    
    // Remove items from storage
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('userId'); // <-- FIX: Remove the userId from storage
    setUnreadCount(0);
  };

  // This function checks if a token exists in storage when the app loads
  const isLoggedIn = async () => {
    try {
      // Don't set loading until the very end
      const token = await AsyncStorage.getItem('userToken');
      const storedUserId = await AsyncStorage.getItem('userId');
      
      setUserToken(token);
      setUserId(storedUserId);
      if (token) {
        fetchUnreadCount(); // <-- Fetch count on app startup if logged in
    }
    } catch (e) {
      console.log(`isLoggedIn error ${e}`);
    } finally {
      // This will run whether there was an error or not
      setIsLoading(false);
    }
  };

  // Check for the token on initial component mount
  useEffect(() => {
    isLoggedIn();
  }, []);

  return (
    // FIX: Add userId to the value prop so other components can access it
    <AuthContext.Provider value={{ login, logout, userToken, isLoading, userId, unreadCount, fetchUnreadCount }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => {
  return React.useContext(AuthContext);
};