import { Link, useLocation } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { useCart } from '../context/CartContext';
import { ShoppingCart, Menu, X, Sun, Moon } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import NotificationBell from './NotificationBell';
import Logo from './Logo'; // Import the new Logo component
import { API_BASE } from '../config/api';
import socket from '../utils/socket';
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
  History
} from 'lucide-react';

const BACKEND_URL = `${API_BASE}`;

const Navbar = () => {
  const { user, logout, setPersona, originalUser } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef(null);

  // Handle switching from teacher to student view
  const handleSwitchToStudent = () => {
    setPersona({ ...user, role: 'student' });
    const match = location.pathname.match(/^\/classroom\/([^\/]+)/);
    if (match) {
      navigate(`/classroom/${match[1]}/news`);
    } else {
      navigate('/');
    }
  };

  // Handle switching from student back to original teacher
  const handleSwitchToTeacher = () => {
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
  const { theme, toggleTheme } = useContext(ThemeContext);

  // Extract classroom ID from URL path
  const classroomMatch = location.pathname.match(/^\/classroom\/([^\/]+)/);
  const classroomId = classroomMatch ? classroomMatch[1] : null;
  const insideClassroom = Boolean(classroomId);
  const { cartItems, removeFromCart } = useCart();
  const [showCart, setShowCart] = useState(false);
  const cartRef = useRef(null);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    const fetchBalance = async () => {
      if (user?._id) {
        try {
          const { data } = await axios.get(`/api/wallet/${user._id}/balance`, { withCredentials: true });
          setBalance(data.balance);
        } catch (error) {
          console.error("Failed to fetch balance for navbar", error);
        }
      }
    };

    fetchBalance();

    if (user?._id) {
      const balanceUpdateHandler = (data) => {
        if (data.studentId === user._id) {
          setBalance(data.newBalance);
        }
      };
      
      socket.on('balance_update', balanceUpdateHandler);

      return () => {
        socket.off('balance_update', balanceUpdateHandler);
      };
    }
  }, [user]);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Hook to close cart dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
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

  return (
    <nav
      data-theme={theme}
      className='fixed top-0 left-0 right-0 z-50 bg-base-100 text-base-content shadow-md px-4 lg:px-6 py-4 bg-opacity-20 backdrop-blur-md'
    >
      <div className='container mx-auto flex items-center justify-between'>
        {/* Logo */}
        <Logo />

        {/* Mobile Menu Button */}
        <div className="lg:hidden flex items-center gap-2">
          {/* Wallet Balance for Mobile */}
          {insideClassroom && (
            <Link to={`/classroom/${classroomId}/wallet`} className="flex items-center gap-1 text-sm p-1 rounded-md hover:bg-base-200">
              <Wallet size={20} className="text-green-500" />
              <span className="font-semibold">Ƀ{balance}</span>
            </Link>
          )}
          {/* Cart Icon for Mobile (if in classroom and not teacher) */}
          {user?.role !== 'teacher' && insideClassroom && (
            <button
              className="relative"
              onClick={() => setShowCart(!showCart)}
              title="Cart"
            >
              <ShoppingCart size={20} className="text-green-500" />
              {cartItems.length > 0 && (
                <span className="absolute -top-1 -right-2 bg-red-500 text-white rounded-full text-xs w-4 h-4 flex items-center justify-center">
                  {cartItems.length}
                </span>
              )}
            </button>
          )}

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
                  className={`flex items-center gap-2 hover:text-gray-300 ${location.pathname === '/' ? 'text-green-500' : ''}`}
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
                    className={`flex items-center gap-2 hover:text-gray-300 ${location.pathname === '/classrooms' ? 'text-green-500' : ''}`}
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
                  className={`flex items-center gap-2 hover:text-gray-300 ${location.pathname === `/classroom/${classroomId}` ? 'text-green-500' : ''}`}
                >
                  <School size={18} />
                  <span>Classroom</span>
                </Link>
              </li>
              <li>
                <Link
                  to={`/classroom/${classroomId}/bazaar`}
                  className={`flex items-center gap-2 hover:text-gray-300 ${location.pathname.startsWith(`/classroom/${classroomId}/bazaar`) ? 'text-green-500' : ''}`}
                >
                  <Briefcase size={18} />
                  <span>Bazaar</span>
                </Link>
              </li>
              <li>
                <Link
                  to={`/classroom/${classroomId}/groups`}
                  className={`flex items-center gap-2 hover:text-gray-300 ${location.pathname.startsWith(`/classroom/${classroomId}/groups`) ? 'text-green-500' : ''}`}
                >
                  <Users size={18} />
                  <span>Groups</span>
                </Link>
              </li>
              <li>
                <Link
                  to={`/classroom/${classroomId}/people`}
                  className={`flex items-center gap-2 hover:text-gray-300 ${location.pathname.startsWith(`/classroom/${classroomId}/people`) ? 'text-green-500' : ''}`}
                >
                  <UserRound size={18} />
                  <span>People</span>
                </Link>
              </li>
              <li>
                <Link
                  to={`/classroom/${classroomId}/leaderboard`}
                  className={`flex items-center gap-2 hover:text-gray-300 ${location.pathname === '/leaderboard' ? 'text-green-500' : ''}`}
                >
                  <Trophy size={18} />
                  <span>Leaderboard</span>
                </Link>
              </li>
              <li>
                <div className="tooltip tooltip-bottom" data-tip="Challenge">
                  <Link
                    to={`/classroom/${classroomId}/challenge`}
                    className={`flex items-center gap-2 hover:text-gray-300 ${location.pathname.startsWith(`/classroom/${classroomId}/challenge`) ? 'text-green-500' : ''}`}
                  >
                    <Shield size={18} />
                    <span className="hidden lg:inline">Challenge</span>
                  </Link>
                </div>
              </li>
            </>
          )}
        </ul>

        {/* Desktop Right Side */}
        <div className="hidden lg:flex items-center gap-4">
          {/* Theme toggle (desktop) */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
            className="btn btn-ghost btn-circle"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

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
            >
              <ShoppingCart size={24} className="text-green-500" />
              {cartItems.length > 0 && (
                <span className="absolute -top-1 -right-2 bg-red-500 text-white rounded-full text-xs w-5 h-5 flex items-center justify-center">
                  {cartItems.length}
                </span>
              )}
            </button>
          )}

          {/* Desktop Notification Bell */}
          <NotificationBell />

          {/* Desktop Profile Dropdown */}
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar">
              <div className="w-10 h-10 rounded-full ring ring-success ring-offset-base-100 ring-offset-2 overflow-hidden">
                {user.avatar ? (
                  <img
                    alt="User Avatar"
                    src={user.avatar.startsWith('data:') ? user.avatar : (user.avatar.startsWith('http') ? user.avatar : `${BACKEND_URL}/uploads/${user.avatar}`)}
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
                ) : user.profileImage ? (
                  <img
                    alt="Profile Image"
                    src={user.profileImage}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.onerror = null;
                      const initialsDiv = document.createElement('div');
                      initialsDiv.className = 'w-full h-full bg-gray-200 flex items-center justify-center text-lg font-bold text-gray-600';
                      initialsDiv.textContent = `${(user.firstName?.[0] || user.email?.[0] || 'U')}${(user.lastName?.[0] || '')}`.toUpperCase();
                      e.target.parentNode.replaceChild(initialsDiv, e.target);
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center text-lg font-bold text-gray-600">
                    {`${(user.firstName?.[0] || user.email?.[0] || 'U')}${(user.lastName?.[0] || '')}`.toUpperCase()}
                  </div>
                )}
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
          <div ref={cartRef} className="fixed top-20 right-4 bg-white border shadow-lg w-80 max-w-[calc(100vw-2rem)] z-[9999] p-4 rounded text-black">
            <h3 className="text-lg font-bold mb-2">Your Cart</h3>
            {cartItems.length === 0 ? (
              <p className="text-sm text-gray-500">Cart is empty</p>
            ) : (
              <>
                <ul className="space-y-2">
                  {cartItems.map(item => (
                    <li key={item._id} className="flex justify-between items-center">
                      <div>
                        <span className="block font-medium">{item.name}</span>
                        <span className="text-sm text-gray-500">{item.price} ₿</span>
                      </div>
                      <button
                        onClick={() => removeFromCart(item._id)}
                        className="text-red-500 text-sm ml-4"
                        title="Remove item"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 text-right font-semibold">
                  Total: {cartItems.reduce((sum, item) => sum + item.price, 0)} ₿
                </div>
                <Link to="/checkout">
                  <button className="mt-3 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
                    Go to Checkout
                  </button>
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
                  className={`flex items-center gap-3 p-3 rounded-lg text-base-content ${location.pathname === `/classroom/${classroomId}` ? 'bg-primary/10 text-primary' : 'hover:bg-base-200'}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <School size={20} />
                  <span>Classroom</span>
                </Link>
                <Link
                  to={`/classroom/${classroomId}/bazaar`}
                  className={`flex items-center gap-3 p-3 rounded-lg text-base-content ${location.pathname.startsWith(`/classroom/${classroomId}/bazaar`) ? 'bg-primary/10 text-primary' : 'hover:bg-base-200'}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Briefcase size={20} />
                  <span>Bazaar</span>
                </Link>
                <Link
                  to={`/classroom/${classroomId}/groups`}
                  className={`flex items-center gap-3 p-3 rounded-lg text-base-content ${location.pathname.startsWith(`/classroom/${classroomId}/groups`) ? 'bg-primary/10 text-primary' : 'hover:bg-base-200'}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Users size={20} />
                  <span>Groups</span>
                </Link>
                <Link
                  to={`/classroom/${classroomId}/people`}
                  className={`flex items-center gap-3 p-3 rounded-lg text-base-content ${location.pathname.startsWith(`/classroom/${classroomId}/people`) ? 'bg-primary/10 text-primary' : 'hover:bg-base-200'}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <UserRound size={20} />
                  <span>People</span>
                </Link>
                <Link
                  to={`/classroom/${classroomId}/leaderboard`}
                  className={`flex items-center gap-3 p-3 rounded-lg text-base-content ${location.pathname === '/leaderboard' ? 'bg-primary/10 text-primary' : 'hover:bg-base-200'}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Trophy size={20} />
                  <span>Leaderboard</span>
                </Link>
              </>
            )}

            {/* Mobile Profile Section */}
            <div className="border-t border-base-300 pt-4 mt-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full ring ring-success ring-offset-2 overflow-hidden">
                  {user.avatar ? (
                    <img
                      alt="User Avatar"
                      src={user.avatar.startsWith('data:') ? user.avatar : (user.avatar.startsWith('http') ? user.avatar : `${BACKEND_URL}/uploads/${user.avatar}`)}
                      className="w-full h-full object-cover"
                    />
                  ) : user.profileImage ? (
                    <img
                      alt="Profile Image"
                      src={user.profileImage}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-base-300 flex items-center justify-center text-sm font-bold text-base-content/70">
                      {`${(user.firstName?.[0] || user.email?.[0] || 'U')}${(user.lastName?.[0] || '')}`.toUpperCase()}
                    </div>
                  )}
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
                {/* Theme toggle (mobile) */}
                <button
                  onClick={() => {
                    toggleTheme();
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-3 p-3 rounded-lg text-base-content hover:bg-base-200 w-full text-left"
                  title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                  <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                </button>
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
