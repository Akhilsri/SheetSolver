import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions, TouchableOpacity, FlatList } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Calendar } from 'react-native-calendars';
import apiClient from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import Icon from 'react-native-vector-icons/Ionicons';

const screenWidth = Dimensions.get('window').width;

// A new, reusable component for the journey cards
const JourneyCard = ({ journey, navigation }) => {
  const progress = journey.total_problems > 0 ? (journey.solved_problems / journey.total_problems) : 0;
  const progressPercent = Math.round(progress * 100);

  return (
    <TouchableOpacity 
      style={styles.journeyCard} 
      onPress={() => navigation.navigate('RoomDetail', {
        roomId: journey.id,
        roomName: journey.name,
      })}
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

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/users/progress-dashboard');
      setDashboardData(response.data);
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

  return (
    <ScrollView style={styles.container}>
      {/* --- USER HEADER --- */}
      <View style={styles.header}>
        <View>
            <Text style={styles.fullName}>{userInfo.full_name || userInfo.username}</Text>
            <Text style={styles.username}>@{userInfo.username}</Text>
        </View>
        <TouchableOpacity style={styles.editButton} onPress={() => navigation.navigate('EditProfile')}>
            <Icon name="pencil-outline" size={20} color="#007BFF"/>
        </TouchableOpacity>
      </View>

      {/* --- STATS CARDS --- */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{userInfo.current_streak || 0} 🔥</Text>
          <Text style={styles.statLabel}>Current Streak</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{userInfo.max_streak || 0}</Text>
          <Text style={styles.statLabel}>Max Streak</Text>
        </View>
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
          />
        ) : (
          <Text style={styles.noJourneyText}>No active journeys. Join a room to get started!</Text>
        )}
      </View>

      {/* --- PROFILE DETAILS SECTION --- */}
      <View style={styles.section}>
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
      </View>

      {/* --- CALENDAR --- */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Solving Activity</Text>
        <Calendar
          markedDates={markedDates}
          theme={{
            calendarBackground: '#ffffff',
            arrowColor: '#007BFF',
            monthTextColor: '#121212',
            textMonthFontWeight: 'bold',
          }}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    container: { flex: 1, backgroundColor: '#f0f4f7' },
    header: {
        backgroundColor: 'white', paddingHorizontal: 20, paddingTop: 40, paddingBottom: 20, borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
    },
    fullName: { fontSize: 24, fontWeight: 'bold', color: '#121212' },
    username: { fontSize: 16, color: 'gray' },
    editButton: { padding: 10, borderRadius: 20, backgroundColor: '#eef6ff' },
    section: {
        backgroundColor: 'white', borderRadius: 12, marginHorizontal: 20, marginTop: 20,
        padding: 15, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05, shadowRadius: 2,
    },
    sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 15, color: '#333' },
    statsContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 20 },
    statBox: { backgroundColor: 'white', borderRadius: 12, padding: 20, width: '48%', alignItems: 'center', elevation: 2 },
    statValue: { fontSize: 22, fontWeight: 'bold', color: '#007BFF' },
    statLabel: { fontSize: 14, color: 'gray', marginTop: 5 },
    dateText: { fontSize: 12, color: 'gray', marginTop: 10 },
    noJourneyText: { fontSize: 14, color: 'gray', fontStyle: 'italic' },
    progressContainer: { marginTop: 10 },
    progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    progressText: { fontSize: 12, color: 'gray' },
    progressBarBackground: { height: 12, width: '100%', backgroundColor: '#e0e0e0', borderRadius: 6, overflow: 'hidden' },
    progressBarFill: { height: '100%', backgroundColor: '#28a745', borderRadius: 6 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    detailLabel: { fontSize: 16, color: 'gray' },
    detailValue: { fontSize: 16, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
    journeyCard: {
        backgroundColor: '#eef6ff',
        borderRadius: 12,
        padding: 15,
        width: screenWidth * 0.7,
        marginRight: 15,
        borderWidth: 1,
        borderColor: '#007BFF',
    },
    journeyRoomName: { fontSize: 16, fontWeight: 'bold', color: '#121212' },
    journeySheetName: { fontSize: 14, color: '#333', marginBottom: 10 },
});

export default ProfileScreen;