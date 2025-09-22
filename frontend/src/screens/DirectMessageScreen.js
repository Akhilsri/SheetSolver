import React, { useState, useEffect } from 'react';
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
  }, [connectionUserId]);

  // Socket listener
  useEffect(() => {
    if (!socket.current) return;
    const onReceivePrivateMessage = (newMessage) => {
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

  const handleSend = () => {
    if (text.trim() === '' || !socket.current) return;

    const messageData = {
      _id: Math.random().toString(),
      text,
      createdAt: new Date(),
      user: { _id: Number(userId), name: username },
    };

    socket.current.emit('send_private_message', {
      senderId: userId,
      recipientId: connectionUserId,
      messageText: text,
      ...messageData,
    });

    setMessages(prev => [messageData, ...prev]);
    setText('');
  };

  const renderItem = ({ item }) => {
    const isMyMessage = item.user._id === Number(userId);
    return (
      <View style={[
        styles.messageRow,
        { justifyContent: isMyMessage ? 'flex-end' : 'flex-start' }
      ]}>
        <View style={[
          styles.messageBubble,
          isMyMessage ? styles.myMessage : styles.theirMessage
        ]}>
          <Text style={styles.messageText}>{item.text}</Text>
          <View style={styles.timestampWrapper}>
            <Text style={styles.timestamp}>
              {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isMyMessage && (
              <Icon name="checkmark-done-outline" size={14} color={COLORS.textSecondary} style={{ marginLeft: 4 }} />
            )}
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
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No messages yet. Say hi 👋</Text>
              </View>
            }
          />

          {/* Floating Input Bar */}
          <View style={styles.inputBar}>
  <TextInput
    style={styles.input}
    value={text}
    onChangeText={setText}
    placeholder="Type a message..."
    placeholderTextColor="#999"
    multiline
  />
  <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
    <Icon name="send" size={20} color="#fff" />
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

  // Messages
  messageRow: { marginVertical: 6, flexDirection: 'row' },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  myMessage: { backgroundColor: '#DCF8C6', borderBottomRightRadius: 6 },
  theirMessage: { backgroundColor: COLORS.surface, borderBottomLeftRadius: 6 },
  messageText: { ...FONTS.body, color: COLORS.textPrimary },
  timestampWrapper: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  timestamp: { ...FONTS.caption, fontSize: 11, color: COLORS.textSecondary },

  // Input
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    margin: SIZES.padding,
    paddingHorizontal: SIZES.padding,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    ...FONTS.body,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },

  // Empty state
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { ...FONTS.body, color: COLORS.textSecondary, textAlign: 'center' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 10,
    backgroundColor: '#fff',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxHeight: 120,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#128C7E', // WhatsApp green
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    marginRight:-10
  },
});

export default DirectMessageScreen;
