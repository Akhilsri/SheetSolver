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
  ScrollView
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
import DailyProgressTracker from '../components/room/DailyProgressTracker';

// Constants
const SCREEN_WIDTH = Dimensions.get('window').width;
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.85;

/* -------------------------
   Small memo components
   -------------------------*/
const IconButton = React.memo(({ name, color = COLORS.primary, size = 24, onPress, style }) => (
  <TouchableOpacity onPress={onPress} style={[{ padding: SIZES.base }, style]} activeOpacity={0.7}>
    <Icon name={name} size={size} color={color} />
  </TouchableOpacity>
));

const CustomButton = React.memo(({ title, onPress, color = COLORS.primary, outline = false, style = {} }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[
      styles.customButton,
      { backgroundColor: outline ? COLORS.surface : color, borderColor: color },
      style
    ]}
  >
    <Text style={[styles.customButtonText, { color: outline ? color : COLORS.surface }]}>
      {title}
    </Text>
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
      return (b.solvedCount || 0) - (a.solvedCount || 0);
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

/* -------------------------
   Main Screen
   -------------------------*/
const RoomDetailScreen = ({ navigation }) => {
  const route = useRoute();
  const { userId, logout } = useAuth();
  const { roomId, roomName: initialRoomName } = route.params ?? {};

  // state
  const [isLoading, setIsLoading] = useState(true);
  const [roomDetails, setRoomDetails] = useState(null);
  const [members, setMembers] = useState([]);
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

  const isMounted = useRef(true);

  // stable fetchData
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const detailsRes = await roomService.getRoomDetails(roomId);
      const roomData = detailsRes?.data;
      if (!roomData) {
        Alert.alert('Error', 'Could not find room details.');
        setRoomDetails(null);
        return;
      }
      setRoomDetails(roomData);
      const isAdmin = roomData.admin_id === Number(userId);

      const promises = [
        roomService.getRoomMembers(roomId),
        submissionService.getTodaysSubmissions(roomId),
        roomService.getDailyRoomProgress(roomId),
      ];

      if (isAdmin) {
        promises.push(roomService.getJoinRequests(roomId));
        promises.push(sheetService.getAllSheets());
      }

      const responses = await Promise.all(promises);
      if (!isMounted.current) return;

      setMembers(responses[0]?.data || []);
      const submissionsData = responses[1]?.data || [];
      setDailyProgressData(responses[2]?.data?.membersProgress || []);

      if (isAdmin) {
        setJoinRequests(responses[3]?.data || []);
        setSheets(responses[4]?.data || []);
      } else {
        setJoinRequests([]);
      }

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
      Alert.alert('Error', 'Could not load room details.');
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, [roomId, userId]);

  useFocusEffect(
    useCallback(() => {
      isMounted.current = true;
      fetchData();
      return () => {
        isMounted.current = false;
      };
    }, [fetchData])
  );

  // header
  const renderHeaderRight = useCallback((roomData) => {
    const isRoomActive = roomData?.status === 'active';
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
        {isRoomActive && (
          <IconButton name="list-outline" onPress={() => navigation.navigate('FullSheet', { roomId, roomName: roomData?.name })} color={COLORS.primary} />
        )}
        <IconButton name="ellipsis-vertical" onPress={() => setActionModalVisible(true)} color={COLORS.text} />
      </View>
    );
  }, [navigation, roomId]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: roomDetails?.name || initialRoomName,
      headerRight: () => renderHeaderRight(roomDetails),
    });
  }, [navigation, roomDetails, initialRoomName, renderHeaderRight]);

  // Permissions helper
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

  // show submission picker
  const showSubmissionPicker = useCallback((submissions) => {
    if (!submissions || submissions.length === 0) return;
    if (submissions.length === 1) {
      setSelectedImage(submissions[0].photo_url);
      setModalVisible(true);
      return;
    }

    const buttons = submissions.map(sub => ({
      text: `View ${sub.username}'s Snap`,
      onPress: () => {
        setSelectedImage(sub.photo_url);
        setModalVisible(true);
      }
    }));
    buttons.push({ text: 'Cancel', style: 'cancel' });
    // Using Alert.alert as before
    Alert.alert('View a Submission', 'Choose a user to see their proof.', buttons);
  }, []);

  // camera + upload wrapped in async
  const handleMarkAsDone = useCallback((problem) => {
    (async () => {
      const hasPermission = await requestCameraPermission();
      if (!hasPermission) return;

      launchCamera({ mediaType: 'photo', quality: 1.0, saveToPhotos: true }, async (response) => {
        if (response.didCancel) return;
        if (response.errorCode) {
          Alert.alert('Error', 'ImagePicker Error: ' + response.errorMessage);
          return;
        }
        const original = response.assets && response.assets[0];
        if (!original) return;

        setUploadingProblemId(problem.id);
        setIsUploading(true);

        try {
          const resized = await ImageResizer.createResizedImage(
            original.uri,
            1280,
            1280,
            'JPEG',
            80,
            0,
            null
          );

          const fd = new FormData();
          fd.append('proofImage', {
            uri: resized.uri,
            type: 'image/jpeg',
            name: resized.name || `upload_${Date.now()}.jpg`,
          });
          fd.append('roomId', roomId);
          fd.append('problemId', problem.id);

          const submissionResponse = await submissionService.createSubmission(fd);

          // play success sound (non-blocking)
          const successSound = new Sound('success.mp3', Sound.MAIN_BUNDLE, (err) => {
            if (!err) {
              successSound.play(() => successSound.release());
            }
          });

          const newBadges = submissionResponse?.data?.newBadges || [];
          let alertMessage = 'Your proof has been submitted.';
          if (newBadges.length) alertMessage += `\n\n🎉 Badge Unlocked: ${newBadges.map(b => b.name).join(', ')}!`;

          Alert.alert('Success!', alertMessage, [{ text: 'OK', onPress: () => fetchData() }]);
        } catch (error) {
          console.error('Upload error:', error);
          if (error?.response) {
            console.error('Server Response:', error.response.data);
          } else if (error?.request) {
            console.error('No response from server:', error.request);
          } else {
            console.error('Upload setup error:', error.message);
          }
          Alert.alert('Upload Failed', 'There was an error submitting your proof. Please try again.');
        } finally {
          setUploadingProblemId(null);
          setIsUploading(false);
        }
      });
    })();
  }, [requestCameraPermission, roomId, fetchData]);

  // member remove
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
      fetchData();
    } catch (error) {
      const errorMessage = error?.response?.data?.message || 'Could not remove member.';
      Alert.alert('Error', errorMessage);
    }
  }, [roomId, fetchData]);

  const handleStartJourney = useCallback(async () => {
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
  }, [selectedSheet, duration, roomId, fetchData]);

  const openSnap = useCallback((imageUrl) => {
    setSelectedImage(imageUrl);
    setModalVisible(true);
  }, []);

  // Approve / deny requests
  const handleApproveRequest = useCallback(async (requestId) => {
    try {
      await roomService.approveJoinRequest(requestId);
      Alert.alert('Success', 'Member has been added to the room.');
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

  // sections memo
  const isAdmin = useMemo(() => roomDetails && roomDetails.admin_id === Number(userId), [roomDetails, userId]);
  const sections = useMemo(() => {
    const s = [];
    if (isAdmin && joinRequests.length > 0) s.push({ title: 'Pending Join Requests', data: joinRequests });
    if (roomDetails?.status === 'active') s.push({ title: "Today's Problems", data: dailyProblems });
    s.push({ title: `Members (${members.length})`, data: members });
    return s;
  }, [isAdmin, joinRequests, roomDetails, dailyProblems, members]);

  // Render helpers (stable references)
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

    return (
      <Card style={[styles.problemCard, isSolvedByMe && styles.problemCardCompleted]}>
        <View style={styles.problemContent}>
          <Text style={styles.problemTitle}>{item.title}</Text>
          <Text style={styles.problemSubtext}>{item.topic} | Difficulty: {item.difficulty}</Text>
          {otherSubmissions.length > 0 && (
            <TouchableOpacity onPress={() => showSubmissionPicker(otherSubmissions)} style={{ marginTop: SIZES.base }}>
              <Text style={styles.othersCompletedText}>
                <Icon name="people-outline" size={SIZES.font} color={COLORS.gray} /> Completed by {otherSubmissions.length} other(s).
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.problemActionContainer}>
          {uploadingProblemId === item.id ? (
            <ActivityIndicator color={COLORS.primary} size="small" />
          ) : isSolvedByMe ? (
            <TouchableOpacity style={styles.completedButton} onPress={() => openSnap(mySubmission?.photo_url)}>
              <Icon name="checkmark-circle" size={32} color={COLORS.success} />
              <Text style={styles.completedText}>View Proof</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.doneButton} onPress={() => handleMarkAsDone(item)} disabled={isUploading}>
                <Icon name="camera-outline" size={28} color={COLORS.surface} />
                <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          )}
        </View>
      </Card>
    );
  }, [solvedProblemIds, todaysSubmissions, uploadingProblemId, isUploading, showSubmissionPicker, openSnap, handleMarkAsDone]);

  // Action modal component
  const ActionModal = ({ visible, onClose }) => (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={styles.actionModalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.actionModalContent}>
          {!isAdmin ? (
            <TouchableOpacity style={styles.modalActionItem} onPress={handleLeaveRoom}>
              <Icon name="log-out-outline" size={20} color={COLORS.danger} style={{ marginRight: SIZES.base }} />
              <Text style={[styles.modalActionText, { color: COLORS.danger }]}>Leave Room</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.modalActionItem} onPress={confirmDeleteRoom}>
              <Icon name="trash-outline" size={20} color={COLORS.danger} style={{ marginRight: SIZES.base }} />
              <Text style={[styles.modalActionText, { color: COLORS.danger }]}>Delete Room</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // loading / not found states
  if (isLoading) {
    return <ActivityIndicator size="large" color={COLORS.primary} style={styles.centered} />;
  }
  if (!roomDetails) {
    return <View style={styles.centered}><Text style={{ ...FONTS.body3 }}>Room not found.</Text></View>;
  }

  // main render
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Photo View Modal */}
      <Modal animationType="fade" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <Image source={{ uri: selectedImage }} style={styles.modalImage} resizeMode="contain" />
          <IconButton name="close-circle" size={48} color={COLORS.surface} onPress={() => setModalVisible(false)} style={styles.modalCloseButton} />
        </View>
      </Modal>

      {/* Action Menu Modal */}
      <ActionModal visible={actionModalVisible} onClose={() => setActionModalVisible(false)} />

      {/* Today's Standing Sidebar */}
      <TodayStandingSidebar
        visible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        data={dailyProgressData}
        userId={userId}
      />

      <SectionList
        style={styles.container}
        sections={sections}
        keyExtractor={(item, index) => (item?.id ?? index).toString() + index}
        renderSectionHeader={({ section: { title } }) => <Text style={styles.sectionTitle}>{title}</Text>}
        renderItem={({ item, section }) => {
          if (section.title === 'Pending Join Requests') return renderJoinRequest(item);
          if (section.title.startsWith('Members')) return renderMember(item);
          if (section.title === "Today's Problems") return renderDailyProblem(item);
          return null;
        }}
        ListHeaderComponent={
          <>
            {isAdmin && roomDetails.status === 'pending' && (
              <Card style={styles.adminPanel}>
                <Text style={styles.panelTitle}>Setup Journey</Text>
                <Text style={styles.label}>Select a Sheet:</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={selectedSheet}
                    onValueChange={(itemValue) => setSelectedSheet(itemValue)}
                    dropdownIconColor={COLORS.primary}
                    style={styles.picker}
                  >
                    <Picker.Item label="-- Choose a sheet --" value={null} style={FONTS.body4}/>
                    {sheets.map((sheet) => (
                      <Picker.Item label={sheet.name} value={sheet.id} key={sheet.id} style={FONTS.body4} />
                    ))}
                  </Picker>
                </View>
                <Text style={styles.label}>Set Duration (in days):</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 90"
                  value={duration}
                  onChangeText={setDuration}
                  keyboardType="numeric"
                  placeholderTextColor={COLORS.gray}
                />
                <CustomButton title="Start Journey" onPress={handleStartJourney} color={COLORS.success} />
              </Card>
            )}
          </>
        }
        ListEmptyComponent={<Text style={styles.emptyText}>Nothing to show here yet.</Text>}
      />
    </SafeAreaView>
  );
};

