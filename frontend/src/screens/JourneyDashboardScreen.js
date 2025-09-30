import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, TouchableOpacity, Dimensions, Linking } from 'react-native';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/apiClient';
import { SIZES, FONTS } from '../styles/theme'; // Keeping existing theme scale/fonts
import Icon from 'react-native-vector-icons/Ionicons';
import { LineChart } from 'react-native-chart-kit'; 

const { width } = Dimensions.get('window');
const CONTENT_WIDTH = width - SIZES.padding * 4;
const PROBLEM_GRID_ITEM_SIZE = (CONTENT_WIDTH - (SIZES.base / 2) * 7) / 8; 

// --- LIGHT THEME COLORS ---
const LIGHT_COLORS = {
  BACKGROUND: '#F7F9FC',         // Very light background
  SURFACE: '#FFFFFF',            // Pure white cards
  BORDER: '#E0E6F0',             // Soft border/separator
  PRIMARY: '#4A90E2',            // Professional Blue
  PRIMARY_LIGHT: '#8CB8F5',      // Lighter Blue
  SECONDARY: '#F5A623',          // Accent Orange (for contrast)
  SUCCESS: '#50E3C2',            // Teal/Green for positive status
  SUCCESS_DARK: '#1D9A7A',
  TEXT_PRIMARY: '#333333',       // Dark Gray/Black for main text
  TEXT_SECONDARY: '#666666',     // Medium Gray for subtext
  TEXT_INVERSE: '#FFFFFF',       // White text on colored surfaces
};

// Custom Progress Bar Component: "Topic Mastery Tracker"
const TopicProgressBar = ({ topicName, userSolved, totalInTopic, roomAverageSolved, isUserLeading }) => {
  const userProgress = (userSolved / totalInTopic) * 100;
  const roomAvgProgress = (roomAverageSolved / totalInTopic) * 100;

  return (
    <View style={lightTopicStyles.container}>
      <Text style={lightTopicStyles.topicName}>{topicName}</Text>
      <View style={lightTopicStyles.progressBarWrapper}>
        {/* Room Average Bar (Subtle comparison) */}
        <View style={[
          lightTopicStyles.progressBarFill,
          { width: `${roomAvgProgress}%`, backgroundColor: LIGHT_COLORS.PRIMARY_LIGHT, opacity: 0.2 }
        ]} />
        {/* User's Progress Bar (Primary Focus) */}
        <View style={[
          lightTopicStyles.progressBarFill,
          { 
            width: `${userProgress}%`, 
            backgroundColor: isUserLeading ? LIGHT_COLORS.SUCCESS : LIGHT_COLORS.PRIMARY,
          }
        ]} />
        <Text style={lightTopicStyles.progressText}>
          {userSolved} / {totalInTopic}
        </Text>
      </View>
      <Text style={lightTopicStyles.comparisonText}>
        <Icon 
            name={isUserLeading ? "ribbon" : "bar-chart-outline"} 
            size={FONTS.caption.fontSize} 
            color={LIGHT_COLORS.TEXT_SECONDARY} 
        />
        {' '}Room Average: {roomAverageSolved.toFixed(1)}
      </Text>
    </View>
  );
};

const lightTopicStyles = StyleSheet.create({
  container: { marginBottom: SIZES.padding * 1.5 },
  topicName: { 
    ...FONTS.h4, 
    color: LIGHT_COLORS.TEXT_PRIMARY, 
    marginBottom: SIZES.base / 2, 
    fontWeight: '600'
  },
  progressBarWrapper: {
    height: 20, 
    backgroundColor: LIGHT_COLORS.BORDER,
    borderRadius: SIZES.radius, 
    overflow: 'hidden',
    justifyContent: 'center',
    position: 'relative',
  },
  progressBarFill: {
    position: 'absolute',
    height: '100%',
    left: 0,
    borderRadius: SIZES.radius,
  },
  progressText: {
    position: 'absolute',
    right: SIZES.base,
    color: LIGHT_COLORS.TEXT_INVERSE, // White text on colored bar
    ...FONTS.caption,
    fontWeight: 'bold',
    zIndex: 1, 
  },
  comparisonText: {
    ...FONTS.caption,
    color: LIGHT_COLORS.TEXT_SECONDARY,
    marginTop: SIZES.base / 2,
    textAlign: 'left',
  }
});

// Custom Card Component: "Clean Panel"
const LightPanel = ({ title, children, style = {} }) => (
  <View style={[lightStyles.panel, style]}>
    <Text style={lightStyles.panelTitle}>{title}</Text>
    <View style={lightStyles.panelSeparator} />
    {children}
  </View>
);

