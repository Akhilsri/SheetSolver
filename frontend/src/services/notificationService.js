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
  console.log('Notification Authorization status DENIED:', authStatus);
  return false;
}

// --- Function to get the unique device token from Firebase ---
async function getFcmToken() {
  try {
    const fcmToken = await messaging().getToken();
    if (fcmToken) {
      console.log('Your current FCM Token is:', fcmToken); // Changed "new" to "current"
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
// MODIFICATION: Now accepts userId
async function sendTokenToServer(userId, token) {
  try {
    if (!userId) {
      console.warn('Cannot send FCM token to server: User ID is missing.');
      return;
    }
    if (!token) {
      console.warn('Cannot send FCM token to server: Token is missing.');
      return;
    }
    await apiClient.post('/users/fcm-token', { userId, fcmToken: token }); // Changed 'token' key to 'fcmToken' for clarity
    console.log(`FCM token sent to server successfully for user ${userId}.`);
  } catch (error) {
    console.error('Failed to send FCM token to server:', error.response?.data || error);
  }
}

// NEW FUNCTION: To remove the token from the backend
async function removeTokenFromServer(userId) {
  try {
    if (!userId) {
      console.warn('Cannot remove FCM token from server: User ID is missing.');
      return;
    }
    // Assuming a DELETE or POST with null for fcm_token
    await apiClient.post('/users/fcm-token-remove', { userId }); // NEW ENDPOINT
    console.log(`FCM token removed from server successfully for user ${userId}.`);
  } catch (error) {
    console.error('Failed to remove FCM token from server:', error.response?.data || error);
  }
}

// --- Main function to initialize notifications and set up listeners ---
// MODIFICATION: Now accepts userId
export const initializeNotifications = async (userId) => {
  if (!userId) {
    console.warn('initializeNotifications called without a userId. Skipping FCM setup.');
    return;
  }

  const permissionGranted = await requestUserPermission();
  if (permissionGranted) {
    const fcmToken = await getFcmToken();
    if (fcmToken) {
      await sendTokenToServer(userId, fcmToken);
    }

    // NEW: Set up listener for token refreshes
    const unsubscribeOnTokenRefresh = messaging().onTokenRefresh(async (newToken) => {
      console.log('FCM token refreshed:', newToken);
      await sendTokenToServer(userId, newToken);
    });

    // You might also want to set up listeners for foreground messages here
    // const unsubscribeOnMessage = messaging().onMessage(async remoteMessage => {
    //   console.log('Foreground message:', remoteMessage);
    //   // Handle displaying notification or updating UI
    // });

    // Return an unsubscribe function to clean up listeners when component unmounts or user logs out
    return () => {
      unsubscribeOnTokenRefresh();
      // if (unsubscribeOnMessage) unsubscribeOnMessage();
    };
  }
  return () => {}; // Return a no-op unsubscribe if permission not granted
};

// NEW: Export removeTokenFromServer for use on logout
export { removeTokenFromServer };