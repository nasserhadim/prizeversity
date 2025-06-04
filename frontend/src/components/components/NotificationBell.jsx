import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { CSSTransition } from 'react-transition-group';
import { subscribeToNotifications } from '../utils/socket';
// import './NotificationBell.css';

import { Bell } from 'lucide-react';

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
    <div className="fixed top-3 right-3 z-[1000]" ref={dropdownRef}>
      <div
        className="relative bg-white rounded-full shadow-md p-2 cursor-pointer text-2xl hover:scale-110 transition-transform duration-200"
        onClick={() => setShowNotifications(!showNotifications)}
        role="button"
        tabIndex={0}
      >
      <Bell className='w-6 h-6 text-gray-800' />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-error text-white text-xs rounded-full px-1.5 animate-pulse">
            {unreadCount}
          </span>
        )}
      </div>

      <CSSTransition
        in={showNotifications}
        timeout={300}
        classNames="dropdown"
        unmountOnExit
        nodeRef={nodeRef}
      >
        <div
          ref={nodeRef}
          className="absolute right-0 mt-2 w-[350px] max-w-[90vw] bg-white rounded-xl shadow-xl"
        >
          <div className="p-4 border-b border-base-200">
            <h3 className="text-lg font-semibold text-gray-800">Notifications</h3>
            <div className="flex flex-wrap gap-3 mt-3">
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input input-bordered w-full sm:flex-1 min-w-[150px]"
              />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="select select-bordered"
              >
                <option value="date">Sort by Date</option>
                <option value="message">Sort by Message</option>
              </select>
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value)}
                className="select select-bordered"
              >
                <option value="all">All</option>
                <option value="group_approval">Approvals</option>
                <option value="group_rejection">Rejections</option>
                <option value="classroom_removal">Removals</option>
                <option value="group_suspension">Suspensions</option>
                <option value="group_deletion,classroom_deletion,groupset_deletion">Deletions</option>
                <option value="classroom_update,groupset_update,group_update">Updates</option>
              </select>
              <button
                onClick={handleDismissAll}
                className="btn btn-outline btn-sm"
              >
                Dismiss All
              </button>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto scroll-smooth divide-y divide-base-200">
            {paginatedNotifications.length > 0 ? (
              <>
                {paginatedNotifications.map(notification => (
                  <div
                    key={notification._id}
                    className={`flex justify-between items-start gap-3 p-4 transition-colors ${
                      notification.read ? 'opacity-70' : 'hover:bg-base-100'
                    }`}
                  >
                    <div className="flex-1">
                      <p className="text-sm">{notification.message}</p>
                      <small className="text-gray-500 block mt-1">
                        by {notification.actionBy.email} at{' '}
                        {new Date(notification.createdAt).toLocaleString()}
                        {notification.classroom && ` in classroom "${notification.classroom.name}"`}
                      </small>
                    </div>
                    {!notification.read && (
                      <button
                        className="text-lg text-gray-500 hover:text-error"
                        onClick={() => handleDismissNotification(notification._id)}
                        aria-label="Dismiss notification"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <div className="flex justify-center items-center gap-4 py-3 border-t border-base-200">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="btn btn-sm"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">{currentPage} of {totalPages}</span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="btn btn-sm"
                  >
                    Next
                  </button>
                </div>
              </>
            ) : (
              <div className="p-4 text-center text-sm text-gray-500">
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