import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { COLORS, SIZES, FONTS } from '../../styles/theme';

const MemberItem = ({ item, isAdmin, isSelf, onRemove, roomAdminId }) => {
  // Check if the member being rendered is the admin of the room
  const isRoomAdmin = Number(item.id) === Number(roomAdminId);

  return (
    <View style={styles.itemRow}>
      <View style={styles.nameContainer}>
        <Text style={styles.itemName}>{item.username}</Text>
        
        {/* --- THIS IS THE NEW LOGIC --- */}
        {/* If the member is the admin, show the "Admin" tag */}
        {isRoomAdmin && (
            <View style={styles.adminTag}>
                <Text style={styles.adminTagText}>Admin</Text>
            </View>
        )}
      </View>
      
      {/* The "Remove" button logic is the same as before */}
      {isAdmin && !isSelf && (
        <Button title="Remove" color={COLORS.danger} onPress={() => onRemove(item)} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
    itemRow: { 
        backgroundColor: COLORS.surface, 
        paddingVertical: SIZES.padding, 
        paddingHorizontal: SIZES.padding, 
        borderBottomWidth: 1, 
        borderBottomColor: COLORS.border, 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center' 
    },
    nameContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    itemName: { 
        ...FONTS.body,
        fontWeight: '500',
    },
    adminTag: {
        marginLeft: SIZES.base,
        paddingHorizontal: SIZES.base,
        paddingVertical: 2,
        backgroundColor: COLORS.success,
        borderRadius: SIZES.base / 2,
    },
    adminTagText: {
        ...FONTS.caption,
        fontSize: 10,
        color: COLORS.surface,
        fontWeight: 'bold',
    },
});

export default MemberItem;