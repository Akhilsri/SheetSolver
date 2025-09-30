import React, { useState, useEffect, useCallback } from 'react';
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

    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    // --- Insert date separators into raw messages ---
    const processMessagesForDisplay = useCallback((rawMessages) => {
        const displayItems = [];
        let lastDate = null;

        const sorted = [...rawMessages].sort((a, b) => a.createdAt - b.createdAt);

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

    // Fetch chat history
    useEffect(() => {
        const loadChat = async () => {
            try {
                setIsLoading(true);
                await apiClient.put(`/chat/direct/${connectionUserId}/read`);
                fetchUnreadMessageCount();

                const response = await apiClient.get(`/chat/direct/${connectionUserId}`);
                const formatted = response.data.map(msg => ({
                    ...msg,
                    createdAt: new Date(msg.createdAt),
                    user: typeof msg.user === "string" ? JSON.parse(msg.user) : msg.user,
                }));
                setMessages(processMessagesForDisplay(formatted));
            } catch (error) {
                console.error("Failed to load chat:", error);
            } finally {
                setIsLoading(false);
            }
        };
        loadChat();
    }, [connectionUserId, fetchUnreadMessageCount, processMessagesForDisplay]);

    // Socket listener
    useEffect(() => {
        if (!socket.current) return;
        const onReceivePrivateMessage = (newMessage) => {
            if (newMessage.user._id === Number(connectionUserId)) {
                const formatted = {
                    ...newMessage,
                    createdAt: new Date(newMessage.createdAt),
                    type: "message"
                };
                setMessages(prev => {
                    const rawMsgs = [formatted, ...prev.filter(m => m.type === "message")];
                    return processMessagesForDisplay(rawMsgs);
                });
            }
        };
        socket.current.on("receive_private_message", onReceivePrivateMessage);
        return () => socket.current.off("receive_private_message", onReceivePrivateMessage);
    }, [socket.current, connectionUserId, processMessagesForDisplay]);

    const handleSend = useCallback(() => {
        if (text.trim() === '' || !socket.current) return;
        const messageData = {
            _id: Math.random().toString(),
            text,
            createdAt: new Date(),
            user: { _id: Number(userId), name: username },
            type: "message"
        };
        socket.current.emit('send_private_message', {
            senderId: userId,
            recipientId: connectionUserId,
            messageText: text,
            ...messageData,
        });
        setMessages(prev => {
            const rawMsgs = [messageData, ...prev.filter(m => m.type === "message")];
            return processMessagesForDisplay(rawMsgs);
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

    if (isLoading) {
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
                        data={messages}
                        inverted
                        keyExtractor={(item) => item._id.toString()}
                        renderItem={renderItem}
                        contentContainerStyle={{ padding: SIZES.base }}
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
});

export default DirectMessageScreen;
