import React, { useState, useEffect, useCallback } from 'react'; // <-- Imported useCallback
import { View, Text, TextInput, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import apiClient from '../api/apiClient';
import { COLORS, SIZES, FONTS } from '../styles/theme';
import Icon from 'react-native-vector-icons/Ionicons';

const MIN_QUERY_LENGTH = 3; // <-- Constant for clarity

const SearchScreen = ({ navigation }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // 1. OPTIMIZATION: Enforce Minimum Query Length (Saves API calls)
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      // Ensure the loading indicator is immediately hidden
      setIsLoading(false); 
      return;
    }

    setIsLoading(true);
    
    // 2. OPTIMIZATION: Increased Debounce Time (Saves API calls)
    // Increased from 300ms to 750ms to bundle keystrokes into one request.
    const searchTimer = setTimeout(async () => {
      try {
        const response = await apiClient.get(`/users/search?query=${query}`);
        setResults(response.data);
      } catch (error) {
        console.error('Failed to search users:', error);
        // Clear results on error
        setResults([]); 
      } finally {
        setIsLoading(false);
      }
    }, 750); // <-- Changed from 300 to 750

    // Cleanup function to cancel the previous timer
    return () => clearTimeout(searchTimer);
  }, [query]);

  // 3. OPTIMIZATION: Memoize renderItem (Client-side performance/CPU usage)
  const renderItem = useCallback(({ item }) => (
    <TouchableOpacity 
      style={styles.resultItem}
      onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
    >
      <Image
        // 4. OPTIMIZATION: (Reminder) Ensure server provides small, optimized avatars
        source={item.avatar_url ? { uri: item.avatar_url } : require('../assets/images/default_avatar.png')}
        style={styles.avatar}
      />
      <View style={styles.textContainer}>
        <Text style={styles.username}>{item.username}</Text>
        <Text style={styles.details}>{item.full_name || 'Name not set'} - {item.college_name || 'College not set'}</Text>
      </View>
      <Icon name="chevron-forward-outline" size={22} color={COLORS.textSecondary} />
    </TouchableOpacity>
  ), [navigation]); // Dependency array: only re-create if 'navigation' changes

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Icon name="search-outline" size={22} color={COLORS.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={`Search (min ${MIN_QUERY_LENGTH} chars)...`} // <-- Updated placeholder
          placeholderTextColor={COLORS.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
      </View>
      
      {isLoading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem} // <-- Using the memoized renderItem
          ListEmptyComponent={
            // Show message only if the query meets the minimum length and no results were found
            query.trim().length >= MIN_QUERY_LENGTH ? (
                <Text style={styles.emptyText}>No users found.</Text>
            ) : (
                <Text style={styles.emptyText}>Start typing to search...</Text>
            )
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radius,
    margin: SIZES.padding,
    paddingHorizontal: SIZES.base,
  },
  searchIcon: {
    marginHorizontal: SIZES.base,
  },
  searchInput: {
    flex: 1,
    height: 50,
    ...FONTS.body,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  textContainer: {
    flex: 1,
    marginLeft: SIZES.padding,
  },
  username: {
    ...FONTS.h3,
  },
  details: {
    ...FONTS.caption,
    marginTop: 2,
  },
  emptyText: {
    ...FONTS.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SIZES.padding * 2,
  },
});

export default SearchScreen;