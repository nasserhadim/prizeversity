import axios from 'axios';

const apiClassroom = axios.create({
  baseURL: '/api/classroom', // targets backend properly
  withCredentials: true
});

export default apiClassroom;
