import React, { useEffect } from 'react';
import { Platform } from 'react-native'; // 1. Import Platform
import { AuthProvider } from './src/context/AuthContext';
import { SocketProvider } from './src/context/SocketContext';
import AppNavigator from './src/navigation/AppNavigator';
import messaging from '@react-native-firebase/messaging';
// import { LogBox } from 'react-native';
// LogBox.ignoreAllLogs(true)

const App = () => {

  useEffect(() => {
    const createNotificationChannel = async () => {
      // 2. Add a check to only run this code on Android
      if (Platform.OS === 'android') {
        const channelId = 'default_channel_id';
        const channelExists = await messaging().android.getChannel(channelId);
        if (!channelExists) {
          await messaging().android.createChannel({
            channelId,
            name: 'Default Notifications', // A more descriptive name
            importance: messaging.Android.Importance.HIGH,
          });
          console.log('Default notification channel created.');
        }
      }
    };

    createNotificationChannel();
  }, []);

  return (
    <AuthProvider>
      <SocketProvider> 
        <AppNavigator />
      </SocketProvider>
    </AuthProvider>
  );
};

export default App;