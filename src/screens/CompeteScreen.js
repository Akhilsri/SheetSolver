import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const topics = ['Arrays Part-I', 'Graphs', 'Binary Tree Part-I', 'Dynamic Programming', 'Mixed'];

const CompeteScreen = () => {
  const navigation = useNavigation();
  const { userId, username } = useAuth(); // Get both userId and username
  const socket = useSocket();

  const [status, setStatus] = useState('Choose a topic to find a match!');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!socket.current) return;

    const onMatchFound = (data) => {
      setStatus(`Match found! Joining game...`);
      navigation.replace('GameScreen', { gameDetails: data });
    };
    const onWaiting = () => setStatus('Searching for an opponent...');
    const onError = (data) => {
      Alert.alert('Matchmaking Error', data.message);
      setIsSearching(false);
      setStatus('Choose a topic to find a match!');
    };

    socket.current.on('match_found', onMatchFound);
    socket.current.on('waiting_for_match', onWaiting);
    socket.current.on('match_error', onError);

    return () => {
      socket.current.off('match_found', onMatchFound);
      socket.current.off('waiting_for_match', onWaiting);
      socket.current.off('match_error', onError);
    };
  }, [socket.current]);

  const handleFindMatch = (topic) => {
    if (isSearching || !socket.current) return;
    setIsSearching(true);
    setStatus('Searching...');
    
    // This line is crucial - it sends the username
    socket.current.emit('find_match', { userId, username, topic });
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>{status}</Text>
        {isSearching && <ActivityIndicator size="large" color="#007BFF" style={{marginTop: 20}} />}
      </View>
      <View style={styles.topicContainer}>
        <Text style={styles.title}>Select a Topic to Compete</Text>
        {topics.map(topic => (
          <TouchableOpacity
            key={topic}
            style={[styles.topicButton, isSearching && styles.disabledButton]}
            onPress={() => handleFindMatch(topic)}
            disabled={isSearching}
          >
            <Text style={styles.topicButtonText}>{topic}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
    statusContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    statusText: { fontSize: 20, textAlign: 'center', color: '#333' },
    topicContainer: { flex: 2 },
    title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    topicButton: {
        backgroundColor: '#007BFF',
        padding: 15,
        borderRadius: 8,
        marginBottom: 10,
        alignItems: 'center',
    },
    disabledButton: {
        backgroundColor: '#a0a0a0',
    },
    topicButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default CompeteScreen;