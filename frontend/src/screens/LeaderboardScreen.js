import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import apiClient from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS, SIZES, FONTS } from '../styles/theme';
import Card from '../components/common/Card';

const LeaderboardScreen = () => {
  const route = useRoute();
  const { roomId } = route.params;
  const { userId } = useAuth();
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

  const topThree = leaderboard.slice(0, 3);
  const restOfRanks = leaderboard.slice(3);
  const myRankIndex = leaderboard.findIndex(item => Number(item.userId) === Number(userId));
  const myRankData = myRankIndex !== -1 ? { ...leaderboard[myRankIndex], rank: myRankIndex + 1 } : null;

  const renderRankItem = ({ item, index }) => (
    <Card style={[styles.rankItem, myRankData?.userId === item.userId && styles.myRankItem]}>
      <Text style={styles.rankText}>{index + 4}</Text>
      <Text style={styles.rankName}>{item.username} {item.currentStreak > 0 && `🔥${item.currentStreak}`}</Text>
      <Text style={styles.rankScore}>{item.totalScore} pts</Text>
    </Card>
  );

  return (
    <FlatList
        style={styles.container}
        data={restOfRanks}
        keyExtractor={(item) => item.userId.toString()}
        renderItem={renderRankItem}
        ListEmptyComponent={
            <View style={styles.centered}>
                <Text style={styles.emptyText}>No scores yet. Start solving!</Text>
            </View>
        }
        // The Podium and "Your Rank" will be in the header of the list
        ListHeaderComponent={
            <>
                {/* --- PODIUM for Top 3 --- */}
                {topThree.length > 0 && (
                    <View style={styles.podiumContainer}>
                        {/* 2nd Place */}
                        {topThree[1] && (
                            <View style={[styles.podiumPillar, styles.silver]}>
                                <Icon name="person-circle-outline" size={50} color={COLORS.surface} />
                                <Text style={styles.podiumName}>{topThree[1].username}</Text>
                                <Text style={styles.podiumScore}>{topThree[1].totalScore} pts</Text>
                                <View style={styles.podiumRankCircle}><Text style={styles.podiumRankText}>2</Text></View>
                            </View>
                        )}
                        {/* 1st Place */}
                        {topThree[0] && (
                            <View style={[styles.podiumPillar, styles.gold]}>
                                <Icon name="trophy" size={50} color={COLORS.surface} />
                                <Text style={styles.podiumName}>{topThree[0].username}</Text>
                                <Text style={styles.podiumScore}>{topThree[0].totalScore} pts</Text>
                                <View style={styles.podiumRankCircle}><Text style={styles.podiumRankText}>1</Text></View>
                            </View>
                        )}
                        {/* 3rd Place */}
                        {topThree[2] && (
                            <View style={[styles.podiumPillar, styles.bronze]}>
                                <Icon name="person-circle-outline" size={50} color={COLORS.surface} />
                                <Text style={styles.podiumName}>{topThree[2].username}</Text>
                                <Text style={styles.podiumScore}>{topThree[2].totalScore} pts</Text>
                                <View style={styles.podiumRankCircle}><Text style={styles.podiumRankText}>3</Text></View>
                            </View>
                        )}
                    </View>
                )}
                
                {/* --- YOUR RANK --- */}
                {myRankData && myRankIndex >= 3 && (
                    <Card style={[styles.rankItem, styles.myRankItem]}>
                        <Text style={styles.rankText}>{myRankData.rank}</Text>
                        <Text style={styles.rankName}>{myRankData.username} (You) {myRankData.currentStreak > 0 && `🔥${myRankData.currentStreak}`}</Text>
                        <Text style={styles.rankScore}>{myRankData.totalScore} pts</Text>
                    </Card>
                )}
            </>
        }
    />
  );
};

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: COLORS.background },
  emptyText: { ...FONTS.body, color: COLORS.textSecondary },
  
  // Podium Styles
  podiumContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    padding: SIZES.padding,
    paddingBottom: SIZES.padding * 2,
    backgroundColor: COLORS.surface,
  },
  podiumPillar: {
    alignItems: 'center',
    padding: SIZES.base,
    borderRadius: SIZES.radius,
    marginHorizontal: 4,
    width: '30%',
  },
  gold: { backgroundColor: '#FFD700', minHeight: 150 },
  silver: { backgroundColor: '#C0C0C0', minHeight: 120 },
  bronze: { backgroundColor: '#CD7F32', minHeight: 100 },
  podiumRankCircle: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center', alignItems: 'center',
    position: 'absolute', top: 5, right: 5,
  },
  podiumRankText: { ...FONTS.caption, color: COLORS.surface, fontWeight: 'bold' },
  podiumName: { ...FONTS.body, color: COLORS.surface, fontWeight: 'bold', marginTop: SIZES.base },
  podiumScore: { ...FONTS.caption, color: COLORS.surface, opacity: 0.9 },
  
  // Rank Item Styles
  rankItem: {
    marginHorizontal: SIZES.padding,
    marginBottom: SIZES.base,
    flexDirection: 'row',
    alignItems: 'center',
  },
  myRankItem: {
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  rankText: {
    ...FONTS.h3,
    color: COLORS.textSecondary,
    width: 40,
  },
  rankName: {
    ...FONTS.body,
    flex: 1,
  },
  rankScore: {
    ...FONTS.h3,
    color: COLORS.primary,
  },
});

export default LeaderboardScreen;
