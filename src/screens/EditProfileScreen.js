import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import apiClient from '../api/apiClient';
import { useAuth } from '../context/AuthContext'; // Assuming you have a custom button component

const EditProfileScreen = () => {
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(true);
  
  // State for all profile fields
  const [fullName, setFullName] = useState('');
  const [collegeName, setCollegeName] = useState('');
  const [course, setCourse] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [branch, setBranch] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [twitterUrl, setTwitterUrl] = useState('');

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/users/profile');
      const profile = response.data;
      if (profile) {
        setFullName(profile.full_name || '');
        setCollegeName(profile.college_name || '');
        setCourse(profile.course || '');
        setGraduationYear(profile.graduation_year?.toString() || '');
        setBranch(profile.branch || '');
        setLinkedinUrl(profile.linkedin_url || '');
        setGithubUrl(profile.github_url || '');
        setTwitterUrl(profile.twitter_url || '');
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
    const profileData = {
      fullName, collegeName, course, branch,
      graduationYear: parseInt(graduationYear, 10) || null,
      linkedin_url: linkedinUrl,
      github_url: githubUrl,
      twitter_url: twitterUrl,
    };
    try {
      await apiClient.put('/users/profile', profileData);
      Alert.alert('Success', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert('Error', 'Could not update your profile.');
    }
  };

  if (isLoading) {
    return <ActivityIndicator size="large" style={styles.centered} />;
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.label}>Full Name</Text>
      <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Enter your full name" />
      
      <Text style={styles.label}>College Name</Text>
      <TextInput style={styles.input} value={collegeName} onChangeText={setCollegeName} placeholder="e.g., IIT Kanpur" />
      
      <Text style={styles.label}>Course</Text>
      <TextInput style={styles.input} value={course} onChangeText={setCourse} placeholder="e.g., B.Tech" />
      
      <Text style={styles.label}>Branch</Text>
      <TextInput style={styles.input} value={branch} onChangeText={setBranch} placeholder="e.g., Computer Science" />
      
      <Text style={styles.label}>Graduation Year</Text>
      <TextInput style={styles.input} value={graduationYear} onChangeText={setGraduationYear} placeholder="e.g., 2025" keyboardType="numeric" />
      
      <Text style={styles.label}>LinkedIn Profile URL</Text>
      <TextInput style={styles.input} value={linkedinUrl} onChangeText={setLinkedinUrl} placeholder="https://linkedin.com/in/your-profile" autoCapitalize="none" />

      <Text style={styles.label}>GitHub Profile URL</Text>
      <TextInput style={styles.input} value={githubUrl} onChangeText={setGithubUrl} placeholder="https://github.com/your-username" autoCapitalize="none" />
      
      <Text style={styles.label}>Twitter (X) Profile URL</Text>
      <TextInput style={styles.input} value={twitterUrl} onChangeText={setTwitterUrl} placeholder="https://x.com/your-username" autoCapitalize="none" />
      
      <View style={{marginTop: 20}}>
        <Button title="Save Changes" onPress={handleSave} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: '#fff' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    label: { fontSize: 16, color: '#333', marginBottom: 5, marginTop: 10, fontWeight: '500' },
    input: { height: 50, borderColor: '#ddd', borderWidth: 1, marginBottom: 15, paddingHorizontal: 15, borderRadius: 8, fontSize: 16 },
});

export default EditProfileScreen;