import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Image,
  Dimensions,
  TextInput,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';
// Assuming these are available:
import { COLORS, SIZES, FONTS } from '../styles/theme';
import StyledInput from '../components/common/StyledInput';
import PrimaryButton from '../components/common/PrimaryButton';

const appLogo = require('../assets/images/SS-logo.png');
const { width, height } = Dimensions.get('window');

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // Assuming 'login' is available from your context
  const { login } = useAuth();

  // animations
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const logoAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animation setup (keeping your original animation logic)
    Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: width * 0.12,
          duration: 9000,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: -width * 0.12,
          duration: 9000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: height * 0.1,
          duration: 11000,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -height * 0.1,
          duration: 11000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 15000,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(logoAnim, {
          toValue: -10,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(logoAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleLogin = async () => {
    if (!email || !password) {
      return Alert.alert('Error', 'Please fill in all fields.');
    }
    setIsLoading(true);
    try {
      await login(email, password);
    } catch (error) {
      Alert.alert('Login Failed', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    navigation.navigate('ForgotPassword'); // Navigate to the new screen
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Animated Blobs (kept for background aesthetics) */}
      <Animated.View
        style={[
          styles.blob,
          styles.blob1,
          { transform: [{ translateX }, { translateY }, { rotate }] },
        ]}
      />
      <Animated.View
        style={[
          styles.blob,
          styles.blob2,
          { transform: [{ translateX: translateY }, { translateY: translateX }] },
        ]}
      />
      <Animated.View style={[styles.blob, styles.blob3, { transform: [{ rotate }] }]} />

      <View style={styles.overlay}>
        <Animated.Image
          source={appLogo}
          style={[styles.logo, { transform: [{ translateY: logoAnim }] }]}
        />
        
        {/* APP NAME ADDED HERE */}
        <Text style={styles.appName}>SheetSolver</Text> 

        <View style={styles.header}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Log in to continue your journey</Text>
        </View>

        <View style={styles.form}>
          {/* StyledInput assumed to be similar to the password container style */}
          <StyledInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email Address"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Password Input */}
          <View style={styles.passwordContainer}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={COLORS.textSecondary}
              style={styles.passwordInput}
              autoCapitalize="none"
              secureTextEntry={!showPassword}
              importantForAutofill="yes"
              textContentType="password"
            />
            <TouchableOpacity
              onPress={() => setShowPassword((prev) => !prev)}
              style={styles.eyeIcon}
              activeOpacity={0.7}
            >
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={22}
                color={COLORS.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* FORGOT PASSWORD LINK ADDED HERE */}
          <TouchableOpacity 
            onPress={handleForgotPassword} 
            style={styles.forgotPasswordLink}
            activeOpacity={0.7}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          <PrimaryButton title="Log In" onPress={handleLogin} isLoading={isLoading} />
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text style={styles.linkText}>
            Don’t have an account? <Text style={styles.linkBold}>Sign Up</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding * 2,
  },
  logo: {
    width: 110,
    height: 110,
    resizeMode: 'contain',
    marginBottom: SIZES.padding * 2,
  },
  // NEW STYLE FOR APP NAME
  appName: {
    ...FONTS.h1, 
    color: COLORS.primary,
    fontWeight: '800',
    marginBottom: SIZES.padding,
    textAlign: 'center',
  },
  header: {
    marginBottom: SIZES.padding * 2,
  },
  title: {
    ...FONTS.h2,
    textAlign: 'center',
    color: COLORS.textPrimary,
    marginBottom: 6,
    fontWeight: '700',
  },
  subtitle: {
    ...FONTS.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  form: {
    width: '100%',
    marginBottom: SIZES.padding * 2,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.background,
    marginBottom: SIZES.padding,
    paddingHorizontal: SIZES.padding,
    height: 55,
  },
  passwordInput: {
    flex: 1,
    color: COLORS.textPrimary,
    ...FONTS.body,
  },
  eyeIcon: {
    paddingHorizontal: 6,
  },
  // NEW STYLES
  forgotPasswordLink: {
    alignSelf: 'flex-end',
    marginBottom: SIZES.padding,
  },
  forgotPasswordText: {
    ...FONTS.body,
    fontSize: SIZES.font - 2, // Slightly smaller text
    color: COLORS.primary,
    fontWeight: '600',
  },
  // END NEW STYLES
  linkText: {
    ...FONTS.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SIZES.padding,
  },
  linkBold: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.45,
  },
  blob1: {
    width: width * 0.7,
    height: width * 0.7,
    backgroundColor: COLORS.primary,
    top: -height * 0.15,
    left: -width * 0.2,
  },
  blob2: {
    width: width * 0.6,
    height: width * 0.6,
    backgroundColor: COLORS.secondary,
    bottom: -height * 0.1,
    right: -width * 0.15,
  },
  blob3: {
    width: width * 0.5,
    height: width * 0.5,
    backgroundColor: COLORS.accent || COLORS.primary,
    top: height * 0.35,
    left: width * 0.3,
    opacity: 0.3,
  },
});

export default LoginScreen;
