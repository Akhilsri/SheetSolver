import React, { useEffect } from 'react';
import { Platform,Linking} from 'react-native';
import { AuthProvider } from './src/context/AuthContext';
import { SocketProvider } from './src/context/SocketContext';
import AppNavigator from './src/navigation/AppNavigator';
import messaging from '@react-native-firebase/messaging';
import BootSplash from 'react-native-bootsplash'; // ⬅️ KEEP THIS IMPORT
// import NotificationPermissionModal from './src/components/modals/NotificationPermissionModal'; // ✨ NEW IMPORT
// import { LogBox } from 'react-native';
// LogBox.ignoreAllLogs(true)

// <<-- INSERT LINKING_CONFIG DEFINITION HERE -->>
// In App.js

const LINKING_CONFIG = {
  prefixes: ['myapp://'],
  config: {
    screens: {
      // 1. Set the initial route for the unauthenticated stack to be 'Login'.
      Login: 'login',

      // 2. Add the path for the Reset Screen.
      // NOTE: We MUST list the screen names here for the linking config to work.
      ResetPasswordScreen: {
        path: 'reset-password',
        // CRITICAL FIX: When a deep link comes in, we want this specific screen 
        // to take precedence over the 'Login' screen, even if the user is logged out.
        initialRouteName: 'ResetPasswordScreen', 
      },
      
      // All other unauthenticated screens should be listed without a path
      Register: 'register',
      ForgotPassword: 'forgot-password', 

      // ... rest of your routes
    },
  },
};
// <<-- END LINKING_CONFIG DEFINITION -->>

const App = () => {

  useEffect(() => {
    // 1. ASYNCHRONOUS INITIALIZATION FUNCTION
    const initializeApp = async () => {
      // --- Existing Firebase Notification Channel Setup ---
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
            console.log('Default notification channel created.');
          }
        }
      };
      
      await createNotificationChannel();
      
      // --- Add other asynchronous tasks here (e.g., check initial auth state) ---
      // await checkInitialAuthState();
    };

    // 2. RUN THE INITIALIZATION AND HIDE BOOTSPLASH WHEN IT'S COMPLETE
    initializeApp().finally(() => {
      // ⬅️ CRITICAL: Hide the splash screen once all initial async tasks are done.
      //    We use fade: true for a smooth transition.
      BootSplash.hide({ fade: true });
    });
    
  }, []); // Empty dependency array means this runs only once on component mount

  return (
    // The splash screen will hide just before these components render their content
    <AuthProvider>
      <SocketProvider> 
        <AppNavigator />
        {/* <NotificationPermissionModal /> */}
      </SocketProvider>
    </AuthProvider>
  );
};

export default App;

// <<-- EXPORT LINKING_CONFIG HERE -->>
export { LINKING_CONFIG };
// <<-- END EXPORT -->>