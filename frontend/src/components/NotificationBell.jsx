import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './NotificationBell.css';

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await axios.get('/api/notifications');
      setNotifications(response.data);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  };

  const handleDismissNotification = async (id) => {
    try {
      await axios.post(`/api/notifications/read/${id}`);
      fetchNotifications();
    } catch (err) {
      console.error('Failed to dismiss notification', err);
    }
  };

  const handleDismissAll = async () => {
    try {
      await axios.post('/api/notifications/read-all');
      fetchNotifications();
    } catch (err) {
      console.error('Failed to dismiss all notifications', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="notification-bell">
      <div className="bell-icon" onClick={() => setShowNotifications(!showNotifications)}>
        🔔
        {unreadCount > 0 && <span className="notification-count">{unreadCount}</span>}
      </div>
      
      {showNotifications && (
        <div className="notification-dropdown">
          {notifications.length > 0 ? (
            <>
              <div className="notification-header">
                <h3>Notifications</h3>
                <button onClick={handleDismissAll}>Dismiss All</button>
              </div>
              <div className="notification-list">
                {notifications.map(notification => (
                  <div key={notification._id} className={`notification-item ${notification.read ? 'read' : ''}`}>
                    <p>{notification.message}</p>
                    <small>
                      by {notification.actionBy.email} at {new Date(notification.createdAt).toLocaleString()}
                    </small>
                    {!notification.read && (
                      <button 
                        className="dismiss-button"
                        onClick={() => handleDismissNotification(notification._id)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="no-notifications">No notifications</div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;