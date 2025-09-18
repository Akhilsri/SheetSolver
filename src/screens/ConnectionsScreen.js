import React from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import apiClient from '../api/apiClient';
import { COLORS, SIZES, FONTS } from '../styles/theme';
import { useAuth } from '../context/AuthContext';
import Icon from 'react-native-vector-icons/Ionicons';

const ConnectionsScreen = () => {
  const navigation = useNavigation();
  const [connections, setConnections] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const { fetchUnreadMessageCount } = useAuth();

  const fetchConnections = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/connections');
      setConnections(response.data);
      fetchUnreadMessageCount();
    } catch (error) {
      console.error('Failed to fetch connections:', error);
    } finally {
      setIsLoading(false);
    }
  };

  React.useLayoutEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchConnections();
    });
    return unsubscribe;
  }, [navigation]);


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
      <Image
        // This logic now correctly handles the 'null' URL from your log
        source={item.friend_avatar_url ? { uri: item.friend_avatar_url } : require('../assets/images/default_avatar.png')}
        style={styles.avatar}
      />
      <View style={styles.textContainer}>
        <Text style={styles.username}>{item.friend_username}</Text>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.unread_messages > 0 && <Text style={styles.unreadLabel}>New Message: </Text>}
          {item.last_message || 'No messages yet.'}
        </Text>
      </View>
      
      {item.unread_messages > 0 && (
        <View style={styles.unreadContainer}>
          <View style={styles.unreadDot}>
            <Text style={styles.unreadCount}>{item.unread_messages}</Text>
          </View>
        </View>
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
    container: { flex: 1, backgroundColor: COLORS.surface },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    title: { ...FONTS.h1, paddingHorizontal: SIZES.padding, paddingTop: SIZES.padding, paddingBottom: SIZES.base, backgroundColor: COLORS.surface },
    emptyText: { ...FONTS.caption, textAlign: 'center', marginTop: SIZES.padding * 2 },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SIZES.base * 1.5,
        paddingHorizontal: SIZES.padding,
        backgroundColor: COLORS.surface,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
    textContainer: {
        flex: 1,
        marginLeft: SIZES.padding,
        justifyContent: 'center',
    },
    username: {
        ...FONTS.h3,
    },
    lastMessage: {
        ...FONTS.body,
        color: COLORS.textSecondary,
    },
    unreadLabel: {
        color: COLORS.primary,
        fontWeight: 'bold',
    },
    unreadContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    unreadDot: {
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: COLORS.success,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 5,
    },
    unreadCount: {
        ...FONTS.caption,
        color: COLORS.surface,
        fontWeight: 'bold',
        fontSize: 12,
    },
});

export default ConnectionsScreen;