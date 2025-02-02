import { io } from 'socket.io-client';

const socket = io('http://localhost:5000');

socket.on('connect', () => {
  console.log('Connected to socket server');
  if (localStorage.getItem('userId')) {
    socket.emit('join-user', localStorage.getItem('userId'));
  }
});

export const joinClassroom = (classroomId) => {
  socket.emit('join-classroom', classroomId);
};

export const joinUserRoom = (userId) => {
  socket.emit('join-user', userId);
  localStorage.setItem('userId', userId);
};

export const subscribeToNotifications = (callback) => {
  socket.on('notification', callback);
  return () => socket.off('notification', callback);
};

export default socket;