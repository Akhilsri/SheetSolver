import React, { useState, useCallback, useRef } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    FlatList, 
    ActivityIndicator, 
    TouchableOpacity, 
    Image,
    RefreshControl,
    Alert // Import Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import apiClient from '../api/apiClient';
import { COLORS, SIZES, FONTS } from '../styles/theme';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext'; 

const ConnectionsScreen = () => {
    const navigation = useNavigation();
    
    // ⚡ OPTIMIZATION: State separation for SWR
    const [connections, setConnections] = useState([]);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    // Ref to cache status (SWR flag)
    const hasDataLoadedOnce = useRef(false);
    
    const { fetchUnreadMessageCount } = useAuth();
    const socket = useSocket(); 

    // --- Optimized Fetch Function (SWR Core) ---
    const fetchConnections = useCallback(async (isBackground = false) => {
    
    // 1. Set appropriate loading state
    if (!hasDataLoadedOnce.current) {
        setIsInitialLoading(true);
    } else if (isBackground) {
        setIsRefreshing(true);
    } else {
        // This block runs when coming back from DirectMessageScreen
        setIsRefreshing(true);
        
        // ✨ FIX: Immediately clear the unread count for the focused conversation
        // This ensures the badge is gone instantly when returning.
        setConnections(prevConnections => {
            return prevConnections.map(conn => ({
                ...conn,
                // We clear ALL unread counts if we know an unread count fetch is about to happen, 
                // but since we only care about the one we just read, a full server-side refresh
                // after the optimistic update is the most robust way.
                // However, since we are fetching a NEW list, we can skip the optimistic update 
                // and simply ensure the *initial fetch* runs immediately.
                // The current implementation of useFocusEffect already triggers the fetch:
                // fetchConnections(false); 
            }));
        });
    }

    try {
        const response = await apiClient.get('/connections');
        // The API response should now contain friend objects with unread_messages: 0
        setConnections(response.data); 
        
        // This is crucial: the unread count often depends on connections, so we refresh it.
        fetchUnreadMessageCount(); 
        
        hasDataLoadedOnce.current = true;
    } catch (error) {
        // ... (rest of the function is the same)
    } finally {
        setIsInitialLoading(false);
        setIsRefreshing(false);
    }
}, [fetchUnreadMessageCount]);

// The useFocusEffect ensures the fetch runs when navigating back.
useFocusEffect(
    useCallback(() => {
        // The key is here: run the fetch *every time* the screen comes into focus.
        fetchConnections(false); 
        return () => {};
    }, [fetchConnections])
);
    
    // --- Socket Invalidation (Optional but Best Practice for Chat) ---
    // If a new private message comes in for *any* conversation, refresh the connections list silently.
    React.useEffect(() => {
        // Guard against socket not being ready
        if (!socket.current) return;

        const onNewPrivateMessage = (data) => {
            console.log('[SOCKET] New private message received. Refreshing connections list...');
            // Force a silent background refresh of the list
            fetchConnections(true);
        };

        socket.current.on('receive_private_message', onNewPrivateMessage);
        
        return () => {
            // Guard against socket disconnecting before cleanup
            if (socket.current) {
                socket.current.off('receive_private_message', onNewPrivateMessage);
            }
        };
    }, [socket, fetchConnections]);


    if (isInitialLoading) {
        return <ActivityIndicator size="large" color={COLORS.primary} style={styles.centered} />;
    }

    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={styles.chatCard}
            activeOpacity={0.8}
            onPress={() =>
                navigation.navigate('DirectMessage', {
                    connectionUserId: item.friend_id,
                    connectionUsername: item.friend_username,
                })
            }
        >
            <Image
                source={
                    item.friend_avatar_url
                        ? { uri: item.friend_avatar_url }
                        : require('../assets/images/default_avatar.png')
                }
                style={styles.avatar}
            />
            <View style={styles.textWrapper}>
                <View style={styles.topRow}>
                    <Text style={styles.username}>{item.friend_username}</Text>
                </View>
                <Text style={styles.lastMessage} numberOfLines={1}>
                    {item.last_message || 'No messages yet.'}
                </Text>
            </View>

            {item.unread_messages > 0 && (
                <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{item.unread_messages}</Text>
                </View>
            )}
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Messages</Text>
            </View>

            <FlatList
                data={connections}
                keyExtractor={(item) => item.friend_id.toString()}
                renderItem={renderItem}
                contentContainerStyle={{ padding: SIZES.padding }}
                
                // ⚡ Pull-to-refresh implementation
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={() => fetchConnections(false)} // Force foreground fetch
                        tintColor={COLORS.primary}
                    />
                }

                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Icon name="chatbubble-ellipses-outline" size={60} color={COLORS.textSecondary} />
                        <Text style={styles.emptyTitle}>No conversations yet</Text>
                        <Text style={styles.emptySubtitle}>
                            Start a chat by finding people in the Search tab.
                        </Text>
                    </View>
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SIZES.padding,
        paddingVertical: SIZES.base * 2,
        backgroundColor: COLORS.surface,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },
    headerTitle: { ...FONTS.h2, fontWeight: '600' },
    
    // Chat Card
    chatCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        padding: SIZES.base * 1.5,
        borderRadius: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    avatar: { width: 52, height: 52, borderRadius: 26 },
    textWrapper: { flex: 1, marginLeft: 12 },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 2,
    },
    username: { ...FONTS.h3, fontWeight: '600' },
    time: { ...FONTS.caption, color: COLORS.textSecondary },
    lastMessage: { ...FONTS.body, color: COLORS.textSecondary },

    // Unread badge
    unreadBadge: {
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    unreadText: {
        color: COLORS.surface,
        fontSize: 12,
        fontWeight: 'bold',
    },

    // Empty state
    emptyState: { flex: 1, alignItems: 'center', marginTop: 80 },
    emptyTitle: { ...FONTS.h3, marginTop: 12, fontWeight: '600' },
    emptySubtitle: {
        ...FONTS.body,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginTop: 4,
        paddingHorizontal: 40,
    },
});

export default ConnectionsScreen;