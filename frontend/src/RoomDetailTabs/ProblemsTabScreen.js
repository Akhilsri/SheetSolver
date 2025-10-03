import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Linking, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

// NOTE: Assuming these components are created and the paths are correct
import DailyProgressTracker from '../components/room/DailyProgressTracker';
import Card from '../components/common/Card'; 

// Import Theme for Styling
import { COLORS, SIZES, FONTS } from '../styles/theme'; 

// --- Helper for opening external links ---
const handleOpenLink = (url) => {
    if (url && url.startsWith('http')) {
        Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open the problem link.'));
    } else {
        Alert.alert('Error', 'Invalid problem URL.');
    }
};

// --- DailyProblemCard Component ---
const DailyProblemCard = ({ 
    item, 
    isSolvedByMe, 
    mySubmission, 
    otherSubmissions, 
    isUploading, 
    uploadingProblemId, 
    handleMarkAsDone, 
    openSnap, 
    showSubmissionPicker, 
    userId 
}) => {
    
    // Helper to summarize other users' submissions
    const getOtherSubmissionsText = () => {
        const uniqueUsernames = new Set(otherSubmissions.map(s => s.username));
        // Calculate total points awarded to others for this problem
        const totalOtherPoints = otherSubmissions.reduce((sum, sub) => sum + (sub.points_awarded || 0), 0);
        
        let userSummary = '';
        if (uniqueUsernames.size === 1) {
            userSummary = `${[...uniqueUsernames][0]}`;
        } else {
            userSummary = `${uniqueUsernames.size} others`;
        }

        return `Also completed by ${userSummary} (+${totalOtherPoints} pts)`;
    };

    return (
        <Card style={styles.problemCard}>
            <View style={styles.itemContent}>
                {/* Problem Title/Link */}
                <TouchableOpacity onPress={() => handleOpenLink(item.url)}>
                    <Text style={styles.itemName}>{item.title}</Text>
                </TouchableOpacity>
                <Text style={styles.itemSubtext}>Topic: {item.topic} | Difficulty: {item.difficulty}</Text>

                {/* Other Submissions Summary */}
                {otherSubmissions.length > 0 && (
                    <TouchableOpacity 
                        onPress={() => showSubmissionPicker(otherSubmissions)} 
                        style={styles.othersCompletedTouch}
                    >
                        <Text style={styles.othersCompletedText}>
                            <Icon name="people-outline" size={SIZES.font} color={COLORS.textSecondary} /> {getOtherSubmissionsText()}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Action Button Area */}
            <View style={styles.actionContainer}>
                {uploadingProblemId === item.id ? (
                    <ActivityIndicator color={COLORS.primary} size="small" />
                ) : (
                    isSolvedByMe ? (
                        <TouchableOpacity style={styles.completedButton} onPress={() => openSnap(mySubmission?.photo_url)}>
                            <Icon name="checkmark-circle-sharp" size={18} color={COLORS.surface} />
                            <Text style={styles.completedButtonText}>View Snap</Text>
                            {/* NEW: Display points clearly */}
                            <Text style={styles.completedPointsText}>+{mySubmission?.points_awarded || 0} pts</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={[styles.doneButton, isUploading && styles.disabledButton]}
                            onPress={() => handleMarkAsDone(item)}
                            disabled={isUploading}
                        >
                            <Text style={styles.doneButtonText}>Snap Proof</Text>
                        </TouchableOpacity>
                    )
                )}
            </View>
        </Card>
    );
};


// --- ProblemsTabScreen Component ---
const ProblemsTabScreen = ({
    dailyProblems,
    dailyProgressData,
    solvedProblemIds,
    todaysSubmissions,
    userId,
    isUploading,
    uploadingProblemId,
    handleMarkAsDone,
    openSnap,
    showSubmissionPicker,
    navigation,
    roomId,
    roomName,
    status
}) => {
    
    const renderProblemItem = ({ item }) => {
        const isSolvedByMe = solvedProblemIds.includes(item.id);
        const mySubmission = (todaysSubmissions[item.id] || []).find(s => Number(s.user_id) === Number(userId));
        const otherSubmissions = (todaysSubmissions[item.id] || []).filter(s => Number(s.user_id) !== Number(userId));

        return (
            <DailyProblemCard 
                item={item}
                isSolvedByMe={isSolvedByMe}
                mySubmission={mySubmission}
                otherSubmissions={otherSubmissions}
                isUploading={isUploading}
                uploadingProblemId={uploadingProblemId}
                handleMarkAsDone={handleMarkAsDone}
                openSnap={openSnap}
                showSubmissionPicker={showSubmissionPicker}
                userId={userId}
            />
        );
    };

    const ListHeader = (
        <View style={styles.headerContainer}>
            
            {/* 1. Primary Action/Navigation Button (Dashboard) */}
            <TouchableOpacity
                style={styles.journeyButton}
                onPress={() => navigation.navigate('JourneyDashboard', { roomId: roomId, roomName: roomName })}
            >
                <Text style={styles.journeyButtonText}>📈 View Full Journey Dashboard</Text>
            </TouchableOpacity>

            {/* 2. Daily Progress Tracker Card */}
            {status === 'active' && dailyProgressData.length > 0 && (
                <Card style={styles.progressCard}>
                    <Text style={styles.progressTitle}>Your Daily Status</Text>
                    <DailyProgressTracker dailyProgressData={dailyProgressData} />
                </Card>
            )}
            
            {/* 3. Secondary Action (Full Sheet) */}
            {status === 'active' && (
                <TouchableOpacity
                    style={styles.fullSheetButton}
                    onPress={() => navigation.navigate('FullSheet', { roomId: roomId, roomName: roomName })}
                >
                    <Icon name="grid-outline" size={SIZES.font} color={COLORS.accent} style={{marginRight: SIZES.base}} />
                    <Text style={styles.fullSheetButtonText}>View Full Problem Sheet</Text>
                </TouchableOpacity>
            )}

            {/* 4. Problems Section Title / Empty State */}
            {status === 'active' ? (
                // Only show "Today's Problems" title if there are problems OR we expect them
                dailyProblems.length > 0 && ( 
                    <Text style={styles.sectionTitle}>Today's Problems</Text>
                )
            ) : (
                // Pending State
                <View style={styles.pendingContainer}>
                    <Icon name="rocket-outline" size={50} color={COLORS.textSecondary} />
                    <Text style={styles.pendingText}>The journey hasn't started yet! Check the Settings tab to begin.</Text>
                </View>
            )}
        </View>
    );

    return (
        <FlatList
            data={status === 'active' ? dailyProblems : []}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderProblemItem}
            ListHeaderComponent={ListHeader}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
                status === 'active' && dailyProblems.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Icon name="checkmark-done-circle-outline" size={50} color={COLORS.textSecondary} />
                        <Text style={styles.emptyText}>No problems are set for today, or all have been solved!</Text>
                    </View>
                ) : null
            }
        />
    );
};


