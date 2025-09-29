import { Link, useLocation } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { useCart } from '../context/CartContext';
import { ShoppingCart, Menu, X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import NotificationBell from './NotificationBell';
import Logo from './Logo'; // Import the new Logo component
import { API_BASE } from '../config/api';
import socket, { joinUserRoom, joinClassroom } from '../utils/socket'; // <-- updated import
import axios from 'axios';

import {
  Home,
  School,
  Briefcase,
  Users,
  User,
  Wallet,
  UserRound,
  Trophy,
  Shield,
  Settings,
  HelpCircle,
  Replace,
  LogOut,
  History,
  Star,
  Sun,
  Moon
} from 'lucide-react';

const BACKEND_URL = `${API_BASE}`;

const Navbar = () => {
  const { user, logout, setPersona, originalUser } = useContext(AuthContext);
  const { theme, toggleTheme } = useContext(ThemeContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef(null);

  // Handle switching from teacher to student view
  const handleSwitchToStudent = () => {
    setPersona({ ...user, role: 'student' });
    // If currently in a classroom route, stay in the classroom context
    const match = location.pathname.match(/^\/classroom\/([^\/]+)/);
    if (match) {
      navigate(`/classroom/${match[1]}/news`);
    } else {
      navigate('/');
    }
  };

  // Handle switching from student back to original teacher
  const handleSwitchToTeacher = () => {
    // Go back to the original teacher user
    setPersona(originalUser);

    const match = location.pathname.match(/^\/classroom\/([^\/]+)/);
    if (match) {
      navigate(`/classroom/${match[1]}/news`);
    } else {
      navigate('/');
    }
  };

  // Determine if classroom tabs should be shown based on user profile
  const showClassroomsTab = Boolean(
    user?.firstName &&
    user?.lastName &&
    user?.role
  );

  // Extract classroom ID from URL path
  const classroomMatch = location.pathname.match(/^\/classroom\/([^\/]+)/);
  const classroomId = classroomMatch ? classroomMatch[1] : null;
  const insideClassroom = Boolean(classroomId);

  // Use classroom-scoped cart API
  const { getCart, getCount, removeFromCart } = useCart();
  const cartItems = getCart(classroomId);
  const cartCount = getCount(classroomId) || 0;

  const [showCart, setShowCart] = useState(false);
  const cartRef = useRef(null);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    const fetchBalance = async () => {
      if (user?._id && classroomId) {
        try {
          const { data } = await axios.get(`/api/wallet/${user._id}/balance?classroomId=${classroomId}`, { withCredentials: true });
          setBalance(data.balance);
        } catch (error) {
          console.error("Failed to fetch balance for navbar", error);
        }
      }
    };
    fetchBalance();

    // Join when socket connected
    const joinRooms = () => {
      if (!user?._id) return;
      console.debug('[socket] Navbar joining rooms', { userId: user._id, classroomId });
      // Use helpers that join the same room names the server emits to
      joinUserRoom(user._id);
      if (classroomId) joinClassroom(classroomId);
    };

    if (socket.connected) joinRooms();
    socket.on('connect', joinRooms);

    // ── Add robust realtime handlers for Navbar balance ──
    const fetchNavBalance = async () => {
      try {
        const params = classroomId ? `?classroomId=${classroomId}` : '';
        const { data } = await axios.get(`/api/wallet/${user._id}/balance${params}`, { withCredentials: true });
        setBalance(data.balance);
      } catch (err) {
        console.error('[Navbar] failed to fetch balance', err);
      }
    };

    // Update if an event explicitly targets this user
    const balanceUpdateHandler = (payload) => {
      console.debug('[socket] Navbar balance_update:', payload);
      const affectedId = payload?.studentId || payload?.user?._id || payload?.userId;
      // if this event is for me:
      if (String(affectedId) === String(user._id)) {
        if (payload?.newBalance != null) {
          setBalance(payload.newBalance);
        } else {
          // fallback: re-fetch from server
          fetchNavBalance();
        }
      }
    };

    // Notifications may carry wallet changes
    const notificationHandler = (payload) => {
      console.debug('[socket] Navbar notification:', payload);
      const walletTypes = new Set(['wallet_topup','wallet_transfer','wallet_adjustment','wallet_payment','wallet_transaction']);
      if (!payload?.type || !walletTypes.has(payload.type)) return;
      const affectedId = payload?.user?._id || payload?.studentId || payload?.userId;
      if (String(affectedId) === String(user._id)) {
        if (payload?.newBalance != null) setBalance(payload.newBalance);
        else fetchNavBalance();
      }
    };

    // Group/bulk events may include results array; check if current user is in results
    const balanceAdjustHandler = (payload) => {
      console.debug('[socket] Navbar balance_adjust:', payload);
      if (Array.isArray(payload?.results)) {
        const found = payload.results.find(r => String(r.id || r._id) === String(user._id));
        if (found) {
          if (found.newBalance != null) setBalance(found.newBalance);
          else fetchNavBalance();
        }
      } else {
        // fallback: classroom-scoped event may affect me — if classroom matches, re-fetch
        const classroomFromPayload = payload?.classroomId || payload?.classroom?._id || payload?.classroom;
        if (classroomFromPayload && String(classroomFromPayload) === String(classroomId)) {
          fetchNavBalance();
        }
      }
    };

    socket.on('balance_update', balanceUpdateHandler);
    socket.on('notification', notificationHandler);
    socket.on('balance_adjust', balanceAdjustHandler);

    return () => {
      socket.off('connect', joinRooms);
      socket.off('balance_update', balanceUpdateHandler);
      socket.off('notification', notificationHandler);
      socket.off('balance_adjust', balanceAdjustHandler);
    };
  }, [user, classroomId]);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Hook to close cart dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Ignore clicks on the cart toggle(s)
      if (event.target.closest && event.target.closest('[data-cart-toggle]')) return;

      if (cartRef.current && !cartRef.current.contains(event.target)) {
        setShowCart(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (!user) {
    return (
      <nav className="fixed top-0 left-0 right-0 z-50 bg-base-100 text-base-content shadow-md px-4 lg:px-6 py-4 bg-opacity-20 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between gap-4">
          <Logo />
          <div className="flex items-center gap-2 flex-shrink min-w-0">
            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-base-200 rounded-lg"
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            <button
              className="btn btn-sm btn-outline flex-shrink min-w-0 whitespace-normal h-auto"
              onClick={() => (window.location.href = '/api/auth/google')}
            >
              Sign in with Google
            </button>
            <button
              className="btn btn-sm btn-neutral flex-shrink min-w-0 whitespace-normal h-auto"
              onClick={() => (window.location.href = '/api/auth/microsoft')}
            >
              Sign in with Microsoft
            </button>
          </div>
        </div>
      </nav>
    );
  }

  // Use a slightly darker hover color in light mode so links remain readable
  const hoverClass = theme === 'light' ? 'hover:text-gray-700' : 'hover:text-gray-300';

  return (
    <nav
      data-theme={theme}
      className='fixed inset-x-0 top-0 w-screen z-50 bg-base-100 text-base-content shadow-md px-4 lg:px-6 py-4 bg-opacity-20 backdrop-blur-md'
    >
      <div className='container mx-auto flex items-center justify-between'>
        {/* Logo */}
        <Logo />

        {/* Mobile Menu Button */}
        <div className="lg:hidden flex items-center gap-2">
          {/* Wallet Balance for Mobile */}
          {insideClassroom && (
            <Link to={`/classroom/${classroomId}/wallet`} className={`flex items-center gap-2 ${hoverClass}`}>
              <Wallet size={24} className="text-green-500" />
              <span className="font-semibold">Ƀ{balance}</span>
            </Link>
          )}
          {/* Cart Icon for Mobile (if in classroom and not teacher) */}
          {user?.role !== 'teacher' && insideClassroom && (
            <button
              className="relative"
              onClick={() => setShowCart(!showCart)}
              title="Cart"
              data-cart-toggle
            >
              <ShoppingCart size={20} className="text-green-500" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-red-500 text-white rounded-full text-xs w-4 h-4 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          )}

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-base-200 rounded-lg"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>

          {/* Notification Bell */}
          <NotificationBell />

          {/* Mobile Menu Toggle */}
          <button
            className="p-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Desktop Navigation */}
        <ul className='hidden lg:flex space-x-4 text-lg items-center'>
          {!insideClassroom && (
            <>
              <li>
                <Link
                  to="/"
                  className={`flex items-center gap-2 ${hoverClass} ${location.pathname === '/' ? 'text-green-500' : ''}`}
                  title="Home"
                >
                  <Home size={18} />
                  <span>Home</span>
                </Link>
              </li>
              {showClassroomsTab && (
                <li>
                  <Link
                    to="/classrooms"
                    className={`flex items-center gap-2 ${hoverClass} ${location.pathname === '/classrooms' ? 'text-green-500' : ''}`}
                    title="Classrooms"
                  >
                    <School size={18} />
                    <span>Classrooms</span>
                  </Link>
                </li>
              )}
            </>
          )}

          {insideClassroom && (
            <>
              <li>
                <Link
                  to={`/classroom/${classroomId}`}
                  className={`flex items-center gap-2 ${hoverClass} ${location.pathname === `/classroom/${classroomId}` ? 'text-green-500' : ''}`}
                >
                  <School size={18} />
                  <span>Classroom</span>
                </Link>
              </li>
              <li>
                <Link
                  to={`/classroom/${classroomId}/bazaar`}
                  className={`flex items-center gap-2 ${hoverClass} ${location.pathname.startsWith(`/classroom/${classroomId}/bazaar`) ? 'text-green-500' : ''}`}
                >
                  <Briefcase size={18} />
                  <span>Bazaar</span>
                </Link>
              </li>
              <li>
                <Link
                  to={`/classroom/${classroomId}/groups`}
                  className={`flex items-center gap-2 ${hoverClass} ${location.pathname.startsWith(`/classroom/${classroomId}/groups`) ? 'text-green-500' : ''}`}
                >
                  <Users size={18} />
                  <span>Groups</span>
                </Link>
              </li>
              <li>
                <Link
                  to={`/classroom/${classroomId}/people`}
                  className={`flex items-center gap-2 ${hoverClass} ${location.pathname.startsWith(`/classroom/${classroomId}/people`) ? 'text-green-500' : ''}`}
                >
                  <UserRound size={18} />
                  <span>People</span>
                </Link>
              </li>
              <li>
                <Link
                  to={`/classroom/${classroomId}/leaderboard`}
                  className={`flex items-center gap-2 ${hoverClass} ${location.pathname.startsWith(`/classroom/${classroomId}/leaderboard`) ? 'text-green-500' : ''}`}
                  title="Leaderboard"
                >
                  <Trophy size={18} />
                  <span>Leaderboard</span>
                </Link>
              </li>
              <li>
                <div className="tooltip tooltip-bottom" data-tip="Challenge">
                  <Link
                    to={`/classroom/${classroomId}/challenge`}
                    className={`flex items-center gap-2 ${hoverClass} ${location.pathname.startsWith(`/classroom/${classroomId}/challenge`) ? 'text-green-500' : ''}`}
                  >
                    <Shield size={18} />
                    <span className="hidden lg:inline">Challenge</span>
                  </Link>
                </div>
              </li>
              <li>
                <Link 
                to={`/classroom/${classroomId}/feedback`}
                className={`flex items-center gap-2 ${hoverClass} ${location.pathname === `/classroom/${classroomId}/feedback` ? 'text-green-500' : ''}`}
                >
                  <Star size={18} />
                  <span>Feedback</span>
                </Link>
              </li>
            </>
          )}
        </ul>

        {/* Desktop Right Side */}
        <div className="hidden lg:flex items-center gap-4">
          {/* Wallet Balance */}
          {insideClassroom && (
            <Link to={`/classroom/${classroomId}/wallet`} className="flex items-center gap-2 hover:text-gray-300">
              <Wallet size={24} className="text-green-500" />
              <span className="font-semibold">Ƀ{balance}</span>
            </Link>
          )}

          {/* Desktop Cart Icon */}
          {user?.role !== 'teacher' && insideClassroom && (
            <button
              className="relative"
              onClick={() => setShowCart(!showCart)}
              title="Cart"
              data-cart-toggle
            >
              <ShoppingCart size={24} className="text-green-500" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-red-500 text-white rounded-full text-xs w-5 h-5 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          )}

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-base-200 rounded-lg"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? <Moon size={24} /> : <Sun size={24} />}
          </button>

          {/* Desktop Notification Bell */}
          <NotificationBell />

          {/* Desktop Profile Dropdown */}
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar">
              <div className="w-10 h-10 rounded-full ring ring-success ring-offset-base-100 ring-offset-2 overflow-hidden">
                {(() => {
                  // build avatar src safely and avoid calling .startsWith on null/undefined
                  const getAvatarSrc = (u) => {
                    if (!u) return null;
                    if (u.avatar) {
                      if (typeof u.avatar === 'string' && (u.avatar.startsWith('data:') || u.avatar.startsWith('http'))) return u.avatar;
                      return `${BACKEND_URL}/uploads/${u.avatar}`;
                    }
                    if (u.profileImage) return u.profileImage;
                    return null;
                  };

                  const avatarSrc = getAvatarSrc(user);
                  if (avatarSrc) {
                    return (
                      <img
                        alt="User Avatar"
                        src={avatarSrc}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          if (user.profileImage) {
                            e.target.src = user.profileImage;
                          } else {
                            const initialsDiv = document.createElement('div');
                            initialsDiv.className = 'w-full h-full bg-gray-200 flex items-center justify-center text-lg font-bold text-gray-600';
                            initialsDiv.textContent = `${(user.firstName?.[0] || user.email?.[0] || 'U')}${(user.lastName?.[0] || '')}`.toUpperCase();
                            e.target.parentNode.replaceChild(initialsDiv, e.target);
                          }
                        }}
                      />
                    );
                  }

                  return (
                    <div className="w-full h-full bg-base-300 flex items-center justify-center text-sm font-bold text-base-content/70">
                      {`${(user.firstName?.[0] || user.email?.[0] || 'U')}${(user.lastName?.[0] || '')}`.toUpperCase()}
                    </div>
                  );
                })()}
              </div>
            </div>
            <ul tabIndex={0} className="mt-3 z-[1] p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-52">
              <li><Link to={`/profile/${user._id}`} className="flex items-center gap-2"><User size={16} />Profile</Link></li>
              <li><Link to="/settings" className="flex items-center gap-2"><Settings size={16} />Settings</Link></li>
              <li><Link to="/support" className="flex items-center gap-2"><HelpCircle size={16} />Help & Support</Link></li>
              {user.role === 'student' && (
                <li><Link to="/orders" className="flex items-center gap-2"><History size={16} />Order History</Link></li>
              )}
              {user.role === 'teacher' && (
                <li>
                  <button onClick={handleSwitchToStudent} className="flex items-center gap-2">
                    <Replace size={16} />
                    Switch to Student Profile
                  </button>
                </li>
              )}
              {originalUser?.role === 'teacher' && user.role === 'student' && (
                <li>
                  <button onClick={handleSwitchToTeacher} className="flex items-center gap-2">
                    <Replace size={16} />
                    Switch to Teacher Profile
                  </button>
                </li>
              )}
              <li><button onClick={logout} className="flex items-center gap-2 text-error"><LogOut size={16} />Logout</button></li>
            </ul>
          </div>
        </div>

        {/* Cart Dropdown */}
        {showCart && (
          <div ref={cartRef} className="fixed top-20 right-4 bg-base-100 border border-base-300 shadow-lg w-80 max-w-[calc(100vw-2rem)] z-[9999] p-4 rounded text-base-content">
            <h3 className="text-lg font-bold mb-2">Your Cart</h3>
            {cartItems.length === 0 ? (
              <p className="text-sm text-base-content/60">Cart is empty</p>
            ) : (
              <>
                <ul className="space-y-2">
                  {cartItems.map((item, idx) => (
                    <li key={idx} className="flex justify-between items-center">
                      <div>
                        <span className="block font-medium">{item.name}</span>
                        <span className="text-sm text-base-content/80">{item.price} ₿</span>
                      </div>
                      <button onClick={() => removeFromCart(idx, classroomId)} className="text-red-500 text-sm">✕</button>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 text-right font-semibold">
                  Total: {cartItems.reduce((sum, item) => sum + (Number(item.price) || 0), 0)} ₿
                </div>
                <Link to={classroomId ? `/classroom/${classroomId}/checkout` : '/checkout'}>
                  <button className="mt-3 w-full btn btn-success">Go to Checkout</button>
                </Link>
              </>
            )}
          </div>
        )}
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Mobile Menu */}
      <div className={`lg:hidden fixed top-0 right-0 h-screen w-80 max-w-[85vw] bg-base-100 border-l border-base-300 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Add a solid overlay to ensure full opacity */}
        <div className="absolute inset-0 bg-base-100 opacity-100"></div>
        
        <div className="relative p-4 bg-base-100 h-full overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-base-content">Menu</h2>
            <button onClick={() => setIsMobileMenuOpen(false)} className="text-base-content/70 hover:text-base-content">
              <X size={24} />
            </button>
          </div>

          {/* Mobile Navigation Links */}
          <nav className="space-y-4">
            {!insideClassroom && (
              <>
                <Link
                  to="/"
                  className={`flex items-center gap-3 p-3 rounded-lg text-base-content ${location.pathname === '/' ? 'bg-primary/10 text-primary' : 'hover:bg-base-200'}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Home size={20} />
                  <span>Home</span>
                </Link>
                {showClassroomsTab && (
                  <Link
                    to="/classrooms"
                    className={`flex items-center gap-3 p-3 rounded-lg text-base-content ${location.pathname === '/classrooms' ? 'bg-primary/10 text-primary' : 'hover:bg-base-200'}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <School size={20} />
                    <span>Classrooms</span>
                  </Link>
                )}
              </>
            )}

            {insideClassroom && (
              <>
                <Link
                  to={`/classroom/${classroomId}`}
                  className={`flex items-center gap-3 p-3 rounded-lg text-base-content ${location.pathname === `/classroom/${classroomId}` ? 'text-green-500' : ''}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <School size={20} />
                  <span>Classroom</span>
                </Link>
                <Link
                  to={`/classroom/${classroomId}/bazaar`}
                  className={`flex items-center gap-3 p-3 rounded-lg text-base-content ${location.pathname.startsWith(`/classroom/${classroomId}/bazaar`) ? 'text-green-500' : ''}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Briefcase size={20} />
                  <span>Bazaar</span>
                </Link>
                <Link
                  to={`/classroom/${classroomId}/groups`}
                  className={`flex items-center gap-3 p-3 rounded-lg text-base-content ${location.pathname.startsWith(`/classroom/${classroomId}/groups`) ? 'text-green-500' : ''}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Users size={20} />
                  <span>Groups</span>
                </Link>
                <Link
                  to={`/classroom/${classroomId}/people`}
                  className={`flex items-center gap-3 p-3 rounded-lg text-base-content ${location.pathname.startsWith(`/classroom/${classroomId}/people`) ? 'text-green-500' : ''}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <UserRound size={20} />
                  <span>People</span>
                </Link>
                <Link
                  to={`/classroom/${classroomId}/leaderboard`}
                  className={`flex items-center gap-3 p-3 rounded-lg text-base-content ${location.pathname.startsWith(`/classroom/${classroomId}/leaderboard`) ? 'text-green-500' : ''}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Trophy size={20} />
                  <span>Leaderboard</span>
                </Link>
                
                {/* ADD: Challenge link for mobile menu */}
                <Link
                  to={`/classroom/${classroomId}/challenge`}
                  className={`flex items-center gap-3 p-3 rounded-lg text-base-content ${location.pathname.startsWith(`/classroom/${classroomId}/challenge`) ? 'text-green-500' : ''}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Shield size={20} />
                  <span>Challenge</span>
                </Link>

                {/* ADDED: Feedback link for mobile/hamburger menu */}
                <Link
                  to={`/classroom/${classroomId}/feedback`}
                  className={`flex items-center gap-3 p-3 rounded-lg text-base-content ${location.pathname === `/classroom/${classroomId}/feedback` ? 'text-green-500' : ''}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Star size={20} />
                  <span>Feedback</span>
                </Link>
                {/* ADMIN: link visible only to admins */}
                {user?.role === 'admin' && (
                  <Link
                    to="/admin/moderation"
                    className={`flex items-center gap-3 p-3 rounded-lg text-base-content ${location.pathname === '/admin/moderation' ? 'text-green-500' : ''}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Settings size={18} />
                    <span>Admin</span>
                  </Link>
                )}
              </>
            )}

            {/* Mobile Profile Section */}
            <div className="border-t border-base-300 pt-4 mt-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full ring ring-success ring-offset-2 overflow-hidden">
                  {(() => {
                    // build avatar src safely and avoid calling .startsWith on null/undefined
                    const getAvatarSrc = (u) => {
                      if (!u) return null;
                      if (u.avatar) {
                        if (typeof u.avatar === 'string' && (u.avatar.startsWith('data:') || u.avatar.startsWith('http'))) return u.avatar;
                        return `${BACKEND_URL}/uploads/${u.avatar}`;
                      }
                      if (u.profileImage) return u.profileImage;
                      return null;
                    };

                    const avatarSrc = getAvatarSrc(user);
                    if (avatarSrc) {
                      return (
                        <img
                          alt="User Avatar"
                          src={avatarSrc}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.onerror = null;
                            if (user.profileImage) {
                              e.target.src = user.profileImage;
                            } else {
                              const initialsDiv = document.createElement('div');
                              initialsDiv.className = 'w-full h-full bg-gray-200 flex items-center justify-center text-lg font-bold text-gray-600';
                              initialsDiv.textContent = `${(user.firstName?.[0] || user.email?.[0] || 'U')}${(user.lastName?.[0] || '')}`.toUpperCase();
                              e.target.parentNode.replaceChild(initialsDiv, e.target);
                            }
                          }}
                        />
                      );
                    }

                    return (
                      <div className="w-full h-full bg-base-300 flex items-center justify-center text-sm font-bold text-base-content/70">
                        {`${(user.firstName?.[0] || user.email?.[0] || 'U')}${(user.lastName?.[0] || '')}`.toUpperCase()}
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <p className="font-medium text-base-content">{user.firstName} {user.lastName}</p>
                  <p className="text-sm text-base-content/70">{user.email}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Link
                  to={`/profile/${user._id}`}
                  className="flex items-center gap-3 p-3 rounded-lg text-base-content hover:bg-base-200"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <User size={20} />
                  <span>Profile</span>
                </Link>
                <Link
                  to="/settings"
                  className="flex items-center gap-3 p-3 rounded-lg text-base-content hover:bg-base-200"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Settings size={20} />
                  <span>Settings</span>
                </Link>
                <Link
                  to="/support"
                  className="flex items-center gap-3 p-3 rounded-lg text-base-content hover:bg-base-200"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <HelpCircle size={20} />
                  <span>Help & Support</span>
                </Link>
                {user.role === 'student' && (
                  <Link
                    to="/orders"
                    className="flex items-center gap-3 p-3 rounded-lg text-base-content hover:bg-base-200"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <History size={20} />
                    <span>Order History</span>
                  </Link>
                )}
                {user.role === 'teacher' && (
                  <button
                    onClick={() => {
                      handleSwitchToStudent();
                      setIsMobileMenuOpen(false);
                    }}
                    className="flex items-center gap-3 p-3 rounded-lg text-base-content hover:bg-base-200 w-full text-left"
                  >
                    <Replace size={20} />
                    <span>Switch to Student Profile</span>
                  </button>
                )}
                {originalUser?.role === 'teacher' && user.role === 'student' && (
                  <button
                    onClick={() => {
                      handleSwitchToTeacher();
                      setIsMobileMenuOpen(false);
                    }}
                    className="flex items-center gap-3 p-3 rounded-lg text-base-content hover:bg-base-200 w-full text-left"
                  >
                    <Replace size={20} />
                    <span>Switch to Teacher Profile</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    logout();
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-3 p-3 rounded-lg text-error hover:bg-error/10 w-full text-left"
                >
                  <LogOut size={20} />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </nav>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;