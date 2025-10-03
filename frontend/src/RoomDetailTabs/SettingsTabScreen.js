import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, Clipboard } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/Ionicons';
import Card from '../components/common/Card';
import { COLORS, SIZES, FONTS } from '../styles/theme';

const SettingsTabScreen = ({
  roomDetails,
  isAdmin,
  joinRequests,
  sheets,
  handleApproveRequest,
  handleDenyRequest,
  handleStartJourney,
  handleLeaveRoom,
  confirmDeleteRoom,
}) => {
  // Local state for admin controls
  const [selectedSheet, setSelectedSheet] = useState(sheets.length > 0 ? sheets[0].id : null);
  const [duration, setDuration] = useState('90');

  const handleCopyCode = () => {
    Clipboard.setString(roomDetails.invite_code);
    Alert.alert('Copied!', 'Invite code copied to clipboard.');
  };

  const renderJoinRequest = ({ item }) => (
    <Card style={styles.requestCard}>
      <Text style={styles.requestName}>{item.username} wants to join.</Text>
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.denyButton} onPress={() => handleDenyRequest(item.id)}>
          <Icon name="close" size={18} color={COLORS.surface} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.approveButton} onPress={() => handleApproveRequest(item.id)}>
          <Icon name="checkmark" size={18} color={COLORS.surface} />
        </TouchableOpacity>
      </View>
    </Card>
  );

  return (
    <FlatList
      data={[{ key: 'settings' }]}
      keyExtractor={(item) => item.key}
      renderItem={() => null}
      ListHeaderComponent={
        <View style={styles.container}>
          {/* Room Info Card */}
          <Card style={styles.infoCard}>
            <Text style={styles.cardTitle}>Room Information</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status:</Text>
              <Text style={[styles.infoValue, { color: roomDetails.status === 'active' ? COLORS.success : COLORS.warning }]}>
                {roomDetails.status.toUpperCase()}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Invite Code:</Text>
              <TouchableOpacity onPress={handleCopyCode} style={styles.inviteCodeContainer}>
                <Text style={styles.inviteCode}>{roomDetails.invite_code}</Text>
                <Icon name="copy-outline" size={16} color={COLORS.primary} style={{marginLeft: 5}} />
              </TouchableOpacity>
            </View>
          </Card>

          {/* Join Requests Section (Admin Only) */}
          {isAdmin && joinRequests.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Pending Join Requests ({joinRequests.length})</Text>
              <FlatList
                data={joinRequests}
                renderItem={renderJoinRequest}
                keyExtractor={(item) => item.id.toString()}
                scrollEnabled={false}
              />
            </>
          )}

          {/* Admin Setup Panel (Admin Only, if pending) */}
          {isAdmin && roomDetails.status === 'pending' && (
            <Card style={styles.adminPanel}>
              <Text style={styles.cardTitle}>Admin Control: Start Journey</Text>

              <Text style={styles.label}>Select a Sheet:</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedSheet}
                  onValueChange={(itemValue) => setSelectedSheet(itemValue)}
                  style={styles.picker}
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
                onChangeText={setDuration}
                keyboardType="numeric"
                placeholderTextColor={COLORS.textSecondary}
              />

              <TouchableOpacity
                style={styles.startButton}
                onPress={() => handleStartJourney(selectedSheet, duration)}
                disabled={!selectedSheet || !duration}
              >
                <Text style={styles.startButtonText}>Start Coding Journey</Text>
              </TouchableOpacity>
            </Card>
          )}

          {/* Room Actions */}
          <Text style={styles.sectionTitle}>Room Actions</Text>
          <Card style={styles.actionCard}>
            {!isAdmin ? (
              <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveRoom}>
                <Icon name="log-out-outline" size={20} color={COLORS.surface} style={styles.actionIcon} />
                <Text style={styles.leaveButtonText}>Leave Room</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.deleteButton} onPress={confirmDeleteRoom}>
                <Icon name="trash-outline" size={20} color={COLORS.surface} style={styles.actionIcon} />
                <Text style={styles.deleteButtonText}>Delete Room (Admin)</Text>
              </TouchableOpacity>
            )}
          </Card>
        </View>
      }
      ListFooterComponent={<View style={{ height: SIZES.padding * 2 }} />}
    />
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: SIZES.padding },
  cardTitle: { ...FONTS.h3, color: COLORS.textPrimary, marginBottom: SIZES.padding, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingBottom: SIZES.base },
  sectionTitle: { ...FONTS.h3, color: COLORS.textPrimary, marginTop: SIZES.padding, marginBottom: SIZES.base, paddingLeft: SIZES.base },

  // Info Card
  infoCard: { marginBottom: SIZES.padding },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SIZES.base },
  infoLabel: { ...FONTS.body3, color: COLORS.textSecondary },
  infoValue: { ...FONTS.body3, fontWeight: 'bold' },
  inviteCodeContainer: { flexDirection: 'row', alignItems: 'center' },
  inviteCode: { ...FONTS.body3, color: COLORS.primary, fontWeight: 'bold' },

  // Join Requests
  requestCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SIZES.padding, marginBottom: SIZES.base },
  requestName: { ...FONTS.body4, color: COLORS.textPrimary, flex: 1 },
  buttonContainer: { flexDirection: 'row', gap: 10 },
  denyButton: { backgroundColor: COLORS.danger, padding: SIZES.base, borderRadius: SIZES.radius, width: 35, height: 35, justifyContent: 'center', alignItems: 'center' },
  approveButton: { backgroundColor: COLORS.success, padding: SIZES.base, borderRadius: SIZES.radius, width: 35, height: 35, justifyContent: 'center', alignItems: 'center' },

  // Admin Panel
  adminPanel: { marginBottom: SIZES.padding },
  label: { ...FONTS.body4, color: COLORS.textSecondary, marginTop: SIZES.base },
  pickerContainer: { borderWidth: 1, borderColor: COLORS.border, borderRadius: SIZES.radius, marginTop: SIZES.base, overflow: 'hidden', backgroundColor: COLORS.surface },
  picker: { color: COLORS.textPrimary },
  input: {
    height: 45,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    marginTop: SIZES.base,
    ...FONTS.body4,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.surface,
  },
  startButton: {
    backgroundColor: COLORS.primary,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    marginTop: SIZES.padding,
  },
  startButtonText: { ...FONTS.h4, color: COLORS.surface, fontWeight: 'bold' },

  // Action Card
  actionCard: { padding: 0, overflow: 'hidden' },
  actionIcon: { marginRight: SIZES.base },

  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.warning,
    padding: SIZES.padding,
  },
  leaveButtonText: { ...FONTS.h4, color: COLORS.surface, fontWeight: 'bold' },

  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.danger,
    padding: SIZES.padding,
  },
  deleteButtonText: { ...FONTS.h4, color: COLORS.surface, fontWeight: 'bold' },
});

export default SettingsTabScreen;