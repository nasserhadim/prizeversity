import axios from 'axios';

const apiMysteryBox = axios.create({
  baseURL: '/api/mystery-box',
  withCredentials: true
});

export const createMysteryBox = (classroomId, bazaarId, data) =>
  apiMysteryBox.post(`/classroom/${classroomId}/bazaar/${bazaarId}/mystery-box`, data);

export const getMysteryBoxes = (classroomId, bazaarId) =>
  apiMysteryBox.get(`/classroom/${classroomId}/bazaar/${bazaarId}/mystery-boxes`);

export const openMysteryBox = (classroomId, boxId) =>
  apiMysteryBox.post(`/classroom/${classroomId}/mystery-box/${boxId}/open`);

export const deleteMysteryBox = (classroomId, boxId) =>
  apiMysteryBox.delete(`/classroom/${classroomId}/mystery-box/${boxId}`);

export default apiMysteryBox;