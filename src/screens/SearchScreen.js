import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import apiClient from '../api/apiClient';

const SearchScreen = ({ navigation }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // This useEffect hook implements the "debounce" for our live search
  useEffect(() => {
    // If the query is empty, don't search
    if (query.trim() === '') {
      setResults([]);
      return;
    }

    setIsLoading(true);
    // Set a timer. If the user types again, we'll clear this timer.
    const searchTimer = setTimeout(async () => {
      try {
        const response = await apiClient.get(`/users/search?query=${query}`);
        setResults(response.data);
      } catch (error) {
        console.error('Failed to search users:', error);
      } finally {
        setIsLoading(false);
      }
    }, 300); // Wait 300ms after the user stops typing

    // This is the cleanup function. It runs if the user types again before 300ms.
    return () => clearTimeout(searchTimer);
  }, [query]); // This effect re-runs every time the 'query' state changes

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.resultItem}>
      <Text style={styles.username}>{item.username}</Text>
      <Text style={styles.details}>{item.full_name} - {item.college_name}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search by username, name, or college..."
        value={query}
        onChangeText={setQuery}
      />
      {isLoading ? (
        <ActivityIndicator size="large" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          ListEmptyComponent={
            query.trim() !== '' && <Text style={styles.emptyText}>No users found.</Text>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  searchInput: {
    height: 40,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    margin: 15,
    fontSize: 16,
  },
  resultItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  details: {
    fontSize: 14,
    color: 'gray',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    color: 'gray',
  },
});

export default SearchScreen;