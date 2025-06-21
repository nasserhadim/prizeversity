import axios from 'axios';

const apiLeaderboard = axios.create({
  baseURL: '/api/leaderboard',
  withCredentials: true
});

export default apiLeaderboard;
