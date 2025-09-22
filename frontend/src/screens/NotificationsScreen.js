import React, { useState, useCallback } from 'react';
import { View, FlatList,Text, StyleSheet, SectionList, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import apiClient from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import { COLORS, SIZES, FONTS } from '../styles/theme';
import Icon from 'react-native-vector-icons/Ionicons';
import Card from '../components/common/Card';

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

  useFocusEffect(
  useCallback(() => {
    fetchData();
    const markAsRead = async () => {
      try {
        await apiClient.put('/notifications/read-all');
        fetchUnreadCount();
        // also update local UI
        setSections(prev =>
          prev.map(section => 
            section.title === 'Activity'
              ? { ...section, data: section.data.map(n => ({ ...n, is_read: true })) }
              : section
          )
        );
      } catch (error) {
        console.error('Failed to mark notifications as read:', error);
      }
    };
    markAsRead();
  }, [])
);


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
    const iconMap = {
        'Connection Requests': { name: 'person-add-outline', color: COLORS.primary },
        'Pending Invitations': { name: 'enter-outline', color: COLORS.accent },
        'Activity': { name: 'flash-outline', color: COLORS.success },
    };
    const sectionIcon = iconMap[section.title] || { name: 'notifications-outline', color: COLORS.textSecondary };

    // --- RENDER LOGIC FOR REQUESTS (Connections & Invitations) ---
    if (section.title === 'Connection Requests' || section.title === 'Pending Invitations') {
      const isConnectionRequest = section.title === 'Connection Requests';
      const text = isConnectionRequest 
        ? <Text style={styles.notificationBody}><Text style={styles.bold}>{item.senderName}</Text> wants to connect with you.</Text>
        : <Text style={styles.notificationBody}><Text style={styles.bold}>{item.senderName}</Text> invited you to join <Text style={styles.bold}>{item.roomName}</Text>.</Text>;

      return (
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name={sectionIcon.name} size={20} color={sectionIcon.color} />
            <Text style={[styles.sectionTitle, {color: sectionIcon.color}]}>{section.title}</Text>
          </View>
          {text}
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.declineButton]} 
              onPress={() => isConnectionRequest ? handleDeclineConnection(item.id) : handleDecline(item.id)}
              disabled={isResponding}
            >
              <Text style={styles.declineButtonText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.button, styles.acceptButton]}
              onPress={() => isConnectionRequest ? handleAcceptConnection(item.id) : handleAccept(item.id)}
              disabled={isResponding}
            >
              <Text style={styles.acceptButtonText}>Accept</Text>
            </TouchableOpacity>
          </View>
        </Card>
      );
    }

    // --- RENDER LOGIC for general Activity ---
    if (section.title === 'Activity') {
      return (
        <TouchableOpacity onPress={() => handleNotificationPress(item)}>
          <View style={[styles.activityItem, !item.is_read && styles.unreadItem]}>
            <Icon name={sectionIcon.name} size={24} color={sectionIcon.color} style={styles.activityIcon} />
            <View style={styles.activityTextContainer}>
              <Text style={styles.notificationTitle}>{item.title}</Text>
              <Text style={styles.notificationBody}>{item.body}</Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    }
    return null;
  };

  if (isLoading) { return <ActivityIndicator size="large" style={styles.centered} />; }

  return (
    <View style={styles.container}>
        <FlatList
            data={sections}
            keyExtractor={(item, index) => item.title + index}
            renderItem={({ item }) => (
                <FlatList 
                    data={item.data}
                    keyExtractor={(subItem) => subItem.id.toString()}
                    renderItem={({ item: subItem }) => renderItem({ item: subItem, section: item })}
                />
            )}
            // ListHeaderComponent={<Text style={styles.headerTitle}>Notifications</Text>}
            ListEmptyComponent={<View style={styles.centered}><Text style={styles.emptyText}>No new notifications.</Text></View>}
            showsVerticalScrollIndicator={false}
        />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: SIZES.padding * 2 },
  headerTitle: { ...FONTS.h1, margin: SIZES.padding },
  emptyText: { ...FONTS.body, color: COLORS.textSecondary },
  
  card: { marginHorizontal: SIZES.padding, marginBottom: SIZES.padding, padding: SIZES.padding },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SIZES.base },
  sectionTitle: { ...FONTS.h3, marginLeft: SIZES.base, fontWeight: '600' },

  notificationBody: { ...FONTS.body, color: COLORS.textSecondary, marginBottom: SIZES.padding, lineHeight: 22 },
  bold: { fontWeight: 'bold', color: COLORS.textPrimary },
  
  buttonContainer: { flexDirection: 'row', justifyContent: 'flex-end', gap: SIZES.base },
  button: { paddingVertical: SIZES.base, paddingHorizontal: SIZES.padding, borderRadius: SIZES.radius * 2 },
  acceptButton: { backgroundColor: COLORS.success },
  acceptButtonText: { ...FONTS.body, color: COLORS.surface, fontWeight: 'bold' },
  declineButton: { backgroundColor: COLORS.background },
  declineButtonText: { ...FONTS.body, color: COLORS.textSecondary, fontWeight: 'bold' },

  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SIZES.padding,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  unreadItem: { backgroundColor: COLORS.primaryLight },
  activityIcon: { marginRight: SIZES.padding },
  activityTextContainer: { flex: 1 },
  notificationTitle: { ...FONTS.h3, color: COLORS.textPrimary },
});

export default NotificationsScreen;