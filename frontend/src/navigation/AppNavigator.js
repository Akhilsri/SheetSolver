import React,{useEffect} from 'react';
import { ActivityIndicator, View, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import messaging from '@react-native-firebase/messaging';
import { LINKING_CONFIG } from '../../App';

import MainTabNavigator from './MainTabNavigator';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import RoomsScreen from '../screens/RoomsScreen';
import CreateRoomScreen from '../screens/CreateRoomScreen';
import RoomDetailScreen from '../screens/RoomDetailScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import FullSheetScreen from '../screens/FullSheetScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import ChatScreen from '../screens/ChatScreen';
import GameScreen from '../screens/GameScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import DirectMessageScreen from '../screens/DirectMessageScreen';
import DailyProgressTracker from '../components/room/DailyProgressTracker';
import JourneyDashboardScreen from '../screens/JourneyDashboardScreen';
// import CreateSheetScreen from '../screens/CreateSheetScreen';
import JourneyAchievementsScreen from '../screens/JourneyAchievementsScreen'; 
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen'
import ResetPasswordScreen from '../screens/ResetPasswordScreen'

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const { userToken, isLoading,fetchUnreadCount } = useAuth();

  useEffect(() => {
    // This listener is for when a notification is received while the app is in the FOREGROUND
    const unsubscribe = messaging().onMessage(async remoteMessage => {
      Alert.alert(
        remoteMessage.notification.title,
        remoteMessage.notification.body
      );
      // When a message comes in, refresh the badge count
      fetchUnreadCount();
    });

    // This listener is for when a user taps a notification and the app is in the BACKGROUND
    messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('Notification caused app to open from background state:', remoteMessage.notification);
      // When the app is opened by a notification, refresh the badge count
      fetchUnreadCount();
      // Here you could also navigate to the notifications screen if you wanted
      // navigation.navigate('Notifications');
    });

    // This checks if the app was opened from a QUIT state by a notification
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log('Notification caused app to open from quit state:', remoteMessage.notification);
          // When opened from quit state, refresh the badge count
          // We add a small delay to ensure the app is ready
          setTimeout(() => {
            fetchUnreadCount();
          }, 1000);
        }
      });
    
    // The unsubscribe function is returned and called when the component unmounts
    return unsubscribe;
  }, []); // The empty array ensures this effect runs only once

  // Show a loading screen while we check for the token
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer linking={LINKING_CONFIG} fallback={<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" /></View>}>
      <Stack.Navigator>
        {userToken == null ? (
          // 🚨 FIX: Use Stack.Group instead of <>
          // You can also move shared options here
          <Stack.Group screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="ResetPasswordScreen" component={ResetPasswordScreen} />
          </Stack.Group>
        ) : (
          // 🚨 FIX: Use Stack.Group instead of <>
          <Stack.Group>
            <Stack.Screen name="Main" component={MainTabNavigator} options={{ headerShown: false }} />
            {/* Add all other screens here, so they can be pushed on top of the tabs */}
            <Stack.Screen name="CreateRoom" component={CreateRoomScreen} options={{ title: 'Create New Room' }} />
            <Stack.Screen name="RoomDetail" component={RoomDetailScreen} />
            <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="FullSheet" component={FullSheetScreen} />
            <Stack.Screen name="UserProfile" component={UserProfileScreen} options={({ route }) => ({ title: 'User Profile' })} />
            <Stack.Screen name="Chat" component={ChatScreen} options={({ route }) => ({ title: route.params.roomName })} />
            <Stack.Screen name="GameScreen" component={GameScreen} options={{ title: 'Competition' }} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit Profile' }} />
            <Stack.Screen name="DirectMessage" component={DirectMessageScreen} options={({ route }) => ({ title: route.params.connectionUsername })} />
            <Stack.Screen name="SheetViewer" component={DailyProgressTracker} options={({ route }) => ({ title: route.params.connectionUsername })} />
            <Stack.Screen name="JourneyDashboard" component={JourneyDashboardScreen} options={({ route }) => ({ title: `${route.params.roomName} Journey` })} />
            <Stack.Screen name="JourneyAchievements" component={JourneyAchievementsScreen} />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;