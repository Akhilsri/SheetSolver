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

const DirectMessageScreen = () => {
    const route = useRoute();
    const headerHeight = useHeaderHeight();
    const { connectionUserId } = route.params;
    const { userId, username, fetchUnreadMessageCount } = useAuth();
    const socket = useSocket();

    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    // Fetch chat history
    useEffect(() => {
        const loadChat = async () => {
            try {
                setIsLoading(true);
                // Mark messages as read and fetch count
                await apiClient.put(`/chat/direct/${connectionUserId}/read`);
                fetchUnreadMessageCount();

                const response = await apiClient.get(`/chat/direct/${connectionUserId}`);
                const formattedMessages = response.data.map(msg => ({
                    ...msg,
                    createdAt: new Date(msg.createdAt),
                }));
                setMessages(formattedMessages);
            } catch (error) {
                console.error('Failed to load chat:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadChat();
    }, [connectionUserId, fetchUnreadMessageCount]);

    // Socket listener
    useEffect(() => {
        if (!socket.current) return;
        const onReceivePrivateMessage = (newMessage) => {
            // Check if the message is from the user we're currently chatting with
            if (newMessage.user._id === Number(connectionUserId)) {
                setMessages(prev => [
                    { ...newMessage, createdAt: new Date(newMessage.createdAt) },
                    ...prev,
                ]);
            }
        };
        socket.current.on('receive_private_message', onReceivePrivateMessage);
        return () => socket.current.off('receive_private_message', onReceivePrivateMessage);
    }, [socket.current, connectionUserId]);

    const handleSend = useCallback(() => {
        if (text.trim() === '' || !socket.current) return;

        const messageData = {
            _id: Math.random().toString(), // Temp ID for immediate display
            text,
            createdAt: new Date(),
            user: { _id: Number(userId), name: username },
            // Add a temporary 'isSent' status if needed for delivery indicator
        };

        socket.current.emit('send_private_message', {
            senderId: userId,
            recipientId: connectionUserId,
            messageText: text,
            ...messageData,
        });

        setMessages(prev => [messageData, ...prev]);
        setText('');
    }, [text, userId, username, connectionUserId, socket.current]);

    const renderItem = ({ item }) => {
        const isMyMessage = item.user._id === Number(userId);
        
        // Use a fixed timestamp format
        const timeString = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return (
            <View style={[
                chatStyles.messageRow,
                { justifyContent: isMyMessage ? 'flex-end' : 'flex-start' }
            ]}>
                <View style={[
                    chatStyles.messageBubble,
                    // Apply distinct background colors and border radii
                    isMyMessage ? chatStyles.myMessage : chatStyles.theirMessage
                ]}>
                    <Text style={chatStyles.messageText}>{item.text}</Text>
                    <View style={chatStyles.timestampWrapper}>
                        <Text style={chatStyles.timestamp}>
                            {timeString}
                        </Text>
                        {isMyMessage && (
                            // Read/Sent indicator (using a common color like light grey for visibility)
                            <Icon 
                                name="checkmark-done-outline" 
                                size={14} 
                                color={COLORS.textSecondary} 
                                style={{ marginLeft: 4 }} 
                            />
                        )}
                    </View>
                </View>
            </View>
        );
    };

    if (isLoading) {
        return <ActivityIndicator size="large" color={COLORS.primary} style={chatStyles.centered} />;
    }

    return (
        // Note: ImageBackground might need custom styling depending on the image used.
        <ImageBackground source={require('../assets/images/chat_bg.png')} style={chatStyles.container}>
            <SafeAreaView style={{ flex: 1 }}>
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={headerHeight + 10}
                >
                    <FlatList
                        data={messages}
                        inverted
                        keyExtractor={(item) => item._id.toString()}
                        renderItem={renderItem}
                        contentContainerStyle={{ padding: SIZES.padding }}
                        ListEmptyComponent={
                            <View style={chatStyles.emptyState}>
                                <Text style={chatStyles.emptyText}>No messages yet. Say hi 👋</Text>
                            </View>
                        }
                    />

                    {/* Input Bar */}
                    <View style={chatStyles.inputBar}>
                        <TextInput
                            style={chatStyles.input}
                            value={text}
                            onChangeText={setText}
                            placeholder="Type a message..."
                            placeholderTextColor={COLORS.textSecondary}
                            multiline
                            maxHeight={120} // Enforce max height for multiline input
                        />
                        <TouchableOpacity 
                            style={[
                                chatStyles.sendButton, 
                                { opacity: text.trim().length > 0 ? 1 : 0.6 } // Dim button when empty
                            ]} 
                            onPress={handleSend} 
                            disabled={text.trim().length === 0}
                        >
                            <Icon name="send" size={20} color={COLORS.textInverse} />
                        </TouchableOpacity>
                    </View>

                </KeyboardAvoidingView>
            </SafeAreaView>
        </ImageBackground>
    );
};

const chatStyles = StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // --- Message Bubbles ---
    messageRow: { 
        marginVertical: 6, 
        flexDirection: 'row', 
        paddingHorizontal: SIZES.base, // Add slight horizontal padding for margin from screen edge
    },
    messageBubble: {
        maxWidth: '80%', // Increased from 75% for more realistic chat width
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 18,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    // Message sent by the user (Right side)
    myMessage: { 
        backgroundColor: COLORS.primary, // Use the primary theme color
        borderTopRightRadius: 6, 
        borderBottomRightRadius: 6,
        borderBottomLeftRadius: 18, 
        borderTopLeftRadius: 18,
    },
    // Message received from the other person (Left side)
    theirMessage: { 
        backgroundColor: COLORS.surface, // Use white/light background for contrast
        borderTopLeftRadius: 6, 
        borderBottomLeftRadius: 6,
        borderBottomRightRadius: 18,
        borderTopRightRadius: 18,
    },
    messageText: { 
        ...FONTS.body, 
        fontSize: 15,
        color: COLORS.textPrimary, // Dark text on both bubbles, as 'myMessage' is dark enough
    },
    // Adjust text color for your messages if primary color is dark
    myMessageText: {
        color: COLORS.textInverse, // White text for your message
    },
    timestampWrapper: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'flex-end', // Ensure time is right-aligned inside the bubble
        marginTop: 4 
    },
    timestamp: { 
        ...FONTS.caption, 
        fontSize: 10, 
        color: COLORS.textSecondary,
    },

    // --- Input Bar ---
    inputBar: {
        flexDirection: 'row',
        alignItems: 'flex-end', // Aligns with multiline input expansion
        marginHorizontal: SIZES.padding,
        marginBottom: SIZES.base,
        backgroundColor: COLORS.surface,
        borderRadius: 25,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingRight: 6, // Space for the floating button effect
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    input: {
        flex: 1,
        fontSize: 16,
        paddingHorizontal: SIZES.padding,
        paddingTop: 10, // Adjust padding to center single line text
        paddingBottom: 10,
        ...FONTS.body,
        color: COLORS.textPrimary,
        minHeight: 48, // Minimum height for comfortable tapping
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: 4, // Center vertically within the bar
    },

    // Empty state
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', height: '100%' },
    emptyText: { ...FONTS.body, color: COLORS.textSecondary, textAlign: 'center' },
});

export default DirectMessageScreen;