import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator,TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import apiClient from '../api/apiClient';

const NotificationsScreen = () => {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/notifications');
      setNotifications(response.data);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // useFocusEffect re-fetches data every time the screen comes into view
  useFocusEffect(useCallback(() => {
    fetchNotifications();
  }, []));

  const handleMarkAsRead = async (notificationId) => {
    try {
      // Optimistic UI update: change the state immediately for a snappy feel
      setNotifications(prevNotifications => 
        prevNotifications.map(notif => 
          notif.id === notificationId ? { ...notif, is_read: 1 } : notif
        )
      );
      // Then, make the API call to the backend
      await apiClient.put(`/notifications/${notificationId}/read`);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      // If the API call fails, we could optionally revert the UI state
    }
  };

  if (isLoading) {
    return <ActivityIndicator size="large" style={styles.centered} />;
  }
  
  const renderItem = ({ item }) => (
    <TouchableOpacity onPress={() => handleMarkAsRead(item.id)}>
      <View style={[styles.notificationItem, !item.is_read && styles.unreadItem]}>
        <Text style={styles.notificationTitle}>{item.title}</Text>
        <Text style={styles.notificationBody}>{item.body}</Text>
        <Text style={styles.notificationDate}>{new Date(item.created_at).toLocaleString()}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <FlatList
      style={styles.container}
      data={notifications}
      keyExtractor={(item) => item.id.toString()}
      renderItem={renderItem}
      ListEmptyComponent={<Text style={styles.emptyText}>You have no new notifications.</Text>}
    />
  );
};

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#fff' },
  emptyText: { textAlign: 'center', marginTop: 50, color: 'gray' },
  notificationItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  unreadItem: {
    backgroundColor: '#e6f7ff', // A light blue for unread notifications
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  notificationBody: {
    fontSize: 14,
    color: '#333',
  },
  notificationDate: {
    fontSize: 12,
    color: 'gray',
    marginTop: 8,
    textAlign: 'right',
  },
});

export default NotificationsScreen;