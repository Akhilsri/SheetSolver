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
  Dimensions
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { COLORS, SIZES, FONTS } from '../styles/theme';
import StyledInput from '../components/common/StyledInput';
import PrimaryButton from '../components/common/PrimaryButton';

const appLogo = require('../assets/images/SS-logo.png');

const { width, height } = Dimensions.get('window');

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  // Animations
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const logoAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Background animation
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

    // Floating logo effect
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Animated Blobs */}
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
      <Animated.View
        style={[
          styles.blob,
          styles.blob3,
          { transform: [{ rotate }] },
        ]}
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        <Animated.Image
          source={appLogo}
          style={[styles.logo, { transform: [{ translateY: logoAnim }] }]}
        />

        <View style={styles.header}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Log in to continue your journey</Text>
        </View>

        <View style={styles.form}>
          <StyledInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email Address"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <StyledInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            secureTextEntry
          />
          <PrimaryButton
            title="Log In"
            onPress={handleLogin}
            isLoading={isLoading}
          />
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
  header: {
    marginBottom: SIZES.padding * 2,
  },
  title: {
    ...FONTS.h1,
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
