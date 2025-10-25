import React, { useState } from 'react';
import {
  View,
  SectionList,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import apiClient from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import { COLORS, SIZES, FONTS } from '../styles/theme';
import Icon from 'react-native-vector-icons/Ionicons';
import Card from '../components/common/Card';
import moment from 'moment';

// --- Constants ---
const ACTIVITY_SECTION_TITLE = 'Activity';
const INVITES_SECTION_TITLE = 'Pending Invitations';
const CONNECTIONS_SECTION_TITLE = 'Connection Requests';

// --- Utility Functions ---
const formatNotificationTime = (timestamp) => {
  if (!timestamp) return '';
  const date = moment(timestamp);
  const now = moment();

  if (now.diff(date, 'hours') < 24) return date.fromNow();
  if (now.diff(date, 'days') < 7) return date.format('ddd h:mm A');
  return date.format('MMM D, YYYY');
};

const filterSectionData = (prevSections, sectionTitle, itemId) => {
  return prevSections
    .map(section => {
      if (section.title === sectionTitle) {
        return {
          ...section,
          data: section.data.filter(item => item.id !== itemId),
        };
      }
      return section;
    })
    .filter(section => section.data.length > 0);
};

const removeEmptySections = (sections) => {
  // Ensure sections is an array before filtering
  return Array.isArray(sections) ? sections.filter(section => section.data && section.data.length > 0) : [];
};

// --- Main Component ---
const NotificationsScreen = () => {
  const navigation = useNavigation();
  const { fetchUnreadCount } = useAuth();
  const [sections, setSections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isResponding, setIsResponding] = useState(false);

  // --- Utility to process data into sections (centralized logic) ---
  const processAndSetSections = (notifications, invitations, connections) => {
    const newSections = [];

    // 1. Connection Requests
    if (connections?.length > 0) {
      newSections.push({
        title: CONNECTIONS_SECTION_TITLE,
        data: connections,
        key: 'connections',
      });
    }

    // 2. Pending Invitations
    if (invitations?.length > 0) {
      newSections.push({
        title: INVITES_SECTION_TITLE,
        data: invitations,
        key: 'invitations',
      });
    }

    // 3. Activity Feed (Only add if data exists)
    if (notifications?.length > 0) {
      newSections.push({
        title: ACTIVITY_SECTION_TITLE,
        data: notifications,
        key: ACTIVITY_SECTION_TITLE,
      });
    }

    setSections(removeEmptySections(newSections));
  };

  // --- Optimized Mark All As Read (Client-side update after API) ---
  const markAllAsRead = async () => {
    try {
      await apiClient.put('/notifications/read-all');
      fetchUnreadCount(); // Reset count on icon

      // Visually mark all as read without a costly re-fetch
      setSections(prev =>
        prev.map(section =>
          section.title === ACTIVITY_SECTION_TITLE
            ? { ...section, data: section.data.map(n => ({ ...n, is_read: true })) }
            : section
        )
      );
    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
    }
  };

  // --- Minimal Re-fetch for Action Items (FIXED) ---
  const fetchActionItems = async () => {
    try {
      const [invitationsRes, connectionRequestsRes] = await Promise.all([
        apiClient.get('/invitations/pending'),
        apiClient.get('/connections/pending'),
      ]);

      const invitations = invitationsRes.data || [];
      const connections = connectionRequestsRes.data || [];

      setSections(prevSections => {
        // CRITICAL FIX: Find the existing Activity section data to keep it untouched
        const existingActivitySection = prevSections.find(s => s.title === ACTIVITY_SECTION_TITLE);

        const newSections = [];

        // 1. Add new Connection Requests
        if (connections.length > 0) {
          newSections.push({
            title: CONNECTIONS_SECTION_TITLE,
            data: connections,
            key: 'connections',
          });
        }

        // 2. Add new Pending Invitations
        if (invitations.length > 0) {
          newSections.push({
            title: INVITES_SECTION_TITLE,
            data: invitations,
            key: 'invitations',
          });
        }

        // 3. Preserve the existing Activity section if it was there
        if (existingActivitySection) {
          newSections.push(existingActivitySection);
        }

        return removeEmptySections(newSections);
      });
    } catch (error) {
      console.error('Failed to fetch action items:', error);
    }
  };

  // --- Concurrent Initial Load Function ---
  const loadData = async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    const setLoadState = !isRefresh;

    if (setLoadState) setIsLoading(true);

    try {
      // Concurrent fetching for speed
      const [invitationsRes, connectionRequestsRes, notificationsRes] = await Promise.all([
        apiClient.get('/invitations/pending'),
        apiClient.get('/connections/pending'),
        apiClient.get('/notifications'),
      ]);

      const invitations = invitationsRes.data || [];
      const connections = connectionRequestsRes.data || [];
      const notifications = notificationsRes.data || [];

      processAndSetSections(notifications, invitations, connections);

      // Only mark as read if there were unread items
      if (notifications.some(n => !n.is_read)) {
        setTimeout(markAllAsRead, 500);
      }

    } catch (error) {
      console.error('Failed to load notifications screen data:', error);
    } finally {
      setIsRefreshing(false);
      if (setLoadState) setIsLoading(false);
    }
  };

  // --- Focus Effect (Only runs loadData once on focus) ---
  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  // --- Handle Action (Optimistic UI + Minimal Re-fetch) ---
  const handleAction = async (actionType, itemId, sectionTitle, endpoint, navigationRoute = null) => {
    setIsResponding(true);
    // Optimistic UI update
    setSections(prev => removeEmptySections(filterSectionData(prev, sectionTitle, itemId)));
    try {
      await apiClient.put(endpoint);
      fetchUnreadCount();
      if (navigationRoute) {
        Alert.alert('Success', 'Action successful!', [
          { text: 'OK', onPress: () => navigation.navigate(navigationRoute) },
        ]);
      }
      // Minimal re-fetch to ensure state is correct
      fetchActionItems();
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.message || 'Could not complete the action.');
      // Re-fetch action items on error to restore the item
      fetchActionItems();
    } finally {
      setIsResponding(false);
    }
  };

  const handleAccept = (id) =>
    handleAction('accept', id, INVITES_SECTION_TITLE, `/invitations/${id}/accept`, 'Main');
  const handleDecline = (id) =>
    handleAction('decline', id, INVITES_SECTION_TITLE, `/invitations/${id}/decline`);
  const handleAcceptConnection = (id) =>
    handleAction('accept', id, CONNECTIONS_SECTION_TITLE, `/connections/${id}/accept`);
  const handleDeclineConnection = (id) =>
    handleAction('decline', id, CONNECTIONS_SECTION_TITLE, `/connections/${id}/decline`);

  const handleNotificationPress = (notification) => {
    if (notification.type === 'SUBMISSION' && notification.related_room_id) {
      navigation.navigate('RoomDetail', { roomId: notification.related_room_id });
    }
  };

  const renderItem = ({ item, section }) => {
    const iconMap = {
      [CONNECTIONS_SECTION_TITLE]: { name: 'person-add-outline', color: COLORS.primary },
      [INVITES_SECTION_TITLE]: { name: 'enter-outline', color: COLORS.accent },
      [ACTIVITY_SECTION_TITLE]: { name: 'flash-outline', color: COLORS.success },
    };
    const sectionIcon = iconMap[section.title];
    const isUnread = section.title === ACTIVITY_SECTION_TITLE && !item.is_read;
    const timeInfo = item.timestamp ? formatNotificationTime(item.timestamp) : '';
    const roomInfo = item.roomName || item.related_room_name;

    if (section.title === CONNECTIONS_SECTION_TITLE || section.title === INVITES_SECTION_TITLE) {
      const isConnection = section.title === CONNECTIONS_SECTION_TITLE;
      return (
        <Card style={styles.actionCardContainer}>
          <View style={styles.notificationMainContent}>
            <Icon name={sectionIcon.name} size={24} color={sectionIcon.color} style={styles.actionIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.notificationBodyText}>
                <Text style={styles.bold}>{item.senderName}</Text>{' '}
                {isConnection ? 'wants to connect with you.' : `invited you to join `}
                {!isConnection && <Text style={styles.bold}>{item.roomName}</Text>}
              </Text>
              {timeInfo && <Text style={styles.notificationTime}>{timeInfo}</Text>}
            </View>
          </View>
          <View style={styles.actionButtonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.declineButton]}
              onPress={() => (isConnection ? handleDeclineConnection(item.id) : handleDecline(item.id))}
              disabled={isResponding}>
              <Text style={styles.declineButtonText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.acceptButton]}
              onPress={() => (isConnection ? handleAcceptConnection(item.id) : handleAccept(item.id))}
              disabled={isResponding}>
              <Text style={styles.acceptButtonText}>Accept</Text>
            </TouchableOpacity>
          </View>
        </Card>
      );
    }

    return (
      <TouchableOpacity
        onPress={() => handleNotificationPress(item)}
        style={[styles.activityTouchArea, isUnread && styles.activityTouchAreaUnread]}
        activeOpacity={0.7}>
        <View style={styles.activityItem}>
          <Icon name={sectionIcon.name} size={20} color={sectionIcon.color} style={styles.activityIcon} />
          <View style={styles.activityTextContainer}>
            <Text style={styles.notificationTitleText}>{item.title}</Text>
            <Text style={styles.activityBodyText}>
              {item.body}
              {roomInfo ? <Text style={styles.roomInfoText}> in {roomInfo}</Text> : null}
            </Text>
            {timeInfo && <Text style={styles.activityTime}>{timeInfo}</Text>}
          </View>
          {isUnread && <View style={styles.unreadDot} />}
        </View>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section: { title } }) => (
    <Text style={styles.sectionHeaderTitle}>{title}</Text>
  );

  if (isLoading)
    return <ActivityIndicator size="large" style={styles.centered} color={COLORS.primary} />;

  return (
    <View style={styles.container}>
      <SectionList
        sections={removeEmptySections(sections)}
        keyExtractor={(item, index) => (item.id ? item.id.toString() : index.toString())}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadData(true)} // Re-run concurrent load
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
            progressBackgroundColor="#fff"
          />
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>
              No new notifications. Everything is caught up! 🎉
            </Text>
          </View>
        }
      />
    </View>
  );
};

