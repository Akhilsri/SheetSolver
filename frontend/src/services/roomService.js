import apiClient from '../api/apiClient';

export const getRoomDetails = (roomId) => {
  return apiClient.get(`/rooms/${roomId}`);
};

export const getRoomMembers = (roomId) => {
  return apiClient.get(`/rooms/${roomId}/members`);
};

export const getDailyProblems = (roomId) => {
  return apiClient.get(`/rooms/${roomId}/daily-problems`);
};

export const getJoinRequests = (roomId) => {
  return apiClient.get(`/rooms/${roomId}/join-requests`);
};

export const startJourney = (roomId, sheetId, duration) => {
  return apiClient.post(`/rooms/${roomId}/start`, { sheetId, duration });
};

export const removeMember = (roomId, memberId) => {
  return apiClient.delete(`/rooms/${roomId}/members/${memberId}`);
};

export const approveJoinRequest = (requestId) => {
  return apiClient.put(`/rooms/join-requests/${requestId}/approve`);
};

export const denyJoinRequest = (requestId) => {
  return apiClient.put(`/rooms/join-requests/${requestId}/deny`);
};

export const getDailyRoomProgress = (roomId) => {
  return apiClient.get(`/rooms/${roomId}/daily-progress`);
};