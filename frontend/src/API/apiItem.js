import axios from 'axios';

const apiItem = axios.create({
  baseURL: '/api/items', // targets backend properly
  withCredentials: true
});

export default apiItem;
