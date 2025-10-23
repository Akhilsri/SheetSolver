import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import * as roomService from '../services/roomService';
import { COLORS, SIZES, FONTS } from '../styles/theme';
import Card from '../components/common/Card';
import Icon from 'react-native-vector-icons/Ionicons';
import Share from 'react-native-share';

// NOTE: Uncomment the Clipboard import if you have it installed and want the 'Copy Message' feature
// import Clipboard from '@react-native-clipboard/clipboard'; 

// --- DEBUGGING LOGS START (REMOVE OR COMMENT OUT IN PRODUCTION) ---
// console.log('--- JourneyAchievementsScreen Module Loaded ---');
// --- DEBUGGING LOGS END ---

const JourneyAchievementsScreen = ({ navigation }) => {
  const route = useRoute();
  const { roomId, roomName } = route.params;
  const { userId } = useAuth();

  // State for immediate data
  const [isLoading, setIsLoading] = useState(true);
  const [journeyStats, setJourneyStats] = useState(null);

  // State for lazy-loaded data
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);

  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // --- Optimization: Function to fetch only the essential stats ---
  const fetchEssentialData = useCallback(async () => {
    if (!isMounted.current) return;
    setIsLoading(true);

    // CRITICAL CHECK
    if (!roomService || typeof roomService.getJourneyDashboard !== 'function') {
      console.error('CRITICAL ERROR: roomService.getJourneyDashboard is not defined or not a function!');
      Alert.alert('Initialization Error', 'Failed to load room service functions.');
      if (isMounted.current) setIsLoading(false);
      return;
    }

    try {
      const dashboardRes = await roomService.getJourneyDashboard(roomId, userId);

      if (isMounted.current) {
        if (dashboardRes?.data) {
          setJourneyStats(dashboardRes.data);
        } else {
          setJourneyStats(null);
        }
      }
    } catch (error) {
      console.error('Failed to fetch essential journey stats:', error);
      Alert.alert('Error', `An error occurred while loading journey data: ${error.message || 'Unknown error'}`);
      setJourneyStats(null);
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, [roomId, userId]);

  // --- Optimization: Function to lazy-load the leaderboard ---
  const fetchLeaderboard = useCallback(async () => {
    if (!isMounted.current) return;
    setIsLeaderboardLoading(true);
    
    // CRITICAL CHECK
    if (!roomService || typeof roomService.getLeaderboard !== 'function') {
      console.error('CRITICAL ERROR: roomService.getLeaderboard is not defined or not a function!');
      if (isMounted.current) setIsLeaderboardLoading(false);
      return;
    }

    try {
      const leaderboardRes = await roomService.getLeaderboard(roomId);
      
      if (isMounted.current) {
        if (leaderboardRes?.data) {
          // Sort by totalScore, then by username as a tie-breaker
          const sortedLeaderboard = leaderboardRes.data.sort((a, b) => {
            if (b.totalScore === a.totalScore) {
              return a.username.localeCompare(b.username); // Alphabetical for ties
            }
            return b.totalScore - a.totalScore;
          });
          setLeaderboard(sortedLeaderboard);
        } else {
          setLeaderboard([]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
      // Optional: Alert.alert('Error', 'Could not load leaderboard.');
      setLeaderboard([]);
    } finally {
      if (isMounted.current) setIsLeaderboardLoading(false);
    }
  }, [roomId]);


  // 1. Initial Load Effect: Fetch essential stats first
  useEffect(() => {
    fetchEssentialData();
    navigation.setOptions({ title: `${roomName} - Achievements` });
  }, [fetchEssentialData, navigation, roomName]);

  // 2. Lazy Load Effect: Fetch leaderboard once essential stats are done
  useEffect(() => {
    // We only trigger leaderboard fetch if essential data *finished* loading, regardless of success.
    if (!isLoading) {
      // Small delay for better UX and performance prioritization
      const timer = setTimeout(() => {
        fetchLeaderboard();
      }, 500); // 500ms delay to ensure main UI is responsive first

      return () => clearTimeout(timer);
    }
  }, [isLoading, fetchLeaderboard]); // Trigger when main loading finishes


  const generateShareMessage = useCallback(() => {
    if (!journeyStats || !roomName) {
      return '';
    }

    let message = `🎉 Just completed a coding challenge journey! 🎉\n\n`;
    message += `Room: ${roomName}\n`;
    message += `Sheet: ${journeyStats.roomName || 'N/A'}\n`;
    message += `Total Problems in Sheet: ${journeyStats.totalProblemsInSheet || 0}\n`;
    message += `My Problems Solved: ${journeyStats.userTotalSolved || 0}\n`;
    message += `\n`;

    const currentUserStats = leaderboard.find(member => Number(member.userId) === Number(userId));
    if (currentUserStats) {
      const rank = leaderboard.findIndex(member => Number(member.userId) === Number(userId)) + 1;
      message += `I personally solved ${currentUserStats.totalScore || 0} problems and achieved rank #${rank} out of ${leaderboard.length} members!\n`;
    }

    if (leaderboard.length > 0) {
      message += `\nTop 3 Performers:\n`;
      leaderboard.slice(0, 3).forEach((member, index) => {
        message += `${index + 1}. ${member.username}: ${member.totalScore || 0} problems\n`;
      });
    }

    const appLink = 'https://your-app-store-link.com'; // IMPORTANT: Replace with your actual app store link or website
    message += `\nCheck out [Your App Name] to start your own coding journey! ${appLink} #CodingChallenge #ProblemSolving #TechSkills`;
    
    return message;
  }, [journeyStats, roomName, leaderboard, userId]);

  const handleShareToLinkedIn = useCallback(async () => {
    const shareMessage = generateShareMessage();
    const appLink = 'https://your-app-store-link.com'; // IMPORTANT: Replace with your actual app store link or website

    if (!shareMessage) {
        Alert.alert('No Content', 'There is no content to share yet.');
        return;
    }

    const shareOptions = {
      title: `My Coding Journey Achievements - ${roomName}`,
      message: shareMessage,
      url: appLink,
      failOnCancel: false
    };

    try {
      // Attempt 1: Try sharing directly to LinkedIn app
      await Share.shareSingle({ ...shareOptions, social: Share.Social.LINKEDIN });

    } catch (error) {
      console.error('LinkedIn shareSingle error:', error);
      const errorMsg = error.message.toLowerCase();
      const linkedinAppNotFound = errorMsg.includes('not installed') || errorMsg.includes('no corresponding activity') || errorMsg.includes('user did not share');

      if (linkedinAppNotFound) {
        // Attempt 2: Fallback to general share sheet
        try {
          await Share.open(shareOptions);
        } catch (genericShareError) {
          console.error('Generic share error:', genericShareError);

          // Attempt 3: Fallback to LinkedIn web intent
          const linkedinWebUrl = `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(appLink)}&title=${encodeURIComponent(shareOptions.title)}&summary=${encodeURIComponent(shareOptions.message)}&source=${encodeURIComponent('Your App Name')}`;
          
          const canOpen = await Linking.canOpenURL(linkedinWebUrl);
          if (canOpen) {
            await Linking.openURL(linkedinWebUrl);
            Alert.alert('Share Via Browser', 'LinkedIn share opened in your web browser. Please complete sharing there.');
          } else {
            Alert.alert('Share Failed', 'Could not open LinkedIn share link.');
          }
        }
      } else {
        Alert.alert('Share Failed', `An unexpected error occurred: ${error.message}.`);
      }
    }
  }, [generateShareMessage, roomName]);


  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ ...FONTS.body3, color: COLORS.textSecondary, marginTop: SIZES.base }}>Loading essential stats...</Text>
      </View>
    );
  }

  // If journeyStats is null even after loading, show a specific message
  if (!journeyStats) {
    return (
      <View style={styles.centered}>
        <Text style={{ ...FONTS.body3, color: COLORS.gray }}>No comprehensive journey statistics available.</Text>
        <TouchableOpacity onPress={fetchEssentialData} style={{ marginTop: SIZES.padding }}>
          <Text style={{ ...FONTS.body3, color: COLORS.primary, textDecorationLine: 'underline' }}>
            Try Reloading
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Icon name="trophy-outline" size={60} color={COLORS.gold} style={styles.trophyIcon} />
          <Text style={styles.title}>Journey Completed!</Text>
          <Text style={styles.subtitle}>Congratulations on finishing the "{roomName}" challenge!</Text>
        </View>

        {/* Essential Stats Card (Loaded first) */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Overall Journey Stats</Text>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Sheet Name:</Text>
            <Text style={styles.statValue}>{journeyStats.roomName || 'N/A'}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Total Problems in Sheet:</Text>
            <Text style={styles.statValue}>{journeyStats.totalProblemsInSheet || 0}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Problems Solved by You:</Text>
            <Text style={styles.statValue}>{journeyStats.userTotalSolved || 0}</Text>
          </View>
        </Card>

        {/* Leaderboard Card (Lazy Loaded) */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Top Performers</Text>
          
          {isLeaderboardLoading ? (
            <ActivityIndicator size="small" color={COLORS.primary} style={{ padding: SIZES.padding }} />
          ) : (
            <>
              {leaderboard.length > 0 ? (
                leaderboard.slice(0, 5).map((member, index) => (
                  <View
                    key={member.userId}
                    style={[
                      styles.leaderboardItem,
                      index === leaderboard.slice(0, 5).length - 1 && styles.leaderboardItemNoBorder,
                      Number(member.userId) === Number(userId) && styles.currentUserItem,
                    ]}
                  >
                    <Text style={[styles.rankText, Number(member.userId) === Number(userId) && styles.currentUserText]}>
                      {index + 1}.
                    </Text>
                    <Text style={[styles.memberName, Number(member.userId) === Number(userId) && styles.currentUserText]}>
                      {member.username} {Number(member.userId) === Number(userId) ? '(You)' : ''}
                    </Text>
                    <Text style={[styles.solvedCount, Number(member.userId) === Number(userId) && styles.currentUserText]}>
                      {member.totalScore || 0} problems
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={{ ...FONTS.body4, color: COLORS.gray, textAlign: 'center', paddingVertical: SIZES.base }}>
                  No leaderboard data available.
                </Text>
              )}
            </>
          )}
        </Card>

        <View style={styles.shareSection}>
          {journeyStats && leaderboard.length > 0 && !isLeaderboardLoading ? (
            <TouchableOpacity style={styles.shareButton} onPress={handleShareToLinkedIn}>
              <Icon name="logo-linkedin" size={24} color={COLORS.surface} />
              <Text style={styles.shareText}>Share Achievements on LinkedIn</Text>
            </TouchableOpacity>
          ) : (
             // Show a placeholder or loading indicator for share button if data is missing or loading
             <Text style={styles.noStatsText}>
                {isLeaderboardLoading ? 'Loading leaderboard for sharing...' : 'Full stats required to share.'}
             </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

// ... (Styles remain the same)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SIZES.padding,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: SIZES.padding * 2,
  },
  trophyIcon: {
    marginBottom: SIZES.base,
  },
  title: {
    ...FONTS.h2,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SIZES.base,
  },
  subtitle: {
    ...FONTS.body3,
    color: COLORS.gray,
    textAlign: 'center',
  },
  card: {
    marginBottom: SIZES.padding,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.surface,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    ...FONTS.h4,
    color: COLORS.primary,
    marginBottom: SIZES.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: SIZES.base,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SIZES.base / 2,
    paddingVertical: SIZES.base / 2,
  },
  statLabel: {
    ...FONTS.body4,
    color: COLORS.textSecondary,
  },
  statValue: {
    ...FONTS.body4,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  leaderboardItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SIZES.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  leaderboardItemNoBorder: {
    borderBottomWidth: 0,
  },
  rankText: {
    ...FONTS.body3,
    fontWeight: 'bold',
    width: 30,
    color: COLORS.textSecondary,
  },
  memberName: {
    ...FONTS.body3,
    flex: 1,
    color: COLORS.textPrimary,
  },
  solvedCount: {
    ...FONTS.body3,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  currentUserItem: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: SIZES.radius / 2,
    paddingHorizontal: SIZES.base,
  },
  currentUserText: {
    color: COLORS.primaryDark,
  },
  shareSection: {
    marginTop: SIZES.padding * 2,
    alignItems: 'center',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0077B5', // LinkedIn Blue
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    justifyContent: 'center',
    width: '80%',
    maxWidth: 300,
  },
  shareText: {
    ...FONTS.h4,
    color: COLORS.surface,
    marginLeft: SIZES.base,
    fontWeight: 'bold',
  },
  noStatsText: {
    ...FONTS.body3,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: SIZES.padding,
  }
});

export default JourneyAchievementsScreen;