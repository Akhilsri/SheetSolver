import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Button, Alert, Modal, ActivityIndicator, Image, Linking, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useRoute, useFocusEffect, useNavigation } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import apiClient from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import { COLORS, SIZES, FONTS } from '../styles/theme';
import Icon from 'react-native-vector-icons/Ionicons';
import Card from '../components/common/Card';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; 

const UserProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { userId: profileUserId } = route.params;
  const { userId: currentUserId } = useAuth();

  const [profile, setProfile] = useState(null);
  const [myRooms, setMyRooms] = useState([]);
  const [profileUserRooms, setProfileUserRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [inviteStatuses, setInviteStatuses] = useState({});

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [profileDataRes, myRoomsRes, connStatusRes, inviteStatusRes] = await Promise.all([
        apiClient.get(`/users/${profileUserId}/profile`),
        apiClient.get('/rooms'),
        apiClient.get(`/connections/status/${profileUserId}`),
        apiClient.get(`/invitations/sent-status/${profileUserId}`),
      ]);
      setProfile(profileDataRes.data.profile);
      setProfileUserRooms(profileDataRes.data.memberOfRoomIds);
      
      // FIX 1: Robust filtering for null/undefined entries AND entries missing name/id
      setMyRooms(myRoomsRes.data.filter(r => r && r.id && r.name)); 
      
      setConnectionStatus(connStatusRes.data);
      setInviteStatuses(inviteStatusRes.data); 
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
        recipientId: profileUserId,
        roomId: selectedRoom,
      });
      Alert.alert('Success!', `Invitation sent to ${profile.username}.`);
      fetchData();
      setModalVisible(false);
    } catch (error) {
      const errorMessage = error.response?.data?.message;
      if (errorMessage?.includes('Duplicate entry') || errorMessage?.includes('already exists')) {
          Alert.alert('Error', 'An invitation to this room is already Pending or Accepted.');
      } else {
          Alert.alert('Error', errorMessage || 'Could not send invitation.');
      }
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
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Could not remove connection.');
    }
  };

  const renderConnectionButton = () => {
    if (!connectionStatus || Number(currentUserId) === Number(profileUserId)) return null;

    switch (connectionStatus.status) {
      case 'accepted':
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

  // Determine current status of the selected room
  const selectedRoomStatus = inviteStatuses[selectedRoom] || 'none';
  const isAlreadyMemberOfSelectedRoom = profileUserRooms.includes(selectedRoom);
  
  // Helper function to determine button state based on status
  const renderInviteButtonProps = () => {
    // If user is already a member (primary data check), block invite.
    if (isAlreadyMemberOfSelectedRoom) {
      return { title: "Already Member", disabled: true };
    }
    
    switch (selectedRoomStatus) {
      case 'pending':
        return { title: "Invite Sent (Pending)", disabled: true };
      case 'accepted':
      case 'declined':
      // If declined/stale accepted, allow resend
      return { title: "Resend Invite", disabled: !selectedRoom };
        
      default:
        return { title: "Send Invite", disabled: !selectedRoom };
    }
  };

  const { title: inviteButtonTitle, disabled: inviteButtonDisabled } = renderInviteButtonProps();


  return (
    <ScrollView style={styles.container}>
      {/* 🌟 MODAL FIX AND UI UPGRADE */}
      <Modal 
        visible={modalVisible} 
        transparent={true} 
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity 
            style={styles.modalContainer} 
            activeOpacity={1} 
            onPressOut={() => setModalVisible(false)}
        >
          <View style={[styles.modalContent, {paddingBottom: insets.bottom + SIZES.padding * 2}]}> 
                <View style={styles.modalGrabber} />
                <Text style={styles.modalTitle}>Invite {profile.username}</Text>
                <Text style={styles.modalSubtitle}>Select a room where you are an admin or member to send an invitation.</Text>

                <View style={styles.pickerWrapper}>
                    <Picker 
                        selectedValue={selectedRoom} 
                        onValueChange={(itemValue) => setSelectedRoom(itemValue)}
                        style={styles.picker}
                    >
                        {/* FIX 2: Only show the placeholder if nothing is selected */}
                        {selectedRoom === null && (
                          <Picker.Item 
                              label="-- Select a Room --" 
                              value={null} 
                              style={{color:'black'}}
                          />
                        )}
                        
                        {myRooms.map(room => {
                            const isAlreadyMember = profileUserRooms.includes(room.id);
                            const inviteStatus = inviteStatuses[room.id] || 'none';
                            let labelExtra = '';
                            if (isAlreadyMember) labelExtra = ' (Member)';
                            else if (inviteStatus === 'pending') labelExtra = ' (Pending)';
                            else if (inviteStatus === 'declined') labelExtra = ' (Declined)';
                            else if (inviteStatus === 'accepted') labelExtra = ' (Accepted)';

                            return (
                                <Picker.Item 
                                    key={room.id}
                                    label={`${room.name}${labelExtra}`} 
                                    value={room.id}
                                    enabled={!isAlreadyMember && inviteStatus !== 'pending'}
                                />
                            );
                        })}
                    </Picker>
                </View>

                <View style={styles.modalButtonRow}>
                    <TouchableOpacity 
                        style={[styles.modalButton, styles.modalCancelButton]} 
                        onPress={() => setModalVisible(false)}
                    >
                        <Text style={styles.modalCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.modalButton, styles.modalPrimaryButton, inviteButtonDisabled && styles.modalDisabledButton]} 
                        onPress={handleSendInvite} 
                        disabled={inviteButtonDisabled}
                    >
                        <Text style={styles.modalPrimaryText}>{inviteButtonTitle}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
      </Modal>

        <View style={styles.header}>
         <Image source={profile.avatar_url ? { uri: profile.avatar_url } : require('../assets/images/default_avatar.png')} style={styles.avatar} />
        <Text style={styles.fullName}>{profile.full_name || profile.username}</Text>
        <Text style={styles.username}>@{profile.username}</Text>
        <View style={styles.socialsContainer}>
          {profile.github_url && <TouchableOpacity onPress={() => Linking.openURL(profile.github_url)}><Icon name="logo-github" size={28} color={COLORS.textSecondary} /></TouchableOpacity>}
          {profile.linkedin_url && <TouchableOpacity onPress={() => Linking.openURL(profile.linkedin_url)}><Icon name="logo-linkedin" size={28} color={COLORS.textSecondary} /></TouchableOpacity>}
        </View>
      </View>

      <View style={styles.buttonContainer}>
        {renderConnectionButton()}
        <Button title="Invite to a Room" onPress={() => setModalVisible(true)} />
      </View>

      <Card style={{ margin: SIZES.padding }}>
        <Text style={styles.sectionTitle}>Stats</Text>
        <View style={styles.detailRow}><Text style={styles.detailLabel}>Current Streak:</Text><Text style={styles.detailValue}>{profile.current_streak || 0} 🔥</Text></View>
        <View style={styles.detailRow}><Text style={styles.detailLabel}>Compete Rating:</Text><Text style={styles.detailValue}>{profile.rating || 1200}</Text></View>
      </Card>
    </ScrollView>
  );
};


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { alignItems: 'center', backgroundColor: COLORS.surface, padding: SIZES.padding, borderBottomLeftRadius: SIZES.radius, borderBottomRightRadius: SIZES.radius, elevation: 2 },
    avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: COLORS.primary, marginBottom: SIZES.base },
    fullName: { ...FONTS.h1, marginTop: SIZES.base },
    username: { ...FONTS.body, color: COLORS.textSecondary },
    socialsContainer: { flexDirection: 'row', gap: SIZES.padding, marginVertical: SIZES.padding },
    buttonContainer: { paddingHorizontal: SIZES.padding, marginTop: SIZES.padding, gap: SIZES.base },
    sectionTitle: { ...FONTS.h3, marginBottom: SIZES.base },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SIZES.base, borderTopWidth: 1, borderTopColor: COLORS.background },
    detailLabel: { ...FONTS.body, color: COLORS.textSecondary },
    detailValue: { ...FONTS.body, fontWeight: 'bold' },
    
  // 🌟 MODAL STYLES (Modern Bottom Sheet Look) 
  modalContainer: { 
    flex: 1, 
    justifyContent: 'flex-end', 
    backgroundColor: 'rgba(0,0,0,0.6)' 
  },
  modalContent: { 
    width: '100%', 
    backgroundColor: 'white', 
    borderTopLeftRadius: 20, 
    borderTopRightRadius: 20,
    padding: SIZES.padding * 1.5,
    paddingHorizontal: SIZES.padding * 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  modalGrabber: { 
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: SIZES.padding,
  },
  modalTitle: { 
    ...FONTS.h2, 
    fontWeight: '800', 
    marginBottom: SIZES.base / 2, 
    textAlign: 'center',
    color: COLORS.textPrimary,
  },
  modalSubtitle: {
    ...FONTS.body,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SIZES.padding * 2,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    overflow: 'hidden',
    marginBottom: SIZES.padding * 1.5,
    ...Platform.select({
      ios: { height: 150 }, 
      android: { height: 50, justifyContent: 'center' },
    }),
  },
  picker: {
    ...Platform.select({
      ios: { height: 150 },
      android: { height: 60 },
    }),
    color:'black'
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SIZES.base,
  },
  modalButton: {
    flex: 1,
    paddingVertical: SIZES.padding,
    borderRadius: SIZES.radius,
    alignItems: 'center',
  },
  modalPrimaryButton: {
    backgroundColor: COLORS.primary,
  },
  modalCancelButton: {
    backgroundColor: '#E5E7EB',
  },
  modalPrimaryText: {
    color: 'white',
    ...FONTS.body,
    fontWeight: 'bold',
  },
  modalCancelText: {
    color: COLORS.textPrimary,
    ...FONTS.body,
    fontWeight: 'bold',
  },
  modalDisabledButton: {
    opacity: 0.5,
  }
});

export default UserProfileScreen;