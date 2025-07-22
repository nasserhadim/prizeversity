import axios from 'axios';

// for the leaderboard page this custom axios will listen to all the API calls realted to the leaderboard route/s
const apiLeaderboard = axios.create({
  baseURL: '/api/leaderboard',
  withCredentials: true
});

export default apiLeaderboard;
