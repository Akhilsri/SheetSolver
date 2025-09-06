import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, SectionList, ActivityIndicator, TouchableOpacity, Button, Alert } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import apiClient from '../api/apiClient';
import { useAuth } from '../context/AuthContext';

const NotificationsScreen = () => {
  const navigation = useNavigation();
  const { fetchUnreadCount } = useAuth();
  const [sections, setSections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- This is the function that was missing ---
  const fetchData = async () => {
    try {
      // Don't show loader on background refreshes, only initial load
      // First, tell the backend to mark everything as read
      await apiClient.put('/notifications/read-all');
      // Then, update the global badge count immediately
      fetchUnreadCount();

      // Now, fetch the data to display on this screen
      const [invitationsRes, notificationsRes] = await Promise.all([
        apiClient.get('/invitations/pending'),
        apiClient.get('/notifications'),
      ]);
      
      const newSections = [];
      if (invitationsRes.data && invitationsRes.data.length > 0) {
        newSections.push({ title: 'Pending Invitations', data: invitationsRes.data });
      }
      if (notificationsRes.data && notificationsRes.data.length > 0) {
        newSections.push({ title: 'Notifications', data: notificationsRes.data });
      }
      setSections(newSections);
    } catch (error) {
      console.error('Failed to fetch notification data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(useCallback(() => {
    fetchData();
  }, []));

  const handleAccept = async (invitationId) => {
    try {
      await apiClient.put(`/invitations/${invitationId}/accept`);
      Alert.alert('Success', 'You have joined the room!', [
        { text: 'OK', onPress: () => {
          fetchData(); // Refresh the list
          navigation.navigate('RoomsTab');
        }}
      ]);
    } catch (error) {
      Alert.alert('Error', 'Could not accept the invitation.');
    }
  };
  
  const handleDecline = async (invitationId) => {
    try {
      await apiClient.put(`/invitations/${invitationId}/decline`);
      fetchData(); // This will now work because fetchData exists
    } catch (error) {
      console.error("Decline failed with error:", error.response?.data || error); 
      Alert.alert('Error', 'Could not decline the invitation.');
    }
  };

  if (isLoading) {
    return <ActivityIndicator size="large" style={styles.centered} />;
  }
  
  const renderItem = ({ item, section }) => {
    // Render UI for Invitations
    if (section.title === 'Pending Invitations') {
      return (
        <View style={styles.invitationItem}>
          <Text style={styles.invitationText}><Text style={{fontWeight: 'bold'}}>{item.senderName}</Text> invited you to join <Text style={{fontWeight: 'bold'}}>{item.roomName}</Text></Text>
          <View style={styles.buttonContainer}>
            <Button title="Decline" onPress={() => handleDecline(item.id)} color="red" />
            <Button title="Accept" onPress={() => handleAccept(item.id)} />
          </View>
        </View>
      );
    }
    
    // Render UI for regular notifications
    return (
      <View style={[styles.notificationItem, !item.is_read && styles.unreadItem]}>
        <Text style={styles.notificationTitle}>{item.title}</Text>
        <Text style={styles.notificationBody}>{item.body}</Text>
        <Text style={styles.notificationDate}>{new Date(item.created_at).toLocaleString()}</Text>
      </View>
    );
  };

  return (
    <SectionList
      style={styles.container}
      sections={sections}
      keyExtractor={(item, index) => item.id.toString() + index}
      renderItem={renderItem}
      renderSectionHeader={({ section: { title } }) => <Text style={styles.sectionHeader}>{title}</Text>}
      ListEmptyComponent={<Text style={styles.emptyText}>You have no new notifications or invites.</Text>}
    />
  );
};

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#fff' },
  emptyText: { textAlign: 'center', marginTop: 50, color: 'gray' },
  sectionHeader: { fontSize: 18, fontWeight: 'bold', paddingHorizontal: 15, paddingTop: 20, paddingBottom: 10, backgroundColor: '#f5f5f5' },
  invitationItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  invitationText: { fontSize: 16, marginBottom: 10 },
  buttonContainer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  notificationItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  unreadItem: { backgroundColor: '#e6f7ff' },
  notificationTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  notificationBody: { fontSize: 14, color: '#333' },
  notificationDate: { fontSize: 12, color: 'gray', marginTop: 8, textAlign: 'right' },
});

export default NotificationsScreen;