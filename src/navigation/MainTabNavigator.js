import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';

import RoomsScreen from '../screens/RoomsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SearchScreen from '../screens/SearchScreen';
import CompeteScreen from '../screens/CompeteScreen'; 
import ConnectionsScreen from '../screens/ConnectionsScreen';

const Tab = createBottomTabNavigator();

const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'RoomsTab') {
            iconName = focused ? 'home' : 'home-outline';
          }else if (route.name === 'SearchTab') { // <-- Add icon logic for Search
            iconName = focused ? 'search' : 'search-outline';} 
            else if (route.name === 'ConnectionsTab') { // <-- Add icon logic for new tab
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } 
            else if (route.name === 'CompeteTab') { // <-- Add icon logic for Compete
            iconName = focused ? 'code-slash' : 'code-slash-outline';}

          else if (route.name === 'ProfileTab') {
            iconName = focused ? 'person' : 'person-outline';
          }
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007BFF',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen name="RoomsTab" component={RoomsScreen} options={{ title: 'Rooms' }} />
      <Tab.Screen name="ConnectionsTab" component={ConnectionsScreen} options={{ title: 'Messages' }} />
      <Tab.Screen name="SearchTab" component={SearchScreen} options={{ title: 'Search' }} />
      <Tab.Screen name="CompeteTab" component={CompeteScreen} options={{ title: 'Compete' }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ title: 'Profile' }}/>
    </Tab.Navigator>
  );
};

export default MainTabNavigator;