// --- Styles (unchanged from your original) ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: SIZES.padding * 2 },
  listContent: { paddingBottom: SIZES.padding * 2 },
  emptyText: { ...FONTS.body, color: COLORS.textSecondary, textAlign: 'center', fontSize: 15 },
  sectionHeaderTitle: {
    ...FONTS.h3,
    color: COLORS.textPrimary,
    fontWeight: '700',
    marginTop: SIZES.padding * 1.5,
    marginBottom: SIZES.base,
    marginLeft: SIZES.padding,
    fontSize: 18,
  },
  actionCardContainer: {
    marginHorizontal: SIZES.padding,
    marginBottom: SIZES.padding,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.surface,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  notificationMainContent: { flexDirection: 'row', alignItems: 'flex-start' },
  actionIcon: { marginRight: SIZES.base * 1.5, marginTop: 2 },
  notificationBodyText: { ...FONTS.body, color: COLORS.textSecondary, fontSize: 14, lineHeight: 20 },
  bold: { fontWeight: 'bold', color: COLORS.textPrimary },
  notificationTime: { fontSize: 12, color: COLORS.gray, marginTop: SIZES.base / 2 },
  actionButtonContainer: { flexDirection: 'row', justifyContent: 'flex-end', gap: SIZES.base },
  button: {
    paddingVertical: SIZES.base,
    paddingHorizontal: SIZES.padding * 1.2,
    borderRadius: SIZES.radius,
    minWidth: 90,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: { backgroundColor: COLORS.success },
  acceptButtonText: { ...FONTS.body, color: COLORS.surface, fontWeight: 'bold', fontSize: 14 },
  declineButton: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  declineButtonText: { ...FONTS.body, color: COLORS.textPrimary, fontWeight: 'bold', fontSize: 14 },
  activityTouchArea: {
    marginHorizontal: SIZES.padding,
    marginBottom: SIZES.base,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
  },
  activityTouchAreaUnread: {
    backgroundColor: COLORS.surface,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accent,
  },
  activityItem: { flexDirection: 'row', alignItems: 'flex-start', padding: SIZES.padding },
  activityIcon: { marginRight: SIZES.base, marginTop: 1 },
  activityTextContainer: { flex: 1 },
  notificationTitleText: { ...FONTS.h4, color: COLORS.textPrimary, fontWeight: '600', marginBottom: 2, lineHeight: 20 },
  activityBodyText: { fontSize: 14, color: COLORS.textSecondary },
  roomInfoText: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '500' },
  activityTime: { fontSize: 12, color: COLORS.gray, marginTop: SIZES.base / 2 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accent, marginLeft: SIZES.base, marginTop: 5 },
});

export default NotificationsScreen;