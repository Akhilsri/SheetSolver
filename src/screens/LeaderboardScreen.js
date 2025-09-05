import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import apiClient from '../api/apiClient';

const LeaderboardScreen = () => {
  const route = useRoute();
  const { roomId } = route.params;

  const [leaderboard, setLeaderboard] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLeaderboard = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get(`/rooms/${roomId}/leaderboard`);
      setLeaderboard(response.data);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchLeaderboard();
    }, [roomId])
  );

  if (isLoading) {
    return <ActivityIndicator size="large" style={styles.centered} />;
  }

  const renderItem = ({ item, index }) => (
    <View style={styles.leaderboardItem}>
      <Text style={[styles.leaderboardRank, index < 3 && styles.topRank]}>{index + 1}</Text>
      
      {/* Container for username and streak */}
      <View style={styles.nameContainer}>
        <Text style={styles.leaderboardName}>{item.username}</Text>
        {/* Conditionally render the streak if it's greater than 0 */}
        {item.currentStreak > 0 && (
          <Text style={styles.streakText}>🔥 {item.currentStreak}</Text>
        )}
      </View>

      <Text style={styles.leaderboardScore}>{item.totalScore} pts</Text>
    </View>
  );

  return (
    <FlatList
      style={styles.container}
      data={leaderboard}
      keyExtractor={(item) => item.userId.toString()}
      renderItem={renderItem}
      ListEmptyComponent={
        <Text style={styles.emptyText}>No scores yet. Start solving!</Text>
      }
    />
  );
};

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#fff' },
  emptyText: { textAlign: 'center', marginTop: 50, color: 'gray' },
  leaderboardItem: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  leaderboardRank: {
    fontSize: 16,
    fontWeight: 'bold',
    width: 40,
    color: '#666',
  },
  topRank: {
    color: '#FFD700', // Gold color for top 3
  },
  nameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  leaderboardName: {
    fontSize: 18,
    // The flex: 1 property from the original style is needed for proper spacing,
    // but because it's inside nameContainer which already has flex: 1, it's not strictly necessary.
    // Keeping the single, correct definition is the main thing.
  },
  leaderboardScore: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007BFF',
  },
  streakText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#FF6347', // A fiery tomato color
  },
});

export default LeaderboardScreen;
