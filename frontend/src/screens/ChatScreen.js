import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, Button, StyleSheet, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import apiClient from '../api/apiClient';

const ChatScreen = () => {
  const route = useRoute();
  const { roomId } = route.params;
  const { userId, username } = useAuth();
  const socket = useSocket();

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Effect #1: Fetches initial chat history
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setIsLoading(true);
        const response = await apiClient.get(`/chat/${roomId}`);
        const formattedMessages = response.data.map(msg => ({
          ...msg,
          createdAt: new Date(msg.createdAt),
        }));
        setMessages(formattedMessages);
      } catch (error) {
        console.error("Failed to fetch chat history:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, [roomId]);

  // Effect #2: Manages real-time socket events
  useEffect(() => {
    if (!socket.current) return;

    const chatRoomName = `chat-${roomId}`;
    socket.current.emit('join_room', chatRoomName);

    const onReceiveMessage = (newMessage) => {
      const formattedMessage = { ...newMessage, createdAt: new Date(newMessage.createdAt) };
      setMessages(previousMessages => [formattedMessage, ...previousMessages]);
    };
    socket.current.on('receive_message', onReceiveMessage);

    return () => {
      socket.current.off('receive_message', onReceiveMessage);
    };
  }, [roomId, socket.current]);

  const handleSend = () => {
    if (text.trim() === '' || !socket.current) return;

    const messageData = {
      _id: Math.random().toString(),
      text: text,
      createdAt: new Date(),
      user: { _id: Number(userId), name: username },
    };

    socket.current.emit('send_message', {
      roomId: `chat-${roomId}`,
      senderId: userId,
      messageText: text,
      ...messageData
    });

    setMessages(previousMessages => [messageData, ...previousMessages]);
    setText('');
  };

  const renderItem = ({ item }) => {
    const isMyMessage = item.user._id === Number(userId);
    return (
      <View style={[ styles.messageBubble, isMyMessage ? styles.myMessageBubble : styles.theirMessageBubble ]}>
        {!isMyMessage && <Text style={styles.username}>{item.user.name}</Text>}
        <Text style={isMyMessage ? styles.myMessageText : styles.theirMessageText}>{item.text}</Text>
        <Text style={isMyMessage ? styles.myTimestamp : styles.theirTimestamp}>
          {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };
  
  if (isLoading) {
      return <ActivityIndicator size="large" style={styles.centered} />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      <FlatList
        style={styles.messageList}
        data={messages}
        keyExtractor={(item) => item._id.toString()}
        renderItem={renderItem}
        inverted
        ListEmptyComponent={<Text style={styles.emptyText}>No messages yet. Be the first to say something!</Text>}
      />
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Type a message..."
        />
        <Button title="Send" onPress={handleSend} />
      </View>
    </KeyboardAvoidingView>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { textAlign: 'center', marginTop: 50, color: 'gray' },
  messageList: { flex: 1, paddingHorizontal: 10 },
  inputContainer: { flexDirection: 'row', padding: 10, borderTopWidth: 1, borderTopColor: '#ddd', backgroundColor: 'white' },
  input: { flex: 1, height: 40, borderColor: '#ccc', borderWidth: 1, borderRadius: 20, paddingHorizontal: 15, marginRight: 10, backgroundColor: 'white' },
  messageBubble: { maxWidth: '80%', borderRadius: 15, paddingVertical: 8, paddingHorizontal: 12, marginVertical: 4 },
  myMessageBubble: { alignSelf: 'flex-end', backgroundColor: '#007BFF' },
  theirMessageBubble: { alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#e5e5ea' },
  username: { fontSize: 12, fontWeight: 'bold', color: '#666', marginBottom: 2 },
  myMessageText: { fontSize: 16, color: 'white' },
  theirMessageText: { fontSize: 16, color: 'black' },
  myTimestamp: { fontSize: 10, alignSelf: 'flex-end', marginTop: 2, color: '#e0e0e0' },
  theirTimestamp: { fontSize: 10, alignSelf: 'flex-end', marginTop: 2, color: '#999' },
});

export default ChatScreen;