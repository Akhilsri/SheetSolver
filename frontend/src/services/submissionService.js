import apiClient from '../api/apiClient';

export const getTodaysSubmissions = (roomId) => {
  return apiClient.get(`/submissions/room/${roomId}/today`);
};

export const getSubmissionStatus = (problemIds) => {
  return apiClient.post('/submissions/status', { problemIds });
};

export const createSubmission = (formData) => {
  return apiClient.post('/submissions', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};