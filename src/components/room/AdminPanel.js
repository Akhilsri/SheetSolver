import React from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { COLORS, SIZES, FONTS } from '../../styles/theme';
import Card from '../common/Card';

const AdminPanel = ({ sheets, selectedSheet, onSheetChange, duration, onDurationChange, onStartJourney }) => {
  return (
    <Card style={styles.adminCard}>
      <Text style={styles.panelTitle}>Admin Controls: Setup Journey</Text>
      
      <Text style={styles.label}>Select a Sheet:</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={selectedSheet}
          onValueChange={onSheetChange}
          mode="dropdown"
        >
          <Picker.Item label="-- Choose a sheet --" value={null} />
          {sheets.map((sheet) => (
            <Picker.Item label={sheet.name} value={sheet.id} key={sheet.id} />
          ))}
        </Picker>
      </View>

      <Text style={styles.label}>Set a Duration (in days):</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., 90"
        value={duration}
        onChangeText={onDurationChange}
        keyboardType="numeric"
      />
      <Button title="Start Journey for All Members" onPress={onStartJourney} color={COLORS.primary} />
    </Card>
  );
};

const styles = StyleSheet.create({
  adminCard: {
    margin: SIZES.padding,
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
    borderWidth: 1,
  },
  panelTitle: {
    ...FONTS.h3,
    marginBottom: SIZES.padding,
    textAlign: 'center',
  },
  label: {
    ...FONTS.body,
    color: COLORS.textSecondary,
    marginBottom: SIZES.base,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    marginBottom: SIZES.padding,
    backgroundColor: COLORS.surface,
  },
  input: {
    height: 50,
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SIZES.base * 2,
    marginBottom: SIZES.padding,
    fontSize: SIZES.body,
  },
});

export default AdminPanel;