import React, { useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/apiClient';
import { initializeNotifications } from '../services/notificationService';

// Define all cache keys used across the application here for centralized cleanup
const ROOMS_CACHE_KEY = 'userRooms'; 
const DASHBOARD_CACHE_KEY = 'userDashboard';
const BADGES_CACHE_KEY = 'userBadges';
const NOTIF_CACHE_KEY = 'userNotifications';


const AuthContext = React.createContext();

export const AuthProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState(null); // This is the accessToken
  const [userId, setUserId] = useState(null);
  const [username, setUsername] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0); // For general notifications
  const [unreadMessageCount, setUnreadMessageCount] = useState(0); // For private messages

    // 🌟 These setters were missing from the provided code and are CRITICAL for the socket optimization!
    const setUnreadCountDirectly = (count) => setUnreadCount(count);
    const setUnreadMessageCountDirectly = (count) => setUnreadMessageCount(count);


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
    
    // Clear all caches for user-specific data on logout
    await AsyncStorage.removeItem(ROOMS_CACHE_KEY);
    await AsyncStorage.removeItem(DASHBOARD_CACHE_KEY);
    await AsyncStorage.removeItem(BADGES_CACHE_KEY);
    await AsyncStorage.removeItem(NOTIF_CACHE_KEY);
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
    console.log("📩 Backend unread count response:", response.data);

    // ✅ FIX: Use `count` as returned by your backend
    setUnreadCount(Number(response.data.count || 0));
  } catch (error) {
    console.error("Failed to fetch unread count:", error);
  }
};
  
  const fetchUnreadMessageCount = async () => {
    // Guard clause prevents 401 error during logout
    if (!userToken) { return; } 
    try {
      const response = await apiClient.get('/chat/unread-count');
      // 🌟 FIX: Ensure response.data.count is a valid number before setting state
      const count = response.data?.count;
      if (typeof count === 'number') {
        setUnreadMessageCount(count);
      } else {
          console.error("Failed to parse message count from API:", response.data);
      }
    } catch (error) { console.error("Failed to fetch unread message count:", error); }
  };

  useEffect(() => {
    isLoggedIn();
  }, []);

  return (
    <AuthContext.Provider value={{ 
      login, logout, userToken, isLoading, userId, username, 
      unreadCount, fetchUnreadCount, setUnreadCountDirectly, // 🌟 Exported Setter
      unreadMessageCount, fetchUnreadMessageCount, setUnreadMessageCountDirectly // 🌟 Exported Setter
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return React.useContext(AuthContext);
};
