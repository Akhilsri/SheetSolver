import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
    View, Text, ImageBackground, TextInput, StyleSheet, FlatList, 
    KeyboardAvoidingView, Platform, ActivityIndicator, TouchableOpacity, SafeAreaView 
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import apiClient from '../api/apiClient';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS, SIZES, FONTS } from '../styles/theme';

// --- Constants for Pagination ---
const PAGE_SIZE = 50; 

// --- Helper: format date like WhatsApp ---
const formatChatDate = (date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const isSameDay = (d1, d2) =>
        d1.getDate() === d2.getDate() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getFullYear() === d2.getFullYear();

    if (isSameDay(date, today)) return "Today";
    if (isSameDay(date, yesterday)) return "Yesterday";
    return date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
};

const DirectMessageScreen = () => {
    const route = useRoute();
    const headerHeight = useHeaderHeight();
    const { connectionUserId } = route.params;
    const { userId, username, fetchUnreadMessageCount } = useAuth();
    const socket = useSocket();

    // ⚡ OPTIMIZATION: Pagination States
    const [messages, setMessages] = useState([]);
    const [oldestMessageId, setOldestMessageId] = useState(null);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    
    // UI States
    const [text, setText] = useState('');
    const [isLoadingInitial, setIsLoadingInitial] = useState(true);
    const [isPaginating, setIsPaginating] = useState(false);
    
    const flatListRef = useRef(null);

    // --- Insert date separators into raw messages ---
    const processMessagesForDisplay = useCallback((rawMessages) => {
        const displayItems = [];
        let lastDate = null;

        const sorted = [...rawMessages].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        sorted.forEach(msg => {
            const msgDate = new Date(msg.createdAt);
            if (!lastDate || !(
                lastDate.getDate() === msgDate.getDate() &&
                lastDate.getMonth() === msgDate.getMonth() &&
                lastDate.getFullYear() === msgDate.getFullYear()
            )) {
                displayItems.push({
                    _id: `date-${msgDate.getTime()}`,
                    type: 'dateSeparator',
                    date: msgDate
                });
                lastDate = msgDate;
            }
            displayItems.push({ ...msg, type: 'message' });
        });

        // reverse for inverted FlatList
        return displayItems.reverse();
    }, []);

    // ⚡ OPTIMIZATION: Load previous pages of messages
    const loadPreviousMessages = useCallback(async () => {
        if (!hasMoreMessages || isPaginating || isLoadingInitial) return;
        
        setIsPaginating(true);
        
        try {
            const params = { limit: PAGE_SIZE };
            if (oldestMessageId) {
                params.beforeId = oldestMessageId;
            }
            
            const response = await apiClient.get(`/chat/direct/${connectionUserId}`, { params });
            const { messages: newRawMessages, hasMore } = response.data;

            if (!newRawMessages || newRawMessages.length === 0) {
                setHasMoreMessages(false);
                return;
            }

            const formatted = newRawMessages.map(msg => ({
                ...msg,
                createdAt: new Date(msg.createdAt),
                user: typeof msg.user === 'string' ? JSON.parse(msg.user) : msg.user || { _id: null, name: 'Unknown' },
            }));

            // Find the ID of the new oldest message to use as the next cursor
            const newOldestId = formatted.length > 0 
                ? formatted[formatted.length - 1]._id 
                : oldestMessageId;
            
            setOldestMessageId(newOldestId);
            setHasMoreMessages(hasMore);

            // Merge the new messages with the existing ones
            setMessages(prev => {
                const existingRaw = prev.filter(m => m.type === 'message').reverse(); 
                const combinedRaw = [...existingRaw, ...formatted]; 
                return processMessagesForDisplay(combinedRaw);
            });

        } catch (err) {
            console.error("Failed to load previous DM messages:", err);
        } finally {
            setIsPaginating(false);
        }
    }, [connectionUserId, oldestMessageId, hasMoreMessages, isPaginating, isLoadingInitial, processMessagesForDisplay]);


    // ⚡ OPTIMIZATION: Initial load only fetches the first page
    useEffect(() => {
        const fetchFirstPage = async () => {
            try {
                setIsLoadingInitial(true);
                
                // Mark messages as read and update badge count
                await apiClient.put(`/chat/direct/${connectionUserId}/read`);
                fetchUnreadMessageCount();

                // Fetch only the first page (latest messages)
                const response = await apiClient.get(`/chat/direct/${connectionUserId}`, { params: { limit: PAGE_SIZE } });
                const { messages: rawMessages, hasMore } = response.data;
                
                if (!rawMessages) return;

                const formatted = rawMessages.map(msg => ({
                    ...msg,
                    createdAt: new Date(msg.createdAt),
                    user: typeof msg.user === 'string' ? JSON.parse(msg.user) : msg.user || { _id: null, name: 'Unknown' },
                }));

                // Set initial cursor and status
                const newOldestId = formatted.length > 0 
                    ? formatted[formatted.length - 1]._id 
                    : null;
                
                setOldestMessageId(newOldestId);
                setHasMoreMessages(hasMore);
                setMessages(processMessagesForDisplay(formatted));
                
            } catch (error) {
                console.error("Failed to load initial DM history:", error);
            } finally {
                setIsLoadingInitial(false);
            }
        };
        fetchFirstPage();
    }, [connectionUserId, fetchUnreadMessageCount, processMessagesForDisplay]);


    // Socket listener
    useEffect(() => {
        if (!socket.current) return;
        
        const onReceivePrivateMessage = (newMessage) => {
            // Only update if the message is from the current connection partner OR is my echo
            if (newMessage.senderId === Number(connectionUserId) || newMessage.senderId === Number(userId)) {
                
                const formatted = {
                    ...newMessage,
                    createdAt: new Date(newMessage.createdAt),
                    type: "message",
                    // Ensure user object is correct for display
                    user: { _id: newMessage.senderId, name: newMessage.user.name },
                };
                
                setMessages(prev => {
                    // Filter out date separators, keeping only message objects (in reverse order)
                    const prevMessagesRaw = prev.filter(m => m.type === "message").reverse(); 
                    
                    // Add the new message to the end (latest)
                    prevMessagesRaw.push(formatted);
                    
                    return processMessagesForDisplay(prevMessagesRaw);
                });
            }
        };
        socket.current.on("receive_private_message", onReceivePrivateMessage);
        
        return () => socket.current.off("receive_private_message", onReceivePrivateMessage);
    }, [socket.current, connectionUserId, userId, processMessagesForDisplay]);


    const handleSend = useCallback(() => {
        if (text.trim() === '' || !socket.current) return;
        
        const currentMessage = text; // Capture text before clearing
        
        // Optimistic UI update: Append the message instantly
        const tempMessageData = {
             _id: `temp-${Date.now()}`,
             text: currentMessage,
             createdAt: new Date(),
             user: { _id: Number(userId), name: username },
             type: "message",
        };
        
        setMessages(prev => {
            const rawMsgs = prev.filter(m => m.type === "message").reverse();
            rawMsgs.push(tempMessageData); // Add to latest end
            return processMessagesForDisplay(rawMsgs);
        });
        
        socket.current.emit('send_private_message', {
            senderId: userId,
            recipientId: connectionUserId,
            messageText: currentMessage,
            user: { _id: userId, name: username }
        });
        
        setText('');
    }, [text, userId, username, connectionUserId, socket.current, processMessagesForDisplay]);


    const renderItem = ({ item }) => {
        if (item.type === "dateSeparator") {
            return (
                <View style={styles.dateSeparatorContainer} key={item._id}>
                    <Text style={styles.dateSeparatorText}>{formatChatDate(item.date)}</Text>
                </View>
            );
        }

        const isMyMessage = item.user && (item.user._id === Number(userId) || item.user.id === Number(userId));
        const timeString = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return (
            <View style={[
                styles.messageRow,
                { justifyContent: isMyMessage ? 'flex-end' : 'flex-start' }
            ]}>
                <View style={[
                    styles.messageBubble,
                    isMyMessage ? styles.myMessage : styles.theirMessage
                ]}>
                    <Text style={isMyMessage ? styles.myMessageText : styles.theirMessageText}>{item.text}</Text>
                    <View style={styles.timestampWrapper}>
                        <Text style={isMyMessage ? styles.myTimestamp : styles.theirTimestamp}>
                            {timeString}
                        </Text>
                        {isMyMessage && (
                            <Icon 
                                name="checkmark-done-outline" 
                                size={14} 
                                color={COLORS.surface} 
                                style={{ marginLeft: 4, opacity: 0.8 }} 
                            />
                        )}
                    </View>
                </View>
            </View>
        );
    };

    // --- Render list footer (actually rendered at the top in inverted list) ---
    const renderListFooter = () => {
        if (isLoadingInitial) return null;
        if (!hasMoreMessages) return <View style={styles.endOfHistory}><Text style={styles.endOfHistoryText}></Text></View>;

        return (
            <View style={styles.paginationLoader}>
                {isPaginating ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                    <TouchableOpacity onPress={loadPreviousMessages} style={styles.loadMoreButton}>
                        <Text style={styles.loadMoreText}>Load Older Messages</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };


    if (isLoadingInitial) {
        return <ActivityIndicator size="large" color={COLORS.primary} style={styles.centered} />;
    }

    return (
        <ImageBackground source={require('../assets/images/chat_bg.png')} style={styles.container}>
            <SafeAreaView style={{ flex: 1 }}>
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={headerHeight}
                >
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        inverted
                        keyExtractor={(item) => item._id.toString()}
                        renderItem={renderItem}
                        contentContainerStyle={{ padding: SIZES.base }}
                        
                        // ⚡ OPTIMIZATION: Pagination Handlers
                        onEndReached={loadPreviousMessages}
                        onEndReachedThreshold={0.5} 
                        ListFooterComponent={renderListFooter} // Renders at the TOP due to 'inverted'
                        
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyText}>No messages yet. Say hi 👋</Text>
                            </View>
                        }
                    />

                    <View style={styles.inputBar}>
                        <TextInput
                            style={styles.input}
                            value={text}
                            onChangeText={setText}
                            placeholder="Type a message..."
                            placeholderTextColor={COLORS.textSecondary}
                            multiline
                        />
                        <TouchableOpacity 
                            style={[
                                styles.sendButton, 
                                { opacity: text.trim().length > 0 ? 1 : 0.6 }
                            ]} 
                            onPress={handleSend} 
                            disabled={text.trim().length === 0}
                        >
                            <Icon name="send" size={20} color={COLORS.surface} />
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </ImageBackground>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    // --- Message Bubbles ---
    messageRow: { 
        marginVertical: 4, 
        flexDirection: 'row', 
        paddingHorizontal: SIZES.base,
    },
    messageBubble: {
        maxWidth: '80%',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 18,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    myMessage: { 
        backgroundColor: COLORS.primary,
        borderBottomRightRadius: 4, 
    },
    theirMessage: { 
        backgroundColor: COLORS.surface,
        borderBottomLeftRadius: 4,
    },
    myMessageText: {
        ...FONTS.body,
        color: COLORS.surface,
    },
    theirMessageText: {
        ...FONTS.body,
        color: COLORS.textPrimary,
    },
    timestampWrapper: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'flex-end',
        marginTop: 4 
    },
    myTimestamp: { 
        ...FONTS.caption, 
        fontSize: 11, 
        color: COLORS.surface,
        opacity: 0.8,
    },
    theirTimestamp: { 
        ...FONTS.caption, 
        fontSize: 11, 
        color: COLORS.textSecondary,
    },

    // --- Input Bar ---
    inputBar: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: SIZES.base,
        paddingVertical: SIZES.base,
        backgroundColor: COLORS.background,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    input: {
        flex: 1,
        fontSize: 16,
        paddingHorizontal: SIZES.padding,
        paddingVertical: Platform.OS === 'ios' ? 12 : 8,
        ...FONTS.body,
        color: COLORS.textPrimary,
        backgroundColor: COLORS.surface,
        borderRadius: 25,
        borderWidth: 1,
        borderColor: COLORS.border,
        maxHeight: 120,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: SIZES.base,
    },

    // --- Date Separator ---
    dateSeparatorContainer: {
        marginVertical: 10,
        alignItems: 'center',
    },
    dateSeparatorText: {
        backgroundColor: COLORS.border,
        color: COLORS.textSecondary,
        ...FONTS.caption,
        fontSize: 12,
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 15,
    },

    // Empty state
    emptyState: { padding: SIZES.padding * 2, alignItems: 'center' },
    emptyText: { ...FONTS.body, color: COLORS.textSecondary, textAlign: 'center' },
    
    // ⚡ NEW STYLES FOR PAGINATION LOADER
    paginationLoader: { paddingVertical: SIZES.padding, alignItems: 'center' },
    endOfHistory: { paddingVertical: SIZES.padding, alignItems: 'center' },
    endOfHistoryText: { ...FONTS.caption, color: COLORS.textSecondary, opacity: 0.5 },
    loadMoreButton: { 
        backgroundColor: COLORS.primaryLight, 
        paddingVertical: SIZES.base, 
        paddingHorizontal: SIZES.padding,
        borderRadius: SIZES.radius * 2 
    },
    loadMoreText: { ...FONTS.body, fontSize: 13, color: COLORS.primary, fontWeight: '600' }
});

export default DirectMessageScreen;