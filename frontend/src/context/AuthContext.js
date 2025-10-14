import React, { useState, useEffect, useRef } from 'react'; // ADD useRef
import { jwtDecode } from 'jwt-decode';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/apiClient';
// MODIFICATION: Import removeTokenFromServer
import { initializeNotifications, removeTokenFromServer } from '../services/notificationService';

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

  const unsubscribeFCM = useRef(null); // NEW: To store the FCM unsubscribe function

  const setUnreadCountDirectly = (count) => setUnreadCount(count);
  const setUnreadMessageCountDirectly = (count) => setUnreadMessageCount(count);


  const login = async (email, password) => {
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      const { accessToken, refreshToken } = response.data;
      
      if (accessToken && refreshToken) {
        const decodedToken = jwtDecode(accessToken);
        const newUserId = decodedToken.userId; // Capture newUserId here

        setUserToken(accessToken);
        setUserId(newUserId); // Set userId
        setUsername(decodedToken.username);

        await AsyncStorage.setItem('accessToken', accessToken);
        await AsyncStorage.setItem('refreshToken', refreshToken);
        
        // MODIFICATION: Pass newUserId to initializeNotifications
        // Also store the unsubscribe function
        if (unsubscribeFCM.current) { // Clean up previous listener if exists
            unsubscribeFCM.current();
        }
        unsubscribeFCM.current = await initializeNotifications(newUserId);
        
        fetchUnreadCount();
        fetchUnreadMessageCount();
      }
    } catch (error) {
      console.error('Login failed:', error);
      throw new Error('Login failed. Please check your credentials.');
    }
  };

  const logout = async () => {
    // MODIFICATION: Remove FCM token from backend BEFORE clearing state
    if (userId) { // Ensure userId is available
      await removeTokenFromServer(userId);
    }

    // NEW: Unsubscribe FCM listeners
    if (unsubscribeFCM.current) {
        unsubscribeFCM.current();
        unsubscribeFCM.current = null;
    }

    setUserToken(null);
    setUserId(null);
    setUsername(null);
    setUnreadCount(0);
    setUnreadMessageCount(0); 
    
    await AsyncStorage.removeItem('accessToken');
    await AsyncStorage.removeItem('refreshToken');
    
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
        const storedUserId = decodedToken.userId; // Capture userId from stored token

        setUserToken(accessToken);
        setUserId(storedUserId); // Set userId
        setUsername(decodedToken.username);
        
        // MODIFICATION: Pass storedUserId to initializeNotifications
        if (unsubscribeFCM.current) { // Clean up previous listener if exists
            unsubscribeFCM.current();
        }
        unsubscribeFCM.current = await initializeNotifications(storedUserId);

        fetchUnreadCount();
        fetchUnreadMessageCount();
      }
    } catch (e) {
      console.log(`isLoggedIn error: ${e}. Clearing tokens.`);
      await logout(); // This will also handle FCM token removal
    } finally {
      setIsLoading(false);
    }
  };
  
  const fetchUnreadCount = async () => {
    // Guard clause prevents 401 error during logout or before userId is set
    if (!userToken || !userId) { return; } 
    try {
      const response = await apiClient.get('/notifications/unread-count');
      console.log("📩 Backend unread count response:", response.data);
      setUnreadCount(Number(response.data.count || 0));
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
    }
  };
  
  const fetchUnreadMessageCount = async () => {
    // Guard clause prevents 401 error during logout or before userId is set
    if (!userToken || !userId) { return; } 
    try {
      const response = await apiClient.get('/chat/unread-count');
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

    // Clean up FCM listeners when AuthProvider unmounts
    return () => {
      if (unsubscribeFCM.current) {
        unsubscribeFCM.current();
        unsubscribeFCM.current = null;
      }
    };
  }, []); // Empty dependency array means this runs only once on mount

  return (
    <AuthContext.Provider value={{ 
      login, logout, userToken, isLoading, userId, username, 
      unreadCount, fetchUnreadCount, setUnreadCountDirectly, 
      unreadMessageCount, fetchUnreadMessageCount, setUnreadMessageCountDirectly 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return React.useContext(AuthContext);
};