import apiClient from '../api/apiClient';

export const getAllSheets = () => {
  return apiClient.get('/sheets');
};