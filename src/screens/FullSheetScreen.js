import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, SectionList, ActivityIndicator, TouchableOpacity, Linking } from 'react-native';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import apiClient from '../api/apiClient';

const FullSheetScreen = () => {
  const route = useRoute();
  const { roomId } = route.params;

  const [sections, setSections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSheet = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get(`/rooms/${roomId}/full-sheet`);
      
      // Group the flat list of problems by topic
      const groupedByTopic = response.data.reduce((acc, problem) => {
        const topic = problem.topic || 'Miscellaneous';
        if (!acc[topic]) {
          acc[topic] = [];
        }
        acc[topic].push(problem);
        return acc;
      }, {});

      // Format for SectionList
      const sectionsArray = Object.keys(groupedByTopic).map(topic => ({
        title: topic,
        data: groupedByTopic[topic],
      }));

      setSections(sectionsArray);
    } catch (error) {
      console.error('Failed to fetch full sheet:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(useCallback(() => {
    fetchSheet();
  }, [roomId]));

  if (isLoading) {
    return <ActivityIndicator size="large" style={styles.centered} />;
  }

  //onPress={() => Linking.openURL(item.url)}
  
  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.itemRow} >
      <View style={styles.itemContent}>
        <Text style={styles.itemName}>{item.title}</Text>
        <Text style={styles.itemSubtext}>Difficulty: {item.difficulty}</Text>
      </View>
      {/* If submissionId is not null, the user has solved it */}
      {item.submissionId && (
        <Text style={styles.checkMark}>✅</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <SectionList
      style={styles.container}
      sections={sections}
      keyExtractor={(item) => item.id.toString()}
      renderItem={renderItem}
      renderSectionHeader={({ section: { title } }) => <Text style={styles.sectionTitle}>{title}</Text>}
      ListEmptyComponent={<Text style={styles.emptyText}>No problems found for this sheet.</Text>}
    />
  );
};

const styles = StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    container: { flex: 1, backgroundColor: '#fff' },
    emptyText: { textAlign: 'center', marginTop: 50, color: 'gray' },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10, backgroundColor: '#f5f5f5' },
    itemRow: { backgroundColor: 'white', paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#eee', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    itemContent: { flex: 1, marginRight: 10 },
    itemName: { fontSize: 16 },
    itemSubtext: { fontSize: 12, color: 'gray', marginTop: 4 },
    checkMark: { fontSize: 20 },
});

export default FullSheetScreen;