/* -------------------------
   Styles (fixed duplicate keys)
   -------------------------*/
const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: COLORS.background },

  /* Header / nav right */
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SIZES.base
  },

  sectionTitle: {
    ...FONTS.h3,
    color: COLORS.text,
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding,
    paddingBottom: SIZES.base,
    backgroundColor: COLORS.background
  },

  // Cards & Lists
  requestCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.padding
  },
  memberCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SIZES.base,
    paddingLeft: SIZES.padding,
    // Subtract SIZES.base (8) from SIZES.padding (20) to absorb the button's internal padding (8).
    // New paddingRight = 20 - 8 = 12.
    paddingRight: SIZES.padding + SIZES.base + 10, 
  },
  problemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.padding,
    borderLeftWidth: 5,
    borderLeftColor: COLORS.border,
  },
  problemCardCompleted: {
    borderLeftColor: COLORS.success,
  },

  // Member
  requestName: { ...FONTS.body3, fontWeight: '600' },
  requestButtonContainer: { flexDirection: 'row', gap: SIZES.base },
  memberNameText: { ...FONTS.body3 },
  nameContainer: { flexDirection: 'row', alignItems: 'center' },
  adminTag: {
    marginLeft: SIZES.base,
    paddingHorizontal: SIZES.base,
    paddingVertical: 2,
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.base,
    marginRight:-10
  },
  adminTagText: {
    ...FONTS.caption,
    fontSize: 10,
    color: COLORS.surface,
    fontWeight: 'bold',
  },

  // Problem
  problemContent: { flex: 1, marginRight: SIZES.padding },
  problemTitle: { ...FONTS.h4, color: COLORS.text },
  problemSubtext: { ...FONTS.body5, color: COLORS.gray, marginTop: SIZES.base / 2 },
  othersCompletedText: { ...FONTS.body5, color: COLORS.gray },
  problemActionContainer: { width: 80, alignItems: 'flex-end', justifyContent: 'center' },
  completedButton: { alignItems: 'center' },
  completedText: { ...FONTS.caption, color: COLORS.success, fontWeight: 'bold' },
  doneButton: {
    backgroundColor: COLORS.primary,
    padding: SIZES.base,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    width: '100%',
  },
  doneButtonText: {
    ...FONTS.caption,
    color: COLORS.surface,
    marginTop: SIZES.base / 2,
    fontWeight: 'bold',
  },

  // Admin Panel & Inputs
  adminPanel: { padding: SIZES.padding, margin: SIZES.padding },
  panelTitle: { ...FONTS.h3, color: COLORS.primary, marginBottom: SIZES.padding },
  label: { ...FONTS.body4, color: COLORS.text, marginBottom: SIZES.base, marginTop: SIZES.base },
  pickerContainer: {
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: SIZES.radius,
    overflow: 'hidden',
    marginBottom: SIZES.padding,
  },
  picker: { height: 60, width: '100%', color: COLORS.text },
  input: {
    ...FONTS.body4,
    height: 48,
    borderColor: COLORS.border,
    borderWidth: 1,
    marginBottom: SIZES.padding,
    paddingHorizontal: SIZES.padding,
    borderRadius: SIZES.radius,
    color: COLORS.text
  },
  emptyText: { textAlign: 'center', marginTop: SIZES.padding * 2, ...FONTS.body3, color: COLORS.gray },

  // Modals
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  modalImage: { width: '100%', height: '80%' },
  modalCloseButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 40 : 20,
    right: 20,
  },

  // Custom Button
  customButton: {
    height: 48,
    borderRadius: SIZES.radius,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  customButtonText: {
    ...FONTS.h4,
    fontWeight: 'bold',
  },

  // Action Modal
  actionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: Platform.OS === 'ios' ? 100 : 50,
    paddingRight: 10,
  },
  actionModalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius,
    padding: SIZES.base,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
      android: { elevation: 8 },
    }),
  },
  modalActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SIZES.base * 1.5,
  },
  modalActionText: { ...FONTS.body4, color: COLORS.text },

  // Sidebar Styles
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  sidebar: {
    width: '80%',
    backgroundColor: COLORS.surface,
    padding: SIZES.padding,
    borderTopLeftRadius: SIZES.radius * 2,
    borderBottomLeftRadius: SIZES.radius * 2,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sidebarTitle: {
    ...FONTS.h3,
    color: COLORS.text,
    fontWeight: 'bold',
  },
  standingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  standingItemEven: {
    backgroundColor: COLORS.background,
  },
  standingItemCurrent: {
    backgroundColor: COLORS.primary_light,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  standingRankText: {
    ...FONTS.h4,
    fontWeight: 'bold',
    width: 40,
    color: COLORS.primary,
    textAlign: 'center'
  },
  standingNameText: {
    ...FONTS.body3,
    flex: 1,
    marginLeft: SIZES.base,
    color: COLORS.text,
  },
  standingPointsText: {
    ...FONTS.body3,
    fontWeight: 'bold',
    color: COLORS.success,
  },

  // member row & progress
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZES.base,
    paddingVertical: SIZES.base,
    paddingHorizontal: SIZES.base,
    borderRadius: SIZES.radius / 2,
    backgroundColor: COLORS.background,
  },
  currentUserRow: {
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  rank: {
    width: 30,
    ...FONTS.body,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  memberNameText: {
    flex: 1,
    ...FONTS.body,
    color: COLORS.textPrimary,
  },
  currentUserText: {
    fontWeight: 'bold',
    color: COLORS.primaryDark,
  },
  progressWrapper: {
    width: 100,
    height: 20,
    backgroundColor: COLORS.border,
    borderRadius: SIZES.radius,
    overflow: 'hidden',
    justifyContent: 'center',
    marginLeft: SIZES.base,
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    position: 'absolute',
    left: 0,
    borderRadius: SIZES.radius,
  },
  progressText: {
    position: 'absolute',
    right: SIZES.base / 2,
    ...FONTS.caption,
    fontWeight: 'bold',
    color: 'black',
  },
});

export default RoomDetailScreen;