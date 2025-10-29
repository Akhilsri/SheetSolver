import React, { useState, useCallback } from 'react';
import {
    View,
    SectionList,
    Text,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    Alert,
    RefreshControl,
    Image, 
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
const NOTIFICATIONS_PER_PAGE = 20; 

// --- Utility Functions (Kept as is) ---
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

    // --- PAGINATION STATE ---
    const [notificationsOffset, setNotificationsOffset] = useState(0); 
    const [hasMoreNotifications, setHasMoreNotifications] = useState(true); 

    // --- Optimized Mark All As Read ---
    const markAllAsRead = async (activityNotifications) => {
        try {
            if (!activityNotifications.some(n => !n.is_read)) return;

            await apiClient.put('/notifications/read-all');
            fetchUnreadCount(); 

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


    // --- UTILITY TO PROCESS ALL DATA INTO SECTIONS (FIXED MERGE LOGIC) ---
    const processAndSetSections = (notifications, invitations, connections, isInitialLoadOrRefresh = true) => {
        setSections(prevSections => {
            let newSections = [];

            // 1. Get existing non-Activity sections to preserve them when loading new pages
            const existingInvites = prevSections.find(s => s.title === INVITES_SECTION_TITLE)?.data || [];
            const existingConnections = prevSections.find(s => s.title === CONNECTIONS_SECTION_TITLE)?.data || [];
            
            // The action items to display: use new data on refresh, otherwise use existing
            const finalInvites = isInitialLoadOrRefresh ? invitations : existingInvites;
            const finalConnections = isInitialLoadOrRefresh ? connections : existingConnections;

            // 1a. Connection Requests
            if (finalConnections?.length > 0) {
                newSections.push({ title: CONNECTIONS_SECTION_TITLE, data: finalConnections, key: 'connections' });
            }
            // 1b. Pending Invitations
            if (finalInvites?.length > 0) {
                newSections.push({ title: INVITES_SECTION_TITLE, data: finalInvites, key: 'invitations' });
            }


            // 2. Activity Feed (Handle Append/Overwrite)
            const existingActivitySection = prevSections.find(s => s.title === ACTIVITY_SECTION_TITLE);
            let activityData = notifications || [];

            if (!isInitialLoadOrRefresh && existingActivitySection) {
                // APPEND LOGIC: Append new notifications to the existing list
                
                // Get the old list, but remove duplicates if any are present in the new batch
                const newIds = new Set(notifications.map(n => n.id));
                const filteredExisting = existingActivitySection.data.filter(
                    existingN => !newIds.has(existingN.id)
                );
                
                // Append new items to the end of the existing (older items)
                activityData = [...filteredExisting, ...notifications]; 
                
            } else if (isInitialLoadOrRefresh && existingActivitySection) {
                // For a true refresh (isInitialLoadOrRefresh = true), just replace the data
                activityData = notifications || []; 
            }
            
            if (activityData.length > 0) {
                newSections.push({
                    title: ACTIVITY_SECTION_TITLE,
                    data: activityData,
                    key: ACTIVITY_SECTION_TITLE,
                });
            }

            return removeEmptySections(newSections);
        });
    };

    // --- FETCH PAGINATED ACTIVITY PAGE ---
    const loadActivityPage = async (offset) => {
        // Prevent fetching if we know there is no more data or if currently refreshing
        if (!hasMoreNotifications || isRefreshing) return;
        
        // We set isRefreshing to TRUE temporarily for *pagination loading* only
        if (offset > 0) setIsRefreshing(true);
        
        try {
            // Call API with limit and offset
            const notificationsRes = await apiClient.get(`/notifications?limit=${NOTIFICATIONS_PER_PAGE}&offset=${offset}`);
            const { data: newNotifications, meta } = notificationsRes.data;

            if (newNotifications.length > 0) {
                // Pass false for overwriteActivity to trigger the append logic
                processAndSetSections(newNotifications, [], [], false); 
            }
            
            // Update state based on metadata
            setNotificationsOffset(offset + NOTIFICATIONS_PER_PAGE);
            setHasMoreNotifications(meta?.hasMore ?? newNotifications.length === NOTIFICATIONS_PER_PAGE);

        } catch (error) {
            console.error('Failed to load activity page:', error);
        } finally {
            if (offset > 0) setIsRefreshing(false); // Reset loading state for pagination
        }
    };


    // --- Concurrent Initial Load Function (Modified for Clear Refresh) ---
    const loadData = async (isRefresh = false) => {
        const initialLoad = !isRefresh && notificationsOffset === 0;

        if (isRefresh) setIsRefreshing(true);
        if (initialLoad) setIsLoading(true); 
        
        // Reset state for a fresh load or refresh
        setNotificationsOffset(0);
        setHasMoreNotifications(true);

        try {
            // 1. Fetch Action Items 
            const [invitationsRes, connectionRequestsRes] = await Promise.all([
                apiClient.get('/invitations/pending'),
                apiClient.get('/connections/pending'),
            ]);
            const invitations = invitationsRes.data || [];
            const connections = connectionRequestsRes.data || [];

            // 2. Fetch the FIRST page of Activity Feed
            const notificationsRes = await apiClient.get(`/notifications?limit=${NOTIFICATIONS_PER_PAGE}&offset=0`);
            const { data: notifications, meta } = notificationsRes.data;

            // 3. Process and Set all sections (overwrite/refresh=true)
            processAndSetSections(notifications, invitations, connections, true);

            // 4. Update pagination state
            setNotificationsOffset(NOTIFICATIONS_PER_PAGE);
            setHasMoreNotifications(meta?.hasMore ?? notifications.length === NOTIFICATIONS_PER_PAGE);
            
            // 5. Mark as read check
            if (notifications.some(n => !n.is_read)) {
                setTimeout(() => markAllAsRead(notifications), 500);
            }

        } catch (error) {
            console.error('Failed to load initial notifications screen data:', error);
        } finally {
            setIsRefreshing(false);
            setIsLoading(false);
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

            // Find existing activity data to preserve it
            const existingActivity = sections.find(s => s.title === ACTIVITY_SECTION_TITLE)?.data || [];

            // Call the shared function to re-process with existing activity and new action items
            // isInitialLoadOrRefresh must be TRUE here to update the action items
            processAndSetSections(existingActivity, invitations, connections, true);

        } catch (error) {
            console.error('Failed to fetch action items:', error);
        }
    };


    // --- Focus Effect ---
    useFocusEffect(
        useCallback(() => {
            // When the screen comes into focus, run a full fresh load.
            loadData();
        }, [])
    );

    // --- Handle Action (Kept as is) ---
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
    
    // ... handleAccept, handleDecline, handleAcceptConnection, handleDeclineConnection, handleNotificationPress ...
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
    // ... end of handle functions ...


    const renderItem = ({ item, section }) => {
        const iconMap = {
            [ACTIVITY_SECTION_TITLE]: { name: 'flash-outline', color: COLORS.success },
        };
        const sectionIcon = iconMap[section.title]; 
        const isUnread = section.title === ACTIVITY_SECTION_TITLE && !item.is_read;
        const timeInfo = item.timestamp ? formatNotificationTime(item.timestamp) : '';
        const roomInfo = item.roomName || item.related_room_name;

        // Render Action cards with avatar
        if (section.title === CONNECTIONS_SECTION_TITLE || section.title === INVITES_SECTION_TITLE) {
            const isConnection = section.title === CONNECTIONS_SECTION_TITLE;
            return (
                <Card style={styles.actionCardContainer}>
                    <View style={styles.notificationMainContent}>
                        {/* Avatar for sender */}
                        <Image
                            source={item.senderAvatarUrl ? { uri: item.senderAvatarUrl } : require('../assets/images/default_avatar.png')}
                            style={styles.senderAvatar} // Use new style for avatar
                        />
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

        // Render Activity Feed items with the spark icon
        return (
            <TouchableOpacity
                onPress={() => handleNotificationPress(item)}
                style={[styles.activityTouchArea, isUnread && styles.activityTouchAreaUnread]}
                activeOpacity={0.7}>
                <View style={styles.activityItem}>
                    {/* Spark icon for activity */}
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

    const renderListFooter = () => {
        // Show the loading spinner if we have more data AND the Activity section exists
        if (isRefreshing && hasMoreNotifications && sections.some(s => s.title === ACTIVITY_SECTION_TITLE)) {
            return (
                <View style={styles.footerLoader}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                </View>
            );
        }
        return null;
    };


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
                
                // --- INFINITE SCROLLING IMPLEMENTATION ---
                onEndReached={() => {
                    // Trigger the next page load if we have more data and are NOT currently fetching/refreshing
                    if (!isRefreshing && hasMoreNotifications) {
                        loadActivityPage(notificationsOffset);
                    }
                }}
                onEndReachedThreshold={0.5}
                ListFooterComponent={renderListFooter}
                // ------------------------------------------

                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={() => loadData(true)}
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

// --- Styles (Added footerLoader style) ---
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
    senderAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20, 
        marginRight: SIZES.base * 1.5,
        borderWidth: 1, 
        borderColor: COLORS.border,
    },
    actionIcon: { marginRight: SIZES.base * 1.5, marginTop: 2 }, 
    notificationBodyText: { ...FONTS.body, color: COLORS.textSecondary, fontSize: 14, lineHeight: 20 },
    bold: { fontWeight: 'bold', color: COLORS.textPrimary },
    notificationTime: { fontSize: 12, color: COLORS.gray, marginTop: SIZES.base / 2 },
    actionButtonContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: SIZES.base,
        marginTop: SIZES.padding, 
    },
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
    footerLoader: {
        paddingVertical: SIZES.padding,
    }
});

export default NotificationsScreen;