const JourneyDashboardScreen = ({ navigation }) => {
  const route = useRoute();
  const { roomId } = route.params || {}; 
  const { userId } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState({
    roomName: '',
    totalProblemsInSheet: 0,
    userTotalSolved: 0,
    roomAverageSolved: 0,
    topicProgress: [],
    problemGrid: [],
    burndownData: [],
    topSolvers: [],
  });

  // --- Data Fetching (Retain original logic) ---
  const fetchDashboardData = useCallback(async () => {
    if (!roomId) {
      Alert.alert('Error', 'Room ID is missing.');
      setIsLoading(false);
      return;
    }
    try {
        setIsLoading(true);
        const response = await apiClient.get(`/rooms/${roomId}/journey-dashboard`);
        setDashboardData(response.data);
      } catch (error) {
        console.error('Error fetching journey dashboard data:', error);
        Alert.alert('Error', 'Could not load dashboard data.');
      } finally {
        setIsLoading(false);
      }
  }, [roomId]);

  useFocusEffect(useCallback(() => {
    fetchDashboardData();
  }, [fetchDashboardData]));

  // --- Burndown Chart Data Processing (Retain original logic) ---
  const prepareBurndownChartData = () => {
    if (!dashboardData.burndownData.length || !dashboardData.totalProblemsInSheet) {
      return { labels: [], datasets: [{ data: [] }] };
    }

    const labels = [];
    const solvedCounts = [];
    let accumulatedSolved = 0;

    const solvedByDateMap = new Map();
    dashboardData.burndownData.forEach(item => {
      solvedByDateMap.set(item.date, item.problems_solved_on_date);
    });

    const today = new Date();
    today.setHours(0,0,0,0); 

    let firstSubmissionDate = dashboardData.burndownData.length > 0 
      ? new Date(dashboardData.burndownData[0].date) 
      : today;
    firstSubmissionDate.setHours(0,0,0,0);
    
    labels.push('Start');
    solvedCounts.push(dashboardData.totalProblemsInSheet);

    let currentDate = new Date(firstSubmissionDate);
    currentDate.setDate(currentDate.getDate()); 

    while (currentDate <= today) {
      const dateString = currentDate.toISOString().split('T')[0];
      const solvedToday = solvedByDateMap.get(dateString) || 0;
      
      if (solvedToday > 0 || currentDate.getTime() === today.getTime()) {
        accumulatedSolved += solvedToday;
        if (solvedCounts.length > 0 && !(labels[labels.length - 1] === 'Start' && accumulatedSolved === 0)) {
            labels.push(currentDate.getMonth() + 1 + '/' + currentDate.getDate()); 
            solvedCounts.push(dashboardData.totalProblemsInSheet - accumulatedSolved);
        }
      }

      currentDate.setDate(currentDate.getDate() + 1); 
    }
    
    const maxLabels = 6;
    let finalLabels = labels;
    let finalData = solvedCounts;

    if (labels.length > maxLabels) {
        finalLabels = [labels[0], ...labels.slice(labels.length - (maxLabels - 1))];
        finalData = [solvedCounts[0], ...solvedCounts.slice(solvedCounts.length - (maxLabels - 1))];
    }
    
    return {
      labels: finalLabels,
      datasets: [
        {
          data: finalData,
          color: (opacity = 1) => LIGHT_COLORS.SECONDARY, // Use accent color for Burndown
          strokeWidth: 3, 
        },
      ],
    };
  };

  const burndownChartData = prepareBurndownChartData();

  if (isLoading) {
    return (
      <View style={lightStyles.loadingContainer}>
        <ActivityIndicator size="large" color={LIGHT_COLORS.PRIMARY} />
        <Text style={lightStyles.loadingText}>Loading your journey...</Text>
      </View>
    );
  }

  // Calculated properties
  const userOverallProgress = (dashboardData.userTotalSolved / dashboardData.totalProblemsInSheet) * 100 || 0;
  const roomOverallAverageProgress = (dashboardData.roomAverageSolved / dashboardData.totalProblemsInSheet) * 100 || 0;
  const userIsLeadingOverall = dashboardData.userTotalSolved > dashboardData.roomAverageSolved;

  return (
    <ScrollView style={lightStyles.container} contentContainerStyle={lightStyles.contentContainer}>
      {/* Header */}
      <Text style={lightStyles.headerTitle}>{dashboardData.roomName} Journey</Text>
      <Text style={lightStyles.headerSubtitle}>Progress Dashboard</Text>
      
      {/* 1. Overall Progress */}
      <LightPanel title="Overall Progress Snapshot">
        <View style={lightStyles.overallProgressContainer}>
          <View style={[
            lightStyles.circularProgress, 
            { backgroundColor: userIsLeadingOverall ? LIGHT_COLORS.SUCCESS : LIGHT_COLORS.PRIMARY }
          ]}>
              <Text style={lightStyles.circularProgressText}>{dashboardData.userTotalSolved}</Text>
              <Text style={lightStyles.circularProgressSubText}>/ {dashboardData.totalProblemsInSheet}</Text>
          </View>
          
          <View style={{ flex: 1 }}>
            <View style={lightStyles.overallProgressBarWrapper}>
                <View style={[
                  lightStyles.overallProgressBarFill, 
                  { width: `${userOverallProgress}%`, backgroundColor: userIsLeadingOverall ? LIGHT_COLORS.SUCCESS : LIGHT_COLORS.PRIMARY }
                ]} />
                <Text style={[lightStyles.overallProgressText, {color: LIGHT_COLORS.TEXT_INVERSE}]}>
                  {userOverallProgress.toFixed(0)}% Complete
                </Text>
            </View>
            <View style={lightStyles.overallComparison}>
                <Icon name={userIsLeadingOverall ? "trophy" : "stats-chart-outline"} size={FONTS.caption.fontSize} color={LIGHT_COLORS.TEXT_SECONDARY} />
                <Text style={lightStyles.comparisonLabel}>
                  {' '}Room Avg: {dashboardData.roomAverageSolved.toFixed(1)}
                </Text>
                <View style={lightStyles.roomAvgProgressBarSmall}>
                    <View style={[lightStyles.overallProgressBarFill, { width: `${roomOverallAverageProgress}%`, backgroundColor: LIGHT_COLORS.PRIMARY_LIGHT, opacity: 0.5, height: '100%' }]} />
                </View>
            </View>
          </View>
        </View>
      </LightPanel>

      {/* 2. Problem Tracker Grid */}
      <LightPanel title="Problem Tracker Grid">
        <View style={lightStyles.problemGrid}>
          {dashboardData.problemGrid.length > 0 ? (
            dashboardData.problemGrid.map((problem) => (
              <TouchableOpacity
                key={problem.id}
                style={[
                  lightStyles.problemGridItem,
                  problem.solved_by_user ? lightStyles.solvedByUser : null,
                  problem.solved_by_teammate && !problem.solved_by_user ? lightStyles.solvedByTeammate : null,
                ]}
                onPress={() => Alert.alert(
                  problem.title, 
                  `Order: ${problem.problem_order}\nDifficulty: ${problem.difficulty}\nTopic: ${problem.topic}\nStatus: ${problem.solved_by_user ? 'Solved by You' : (problem.solved_by_teammate ? 'Solved by Teammate' : 'Unsolved')}`,
                  [{ text: "View Problem", onPress: () => problem.link && Linking.openURL(problem.link) }, { text: "Cancel", style: 'cancel' }]
                )}
              >
                <Text style={lightStyles.problemGridText}>{problem.problem_order}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={lightStyles.noDataText}>No problems in this sheet yet.</Text>
          )}
        </View>
        
        {/* Legend */}
        <View style={lightStyles.legendContainer}>
          <View style={lightStyles.legendColumn}>
            <View style={lightStyles.legendItem}><View style={[lightStyles.legendColor, lightStyles.solvedByUser]} /><Text style={lightStyles.legendText}>Solved by You</Text></View>
            <View style={lightStyles.legendItem}><View style={[lightStyles.legendColor, lightStyles.solvedByTeammate]} /><Text style={lightStyles.legendText}>Solved by Teammate</Text></View>
          </View>
          <View style={lightStyles.legendColumn}>
            <View style={lightStyles.legendItem}><View style={[lightStyles.legendColor, lightStyles.unsolvedItem]} /><Text style={lightStyles.legendText}>Unsolved</Text></View>
          </View>
        </View>
      </LightPanel>

      {/* 3. Topic-wise Progress Section */}
      <LightPanel title="Topic Mastery Breakdown">
        {dashboardData.topicProgress.length > 0 ? (
          dashboardData.topicProgress.map((topic) => (
            <TopicProgressBar
              key={topic.topic}
              topicName={topic.topic}
              userSolved={topic.user_solved}
              totalInTopic={topic.total_in_topic}
              roomAverageSolved={topic.room_total_solved_by_any_member / topic.member_count} 
              isUserLeading={topic.user_solved > (topic.room_total_solved_by_any_member / topic.member_count)}
            />
          ))
        ) : (
          <Text style={lightStyles.noDataText}>No topic data available yet. Start solving! 🎉</Text>
        )}
      </LightPanel>
      
      {/* 4. Burndown Chart Section */}
      <LightPanel title="Progress Burndown">
        {burndownChartData.labels.length > 1 && dashboardData.totalProblemsInSheet > 0 ? (
          <LineChart
            data={burndownChartData}
            width={CONTENT_WIDTH} 
            height={220}
            yAxisLabel="" 
            yAxisSuffix=""
            chartConfig={{
              backgroundColor: LIGHT_COLORS.SURFACE,
              backgroundGradientFrom: LIGHT_COLORS.SURFACE,
              backgroundGradientTo: LIGHT_COLORS.SURFACE,
              decimalPlaces: 0,
              color: (opacity = 1) => LIGHT_COLORS.SECONDARY, 
              labelColor: (opacity = 1) => LIGHT_COLORS.TEXT_SECONDARY,
              style: { borderRadius: SIZES.radius },
              propsForDots: {
                r: '5', 
                strokeWidth: '2',
                stroke: LIGHT_COLORS.SECONDARY,
                fill: LIGHT_COLORS.SURFACE,
              },
              fillShadowGradient: LIGHT_COLORS.SECONDARY,
              fillShadowGradientOpacity: 0.1, 
              strokeWidth: 3,
            }}
            bezier
            style={{ marginVertical: SIZES.base, borderRadius: SIZES.radius, borderWidth: 1, borderColor: LIGHT_COLORS.BORDER }}
          />
        ) : (
          <Text style={lightStyles.noDataText}>Solve a problem to start tracking your burndown!</Text>
        )}
      </LightPanel>
      
      {/* 5. Top Solvers */}
      {dashboardData.topSolvers.length > 0 && (
        <LightPanel title="Top Solvers">
          {dashboardData.topSolvers.map((solver, index) => (
            <View key={index} style={lightStyles.topSolverRow}>
              <Text style={lightStyles.topSolverRank}>
                {index < 3 ? <Icon name="medal" size={FONTS.body.fontSize} color={index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : '#CD7F32'} /> : `#${index + 1}`}
              </Text>
              <Text style={[lightStyles.topSolverName, solver.username === userId ? { fontWeight: 'bold', color: LIGHT_COLORS.PRIMARY } : {}]}>
                {solver.username} {solver.username === userId ? '(You)' : ''}
              </Text>
              <Text style={lightStyles.topSolverSolved}>
                {solver.solved_count} / {dashboardData.totalProblemsInSheet}
              </Text>
            </View>
          ))}
          <TouchableOpacity style={lightStyles.viewFullLeaderboardButton} onPress={() => Alert.alert("Feature", "Navigate to full leaderboard soon!")}>
            <Text style={lightStyles.viewFullLeaderboardText}>View Full Leaderboard <Icon name="arrow-forward" size={FONTS.caption.fontSize} color={LIGHT_COLORS.PRIMARY} /></Text>
          </TouchableOpacity>
        </LightPanel>
      )}

      <View style={{ height: SIZES.padding * 4 }} />
    </ScrollView>
  );
};

// --- LIGHT THEME STYLES ---
const lightStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LIGHT_COLORS.BACKGROUND,
  },
  contentContainer: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding * 2,
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: LIGHT_COLORS.BACKGROUND, },
  loadingText: { ...FONTS.body, marginTop: SIZES.base, color: LIGHT_COLORS.PRIMARY, fontWeight: '700' },
  
  headerTitle: { ...FONTS.h1, color: LIGHT_COLORS.TEXT_PRIMARY, textAlign: 'left', marginBottom: SIZES.base / 2, fontWeight: '700', },
  headerSubtitle: { ...FONTS.h4, color: LIGHT_COLORS.TEXT_SECONDARY, textAlign: 'left', marginBottom: SIZES.padding * 2, },

  // Panel Styling (Replaces Card)
  panel: {
    marginBottom: SIZES.padding * 2,
    backgroundColor: LIGHT_COLORS.SURFACE,
    borderRadius: SIZES.radius * 1.5, 
    padding: SIZES.padding * 1.5,
    borderWidth: 1, // Soft border for depth
    borderColor: LIGHT_COLORS.BORDER,
    // Soft shadow for elevation
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  panelTitle: { ...FONTS.h3, color: LIGHT_COLORS.TEXT_PRIMARY, fontWeight: '700', },
  panelSeparator: { height: 2, width: 40, backgroundColor: LIGHT_COLORS.PRIMARY, marginTop: SIZES.base / 2, marginBottom: SIZES.padding, },
  noDataText: { ...FONTS.body, color: LIGHT_COLORS.TEXT_SECONDARY, textAlign: 'center', paddingVertical: SIZES.padding, },

  // Overall Progress Snapshot
  overallProgressContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: SIZES.padding, },
  circularProgress: { 
    width: 90, 
    height: 90, 
    borderRadius: 45, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: SIZES.padding * 1.5, 
    // No shadow needed, color contrast is enough
  },
  circularProgressText: { ...FONTS.h1, color: LIGHT_COLORS.TEXT_INVERSE, lineHeight: 40, fontWeight: '900' },
  circularProgressSubText: { ...FONTS.caption, color: LIGHT_COLORS.TEXT_INVERSE, marginTop: -SIZES.base * 0.5, fontWeight: '700', },
  overallProgressBarWrapper: { flex: 1, height: 25, backgroundColor: LIGHT_COLORS.BORDER, borderRadius: SIZES.radius, overflow: 'hidden', justifyContent: 'center', position: 'relative', marginBottom: SIZES.base, },
  overallProgressBarFill: { position: 'absolute', height: '100%', borderRadius: SIZES.radius, left: 0, },
  overallProgressText: { position: 'absolute', width: '100%', textAlign: 'center', ...FONTS.body, fontWeight: 'bold', zIndex: 1, },
  overallComparison: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: SIZES.base, },
  comparisonLabel: { ...FONTS.caption, color: LIGHT_COLORS.TEXT_SECONDARY, marginRight: SIZES.base, marginLeft: SIZES.base / 2, },
  roomAvgProgressBarSmall: { flex: 1, height: 8, backgroundColor: LIGHT_COLORS.BORDER, borderRadius: SIZES.radius, overflow: 'hidden', },

  // Top Solvers
  topSolverRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SIZES.base, borderBottomWidth: 1, borderBottomColor: LIGHT_COLORS.BORDER, },
  topSolverRank: { ...FONTS.body, fontWeight: '700', color: LIGHT_COLORS.TEXT_SECONDARY, width: 40, textAlign: 'center', },
  topSolverName: { ...FONTS.body, flex: 1, color: LIGHT_COLORS.TEXT_PRIMARY, },
  topSolverSolved: { ...FONTS.body, fontWeight: '600', color: LIGHT_COLORS.PRIMARY, },
  viewFullLeaderboardButton: { marginTop: SIZES.padding, alignSelf: 'flex-end', padding: SIZES.base, },
  viewFullLeaderboardText: { ...FONTS.caption, color: LIGHT_COLORS.PRIMARY, fontWeight: 'bold', },

  // Problem Grid 
  problemGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: SIZES.base, },
  problemGridItem: {
    width: PROBLEM_GRID_ITEM_SIZE,
    height: PROBLEM_GRID_ITEM_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: SIZES.radius / 4,
    backgroundColor: LIGHT_COLORS.BORDER, 
    marginBottom: SIZES.base / 2, 
  },
  solvedByUser: {
    backgroundColor: LIGHT_COLORS.SUCCESS,
    // Use darker text on this light background for contrast
  },
  solvedByTeammate: {
    backgroundColor: LIGHT_COLORS.PRIMARY_LIGHT,
  },
  unsolvedItem: {
    backgroundColor: LIGHT_COLORS.BORDER,
  },
  problemGridText: {
    ...FONTS.caption,
    color: LIGHT_COLORS.TEXT_INVERSE, // Use white text for visibility on colored/darker blocks
    fontWeight: 'bold',
    fontSize: 10,
  },
  // Overrides for unsolved items to use dark text on light background
  problemGridTextUnsolved: {
    color: LIGHT_COLORS.TEXT_SECONDARY
  },
  
  // Legend
  legendContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SIZES.padding, paddingTop: SIZES.padding, borderTopWidth: 1, borderTopColor: LIGHT_COLORS.BORDER, },
  legendColumn: { flex: 1, paddingRight: SIZES.base, },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginBottom: SIZES.base / 2, },
  legendColor: { width: 14, height: 14, borderRadius: 3, marginRight: SIZES.base, },
  legendText: { ...FONTS.caption, color: LIGHT_COLORS.TEXT_SECONDARY, fontSize: 11, },
});

export default JourneyDashboardScreen;