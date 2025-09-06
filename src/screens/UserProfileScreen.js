import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Button, Alert, Modal, FlatList, TouchableOpacity } from 'react-native';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import apiClient from '../api/apiClient';

const UserProfileScreen = () => {
  const route = useRoute();
  const { userId } = route.params;

  const [profile, setProfile] = useState(null);
  const [myRooms, setMyRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState();
  const [modalVisible, setModalVisible] = useState(false);
  const [pendingInviteRoomIds, setPendingInviteRoomIds] = useState([]);

  const fetchData = async () => {
    try {
      const [profileRes, myRoomsRes, pendingInvitesRes] = await Promise.all([
        apiClient.get(`/users/${userId}/profile`),
        apiClient.get('/rooms'),
        apiClient.get(`/invitations/sent-pending?recipientId=${userId}`), // <-- New API call
      ]);
      setProfile(profileRes.data);
      setMyRooms(myRoomsRes.data);
      setPendingInviteRoomIds(pendingInvitesRes.data); // <-- Set the new state
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, [userId]));
  
  const handleSendInvite = async () => {
    if (!selectedRoom) {
      return Alert.alert('Error', 'Please select a room to invite the user to.');
    }
    try {
      await apiClient.post('/invitations', {
        recipientId: userId,
        roomId: selectedRoom,
      });
      Alert.alert('Success!', `Invitation sent to ${profile.username}.`);
       fetchData();
      setModalVisible(false);
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Could not send invitation.');
    }
  };

  if (!profile) return null; // Or a loading indicator
  const isInvitePendingForSelectedRoom = pendingInviteRoomIds.includes(selectedRoom);

  return (
    <View style={styles.container}>
      {/* Invitation Modal */}
      <Modal visible={modalVisible} transparent={true} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Invite {profile.username} to...</Text>
            <Picker selectedValue={selectedRoom} onValueChange={(itemValue) => setSelectedRoom(itemValue)}>
              <Picker.Item label="-- Select a Room --" value={null} />
              {myRooms.map(room => <Picker.Item label={room.name} value={room.id} key={room.id} />)}
            </Picker>
            <Button 
              title={isInvitePendingForSelectedRoom ? "Invite Sent" : "Send Invite"} 
              onPress={handleSendInvite} 
              disabled={isInvitePendingForSelectedRoom} // <-- Disable button
            />
            <Button title="Cancel" onPress={() => setModalVisible(false)} color="gray" />
          </View>
        </View>
      </Modal>

      {/* Profile Info */}
      <Text style={styles.username}>{profile.username}</Text>
      <Text style={styles.detail}>{profile.full_name}</Text>
      <Text style={styles.detail}>{profile.college_name}</Text>
      <Button title="Invite to a Room" onPress={() => setModalVisible(true)} />
    </View>
  );
};

// ... (Add your own styles)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  username: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  detail: {
    fontSize: 16,
    marginBottom: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',   // centers vertically
    alignItems: 'center',       // centers horizontally
    backgroundColor: 'rgba(0,0,0,0.5)', // dim background
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
});


export default UserProfileScreen;