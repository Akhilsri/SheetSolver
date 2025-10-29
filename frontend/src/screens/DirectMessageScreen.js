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
    const socket = useSocket(); // This is the useRef from your context

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

        const sorted = [...rawMessages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

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
                setIsPaginating(false); 
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
                const combinedRaw = [...formatted, ...existingRaw]; 
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
                await apiClient.put(`/chat/direct/${connectionUserId}/read`);
                fetchUnreadMessageCount(); 

                const response = await apiClient.get(`/chat/direct/${connectionUserId}`, { params: { limit: PAGE_SIZE } });
                const { messages: rawMessages, hasMore } = response.data;
                
                if (!rawMessages) {
                    setIsLoadingInitial(false); 
                    return;
                }

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
                
            } catch (error) {
                console.error("Failed to load initial DM history:", error);
            } finally {
                setIsLoadingInitial(false);
            }
        };
        fetchFirstPage();
    }, [connectionUserId, fetchUnreadMessageCount, processMessagesForDisplay]);


    // Socket listener (This is correct)
    useEffect(() => {
        if (!socket.current) {
            return; 
        }
        
        const onReceivePrivateMessage = (newMessage) => {
            if (newMessage.user._id === Number(connectionUserId) || newMessage.user._id === Number(userId)) {
                
                const formatted = {
                    ...newMessage,
                    createdAt: new Date(newMessage.createdAt),
                    type: "message",
                    user: newMessage.user, 
                };
                
                setMessages(prev => {
                    const prevMessagesRaw = prev.filter(m => m.type === "message").reverse(); 
                    prevMessagesRaw.push(formatted);
                    return processMessagesForDisplay(prevMessagesRaw);
                });
            }
        };

        socket.current.on("receive_private_message", onReceivePrivateMessage);
        
        return () => {
            if (socket.current) { 
                socket.current.off("receive_private_message", onReceivePrivateMessage);
            }
        };
    }, [socket, connectionUserId, userId, processMessagesForDisplay]);


    // 🚨 --- THIS IS THE FIX --- 🚨
    const handleSend = useCallback(() => {
        if (text.trim() === '' || !socket.current) return;
        
        const currentMessage = text;
        
        // 1. We NO LONGER add the temporary message to the state here.
        /*
        const tempMessageData = {
             _id: `temp-${Date.now()}`,
             text: currentMessage,
             createdAt: new Date(),
             user: { _id: Number(userId), name: username },
             type: "message",
        };
        setMessages(prev => {
            const rawMsgs = prev.filter(m => m.type === "message").reverse();
            rawMsgs.push(tempMessageData); 
            return processMessagesForDisplay(rawMsgs);
        });
        */
        
        // 2. We ONLY emit the message.
        // The server will echo it back, and our `onReceivePrivateMessage`
        // listener will handle adding it to the state *once*.
        socket.current.emit('send_private_message', {
            senderId: userId,
            recipientId: connectionUserId,
            messageText: currentMessage,
            user: { _id: userId, name: username }
        });
        
        // 3. We still clear the text input.
        setText('');
    }, [text, userId, username, connectionUserId, socket, processMessagesForDisplay]); // processMessagesForDisplay is no longer needed here, but it's harmless


    const renderItem = ({ item }) => {
        if (item.type === "dateSeparator") {
            return (
                <View style={styles.dateSeparatorContainer} key={item._id}>
                    <Text style={styles.dateSeparatorText}>{formatChatDate(item.date)}</Text>
                </View>
            );
        }

        const isMyMessage = item.user && (item.user._id === Number(userId) || (item.user.id && item.user.id === Number(userId)));
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

    const renderListFooter = () => {
        if (isLoadingInitial) return null; 
        if (isPaginating) {
            return (
                <View style={styles.paginationLoader}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                </View>
            );
        }
        if (!hasMoreMessages) {
             return (
                 <View style={styles.endOfHistory}>
                     <Text style={styles.endOfHistoryText}>This is the beginning of your conversation.</Text>
                 </View>
             );
        }
        return null;
    };


    if (isLoadingInitial && messages.length === 0) {
        return <ActivityIndicator size="large" color={COLORS.primary} style={styles.centered} />;
    }

    return (
        <ImageBackground source={{ uri: 'https://res.cloudinary.com/dnrg0ji04/image/upload/v1761507397/chat_bg_uu5ulk.png' }} style={styles.container}>
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
                        onEndReached={loadPreviousMessages}
                        onEndReachedThreshold={0.5} 
                        ListFooterComponent={renderListFooter}
                        ListEmptyComponent={
                            !isLoadingInitial ? (
                                <View style={styles.emptyState}>
                                    <Text style={styles.emptyText}>No messages yet. Say hi 👋</Text>
                                </View>
                            ) : null
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

// ... (Styles are all unchanged) ...
const styles = StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
    dateSeparatorContainer: {
        marginVertical: 10,
        alignItems: 'center',
    },
    dateSeparatorText: {
        backgroundColor: 'rgba(230, 230, 230, 0.8)', 
        color: COLORS.textSecondary,
        ...FONTS.caption,
        fontSize: 12,
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 15,
        overflow: 'hidden', 
    },
    emptyState: { padding: SIZES.padding * 2, alignItems: 'center' },
    emptyText: { ...FONTS.body, color: COLORS.textSecondary, textAlign: 'center' },
    paginationLoader: { paddingVertical: SIZES.padding, alignItems: 'center' },
    endOfHistory: { paddingVertical: SIZES.padding, alignItems: 'center' },
    endOfHistoryText: { ...FONTS.caption, color: COLORS.textSecondary, opacity: 0.8 },
    loadMoreButton: { 
        backgroundColor: COLORS.primaryLight, 
        paddingVertical: SIZES.base, 
        paddingHorizontal: SIZES.padding,
        borderRadius: SIZES.radius * 2 
    },
    loadMoreText: { ...FONTS.body, fontSize: 13, color: COLORS.primary, fontWeight: '600' }
});

export default DirectMessageScreen;