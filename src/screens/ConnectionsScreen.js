import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import apiClient from '../api/apiClient';
import { COLORS, SIZES, FONTS } from '../styles/theme';
import Icon from 'react-native-vector-icons/Ionicons';

const ConnectionsScreen = () => {
  const navigation = useNavigation();
  const [connections, setConnections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConnections = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/connections');
      setConnections(response.data);
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
      <Icon name="person-circle-outline" size={40} color={COLORS.primary} />
      <Text style={styles.username}>{item.friend_username}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={connections}
        keyExtractor={(item) => item.friend_id.toString()}
        renderItem={renderItem}
        ListHeaderComponent={<Text style={styles.title}>My Connections</Text>}
        ListEmptyComponent={<Text style={styles.emptyText}>You haven't made any connections yet.</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    title: { ...FONTS.h1, padding: SIZES.padding, paddingBottom: SIZES.base },
    emptyText: { ...FONTS.caption, textAlign: 'center', marginTop: SIZES.padding * 2 },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SIZES.padding,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    username: {
        ...FONTS.h3,
        marginLeft: SIZES.padding,
    }
});

export default ConnectionsScreen;