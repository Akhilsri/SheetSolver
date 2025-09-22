import axios from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Make sure this is your computer's correct local IP address
const baseURL = 'http://192.168.1.3:3000'; 

const apiClient = axios.create({
  baseURL: `${baseURL}/api`,
});

// Request Interceptor: Attaches the access token to every request
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handles expired access tokens and other errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // --- THIS IS THE FIX ---
    // We now check if error.response exists before trying to access its properties.
    if (error.response && error.response.status === 403 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      console.log('Access token expired. Attempting to refresh...');

      try {
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        const response = await axios.post(`${baseURL}/api/auth/refresh`, { refreshToken });
        const { accessToken: newAccessToken } = response.data;
        
        await AsyncStorage.setItem('accessToken', newAccessToken);
        
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        
        return apiClient(originalRequest);
      } catch (refreshError) {
        console.error("Session expired. Please log in again.", refreshError);
        // Here you would trigger a global logout state in a real app
        return Promise.reject(refreshError);
      }
    }
    
    // For all other errors (including network errors where error.response is undefined),
    // we just reject the promise. This will be caught by the .catch() block in our screen.
    return Promise.reject(error);
  }
);

export default apiClient;