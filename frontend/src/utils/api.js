import axios from 'axios';

import { API_BASE } from './config/api';
const socket = io(API_BASE); // no "/api" needed here

const api = axios.create({
  baseURL: '${API_BASE}',  
  withCredentials: true,                 
});

export default api;
