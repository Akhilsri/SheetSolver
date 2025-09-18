import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import apiClient from '../api/apiClient';
import { COLORS, SIZES, FONTS } from '../styles/theme';
import StyledInput from '../components/common/StyledInput';
import PrimaryButton from '../components/common/PrimaryButton';

const RegisterScreen = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    if (!username || !email || !password) {
      return Alert.alert('Error', 'Please fill in all fields.');
    }
    setIsLoading(true);
    try {
      await apiClient.post('/auth/register', { username, email, password });
      Alert.alert(
        'Success!',
        'Your account has been created. Please log in.',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
    } catch (error) {
      Alert.alert('Registration Failed', error.response?.data?.message || 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Start your collaborative DSA journey today.</Text>
        </View>

        <View style={styles.form}>
            <StyledInput
                value={username}
                onChangeText={setUsername}
                placeholder="Username"
                autoCapitalize="none"
            />
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
                title="Sign Up"
                onPress={handleRegister}
                isLoading={isLoading}
            />
        </View>
        
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.linkText}>Already have an account? <Text style={{fontWeight: 'bold'}}>Log In</Text></Text>
        </TouchableOpacity>
      </ScrollView>
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

export default RegisterScreen;