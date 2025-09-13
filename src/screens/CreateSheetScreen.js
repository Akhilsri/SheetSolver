import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import * as DocumentPicker from 'expo-document-picker'; // <-- 1. New import
import apiClient from '../api/apiClient';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SIZES, FONTS } from '../styles/theme';
import Icon from 'react-native-vector-icons/Ionicons';

const CreateSheetScreen = () => {
  const navigation = useNavigation();
  const [sheetName, setSheetName] = useState('');
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // 2. Updated function to use the new library's API
  const selectFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/csv', // A simpler way to specify the type
      });

      if (!result.canceled) {
        setFile(result.assets[0]); // The file is in the 'assets' array
      }
    } catch (err) {
      console.error('File picker error:', err);
      Alert.alert('Error', 'Could not open file picker.');
    }
  };

  const handleUpload = async () => {
    if (!sheetName.trim() || !file) {
      return Alert.alert('Error', 'Please provide a sheet name and select a CSV file.');
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('sheetName', sheetName);
    formData.append('sheetFile', {
      uri: file.uri,
      type: file.mimeType, // The new library provides mimeType
      name: file.name,
    });

    try {
      const response = await apiClient.post('/custom-sheets/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      Alert.alert('Success', response.data.message, [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to upload and create sheet.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create a Custom Sheet</Text>
      <Text style={styles.label}>Sheet Name</Text>
      <TextInput
        style={styles.input}
        value={sheetName}
        onChangeText={setSheetName}
        placeholder="e.g., My FAANG Prep List"
      />

      <TouchableOpacity style={styles.fileButton} onPress={selectFile}>
        <Icon name="cloud-upload-outline" size={24} color={COLORS.primary} />
        <Text style={styles.fileButtonText}>{file ? `Selected: ${file.name}` : 'Select CSV File'}</Text>
      </TouchableOpacity>
      <Text style={styles.note}>CSV format must be: topic,title,url,difficulty</Text>
      
      <View style={{marginTop: SIZES.padding * 2}}>
        <Button title={isUploading ? "Creating..." : "Create Sheet & Upload"} onPress={handleUpload} disabled={isUploading} color={COLORS.primary} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: SIZES.padding, backgroundColor: COLORS.surface },
    title: { ...FONTS.h1, marginBottom: SIZES.padding * 2, textAlign: 'center' },
    label: { ...FONTS.h3, color: COLORS.textSecondary, marginBottom: SIZES.base },
    input: { height: 50, backgroundColor: COLORS.background, borderRadius: SIZES.radius, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SIZES.base * 2, marginBottom: SIZES.padding, ...FONTS.body },
    fileButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: SIZES.padding,
        borderRadius: SIZES.radius,
        borderWidth: 1,
        borderColor: COLORS.primary,
        borderStyle: 'dashed',
        backgroundColor: COLORS.primaryLight,
    },
    fileButtonText: { ...FONTS.body, color: COLORS.primary, marginLeft: SIZES.base },
    note: { ...FONTS.caption, textAlign: 'center', marginTop: SIZES.base },
});

export default CreateSheetScreen;