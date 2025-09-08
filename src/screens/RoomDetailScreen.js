import React, { useState, useCallback, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  ActivityIndicator,
  TextInput,
  Button,
  Alert,
  TouchableOpacity,
  Linking,
  Platform,
  PermissionsAndroid,
  Modal,
  Image
} from 'react-native';
import { useRoute, useFocusEffect, useNavigation } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import apiClient from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import { launchCamera } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/Ionicons';

const RoomDetailScreen = ({ navigation }) => {
  // --- Hooks and State Initialization ---
  const route = useRoute();
  const { userId, logout } = useAuth();
  const { roomId, roomName: initialRoomName } = route.params;

  const [isLoading, setIsLoading] = useState(true);
  const [roomDetails, setRoomDetails] = useState(null);
  const [members, setMembers] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [dailyProblems, setDailyProblems] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [todaysSubmissions, setTodaysSubmissions] = useState({});
  const [joinRequests, setJoinRequests] = useState([]);
  const [solvedProblemIds, setSolvedProblemIds] = useState([]); // <-- State for all-time solved status
  const [selectedSheet, setSelectedSheet] = useState();
  const [duration, setDuration] = useState('90');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  // --- THIS IS THE NEW, MORE ROBUST DATA FETCHING LOGIC ---
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const detailsRes = await apiClient.get(`/rooms/${roomId}`);
      const roomData = detailsRes.data;
      setRoomDetails(roomData);
      const isAdmin = roomData.admin_id === Number(userId);

      const promises = [
        apiClient.get(`/rooms/${roomId}/members`),
        apiClient.get(`/submissions/room/${roomId}/today`),
      ];
      if (isAdmin) {
        promises.push(apiClient.get(`/rooms/${roomId}/join-requests`));
        promises.push(apiClient.get('/sheets'));
      }

      const [membersRes, submissionsRes, requestsRes, sheetsRes] = await Promise.all(promises);
      
      setMembers(membersRes.data);
      if(requestsRes) setJoinRequests(requestsRes.data);
      if(sheetsRes) setSheets(sheetsRes.data);

      setTodaysSubmissions(submissionsRes.data.reduce((acc, sub) => {
        if (!acc[sub.problem_id]) acc[sub.problem_id] = [];
        acc[sub.problem_id].push(sub);
        return acc;
      }, {}));

      if (roomData && roomData.status === 'active') {
        const problemsRes = await apiClient.get(`/rooms/${roomId}/daily-problems`);
        const dailyProblemsData = problemsRes.data;
        setDailyProblems(dailyProblemsData);

        if (dailyProblemsData.length > 0) {
          const problemIds = dailyProblemsData.map(p => p.id);
          const statusRes = await apiClient.post('/submissions/status', { problemIds });
          setSolvedProblemIds(statusRes.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch screen data:', error);
      Alert.alert('Error', 'Could not load room details.');
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, [roomId]));

  useLayoutEffect(() => {
    navigation.setOptions({
      title: roomDetails?.name || initialRoomName,
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.navigate('Chat', { roomId: roomId, roomName: roomDetails?.name })} style={{ marginRight: 15 }}>
            <Icon name="chatbubbles-outline" size={24} color="#007BFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Leaderboard', { roomId: roomId, roomName: roomDetails?.name })} style={{ marginRight: 15 }}>
            <Icon name="trophy-outline" size={24} color="#007BFF" />
          </TouchableOpacity>
          <Button onPress={logout} title="Logout" />
        </View>
      ),
    });
  }, [navigation, logout, roomId, roomDetails]);
  
  // --- Permission and Handlers ---
  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
          title: "Camera Permission",
          message: "This app needs access to your camera to take a photo of your solved problem.",
          buttonPositive: "Allow",
          buttonNegative: "Deny",
        });
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const showSubmissionPicker = (submissions) => {
    if (submissions.length === 1) {
      openSnap(submissions[0].photo_url);
      return;
    }

    const buttons = submissions.map(submission => ({
      text: `View ${submission.username}'s Snap`,
      onPress: () => openSnap(submission.photo_url),
    }));

    buttons.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert('View a Submission','Choose a user to see their proof.',buttons);
  };

  const handleMarkAsDone = async (problem) => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    launchCamera({ mediaType: 'photo', quality: 0.5, saveToPhotos: true }, async (response) => {
      if (response.didCancel) return;
      if (response.errorCode) return Alert.alert('Error', 'ImagePicker Error: ' + response.errorMessage);

      if (response.assets && response.assets.length > 0) {
        const image = response.assets[0];
        const formData = new FormData();
        formData.append('proofImage', { uri: image.uri, type: image.type, name: image.fileName });
        formData.append('roomId', roomId);
        formData.append('problemId', problem.id);
        
        try {
          setIsUploading(true);
          // await apiClient.post('/submissions', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
          const submissionResponse = await apiClient.post('/submissions', formData, { 
            headers: { 'Content-Type': 'multipart/form-data' } 
          });
          
          // 2. Use the new variable to get the newBadges
          const newBadges = submissionResponse.data.newBadges;
          // --- END OF FIX ---

          let alertMessage = 'Your proof has been submitted.';
          if (newBadges && newBadges.length > 0) {
            const badgeNames = newBadges.map(b => b.name).join(', ');
            alertMessage += `\n\n🎉 Badge Unlocked: ${badgeNames}!`;
          }

          Alert.alert('Success!', 'Your proof has been submitted.', [{ text: 'OK', onPress: () => fetchData() }]);
        } catch (error) {
          console.error('Upload failed:', error.response?.data || error);
          Alert.alert('Upload Failed', 'There was an error submitting your proof.');
        } finally {
          setIsUploading(false);
        }
      }
    });
  };

  const confirmRemoveMember = (member) => {
    Alert.alert(
      "Remove Member",
      `Are you sure you want to remove ${member.username} from this room?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Yes, Remove", onPress: () => removeMember(member.id), style: "destructive" }
      ]
    );
  };

  const removeMember = async (memberId) => {
    try {
      await apiClient.delete(`/rooms/${roomId}/members/${memberId}`);
      Alert.alert('Success', 'Member has been removed.');
      fetchData();
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Could not remove member.';
      Alert.alert('Error', errorMessage);
    }
  };

  const handleStartJourney = async () => {
    if (!selectedSheet || !duration) {
      Alert.alert('Error', 'Please select a sheet and set a duration.');
      return;
    }
    try {
      await apiClient.post(`/rooms/${roomId}/start`, { sheetId: selectedSheet, duration: duration });
      Alert.alert('Success', 'The journey has begun!');
      fetchData();
    } catch (error) {
      console.error('Failed to start journey:', error);
      Alert.alert('Error', 'Could not start the journey.');
    }
  };

  const openSnap = (imageUrl) => {
    setSelectedImage(imageUrl);
    setModalVisible(true);
  };

  // NEW: Approve/Deny join requests
  const handleApproveRequest = async (requestId) => {
    try {
      await apiClient.put(`/rooms/join-requests/${requestId}/approve`);
      Alert.alert('Success', 'Member has been added to the room.');
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Could not approve request.');
    }
  };

  const handleDenyRequest = async (requestId) => {
    try {
      await apiClient.put(`/rooms/join-requests/${requestId}/deny`);
      Alert.alert('Success', 'Request has been denied.');
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Could not deny request.');
    }
  };

  // --- Prepare Data for SectionList ---
  const isAdmin = roomDetails && roomDetails.admin_id === Number(userId);
  const sections = [];
  if (isAdmin && joinRequests.length > 0) { sections.push({ title: 'Pending Join Requests', data: joinRequests }); }
  if (roomDetails?.status === 'active') { sections.push({ title: "Today's Problems", data: dailyProblems }); }
  sections.push({ title: `Members (${members.length})`, data: members });

  if (isLoading) { return <ActivityIndicator size="large" style={styles.centered} />; }
  if (!roomDetails) { return <View style={styles.centered}><Text>Room not found.</Text></View>; }


  return (
    <View style={{flex: 1}}>
      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <Image source={{ uri: selectedImage }} style={styles.modalImage} resizeMode="contain" />
          <Button title="Close" onPress={() => setModalVisible(false)} />
        </View>
      </Modal>

      <SectionList
        style={styles.container}
        sections={sections}
        keyExtractor={(item, index) => item.id.toString() + index}
        renderSectionHeader={({ section: { title } }) => <Text style={styles.sectionTitle}>{title}</Text>}
        renderItem={({ item, section }) => {
          if (section.title === 'Pending Join Requests') {
            return (
              <View style={styles.itemRow}>
                <Text style={styles.itemName}>{item.username}</Text>
                <View style={styles.buttonContainer}>
                  <Button title="Deny" color="red" onPress={() => handleDenyRequest(item.id)} />
                  <Button title="Approve" onPress={() => handleApproveRequest(item.id)} />
                </View>
              </View>
            );
          }

          if (section.title.startsWith('Members')) {
            return (
              <View style={styles.itemRow}>
                <Text style={styles.itemName}>{item.username}</Text>
                {isAdmin && Number(item.id) !== Number(roomDetails.admin_id) && (
                  <Button title="Remove" color="red" onPress={() => confirmRemoveMember(item)} />
                )}
              </View>
            );
          }

          if (section.title === "Today's Problems") {
            const isSolvedByMe = solvedProblemIds.includes(item.id);
            const mySubmission = isSolvedByMe ? (todaysSubmissions[item.id] || []).find(s => Number(s.user_id) === Number(userId)) : null;
            const otherSubmissions = (todaysSubmissions[item.id] || []).filter(s => Number(s.user_id) !== Number(userId));

            return (
              <View style={styles.itemRow}>
                <View style={styles.itemContent}>
                  <TouchableOpacity onPress={() => Linking.openURL(item.url)}>
                    <Text style={styles.itemName}>{item.title}</Text>
                    <Text style={styles.itemSubtext}>Topic: {item.topic} | Difficulty: {item.difficulty}</Text>
                  </TouchableOpacity>
                  {otherSubmissions.length > 0 && (
                    <TouchableOpacity onPress={() => showSubmissionPicker(otherSubmissions)}>
                      <Text style={styles.othersCompletedText}>
                        ✅ Also completed by: {otherSubmissions.map(s => `${s.username} (+${s.points_awarded} pts)`).join(', ')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                {isSolvedByMe ? (
                  <TouchableOpacity style={styles.completedContainer} onPress={() => openSnap(mySubmission?.photo_url)}>
                    <Text style={styles.completedText}>✅</Text>
                    <Text style={styles.completedBy}>You did it! (+{mySubmission?.points_awarded} pts)</Text>
                  </TouchableOpacity>
                ) : (
                  <Button title="Done" onPress={() => handleMarkAsDone(item)} disabled={isUploading} />
                )}
              </View>
            );
          }

          return null;
        }}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Text style={styles.roomName}>{roomDetails.name}</Text>
              <Text style={styles.inviteCode}>Invite Code: {roomDetails.invite_code}</Text>
              {roomDetails.status === 'active' && (
                <View style={{marginTop: 15}}>
                  <Button 
                    title="View Full Sheet" 
                    onPress={() => navigation.navigate('FullSheet', { roomId: roomId, roomName: roomDetails.name })} 
                  />
                </View>
              )}
            </View>
            {isAdmin && roomDetails.status === 'pending' && (
              <View style={styles.adminPanel}>
                <Text style={styles.panelTitle}>Admin Controls: Setup Journey</Text>
                <Text style={styles.label}>Select a Sheet:</Text>
                <Picker selectedValue={selectedSheet} onValueChange={(itemValue) => setSelectedSheet(itemValue)}>
                  <Picker.Item label="-- Choose a sheet --" value={null} />
                  {sheets.map((sheet) => <Picker.Item label={sheet.name} value={sheet.id} key={sheet.id} />)}
                </Picker>
                <Text style={styles.label}>Set a Duration (in days):</Text>
                <TextInput style={styles.input} placeholder="e.g., 90" value={duration} onChangeText={setDuration} keyboardType="numeric" />
                <Button title="Start Journey for All Members" onPress={handleStartJourney} />
              </View>
            )}
          </>
        }
        ListEmptyComponent={<Text style={styles.emptyText}>Nothing to show here yet.</Text>}
      />
    </View>
  );
};



// --- Styles ---
const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { padding: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#ddd' },
  roomName: { fontSize: 24, fontWeight: 'bold' },
  inviteCode: { fontSize: 16, color: 'gray', marginTop: 5 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10, backgroundColor: '#f5f5f5' },
  itemRow: {
    backgroundColor: 'white',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemContent: { flex: 1, marginRight: 10 },
  itemName: { fontSize: 16 },
  itemSubtext: { fontSize: 12, color: 'gray', marginTop: 4 },
  adminPanel: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#ddd' },
  panelTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  label: { fontSize: 16, color: '#333', marginBottom: 5, marginTop: 10 },
  input: { height: 40, borderColor: 'gray', borderWidth: 1, marginBottom: 20, paddingHorizontal: 10, borderRadius: 4 },
  emptyText: { textAlign: 'center', marginTop: 50, color: 'gray' },
  othersCompletedText: { fontSize: 12, color: 'gray', fontStyle: 'italic', marginTop: 8 },
  completedContainer: { alignItems: 'center', width: 80 },
  completedText: { fontSize: 24 },
  completedBy: { fontSize: 10, color: 'green', fontWeight: 'bold' },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
  },
  modalImage: {
    width: '100%',
    height: '80%',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
  },
});

export default RoomDetailScreen;