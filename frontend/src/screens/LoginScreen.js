import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { COLORS, SIZES, FONTS } from '../styles/theme';
import StyledInput from '../components/common/StyledInput';
import PrimaryButton from '../components/common/PrimaryButton';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      return Alert.alert('Error', 'Please fill in all fields.');
    }
    setIsLoading(true);
    try {
      await login(email, password);
      // Navigation will happen automatically from the AuthContext/AppNavigator
    } catch (error) {
      Alert.alert('Login Failed', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
    >
        <View style={styles.header}>
            <Text style={styles.title}>Welcome Back!</Text>
            <Text style={styles.subtitle}>Log in to continue your journey.</Text>
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
            <Text style={styles.linkText}>Don't have an account? <Text style={{fontWeight: 'bold'}}>Sign Up</Text></Text>
        </TouchableOpacity>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.surface,
        justifyContent: 'center',
        padding: SIZES.padding * 1.5,
    },
    header: {
        marginBottom: SIZES.padding * 2,
    },
    title: {
        ...FONTS.h1,
        textAlign: 'center',
    },
    subtitle: {
        ...FONTS.body,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginTop: SIZES.base,
    },
    form: {
        marginBottom: SIZES.padding * 2,
    },
    linkText: {
        ...FONTS.body,
        color: COLORS.primary,
        textAlign: 'center',
    },
});

export default LoginScreen;