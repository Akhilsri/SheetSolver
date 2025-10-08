import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { AuthProvider } from './src/context/AuthContext';
import { SocketProvider } from './src/context/SocketContext';
import AppNavigator from './src/navigation/AppNavigator';
import messaging from '@react-native-firebase/messaging';
import BootSplash from 'react-native-bootsplash'; // ⬅️ KEEP THIS IMPORT
import { LogBox } from 'react-native';
LogBox.ignoreAllLogs(true)

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
      console.log("BootSplash has been hidden successfully.");
    });
    
  }, []); // Empty dependency array means this runs only once on component mount

  return (
    // The splash screen will hide just before these components render their content
    <AuthProvider>
      <SocketProvider> 
        <AppNavigator />
      </SocketProvider>
    </AuthProvider>
  );
};

export default App;