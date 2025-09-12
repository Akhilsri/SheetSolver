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
import ImageResizer from 'react-native-image-resizer';
import * as roomService from '../services/roomService';
import * as submissionService from '../services/submissionService';
import * as sheetService from '../services/sheetService';
import Sound from 'react-native-sound';

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
  const [uploadingProblemId, setUploadingProblemId] = useState(null);
  

  // --- THIS IS THE NEW, MORE ROBUST DATA FETCHING LOGIC ---
 const fetchData = async () => {
    try {
      setIsLoading(true);
      
      // First, get the core room details.
      const detailsRes = await roomService.getRoomDetails(roomId);
      const roomData = detailsRes.data;

      // Important: If for some reason the room doesn't exist, stop here.
      if (!roomData) {
        setIsLoading(false);
        Alert.alert('Error', 'Could not find room details.');
        return;
      }

      setRoomDetails(roomData);
      const isAdmin = roomData.admin_id === Number(userId);

      // Prepare the list of API calls to run in parallel
      const promises = [
        roomService.getRoomMembers(roomId),
        submissionService.getTodaysSubmissions(roomId),
      ];
      if (isAdmin) {
        promises.push(roomService.getJoinRequests(roomId));
        promises.push(sheetService.getAllSheets());
      }

      // Execute all promises
      const responses = await Promise.all(promises);
      
      // Safely assign the responses to state
      setMembers(responses[0].data);
      const submissionsData = responses[1].data;
      
      if (isAdmin) {
        // These will only exist in the array if the user is an admin
        setJoinRequests(responses[2].data);
        setSheets(responses[3].data);
      } else {
        setJoinRequests([]); // Ensure it's empty for non-admins
      }
      
      // Process submissions after they've been fetched
      setTodaysSubmissions(submissionsData.reduce((acc, sub) => {
        if (!acc[sub.problem_id]) acc[sub.problem_id] = [];
        acc[sub.problem_id].push(sub);
        return acc;
      }, {}));

      // Fetch daily problems and their status if the journey is active
      if (roomData.status === 'active') {
        const problemsRes = await roomService.getDailyProblems(roomId);
        const dailyProblemsData = problemsRes.data;
        setDailyProblems(dailyProblemsData);

        if (dailyProblemsData.length > 0) {
          const problemIds = dailyProblemsData.map(p => p.id);
          const statusRes = await submissionService.getSubmissionStatus(problemIds);
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
          {/* <Button onPress={logout} title="Logout" /> */}
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

  const handleMarkAsDone = (problem) => {
    requestCameraPermission().then(hasPermission => {
      if (!hasPermission) return;

      launchCamera({ mediaType: 'photo', quality: 1.0, saveToPhotos: true }, async (response) => {
        if (response.didCancel) {
          console.log('User cancelled image picker');
          return;
        }
        if (response.errorCode) {
          Alert.alert('Error', 'ImagePicker Error: ' + response.errorMessage);
          return;
        }
        if (!response.assets || response.assets.length === 0) {
          console.log('No image asset found.');
          return;
        }

        const originalImage = response.assets[0];
        setUploadingProblemId(problem.id);
        setIsUploading(true); // Also set the global uploading flag

        try {
          console.log('DEBUG: Image captured, preparing to resize...');
          const resizedImage = await ImageResizer.createResizedImage(
            originalImage.uri,
            1280, // Max width
            1280, // Max height
            'JPEG', // Format
            80, // Quality (0-100)
            0, // Rotation
            null // Output path
          );
          console.log('DEBUG: Image resized successfully. URI:', resizedImage.uri);

          const formData = new FormData();
          formData.append('proofImage', {
            uri: resizedImage.uri,
            type: 'image/jpeg',
            name: resizedImage.name,
          });
          formData.append('roomId', roomId);
          formData.append('problemId', problem.id);
          
          console.log('DEBUG: FormData created. Attempting to upload...');
          const submissionResponse = await submissionService.createSubmission(formData);

          const successSound = new Sound('success.mp3', Sound.MAIN_BUNDLE, (error) => {
              if (error) {
                  console.log('failed to load the sound', error);
                  return;
              }
              successSound.play((success) => {
                  if (success) {
                      console.log('successfully finished playing');
                  } else {
                      console.log('playback failed due to audio decoding errors');
                  }
                  successSound.release(); // Release the audio player resource
              });
          });
          
          console.log('DEBUG: Upload successful! Server response:', submissionResponse.data);
          
          const newBadges = submissionResponse.data.newBadges;
          let alertMessage = 'Your proof has been submitted.';
          if (newBadges && newBadges.length > 0) {
            alertMessage += `\n\n🎉 Badge Unlocked: ${newBadges.map(b => b.name).join(', ')}!`;
          }

          Alert.alert('Success!', alertMessage, [{ text: 'OK', onPress: () => fetchData() }]);
        
        } catch (error) {
          // --- THIS IS THE MOST IMPORTANT PART ---
          console.error('--- UPLOAD FAILED ---');
          if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.error('Server Response Data:', JSON.stringify(error.response.data, null, 2));
            console.error('Server Response Status:', error.response.status);
          } else if (error.request) {
            // The request was made but no response was received
            console.error('No response received from server. This is likely a Network Error.');
            console.error('Request details:', error.request);
          } else {
            // Something happened in setting up the request that triggered an Error
            console.error('Error setting up the request:', error.message);
          }
          console.error('----------------------');
          Alert.alert('Upload Failed', 'There was an error submitting your proof. Please try again.');
        } finally {
          setUploadingProblemId(null);
          setIsUploading(false);
        }
      });
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
      await roomService.removeMember(roomId, memberId);
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
      await roomService.startJourney(roomId, selectedSheet, duration);
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
      await roomService.approveJoinRequest(requestId);
      Alert.alert('Success', 'Member has been added to the room.');
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Could not approve request.');
    }
  };

  const handleDenyRequest = async (requestId) => {
    try {
      await roomService.denyJoinRequest(requestId);
      Alert.alert('Success', 'Request has been denied.');
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Could not deny request.');
    }
  };

  const handleLeaveRoom = () => {
    Alert.alert(
        "Leave Room",
        "Are you sure you want to leave this room?",
        [
            { text: "Cancel", style: "cancel" },
            { text: "Yes, Leave", onPress: async () => {
                try {
                    await apiClient.delete(`/rooms/${roomId}/leave`);
                    Alert.alert('Success', 'You have left the room.');
                    navigation.navigate('RoomsTab'); // Go back to the rooms list
                } catch (error) {
                    Alert.alert('Error', error.response?.data?.message || 'Could not leave the room.');
                }
            }, style: "destructive" }
        ]
    );
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
                <View style={styles.actionContainer}>
                {uploadingProblemId === item.id ? (
                  <ActivityIndicator color="#007BFF" />
                ) : (
                  isSolvedByMe ? (
                    <TouchableOpacity style={styles.completedContainer} onPress={() => openSnap(mySubmission?.photo_url)}>
                      <Text style={styles.completedText}>✅</Text>
                      <Text style={styles.completedBy}>You did it! (+{mySubmission?.points_awarded} pts)</Text>
                    </TouchableOpacity>
                  ) : (
                    <Button title="Done" onPress={() => handleMarkAsDone(item)} disabled={isUploading} />
                  )
                )}
              </View>
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
            {!isAdmin && ( // Only show leave button if user is NOT the admin
                    <View style={{padding: 20, backgroundColor: 'white'}}>
                        <Button title="Leave Room" color="red" onPress={handleLeaveRoom} />
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
  actionContainer: {
    width: 80, // Fixed width to prevent layout shifts
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default RoomDetailScreen;