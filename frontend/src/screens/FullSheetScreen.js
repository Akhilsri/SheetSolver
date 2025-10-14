import React, { useState, useCallback, useMemo, useRef } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    SectionList, 
    ActivityIndicator, 
    TouchableOpacity, 
    Linking,
    RefreshControl // Import RefreshControl for pull-to-refresh
} from 'react-native';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import apiClient from '../api/apiClient';

const FullSheetScreen = () => {
    const route = useRoute();
    const { roomId } = route.params;

    // ⚡ OPTIMIZATION: Separate loading states for SWR
    const [sections, setSections] = useState([]);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    // Ref to hold the static data cache status
    const hasDataLoadedOnce = useRef(false);

    // Helper to format the flat problem list into SectionList format
    const formatDataForSections = useCallback((problems) => {
        // Group the flat list of problems by topic
        const groupedByTopic = problems.reduce((acc, problem) => {
            const topic = problem.topic || 'Miscellaneous';
            if (!acc[topic]) {
                acc[topic] = [];
            }
            acc[topic].push(problem);
            return acc;
        }, {});

        // Format for SectionList
        return Object.keys(groupedByTopic).map(topic => ({
            title: topic,
            data: groupedByTopic[topic],
        }));
    }, []);
    
    // ⚡ OPTIMIZATION: Modified fetchSheet for SWR
    const fetchSheet = useCallback(async (isBackground = false) => {
        if (!isBackground) {
            // Only show full loading spinner on first load
            if (!hasDataLoadedOnce.current) {
                setIsInitialLoading(true);
            } else {
                // Show subtle spinner for background refresh
                setIsRefreshing(true);
            }
        }
        
        try {
            const response = await apiClient.get(`/rooms/${roomId}/full-sheet`);
            
            const newSections = formatDataForSections(response.data);
            setSections(newSections);
            
            // Mark the cache as valid
            hasDataLoadedOnce.current = true;
        } catch (error) {
            console.error('Failed to fetch full sheet:', error);
            // Only show an alert if it was a foreground fetch
            if (!isBackground) {
                Alert.alert('Error', 'Could not load the full sheet data.');
            }
        } finally {
            setIsInitialLoading(false);
            setIsRefreshing(false);
        }
    }, [roomId, formatDataForSections]);

    // ⚡ OPTIMIZATION: SWR Logic in useFocusEffect
    useFocusEffect(useCallback(() => {
        if (!hasDataLoadedOnce.current) {
            // First visit: Full expensive fetch
            fetchSheet(false);
        } else {
            // Subsequent visit: Display stale data instantly, fetch in background
            fetchSheet(true);
        }
    }, [fetchSheet]));

    if (isInitialLoading) {
        return <ActivityIndicator size="large" color="#4A90E2" style={styles.centered} />;
    }

    const renderItem = ({ item }) => (
        <TouchableOpacity 
            style={styles.itemRow} 
            onPress={() => item.url && Linking.openURL(item.url)} // Added URL opening
            activeOpacity={0.7}
        >
            <View style={styles.itemContent}>
                <Text style={styles.itemName}>{item.title}</Text>
                <Text style={styles.itemSubtext}>Order: {item.problem_order} | Difficulty: {item.difficulty}</Text>
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
            ListEmptyComponent={<Text style={styles.emptyText}>No problems found for this sheet. The room admin may need to select a sheet.</Text>}
            // ⚡ Pull-to-Refresh implementation
            refreshControl={
                <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={() => fetchSheet(false)} // Force foreground fetch on pull-down
                    tintColor="#4A90E2"
                />
            }
        />
    );
};

const styles = StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    emptyText: { textAlign: 'center', marginTop: 50, color: 'gray' },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10, backgroundColor: '#E0E6F0', color: '#333333' },
    itemRow: { 
        backgroundColor: 'white', 
        paddingVertical: 15, 
        paddingHorizontal: 20, 
        borderBottomWidth: 1, 
        borderBottomColor: '#eee', 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center' 
    },
    itemContent: { flex: 1, marginRight: 10 },
    itemName: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
    itemSubtext: { fontSize: 13, color: '#6B7280', marginTop: 4 },
    checkMark: { fontSize: 20 },
});

export default FullSheetScreen;