import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';

const COLORS = {
  background: '#F9FAFB',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  primary: '#3B82F6',
  border: '#E5E7EB',
  white: '#FFFFFF',
  card: '#FFFFFF',
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
      {isLoading ? 'Sending...' : title}
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

const StyledInput = ({ value, onChangeText, placeholder, keyboardType, autoCapitalize }) => (
  <View style={styles.inputContainer}>
    <Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      placeholderTextColor={COLORS.textSecondary}
    />
  </View>
);

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { forgotPassword } = useAuth();

  const handleSendResetEmail = async () => {
    if (!email) {
      return Alert.alert('Error', 'Please enter your registered email address.');
    }

    setIsLoading(true);
    try {
      await forgotPassword(email);
      Alert.alert(
        'Success',
        `A password reset link has been sent to ${email}. Check your inbox for the app deep link!`
      );
      navigation.goBack();
    } catch (error) {
      Alert.alert('Request Failed', error.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <Header title="Forgot Password" onBackPress={() => navigation.goBack()} />

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Ionicons name="lock-closed-outline" size={50} color={COLORS.primary} style={styles.icon} />
            <Text style={styles.title}>Reset Your Password</Text>
            <Text style={styles.subtitle}>
              Enter the email address associated with your account and we'll send you a password reset link.
            </Text>

            <StyledInput
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              autoCapitalize="none"
            />

            <PrimaryButton
              title="Send Reset Link"
              onPress={handleSendResetEmail}
              isLoading={isLoading}
            />

            <TouchableOpacity
              style={styles.footerLink}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.footerText}>
                Remember your password? <Text style={styles.footerTextHighlight}>Login</Text>
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
    backgroundColor: COLORS.card,
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
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  input: {
    flex: 1,
    height: 50,
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
});

export default ForgotPasswordScreen;