import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Card from '../components/common/Card';
import { COLORS, SIZES, FONTS } from '../styles/theme';

const MembersTabScreen = ({ members, isAdmin, adminId, removeMember }) => {

    const confirmRemoveMember = (member) => {
        Alert.alert(
          "Remove Member",
          `Are you sure you want to remove ${member.username} from this room?`,
          [
            { text: "Cancel", style: "cancel" },
            { text: "Yes, Remove", onPress: () => removeMember(member.id), style: "destructive" }
          ]
        );
    };

    const renderMemberItem = ({ item }) => {
        const isRoomAdmin = Number(item.id) === Number(adminId);
        // NOTE: Replace global.userId with the actual logged-in user ID prop if available
        const isCurrentUser = Number(item.id) === Number(global.userId); 
        const statusIcon = isRoomAdmin ? "crown" : "person";
        const statusColor = isRoomAdmin ? COLORS.danger : COLORS.primary;

        return (
            <Card style={styles.memberCard}>
                <Icon name={statusIcon} size={20} color={statusColor} style={{ marginRight: SIZES.base }} />
                
                <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, isCurrentUser && styles.currentUserName]}>
                        {item.username}
                        {isCurrentUser ? ' (You)' : ''}
                    </Text>
                    {isRoomAdmin && (
                        <View style={styles.adminTag}>
                            <Text style={styles.adminTagText}>ADMIN</Text>
                        </View>
                    )}
                </View>

                {/* Remove Button (Only for Admin, cannot remove self) */}
                {isAdmin && !isRoomAdmin && (
                    <TouchableOpacity style={styles.removeButton} onPress={() => confirmRemoveMember(item)}>
                        <Icon name="person-remove-outline" size={20} color={COLORS.danger} />
                    </TouchableOpacity>
                )}
            </Card>
        );
    };

    return (
        <FlatList
            data={members}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderMemberItem}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={<Text style={styles.listHeaderTitle}>Room Members ({members.length})</Text>}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Icon name="people-outline" size={50} color={COLORS.textSecondary} />
                <Text style={styles.emptyText}>No members have joined yet.</Text>
              </View>
            }
        />
    );
};

const styles = StyleSheet.create({
    listContent: { padding: SIZES.padding, backgroundColor: COLORS.background },
    listHeaderTitle: { ...FONTS.h3, marginBottom: SIZES.padding, color: COLORS.textPrimary },
    memberCard: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'center',
        padding: SIZES.padding,
        marginBottom: SIZES.base,
    },
    memberInfo: { 
        flex: 1,
        flexDirection: 'row', 
        alignItems: 'center' 
    },
    memberName: { ...FONTS.body3, marginLeft: SIZES.base, color: COLORS.textPrimary },
    currentUserName: { fontWeight: 'bold' },
    adminTag: {
        marginLeft: SIZES.base,
        paddingHorizontal: SIZES.base,
        paddingVertical: 2,
        backgroundColor: COLORS.success,
        borderRadius: SIZES.radius * 0.5,
    },
    adminTagText: { ...FONTS.caption, fontSize: 10, color: COLORS.surface, fontWeight: 'bold' },
    removeButton: {
        padding: SIZES.base,
    },
    emptyContainer: { alignItems: 'center', padding: SIZES.padding * 2, marginTop: SIZES.padding },
    emptyText: { ...FONTS.body3, color: COLORS.textSecondary, marginTop: SIZES.padding },
});

export default MembersTabScreen;