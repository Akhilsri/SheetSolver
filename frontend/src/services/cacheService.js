import AsyncStorage from '@react-native-async-storage/async-storage';

// Time to live (TTL) for cache entries: 5 minutes
const CACHE_TTL = 5 * 60 * 1000; 

/**
 * Saves data to AsyncStorage with an expiration timestamp.
 * @param {string} key - The cache key (e.g., 'rooms').
 * @param {any} data - The data to store.
 */
export const setCacheItem = async (key, data) => {
    try {
        const item = {
            data: data,
            timestamp: Date.now(),
            expiry: Date.now() + CACHE_TTL,
        };
        // Use a single, synchronous setItem operation
        await AsyncStorage.setItem(key, JSON.stringify(item));
    } catch (e) {
        console.error(`Error saving cache item ${key}:`, e);
    }
};

/**
 * Retrieves data from AsyncStorage if it hasn't expired.
 * @param {string} key - The cache key.
 * @returns {Promise<any|null>} The cached data or null if expired/not found.
 */
export const getCacheItem = async (key) => {
    try {
        const serializedItem = await AsyncStorage.getItem(key);
        if (!serializedItem) {
            return null;
        }

        const item = JSON.parse(serializedItem);
        
        // Check if the cache has expired
        if (Date.now() > item.expiry) {
            console.log(`Cache expired for ${key}. Clearing item.`);
            await AsyncStorage.removeItem(key);
            return null;
        }

        return item.data;
    } catch (e) {
        console.error(`Error retrieving cache item ${key}:`, e);
        return null;
    }
};

export const clearCacheItem = async (key) => {
    try {
        await AsyncStorage.removeItem(key);
    } catch (e) {
        console.error(`Error clearing cache item ${key}:`, e);
    }
};
