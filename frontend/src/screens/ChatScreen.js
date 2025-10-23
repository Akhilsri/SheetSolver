import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
    View, Text, TextInput, StyleSheet, FlatList, 
    KeyboardAvoidingView, Platform, ActivityIndicator, TouchableOpacity 
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import apiClient from '../api/apiClient';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS, SIZES, FONTS } from '../styles/theme';

// --- Constants for Pagination ---
const PAGE_SIZE = 50; // Number of messages to load per request
const CHAT_BG = '#F5F5F5'; // Modern, light gray chat background
const BORDER_COLOR = '#E0E0E0'; 

// --- Helper: Format dates like WhatsApp ---
const formatChatDate = (date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const isSameDay = (d1, d2) => 
        d1.getDate() === d2.getDate() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getFullYear() === d2.getFullYear();

    if (isSameDay(date, today)) return 'Today';
    if (isSameDay(date, yesterday)) return 'Yesterday';
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
};

const ChatScreen = () => {
    const route = useRoute();
    const headerHeight = useHeaderHeight();
    const { roomId } = route.params;
    const { userId, username } = useAuth();
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

    // Initial Socket connection logging (preserved)
    useEffect(() => {
        if (socket.current) {
            socket.current.on('connect', () => console.log('✅ Socket connected to server'));
            socket.current.on('disconnect', (reason) => console.log('❌ Socket disconnected:', reason));
            socket.current.on('connect_error', (err) => console.log('⚠️ Socket connect_error:', err.message));
        }
    }, [socket]);

    // --- Helper for day comparison (preserved) ---
    const isSameDay = (d1, d2) => 
        d1.getDate() === d2.getDate() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getFullYear() === d2.getFullYear();

    // --- Process messages into display format with date separators (preserved) ---
    const processMessagesForDisplay = useCallback((rawMessages) => {
        const displayItems = [];
        let lastDate = null;

        // FlatList is inverted, so we process latest to oldest, but the input must be sorted oldest to latest
        const sorted = [...rawMessages].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        sorted.forEach(msg => {
            const messageDate = new Date(msg.createdAt);
            if (!lastDate || !isSameDay(lastDate, messageDate)) {
                displayItems.push({ 
                    _id: `date-${messageDate.getTime()}`, 
                    type: 'dateSeparator', 
                    date: messageDate 
                });
                lastDate = messageDate;
            }
            displayItems.push({ ...msg, type: 'message' });
        });

        // The FlatList is inverted, so we reverse the display order
        return displayItems.reverse();
    }, []);

    // ⚡ OPTIMIZATION: Load previous pages of messages (preserved)
    const loadPreviousMessages = useCallback(async () => {
        if (!hasMoreMessages || isPaginating || isLoadingInitial) return;
        
        setIsPaginating(true);
        
        try {
            const params = { limit: PAGE_SIZE };
            if (oldestMessageId) {
                params.beforeId = oldestMessageId;
            }
            
            const response = await apiClient.get(`/chat/${roomId}`, { params });
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

            const newOldestId = formatted.length > 0 
                ? formatted[formatted.length - 1]._id 
                : oldestMessageId;
            
            setOldestMessageId(newOldestId);
            setHasMoreMessages(hasMore);

            setMessages(prev => {
                const existingRaw = prev.filter(m => m.type === 'message').reverse(); 
                const combinedRaw = [...existingRaw, ...formatted]; 
                return processMessagesForDisplay(combinedRaw);
            });

        } catch (err) {
            console.error("Failed to load previous messages:", err);
        } finally {
            setIsPaginating(false);
        }
    }, [roomId, oldestMessageId, hasMoreMessages, isPaginating, isLoadingInitial, processMessagesForDisplay]);


    // ⚡ OPTIMIZATION: Initial load only fetches the first page (preserved)
    useEffect(() => {
        const fetchFirstPage = async () => {
            try {
                setIsLoadingInitial(true);
                const response = await apiClient.get(`/chat/${roomId}`, { params: { limit: PAGE_SIZE } });
                const { messages: rawMessages, hasMore } = response.data;
                
                if (!rawMessages) return;

                const formatted = rawMessages.map(msg => ({
                    ...msg,
                    createdAt: new Date(msg.createdAt),
                    user: typeof msg.user === 'string' ? JSON.parse(msg.user) : msg.user || { _id: null, name: 'Unknown' },
                }));

                const newOldestId = formatted.length > 0 
                    ? formatted[formatted.length - 1]._id 
                    : null;
                
                setOldestMessageId(newOldestId);
                setHasMoreMessages(hasMore);
                setMessages(processMessagesForDisplay(formatted));
                
            } catch (err) {
                console.error("Failed to fetch chat history:", err);
            } finally {
                setIsLoadingInitial(false);
            }
        };
        fetchFirstPage();
    }, [roomId, processMessagesForDisplay]);


    // --- Real-time socket handling (preserved) ---
    useEffect(() => {
        if (!socket.current) return;

        const chatRoomName = `chat-${roomId}`;
        socket.current.emit('join_room', chatRoomName);

        const onReceiveMessage = (newMessage) => {
            const formatted = { 
                ...newMessage, 
                createdAt: new Date(newMessage.createdAt),
                user: typeof newMessage.user === 'string' ? JSON.parse(newMessage.user) : newMessage.user,
            };

            setMessages(prev => {
                let prevMessagesRaw = prev.filter(m => m.type === 'message').reverse(); 
                prevMessagesRaw.push(formatted); 
                return processMessagesForDisplay(prevMessagesRaw);
            });
        };
        
        socket.current.on('receive_message', onReceiveMessage);
        return () => {
            socket.current.off('receive_message', onReceiveMessage);
        };
    }, [socket, roomId, processMessagesForDisplay]);


    // --- Handle sending (preserved) ---
    const handleSend = useCallback(() => {
        if (text.trim() === '' || !socket.current) return;

        const messageData = {
            text,
            createdAt: new Date().toISOString(), // Use ISO string for transport
            user: { _id: Number(userId), name: username },
        };

        socket.current.emit('send_message', {
            roomId: `chat-${roomId}`,
            senderId: userId,
            messageText: text,
            user: messageData.user
        });

        setText('');
    }, [text, userId, username, roomId, socket]);


    // --- Render each item (MODIFIED UI) ---
    const renderItem = ({ item }) => {
        if (item.type === 'dateSeparator') {
            return (
                <View style={styles.dateSeparatorContainer} key={item._id}>
                    <Text style={styles.dateSeparatorText}>{formatChatDate(item.date)}</Text>
                </View>
            );
        }

        const isMyMessage = item.user && (item.user._id === Number(userId) || item.user.id === Number(userId));
        const timeString = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return (
            <View style={[styles.messageRow, { justifyContent: isMyMessage ? 'flex-end' : 'flex-start' }]}>
                <View style={[
                    styles.messageBubble, 
                    isMyMessage ? styles.myMessageBubble : styles.theirMessageBubble
                ]}>
                    {!isMyMessage && item.user && (
                        <Text style={styles.username}>{item.user.name}</Text>
                    )}
                    <Text style={isMyMessage ? styles.myMessageText : styles.theirMessageText}>{item.text}</Text>
                    <View style={styles.timestampWrapper}>
                        <Text style={isMyMessage ? styles.myTimestamp : styles.theirTimestamp}>
                            {timeString}
                        </Text>
                        {isMyMessage && (
                            <Icon 
                                name="checkmark-done" 
                                size={14} 
                                color={COLORS.textInverse} 
                                style={{ marginLeft: 4, opacity: 0.8 }} 
                            />
                        )}
                    </View>
                </View>
            </View>
        );
    };
    
    // --- Render list footer (MODIFIED UI) ---
    const renderListFooter = () => {
        if (isLoadingInitial) return null;
        if (!hasMoreMessages) return <View style={styles.endOfHistory}><Text style={styles.endOfHistoryText}>- Start of chat history -</Text></View>;

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
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={headerHeight + (Platform.OS === 'android' ? SIZES.base : 0)}
        >
            <FlatList
                ref={flatListRef}
                style={styles.messageList}
                data={messages}
                keyExtractor={(item) => item._id.toString()}
                renderItem={renderItem}
                inverted
                contentContainerStyle={styles.flatListContentContainer}
                
                onEndReached={loadPreviousMessages}
                onEndReachedThreshold={0.5} 
                ListFooterComponent={renderListFooter}
                
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No messages yet. Be the first to say something!</Text>
                    </View>
                }
            />
            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    value={text}
                    onChangeText={setText}
                    placeholder="Message..."
                    placeholderTextColor={COLORS.textSecondary}
                    multiline
                    maxHeight={100}
                    textAlignVertical="center"
                />
                <TouchableOpacity 
                    style={[styles.sendButton, { opacity: text.trim().length > 0 ? 1 : 0.6 }]} 
                    onPress={handleSend} 
                    disabled={text.trim().length === 0}
                >
                    <Icon name="send" size={20} color={COLORS.textInverse} />
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
};

