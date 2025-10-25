import messaging from '@react-native-firebase/messaging';
import { Platform, PermissionsAndroid, Linking } from 'react-native'; 
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import DeviceInfo from 'react-native-device-info';
import apiClient from '../api/apiClient';

// Key to manage the custom modal's persistence (used in App.js and Modal)
const CUSTOM_DISMISSAL_KEY = 'NOTIFICATION_REMINDER_SHOWN_CUSTOM'; 

// --------------------------------------------------------------------------
// --- UTILITY: Open App Settings (Needed for the custom modal) ---
// --------------------------------------------------------------------------
export const openAppSettings = async () => {
    if (Linking.openSettings) {
        return Linking.openSettings();
    } else if (Platform.OS === 'ios') {
        return Linking.openURL('app-settings:');
    } 
    else if (Platform.OS === 'android') {
        try {
            const pkg = await DeviceInfo.getBundleId();
            return Linking.openURL('package:' + pkg); 
        } catch (error) {
            console.error('FCM DEBUG: Failed to get BundleId for settings link:', error);
        }
    }
};

// --------------------------------------------------------------------------
// --- Core Function: Request Permissions (Updated for status strings & A13+) ---
// --------------------------------------------------------------------------
async function requestUserPermission() {
    let authStatus;

    if (Platform.OS === 'ios') {
        authStatus = await messaging().requestPermission();
        if (authStatus === messaging.AuthorizationStatus.AUTHORIZED || 
            authStatus === messaging.AuthorizationStatus.PROVISIONAL) {
            return 'granted';
        }
        return 'denied'; 
    }
    else if (Platform.OS === 'android' && Platform.Version >= 33) {
        try {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
            );
            return granted === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied';
        } catch (error) {
            return 'denied';
        }
    } else {
        // Android < 13
        return 'granted';
    }
}

// --------------------------------------------------------------------------
// --- Function to get the unique device token from Firebase (DEBUGGED) ---
// --------------------------------------------------------------------------
async function getFcmToken() {
    console.log('FCM DEBUG: Attempting to get new token...');
    try {
        const fcmToken = await messaging().getToken();
        if (fcmToken) {
            console.log('✅ FCM DEBUG: Token Retrieved Successfully!');
            console.log('FCM DEBUG: Token Value (First 10 chars):', fcmToken.substring(0, 10) + '...');
            return fcmToken;
        }
        // If getToken() returns null without throwing an error
        console.warn('❌ FCM DEBUG: messaging().getToken() returned NULL. This confirms a native setup issue (e.g., missing google-services.json or failed APNs connection).');
        return null;
    } catch (error) {
        // If getToken() throws an error (e.g., native exception)
        console.error('🔥 FCM DEBUG ERROR: Exception thrown during getToken() call!');
        console.error('FCM DEBUG ERROR Code:', error.code);
        console.error('FCM DEBUG ERROR Message:', error.message);
        return null;
    }
}

// --------------------------------------------------------------------------
// --- Function to send the token to our backend (DEBUGGED) ---
// --------------------------------------------------------------------------
async function sendTokenToServer(userId, token) {
    if (!userId || !token) {
        console.warn('FCM DEBUG: Cannot send FCM token to server: Missing User ID or Token.');
        return;
    }
    console.log(`FCM DEBUG: Sending token to server for user ${userId}...`);
    try {
        await apiClient.post('/users/fcm-token', { userId, fcmToken: token }); 
        console.log(`✅ FCM DEBUG: Token sent to server successfully for user ${userId}.`);
    } catch (error) {
        const message = error.response?.data?.message || error.message || 'Unknown API Error';
        console.error(`❌ FCM DEBUG ERROR: FAILED to send token to server (HTTP/API Error). Message: ${message}`);
    }
}

// --------------------------------------------------------------------------
// --- Function to remove the token from the backend (DEBUGGED) ---
// --------------------------------------------------------------------------
export async function removeTokenFromServer(userId) {
    console.log(`FCM DEBUG: Requesting server to remove token for user ${userId}.`);
    try {
        if (!userId) {
            console.warn('FCM DEBUG: Cannot remove FCM token from server: User ID is missing.');
            return;
        }
        await apiClient.post('/users/fcm-token-remove', { userId });
        console.log(`✅ FCM DEBUG: Token removal request sent to server successfully for user ${userId}.`);
    } catch (error) {
        const message = error.response?.data?.message || error.message || 'Unknown API Error';
        console.error(`❌ FCM DEBUG ERROR: Failed to remove token from server. Message: ${message}`);
    }
}

// --------------------------------------------------------------------------
// --- Main function to initialize notifications (DEBUGGED) ---
// --------------------------------------------------------------------------
export const initializeNotifications = async (userId) => {
    console.log(`FCM DEBUG: Starting notification initialization for user ${userId}...`);
    
    if (!userId) {
        console.warn('FCM DEBUG: Cannot initialize notifications: User ID is missing.');
        return { status: 'denied', unsubscribe: () => {} }; 
    }

    const permissionStatus = await requestUserPermission(); 
    console.log(`FCM DEBUG: Permission Status (from requestUserPermission): ${permissionStatus}`);

    if (permissionStatus === 'granted' && userId) {
        const fcmToken = await getFcmToken();

        if (fcmToken) {
            await sendTokenToServer(userId, fcmToken);
        } else {
            console.warn(`FCM DEBUG: Skipping token send because fcmToken is null.`);
        }

        const unsubscribeOnTokenRefresh = messaging().onTokenRefresh(async (newToken) => {
            console.log('FCM DEBUG: Token refresh event triggered. New Token:', newToken);
            await sendTokenToServer(userId, newToken);
        });

        return {
            status: 'granted',
            unsubscribe: () => { 
                console.log('FCM DEBUG: Unsubscribing onTokenRefresh listener.');
                unsubscribeOnTokenRefresh(); 
            }
        };
    }
    
    return { status: permissionStatus, unsubscribe: () => {} };
};
