import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions, TouchableOpacity, FlatList, Linking } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Calendar } from 'react-native-calendars';
import apiClient from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS, SIZES, FONTS } from '../styles/theme';
import Card from '../components/common/Card'; // Import the Card component

const screenWidth = Dimensions.get('window').width;

// Reusable component for the journey cards
const JourneyCard = ({ journey, navigation }) => {
  const progress = journey.total_problems > 0 ? (journey.solved_problems / journey.total_problems) : 0;
  const progressPercent = Math.round(progress * 100);

  return (
    <TouchableOpacity 
      style={styles.journeyCard} 
      onPress={() => navigation.navigate('RoomDetail', { roomId: journey.id, roomName: journey.name })}
    >
      <Text style={styles.journeyRoomName}>{journey.name}</Text>
      <Text style={styles.journeySheetName}>{journey.sheet_name}</Text>
      <View style={styles.progressContainer}>
        <View style={styles.progressLabels}>
            <Text style={styles.progressText}>{journey.solved_problems} / {journey.total_problems} Solved</Text>
            <Text style={styles.progressText}>{progressPercent}%</Text>
        </View>
        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>
      </View>
       <Text style={styles.dateText}>
        {new Date(journey.start_date).toLocaleDateString()} - {new Date(journey.end_date).toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );
};

const ProfileScreen = () => {
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [badges, setBadges] = useState([]);
  
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [dashboardRes, badgesRes] = await Promise.all([
        apiClient.get('/users/progress-dashboard'),
        apiClient.get('/badges/my-badges')
      ]);
      const response = await apiClient.get('/users/progress-dashboard');
      setDashboardData(response.data);
      setBadges(badgesRes.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const markedDates = useMemo(() => {
    if (!dashboardData?.contributionData) return {};
    const marked = {};
    dashboardData.contributionData.forEach(item => {
      marked[item.date] = { selected: true, selectedColor: '#28a745' };
    });
    return marked;
  }, [dashboardData]);

  if (isLoading) {
    return <ActivityIndicator size="large" style={styles.centered} />;
  }

  if (!dashboardData || !dashboardData.userInfo) {
    return <View style={styles.centered}><Text>Could not load profile data.</Text></View>;
  }
  
  const { userInfo, activeJourneys } = dashboardData;
  const hasSocialLinks = userInfo.github_url || userInfo.linkedin_url || userInfo.twitter_url;

  return (
    <ScrollView style={styles.container}>
      {/* --- USER HEADER --- */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.fullName}>{userInfo.full_name || userInfo.username}</Text>
            <Text style={styles.username}>@{userInfo.username}</Text>
          </View>
          <TouchableOpacity style={styles.editButton} onPress={() => navigation.navigate('EditProfile')}>
            <Icon name="pencil-outline" size={20} color={COLORS.primary}/>
          </TouchableOpacity>
        </View>
        
        {hasSocialLinks && (
            <View style={styles.socialsContainer}>
                {userInfo.github_url && (
                    <TouchableOpacity onPress={() => Linking.openURL(userInfo.github_url)}>
                        <Icon name="logo-github" size={28} color={COLORS.textPrimary} />
                    </TouchableOpacity>
                )}
                {userInfo.linkedin_url && (
                    <TouchableOpacity onPress={() => Linking.openURL(userInfo.linkedin_url)}>
                        <Icon name="logo-linkedin" size={28} color="#0077b5" />
                    </TouchableOpacity>
                )}
                {userInfo.twitter_url && (
                    <TouchableOpacity onPress={() => Linking.openURL(userInfo.twitter_url)}>
                        <Icon name="logo-twitter" size={28} color="#1DA1F2" />
                    </TouchableOpacity>
                )}
            </View>
        )}
      </View>

      {/* --- STATS CARDS --- */}
      <View style={styles.statsContainer}>
        <Card style={styles.statBox}>
          <Text style={styles.statValue}>{userInfo.current_streak || 0} 🔥</Text>
          <Text style={styles.statLabel}>Current Streak</Text>
        </Card>
        <Card style={styles.statBox}>
          <Text style={styles.statValue}>{userInfo.max_streak || 0}</Text>
          <Text style={styles.statLabel}>Max Streak</Text>
        </Card>
      </View>
      
      {/* --- ACTIVE JOURNEYS SECTION --- */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Active Journeys</Text>
        {activeJourneys && activeJourneys.length > 0 ? (
          <FlatList
            data={activeJourneys}
            renderItem={({item}) => <JourneyCard journey={item} navigation={navigation} />}
            keyExtractor={(item) => item.id.toString()}
            horizontal={true}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.journeyList}
          />
        ) : (
          <Text style={styles.noDataText}>No active journeys. Join a room to get started!</Text>
        )}
      </View>
      
      {/* --- ACHIEVEMENTS SECTION --- */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Achievements</Text>
        <FlatList
          data={badges}
          keyExtractor={(item) => item.name}
          horizontal={true}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.journeyList}
          renderItem={({ item }) => (
            <View style={styles.badge}>
              <Text style={styles.badgeEmoji}>{item.icon_emoji}</Text>
              <Text style={styles.badgeName}>{item.name}</Text>
              <Text style={styles.badgeDescription} numberOfLines={2}>{item.description}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.noDataText}>No badges earned yet. Keep solving!</Text>}
        />
      </View>

      {/* --- PROFILE DETAILS SECTION --- */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Profile Details</Text>
        <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>College:</Text>
            <Text style={styles.detailValue}>{userInfo.college_name || 'Not set'}</Text>
        </View>
        <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Course:</Text>
            <Text style={styles.detailValue}>{userInfo.course || 'Not set'}</Text>
        </View>
        <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Branch:</Text>
            <Text style={styles.detailValue}>{userInfo.branch || 'Not set'}</Text>
        </View>
        <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Graduating:</Text>
            <Text style={styles.detailValue}>{userInfo.graduation_year || 'Not set'}</Text>
        </View>
      </Card>

      {/* --- CALENDAR --- */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Solving Activity</Text>
        <Calendar
          markedDates={markedDates}
          theme={{
            calendarBackground: COLORS.surface,
            arrowColor: COLORS.primary,
            monthTextColor: COLORS.textPrimary,
            textMonthFontWeight: 'bold',
          }}
        />
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
        backgroundColor: COLORS.surface,
        paddingHorizontal: SIZES.padding,
        paddingVertical: SIZES.padding * 1.5,
        borderBottomLeftRadius: SIZES.radius * 2,
        borderBottomRightRadius: SIZES.radius * 2,
        elevation: 3,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
    },
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    fullName: { ...FONTS.h1 },
    username: { ...FONTS.body, color: COLORS.textSecondary },
    editButton: { padding: SIZES.base, borderRadius: 20, backgroundColor: COLORS.background },
    
    // --- SOCIALS CONTAINER ---
    socialsContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        gap: SIZES.padding,
        marginTop: SIZES.padding, 
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        paddingTop: SIZES.padding,
    },
    
    statsContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: SIZES.padding, marginTop: SIZES.padding },
    statBox: { flex: 1, marginHorizontal: SIZES.base / 2, alignItems: 'center', padding: SIZES.padding, backgroundColor: COLORS.surface, borderRadius: SIZES.radius, elevation: 2 },
    statValue: { ...FONTS.h2, color: COLORS.primary },
    statLabel: { ...FONTS.caption, marginTop: SIZES.base / 2 },
    
    // --- SECTION STYLES (NOW CONSISTENT) ---
    section: {
        backgroundColor: COLORS.surface,
        borderRadius: SIZES.radius,
        marginHorizontal: SIZES.padding,
        marginTop: SIZES.padding,
        padding: SIZES.padding,
        elevation: 2,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
    },
    sectionTitle: { ...FONTS.h3, marginBottom: SIZES.base },

    // --- ACTIVE JOURNEYS FLATLIST & CARD STYLES ---
    journeyList: {
      paddingHorizontal: SIZES.padding,
    },
    journeyCard: {
      backgroundColor: COLORS.background,
      borderRadius: SIZES.radius,
      padding: SIZES.padding,
      marginRight: SIZES.base,
      width: screenWidth * 0.7,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    
    // --- PROGRESS BAR STYLES ---
    progressContainer: {
      marginTop: SIZES.padding,
    },
    progressLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: SIZES.base,
    },
    progressText: {
      ...FONTS.body,
      color: COLORS.textSecondary,
    },
    progressBarBackground: {
      height: 6,
      backgroundColor: COLORS.border,
      borderRadius: 3,
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: COLORS.primary,
      borderRadius: 3,
    },
    
    // --- OTHER STYLES ---
    dateText: {
      ...FONTS.caption,
      color: COLORS.textSecondary,
      marginTop: SIZES.base,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: SIZES.base,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    detailLabel: {
      ...FONTS.body,
      color: COLORS.textSecondary,
    },
    detailValue: {
      ...FONTS.body,
      fontWeight: '500',
      maxWidth: '60%', 
      textAlign: 'right',
      color: COLORS.textPrimary,
    },
    noDataText: {
      ...FONTS.body,
      color: COLORS.textSecondary,
      textAlign: 'center',
      padding: SIZES.padding,
    },
    badge: {
        alignItems: 'center',
        justifyContent: 'flex-start',
        backgroundColor: COLORS.background,
        borderRadius: SIZES.radius,
        padding: SIZES.base * 1.5,
        marginRight: SIZES.base,
        width: 120,
        height: 120,
    },
    badgeEmoji: {
        fontSize: 40,
        marginBottom: SIZES.base / 2,
    },
    badgeName: {
        ...FONTS.caption,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    badgeDescription: {
        ...FONTS.caption,
        fontSize: 10,
        textAlign: 'center',
        marginTop: 2,
    },
});

export default ProfileScreen;
