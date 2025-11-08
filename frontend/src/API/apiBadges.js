import axios from 'axios';

const apiBadges = axios.create({
  baseURL: '/api/badges',
  withCredentials: true,
});

export const createBadge = (data) => apiBadges.post('/', data);
export const getBadges = (classroomId) => apiBadges.get(`/${classroomId}`);
export const deleteBadge = (badgeId) => apiBadges.delete(`/${badgeId}`);
export const updateBadge = (badgeId, data) => apiBadges.put(`/${badgeId}`, data);

// Fetch badges earned vs locked for a specific student
export const getUserBadges = async (userId, classroomId) => {
  const res = await axios.get(`/api/xp/badges/${userId}/${classroomId}`, {
    withCredentials: true,
  });
  return res.data;
};

export default apiBadges;
