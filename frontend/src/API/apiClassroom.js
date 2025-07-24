import axios from 'axios';

const apiClassroom = axios.create({
  baseURL: '/api/classroom', // targets backend properly for the routes related to the classroom logics
  withCredentials: true
});

export function getClassroom(classId) {
  return apiClassroom.get(`/${classId}`);
}

export default apiClassroom;
