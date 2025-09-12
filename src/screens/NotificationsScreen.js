import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, SectionList, ActivityIndicator, TouchableOpacity, Button, Alert } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import apiClient from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import { COLORS, SIZES, FONTS } from '../styles/theme';

const NotificationsScreen = () => {
  const navigation = useNavigation();
  const { fetchUnreadCount } = useAuth();
  const [sections, setSections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isResponding, setIsResponding] = useState(false);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [invitationsRes, notificationsRes, connectionRequestsRes] = await Promise.all([
        apiClient.get('/invitations/pending'),
        apiClient.get('/notifications'),
        apiClient.get('/connections/pending'),
      ]);
      
      const newSections = [];
      if (connectionRequestsRes.data?.length > 0) {
        newSections.push({ title: 'Connection Requests', data: connectionRequestsRes.data });
      }
      if (invitationsRes.data?.length > 0) {
        newSections.push({ title: 'Pending Invitations', data: invitationsRes.data });
      }
      if (notificationsRes.data?.length > 0) {
        newSections.push({ title: 'Activity', data: notificationsRes.data });
      }
      setSections(newSections);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(useCallback(() => {
    fetchData();
    const timer = setTimeout(async () => {
      try {
        await apiClient.put('/notifications/read-all');
        fetchUnreadCount();
      } catch (error) {
        console.error('Failed to mark notifications as read:', error);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, []));

  const handleAccept = async (invitationId) => {
    setIsResponding(true);
    try {
      await apiClient.put(`/invitations/${invitationId}/accept`);
      Alert.alert('Success', 'You have joined the room!', [
        { text: 'OK', onPress: () => {
          fetchData();
          navigation.navigate('RoomsTab');
        }}
      ]);
    } catch (error) {
      Alert.alert('Error', 'Could not accept the invitation.');
    } finally {
      setIsResponding(false);
    }
  };
  
  const handleDecline = async (invitationId) => {
    setIsResponding(true);
    try {
      await apiClient.put(`/invitations/${invitationId}/decline`);
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Could not decline the invitation.');
    } finally {
      setIsResponding(false);
    }
  };
  
  const handleAcceptConnection = async (requestId) => {
      setIsResponding(true);
      try {
          await apiClient.put(`/connections/${requestId}/accept`);
          fetchData();
      } catch (error) { Alert.alert('Error', 'Could not accept request.'); }
      finally { setIsResponding(false); }
  };

  const handleDeclineConnection = async (requestId) => {
      setIsResponding(true);
      try {
          await apiClient.put(`/connections/${requestId}/decline`);
          fetchData();
      } catch (error) { Alert.alert('Error', 'Could not decline request.'); }
      finally { setIsResponding(false); }
  };

  const handleNotificationPress = (notification) => {
    if (notification.type === 'SUBMISSION' && notification.related_room_id) {
      navigation.navigate('RoomDetail', { roomId: notification.related_room_id });
    }
  };
  
  const renderItem = ({ item, section }) => {
    if (section.title === 'Connection Requests') {
      return (
        <View style={styles.invitationItem}>
          <Text style={styles.invitationText}><Text style={{fontWeight: 'bold'}}>{item.senderName}</Text> wants to connect with you.</Text>
          <View style={styles.buttonContainer}>
            <Button title="Decline" onPress={() => handleDeclineConnection(item.id)} color={COLORS.danger} disabled={isResponding} />
            <Button title="Accept" onPress={() => handleAcceptConnection(item.id)} color={COLORS.success} disabled={isResponding} />
          </View>
        </View>
      );
    }

    if (section.title === 'Pending Invitations') {
      return (
        <View style={styles.invitationItem}>
          <Text style={styles.invitationText}><Text style={{fontWeight: 'bold'}}>{item.senderName}</Text> invited you to join <Text style={{fontWeight: 'bold'}}>{item.roomName}</Text></Text>
          <View style={styles.buttonContainer}>
            <Button title="Decline" onPress={() => handleDecline(item.id)} color={COLORS.danger} disabled={isResponding} />
            <Button title="Accept" onPress={() => handleAccept(item.id)} color={COLORS.success} disabled={isResponding} />
          </View>
        </View>
      );
    }
    
    if (section.title === 'Activity') {
      return (
        <TouchableOpacity onPress={() => handleNotificationPress(item)}>
          <View style={[styles.notificationItem, !item.is_read && styles.unreadItem]}>
            <Text style={styles.notificationTitle}>{item.title}</Text>
            <Text style={styles.notificationBody}>{item.body}</Text>
            <Text style={styles.notificationDate}>{new Date(item.created_at).toLocaleString()}</Text>
          </View>
        </TouchableOpacity>
      );
    }
    return null;
  };

  if (isLoading) { return <ActivityIndicator size="large" style={styles.centered} />; }

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
  container: { flex: 1, backgroundColor: COLORS.surface },
  emptyText: { ...FONTS.caption, textAlign: 'center', marginTop: SIZES.padding * 2 },
  sectionHeader: { ...FONTS.h2, paddingHorizontal: SIZES.padding, paddingTop: SIZES.padding, paddingBottom: SIZES.base, backgroundColor: COLORS.background },
  invitationItem: { padding: SIZES.padding, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  invitationText: { ...FONTS.body, marginBottom: SIZES.base * 1.5 },
  buttonContainer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  notificationItem: { padding: SIZES.padding, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  unreadItem: { backgroundColor: COLORS.primaryLight },
  notificationTitle: { ...FONTS.h3, color: COLORS.textPrimary, marginBottom: 4 },
  notificationBody: { ...FONTS.body, color: COLORS.textSecondary },
  notificationDate: { ...FONTS.caption, marginTop: SIZES.base, textAlign: 'right' },
});

export default NotificationsScreen;