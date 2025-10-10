import React, { useState } from 'react';
import { View, TextInput, Button, StyleSheet, Alert } from 'react-native';
import apiClient from '../api/apiClient';

const CreateRoomScreen = ({ navigation }) => {
  const [roomName, setRoomName] = useState('');

  const handleCreateRoom = async () => {
    if (!roomName.trim()) {
      Alert.alert('Error', 'Please enter a room name.');
      return;
    }
    try {
      await apiClient.post('/rooms', { name: roomName });
      navigation.goBack(); // Go back to the RoomsScreen after creation
    } catch (error) {
      Alert.alert('Error', 'Could not create the room.');
      console.error(error);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Enter Room Name (e.g., SDE Sheet Grind)"
        value={roomName}
        onChangeText={setRoomName}
      />
      <Button title="Create Room" onPress={handleCreateRoom} />
    </View>
  );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20 },
    input: { height: 60, borderColor: 'gray', borderWidth: 1, marginBottom: 20, paddingHorizontal: 10 },
});

export default CreateRoomScreen;