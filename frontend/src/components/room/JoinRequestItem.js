import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';

const JoinRequestItem = ({ request, onApprove, onDeny }) => {
  return (
    <View style={styles.itemRow}>
      <Text style={styles.itemName}>{request.username}</Text>
      <View style={styles.buttonContainer}>
        <Button title="Deny" color="red" onPress={() => onDeny(request.id)} />
        <Button title="Approve" onPress={() => onApprove(request.id)} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  itemRow: { backgroundColor: 'white', paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#eee', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemName: { fontSize: 16 },
  buttonContainer: { flexDirection: 'row', gap: 10 },
});

export default JoinRequestItem;