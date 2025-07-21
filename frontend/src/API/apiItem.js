// apiItem.js
import axios from 'axios';

const apiItem = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default apiItem;