// --- Styles (MODIFIED) ---
const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: CHAT_BG, 
        paddingTop: SIZES.base 
    },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: SIZES.padding * 2 },
    emptyText: { ...FONTS.body, color: COLORS.textSecondary, textAlign: 'center' },
    messageList: { flex: 1, paddingHorizontal: SIZES.base }, 
    flatListContentContainer: { paddingVertical: SIZES.base },
    messageRow: { flexDirection: 'row', marginVertical: 2, paddingHorizontal: SIZES.base },
    
    // --- Message Bubble Styles ---
    messageBubble: { 
        maxWidth: '85%', 
        borderRadius: 12, 
        paddingVertical: 8, 
        paddingHorizontal: 12, 
        marginVertical: 2,
        shadowColor: '#000', 
        shadowOpacity: 0.05, 
        shadowRadius: 1, 
        elevation: 1,
    },
    myMessageBubble: { 
        alignSelf: 'flex-end', 
        backgroundColor: COLORS.primary,
        borderBottomRightRadius: 2, 
        borderTopRightRadius: 12,
        borderBottomLeftRadius: 12,
        borderTopLeftRadius: 12,
    },
    theirMessageBubble: { 
        alignSelf: 'flex-start', 
        backgroundColor: COLORS.surface,
        borderBottomLeftRadius: 2, 
        borderTopRightRadius: 12,
        borderBottomRightRadius: 12,
        borderTopLeftRadius: 12,
        
    },
    
    // --- Text Styles ---
    username: { 
        ...FONTS.caption, 
        fontWeight: 'bold', 
        color: COLORS.primaryDark,
        marginBottom: 2,
        fontSize: 12 
    },
    myMessageText: { 
        ...FONTS.body, 
        fontSize: 15.5, 
        color: COLORS.textInverse 
    },
    theirMessageText: { 
        ...FONTS.body, 
        fontSize: 15.5,
        color: COLORS.textPrimary 
    },
    
    // --- Timestamp Styles ---
    timestampWrapper: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'flex-end', 
        marginTop: 4, 
        marginLeft: 10, 
        minWidth: 50 
    },
    myTimestamp: { 
        ...FONTS.caption, 
        fontSize: 10, 
        color: COLORS.textInverse, 
        opacity: 0.8 
    },
    theirTimestamp: { 
        ...FONTS.caption, 
        fontSize: 10, 
        color: COLORS.textSecondary,
        opacity: 0.8
    },
    
    // --- Input Area Styles ---
    inputContainer: { 
        flexDirection: 'row', 
        padding: SIZES.base, 
        borderTopWidth: 1, 
        borderTopColor: BORDER_COLOR, 
        backgroundColor: COLORS.background, 
        alignItems: 'flex-end' 
    },
    input: { 
        flex: 1, 
        minHeight: 40, 
        ...FONTS.body, 
        fontSize: 16, 
        paddingHorizontal: SIZES.padding, 
        paddingTop: 12, 
        paddingBottom: 12, 
        marginRight: SIZES.base, 
        backgroundColor: COLORS.surface,
        borderColor: BORDER_COLOR, 
        borderWidth: 1, 
        borderRadius: 25, 
        color: COLORS.textPrimary 
    },
    sendButton: { 
        width: 48, 
        height: 48, 
        borderRadius: 24, 
        backgroundColor: COLORS.primary, 
        justifyContent: 'center', 
        alignItems: 'center' 
    },
    
    // --- Date Separator Styles ---
    dateSeparatorContainer: { marginVertical: 8, alignItems: 'center' },
    dateSeparatorText: { 
        backgroundColor: BORDER_COLOR, 
        color: COLORS.textSecondary, 
        ...FONTS.caption, 
        fontSize: 12, 
        paddingVertical: 4, 
        paddingHorizontal: 12, 
        borderRadius: 20
    },
    
    // --- Pagination/End of History Styles ---
    paginationLoader: { paddingVertical: SIZES.padding, alignItems: 'center' },
    endOfHistory: { paddingVertical: SIZES.padding, alignItems: 'center' },
    endOfHistoryText: { ...FONTS.caption, color: COLORS.textSecondary, opacity: 0.6 },
    loadMoreButton: { 
        backgroundColor: COLORS.primaryLight, 
        paddingVertical: SIZES.base, 
        paddingHorizontal: SIZES.padding,
        borderRadius: SIZES.radius * 2 
    },
    loadMoreText: { ...FONTS.body, fontSize: 13, color: COLORS.primary, fontWeight: '600' }
});

export default ChatScreen;