import React, { useState, useCallback, useLayoutEffect } from 'react';
import { View, Text, Button, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import apiClient from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import Icon from 'react-native-vector-icons/Ionicons';

const RoomsScreen = () => {
  const navigation = useNavigation();
  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState('');
  const { logout, unreadCount, fetchUnreadCount } = useAuth();

  // This effect will run every time the screen comes into focus
  useFocusEffect(useCallback(() => {
    fetchRooms();
    fetchUnreadCount();
  }, []));

  // This effect sets up the header buttons
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Bell Icon for Notifications */}
          <TouchableOpacity 
            onPress={() => navigation.navigate('Notifications')}
            style={{ marginRight: 15 }}
          >
            <View>
              <Icon name="notifications-outline" size={24} color="#007BFF" />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          {/* The missing Logout Button */}
          <Button onPress={logout} title="Logout" />
        </View>
      ),
    });
  }, [navigation, logout, unreadCount]); // Dependency array is now correct


  const fetchRooms = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/rooms');
      setRooms(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Error', 'Please enter an invite code.');
      return;
    }
    try {
      // The backend now creates a request instead of an instant join
      await apiClient.post('/rooms/join', { invite_code: inviteCode });
      
      // --- CHANGE THIS ALERT MESSAGE ---
      Alert.alert(
        'Request Sent', 
        'Your request to join the room has been sent to the admin for approval.'
      );
      setInviteCode('');
      // We don't need to fetchRooms() here anymore because the user hasn't joined yet
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Could not send join request.';
      Alert.alert('Error', errorMessage);
    }
  };

  const renderRoomItem = ({ item }) => (
    <TouchableOpacity
      style={styles.roomItem}
      onPress={() => navigation.navigate('RoomDetail', {
        roomId: item.id,
        roomName: item.name,
        inviteCode: item.invite_code,
      })}
    >
      <Text style={styles.roomName}>{item.name}</Text>
      <Text style={styles.inviteCode}>Invite Code: {item.invite_code}</Text>
    </TouchableOpacity>
  );

  if (isLoading) {
    return <ActivityIndicator size="large" style={{ flex: 1, justifyContent: 'center' }} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.joinContainer}>
        <TextInput
          style={styles.input}
          placeholder="Enter Invite Code"
          value={inviteCode}
          onChangeText={setInviteCode}
          autoCapitalize="characters"
        />
        <Button title="Join Room" onPress={handleJoinRoom} />
      </View>

      <Button
        title="Or Create a New Room"
        onPress={() => navigation.navigate('CreateRoom')}
      />

      <FlatList
        data={rooms}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderRoomItem}
        ListEmptyComponent={<Text style={styles.emptyText}>No rooms yet. Join or create one!</Text>}
        style={{ marginTop: 20 }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 10 },
    joinContainer: {
      marginBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: '#eee',
      paddingBottom: 20,
    },
    input: {
      height: 40,
      borderColor: 'gray',
      borderWidth: 1,
      marginBottom: 10,
      paddingHorizontal: 10,
    },
    roomItem: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#ccc' },
    roomName: { fontSize: 18, fontWeight: 'bold' },
    inviteCode: { fontSize: 14, color: '#555', marginTop: 5 },
    emptyText: { textAlign: 'center', marginTop: 50 },
    badge: {
      position: 'absolute',
      right: 0,
      top: 0,
      backgroundColor: 'red',
      borderRadius: 9,
      width: 14,
      height: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    badgeText: {
      color: 'white',
      fontSize: 10,
      fontWeight: 'bold',
    },
});

export default RoomsScreen;