// --- Styles ---
const styles = StyleSheet.create({
    listContent: { paddingBottom: SIZES.padding * 2, backgroundColor: COLORS.background },
    
    // --- Header Area ---
    headerContainer: { 
        paddingHorizontal: SIZES.padding,
        paddingTop: SIZES.padding * 2,
    },
    
    // --- Dashboard Elements ---
    journeyButton: {
        backgroundColor: COLORS.primary,
        padding: SIZES.padding,
        marginBottom: SIZES.padding,
        borderRadius: SIZES.radius,
        alignItems: 'center',
        elevation: 4,
    },
    journeyButtonText: { ...FONTS.h4, color: COLORS.surface, fontWeight: 'bold' },

    progressCard: {
        marginBottom: SIZES.padding,
        padding: SIZES.padding,
        backgroundColor: COLORS.surface,
    },
    progressTitle: {
        ...FONTS.h4,
        color: COLORS.textPrimary,
        marginBottom: SIZES.base,
        fontWeight: 'bold',
    },

    fullSheetButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: SIZES.base * 1.5,
        marginBottom: SIZES.padding,
        borderRadius: SIZES.radius,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    fullSheetButtonText: { ...FONTS.body3, color: COLORS.accent, fontWeight: 'bold' },
    
    // --- Problems Section Title and Empty States ---
    sectionTitle: { 
        ...FONTS.h3, 
        paddingHorizontal: SIZES.base,
        paddingBottom: SIZES.base,
        color: COLORS.textPrimary,
        fontWeight: 'bold',
    },
    pendingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: SIZES.padding * 2,
    },
    pendingText: { 
        ...FONTS.body3, 
        color: COLORS.textSecondary, 
        marginTop: SIZES.padding, 
        textAlign: 'center' 
    },
    
    // --- Problem Card Details ---
    problemCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SIZES.padding,
        marginHorizontal: SIZES.padding, 
        marginBottom: SIZES.base,
    },
    itemContent: { flex: 1, marginRight: SIZES.padding },
    itemName: { ...FONTS.h4, color: COLORS.primary, textDecorationLine: 'underline' }, // Primary color for link
    itemSubtext: { ...FONTS.body5, color: COLORS.textSecondary, marginTop: 4 },
    actionContainer: { width: 120, alignItems: 'flex-end', justifyContent: 'center' }, // Increased width for better text fit
    
    doneButton: {
        backgroundColor: COLORS.warning,
        paddingVertical: SIZES.base,
        paddingHorizontal: SIZES.base,
        borderRadius: SIZES.radius * 0.5,
        alignItems: 'center',
        justifyContent: 'center',
        height: 40,
        width: '100%'
    },
    doneButtonText: { ...FONTS.body4, color: COLORS.surface, fontWeight: 'bold' },

    completedButton: {
        backgroundColor: COLORS.success,
        paddingVertical: SIZES.base,
        paddingHorizontal: SIZES.base,
        borderRadius: SIZES.radius * 0.5,
        alignItems: 'center',
        justifyContent: 'center',
        height: 50,
        width: '100%',
    },
    completedButtonText: { ...FONTS.body4, color: COLORS.surface, fontWeight: 'bold', marginTop: 2 },
    completedPointsText: { ...FONTS.caption, color: COLORS.surface, fontWeight: 'bold' },
    disabledButton: { opacity: 0.6 },
    
    othersCompletedTouch: { marginTop: 8 },
    othersCompletedText: { ...FONTS.caption, color: COLORS.textSecondary, fontStyle: 'italic' },
    emptyContainer: { alignItems: 'center', padding: SIZES.padding * 2, marginTop: SIZES.padding * 2 },
    emptyText: { ...FONTS.body3, color: COLORS.textSecondary, marginTop: SIZES.padding, textAlign: 'center' },
});

export default ProblemsTabScreen;