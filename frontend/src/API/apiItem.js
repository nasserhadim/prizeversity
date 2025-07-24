import axios from 'axios';

// custom axios so there will not be any issues regarding different categories of the items (attack, defend, utility, passive)
const apiItem = axios.create({
  baseURL: '/api', 
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default apiItem;