import axios from 'axios';

export const equipBadge = async (classroomId, badgeId) => {
  const res = await axios.post('/api/badge/equip', { classroomId, badgeId }, { withCredentials: true });
  return res.data;
};

export const unequipBadge = async (classroomId) => {
  const res = await axios.post('/api/badge/equip', { classroomId, badgeId: null }, { withCredentials: true });
  return res.data;
};

export const getEquippedBadge = async (classroomId, userId = null) => {
  const url = userId 
    ? `/api/badge/equipped/${classroomId}/${userId}`
    : `/api/badge/equipped/${classroomId}`;
  const res = await axios.get(url, { withCredentials: true });
  return res.data;
};