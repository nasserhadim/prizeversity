import axios from 'axios';

const apiDiscount = axios.create({
  baseURL: '/api/discounts', // targets backend properly for the routes realted to the discounts
  withCredentials: true
});

export default apiDiscount;
