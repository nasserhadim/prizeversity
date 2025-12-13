import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { CSSTransition } from 'react-transition-group';
import { subscribeToNotifications } from '../utils/socket';
// import './NotificationBell.css';

import { Bell } from 'lucide-react';

// helper: stable classroom label used across notifications
function getClassLabel(notification) {
  if (!notification || !notification.classroom) return null;
  const c = notification.classroom;
  if (c.name) return `${c.name}${c.code ? ` (${c.code})` : ''}`;
  if (c.code) return c.code;
  return null;
}

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
// NEW: explicit sort direction
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    fetchNotifications();
    const unsubscribe = subscribeToNotifications((notification) => {
      // defensive: ignore null/undefined malformed payloads that sometimes arrive
      if (!notification) {
        console.warn('[NotificationBell] ignored empty notification payload');
        return;
      }
      console.log('Received new notification:', notification);
      setNotifications(prev => [notification, ...prev]);

      // Only alert/redirect if this notification targets ME
      if (notification?.type === 'classroom_removal') {
        const myId = String(user?._id || '');
        const targetId = String(notification?.user || notification?.userId || notification?.targetUser || '');
        const classId = notification?.classroom?._id || notification?.classroom;

        if (myId && targetId && myId === targetId) {
          const classLabel = getClassLabel(notification) || 'this classroom';
          alert(`You have been removed from classroom "${classLabel}"`);
          const currentPath = window.location.pathname;
          if (classId && currentPath.includes(`/classroom/${classId}`)) {
            window.location.href = '/';
          }
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

  // Work only with non-null notifications to avoid runtime errors
  const safeNotifications = (notifications || []).filter(Boolean);
  const filteredNotifications = safeNotifications
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
      // guard message access
      (notification.message || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      // NEW: apply direction
      if (sortBy === 'date') {
        const ad = new Date(a.createdAt).getTime();
        const bd = new Date(b.createdAt).getTime();
        return sortDir === 'asc' ? ad - bd : bd - ad;
      }
      const cmp = a.message.localeCompare(b.message);
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const paginatedNotifications = filteredNotifications.slice(
    (currentPage - 1) * notificationsPerPage, 
    currentPage * notificationsPerPage
  );

  const totalPages = Math.ceil(filteredNotifications.length / notificationsPerPage);

  const unreadCount = notifications.filter(n => !n.read).length;

  const getDisplayName = (user) => {
    if (!user) return 'System';
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.email;
  };

  return (
    <div className="relative" ref={dropdownRef}>
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
          className="absolute mt-2 bg-base-100 rounded-xl shadow-xl z-50
                     w-[350px] right-0
                     sm:w-[350px] sm:right-0
                     max-sm:fixed max-sm:inset-x-4 max-sm:w-auto max-sm:right-4 max-sm:left-4
                     max-h-[80vh] flex flex-col overflow-hidden"
        >
          <div className="p-4 border-b border-base-300">
            <h3 className="text-lg font-semibold text-base-content">Notifications</h3>
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
              {/* NEW: direction toggle */}
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                title={sortBy === 'date'
                  ? (sortDir === 'asc' ? 'Oldest first' : 'Newest first')
                  : (sortDir === 'asc' ? 'A→Z' : 'Z→A')}
              >
                {sortBy === 'date'
                  ? (sortDir === 'asc' ? 'Oldest' : 'Newest')
                  : (sortDir === 'asc' ? 'A→Z' : 'Z→A')}
              </button>
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

          <div className="flex-1 min-h-0 overflow-y-auto scroll-smooth divide-y divide-base-300 pr-1 pb-2">
            {paginatedNotifications.length > 0 ? (
              <>
                {paginatedNotifications.map(notification => (
                  <div
                    key={notification._id}
                    className={`flex justify-between items-start gap-3 p-4 transition-colors ${
                      notification.read ? 'opacity-70' : 'hover:bg-base-200'
                    }`}
                  >
                    <div className="flex-1">
                      <p className="text-sm text-base-content whitespace-pre-wrap break-words">
                        {notification.message}
                      </p>
                      <small className="text-base-content/60 block mt-1">
                        by {getDisplayName(notification.actionBy)} at{' '}
                        {new Date(notification.createdAt).toLocaleString()}
                        {getClassLabel(notification) && ` in classroom "${getClassLabel(notification)}"`}
                      </small>
                    </div>
                    {!notification.read && (
                      <button
                        className="text-lg text-base-content/60 hover:text-error"
                        onClick={() => handleDismissNotification(notification._id)}
                        aria-label="Dismiss notification"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </>
            ) : (
              <div className="p-4 text-center text-sm text-base-content/60">
                {searchTerm ? 'No matching notifications' : 'No notifications'}
              </div>
            )}
          </div>

          {/* Always-visible pager footer */}
          <div className="bg-base-100 border-t border-base-300 p-3 flex justify-center items-center gap-4">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="btn btn-sm"
            >
              Previous
            </button>
            <span className="text-sm text-base-content/60">{currentPage} of {totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="btn btn-sm"
            >
              Next
            </button>
          </div>
        </div>
      </CSSTransition>
    </div>
  );
};

export default NotificationBell;