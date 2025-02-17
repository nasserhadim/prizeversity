import io from 'socket.io-client';
import axios from 'axios';

const socket = io('http://localhost:5000');

export const joinClassroom = (classroomId) => {
  socket.emit('join-classroom', classroomId);
};

export const joinUserRoom = async (userId) => {
  localStorage.setItem('userId', userId);
  
  try {
    const response = await axios.get(`/api/auth/user/${userId}`);
    const userEmail = response.data.email;
    socket.emit('join', `user-${userId}`);
    console.log(`Joined room: user-${userId} (${userEmail})`);
  } catch (err) {
    socket.emit('join', `user-${userId}`);
    console.log(`Joined room: user-${userId}`);
  }
};

export const subscribeToNotifications = (cb) => {
  socket.on('notification', (notification) => {
    console.log('Received new notification:', notification);
    cb(notification);
  });
  return () => socket.off('notification');
};

export default socket;