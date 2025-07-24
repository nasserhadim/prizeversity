import axios from 'axios';

const apiBazaar = axios.create({
  baseURL: '/api/bazaar', // targets backend properly for the routes realted to the bazaar logics
  withCredentials: true
});

export default apiBazaar;
