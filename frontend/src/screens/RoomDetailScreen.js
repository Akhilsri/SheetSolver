import React, { useState, useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  ActivityIndicator,
  TextInput,
  Alert,
  TouchableOpacity,
  Platform,
  PermissionsAndroid,
  Modal,
  Image,
  SafeAreaView,
  Dimensions,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRoute, useFocusEffect } from '@react-navigation/native';
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
import { COLORS, SIZES, FONTS } from '../styles/theme';
import Card from '../components/common/Card';
import RoomGuideModal from '../components/modals/RoomGuideModal';
import RNPickerSelect from 'react-native-picker-select';
import ImageZoom from 'react-native-image-pan-zoom';

// Constants
const SCREEN_WIDTH = Dimensions.get('window').width;
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.85;

/* -------------------------
    Small memo components
    -------------------------*/
const IconButton = React.memo(({ name, color = COLORS.primary, size = 24, onPress, style, disabled = false }) => (
  <TouchableOpacity onPress={onPress} style={[{ padding: SIZES.base }, style]} activeOpacity={0.7} disabled={disabled}>
    <Icon name={name} size={size} color={color} />
  </TouchableOpacity>
));

const CustomButton = React.memo(({ title, onPress, color = COLORS.primary, outline = false, style = {}, disabled = false, loading = false }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[
      styles.customButton,
      { backgroundColor: outline || disabled ? COLORS.surface : color, borderColor: color },
      disabled && styles.disabledButton,
      style
    ]}
    disabled={disabled || loading}
  >
    {loading ? (
      <ActivityIndicator size="small" color={outline ? color : COLORS.surface} />
    ) : (
      <Text style={[styles.customButtonText, { color: outline ? color : COLORS.surface }, disabled && styles.disabledButtonText]}>
        {title}
      </Text>
    )}
  </TouchableOpacity>
));

/* -------------------------
    Today's Standing Sidebar
    -------------------------*/
