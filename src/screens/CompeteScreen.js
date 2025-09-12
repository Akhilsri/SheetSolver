import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import apiClient from '../api/apiClient';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS, SIZES, FONTS } from '../styles/theme';

// --- 1. Expanded and improved list of Topic Visuals ---
const topicVisuals = {
  'Aptitude': { icon: 'calculator-outline', color: '#17a2b8' },
  'Arrays Part-I': { icon: 'grid-outline', color: '#ff6347' },
  'Strings': { icon: 'text-outline', color: '#ffc107' },
  'Linked List': { icon: 'link-outline', color: '#fd7e14' },
  'Recursion': { icon: 'repeat-outline', color: '#6610f2' },
  'Bit Manipulation': { icon: 'hardware-chip-outline', color: '#20c997' },
  'Stack and Queues': { icon: 'layers-outline', color: '#6f42c1' },
  'Heaps': { icon: 'leaf-outline', color: '#28a745' },
  'Greedy Algorithms': { icon: 'wallet-outline', color: '#17a2b8' },
  'Binary Trees': { icon: 'git-merge-outline', color: '#28a745' },
  'Binary Search Trees': { icon: 'search-circle-outline', color: '#007BFF' },
  'Graphs': { icon: 'git-network-outline', color: '#6f42c1' },
  'Dynamic Programming': { icon: 'infinite-outline', color: '#dc3545' },
  'Tries': { icon: 'at-outline', color: '#343a40' },
  'Mixed': { icon: 'shuffle-outline', color: '#6c757d' },
};

const CompeteScreen = () => {
  const navigation = useNavigation();
  const { userId, username, isLoading: isAuthLoading } = useAuth(); 
  const socket = useSocket();

  const [status, setStatus] = useState('Choose a topic to find a match!');
  const [isSearching, setIsSearching] = useState(false);
  const [topics, setTopics] = useState([]);

  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const response = await apiClient.get('/quiz/topics');
        // We now trust the backend completely and set the topics directly
        setTopics(response.data);
      } catch (error) {
        Alert.alert('Error', 'Could not fetch competition topics.');
      }
    };
    fetchTopics();
  }, []);

  // This useEffect now fetches the topics from your backend
  // useEffect(() => {
  //   const fetchTopics = async () => {
  //     try {
  //       const response = await apiClient.get('/quiz/topics');
  //       setTopics(response.data);
  //     } catch (error) {
  //       Alert.alert('Error', 'Could not fetch competition topics.');
  //     }
  //   };
  //   fetchTopics();
  // }, []);

  useEffect(() => {
    if (!socket.current || isAuthLoading) return;

    // Match found
    const onMatchFound = (data) => {
      setStatus(`Match found! Joining game...`);
      setIsSearching(false);
      navigation.replace('GameScreen', { gameDetails: data });
    };

    // Still waiting
    const onWaiting = () => setStatus('Searching for an opponent...');

    // Error during matchmaking
    const onError = (data) => {
      Alert.alert('Matchmaking Error', data.message || 'Something went wrong.');
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
  }, [socket.current, isAuthLoading]);

  const handleFindMatch = (topic) => {
    if (isSearching || !socket.current) return;

    setIsSearching(true);
    setStatus('Searching...');

    // Emit matchmaking event with user info and topic
    socket.current.emit('find_match', { userId, username, topic });
  };

  if (isAuthLoading) {
    return <ActivityIndicator size="large" style={styles.centered} />;
  }

  const renderTopic = ({ item }) => {
    const visual = topicVisuals[item] || { icon: 'code-slash-outline', color: '#343a40' }; // Default visual
    return (
      <TouchableOpacity
        style={styles.topicCardWrapper}
        onPress={() => handleFindMatch(item)}
        disabled={isSearching}
      >
        <View style={[styles.topicCard, { backgroundColor: visual.color }, isSearching && styles.disabledButton]}>
          <Icon name={visual.icon} size={40} color="white" />
          <Text style={styles.topicButtonText}>{item}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>{status}</Text>
        {isSearching && <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }} />}
      </View>

      <FlatList
        data={topics}
        renderItem={renderTopic}
        keyExtractor={(item) => item}
        numColumns={2}
        ListHeaderComponent={<Text style={styles.title}>Select a Topic</Text>}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statusContainer: {
    padding: SIZES.padding,
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: { ...FONTS.h3, color: COLORS.textSecondary, textAlign: 'center' },
  title: { ...FONTS.h1, textAlign: 'center', paddingVertical: SIZES.padding },
  topicCardWrapper: {
    flex: 1/2, // Each item takes half the width
    padding: SIZES.base,
  },
  topicCard: {
    flex: 1,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 120,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  topicButtonText: {
    ...FONTS.body,
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: SIZES.base,
  },
  disabledButton: {
    backgroundColor: '#a0a0a0',
  },
});

export default CompeteScreen;