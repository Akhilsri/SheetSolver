import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import StyledInput from '../common/StyledInput'; // Adjust path if needed
import { COLORS, SIZES, FONTS } from '../../styles/theme'; // Adjust path if needed

const UsernameInputWithFeedback = ({
  value,
  onChangeText,
  placeholder,
  autoCapitalize,
  usernameLoading,
  usernameAvailable, // null, true, false
  ...rest
}) => {
  const isUsernameInvalid = usernameAvailable === false;
  const isUsernameAvailable = usernameAvailable === true;

  return (
    <View style={styles.inputWrapper}>
      <StyledInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        autoCapitalize={autoCapitalize}
        // Optional: Add visual feedback to the input border itself
        style={[
          isUsernameInvalid && styles.inputInvalid,
          isUsernameAvailable && styles.inputAvailable,
        ]}
        {...rest}
      />
      {usernameLoading && (
        <View style={styles.statusIndicator}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      )}
      {isUsernameInvalid && !usernameLoading && (
        <Text style={[styles.statusText, styles.unavailableText]}>Taken!</Text>
      )}
      {isUsernameAvailable && !usernameLoading && (
        <Text style={[styles.statusText, styles.availableText]}>Available!</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  inputWrapper: {
    marginBottom: SIZES.padding, // Spacing for this input group
    position: 'relative', // Allows absolute positioning of feedback
  },
  statusIndicator: {
    position: 'absolute',
    right: SIZES.padding + (SIZES.base), // Adjust based on StyledInput's internal padding if any
    top: '50%',
    transform: [{ translateY: -SIZES.font / 2 }], // Vertically center activity indicator
    justifyContent: 'center',
    height: '100%',
  },
  statusText: {
    position: 'absolute',
    right: SIZES.padding + (SIZES.base), // Adjust based on StyledInput's internal padding if any
    top: '50%',
    transform: [{ translateY: -SIZES.font / 2 }], // Vertically center text
    ...FONTS.caption, // Use a smaller font
  },
  availableText: {
    color: COLORS.success, // Ensure COLORS.success is defined in your theme.js
    fontWeight: 'bold',
  },
  unavailableText: {
    color: COLORS.danger, // Ensure COLORS.danger is defined in your theme.js
    fontWeight: 'bold',
  },
  // Optional: Styles to apply to the StyledInput component itself
  inputInvalid: {
    borderColor: COLORS.danger,
    borderWidth: 1,
  },
  inputAvailable: {
    borderColor: COLORS.success,
    borderWidth: 1,
  },
});

export default UsernameInputWithFeedback;