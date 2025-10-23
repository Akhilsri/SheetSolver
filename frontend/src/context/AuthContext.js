import React, { useState, useEffect, useRef } from 'react';
import { jwtDecode } from 'jwt-decode';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/apiClient';
import messaging from '@react-native-firebase/messaging'; // Import messaging for permission check
import { initializeNotifications, removeTokenFromServer } from '../services/notificationService';

// Define all cache keys used across the application here for centralized cleanup
const ROOMS_CACHE_KEY = 'userRooms'; 
const DASHBOARD_CACHE_KEY = 'userDashboard';
const BADGES_CACHE_KEY = 'userBadges';
const NOTIF_CACHE_KEY = 'userNotifications';

// NEW: Key to track if the user has been shown our custom modal before
const NOTIFICATION_ASKED_KEY = 'notificationAskedFlag';


const AuthContext = React.createContext();

export const AuthProvider = ({ children }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [userToken, setUserToken] = useState(null); // This is the accessToken
    const [userId, setUserId] = useState(null);
    const [username, setUsername] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0); // For general notifications
    const [unreadMessageCount, setUnreadMessageCount] = useState(0); // For private messages
    const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
    const unsubscribeFCM = useRef(null); // To store the FCM unsubscribe function

    const setUnreadCountDirectly = (count) => setUnreadCount(count);
    const setUnreadMessageCountDirectly = (count) => setUnreadMessageCount(count);
    // fcmUnsubscribe is deprecated, using unsubscribeFCM.current

    // ---------------------------------------------------------------------
    //                         NOTIFICATION LOGIC
    // ---------------------------------------------------------------------

    /**
     * Checks permission status to decide if the custom modal should be shown.
     * Enforces the "ask once" rule.
     */
    const checkNotificationStatus = async (currentUserId) => {
        // Only run if a user ID is available
        if (!currentUserId) return;
        
        // 1. Check if we've ever shown our custom modal to the user
        const hasAsked = await AsyncStorage.getItem(NOTIFICATION_ASKED_KEY);
        
        if (hasAsked === null) {
            try {
                // 2. Check native permission status
                const authStatus = await messaging().hasPermission();

                // If permission is UNDETERMINED (meaning OS hasn't prompted yet)
                if (authStatus === messaging.AuthorizationStatus.NOT_DETERMINED) {
                    setShowNotificationPrompt(true);
                } else {
                    // If it's already GRANTED or DENIED, we set the flag to remember we've checked
                    await AsyncStorage.setItem(NOTIFICATION_ASKED_KEY, 'true');

                    // If it's granted, we initialize notifications immediately.
                    if (authStatus === messaging.AuthorizationStatus.AUTHORIZED) {
                        unsubscribeFCM.current = await initializeNotifications(currentUserId);
                    }
                }
            } catch (error) {
                console.error("Error checking notification status:", error);
            }
        }
    };


    const handleNotificationPermissionFlow = async () => {
        if (userId) {
            // After the user clicks 'Allow' on the custom modal, we fire the native prompt
            unsubscribeFCM.current = await initializeNotifications(userId);
            // And set the flag so we don't ask again
            await AsyncStorage.setItem(NOTIFICATION_ASKED_KEY, 'true');
        }
        setShowNotificationPrompt(false); // Dismiss the modal after the flow
    };

    // ---------------------------------------------------------------------
    //                         PASSWORD RESET LOGIC
    // ---------------------------------------------------------------------

    /**
     * Initiates the forgot password process by sending a reset link to the user's email.
     */
    const forgotPassword = async (email) => {
        try {
            await apiClient.post('/auth/forgot-password', { email });
            return { 
                success: true, 
                message: `Password reset link sent to ${email}. Please check your email inbox and spam folder.` 
            };
        } catch (error) {
            console.error('Forgot Password Request Failed:', error.response?.data || error.message);
            const errorMessage = error.response?.data?.message || 'Failed to send reset link. Please check the email address or try again later.';
            throw new Error(errorMessage);
        }
    };

    /**
     * Completes the password reset process.
     */
    const confirmPasswordReset = async (token, newPassword) => {
        try {
            if (!token || !newPassword) {
                throw new Error("Missing token or new password. Cannot complete reset.");
            }
            await apiClient.post('/auth/reset-password', { token, newPassword });
            return {
                success: true,
                message: "Password successfully reset! You can now log in."
            };
        } catch (error) {
            console.error('Password Reset Confirmation Failed:', error.response?.data || error.message);
            const errorMessage = error.response?.data?.message || 'Failed to reset password. The link may have expired or been used already.';
            throw new Error(errorMessage);
        }
    };
    
    // ---------------------------------------------------------------------
    //                            AUTH LOGIC
    // ---------------------------------------------------------------------

    const login = async (email, password) => {
        try {
            const response = await apiClient.post('/auth/login', { email, password });
            const { accessToken, refreshToken } = response.data;
            
            if (accessToken && refreshToken) {
                const decodedToken = jwtDecode(accessToken);
                const newUserId = decodedToken.userId;

                setUserToken(accessToken);
                setUserId(newUserId);
                setUsername(decodedToken.username);

                await AsyncStorage.setItem('accessToken', accessToken);
                await AsyncStorage.setItem('refreshToken', refreshToken);
                
                // FIXED: Call notification check logic
                checkNotificationStatus(newUserId);
                
                fetchUnreadCount();
                fetchUnreadMessageCount();
            }
        } catch (error) {
            console.error('Login failed:', error);
            throw new Error('Login failed. Please check your credentials.');
        }
    };

    const logout = async () => {
        if (userId) {
            await removeTokenFromServer(userId);
        }

        if (unsubscribeFCM.current) {
            unsubscribeFCM.current();
            unsubscribeFCM.current = null;
        }

        // Note: Do NOT clear NOTIFICATION_ASKED_KEY on logout in production
        // It should only be cleared on uninstall.
          // await AsyncStorage.removeItem(NOTIFICATION_ASKED_KEY); 

        setUserToken(null);
        setUserId(null);
        setUsername(null);
        setUnreadCount(0);
        setUnreadMessageCount(0); 
        setShowNotificationPrompt(false);
        
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
                const storedUserId = decodedToken.userId;

                setUserToken(accessToken);
                setUserId(storedUserId);
                setUsername(decodedToken.username);
                
                // FIXED: Call notification check logic
                checkNotificationStatus(storedUserId);

                fetchUnreadCount();
                fetchUnreadMessageCount();
            }
        } catch (e) {
            console.log(`isLoggedIn error: ${e}. Clearing tokens.`);
            await logout();
        } finally {
            setIsLoading(false);
        }
    };
    
    // ... (fetchUnreadCount and fetchUnreadMessageCount functions remain unchanged)

    const fetchUnreadCount = async () => {
        // Guard clause prevents 401 error during logout or before userId is set
        if (!userToken || !userId) { return; } 
        try {
          const response = await apiClient.get('/notifications/unread-count');
          setUnreadCount(Number(response.data.count || 0));
        } catch (error) {
          console.error("Failed to fetch unread count:", error);
        }
      };
      
      const fetchUnreadMessageCount = async () => {
        // Guard clause
        if (!userToken || !userId) { return; } 
        try {
          const response = await apiClient.get('/chat/unread-count');
          
          // ✨ THE FIX ✨
          // This code handles if the backend sends 5, "5", null, or undefined.
          const count = Number(response.data.count || 0);

          if (!isNaN(count)) {
            setUnreadMessageCount(count);
          } else {
            console.error("Failed to parse message count from API:", response.data);
            setUnreadMessageCount(0);
          }
        } catch (error) { 
            console.error("Failed to fetch unread message count:", error); 
            setUnreadMessageCount(0);
        }
      };


    useEffect(() => {
        isLoggedIn();

        return () => {
            if (unsubscribeFCM.current) {
                unsubscribeFCM.current();
                unsubscribeFCM.current = null;
            }
        };
    }, []);

    return (
        <AuthContext.Provider value={{ 
            login, logout, userToken, isLoading, userId, username, 
            unreadCount, fetchUnreadCount, setUnreadCountDirectly, 
            unreadMessageCount, fetchUnreadMessageCount, setUnreadMessageCountDirectly,
            showNotificationPrompt, setShowNotificationPrompt, 
            handleNotificationPermissionFlow, 
            // Exposing Password Reset Functions
            forgotPassword,
            confirmPasswordReset
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    return React.useContext(AuthContext);
};
