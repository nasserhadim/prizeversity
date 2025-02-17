import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { CSSTransition } from 'react-transition-group';
import { subscribeToNotifications } from '../utils/socket';
import './NotificationBell.css';

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [filterBy, setFilterBy] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const notificationsPerPage = 2;
  const dropdownRef = useRef(null);
  const nodeRef = useRef(null); // Add this new ref for CSSTransition

  useEffect(() => {
    fetchNotifications();
    const unsubscribe = subscribeToNotifications((notification) => {
      console.log('Received new notification:', notification);
      setNotifications(prev => [notification, ...prev]);

      // Handle classroom removal notification
      if (notification.type === 'classroom_removal') {
        alert(`You have been removed from classroom "${notification.classroom.name}"`);
        // If currently in that classroom, redirect to home
        const currentPath = window.location.pathname;
        if (currentPath.includes(`/classroom/${notification.classroom._id}`)) {
          window.location.href = '/';
        }
      }
    });

    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      unsubscribe();
      document.removeEventListener('mousedown', handleClickOutside);
    };
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
      setNotifications(prev => prev.filter(n => n._id !== id));
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

  // Filter and sort notifications
  const filteredNotifications = notifications
    .filter(notification => {
      if (filterBy === 'all') return true;
      if (filterBy.includes(',')) {
        // Handle multiple types
        const types = filterBy.split(',');
        return types.includes(notification.type);
      }
      return notification.type === filterBy;
    })
    .filter(notification =>
      notification.message.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      return a.message.localeCompare(b.message);
    });

  const paginatedNotifications = filteredNotifications.slice(
    (currentPage - 1) * notificationsPerPage, 
    currentPage * notificationsPerPage
  );

  const totalPages = Math.ceil(filteredNotifications.length / notificationsPerPage);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="notification-bell" ref={dropdownRef}>
      <div 
        className="bell-icon" 
        onClick={() => setShowNotifications(!showNotifications)}
        role="button"
        tabIndex={0}
      >
        🔔
        {unreadCount > 0 && <span className="notification-count">{unreadCount}</span>}
      </div>
      
      <CSSTransition
        in={showNotifications}
        timeout={300}
        classNames="dropdown"
        unmountOnExit
        nodeRef={nodeRef} // Add this prop
      >
        <div ref={nodeRef} className="notification-dropdown"> {/* Add ref here */}
          <div className="notification-header">
            <h3>Notifications</h3>
            <div className="notification-controls">
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="sort-select"
              >
                <option value="date">Sort by Date</option>
                <option value="message">Sort by Message</option>
              </select>
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value)}
                className="filter-select"
              >
                <option value="all">All</option>
                <option value="group_approval">Approvals</option>
                <option value="group_rejection">Rejections</option>
                <option value="classroom_removal">Removals</option>
                <option value="group_suspension">Suspensions</option>
                <option value="group_deletion,classroom_deletion,groupset_deletion">Deletions</option>
              </select>
              <button 
                onClick={handleDismissAll}
                className="dismiss-all-button"
              >
                Dismiss All
              </button>
            </div>
          </div>

          <div className="notification-list">
            {paginatedNotifications.length > 0 ? (
              <>
                {paginatedNotifications.map(notification => (
                  <div 
                    key={notification._id} 
                    className={`notification-item ${notification.read ? 'read' : ''}`}
                  >
                    <div className="notification-content">
                      <p>{notification.message}</p>
                      <small>
                        by {notification.actionBy.email} at {new Date(notification.createdAt).toLocaleString()} 
                        {notification.classroom && ` in classroom "${notification.classroom.name}"`}
                      </small>
                    </div>
                    {!notification.read && (
                      <button
                        className="dismiss-button"
                        onClick={() => handleDismissNotification(notification._id)}
                        aria-label="Dismiss notification"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <div className="pagination-controls">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </button>
                  <span>{currentPage} of {totalPages}</span>
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </button>
                </div>
              </>
            ) : (
              <div className="no-notifications">
                {searchTerm ? 'No matching notifications' : 'No notifications'}
              </div>
            )}
          </div>
        </div>
      </CSSTransition>
    </div>
  );
};

export default NotificationBell;