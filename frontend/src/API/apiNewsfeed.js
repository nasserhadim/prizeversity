// prizeversity/frontend/src/API/apiNewsfeed.js
import axios from 'axios';


const api = axios.create({
    baseURL: '/api',
    withCredentials: true
});

// Fetch all news items for a given classroom
export function getNews(classId) {
    return api.get(`/classroom/${classId}/newsfeed`);
}

// Post a new news item (teachers only)
export function postNews(classId, content) {
    return api.post(`/classroom/${classId}/newsfeed`, { content });
}
export function deleteNews(classId, itemId) {
    return api.delete(`/classroom/${classId}/newsfeed/${itemId}`);
}

export function editNews(classId, itemId, content) {
    return api.put(`/classroom/${classId}/newsfeed/${itemId}`, { content });
}