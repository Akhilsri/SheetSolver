// src/components/common/IconButton.js
import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { SIZES, COLORS } from '../../styles/theme';

const IconButton = React.memo(({ name, color = COLORS.primary, size = 24, onPress, style }) => (
  <TouchableOpacity onPress={onPress} style={[styles.button, style]} activeOpacity={0.7}>
    <Icon name={name} size={size} color={color} />
  </TouchableOpacity>
));

const styles = StyleSheet.create({
  button: {
    padding: SIZES.base,
  },
});

export default IconButton;