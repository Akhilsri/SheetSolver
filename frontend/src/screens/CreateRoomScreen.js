import React, { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Alert,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView, // Good for handling keyboard on mobile
  Platform, // Used with KeyboardAvoidingView
} from 'react-native';
import apiClient from '../api/apiClient';

// --- Modified UI Code ---

const CreateRoomScreen = ({ navigation }) => {
  const [roomName, setRoomName] = useState('');
  const [isLoading, setIsLoading] = useState(false); // State for loading

  const handleCreateRoom = async () => {
    if (!roomName.trim()) {
      Alert.alert('Error', 'Please enter a room name.');
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.post('/rooms', { name: roomName });
      setIsLoading(false);
      navigation.goBack(); // Go back to the RoomsScreen after creation
    } catch (error) {
      setIsLoading(false);
      Alert.alert('Error', 'Could not create the room. Please try again.');
      console.error(error);
    }
  };

  return (
    // Use KeyboardAvoidingView to ensure the input isn't covered by the keyboard
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Text style={styles.title}>Create a New Study Room</Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Room Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., SDE Sheet Grind"
          placeholderTextColor="#999"
          value={roomName}
          onChangeText={setRoomName}
          autoCorrect={false}
          autoCapitalize="sentences"
          // Add some visual cues for focus
          onFocus={(e) => { e.target.setNativeProps({ style: styles.inputFocused }); }}
          onBlur={(e) => { e.target.setNativeProps({ style: styles.input }); }}
          editable={!isLoading}
        />
      </View>

      {/* Custom Button for better styling and loading state */}
      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleCreateRoom}
        disabled={isLoading || !roomName.trim()}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>
          {isLoading ? 'Creating Room...' : 'Create Room'}
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
};

// --- Stylesheet for Improvements ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#f8f8f8', // Light background
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 30,
    textAlign: 'left',
  },
  inputContainer: {
    marginBottom: 30,
  },
  label: {
    fontSize: 16,
    color: '#555',
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    height: 55,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd', // Light border
    // Shadow for better depth on iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2, // Shadow for Android
  },
  inputFocused: {
    borderColor: '#007AFF', // Highlight color when focused
    borderWidth: 2,
  },
  button: {
    backgroundColor: '#007AFF', // Primary color (e.g., bright blue)
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    backgroundColor: '#a8c6f1', // Lighter shade when disabled
  },
});

export default CreateRoomScreen;