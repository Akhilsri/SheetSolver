import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SocketProvider } from './src/context/SocketContext';
import AppNavigator from './src/navigation/AppNavigator';
import messaging from '@react-native-firebase/messaging';
import BootSplash from 'react-native-bootsplash';
import NotificationPermissionModal from './src/components/modals/NotificationPermissionModal';

// UX Flag: Prevents the custom modal from showing again after user dismisses it once.
const CUSTOM_DISMISSAL_KEY = 'NOTIFICATION_REMINDER_SHOWN_CUSTOM';

const LINKING_CONFIG = {
    prefixes: ['myapp://'],
    config: {
        screens: {
            Login: 'login',
            ResetPasswordScreen: {
                path: 'reset-password',
                initialRouteName: 'ResetPasswordScreen',
            },
            Register: 'register',
            ForgotPassword: 'forgot-password',
        },
    },
};

// -----------------------------------------------------------
// --- AppInitializer Component: Manages Login-Based UX ---
// -----------------------------------------------------------
const AppInitializer = () => {
    // 1. Get notification state and handlers from AuthContext
    const {
        // State to control modal visibility, managed by AuthContext
        showNotificationPrompt,
        // Setter to hide the modal if user clicks 'Maybe Later'
        setShowNotificationPrompt,
        // Function to start the native permission flow if user clicks 'Allow'
        handleNotificationPermissionFlow
    } = useAuth();

    // --- Firebase Notification Channel Setup (Runs only once) ---
    const createNotificationChannel = async () => {
        if (Platform.OS === 'android') {
            const channelId = 'default_channel_id';
            const channelExists = await messaging().android.getChannel(channelId);
            if (!channelExists) {
                await messaging().android.createChannel({
                    channelId,
                    name: 'Default Notifications',
                    importance: messaging.Android.Importance.HIGH,
                });
            }
        }
    };

    // 1. Base Effect: Handles Splash Screen and Channel Creation
    useEffect(() => {
        createNotificationChannel().finally(() => {
            // Hide the splash screen quickly after initial setup
            BootSplash.hide({ fade: true });
        });

        // NOTE: The previous conflicting notification useEffect 
        // that depended on [userId, isLoading] has been removed 
        // to prevent race conditions. The logic is now centralized in AuthContext.
    }, []);

    // Handler for dismissing the custom modal (clicking 'Maybe Later')
    // This sets a flag in storage so we don't ask the user again.
    const handleModalDismiss = async () => {
        await AsyncStorage.setItem(CUSTOM_DISMISSAL_KEY, 'true');
        setShowNotificationPrompt(false);
    };


    return (
        <>
            <AppNavigator />
            {/* Modal is now driven entirely by AuthContext state */}
            <NotificationPermissionModal
                visible={showNotificationPrompt}
                onAllow={handleNotificationPermissionFlow} // Initiates FCM flow and hides modal
                onClose={handleModalDismiss}             // Sets dismissal flag and hides modal
            />
        </>
    );
}


// -----------------------------------------------------------
// --- App Component (Wrappers) ---
// -----------------------------------------------------------
const App = () => {
    return (
        <AuthProvider>
            <SocketProvider>
                <AppInitializer />
            </SocketProvider>
        </AuthProvider>
    );
};

export default App;

export { LINKING_CONFIG };
