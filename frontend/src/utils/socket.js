import io from 'socket.io-client';
const socket = io('http://localhost:5000');

const joinUserRoomWhenAvailable = () => {
  const currentUserId = window.currentUserId || localStorage.getItem('userId');
  if (currentUserId) {
    socket.emit('join', `user-${currentUserId}`);
    console.log(`Joined room: user-${currentUserId}`);
  } else {
    console.warn('No user id available for socket room join.');
  }
};

socket.on('connect', () => {
  joinUserRoomWhenAvailable();
});

export const joinClassroom = (classroomId) => {
  socket.emit('join-classroom', classroomId);
};

export const joinUserRoom = (userId) => {
  localStorage.setItem('userId', userId);
  socket.emit('join', `user-${userId}`);
  console.log(`Joined room: user-${userId}`);
};

export const subscribeToNotifications = (cb) => {
  socket.on('notification', (notification) => {
    console.log('Received new notification:', notification);
    cb(notification);
  });
  return () => socket.off('notification');
};

export default socket;