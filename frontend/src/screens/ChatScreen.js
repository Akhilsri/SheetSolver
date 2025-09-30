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

    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const flatListRef = useRef(null);

    // --- Helper for day comparison ---
    const isSameDay = (d1, d2) => 
        d1.getDate() === d2.getDate() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getFullYear() === d2.getFullYear();

    // --- Process messages into display format with date separators ---
    const processMessagesForDisplay = useCallback((rawMessages) => {
        const displayItems = [];
        let lastDate = null;

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

        return displayItems.reverse();
    }, []);

    // --- Fetch chat history ---
    useEffect(() => {
        const fetchHistory = async () => {
            try {
                setIsLoading(true);
                const response = await apiClient.get(`/chat/${roomId}`);
                const formatted = response.data.map(msg => ({
                    ...msg,
                    createdAt: new Date(msg.createdAt),
                    user: typeof msg.user === 'string' ? JSON.parse(msg.user) : msg.user || { _id: null, name: 'Unknown' },
                }));
                setMessages(processMessagesForDisplay(formatted));
            } catch (err) {
                console.error("Failed to fetch chat history:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchHistory();
    }, [roomId, processMessagesForDisplay]);

    // --- Real-time socket handling ---
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
                const updatedRaw = [formatted, ...prev.filter(m => m.type === 'message')];
                return processMessagesForDisplay(updatedRaw);
            });
        };
        socket.current.on('receive_message', onReceiveMessage);

        return () => {
            socket.current.off('receive_message', onReceiveMessage);
            socket.current.emit('leave_room', chatRoomName);
        };
    }, [roomId, socket, processMessagesForDisplay]);

    // --- Scroll to bottom when messages update ---
    useEffect(() => {
        const timer = setTimeout(() => {
            if (messages.length > 0 && flatListRef.current) {
                flatListRef.current.scrollToOffset({ offset: 0, animated: true });
            }
        }, 100);
        return () => clearTimeout(timer);
    }, [messages]);

    // --- Handle sending ---
    const handleSend = useCallback(() => {
        if (text.trim() === '' || !socket.current) return;

        const messageData = {
            _id: Math.random().toString(),
            text,
            createdAt: new Date(),
            user: { _id: Number(userId), name: username },
            type: 'message',
        };

        socket.current.emit('send_message', {
            roomId: `chat-${roomId}`,
            senderId: userId,
            messageText: text,
            ...messageData 
        });

        setMessages(prev => {
            const updatedRaw = [messageData, ...prev.filter(m => m.type === 'message')];
            return processMessagesForDisplay(updatedRaw);
        });
        setText('');
    }, [text, userId, username, roomId, socket, processMessagesForDisplay]);

    // --- Render each item ---
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
                <View style={[styles.messageBubble, isMyMessage ? styles.myMessageBubble : styles.theirMessageBubble]}>
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
                                name="checkmark-done-outline" 
                                size={14} 
                                color={COLORS.surface} 
                                style={{ marginLeft: 4, opacity: 0.7 }} 
                            />
                        )}
                    </View>
                </View>
            </View>
        );
    };

    if (isLoading) {
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
                    placeholder="Type a message..."
                    placeholderTextColor={COLORS.textSecondary}
                    multiline
                    maxHeight={100}
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

// --- Styles ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background, paddingTop: SIZES.padding },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: SIZES.padding * 2 },
    emptyText: { ...FONTS.body, color: COLORS.textSecondary, textAlign: 'center' },
    messageList: { flex: 1, paddingHorizontal: SIZES.padding / 2 },
    flatListContentContainer: { paddingVertical: SIZES.base },
    messageRow: { flexDirection: 'row', marginVertical: 4 },
    messageBubble: { 
        maxWidth: '75%', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, marginVertical: 2,
        shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 
    },
    myMessageBubble: { alignSelf: 'flex-end', backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
    theirMessageBubble: { alignSelf: 'flex-start', backgroundColor: COLORS.surface, borderBottomLeftRadius: 4 },
    username: { ...FONTS.caption, fontWeight: 'bold', color: COLORS.textSecondary, marginBottom: 2 },
    myMessageText: { ...FONTS.body, fontSize: 15, color: COLORS.textInverse },
    theirMessageText: { ...FONTS.body, fontSize: 15, color: COLORS.textPrimary },
    timestampWrapper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
    myTimestamp: { ...FONTS.caption, fontSize: 11, color: COLORS.textInverse, opacity: 0.7 },
    theirTimestamp: { ...FONTS.caption, fontSize: 11, color: COLORS.textSecondary },
    inputContainer: { flexDirection: 'row', padding: SIZES.base, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.background, alignItems: 'flex-end' },
    input: { 
        flex: 1, minHeight: 40, ...FONTS.body, fontSize: 16, paddingHorizontal: SIZES.padding, 
        paddingVertical: Platform.OS === 'ios' ? 12 : 8, marginRight: SIZES.base, backgroundColor: COLORS.surface,
        borderColor: COLORS.border, borderWidth: 1, borderRadius: 25, color: COLORS.textPrimary 
    },
    sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
    dateSeparatorContainer: { marginVertical: 10, alignItems: 'center' },
    dateSeparatorText: { backgroundColor: COLORS.border, color: COLORS.textSecondary, ...FONTS.caption, fontSize: 12, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 15 },
});

export default ChatScreen;
