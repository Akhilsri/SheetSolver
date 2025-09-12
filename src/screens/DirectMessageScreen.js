import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TextInput, Button, StyleSheet, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, TouchableOpacity,ImageBackground } from 'react-native';
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
  const { connectionUserId, connectionUsername } = route.params; // Get the user we are chatting with
  const { userId, username } = useAuth(); // Get the current logged-in user
  const socket = useSocket();

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Effect #1: Fetches the initial chat history for this specific conversation
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setIsLoading(true);
        // KEY DIFFERENCE: Call the new 'direct' chat history endpoint
        const response = await apiClient.get(`/chat/direct/${connectionUserId}`);
        const formattedMessages = response.data.map(msg => ({
          ...msg,
          createdAt: new Date(msg.createdAt),
        }));
        setMessages(formattedMessages);
      } catch (error) {
        console.error("Failed to fetch direct message history:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, [connectionUserId]);

  // Effect #2: Manages real-time socket events for private messages
  useEffect(() => {
    if (!socket.current) return;

    // KEY DIFFERENCE: Listen for 'receive_private_message'
    const onReceivePrivateMessage = (newMessage) => {
      // Only add the message if it's from the person we're currently chatting with
      if (newMessage.user._id === Number(connectionUserId)) {
        const formattedMessage = { ...newMessage, createdAt: new Date(newMessage.createdAt) };
        setMessages(previousMessages => [formattedMessage, ...previousMessages]);
      }
    };
    socket.current.on('receive_private_message', onReceivePrivateMessage);

    // Clean up the listener when the screen is left
    return () => {
      socket.current.off('receive_private_message', onReceivePrivateMessage);
    };
  }, [socket.current, connectionUserId]);

  const handleSend = () => {
    if (text.trim() === '' || !socket.current) return;

    const messageData = {
      _id: Math.random().toString(),
      text: text,
      createdAt: new Date(),
      user: { _id: Number(userId), name: username },
    };

    // KEY DIFFERENCE: Emit 'send_private_message' with the recipient's ID
    socket.current.emit('send_private_message', {
      senderId: userId,
      recipientId: connectionUserId,
      messageText: text,
      ...messageData
    });

    setMessages(previousMessages => [messageData, ...previousMessages]);
    setText('');
  };

  const renderItem = ({ item }) => {
    const isMyMessage = item.user._id === Number(userId);
    return (
      <View style={[ styles.messageRow, { justifyContent: isMyMessage ? 'flex-end' : 'flex-start' } ]}>
        <View style={[styles.messageBubble, isMyMessage ? styles.myMessageBubble : styles.theirMessageBubble]}>
          <Text style={isMyMessage ? styles.myMessageText : styles.theirMessageText}>{item.text}</Text>
          <View style={styles.timestampContainer}>
            <Text style={isMyMessage ? styles.myTimestamp : styles.theirTimestamp}>
              {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isMyMessage && <Icon name="checkmark-done-outline" size={16} color={isMyMessage ? COLORS.primaryLight : COLORS.textSecondary} style={{opacity: 0.8}}/>}
          </View>
        </View>
      </View>
    );
  };
  
  if (isLoading) {
    return <ActivityIndicator size="large" style={styles.centered} />;
  }

  return (
    <ImageBackground source={require('../assets/images/chat_bg.png')} style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={headerHeight}
      >
        <FlatList
          style={styles.messageList}
          contentContainerStyle={{ paddingVertical: SIZES.base }}
          data={messages}
          keyExtractor={(item) => item._id.toString()}
          renderItem={renderItem}
          inverted
          ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>No messages yet. Send the first message!</Text></View>}
        />
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Type a message..."
            placeholderTextColor={COLORS.textSecondary}
            multiline
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
            <Icon name="paper-plane" size={22} color={COLORS.surface} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
};

// We can reuse the exact same styles from our Room Chat screen
const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', transform: [{ scaleY: -1 }] }, // Inverted for FlatList
  emptyText: { ...FONTS.caption, backgroundColor: '#00000020', padding: SIZES.base, borderRadius: SIZES.radius },
  messageList: { flex: 1, paddingHorizontal: SIZES.base * 2 },
  inputContainer: {
    flexDirection: 'row', paddingVertical: SIZES.base, paddingHorizontal: SIZES.base,
    alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  input: {
    flex: 1, ...FONTS.body, backgroundColor: COLORS.surface, borderRadius: 22,
    paddingHorizontal: SIZES.padding, paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    maxHeight: 120, marginRight: SIZES.base, borderWidth: 1, borderColor: COLORS.border,
  },
  sendButton: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center', elevation: 2,
  },
  messageRow: { marginVertical: 4 },
  messageBubble: {
    maxWidth: '80%', borderRadius: SIZES.radius, paddingVertical: SIZES.base,
    paddingHorizontal: SIZES.base * 1.5, elevation: 1,
  },
  myMessageBubble: {
    alignSelf: 'flex-end', backgroundColor: '#DCF8C6',
    borderBottomRightRadius: SIZES.base / 2,
  },
  theirMessageBubble: {
    alignSelf: 'flex-start', backgroundColor: COLORS.surface,
    borderBottomLeftRadius: SIZES.base / 2,
  },
  myMessageText: { ...FONTS.body, color: COLORS.textPrimary },
  theirMessageText: { ...FONTS.body, color: COLORS.textPrimary },
  timestampContainer: {
    flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center',
    marginTop: 4,
  },
  myTimestamp: { ...FONTS.caption, fontSize: 11, color: COLORS.textSecondary, opacity: 0.7, marginRight: 4 },
  theirTimestamp: { ...FONTS.caption, fontSize: 11, color: COLORS.textSecondary },
});

export default DirectMessageScreen;