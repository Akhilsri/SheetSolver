import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../../context/AuthContext'; // Assuming useAuth provides userId
import { COLORS, SIZES, FONTS } from '../../styles/theme';
import Icon from 'react-native-vector-icons/Ionicons';

const DailyProgressTracker = ({ dailyProgressData }) => {
  const { userId: currentUserId } = useAuth(); // Get current user's ID from context

  if (!dailyProgressData || dailyProgressData.length === 0) {
    return null; // Or a simple placeholder like "No daily problems assigned"
  }

  // Sort data to put current user at the top, and then by solved count (desc)
  const sortedProgressData = [...dailyProgressData].sort((a, b) => {
    if (Number(a.userId) === Number(currentUserId)) return -1; // Current user always first
    if (Number(b.userId) === Number(currentUserId)) return 1;
    return b.solvedCount - a.solvedCount; // Then by solved count
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Today's Standings</Text>
      {sortedProgressData.map(member => {
        const isCurrentUser = Number(member.userId) === Number(currentUserId);
        // Ensure totalCount is not zero to prevent division by zero
        const progressPercentage = member.totalCount > 0 ? (member.solvedCount / member.totalCount) * 100 : 0;

        return (
          <View key={member.userId} style={[styles.memberRow, isCurrentUser && styles.currentUserRow]}>
            <Text style={[styles.memberName, isCurrentUser && styles.currentUserText]}>
              {member.username} {isCurrentUser && '(You)'}
            </Text>
            <View style={styles.progressBarWrapper}>
              <View style={[
                styles.progressBarFill,
                { width: `${progressPercentage}%` },
                { backgroundColor: isCurrentUser ? COLORS.primary : COLORS.success } // Your color choices
              ]} />
              <Text style={styles.progressText}>{member.solvedCount}/{member.totalCount}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    marginHorizontal: SIZES.padding, // Added horizontal margin for better spacing
    marginBottom: SIZES.padding,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    ...FONTS.h2,
    marginBottom: SIZES.padding,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SIZES.base,
    paddingHorizontal: SIZES.base, // Added horizontal padding for clarity
    marginBottom: SIZES.base / 2, // Small gap between rows
    borderRadius: SIZES.radius / 2, // Slightly rounded rows
    backgroundColor: COLORS.background, // Light background for each row
  },
  currentUserRow: {
    backgroundColor: COLORS.primaryLight, // Highlight for current user
    borderColor: COLORS.primary,
    borderWidth: 1,
  },
  memberName: {
    ...FONTS.body,
    fontWeight: '500',
    flex: 1, // Takes up remaining space
    color: COLORS.textPrimary,
  },
  currentUserText: {
    fontWeight: 'bold', // Emphasize current user's name
    color: COLORS.primaryDark,
  },
  progressBarWrapper: {
    width: 100, // Fixed width for progress bar area for alignment
    height: 20,
    backgroundColor: COLORS.border,
    borderRadius: SIZES.radius,
    overflow: 'hidden',
    justifyContent: 'center',
    marginLeft: SIZES.base,
    position: 'relative', // For absolute positioning of text
  },
  progressBarFill: {
    height: '100%',
    position: 'absolute',
    left: 0,
    borderRadius: SIZES.radius,
  },
  progressText: {
    position: 'absolute',
    right: SIZES.base,
    ...FONTS.caption,
    fontWeight: 'bold',
    color: COLORS.surface, // Text color on top of progress bar
  },
});

export default DailyProgressTracker;