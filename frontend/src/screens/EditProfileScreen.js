import React, { useState, useCallback } from 'react';
import { 
  View, Text, TextInput, StyleSheet, Alert, ScrollView, 
  ActivityIndicator, TouchableOpacity, Image 
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import apiClient from '../api/apiClient';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/Ionicons';

const EditProfileScreen = () => {
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [profile, setProfile] = useState(null);

  // Single form state
  const [form, setForm] = useState({
    full_name: '',
    college_name: '',
    course: '',
    branch: '',
    graduation_year: '',
    linkedin_url: '',
    github_url: '',
    twitter_url: '',
  });

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      const { data } = await apiClient.get('/users/profile');
      if (data) {
        setProfile(data);
        setForm({
          full_name: data.full_name || '',
          college_name: data.college_name || '',
          course: data.course || '',
          branch: data.branch || '',
          graduation_year: data.graduation_year?.toString() || '',
          linkedin_url: data.linkedin_url || '',
          github_url: data.github_url || '',
          twitter_url: data.twitter_url || '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      Alert.alert('Error', 'Could not load your profile for editing.');
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchProfile(); }, []));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiClient.put('/users/profile', {
        ...form,
        graduation_year: parseInt(form.graduation_year, 10) || null,
      });
      Alert.alert('Success', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Profile update failed:', error);
      Alert.alert('Error', 'Could not update your profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImagePick = () => {
    Alert.alert('Update Profile Picture', 'Choose an option', [
      { text: 'Take Photo...', onPress: () => uploadAvatar('camera') },
      { text: 'Choose from Gallery...', onPress: () => uploadAvatar('gallery') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const uploadAvatar = (method) => {
    const options = { mediaType: 'photo', quality: 0.7 };
    const launcher = method === 'camera' ? launchCamera : launchImageLibrary;

    launcher(options, async (response) => {
      if (response.didCancel) return;
      if (response.errorCode) return Alert.alert('Error', response.errorMessage);

      const image = response.assets?.[0];
      if (!image) return;

      const previousAvatar = profile?.avatar_url;

      // Show local image immediately
      setProfile((prev) => ({ ...prev, avatar_url: image.uri }));

      const formData = new FormData();
      formData.append('avatar', {
        uri: image.uri,
        type: image.type,
        name: image.fileName,
      });

      try {
        setIsSaving(true);
        const res = await apiClient.post('/users/profile/avatar', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        // Cache-busting with timestamp
        setProfile((prev) => ({
          ...prev,
          avatar_url: `${res.data.avatar_url}?t=${Date.now()}`,
        }));
      } catch (error) {
        console.error('Avatar upload failed:', error);

        // Revert to old avatar if upload fails
        setProfile((prev) => ({ ...prev, avatar_url: previousAvatar }));

        Alert.alert('Error', 'Could not update profile picture.');
      } finally {
        setIsSaving(false);
      }
    });
  };

  if (isLoading) {
    return <ActivityIndicator size="large" style={styles.centered} />;
  }

  return (
    <ScrollView style={styles.container}>
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <TouchableOpacity onPress={handleImagePick}>
          <Image
            key={profile?.avatar_url} // force rerender
            source={
              profile?.avatar_url
                ? { uri: profile.avatar_url }
                : require('../assets/images/default_avatar.png')
            }
            style={styles.avatar}
          />
          <View style={styles.editIcon}>
            <Icon name="camera" size={20} color="white" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Form Inputs */}
      {[
        { label: 'Full Name', key: 'full_name', placeholder: 'Enter your full name' },
        { label: 'College Name', key: 'college_name', placeholder: 'e.g., IIT Kanpur' },
        { label: 'Course', key: 'course', placeholder: 'e.g., B.Tech' },
        { label: 'Branch', key: 'branch', placeholder: 'e.g., Computer Science' },
        { label: 'Graduation Year', key: 'graduation_year', placeholder: 'e.g., 2025', keyboardType: 'numeric' },
        { label: 'LinkedIn URL', key: 'linkedin_url', placeholder: 'https://linkedin.com/in/your-profile' },
        { label: 'GitHub URL', key: 'github_url', placeholder: 'https://github.com/your-username' },
        { label: 'Twitter (X) URL', key: 'twitter_url', placeholder: 'https://x.com/your-username' },
      ].map(({ label, key, ...rest }) => (
        <View key={key}>
          <Text style={styles.label}>{label}</Text>
          <TextInput
            style={styles.input}
            value={form[key]}
            onChangeText={(text) => setForm((prev) => ({ ...prev, [key]: text }))}
            autoCapitalize="none"
            {...rest}
          />
        </View>
      ))}

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.saveBtn, isSaving && { opacity: 0.6 }]}
        disabled={isSaving}
        onPress={handleSave}
      >
        {isSaving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveBtnText}>Save Changes</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 16, color: '#333', marginBottom: 5, marginTop: 10, fontWeight: '500' },
  input: { height: 50, borderColor: '#ddd', borderWidth: 1, marginBottom: 15, paddingHorizontal: 15, borderRadius: 8, fontSize: 16 },
  avatarContainer: { alignItems: 'center', marginVertical: 20 },
  avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: '#007BFF' },
  editIcon: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#007BFF', padding: 8, borderRadius: 15 },
  saveBtn: { backgroundColor: '#007BFF', padding: 15, borderRadius: 10, alignItems: 'center', marginVertical: 30 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

export default EditProfileScreen;