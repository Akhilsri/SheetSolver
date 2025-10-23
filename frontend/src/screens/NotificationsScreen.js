import React, { useState, useEffect } from 'react';
import {
  View,
  SectionList,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Platform,
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
  return sections.filter(section => section.data && section.data.length > 0);
};

// --- Main Component ---
const NotificationsScreen = () => {
  const navigation = useNavigation();
  const { fetchUnreadCount } = useAuth();
  const [sections, setSections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isResponding, setIsResponding] = useState(false);

  const markAllAsRead = async () => {
    try {
      await apiClient.put('/notifications/read-all');
      fetchUnreadCount(); // 👈 resets count to zero on icon
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

  const fetchActionItems = async () => {
    try {
      const [invitationsRes, connectionRequestsRes] = await Promise.all([
        apiClient.get('/invitations/pending'),
        apiClient.get('/connections/pending'),
      ]);

      setSections(prevSections => {
        const updatedSections = prevSections.filter(
          s => s.title !== INVITES_SECTION_TITLE && s.title !== CONNECTIONS_SECTION_TITLE
        );

        const newActionSections = [];
        if (connectionRequestsRes.data?.length > 0) {
          newActionSections.push({
            title: CONNECTIONS_SECTION_TITLE,
            data: connectionRequestsRes.data,
            key: 'connections',
          });
        }
        if (invitationsRes.data?.length > 0) {
          newActionSections.push({
            title: INVITES_SECTION_TITLE,
            data: invitationsRes.data,
            key: 'invitations',
          });
        }

        return removeEmptySections([...newActionSections, ...updatedSections]);
      });
    } catch (error) {
      console.error('Failed to fetch action items:', error);
    }
  };

  const fetchActivityFeed = async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    try {
      const notificationsRes = await apiClient.get('/notifications');
      const activityData = notificationsRes.data || [];

      setSections(prevSections => {
        const actionSections = prevSections.filter(s => s.title !== ACTIVITY_SECTION_TITLE);
        const updatedSections = [...actionSections];
        if (activityData.length > 0) {
          updatedSections.push({
            title: ACTIVITY_SECTION_TITLE,
            data: activityData,
            key: ACTIVITY_SECTION_TITLE,
          });
        }
        return removeEmptySections(updatedSections);
      });
    } catch (error) {
      console.error('Failed to fetch activity feed:', error);
    } finally {
      setIsRefreshing(false);
      if (!isRefresh) setIsLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      const loadData = async () => {
        await fetchActionItems();
        await fetchActivityFeed();
        setIsLoading(false);
        setTimeout(() => markAllAsRead(), 500);
      };
      loadData();
    }, [])
  );

  const handleAction = async (actionType, itemId, sectionTitle, endpoint, navigationRoute = null) => {
    setIsResponding(true);
    setSections(prev => removeEmptySections(filterSectionData(prev, sectionTitle, itemId)));
    try {
      await apiClient.put(endpoint);
      fetchUnreadCount();
      if (navigationRoute) {
        Alert.alert('Success', 'Action successful!', [
          { text: 'OK', onPress: () => navigation.navigate(navigationRoute) },
        ]);
      }
      fetchActionItems();
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.message || 'Could not complete the action.');
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
        keyExtractor={(item, index) => item.id.toString() + index}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              fetchActivityFeed(true);
              fetchActionItems();
              markAllAsRead(); // 👈 resets count visually & in backend
            }}
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

// --- Styles (same as your original) ---
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
