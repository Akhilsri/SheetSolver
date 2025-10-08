import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import apiClient from '../api/apiClient';
import { COLORS, SIZES, FONTS } from '../styles/theme';
import StyledInput from '../components/common/StyledInput';
import PrimaryButton from '../components/common/PrimaryButton';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

// Screen dimensions
const { width, height } = Dimensions.get('window');

// Debounce utility
const debounce = (func, delay) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, delay);
  };
};

const RegisterScreen = () => {
  const navigation = useNavigation();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState({ available: null, message: '' });

  // Background animations
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, { toValue: width * 0.12, duration: 9000, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: -width * 0.12, duration: 9000, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, { toValue: height * 0.1, duration: 11000, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -height * 0.1, duration: 11000, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 15000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Username availability check
  const checkUsername = useCallback(
    debounce(async (newUsername) => {
      if (newUsername.length < 3) {
        setUsernameStatus({ available: null, message: '' });
        return;
      }
      setIsCheckingUsername(true);
      try {
        const response = await apiClient.post('/auth/check-username', { username: newUsername });
        if (response.data.available) {
          setUsernameStatus({ available: true, message: 'Username is available!' });
        } else {
          setUsernameStatus({ available: false, message: 'Username is already taken.' });
        }
      } catch {
        setUsernameStatus({ available: null, message: '' });
      } finally {
        setIsCheckingUsername(false);
      }
    }, 500),
    []
  );

  const handleUsernameChange = (text) => {
    setUsername(text);
    setUsernameStatus({ available: null, message: 'Checking...' });
    checkUsername(text);
  };

  const handleRegister = async () => {
    if (!username || !email || !password) {
      return Alert.alert('Error', 'Please fill in all fields.');
    }
    if (usernameStatus.available === false) {
      return Alert.alert('Error', 'That username is already taken. Please choose another.');
    }

    setIsLoading(true);
    try {
      await apiClient.post('/auth/register', { username, email, password });
      Alert.alert('Success!', 'Your account has been created. Please log in.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (error) {
      Alert.alert('Registration Failed', error.response?.data?.message || 'An error occurred.');
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
        style={[styles.blob, styles.blob1, { transform: [{ translateX }, { translateY }, { rotate }] }]}
      />
      <Animated.View
        style={[styles.blob, styles.blob2, { transform: [{ translateX: translateY }, { translateY: translateX }] }]}
      />
      <Animated.View style={[styles.blob, styles.blob3, { transform: [{ rotate }] }]} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Start your collaborative DSA journey today</Text>
        </View>

        <View style={styles.form}>
  {/* Username with inline status */}
  <View style={styles.inputWrapper}>
    <StyledInput
      value={username}
      onChangeText={handleUsernameChange}
      placeholder="Username"
      autoCapitalize="none"
    />
    <View style={styles.inlineStatus}>
      {isCheckingUsername ? (
        <ActivityIndicator size="small" color={COLORS.primary} />
      ) : (
        usernameStatus.message && (
          <Text
            style={[
              styles.statusText,
              usernameStatus.available ? styles.availableText : styles.unavailableText,
            ]}
          >
            {usernameStatus.message}
          </Text>
        )
      )}
    </View>
  </View>

  <StyledInput
    value={email}
    onChangeText={setEmail}
    placeholder="Email Address"
    keyboardType="email-address"
    autoCapitalize="none"
  />
  <View style={{ position: 'relative', marginBottom: SIZES.base }}>
  <StyledInput
    value={password}
    onChangeText={setPassword}
    placeholder="Password"
    secureTextEntry={!passwordVisible}
  />
  <TouchableOpacity
    onPress={() => setPasswordVisible(!passwordVisible)}
    style={{
      position: 'absolute',
      right: 12,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
    }}
  >
    <Ionicons
      name={passwordVisible ? 'eye-off' : 'eye'}
      size={22}
      color={COLORS.textSecondary}
    />
  </TouchableOpacity>
</View>


  <PrimaryButton
    title="Sign Up"
    onPress={handleRegister}
    isLoading={isLoading || isCheckingUsername}
  />
</View>


        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.linkText}>
            Already have an account? <Text style={styles.linkBold}>Log In</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SIZES.padding * 2,
  },
  header: {
    marginBottom: SIZES.padding * 2,
    alignItems: 'center',
  },
  title: {
    ...FONTS.h1,
    textAlign: 'center',
    color: COLORS.textPrimary,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    ...FONTS.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  form: {
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
  statusContainer: {
    height: 20,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginBottom: SIZES.base,
    paddingHorizontal: SIZES.base,
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
  form: {
  marginBottom: SIZES.padding * 2,
},
inputWrapper: {
  marginBottom: SIZES.base, // same spacing as other fields
},
inlineStatus: {
  marginTop: 4,
  paddingHorizontal: SIZES.base,
},
statusText: {
  ...FONTS.caption,
},
availableText: {
  color: COLORS.success,
},
unavailableText: {
  color: COLORS.danger,
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


});

export default RegisterScreen;