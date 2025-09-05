import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import apiClient from '../api/apiClient';

const ProfileScreen = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [collegeName, setCollegeName] = useState('');
  const [course, setCourse] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [branch, setBranch] = useState('');

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
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchProfile(); }, []));

  const handleSave = async () => {
    const profileData = {
      fullName,
      collegeName,
      course,
      graduationYear: parseInt(graduationYear, 10) || null,
      branch,
    };
    try {
      await apiClient.put('/users/profile', profileData);
      Alert.alert('Success', 'Your profile has been updated.');
    } catch (error) {
      Alert.alert('Error', 'Could not update your profile.');
    }
  };

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
      
      <Button title="Save Profile" onPress={handleSave} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  label: { fontSize: 16, color: '#333', marginBottom: 5, marginTop: 10 },
  input: { height: 40, borderColor: 'gray', borderWidth: 1, marginBottom: 20, paddingHorizontal: 10, borderRadius: 4 },
});

export default ProfileScreen;