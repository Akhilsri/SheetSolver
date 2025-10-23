// in frontend/src/components/modals/NotificationPermissionModal.js
import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SIZES, FONTS } from '../../styles/theme'; // Adjust path if needed

const NotificationPermissionModal = () => {
  const { showNotificationPrompt, setShowNotificationPrompt, handleNotificationPermissionFlow } = useAuth();

  const onAllowPress = () => {
    handleNotificationPermissionFlow(); // This will also dismiss the modal
  };

  const onLaterPress = () => {
    setShowNotificationPrompt(false); // Just dismiss the modal
    // You might want to store a flag in AsyncStorage here:
    // await AsyncStorage.setItem('askedNotificationsLater', 'true');
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={showNotificationPrompt}
      onRequestClose={() => {
        // Handle physical back button on Android
        setShowNotificationPrompt(false); 
      }}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <Text style={styles.modalTitle}>Stay Updated with SheetSolver!</Text>
          <Text style={styles.modalText}>
            Allow us to send you real-time notifications for new room invitations,
            connection requests, and important activity updates.
          </Text>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.laterButton]}
              onPress={onLaterPress}
            >
              <Text style={styles.laterButtonText}>Maybe Later</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.allowButton]}
              onPress={onAllowPress}
            >
              <Text style={styles.allowButtonText}>Allow Notifications</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)', // Dim background
  },
  modalView: {
    margin: SIZES.padding * 2,
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius,
    padding: SIZES.padding * 2,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    ...FONTS.h2,
    color: COLORS.textPrimary,
    marginBottom: SIZES.padding,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  modalText: {
    ...FONTS.body,
    color: COLORS.textSecondary,
    marginBottom: SIZES.padding * 2,
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: SIZES.base,
  },
  button: {
    flex: 1,
    borderRadius: SIZES.radius,
    padding: SIZES.base * 1.5,
    elevation: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  allowButton: {
    backgroundColor: COLORS.primary,
  },
  allowButtonText: {
    ...FONTS.body,
    color: COLORS.surface,
    fontWeight: 'bold',
    fontSize: 15,
  },
  laterButton: {
    backgroundColor: COLORS.background, // A softer background color
    borderColor: COLORS.textSecondary,
    borderWidth: 1,
  },
  laterButtonText: {
    ...FONTS.body,
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 15,
  },
});

export default NotificationPermissionModal;