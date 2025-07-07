import { Link, useLocation } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { useCart } from '../context/CartContext';
import { ShoppingCart } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';


import {
  Home,
  School,
  Briefcase,
  Users,
  User,
  Wallet,
  UserRound,
  Trophy
} from 'lucide-react';

// import defaultProfilePicture from '../assets/Default/Profile-Default-Picture.jpg';

const Navbar = () => {
  const { user, logout, setPersona, originalUser } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();

  const handleSwitchToStudent = () => {
    setPersona({ ...user, role: 'student' });
    const match = location.pathname.match(/^\/classroom\/([^\/]+)/);
    if (match) {
      navigate(`/classroom/${match[1]}/news`);
    } else {
      navigate('/');
    }
  };

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
  const showClassroomsTab = Boolean(
    user?.firstName &&
    user?.lastName &&
    user?.role
  );
  const { theme, toggleTheme } = useContext(ThemeContext);

  const classroomMatch = location.pathname.match(/^\/classroom\/([^\/]+)/);
  const classroomId = classroomMatch ? classroomMatch[1] : null;
  const insideClassroom = Boolean(classroomId);
  const { cartItems, removeFromCart } = useCart();
  const [showCart, setShowCart] = useState(false);
  const cartRef = useRef(null);


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

  return (
    <nav
      data-theme={theme}
      className='fixed top-0 left-0 right-0 z-50 bg-base-100 text-base-content shadow-md px-6 py-4 bg-opacity-20 backdrop-blur-md'
    >
      <div className='container mx-auto flex items-center justify-between flex-wrap'>
        {/* Logo */}
        <div className='text-2xl font-bold'>
          <Link to='/'>Prizeversity</Link>
        </div>

        {/* Main Nav Links */}
        <ul className='flex flex-wrap space-x-4 text-lg mr-5 items-center'>
          {!insideClassroom && (
            <>
              <li>
                <Link
                  to="/"
                  className={`flex items-center gap-2 hover:text-gray-300 ${location.pathname === '/' ? 'text-green-500' : ''}`}
                  title="Home"
                >
                  <Home size={18} />
                  <span className="hidden lg:inline">Home</span>
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
                    <span className="hidden lg:inline">Classrooms</span>
                  </Link>
                </li>
              )}
            </>
          )}

          {insideClassroom && (
            <>
              <li>
                <div className="tooltip tooltip-bottom" data-tip="Classroom">
                  <Link
                    to={`/classroom/${classroomId}`}
                    className={`flex items-center gap-2 hover:text-gray-300 ${location.pathname === `/classroom/${classroomId}` ? 'text-green-500' : ''}`}
                  >
                    <School size={18} />
                    <span className="hidden lg:inline">Classroom</span>
                  </Link>
                </div>
              </li>
              <li>
                <div className="tooltip tooltip-bottom" data-tip="Bazaar">
                  <Link
                    to={`/classroom/${classroomId}/bazaar`}
                    className={`flex items-center gap-2 hover:text-gray-300 ${location.pathname.startsWith(`/classroom/${classroomId}/bazaar`) ? 'text-green-500' : ''}`}
                  >
                    <Briefcase size={18} />
                    <span className="hidden lg:inline">Bazaar</span>
                  </Link>
                </div>
              </li>
              <li>
                <div className="tooltip tooltip-bottom" data-tip="Groups">
                  <Link
                    to={`/classroom/${classroomId}/groups`}
                    className={`flex items-center gap-2 hover:text-gray-300 ${location.pathname.startsWith(`/classroom/${classroomId}/groups`) ? 'text-green-500' : ''}`}
                  >
                    <Users size={18} />
                    <span className="hidden lg:inline">Groups</span>
                  </Link>
                </div>
              </li>
              <li>
                <div className="tooltip tooltip-bottom" data-tip="Wallet">
                  <Link
                    to={`/classroom/${classroomId}/wallet`}
                    className={`flex items-center gap-2 hover:text-gray-300 ${location.pathname.startsWith(`/classroom/${classroomId}/wallet`) ? 'text-green-500' : ''}`}
                  >
                    <Wallet size={18} />
                    <span className="hidden lg:inline">Wallet</span>
                  </Link>
                </div>
              </li>
              <li>
                <div className="tooltip tooltip-bottom" data-tip="People">
                  <Link
                    to={`/classroom/${classroomId}/people`}
                    className={`flex items-center gap-2 hover:text-gray-300 ${location.pathname.startsWith(`/classroom/${classroomId}/people`) ? 'text-green-500' : ''}`}
                  >
                    <UserRound size={18} />
                    <span className="hidden lg:inline">People</span>
                  </Link>
                </div>
              </li>
              <li>
                <div className="tooltip tooltip-bottom" data-tip="Leaderboard">
                  <Link
                    to={`/classroom/${classroomId}/leaderboard`}
                    className={`flex items-center gap-2 hover:text-gray-300 ${location.pathname === '/leaderboard' ? 'text-green-500' : ''}`}
                  >
                    <Trophy size={18} />
                    <span className="hidden lg:inline">Leaderboard</span>
                  </Link>
                </div>
              </li>
            </>
          )}
        </ul>

        {/* Right side: Always visible on all screens */}
        {user && (
          <div className="flex items-center gap-4 shrink-0">
            {user?.role !== 'teacher' && insideClassroom && (
              <>
                {/* Cart Icon */}
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

                {/* Cart Dropdown */}
                {showCart && (
                  <div ref={cartRef} className="fixed top-20 right-4 bg-white border shadow-lg w-80 z-[9999] p-4 rounded text-black">
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
                                <span className="text-sm text-gray-500">{item.price} bits</span>
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
                          Total: {cartItems.reduce((sum, item) => sum + item.price, 0)} bits
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
              </>
            )}

            {/* Profile Avatar */}
            <div className="dropdown dropdown-end">
              <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar">
                <div className="w-10 rounded-full ring ring-success ring-offset-base-100 ring-offset-2">
                  <img
                    alt="User Avatar"
                    src={user?.avatar || '/default-profile.png'}
                  />
                </div>
              </div>
              <ul tabIndex={0} className="mt-3 z-[1] p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-52">
                <li><Link to={`/profile/${user._id}`}>Profile</Link></li>
                <li><Link to="/settings">Settings</Link></li>
                <li><Link to="/support">Help & Support</Link></li>

                {user.role === 'student' && (
                  <li>
                    <Link to="/orders">Order History</Link>
                  </li>
                )}

                {user.role === 'teacher' && (
                  <li>
                    <button onClick={handleSwitchToStudent}>
                      Switch to Student Profile
                    </button>
                  </li>
                )}

                {originalUser?.role === 'teacher' && user.role === 'student' && (
                  <li>
                    <button onClick={handleSwitchToTeacher}>
                      Switch to Teacher Profile
                    </button>
                  </li>
                )}

                <li><button onClick={logout}>Logout</button></li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;