// src/components/common/CustomButton.js
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { SIZES, COLORS, FONTS } from '../../styles/theme';

const CustomButton = React.memo(({ title, onPress, color = COLORS.primary, outline = false, style = {} }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[
      styles.customButton,
      { backgroundColor: outline ? COLORS.surface : color, borderColor: color },
      style,
    ]}
  >
    <Text style={[styles.customButtonText, { color: outline ? color : COLORS.surface }]}>
      {title}
    </Text>
  </TouchableOpacity>
));

const styles = StyleSheet.create({
  customButton: {
    height: 48, 
    borderRadius: SIZES.radius, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1 
  },
  customButtonText: { 
    ...FONTS.h4, 
    fontWeight: 'bold' 
  },
});

export default CustomButton;