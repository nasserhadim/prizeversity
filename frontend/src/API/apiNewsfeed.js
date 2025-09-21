import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    withCredentials: true
});

// Fetch all news (announcement) items for a given classroom
export function getNews(classId) {
    return api.get(`/classroom/${classId}/newsfeed`);
}

// Post a new news (announcement) item (teachers only)
export function postNews(classId, formData) {
  // let axios set the Content-Type (so the boundary is included)
  return api.post(`/classroom/${classId}/newsfeed`, formData);
}
export function deleteNews(classId, itemId) {
    return api.delete(`/classroom/${classId}/newsfeed/${itemId}`);
}

export function editNews(classId, itemId, formData) {
    return api.put(`/classroom/${classId}/newsfeed/${itemId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
}