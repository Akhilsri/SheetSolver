import React from 'react';
import { TextInput, StyleSheet, View } from 'react-native'; 
import { COLORS, SIZES, FONTS } from '../../styles/theme';

const StyledInput = ({ rightComponent, ...props }) => {
  return (
    <View style={styles.container}> 
      <TextInput
        style={[styles.input, rightComponent && styles.inputWithRightComponent]}
        placeholderTextColor={COLORS.textSecondary}
        {...props} 
      />
      {/* ABSOLUTE POSITIONING FIX */}
      {rightComponent && (
        <View style={styles.rightComponentWrapper}>
          {rightComponent}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 55,
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SIZES.padding,
    // CRUCIAL: Must be relative for absolute children positioning
    position: 'relative', 
  },
  input: {
    flex: 1, 
    height: '100%',
    paddingHorizontal: SIZES.padding,
    ...FONTS.body,
  },
  // Ensure the text input reserves space for the icon
  inputWithRightComponent: {
    paddingRight: 55, // Increased padding to prevent text from overlapping the icon (55px is approx icon + padding)
  },
  // FIX: Use absolute positioning to ensure the icon is always on top-right
  rightComponentWrapper: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default StyledInput;