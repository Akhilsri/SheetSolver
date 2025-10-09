import React, { useState, useCallback, useLayoutEffect, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Alert,
  SafeAreaView,
  Share, // <--- NEW: Import Share API
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import apiClient from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSocket } from '../context/SocketContext';

// --- Header Component (Decoupled for Optimization) ---
const RoomsHeaderRight = ({ navigation, logout, unreadCount }) => {
  const count = Number(unreadCount);

  return (
    <View style={styles.headerActions}>
      <TouchableOpacity
        onPress={() => navigation.navigate('Notifications')}
        style={styles.notificationButton}
        activeOpacity={0.7}
      >
        <View>
          <Icon name="notifications-outline" size={24} color="#6366F1" />
          {count > 0 && (
            <View style={styles.badge}> {/* Using original badge style now */}
              <Text style={styles.badgeText}>
                {count > 99 ? '99+' : count}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={logout}
        style={styles.logoutButton}
        activeOpacity={0.7}
      >
        <Icon name="log-out-outline" size={18} color="#EF4444" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
};

// RoomsScreen component
const RoomsScreen = () => {
  const navigation = useNavigation();
  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const { logout, unreadCount, fetchUnreadCount, userToken } = useAuth();
  const socket = useSocket();

  const fetchRooms = useCallback(async () => {
    if (!userToken) {
      setRooms([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const response = await apiClient.get('/rooms');
      setRooms(response.data || []);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      Alert.alert('Network Error', 'Could not load rooms. Check your connection.');
      setRooms([]);
    } finally {
      setIsLoading(false);
    }
  }, [userToken]);

  const fetchData = useCallback(() => {
    fetchRooms();
    fetchUnreadCount();
  }, [fetchRooms, fetchUnreadCount]);

  useFocusEffect(fetchData);

  useEffect(() => {
    if (!socket.current) return;
    const onNewNotification = (data) => {
      console.log('[SOCKET DEBUG] New notification received. Fetching count...');
      fetchUnreadCount();
    };

    socket.current.on('new_notification_received', onNewNotification);

    return () => {
      socket.current.off('new_notification_received', onNewNotification);
    };
  }, [socket.current, fetchUnreadCount]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <RoomsHeaderRight navigation={navigation} logout={logout} unreadCount={unreadCount} />
      ),
    });
  }, [navigation, logout, unreadCount]);

  const handleJoinRoom = useCallback(async () => {
    const trimmedCode = inviteCode.trim();
    if (!trimmedCode) {
      Alert.alert('Error', 'Please enter an invite code.');
      return;
    }

    try {
      setIsJoining(true);
      await apiClient.post('/rooms/join', { invite_code: trimmedCode });
      Alert.alert('Request Sent', 'Join request sent to admin.');
      setInviteCode('');
      fetchRooms();
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Could not send join request.';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsJoining(false);
    }
  }, [inviteCode, fetchRooms]);

  const handleCreateRoom = useCallback(() => {
    navigation.navigate('CreateRoom');
  }, [navigation]);

  const handleRoomPress = useCallback((item) => {
    navigation.navigate('RoomDetail', {
      roomId: item.id,
      roomName: item.name,
      inviteCode: item.invite_code,
    });
  }, [navigation]);

  // <--- NEW: handleShareRoom function ---
  const handleShareRoom = useCallback(async (roomName, inviteCode) => {
    try {
      const message = `Join my room "${roomName}" on SheetSolver! Use invite code: ${inviteCode}`;
      
      const result = await Share.share({
        message: message,
        // Optional: title for some platforms (e.g., email)
        title: `Join "${roomName}" on SheetSolver!`,
      });

      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          // Shared with activity type of result.activityType
          console.log(`Shared with activity type: ${result.activityType}`);
        } else {
          // Shared
          console.log('Content shared successfully.');
        }
      } else if (result.action === Share.dismissedAction) {
        // Dismissed
        console.log('Share dismissed.');
      }
    } catch (error) {
      console.error('Error sharing room:', error.message);
      Alert.alert('Sharing Error', 'Failed to share the room. Please try again later.');
    }
  }, []);
  // --- END NEW: handleShareRoom function ---

  const renderRoomItem = useCallback(({ item }) => (
    <TouchableOpacity
      style={styles.roomCard}
      onPress={() => handleRoomPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.roomIconContainer}>
        <Icon name="people" size={22} color="#6366F1" />
      </View>
      <View style={styles.roomInfo}>
        <Text style={styles.roomName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.inviteCode}>Code: {item.invite_code}</Text>
      </View>
      {/* <--- NEW: Share Button --- */}
      <TouchableOpacity
        style={styles.shareBtn}
        onPress={(e) => {
          e.stopPropagation(); // Prevent handleRoomPress from being called
          handleShareRoom(item.name, item.invite_code);
        }}
        activeOpacity={0.6}
      >
        <Icon name="share-social-outline" size={20} color="#6366F1" />
      </TouchableOpacity>
      {/* --- END NEW: Share Button --- */}
      <Icon name="chevron-forward" size={20} color="#9CA3AF" />
    </TouchableOpacity>
  ), [handleRoomPress, handleShareRoom]); // <--- NEW: Add handleShareRoom to dependencies

  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyState}>
      <Icon name="home-outline" size={60} color="#D1D5DB" />
      <Text style={styles.emptyTitle}>No rooms yet</Text>
      <Text style={styles.emptySubtitle}>
        Create or join a room to get started
      </Text>
    </View>
  ), []);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading your rooms...</Text>
      </SafeAreaView>
    );
  }

  const isJoinDisabled = !inviteCode.trim() || isJoining;

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={rooms}
        keyExtractor={(item) => `room_${item.id}`}
        renderItem={renderRoomItem}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListHeaderComponent={
          <View style={styles.roomsHeader}>
            <Text style={styles.sectionTitle}>Your Rooms</Text>
            <Text style={styles.roomCount}>
              {rooms.length} room{rooms.length !== 1 ? 's' : ''}
            </Text>
          </View>
        }
      />

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        {/* Join Room Inline */}
        <View style={styles.joinRow}>
          <TextInput
            style={styles.joinInput}
            placeholder="Enter Invite Code"
            placeholderTextColor="#9CA3AF"
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleJoinRoom}
            editable={!isJoining}
          />
          <TouchableOpacity
            style={[styles.joinBtn, isJoinDisabled && { backgroundColor: '#D1D5DB' }]}
            onPress={handleJoinRoom}
            disabled={isJoinDisabled}
          >
            {isJoining ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Icon name="arrow-forward" size={18} color="white" />
            )}
          </TouchableOpacity>
        </View>

        {/* Create Room */}
        <TouchableOpacity
          style={styles.createBtn}
          onPress={handleCreateRoom}
          activeOpacity={0.8}
        >
          <Icon name="add" size={20} color="white" />
          <Text style={styles.createBtnText}>Create New Room</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },

  // Header actions
  headerActions: { flexDirection: 'row', alignItems: 'center', paddingRight: 4 },
  notificationButton: { marginRight: 12, padding: 8, borderRadius: 20 },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutText: { color: '#EF4444', fontSize: 13, fontWeight: '600', marginLeft: 4 },

  // Using original badge styles now
  badge: {
    position: 'absolute', right: 0, top: 0, backgroundColor: '#EF4444',
    borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center',
    alignItems: 'center', borderWidth: 2, borderColor: 'white',
  },
  badgeText: { color: 'white', fontSize: 10, fontWeight: '700' },

  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#6B7280', fontWeight: '500' },

  // Rooms header
  roomsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  sectionTitle: { fontSize: 22, fontWeight: '700', color: '#1F2937' },
  roomCount: { fontSize: 14, color: '#6B7280', fontWeight: '600' },

  // Room card
 roomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  roomIconContainer: {
    width: 44, height: 44, backgroundColor: '#EEF2FF',
    borderRadius: 22, justifyContent: 'center', alignItems: 'center',
    marginRight: 14,
  },
  roomInfo: { flex: 1 },
  roomName: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  inviteCode: { fontSize: 13, color: '#6B7280', marginTop: 4 },

  // <--- NEW: Share Button Styles ---
  shareBtn: {
    marginRight: 10, // space between share and arrow
    padding: 6,
    borderRadius: 20,
  },
  // --- END NEW: Share Button Styles ---

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#374151', marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: '#9CA3AF', marginTop: 4 },

  // Bottom actions
  bottomActions: {
    backgroundColor: 'white', padding: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB',
  },
  joinRow: { flexDirection: 'row', marginBottom: 12 },
  joinInput: {
    flex: 1, borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 8, paddingHorizontal: 12, fontSize: 15, height: 44, backgroundColor: '#F9FAFB',
  },
  joinBtn: {
    marginLeft: 8, backgroundColor: '#6366F1', borderRadius: 8,
    paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center',
  },

  createBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#10B981', paddingVertical: 14, borderRadius: 10,
  },
  createBtnText: { color: 'white', fontSize: 16, fontWeight: '600', marginLeft: 6 },
});

export default RoomsScreen;