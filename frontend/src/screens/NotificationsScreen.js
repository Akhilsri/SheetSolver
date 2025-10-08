import React, { useState, useCallback } from 'react';
import { View, FlatList, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import apiClient from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import { COLORS, SIZES, FONTS } from '../styles/theme';
import Icon from 'react-native-vector-icons/Ionicons';
import Card from '../components/common/Card';
import { getCacheItem, setCacheItem, clearCacheItem } from '../services/cacheService';

const NOTIF_CACHE_KEY = 'userNotifications';

const NotificationsScreen = () => {
  const navigation = useNavigation();
  const { fetchUnreadCount } = useAuth();
  const [sections, setSections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isResponding, setIsResponding] = useState(false);

  // Remove item from section data
  const filterSectionData = useCallback((prevSections, sectionTitle, itemId) => {
    return prevSections
      .map(section => {
        if (section.title === sectionTitle) {
          return {
            ...section,
            data: section.data.filter(item => item.id !== itemId)
          };
        }
        return section;
      })
      .filter(section => section.data.length > 0);
  }, []);

  // Fetch data with optional cache
  const fetchData = async (useCache = true) => {
    let cachedSections = null;

    if (useCache) {
      cachedSections = await getCacheItem(NOTIF_CACHE_KEY);
      if (cachedSections) {
        setSections(cachedSections);
        setIsLoading(false);
        console.log('Notifications loaded from cache.');
      } else {
        setIsLoading(true);
      }
    } else {
      setIsLoading(true);
    }

    try {
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

      // Only update state/cache if changed
      if (JSON.stringify(newSections) !== JSON.stringify(sections) || !useCache) {
        setSections(newSections);
        await setCacheItem(NOTIF_CACHE_KEY, newSections);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      if (!cachedSections) Alert.alert('Error', 'Could not fetch notifications.');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch notifications + mark all as read on focus
  useFocusEffect(
    useCallback(() => {
      fetchData(true);

      const markAsRead = async () => {
        try {
          await apiClient.put('/notifications/read-all');
          fetchUnreadCount();
          await clearCacheItem(NOTIF_CACHE_KEY);

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

  // Accept/Decline helpers
  const handleAccept = async (invitationId) => {
    setIsResponding(true);
    try {
      await apiClient.put(`/invitations/${invitationId}/accept`);
      await clearCacheItem(NOTIF_CACHE_KEY);
      fetchUnreadCount();
      setSections(prev => filterSectionData(prev, 'Pending Invitations', invitationId));
      Alert.alert('Success', 'You have joined the room!', [{ text: 'OK', onPress: () => navigation.navigate('Main') }]);
    } catch (error) {
      Alert.alert('Error', 'Could not accept the invitation.');
    } finally { setIsResponding(false); }
  };

  const handleDecline = async (invitationId) => {
    setIsResponding(true);
    try {
      await apiClient.put(`/invitations/${invitationId}/decline`);
      await clearCacheItem(NOTIF_CACHE_KEY);
      fetchUnreadCount();
      setSections(prev => filterSectionData(prev, 'Pending Invitations', invitationId));
    } catch (error) {
      Alert.alert('Error', 'Could not decline the invitation.');
    } finally { setIsResponding(false); }
  };

  const handleAcceptConnection = async (requestId) => {
    setIsResponding(true);
    try {
      await apiClient.put(`/connections/${requestId}/accept`);
      await clearCacheItem(NOTIF_CACHE_KEY);
      fetchUnreadCount();
      setSections(prev => filterSectionData(prev, 'Connection Requests', requestId));
    } catch (error) { Alert.alert('Error', 'Could not accept request.'); }
    finally { setIsResponding(false); }
  };

  const handleDeclineConnection = async (requestId) => {
    setIsResponding(true);
    try {
      await apiClient.put(`/connections/${requestId}/decline`);
      await clearCacheItem(NOTIF_CACHE_KEY);
      fetchUnreadCount();
      setSections(prev => filterSectionData(prev, 'Connection Requests', requestId));
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

    // Requests
    if (section.title === 'Connection Requests' || section.title === 'Pending Invitations') {
      const isConnectionRequest = section.title === 'Connection Requests';
      const text = isConnectionRequest
        ? <Text style={styles.notificationBody}><Text style={styles.bold}>{item.senderName}</Text> wants to connect with you.</Text>
        : <Text style={styles.notificationBody}><Text style={styles.bold}>{item.senderName}</Text> invited you to join <Text style={styles.bold}>{item.roomName}</Text>.</Text>;

      return (
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name={sectionIcon.name} size={20} color={sectionIcon.color} style={{ marginRight: SIZES.base }} />
            <Text style={[styles.sectionTitle, { color: sectionIcon.color }]}>{section.title}</Text>
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

    // Activity
    if (section.title === 'Activity') {
      return (
        <TouchableOpacity onPress={() => handleNotificationPress(item)} style={{ marginHorizontal: SIZES.padding / 2 }}>
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

  if (isLoading) return <ActivityIndicator size="large" style={styles.centered} color={COLORS.primary} />;

  return (
    <View style={styles.container}>
      <FlatList
        data={sections}
        keyExtractor={(item, index) => item.title + index}
        renderItem={({ item }) => (
          <View key={item.title}>
            <Text style={styles.sectionHeaderTitle}>{item.title}</Text>
            <FlatList
              data={item.data}
              keyExtractor={(subItem) => subItem.id.toString()}
              renderItem={({ item: subItem }) => renderItem({ item: subItem, section: item })}
              scrollEnabled={false}
            />
          </View>
        )}
        ListEmptyComponent={<View style={styles.centered}><Text style={styles.emptyText}>No new notifications. Everything is caught up! 🎉</Text></View>}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: SIZES.padding * 2 },
  listContent: { paddingBottom: SIZES.padding * 2 },
  emptyText: { ...FONTS.body, color: COLORS.textSecondary, textAlign: 'center' },
  sectionHeaderTitle: { ...FONTS.h3, color: COLORS.textPrimary, fontWeight: '700', marginTop: SIZES.padding, marginBottom: SIZES.base, marginLeft: SIZES.padding },
  card: { marginHorizontal: SIZES.padding, marginBottom: SIZES.padding, padding: SIZES.padding, backgroundColor: COLORS.surface, borderRadius: SIZES.radius, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SIZES.base },
  sectionTitle: { ...FONTS.body, fontWeight: '600', textTransform: 'uppercase', fontSize: 13 },
  notificationBody: { ...FONTS.body, color: COLORS.textSecondary, marginBottom: SIZES.padding * 1.5, lineHeight: 22 },
  bold: { fontWeight: 'bold', color: COLORS.textPrimary },
  buttonContainer: { flexDirection: 'row', justifyContent: 'flex-end', gap: SIZES.base },
  button: { paddingVertical: SIZES.base + 2, paddingHorizontal: SIZES.padding + 4, borderRadius: SIZES.radius, minWidth: 90, justifyContent: 'center', alignItems: 'center' },
  acceptButton: { backgroundColor: COLORS.success },
  acceptButtonText: { ...FONTS.body, color: COLORS.surface, fontWeight: 'bold', fontSize: 14 },
  declineButton: { backgroundColor: '#E5E7EB', borderWidth: 1, borderColor: '#D1D5DB' },
  declineButtonText: { ...FONTS.body, color: COLORS.textPrimary, fontWeight: 'bold', fontSize: 14 },
  activityItem: { flexDirection: 'row', alignItems: 'flex-start', padding: SIZES.padding, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', borderRadius: SIZES.radius / 2, marginBottom: 4 },
  unreadItem: { backgroundColor: '#FFFAEC', borderLeftWidth: 4, borderLeftColor: COLORS.accent },
  activityIcon: { marginRight: SIZES.padding, marginTop: 4 },
  activityTextContainer: { flex: 1 },
  notificationTitle: { ...FONTS.h3, color: COLORS.textPrimary, fontSize: 16, fontWeight: '600' },
});

export default NotificationsScreen;
