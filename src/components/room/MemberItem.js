import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';

const MemberItem = ({ item, isAdmin, isSelf, onRemove }) => {
  return (
    <View style={styles.itemRow}>
      <Text style={styles.itemName}>{item.username}</Text>
      {isAdmin && !isSelf && (
        <Button title="Remove" color="red" onPress={() => onRemove(item)} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
    itemRow: { backgroundColor: 'white', paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#eee', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    itemName: { fontSize: 16 },
});

export default MemberItem;