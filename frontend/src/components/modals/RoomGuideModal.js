import React, { useState, useEffect } from 'react';
import { View, Text, Modal, StyleSheet, Image, TouchableOpacity, SafeAreaView, Dimensions, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS, SIZES, FONTS } from '../../styles/theme';
import CustomButton from '../common/CustomButton'; // Assuming you extract CustomButton

const STORAGE_KEY = '@RoomDetailGuideSeen';
const screenHeight = Dimensions.get('window').height;

const RoomGuideModal = ({ isRoomActive, onFinish }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Check if the user has seen the guide
  useEffect(() => {
    const checkSeenStatus = async () => {
      if (!isRoomActive) { // Only show the guide if the room is active and problems are visible
          setIsLoading(false);
          return;
      }
      try {
        const value = await AsyncStorage.getItem(STORAGE_KEY);
        if (value === null) {
          // Key not found: First-time user
          setIsVisible(true);
        }
      } catch (e) {
        console.error("AsyncStorage error:", e);
      } finally {
        setIsLoading(false);
      }
    };
    checkSeenStatus();
  }, [isRoomActive]);

  // 2. Mark as seen and close the modal
  const handleFinish = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, 'true');
      setIsVisible(false);
      if (onFinish) onFinish(); // Optional callback to parent
    } catch (e) {
      console.error("Failed to save seen status:", e);
      setIsVisible(false); // Close even if saving fails
    }
  };
  
  // Wait for the storage check
  if (isLoading || !isRoomActive) {
      return null; 
  }

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={handleFinish}
    >
      <SafeAreaView style={styles.overlay}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>How to Submit a Solution</Text>
          <Text style={styles.subtitle}>This guide appears only once!</Text>
          
          <Image 
            source={require('../../assets/images/showSubmission.jpg')} // TODO: Replace with a local or remote image showing the required proof photo (Accepted screen)
            style={styles.proofImage} 
            resizeMode="contain" 
          />
          
          <View style={styles.stepContainer}>
            <Icon name="camera-outline" size={24} color={COLORS.primary} />
            <Text style={styles.stepText}>
              <Text style={{fontWeight: 'bold'}}>Step 1: Take Photo Proof 📸</Text>
              {"\n"}Ensure your picture clearly shows the <Text style={styles.highlight}>'Accepted' status</Text> on the coding platform (e.g., LeetCode, GFG) before proceeding.
            </Text>
          </View>

          <View style={styles.stepContainer}>
            <Icon name="create-outline" size={24} color={COLORS.primary} />
            <Text style={styles.stepText}>
              <Text style={{fontWeight: 'bold'}}>Step 2: Add Details 📝</Text>
              {"\n"}Fill in your <Text style={styles.highlight}>Approach</Text>, <Text style={styles.highlight}>Time Complexity (TC)</Text>, and <Text style={styles.highlight}>Space Complexity (SC)</Text> in the next screen.
            </Text>
          </View>
          
          <CustomButton 
            title="Got It! Start Solving" 
            onPress={handleFinish} 
            color={COLORS.success}
            style={styles.finishButton}
          />

        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius * 2,
    padding: SIZES.padding * 1.5,
    maxHeight: screenHeight * 0.9,
    alignItems: 'center',
  },
  title: {
    ...FONTS.h2,
    color: COLORS.primary,
    marginBottom: SIZES.base,
  },
  subtitle: {
    ...FONTS.body4,
    color: COLORS.textSecondary,
    marginBottom: SIZES.padding,
    textAlign: 'center',
  },
  proofImage: {
    width: '100%',
    height: 180, // Adjust size as needed
    borderRadius: SIZES.radius,
    marginBottom: SIZES.padding * 1.5,
    backgroundColor: COLORS.border,
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SIZES.padding,
  },
  stepText: {
    flex: 1,
    ...FONTS.body4,
    color: COLORS.text,
    marginLeft: SIZES.base,
    lineHeight: 20,
  },
  highlight: {
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  finishButton: {
    marginTop: SIZES.padding,
    width: '100%',
  }
});

export default RoomGuideModal;