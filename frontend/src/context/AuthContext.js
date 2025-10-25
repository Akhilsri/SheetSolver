import React, { useState, useEffect, useRef } from 'react';
import { jwtDecode } from 'jwt-decode';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/apiClient';
import messaging from '@react-native-firebase/messaging';
import { 
    initializeNotifications, 
    removeTokenFromServer, 
    requestUserPermission
} from '../services/notificationService';

// Define all cache keys used across the application here for centralized cleanup
const ROOMS_CACHE_KEY = 'userRooms'; 
const DASHBOARD_CACHE_KEY = 'userDashboard';
const BADGES_CACHE_KEY = 'userBadges';
const NOTIF_CACHE_KEY = 'userNotifications';

// Key to track if the user has been shown our custom modal before
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

    // ---------------------------------------------------------------------
    //                         NOTIFICATION LOGIC
    // ---------------------------------------------------------------------

    const checkNotificationStatus = async (currentUserId) => {
        if (!currentUserId) return;
        
        // console.log(`AUTH DEBUG: Checking notification status for user ${currentUserId}`);
        const hasAsked = await AsyncStorage.getItem(NOTIFICATION_ASKED_KEY);
        
        if (hasAsked === null) {
            try {
                // console.log('AUTH DEBUG: No ASKED flag found. Checking native permission.');
                const authStatus = await messaging().hasPermission();
                // console.log(`AUTH DEBUG: Native permission status: ${authStatus}`);

                if (authStatus === messaging.AuthorizationStatus.NOT_DETERMINED) {
                    // console.log('AUTH DEBUG: Status NOT_DETERMINED. Showing custom prompt.');
                    setShowNotificationPrompt(true);
                } else {
                    await AsyncStorage.setItem(NOTIFICATION_ASKED_KEY, 'true');
                    // console.log('AUTH DEBUG: Status already determined. Setting ASKED flag.');
                    
                    // 🔥 FIX: Run initialization if status is determined (0 or 1), 
                    // asgetToken can still succeed even if notifications are denied.
                    // console.log('AUTH DEBUG: Status determined (DENIED or GRANTED). Initializing FCM token flow.');
                    const { unsubscribe } = await initializeNotifications(currentUserId);
                    unsubscribeFCM.current = unsubscribe;
                }
            } catch (error) {
                console.error("AUTH DEBUG: Error checking notification status:", error);
            }
        } else {
            // console.log('AUTH DEBUG: ASKED flag is set. Bypassing soft prompt check.');
            // Re-initialize for token refresh/listeners
            const authStatus = await messaging().hasPermission();
             if (authStatus !== messaging.AuthorizationStatus.NOT_DETERMINED) 
            {
                // console.log('AUTH DEBUG: Permission status is not NOT_DETERMINED. Re-initializing FCM token flow.');
                const { unsubscribe } = await initializeNotifications(currentUserId);
                unsubscribeFCM.current = unsubscribe;
            }
        }
    };


    const handleNotificationPermissionFlow = async () => {
        if (userId) {
            // console.log('AUTH DEBUG: User clicked ALLOW on custom modal. Firing native prompt.');
            const { unsubscribe } = await initializeNotifications(userId);
            unsubscribeFCM.current = unsubscribe;
            
            await AsyncStorage.setItem(NOTIFICATION_ASKED_KEY, 'true');
        }
        setShowNotificationPrompt(false);
    };

    // ---------------------------------------------------------------------
    //                         PASSWORD RESET LOGIC
    // ---------------------------------------------------------------------

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
    //                            AUTH LOGIC
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
                
                // console.log(`AUTH DEBUG: Login successful. Triggering checkNotificationStatus for user ${newUserId}.`);
                checkNotificationStatus(newUserId);
                
                fetchUnreadCount();
                fetchUnreadMessageCount();
            }
        } catch (error) {
            console.error('AUTH DEBUG: Login failed:', error);
            throw new Error('Login failed. Please check your credentials.');
        }
    };

    const logout = async () => {
        // console.log(`AUTH DEBUG: Starting logout process for user ${userId}.`);
        
        if (userId) {
            await removeTokenFromServer(userId);
            
            // CRITICAL FIX: Delete the token locally on the device 
            try {
                // console.log('AUTH DEBUG: Attempting to delete local FCM token...');
                await messaging().deleteToken();
                // console.log('✅ AUTH DEBUG: Local FCM token deleted successfully.');
            } catch (e) {
                console.error('❌ AUTH DEBUG ERROR: Failed to delete local FCM token:', e);
            }
        }

        if (unsubscribeFCM.current) {
            unsubscribeFCM.current();
            unsubscribeFCM.current = null;
        }

        setUserToken(null);
        setUserId(null);
        setUsername(null);
        setUnreadCount(0);
        setUnreadMessageCount(0); 
        setShowNotificationPrompt(false);
        
        await AsyncStorage.removeItem('accessToken');
        await AsyncStorage.removeItem('refreshToken');
        
        // Clear cache keys
        await AsyncStorage.removeItem(ROOMS_CACHE_KEY);
        await AsyncStorage.removeItem(DASHBOARD_CACHE_KEY);
        await AsyncStorage.removeItem(BADGES_CACHE_KEY);
        await AsyncStorage.removeItem(NOTIF_CACHE_KEY);
        
        // console.log('AUTH DEBUG: Logout complete. State and AsyncStorage cleared.');
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
                
                // console.log(`AUTH DEBUG: App startup (isLoggedIn). Triggering checkNotificationStatus for user ${storedUserId}.`);
                checkNotificationStatus(storedUserId);

                fetchUnreadCount();
                fetchUnreadMessageCount();
            } else {
                console.log('AUTH DEBUG: No existing accessToken found.');
            }
        } catch (e) {
            console.log(`AUTH DEBUG: isLoggedIn error: ${e}. Clearing tokens.`);
            await logout();
        } finally {
            setIsLoading(false);
            console.log('AUTH DEBUG: isLoading set to false.');
        }
    };
    
    // ... (fetchUnreadCount and fetchUnreadMessageCount functions)
    const fetchUnreadCount = async () => {
        if (!userToken || !userId) { return; } 
        try {
          const response = await apiClient.get('/notifications/unread-count');
          setUnreadCount(Number(response.data.count || 0));
        } catch (error) {
          console.error("AUTH DEBUG: Failed to fetch unread count:", error);
        }
      };
      
      const fetchUnreadMessageCount = async () => {
        if (!userToken || !userId) { return; } 
        try {
          const response = await apiClient.get('/chat/unread-count');
          const count = Number(response.data.count || 0);
          if (!isNaN(count)) {
            setUnreadMessageCount(count);
          } else {
            console.error("AUTH DEBUG: Failed to parse message count from API:", response.data);
            setUnreadMessageCount(0);
          }
        } catch (error) { 
            console.error("AUTH DEBUG: Failed to fetch unread message count:", error); 
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
