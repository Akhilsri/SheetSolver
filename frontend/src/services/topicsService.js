import apiClient from '../api/apiClient';

export const getAllTopics = async () => {
  try {
    const response = await apiClient.get('/topics');
    return response.data;
  } catch (error) {
    console.error("Error fetching all topics:", error);
    throw error;
  }
};