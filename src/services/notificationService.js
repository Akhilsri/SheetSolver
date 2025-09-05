import messaging from '@react-native-firebase/messaging';
import apiClient from '../api/apiClient';

// --- Function to ask for notification permissions ---
async function requestUserPermission() {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (enabled) {
    console.log('Notification Authorization status:', authStatus);
    return true;
  }
  return false;
}

// --- Function to get the unique device token from Firebase ---
async function getFcmToken() {
  try {
    const fcmToken = await messaging().getToken();
    if (fcmToken) {
      console.log('Your new FCM Token is:', fcmToken);
      return fcmToken;
    } else {
      console.log('Failed to get FCM token.');
      return null;
    }
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
}

// --- Function to send the token to our backend ---
async function sendTokenToServer(token) {
  try {
    await apiClient.post('/users/fcm-token', { token });
    console.log('FCM token sent to server successfully.');
  } catch (error) {
    console.error('Failed to send FCM token to server:', error.response?.data || error);
  }
}

// --- Main function to tie it all together ---
export const initializeNotifications = async () => {
  const permissionGranted = await requestUserPermission();
  if (permissionGranted) {
    const fcmToken = await getFcmToken();
    if (fcmToken) {
      await sendTokenToServer(fcmToken);
    }
  }
};