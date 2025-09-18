import React from 'react';
import { TextInput, StyleSheet } from 'react-native';
import { COLORS, SIZES, FONTS } from '../../styles/theme';

const StyledInput = (props) => {
  return (
    <TextInput
      style={styles.input}
      placeholderTextColor={COLORS.textSecondary}
      {...props} // Pass all other props like value, onChangeText, placeholder, etc.
    />
  );
};

const styles = StyleSheet.create({
  input: {
    height: 55,
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SIZES.padding,
    ...FONTS.body,
    marginBottom: SIZES.padding,
  },
});

export default StyledInput;