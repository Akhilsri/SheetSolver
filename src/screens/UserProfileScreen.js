import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Button, Alert, Modal, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRoute, useFocusEffect, useNavigation } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import apiClient from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import { COLORS, SIZES, FONTS } from '../styles/theme';

const UserProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId: profileUserId } = route.params;
  const { userId: currentUserId } = useAuth();

  const [profile, setProfile] = useState(null);
  const [myRooms, setMyRooms] = useState([]);
  const [profileUserRooms, setProfileUserRooms] = useState([]); // <-- NEW: Stores the rooms the other user is in
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [pendingInviteRoomIds, setPendingInviteRoomIds] = useState([]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [profileDataRes, myRoomsRes, connStatusRes, pendingInvitesRes] = await Promise.all([
        apiClient.get(`/users/${profileUserId}/profile`), // This now returns { profile, memberOfRoomIds }
        apiClient.get('/rooms'),
        apiClient.get(`/connections/status/${profileUserId}`),
        apiClient.get(`/invitations/sent-pending?recipientId=${profileUserId}`),
      ]);
      
      setProfile(profileDataRes.data.profile); // <-- Set profile from the nested object
      setProfileUserRooms(profileDataRes.data.memberOfRoomIds); // <-- Set the new state
      
      setMyRooms(myRoomsRes.data);
      setConnectionStatus(connStatusRes.data);
      setPendingInviteRoomIds(pendingInvitesRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      Alert.alert('Error', 'Could not load user profile.');
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, [profileUserId]));
  
  const handleSendInvite = async () => {
    if (!selectedRoom) {
      return Alert.alert('Error', 'Please select a room to invite the user to.');
    }
    try {
      await apiClient.post('/invitations', {
        recipientId: profileUserId, // Use the correct variable
        roomId: selectedRoom,
      });
      Alert.alert('Success!', `Invitation sent to ${profile.username}.`);
      fetchData();
      setModalVisible(false);
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Could not send invitation.');
    }
  };

  const handleSendConnectionRequest = async () => {
    try {
        await apiClient.post('/connections/request', { recipientId: profileUserId });
        Alert.alert('Success', 'Connection request sent!');
        fetchData();
    } catch (error) {
        Alert.alert('Error', error.response?.data?.message || 'Could not send request.');
    }
  };
  
  // --- THESE ARE THE MISSING FUNCTIONS ---
  const confirmRemoveConnection = () => {
    Alert.alert(
      "Remove Connection",
      `Are you sure you want to remove ${profile.username} from your connections?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Yes, Remove", onPress: handleRemoveConnection, style: "destructive" }
      ]
    );
  };

  const handleRemoveConnection = async () => {
    try {
      await apiClient.delete(`/connections/user/${profileUserId}`);
      Alert.alert('Success', 'Connection removed.');
      fetchData(); // Refresh the screen to update the button state
    } catch (error) {
      Alert.alert('Error', 'Could not remove connection.');
    }
  };
  // ------------------------------------

  const renderConnectionButton = () => {
    if (!connectionStatus || Number(currentUserId) === Number(profileUserId)) return null;

    switch (connectionStatus.status) {
      case 'accepted':
        // This button now correctly calls the confirmation function
        return <Button title="Connected ✅" onPress={confirmRemoveConnection} color={COLORS.success} />;
      case 'pending':
        if (connectionStatus.action_user_id !== Number(currentUserId)) {
          return <Button title="Respond to Request" onPress={() => navigation.navigate('Notifications')} />;
        }
        return <Button title="Request Sent" disabled />;
      default:
        return <Button title="Add Connection" onPress={handleSendConnectionRequest} color={COLORS.primary}/>;
    }
  };

  if (isLoading) { return <ActivityIndicator size="large" style={styles.centered} />; }
  if (!profile) return <View style={styles.centered}><Text>User not found.</Text></View>;

   const isInvitePendingForSelectedRoom = pendingInviteRoomIds.includes(selectedRoom);
  const isAlreadyMemberOfSelectedRoom = profileUserRooms.includes(selectedRoom);

  return (
    <View style={styles.container}>
      <Modal visible={modalVisible} transparent={true} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Invite {profile.username} to...</Text>
            <Picker selectedValue={selectedRoom} onValueChange={(itemValue) => setSelectedRoom(itemValue)}>
              <Picker.Item label="-- Select a Room --" value={null} />
              {myRooms.map(room => {
                const isAlreadyMember = profileUserRooms.includes(room.id);
                return (
                  <Picker.Item 
                    key={room.id}
                    label={`${room.name}${isAlreadyMember ? ' (Already a member)' : ''}`} 
                    value={room.id}
                    enabled={!isAlreadyMember} // This disables the item
                  />
                );
              })}
            </Picker>
            <View style={{marginBottom: SIZES.base}}>
              <Button 
                title={isInvitePendingForSelectedRoom ? "Invite Sent" : "Send Invite"} 
                onPress={handleSendInvite} 
                // Also disable the send button if the user is already a member of the selected room
                disabled={isInvitePendingForSelectedRoom || isAlreadyMemberOfSelectedRoom}
                color={COLORS.primary}
              />
            </View>
            <Button title="Cancel" onPress={() => setModalVisible(false)} color={COLORS.textSecondary} />
          </View>
        </View>
      </Modal>

      <Text style={styles.username}>{profile.username}</Text>
      <Text style={styles.detail}>{profile.full_name || 'Name not set'}</Text>
      <Text style={styles.detail}>{profile.college_name || 'College not set'}</Text>
      <View style={styles.buttonContainer}>
        {renderConnectionButton()}
        <Button title="Invite to a Room" onPress={() => setModalVisible(true)} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  username: { fontSize: 24, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  detail: { fontSize: 16, color: 'gray', marginBottom: 4, textAlign: 'center' },
  buttonContainer: { marginTop: 20, gap: 10 },
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { width: '85%', backgroundColor: 'white', borderRadius: 10, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
});

export default UserProfileScreen;