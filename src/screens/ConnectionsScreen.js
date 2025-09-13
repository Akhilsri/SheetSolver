import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import apiClient from '../api/apiClient';
import { COLORS, SIZES, FONTS } from '../styles/theme';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';

const ConnectionsScreen = () => {
  const navigation = useNavigation();
  const [connections, setConnections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { fetchUnreadMessageCount } = useAuth(); // Get the function to refresh the global badge

  const fetchConnections = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/connections');
      setConnections(response.data);
      // Also refresh the global badge count when this screen is focused
      fetchUnreadMessageCount();
    } catch (error) {
      console.error('Failed to fetch connections:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchConnections(); }, []));

  if (isLoading) {
    return <ActivityIndicator size="large" style={styles.centered} />;
  }
  
  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.itemContainer}
      onPress={() => navigation.navigate('DirectMessage', {
        connectionUserId: item.friend_id,
        connectionUsername: item.friend_username,
      })}
    >
      <View style={styles.leftContainer}>
        <Icon name="person-circle-outline" size={50} color={COLORS.textSecondary} />
        <Text style={styles.username}>{item.friend_username}</Text>
      </View>
      
      {item.unread_messages > 0 && (
        <View style={styles.unreadDot} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={connections}
        keyExtractor={(item) => item.friend_id.toString()}
        renderItem={renderItem}
        ListHeaderComponent={<Text style={styles.title}>Messages</Text>}
        ListEmptyComponent={<Text style={styles.emptyText}>You haven't made any connections yet. Use the Search tab to find people!</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    title: { ...FONTS.h1, paddingHorizontal: SIZES.padding, paddingTop: SIZES.padding, paddingBottom: SIZES.base },
    emptyText: { ...FONTS.caption, textAlign: 'center', marginTop: SIZES.padding * 2 },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: SIZES.base * 1.5,
        paddingHorizontal: SIZES.padding,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    leftContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    username: {
        ...FONTS.h3,
        marginLeft: SIZES.padding,
    },
    unreadDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: COLORS.primary,
    },
});

export default ConnectionsScreen;