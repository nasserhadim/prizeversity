import axios from 'axios';

const apiBazaar = axios.create({
  baseURL: '/api/bazaar', // targets backend properly
  withCredentials: true
});

export default apiBazaar;
