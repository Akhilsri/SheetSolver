import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';
import { useRoute } from '@react-navigation/native';

// Modern Color System
const COLORS = {
  background: '#F9FAFB',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  primary: '#3B82F6',
  border: '#E5E7EB',
  white: '#FFFFFF',
  inputBg: '#F3F4F6',
};
const SIZES = { padding: 16, radius: 12 };
const FONTS = {
  h1: { fontSize: 28, fontWeight: '700' },
  h2: { fontSize: 20, fontWeight: '600' },
  body: { fontSize: 16 },
};

const PrimaryButton = ({ title, onPress, isLoading }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[styles.button, isLoading && { opacity: 0.7 }]}
    disabled={isLoading}
  >
    <Text style={styles.buttonText}>
      {isLoading ? 'Resetting...' : title}
    </Text>
  </TouchableOpacity>
);

const Header = ({ title, onBackPress }) => (
  <View style={styles.headerContainer}>
    <TouchableOpacity style={styles.backButton} onPress={onBackPress}>
      <Ionicons name="chevron-back" size={26} color={COLORS.primary} />
    </TouchableOpacity>
    <Text style={styles.headerTitle}>{title}</Text>
  </View>
);

const ResetPasswordScreen = ({ navigation }) => {
  const route = useRoute();
  const resetToken = route.params?.token;

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { confirmPasswordReset } = useAuth();

  useEffect(() => {
    if (!resetToken) {
      const timer = setTimeout(() => navigation.navigate('Login'), 3000);
      return () => clearTimeout(timer);
    }
  }, [resetToken, navigation]);

  const handleResetPassword = async () => {
    if (!resetToken) return Alert.alert('Error', 'Missing reset token. Redirecting...');
    if (newPassword.length < 6)
      return Alert.alert('Error', 'Password must be at least 6 characters.');
    if (newPassword !== confirmPassword)
      return Alert.alert('Error', 'New passwords do not match.');

    setIsLoading(true);
    try {
      await confirmPasswordReset(resetToken, newPassword);
      Alert.alert('Success', 'Your password has been reset successfully. Please log in.');
      navigation.navigate('Login');
    } catch (error) {
      Alert.alert('Reset Failed', error.message || 'Please request a new link.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!resetToken) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Verifying reset link...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <Header title="Set New Password" onBackPress={() => navigation.navigate('Login')} />

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Ionicons
              name="lock-closed-outline"
              size={50}
              color={COLORS.primary}
              style={styles.icon}
            />
            <Text style={styles.title}>Final Step</Text>
            <Text style={styles.subtitle}>
              Enter and confirm your new password below to regain access to your account.
            </Text>

            {/* New Password Input */}
            <View style={styles.inputContainer}>
              <Ionicons name="key-outline" size={20} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                placeholder="New Password"
                placeholderTextColor={COLORS.textSecondary}
                style={styles.input}
                secureTextEntry={!showPassword}
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((prev) => !prev)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={22}
                  color={COLORS.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputContainer}>
              <Ionicons name="key-outline" size={20} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                placeholder="Confirm Password"
                placeholderTextColor={COLORS.textSecondary}
                style={styles.input}
                secureTextEntry={!showPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((prev) => !prev)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={22}
                  color={COLORS.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <PrimaryButton
              title="Reset Password"
              onPress={handleResetPassword}
              isLoading={isLoading}
            />

            <TouchableOpacity
              style={styles.footerLink}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.footerText}>
                Go back to <Text style={styles.footerTextHighlight}>Login</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SIZES.padding,
    paddingHorizontal: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
    elevation: 2,
  },
  backButton: {
    marginRight: 8,
  },
  headerTitle: {
    ...FONTS.h2,
    color: COLORS.textPrimary,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SIZES.padding * 2,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius * 2,
    padding: SIZES.padding * 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  icon: {
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    ...FONTS.h1,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    ...FONTS.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderRadius: SIZES.radius,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
    height: 55,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 16,
  },
  footerLink: {
    marginTop: 24,
    alignItems: 'center',
  },
  footerText: {
    color: COLORS.textSecondary,
  },
  footerTextHighlight: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    ...FONTS.body,
    color: COLORS.textPrimary,
  },
});

export default ResetPasswordScreen;
