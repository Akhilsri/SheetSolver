import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Alert,
    ScrollView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SIZES, FONTS } from '../styles/theme'; // Assuming these are still relevant
import Icon from 'react-native-vector-icons/Ionicons';
import apiClient from '../api/apiClient'; // Your existing API client

const FeedbackScreen = () => {
    const navigation = useNavigation();
    const [feedbackText, setFeedbackText] = useState('');
    const [email, setEmail] = useState(''); // Optional email field
    const [category, setCategory] = useState('General Feedback');
    const [isLoading, setIsLoading] = useState(false);

    const categories = [
        'General Feedback',
        'Bug Report',
        'Feature Request',
        'UI/UX Suggestion',
        'Performance Issue',
        'Other',
    ];

    const handleSubmitFeedback = async () => {
        if (!feedbackText.trim()) {
            Alert.alert('Validation Error', 'Please enter your feedback before submitting.');
            return;
        }

        setIsLoading(true);
        try {
            // --- Backend Integration Placeholder ---
            await apiClient.post('/feedback', {
                feedbackText,
                email: email.trim() || null, // Send null if empty
                category,
            });

            Alert.alert('Thank You!', 'Your feedback has been successfully submitted. We appreciate your input!', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);

            // Clear form
            setFeedbackText('');
            setEmail('');
            setCategory('General Feedback');

        } catch (error) {
            console.error('Feedback submission failed:', error);
            Alert.alert(
                'Submission Failed',
                error.response?.data?.message || 'Could not submit your feedback. Please try again.'
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : -100} // Adjust offset if needed
        >
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.header}>
                    <Icon name="chatbox-ellipses-outline" size={SIZES.iconLarge} color={COLORS.primary} />
                    <Text style={styles.title}>Submit Your Feedback</Text>
                    <Text style={styles.subtitle}>
                        Help us improve! Share any bugs, feature requests, or suggestions.
                    </Text>
                </View>

                <View style={styles.formSection}>
                    <Text style={styles.label}>Category:</Text>
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={category}
                            onValueChange={(itemValue) => setCategory(itemValue)}
                            style={styles.picker}
                            // itemStyle is not needed/effective for Android, and we removed iOS fixed height
                        >
                            {categories.map((cat, index) => (
                                <Picker.Item key={index} label={cat} value={cat} />
                            ))}
                        </Picker>
                        <Icon 
                            name="chevron-down-outline" 
                            size={SIZES.iconSmall} 
                            color={COLORS.textSecondary} 
                            style={styles.pickerIcon}
                        />
                    </View>

                    <Text style={styles.label}>Your Feedback (Required):</Text>
                    <TextInput
                        style={styles.feedbackInput}
                        placeholder="Tell us what you think..."
                        placeholderTextColor={COLORS.textSecondary}
                        multiline
                        numberOfLines={10} // Increased for more space
                        value={feedbackText}
                        onChangeText={setFeedbackText}
                        textAlignVertical="top"
                    />

                    <Text style={styles.label}>Your Email (Optional, for follow-up):</Text>
                    <TextInput
                        style={styles.emailInput}
                        placeholder="email@example.com"
                        placeholderTextColor={COLORS.textSecondary}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={email}
                        onChangeText={setEmail}
                    />

                    <TouchableOpacity
                        style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                        onPress={handleSubmitFeedback}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color={COLORS.surface} />
                        ) : (
                            <Text style={styles.submitButtonText}>Submit Feedback</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    contentContainer: {
        padding: SIZES.padding * 0.75 ,
        paddingBottom: SIZES.padding * 2,
    },

    // --- Header Section Changes: Less content, more direct ---
    header: {
        alignItems: 'center',
        marginBottom: SIZES.padding * 2.5, // Added spacing below the header
    },
    title: {
        ...FONTS.h2,
        color: COLORS.textPrimary,
        marginTop: SIZES.base,
        textAlign: 'center',
    },
    subtitle: {
        ...FONTS.body3, // Slightly smaller font for subtitle
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginTop: SIZES.base / 2,
        // Removed paddingHorizontal to use full width if needed, but the text is short now
    },
    // --- End Header Section Changes ---

    formSection: {
        backgroundColor: COLORS.surface,
        borderRadius: SIZES.radius,
        padding: SIZES.padding * 1.5,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    label: {
        ...FONTS.h4,
        color: COLORS.textPrimary,
        fontWeight: '600',
        marginBottom: SIZES.base,
        marginTop: SIZES.padding, // More spacing before label
    },

    // --- Picker & Input Box Size Changes ---
    pickerContainer: {
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: SIZES.radius,
        backgroundColor: COLORS.inputBackground,
        marginBottom: SIZES.base,
        height: 55, // Fixed height for a larger, cleaner look
        justifyContent: 'center',
    },
    picker: {
        color: COLORS.textPrimary,
        height: 55,
        width: '100%',
    },
    pickerIcon: {
        position: 'absolute',
        right: SIZES.padding,
        // Center the icon vertically based on the 55 height and icon size
        top: 55 / 2 - SIZES.iconSmall / 2, 
        pointerEvents: 'none', // Ensures touch events pass through to the Picker
    },
    feedbackInput: {
        minHeight: 180, // **Significantly increased size**
        backgroundColor: COLORS.inputBackground,
        borderColor: COLORS.border,
        borderWidth: 1,
        borderRadius: SIZES.radius,
        padding: SIZES.padding,
        ...FONTS.body,
        color: COLORS.textPrimary,
        marginBottom: SIZES.base,
    },
    emailInput: {
        height: 55, // Increased height for better tap target
        backgroundColor: COLORS.inputBackground,
        borderColor: COLORS.border,
        borderWidth: 1,
        borderRadius: SIZES.radius,
        paddingHorizontal: SIZES.padding,
        ...FONTS.body,
        color: COLORS.textPrimary,
        marginBottom: SIZES.padding * 2,
    },
    // --- End Picker & Input Box Size Changes ---
    
    submitButton: {
        backgroundColor: COLORS.primary,
        paddingVertical: SIZES.padding * 1.2, // Slightly larger button
        borderRadius: SIZES.radius,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    submitButtonDisabled: {
        backgroundColor: COLORS.gray,
        opacity: 0.7,
    },
    submitButtonText: {
        ...FONTS.h4,
        color: COLORS.surface,
        fontWeight: 'bold',
    },
});

export default FeedbackScreen;