import React from 'react';
import { View, Text, Button, TouchableOpacity, Linking, StyleSheet, ActivityIndicator } from 'react-native';

const ProblemItem = ({ item, isSolvedByMe, mySubmission, otherSubmissions, onMarkAsDone, onShowSnap, isUploading, uploadingProblemId }) => {
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemContent}>
        <TouchableOpacity onPress={() => Linking.openURL(item.url)}>
          <Text style={styles.itemName}>{item.title}</Text>
          <Text style={styles.itemSubtext}>Topic: {item.topic} | Difficulty: {item.difficulty}</Text>
        </TouchableOpacity>
        {otherSubmissions.length > 0 && (
          <TouchableOpacity onPress={() => onShowSnap(otherSubmissions)}>
            <Text style={styles.othersCompletedText}>✅ Also completed by: {otherSubmissions.map(s => `${s.username} (+${s.points_awarded} pts)`).join(', ')}</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.actionContainer}>
        {uploadingProblemId === item.id ? (
          <ActivityIndicator color="#007BFF" />
        ) : (
          isSolvedByMe ? (
            <TouchableOpacity style={styles.completedContainer} onPress={() => onShowSnap([mySubmission])}>
              <Text style={styles.completedText}>✅</Text>
              <Text style={styles.completedBy}>You did it! (+{mySubmission?.points_awarded} pts)</Text>
            </TouchableOpacity>
          ) : (
            <Button title="Done" onPress={() => onMarkAsDone(item)} disabled={isUploading} />
          )
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
    itemRow: { backgroundColor: 'white', paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#eee', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    itemContent: { flex: 1, marginRight: 10 },
    itemName: { fontSize: 16 },
    itemSubtext: { fontSize: 12, color: 'gray', marginTop: 4 },
    othersCompletedText: { fontSize: 12, color: 'gray', fontStyle: 'italic', marginTop: 8 },
    actionContainer: { width: 80, alignItems: 'center', justifyContent: 'center' },
    completedContainer: { alignItems: 'center', width: 80 },
    completedText: { fontSize: 24 },
    completedBy: { fontSize: 10, color: 'green', fontWeight: 'bold', textAlign: 'center' },
});

export default ProblemItem;