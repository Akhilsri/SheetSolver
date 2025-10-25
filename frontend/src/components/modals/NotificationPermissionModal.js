import React from 'react';
import { Modal, View, Text, Button, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { openAppSettings } from '../../services/notificationService'; 

// Key to track if the custom reminder modal has been dismissed
const DISMISSAL_KEY = 'NOTIFICATION_REMINDER_SHOWN_CUSTOM'; 

const NotificationPermissionModal = ({ visible, onClose }) => {
    
    const handleGoToSettings = () => {
        openAppSettings(); 
        onClose(); 
    };

    const handleDismiss = async () => {
        // Set the flag so the custom modal does not reappear on subsequent app opens
        await AsyncStorage.setItem(DISMISSAL_KEY, 'true'); 
        onClose(); 
    };

    return (
        <Modal 
            visible={visible} 
            transparent 
            animationType="fade" 
            // Handles Android back button dismissal
            onRequestClose={handleDismiss} 
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <Text style={styles.title}>Enable Notifications 🔔</Text>
                    <Text style={styles.message}>
                        You have disabled notifications. Please enable them manually in your device settings to get real-time updates.
                    </Text>
                    <Button title="Go to Settings" onPress={handleGoToSettings} />
                    <View style={{ height: 10 }} />
                    <Button title="Maybe Later" onPress={handleDismiss} color="#888" />
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    container: {
        width: 300,
        padding: 20,
        backgroundColor: 'white',
        borderRadius: 10,
        alignItems: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    message: {
        textAlign: 'center',
        marginBottom: 20,
        color: '#666',
    },
});

export default NotificationPermissionModal;