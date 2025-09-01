import io from 'socket.io-client';
import axios from 'axios';

import { API_BASE } from '../config/api';
const socket = io(); // no "/api" needed here

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

/* --- NEW: lightweight subscription for feedback events --- */
export function subscribeToFeedbackEvents(cb) {
  const handlers = {
    feedback_created: (p) => cb({ event: 'feedback_created', payload: p }),
    feedback_updated: (p) => cb({ event: 'feedback_updated', payload: p }),
    feedback_deleted: (p) => cb({ event: 'feedback_deleted', payload: p }),
    feedback_visibility_changed: (p) => cb({ event: 'feedback_visibility_changed', payload: p }),
    moderation_log_updated: (p) => cb({ event: 'moderation_log_updated', payload: p }),
    feedback_report: (p) => cb({ event: 'feedback_report', payload: p }),
  };
  Object.entries(handlers).forEach(([ev, fn]) => socket.on(ev, fn));
  return () => Object.entries(handlers).forEach(([ev, fn]) => socket.off(ev, fn));
}

/* --- NEW: convenience for only report events --- */
export function subscribeToFeedbackReports(cb) {
  const handler = (p) => cb(p);
  socket.on('feedback_report', handler);
  return () => socket.off('feedback_report', handler);
}

export default socket;