const TodayStandingSidebar = React.memo(({ visible, onClose, data = [], userId }) => {
  if (!visible) return null;

  if (!data || data.length === 0) {
    return (
      <Modal transparent visible={visible} animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.sidebar}>
            <View style={styles.sidebarHeader}>
              <Text style={styles.sidebarTitle}>Today's Standings</Text>
              <TouchableOpacity onPress={onClose}>
                <Icon name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.noData}>No data available</Text>
          </View>
        </View>
      </Modal>
    );
  }

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      if (Number(a.userId) === Number(userId)) return -1;
      if (Number(b.userId) === Number(userId)) return 1;
      return (Number(b.solvedCount) || 0) - (Number(a.solvedCount) || 0);
    });
  }, [data, userId]);

  return (
    <Modal transparent visible={visible} animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sidebar}>
          <View style={styles.sidebarHeader}>
            <Text style={styles.sidebarTitle}>Today's Standings</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {sortedData.map((member, index) => {
              const isCurrentUser = Number(member.userId) === Number(userId);
              const total = Number(member.totalCount) || 0;
              const solved = Number(member.solvedCount) || 0;
              const progressPercentage = total > 0 ? Math.round((solved / total) * 100) : 0;

              return (
                <View
                  key={member.userId ?? index}
                  style={[styles.memberRow, isCurrentUser && styles.currentUserRow]}
                >
                  <Text style={[styles.rank, isCurrentUser && styles.currentUserText]}>
                    {index + 1}.
                  </Text>
                  <Text style={[styles.memberNameText, isCurrentUser && styles.currentUserText]}>
                    {member.username} {isCurrentUser ? '(You)' : ''}
                  </Text>
                  <View style={styles.progressWrapper}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${progressPercentage}%`,
                          backgroundColor: isCurrentUser ? COLORS.primary : COLORS.success,
                        },
                      ]}
                    />
                    <Text style={styles.progressText}>
                      {solved}/{total}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
});


/* -------------------------------------
    Submission Details Input Modal
    -------------------------------------*/
const SubmissionDetailsModal = React.memo(({ visible, problem, photoUri, onSubmit, onCancel, isLoading }) => {
  const [approach, setApproach] = useState('');
  const [timeComplexity, setTimeComplexity] = useState('');
  const [spaceComplexity, setSpaceComplexity] = useState('');

  useLayoutEffect(() => {
    if (visible) {
      setApproach('');
      setTimeComplexity('');
      setSpaceComplexity('');
    }
  }, [visible]);

  const handleSubmit = useCallback(() => {
    if (!approach.trim() || !timeComplexity.trim() || !spaceComplexity.trim()) {
      Alert.alert('Incomplete Details', 'Please fill in all required fields (approach, time complexity, and space complexity).');
      return;
    }
    onSubmit({
      problem,
      photoUri,
      approach,
      timeComplexity,
      spaceComplexity,
    });
  }, [problem, photoUri, approach, timeComplexity, spaceComplexity, onSubmit]);

  if (!visible) return null;

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Submission Details for: {problem?.title ?? 'Problem'}</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
            
            <Text style={styles.label}>My Approach: (Required)</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              placeholder="e.g., Used a HashMap to store frequencies..."
              value={approach}
              onChangeText={setApproach}
              multiline={true}
              numberOfLines={4}
              placeholderTextColor={'gray'}
              editable={!isLoading}
            />
            
            <Text style={styles.label}>Time Complexity: (Required)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., O(N) or O(logN)"
              value={timeComplexity}
              onChangeText={setTimeComplexity}
              placeholderTextColor={'gray'}
              autoCapitalize="none"
              editable={!isLoading}
            />
            
            <Text style={styles.label}>Space Complexity: (Required)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., O(1) or O(N)"
              value={spaceComplexity}
              onChangeText={setSpaceComplexity}
              placeholderTextColor={'gray'}
              autoCapitalize="none"
              editable={!isLoading}
            />
            
            <View style={styles.buttonGroup}>
              <CustomButton title="Cancel" outline onPress={onCancel} style={styles.halfButton} disabled={isLoading} />
              <CustomButton 
                title="Submit Proof" 
                onPress={handleSubmit} 
                color={COLORS.success} 
                style={styles.halfButton} 
                loading={isLoading}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
});


/* -------------------------
    Main Screen
    -------------------------*/
const RoomDetailScreen = ({ navigation }) => {
  const route = useRoute();
  const { userId, logout } = useAuth();
  const { roomId } = route.params ?? {};
  const initialRoomName = route.params?.roomName || 'Room Details';
  
  if (!roomId) {
    return (
      <View style={styles.centered}>
        <Text style={FONTS.h3}>⚠️ Room ID Missing</Text>
        <CustomButton title="Go Back" onPress={() => navigation.goBack()} style={{marginTop: 20}} />
      </View>
    );
  }

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [roomDetails, setRoomDetails] = useState(null);
  const [membersData, setMembersData] = useState({
    count: 0,
    list: [],
    isLoaded: false,
    isLoadingList: false,
  });
  const [isMembersListExpanded, setIsMembersListExpanded] = useState(false);
  const [sheets, setSheets] = useState([]);
  const [dailyProblems, setDailyProblems] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [todaysSubmissions, setTodaysSubmissions] = useState({});
  const [joinRequests, setJoinRequests] = useState([]);
  const [solvedProblemIds, setSolvedProblemIds] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState(null);
  const [duration, setDuration] = useState('90');
  const [modalVisible, setModalVisible] = useState(false);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploadingProblemId, setUploadingProblemId] = useState(null);
  const [dailyProgressData, setDailyProgressData] = useState([]);
  const [submissionDetailsModal, setSubmissionDetailsModal] = useState({
    visible: false,
    problem: null, 
    photoUri: null, 
  });

  const isMounted = useRef(true);
  const isAdmin = useMemo(() => roomDetails && roomDetails.admin_id === Number(userId), [roomDetails, userId]);


  // --- CORE FETCH FUNCTIONS ---

  const fetchMemberCount = useCallback(async () => {
    try {
      const res = await roomService.getRoomMembers(roomId); 
      const list = res?.data || [];
      const count = list.length;
      
      if (!isMounted.current) return;
      
      setMembersData(prev => ({
        ...prev,
        count: count,
        list: prev.isLoaded ? prev.list : [], 
        isLoaded: prev.isLoaded && prev.list.length === count,
      }));
    } catch (error) {
      console.error('Failed to fetch member count:', error);
    }
  }, [roomId]);
  
  const fetchFullMemberList = useCallback(async () => {
    if (isMembersListExpanded) {
      setIsMembersListExpanded(false);
      return;
    }

    if (membersData.isLoaded) {
      setIsMembersListExpanded(true);
      return;
    }
    
    setMembersData(prev => ({ ...prev, isLoadingList: true }));
    setIsMembersListExpanded(true); 
    
    try {
      const res = await roomService.getRoomMembers(roomId);
      if (!isMounted.current) return;
      const list = res?.data || [];
      
      setMembersData({
        count: list.length,
        list: list,
        isLoaded: true,
        isLoadingList: false,
      });
    } catch (error) {
      console.error('Failed to fetch full member list:', error);
      Alert.alert('Error', 'Could not load room members due to a network error.');
      setMembersData(prev => ({ ...prev, isLoadingList: false, isLoaded: false }));
      setIsMembersListExpanded(false); 
    } finally {
      if (isMounted.current) setMembersData(prev => ({ ...prev, isLoadingList: false }));
    }
  }, [roomId, membersData.isLoaded, isMembersListExpanded]);

  const fetchData = useCallback(async (isManualRefresh = false) => {
    const setLoading = isManualRefresh ? setIsRefreshing : setIsLoading;
    
    try {
      setLoading(true);
      
      const detailsRes = await roomService.getRoomDetails(roomId);
      const roomData = detailsRes?.data;
      if (!roomData) {
        Alert.alert('Error', 'Could not find room details. It may have been deleted.');
        setRoomDetails(null);
        return;
      }
      setRoomDetails(roomData);
      
      const currentIsAdmin = roomData.admin_id === Number(userId);

      const [
        submissionsRes,
        progressRes,
        joinRequestsRes,
        sheetsRes,
      ] = await Promise.allSettled([
        submissionService.getTodaysSubmissions(roomId),
        roomService.getDailyRoomProgress(roomId),
        currentIsAdmin ? roomService.getJoinRequests(roomId) : Promise.resolve({ data: [] }),
        currentIsAdmin ? sheetService.getAllSheets() : Promise.resolve({ data: [] }),
        fetchMemberCount(),
      ]);
      
      if (!isMounted.current) return;
      
      setDailyProgressData(progressRes.status === 'fulfilled' ? progressRes.value?.data?.membersProgress || [] : []);

      if (currentIsAdmin) {
        setJoinRequests(joinRequestsRes.status === 'fulfilled' ? joinRequestsRes.value?.data || [] : []);
        setSheets(sheetsRes.status === 'fulfilled' ? sheetsRes.value?.data || [] : []);
      } else {
        setJoinRequests([]);
        setSheets([]);
      }
      
      const submissionsData = submissionsRes.status === 'fulfilled' ? submissionsRes.value?.data || [] : [];
      const grouped = submissionsData.reduce((acc, sub) => {
        const pid = sub.problem_id;
        if (!acc[pid]) acc[pid] = [];
        acc[pid].push(sub);
        return acc;
      }, {});
      setTodaysSubmissions(grouped);
      
      if (roomData.status === 'active') {
        const problemsRes = await roomService.getDailyProblems(roomId);
        const dailyProblemsData = problemsRes?.data || [];
        setDailyProblems(dailyProblemsData);

        if (dailyProblemsData.length > 0) {
          const problemIds = dailyProblemsData.map(p => p.id);
          const statusRes = await submissionService.getSubmissionStatus(problemIds);
          setSolvedProblemIds(statusRes?.data || []);
        } else {
          setSolvedProblemIds([]);
        }
      } else {
        setDailyProblems([]);
        setSolvedProblemIds([]);
      }
    } catch (error) {
      console.error('Failed to fetch screen data:', error);
      Alert.alert('Network Error', 'Could not load room details. Please check your connection and pull down to refresh.');
      setRoomDetails(null); 
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [roomId, userId, fetchMemberCount]);
  
  const handleRefresh = useCallback(() => {
    if (!isRefreshing && !isUploading) {
      fetchData(true);
    }
  }, [fetchData, isRefreshing, isUploading]);

  const confirmSubmissionWithDetails = useCallback(async ({ problem, photoUri, approach, timeComplexity, spaceComplexity }) => {
    setIsUploading(true);
    setUploadingProblemId(problem.id); // Set problem ID for localized loading

    try {
      if (!photoUri) throw new Error('Photo proof is missing.');

      const resized = await ImageResizer.createResizedImage(
        photoUri, 1280, 1280, 'JPEG', 80, 0, null 
      );

      const fd = new FormData();
      fd.append('proofImage', {
        uri: resized.uri,
        type: 'image/jpeg',
        name: resized.name || `upload_${Date.now()}.jpg`,
      });
      fd.append('roomId', roomId);
      fd.append('problemId', problem.id);
      
      fd.append('approach', approach); 
      fd.append('timeComplexity', timeComplexity);
      fd.append('spaceComplexity', spaceComplexity);

      const submissionResponse = await submissionService.createSubmission(fd); 
      
      const successSound = new Sound('success.mp3', Sound.MAIN_BUNDLE, (err) => {
        if (!err) successSound.play(() => successSound.release());
      });

      const newBadges = submissionResponse?.data?.newBadges || [];
      let alertMessage = 'Your proof has been submitted and is awaiting approval.';
      if (newBadges.length) alertMessage += `\n\n🎉 Badge Unlocked: ${newBadges.map(b => b.name).join(', ')}!`;

      setSubmissionDetailsModal(prev => ({ ...prev, visible: false }));
      Alert.alert('Success!', alertMessage, [{ text: 'OK', onPress: () => fetchData() }]);

    } catch (error) {
      console.error('Upload/Submission error:', error);
      let errorMessage = 'An unexpected error occurred.';
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.request) {
        errorMessage = 'Network error: Could not reach the server.';
      }

      Alert.alert('Upload Failed', errorMessage);

    } finally {
      setUploadingProblemId(null);
      setIsUploading(false);
    }
  }, [roomId, fetchData]);

  // --- UI & ACTION LOGIC ---
  
  useFocusEffect(
    useCallback(() => {
      isMounted.current = true;
      fetchData();
      return () => {
        isMounted.current = false;
        setIsMembersListExpanded(false);
      };
    }, [fetchData])
  );
  
  useLayoutEffect(() => {
    navigation.setOptions({
      title: roomDetails?.name || initialRoomName,
      headerRight: () => renderHeaderRight(roomDetails),
    });
  }, [navigation, roomDetails, initialRoomName, isAdmin]);

  const renderHeaderRight = useCallback((roomData) => {
    const isRoomActive = roomData?.status === 'active';
    const hasJourneyStarted = ['active', 'completed'].includes(roomData?.status);

    return (
      <View style={styles.headerRightContainer}>
        <IconButton
          name="chatbubbles-outline"
          onPress={() => navigation.navigate('Chat', { roomId, roomName: roomData?.name })}
          color={COLORS.primary}
        />
        {isRoomActive && ( 
          <IconButton name="ribbon-outline" onPress={() => setSidebarVisible(true)} color={COLORS.primary} />
        )}
        <IconButton
          name="trophy-outline"
          onPress={() => navigation.navigate('Leaderboard', { roomId, roomName: roomData?.name })}
          color={COLORS.primary}
        />
        <IconButton
          name="bar-chart-outline"
          onPress={() => navigation.navigate('JourneyDashboard', { roomId, roomName: roomData?.name })}
          color={COLORS.primary}
        />
        {hasJourneyStarted && ( 
          <IconButton name="list-outline" onPress={() => navigation.navigate('FullSheet', { roomId, roomName: roomData?.name })} color={COLORS.primary} />
        )}
        <IconButton name="ellipsis-vertical" onPress={() => setActionModalVisible(true)} color={COLORS.text} />
      </View>
    );
  }, [navigation, roomId]);

  const requestCameraPermission = useCallback(async () => {
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
  }, []);

  // FIX: handleMarkAsDone for opening camera and modal
  const handleMarkAsDone = useCallback((problem) => {
    if (isUploading) return;
    
    (async () => {
      const hasPermission = await requestCameraPermission();
      if (!hasPermission) {
        Alert.alert("Permission Denied", "Cannot upload proof without camera access.");
        return;
      }

      // CRITICAL FIX: Limit Max Dimensions and Quality to prevent OOM crash
    const options = {
      mediaType: 'photo',
      quality: 0.8,         // Reduced quality
      maxWidth: 1600,       // Limiting dimensions
      maxHeight: 1600,      // Limiting dimensions
      saveToPhotos: false,  // Set to false to prevent clutter (optional)
      cameraType: 'back',
    };
    
    launchCamera(options, async (response) => {
      if (response.didCancel) return;
      
      // IMPROVED ERROR CHECKING (The 'undefined' error originates here)
      if (response.errorCode) {
        // Fallback message for undefined errors
        const errorMessage = response.errorMessage || "Unknown camera error. Please ensure sufficient storage and memory are available.";
        Alert.alert('Camera Error', 'ImagePicker Error: ' + errorMessage);
        return; 
      }
      
      const original = response.assets && response.assets[0];
      if (!original || !original.uri) {
        Alert.alert('Error', 'Could not capture image data. No asset returned.');
        return;
      }

      setSubmissionDetailsModal({
        visible: true,
        problem: problem,
        photoUri: original.uri,
      });
    });
  })();
}, [isUploading, requestCameraPermission]);


  const showSubmissionPicker = useCallback((submissions) => {
    if (!submissions || submissions.length === 0) return;

    const showSubmissionDetails = (sub) => {
      const message = 
        `Approach:\n${sub.approach || 'N/A'}\n\n` +
        `Time Complexity: ${sub.time_complexity || 'N/A'}\n` + 
        `Space Complexity: ${sub.space_complexity || 'N/A'}`; 
      
      Alert.alert(
        `${sub.username}'s Submission`,
        message,
        [
          { text: 'View Photo Proof', onPress: () => {
            setSelectedImage(sub.photo_url);
            setModalVisible(true);
          }},
          { text: 'OK', style: 'cancel' }
        ]
      );
    };

    if (submissions.length === 1) {
      showSubmissionDetails(submissions[0]);
      return;
    }

    const buttons = submissions.map(sub => ({
      text: `View ${sub.username}'s Algorithm`,
      onPress: () => showSubmissionDetails(sub)
    }));
    buttons.push({ text: 'Cancel', style: 'cancel' });
    
    Alert.alert('View a Submission', 'Choose a user to see their submission pic, approach, and complexity.', buttons);
  }, []);
  
  const openSnap = useCallback((mySubmission) => {
    const message = 
      `Approach:\n${mySubmission.approach || 'N/A'}\n\n` +
      `Time Complexity: ${mySubmission.time_complexity || 'N/A'}\n` + 
      `Space Complexity: ${mySubmission.space_complexity || 'N/A'}`; 

    Alert.alert(
      `Your Submission Details`,
      message,
      [
        { text: 'View Photo Proof', onPress: () => {
          setSelectedImage(mySubmission.photo_url);
          setModalVisible(true);
        }},
        { text: 'OK', style: 'cancel' }
      ]
    );
  }, []);

  const handleStartJourney = useCallback(async () => {
    if (!selectedSheet || !duration || isUploading) {
      Alert.alert('Error', 'Please select a sheet and set a duration, and wait for any ongoing uploads to finish.');
      return;
    }
    const finalDuration = Number(duration);
    if (isNaN(finalDuration) || finalDuration <= 0) {
        Alert.alert('Invalid Duration', 'Duration must be a positive number.');
        return;
    }

    setIsUploading(true);
    try {
      await roomService.startJourney(roomId, selectedSheet, duration);
      Alert.alert('Success', 'The journey has begun!');
      fetchData();
    } catch (error) {
      const msg = error?.response?.data?.message || 'Could not start the journey due to an error.';
      Alert.alert('Error', msg);
      console.error('Failed to start journey:', error);
    } finally {
        setIsUploading(false);
    }
  }, [selectedSheet, duration, roomId, fetchData, isUploading]);


  // Admin/Member management (omitted for brevity, assumed correct)
  const handleApproveRequest = useCallback(async (requestId) => {
    try {
      await roomService.approveJoinRequest(requestId);
      Alert.alert('Success', 'Member has been added to the room.');
      
      // Re-fetch everything, including the new member count/list
      fetchData(); 
    } catch (error) {
      Alert.alert('Error', 'Could not approve request.');
    }
  }, [fetchData]);

  const handleDenyRequest = useCallback(async (requestId) => {
    try {
      await roomService.denyJoinRequest(requestId);
      Alert.alert('Success', 'Request has been denied.');
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Could not deny request.');
    }
  }, [fetchData]);
  const confirmRemoveMember = useCallback((member) => {
    Alert.alert(
      "Remove Member",
      `Are you sure you want to remove ${member.username} from this room?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Yes, Remove", onPress: () => removeMember(member.id), style: "destructive" }
      ]
    );
  }, []);
  const removeMember = useCallback(async (memberId) => {
    try {
      await roomService.removeMember(roomId, memberId);
      Alert.alert('Success', 'Member has been removed.');
      
      // Update the loaded members list and the count after removal
      setMembersData(prev => ({
        ...prev,
        count: prev.count - 1,
        list: prev.list.filter(m => Number(m.id) !== Number(memberId)),
      }));

    } catch (error) {
      const errorMessage = error?.response?.data?.message || 'Could not remove member.';
      Alert.alert('Error', errorMessage);
    }
  }, [roomId]);
const handleDeleteRoom = useCallback(async () => {
    try {
      await apiClient.delete(`/rooms/${roomId}`);
      Alert.alert('Success', 'The room has been deleted.', [
        { text: 'OK', onPress: () => navigation.navigate('RoomsTab') }
      ]);
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.message || 'Could not delete the room.');
    }
  }, [roomId, navigation]);

  const confirmDeleteRoom = useCallback(() => {
    setActionModalVisible(false);
    Alert.alert("Delete Room", "Are you sure you want to permanently delete this room?",
      [{ text: "Cancel", style: "cancel" },
       { text: "Yes, Delete", onPress: handleDeleteRoom, style: "destructive" }]
    );
  }, [handleDeleteRoom]);
  const handleLeaveRoom = useCallback(() => {
    setActionModalVisible(false);
    Alert.alert("Leave Room", "Are you sure you want to leave this room?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Leave", onPress: async () => {
            try {
              await apiClient.delete(`/rooms/${roomId}/leave`);
              Alert.alert('Success', 'You have left the room.');
              navigation.navigate('Main');
            } catch (error) {
              Alert.alert('Error', error?.response?.data?.message || 'Could not leave the room.');
            }
          }, style: "destructive"
        }
      ]
    );
  }, [roomId, navigation]);


  // Sections Memo and Render Helpers
  const sections = useMemo(() => {
    const s = [];
    if (isAdmin && joinRequests.length > 0) s.push({ title: 'Pending Join Requests', data: joinRequests, key: 'requests' });
    if (roomDetails?.status === 'active') s.push({ title: "Today's Problems", data: dailyProblems, key: 'problems' });
    
    s.push({ 
      title: `Members (${membersData.count})`, 
      data: isMembersListExpanded ? membersData.list : [],
      isExpanded: isMembersListExpanded, 
      memberCount: membersData.count,
      isLoaded: membersData.isLoaded,
      isLoadingList: membersData.isLoadingList,
      key: 'members',
    });
    
    return s;
  }, [isAdmin, joinRequests, roomDetails, dailyProblems, membersData, isMembersListExpanded]);

  const renderMemberSectionHeader = useCallback(({ section }) => {
    if (section.key === 'members') {
      const { title, isExpanded, memberCount, isLoadingList } = section;
      
      return (
        <View style={{backgroundColor: COLORS.background}}>
          <TouchableOpacity
            onPress={fetchFullMemberList}
            style={styles.memberSectionHeader}
            disabled={memberCount === 0 && isLoadingList}
          >
            <Text style={styles.sectionTitleWithoutPadding}>{title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {isLoadingList && <ActivityIndicator color={COLORS.primary} style={{ marginRight: SIZES.base }} />}
                {memberCount > 0 && (
                <Icon
                    name={isExpanded ? "chevron-up-outline" : "chevron-down-outline"}
                    size={24}
                    color={COLORS.textPrimary}
                />
                )}
            </View>
          </TouchableOpacity>
          {memberCount === 0 && (
            <Text style={[styles.emptyText, {paddingHorizontal: SIZES.padding, marginTop: 0}]}>No members in this room yet.</Text>
          )}
        </View>
      );
    }
    return <Text style={styles.sectionTitle}>{section.title}</Text>;
  }, [fetchFullMemberList]);
  
  const renderJoinRequest = useCallback((item) => (
    <Card style={styles.requestCard}>
      <Text style={styles.requestName}>{item.username}</Text>
      <View style={styles.requestButtonContainer}>
        <IconButton name="checkmark-circle-outline" color={COLORS.success} onPress={() => handleApproveRequest(item.id)} size={28} />
        <IconButton name="close-circle-outline" color={COLORS.danger} onPress={() => handleDenyRequest(item.id)} size={28} />
      </View>
    </Card>
  ), [handleApproveRequest, handleDenyRequest]);

  const renderMember = useCallback((item) => {
    const isRoomAdmin = Number(item.id) === Number(roomDetails?.admin_id);
    const isCurrentUser = Number(item.id) === Number(userId);
    return (
      <Card style={styles.memberCard}>
        <View style={styles.nameContainer}>
          <Text style={styles.memberNameText}>{item.username}</Text>
          {isRoomAdmin && (
            <View style={styles.adminTag}>
              <Text style={styles.adminTagText}>ADMIN</Text>
            </View>
          )}
          {isCurrentUser && !isRoomAdmin && (
            <View style={[styles.adminTag, { backgroundColor: COLORS.secondary }]}>
              <Text style={styles.adminTagText}>YOU</Text>
            </View>
          )}
        </View>

        {isAdmin && !isRoomAdmin && (
          <IconButton name="person-remove-outline" color={COLORS.danger} onPress={() => confirmRemoveMember(item)} size={24} />
        )}
      </Card>
    );
  }, [roomDetails, userId, isAdmin, confirmRemoveMember]);

  const renderDailyProblem = useCallback((item) => {
    const isSolvedByMe = solvedProblemIds.includes(item.id);
    const mySubmission = isSolvedByMe ? (todaysSubmissions[item.id] || []).find(s => Number(s.user_id) === Number(userId)) : null;
    const otherSubmissions = (todaysSubmissions[item.id] || []).filter(s => Number(s.user_id) !== Number(userId));

    const isProblemUploading = uploadingProblemId === item.id && isUploading;

    return (
      <Card style={[styles.problemCard, isSolvedByMe && styles.problemCardCompleted]}>
        <View style={styles.problemContent}>
          <Text style={styles.problemTitle}>{item.title}</Text>
          <Text style={styles.problemSubtext}>{item.topic} | Difficulty: {item.difficulty}</Text>
          {otherSubmissions.length > 0 && (
            <TouchableOpacity 
                onPress={() => showSubmissionPicker(otherSubmissions)} 
                style={styles.othersCompletedContainer}
                activeOpacity={0.7}
            >
              <View style={styles.othersCompletedRow}>
                <Icon name="people-outline" size={SIZES.font} color={COLORS.primary} /> 
                <Text style={styles.othersCompletedLink}> 
                  Completed by {otherSubmissions.length} other(s).
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.problemActionContainer}>
          {isProblemUploading ? (
            <ActivityIndicator color={COLORS.primary} size="small" />
          ) : isSolvedByMe ? (
            <TouchableOpacity style={styles.completedButton} onPress={() => openSnap(mySubmission)}>
              <Icon name="checkmark-circle" size={32} color={COLORS.success} />
              <Text style={styles.completedText}>View Proof</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.doneButton} 
              onPress={() => handleMarkAsDone(item)} 
              disabled={isUploading} 
            >
                <Icon name="camera-outline" size={28} color={COLORS.surface} />
                <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          )}
        </View>
      </Card>
    );
  }, [solvedProblemIds, todaysSubmissions, uploadingProblemId, isUploading, showSubmissionPicker, openSnap, handleMarkAsDone, userId]);


  const renderJourneyCompleted = () => (
    <View>
      <Card style={styles.journeyCompletedCard}>
        <Icon name="checkmark-done-circle" size={60} color={COLORS.success} />
        <Text style={styles.journeyCompletedTitle}>Journey Completed! 🎉</Text>
        <Text style={styles.journeyCompletedText}>
          Congratulations to all members! View your final progress and achievements.
        </Text>
      </Card>
      {roomDetails?.status === 'completed' && (
        <CustomButton
          title="View Your Journey Achievements"
          onPress={() => navigation.navigate('JourneyAchievements', { roomId, roomName: roomDetails?.name })}
          color={COLORS.gold} 
          style={styles.achievementButton}
        />
      )}
    </View>
  );

  const ActionModal = ({ visible, onClose }) => (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={styles.actionModalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.actionModalContent}>
          {!isAdmin ? (
            <TouchableOpacity style={styles.modalActionItem} onPress={handleLeaveRoom} disabled={isUploading}>
              <Icon name="log-out-outline" size={20} color={COLORS.danger} style={{ marginRight: SIZES.base }} />
              <Text style={[styles.modalActionText, { color: COLORS.danger }]}>Leave Room</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.modalActionItem} onPress={confirmDeleteRoom} disabled={isUploading}>
              <Icon name="trash-outline" size={20} color={COLORS.danger} style={{ marginRight: SIZES.base }} />
              <Text style={[styles.modalActionText, { color: COLORS.danger }]}>Delete Room</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );


  // --- Main Render ---
  if (isLoading && !roomDetails) {
    return <ActivityIndicator size="large" color={COLORS.primary} style={styles.centered} />;
  }
  if (!roomDetails) {
    return (
        <View style={styles.centered}>
            <Text style={{ ...FONTS.h3, color: COLORS.text }}>Room details could not be loaded.</Text>
            <CustomButton title="Try Again" onPress={() => fetchData(true)} style={{ marginTop: SIZES.padding }} />
        </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      
      <Modal animationType="fade" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
  <View style={styles.modalContainer}>
    {selectedImage && (
      <ImageZoom 
        cropWidth={Dimensions.get('window').width}
        cropHeight={Dimensions.get('window').height * 0.9} // Use most of the screen height
        imageWidth={Dimensions.get('window').width}
        imageHeight={Dimensions.get('window').height * 0.8} // Image starts a bit smaller
        minScale={0.5}
        maxScale={5}
        style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
      >
        <Image 
          source={{ uri: selectedImage }} 
          style={styles.modalZoomImage} // Use the new style below
          resizeMode="contain" 
        />
      </ImageZoom>
    )}
    <IconButton 
      name="close-circle" 
      size={48} 
      color={COLORS.surface} 
      onPress={() => setModalVisible(false)} 
      style={styles.modalCloseButton} 
    />
  </View>
</Modal>

      <SubmissionDetailsModal
        visible={submissionDetailsModal.visible}
        problem={submissionDetailsModal.problem}
        photoUri={submissionDetailsModal.photoUri}
        onSubmit={confirmSubmissionWithDetails}
        onCancel={() => setSubmissionDetailsModal(prev => ({ ...prev, visible: false }))}
        isLoading={isUploading} 
      />

      <ActionModal visible={actionModalVisible} onClose={() => setActionModalVisible(false)} />
      <TodayStandingSidebar
        visible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        data={dailyProgressData}
        userId={userId}
      />

      <RoomGuideModal // <-- ADD THIS
        isRoomActive={roomDetails?.status === 'active'}
        // You don't need an onFinish prop unless you want to trigger a refresh
        // onFinish={handleRefresh} 
    />
      
      <SectionList
        style={styles.container}
        sections={sections}
        keyExtractor={(item, index) => (item?.id ?? index).toString() + index}
        renderSectionHeader={renderMemberSectionHeader}
        renderItem={({ item, section }) => {
          if (section.key === 'requests') return renderJoinRequest(item);
          if (section.key === 'members') {
            if (section.isExpanded && section.isLoaded) {
              return renderMember(item);
            }
            return null;
          }
          if (section.key === 'problems') return renderDailyProblem(item);
          return null;
        }}
        refreshControl={ 
            <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={COLORS.primary}
                colors={[COLORS.primary]}
            />
        }
        ListHeaderComponent={
          <>
            {roomDetails.status === 'completed' && renderJourneyCompleted()}
            
            {/* Admin Setup Panel */}
            {isAdmin && roomDetails.status === 'pending' && (
              <Card style={styles.adminPanel}>
                <Text style={styles.panelTitle}>Setup Journey</Text>
                <Text style={styles.label}>Select a Sheet:</Text>
                
                  <RNPickerSelect
  onValueChange={(value) => setSelectedSheet(value)}
  items={sheets.map((sheet) => ({
    label: sheet.name,
    value: sheet.id,
  }))}
  value={selectedSheet}
  placeholder={{
    label: '-- Choose a sheet --',
    value: null,
    color: 'gray',
  }}
  disabled={isUploading}
  style={{
    inputAndroid: {
      color: 'black',
      backgroundColor: 'white',
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: COLORS.lightGray,
      borderRadius: 8,
      fontSize: 16,
      ...FONTS.body4,
    },
    inputIOS: {
      color: 'black',
      backgroundColor: 'white',
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: COLORS.lightGray,
      borderRadius: 8,
      fontSize: 16,
      ...FONTS.body4,
    },
    placeholder: {
      color: 'gray',
    },
    iconContainer: {
      top: 24,
      right: 12,
    },
  }}
  useNativeAndroidPickerStyle={false}
  Icon={() => (
    <View
      style={{
        borderTopWidth: 6,
        borderTopColor: COLORS.primary,
        borderRightWidth: 6,
        borderRightColor: 'transparent',
        borderLeftWidth: 6,
        borderLeftColor: 'transparent',
        width: 0,
        height: 0,
      }}
    />
  )}
/>
               
                <Text style={styles.label}>Set Duration (in days):</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 90"
                  value={duration}
                  onChangeText={setDuration}
                  keyboardType="numeric"
                  placeholderTextColor={'gray'}
                  editable={!isUploading} 
                />
                <CustomButton 
                    title="Start Journey" 
                    onPress={handleStartJourney} 
                    color={COLORS.success} 
                    loading={isUploading}
                    disabled={!selectedSheet || !duration || isUploading}
                />
              </Card>
            )}

            {/* User Awaiting Panel */}
            {!isAdmin && roomDetails.status === 'pending' && (
              <Card style={styles.awaitingPanel}>
                <View style={styles.awaitingHeader}>
                  <Icon name="information-circle-outline" size={26} color={COLORS.secondary} style={styles.awaitingIconBg} />
                  <Text style={styles.awaitingHeaderText}>Awaiting Start</Text>
                </View>
                <Text style={styles.awaitingBodyText}>
                  The room admin has not started the sheet solving journey yet.{"\n"}
                  <Text style={{ color: COLORS.secondary, fontWeight: '600' }}>Check back later</Text>{" "}
                  or ask the admin to select a sheet and duration to begin!
                </Text>
              </Card>
            )}
          </>
        }
        ListEmptyComponent={
          sections.length === 0 && !isLoading && !isRefreshing ? (
             <Text style={styles.emptyText}>Nothing to show here yet. Pull down to refresh.</Text> 
          ) : null
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  container: { flex: 1, backgroundColor: COLORS.background },
  headerRightContainer: { flexDirection: 'row', alignItems: 'center', marginRight: SIZES.base },
  sectionTitle: { ...FONTS.h3, color: COLORS.text, paddingHorizontal: SIZES.padding, paddingTop: SIZES.padding, paddingBottom: SIZES.base, backgroundColor: COLORS.background },
  sectionTitleWithoutPadding: { ...FONTS.h3, color: COLORS.text, paddingBottom: SIZES.base, backgroundColor: COLORS.background },
  memberSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SIZES.padding, paddingTop: SIZES.padding, paddingBottom: SIZES.base, backgroundColor: COLORS.background },
  requestCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SIZES.padding },
  memberCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SIZES.base, paddingLeft: SIZES.padding, paddingRight: SIZES.padding + SIZES.base + 10 },
  problemCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SIZES.padding, borderLeftWidth: 5, borderLeftColor: COLORS.border },
  problemCardCompleted: { borderLeftColor: COLORS.success },
  requestName: { ...FONTS.body3, fontWeight: '600' },
  requestButtonContainer: { flexDirection: 'row', gap: SIZES.base },
  memberNameText: { ...FONTS.body3 },
  nameContainer: { flexDirection: 'row', alignItems: 'center' },
  adminTag: { marginLeft: SIZES.base, paddingHorizontal: SIZES.base, paddingVertical: 2, backgroundColor: COLORS.primary, borderRadius: SIZES.base, marginRight: -10 },
  adminTagText: { ...FONTS.caption, fontSize: 10, color: COLORS.surface, fontWeight: 'bold' },
  problemContent: { flex: 1, marginRight: SIZES.padding },
  problemTitle: { ...FONTS.h3, color: '#251cc9' },
  problemSubtext: { ...FONTS.body5, color: COLORS.gray, marginTop: SIZES.base / 2 },
  othersCompletedContainer: { marginTop: SIZES.base, alignSelf: 'flex-start' },
  othersCompletedRow: { flexDirection: 'row', alignItems: 'center' },
  othersCompletedLink: { ...FONTS.body5, color: COLORS.primary, textDecorationLine: 'underline', marginLeft: SIZES.base / 2, fontWeight: '600' },
  problemActionContainer: { width: 80, alignItems: 'flex-end', justifyContent: 'center' },
  completedButton: { alignItems: 'center' },
  completedText: { ...FONTS.caption, color: COLORS.success, fontWeight: 'bold' },
  doneButton: { backgroundColor: COLORS.primary, padding: SIZES.base, borderRadius: SIZES.radius, alignItems: 'center', width: '100%' },
  doneButtonText: { ...FONTS.caption, color: COLORS.surface, marginTop: SIZES.base / 2, fontWeight: 'bold' },
  adminPanel: { padding: SIZES.padding, margin: SIZES.padding },
  panelTitle: { ...FONTS.h3, color: COLORS.primary, marginBottom: SIZES.padding },
  label: { ...FONTS.body4, color: COLORS.text, marginBottom: SIZES.base, marginTop: SIZES.base },
  pickerContainer: { borderColor: COLORS.border, borderWidth: 1, borderRadius: SIZES.radius, overflow: 'hidden', marginBottom: SIZES.padding, backgroundColor: COLORS.surface },
  picker: { height: 60, width: '100%', color: COLORS.text },
  input: { ...FONTS.body4, height: 48, borderColor: COLORS.border, borderWidth: 1, marginBottom: SIZES.padding, paddingHorizontal: SIZES.padding, borderRadius: SIZES.radius, color: COLORS.text },
  emptyText: { textAlign: 'center', marginTop: SIZES.padding * 2, ...FONTS.body3, color: COLORS.gray },
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.95)' },
  modalImage: { width: '100%', height: '80%' },
  modalCloseButton: { position: 'absolute', top: Platform.OS === 'ios' ? 40 : 20, right: 20 },
  customButton: { height: 48, borderRadius: SIZES.radius, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  customButtonText: { ...FONTS.h4, fontWeight: 'bold' },
  disabledButton: { opacity: 0.6, borderColor: COLORS.gray, backgroundColor: COLORS.lightGray }, 
  disabledButtonText: { color: COLORS.textSecondary }, 
  actionModalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.1)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: Platform.OS === 'ios' ? 100 : 50, paddingRight: 10 },
  actionModalContent: { backgroundColor: COLORS.surface, borderRadius: SIZES.radius, padding: SIZES.base, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 }, android: { elevation: 8 } }) },
  modalActionItem: { flexDirection: 'row', alignItems: 'center', padding: SIZES.base * 1.5 },
  modalActionText: { ...FONTS.body4, color: COLORS.text },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', flexDirection: 'row', justifyContent: 'flex-end' },
  sidebar: { width: SIDEBAR_WIDTH, backgroundColor: COLORS.surface, padding: SIZES.padding, borderTopLeftRadius: SIZES.radius * 2, borderBottomLeftRadius: SIZES.radius * 2, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, elevation: 8 },
  sidebarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SIZES.padding, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  sidebarTitle: { ...FONTS.h3, color: COLORS.text, fontWeight: 'bold' },
  noData: { ...FONTS.body4, color: COLORS.gray, textAlign: 'center', marginTop: SIZES.padding },
  memberRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SIZES.base, paddingVertical: SIZES.base, paddingHorizontal: SIZES.base, borderRadius: SIZES.radius / 2, backgroundColor: COLORS.background },
  currentUserRow: { backgroundColor: COLORS.primaryLight, borderWidth: 1, borderColor: COLORS.primary },
  rank: { width: 30, ...FONTS.body, fontWeight: '600', color: COLORS.textSecondary },
  memberNameText: { flex: 1, ...FONTS.body, color: COLORS.textPrimary },
  currentUserText: { fontWeight: 'bold', color: COLORS.primaryDark },
  progressWrapper: { width: 100, height: 20, backgroundColor: COLORS.border, borderRadius: SIZES.radius, overflow: 'hidden', justifyContent: 'center', marginLeft: SIZES.base, position: 'relative' },
  progressFill: { height: '100%', position: 'absolute', left: 0, borderRadius: SIZES.radius },
  progressText: { position: 'absolute', right: SIZES.base / 2, ...FONTS.caption, fontWeight: 'bold', color: 'black' },
  journeyCompletedCard: {
    margin: SIZES.padding,
    marginBottom: 0, 
    padding: SIZES.padding * 1.5,
    alignItems: 'center',
    backgroundColor: '#E9F7EF', 
    borderWidth: 1,
    borderColor: COLORS.success,
    borderRadius: SIZES.radius,
  },
  journeyCompletedTitle: {
    ...FONTS.h2,
    color: '#1D8348', 
    marginTop: SIZES.base,
  },
  journeyCompletedText: {
    ...FONTS.body4,
    color: COLORS.text,
    textAlign: 'center',
    marginTop: SIZES.base,
    lineHeight: 22,
  },
  achievementButton: { 
    marginHorizontal: SIZES.padding, 
    marginTop: SIZES.padding,
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
  },
  modalOverlay: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: 'rgba(0, 0, 0, 0.7)' 
  },
  modalContent: {
    width: '90%',
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    maxHeight: Dimensions.get('window').height * 0.85,
  },
  modalTitle: { 
    ...FONTS.h3, 
    color: COLORS.primary, 
    marginBottom: SIZES.padding 
  },
  multilineInput: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: SIZES.base,
    marginBottom: SIZES.padding,
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SIZES.padding,
  },
  halfButton: {
    width: '48%',
  },
  awaitingPanel: {
    margin: SIZES.padding,
    backgroundColor: '#fff9f2', 
    borderLeftWidth: 5,
    borderLeftColor: COLORS.secondary,
    borderRadius: 12,
    paddingVertical: SIZES.base,
    paddingHorizontal: SIZES.base * 1.5,
  },
  awaitingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: SIZES.base / 2,
  },
  awaitingIconBg: {
    marginRight: 8,
    backgroundColor: `${COLORS.secondary}15`, 
    padding: 6,
    borderRadius: 20,
  },
  awaitingHeaderText: {
    fontSize: 18,
    lineHeight: 24,
    color: COLORS.secondary,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  awaitingBodyText: {
    marginTop: SIZES.base / 2,
    color: '#6b6b6b',
    fontSize: 15,
    textAlign: 'left',
    lineHeight: 22,
  },
  modalZoomImage: { 
    width: Dimensions.get('window').width, 
    height: Dimensions.get('window').height * 0.8, // Match height set in ImageZoom prop
    // Ensure the image width/height are set here for ImageZoom to work correctly
  },
});


export default RoomDetailScreen;