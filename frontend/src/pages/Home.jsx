import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import socket from '../utils/socket';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import {
  School,
  UserPlus,
  GraduationCap,
  Bell,
  Pencil,
  BookOpen,
  MessagesSquare,
  LayoutDashboard,
  Clock,
  ShieldCheck,
  ChevronRight,
  BarChart2,
  Coins,
  Store,
  Zap,
} from 'lucide-react';

// Importing images, credits: https://unsplash.com/
import interactiveLearning from '../assets/Education/interactive-learning.jpg'
import academicExcellence from '../assets/Education/academic-excellence.jpg'
import stayInformed from '../assets/Education/notifications.jpg'


const Home = () => {
  const { user, logout, setUser } = useAuth();
  const [role, setRole] = useState(user?.role || '');
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [profileComplete, setProfileComplete] = useState(!!(user?.firstName && user?.lastName));

  const [carouselGroup, setCarouselGroup] = useState('education');
  const scrollRef = useRef(null);

  const navigate = useNavigate();

  // for the carousel
  const carouselContent = {
    education: [
      {
        image: interactiveLearning,
        title: "Interactive Learning",
        description: "Engage with course material like never before"
      },
      {
        image: academicExcellence,
        title: "Academic Excellence",
        description: "Tools designed to help you succeed"
      },
      {
        image: stayInformed,
        title: "Stay Informed",
        description: "Real-time notifications keep you updated"
      }
    ],
    // workflow: [
    //   {
    //     image: "/images/easy-onboarding.jpg",
    //     title: "Easy Onboarding",
    //     description: "Join classrooms in seconds"
    //   },
    //   {
    //     image: "/images/seamless-editing.jpg",
    //     title: "Seamless Editing",
    //     description: "Create and edit content effortlessly"
    //   },
    //   {
    //     image: "/images/organized-materials.jpg",
    //     title: "Organized Materials",
    //     description: "All your resources in one place"
    //   },
    //   {
    //     image: "/images/collaborative-discussions.jpg",
    //     title: "Collaborative Discussions",
    //     description: "Learn together with peers"
    //   }
    // ],
    // features: [
    //   {
    //     image: "/images/clean-interface.jpg",
    //     title: "Clean Interface",
    //     description: "Intuitive design for all users"
    //   },
    //   {
    //     image: "/images/time-saving.jpg",
    //     title: "Time-Saving",
    //     description: "Focus on learning, not navigation"
    //   },
    //   {
    //     image: "/images/secure-platform.jpg",
    //     title: "Secure Platform",
    //     description: "Your data is always protected"
    //   }
    // ]
  };

  // Sync firstName and lastName state when user changes
  useEffect(() => {
    if (user) {
      // Use existing names if available, otherwise use OAuth names, otherwise empty
      setFirstName(user.firstName || user.oauthFirstName || '');
      setLastName(user.lastName || user.oauthLastName || '');
    }
  }, [user]);

  // Sync role and check profile completeness when user changes
  useEffect(() => {
    if (user) {
      if (user.role) setRole(user.role);
      if (user.firstName && user.lastName) setProfileComplete(true);
    }
  }, [user]);

  // On mount, check URL params for 'session_expired' and show toast if found
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('session_expired')) {
      toast.error('Your session has expired. Please sign in again.');
      window.history.replaceState({}, '', '/');
    }
  }, []);

  // Handler to submit user role and profile update
  const handleRoleAndProfileSubmit = async () => {
    if (!role || !firstName.trim() || !lastName.trim()) {
      toast.error('Please select your role and enter your full name.');
      return;
    }

    try {
      // POST updated profile info to backend
      const response = await axios.post('/api/users/update-profile', {
        role,
        firstName,
        lastName,
      });
      // Update user context/state with returned user data
      setUser(response.data.user);
      setProfileComplete(true);
      
    } catch (error) {
      console.error('Failed to update profile', error);
      toast.error('Could not update your profile.');
    }
  };

  // Setup socket listeners for classroom updates and notifications
  useEffect(() => {
    socket.on('classroom_update', (updatedClassroom) => {
      setClassrooms((prev) =>
        prev.map((classroom) =>
          classroom._id === updatedClassroom._id ? updatedClassroom : classroom
        )
      );
    });

    socket.on('notification', (notification) => {
      if (
        ['classroom_update', 'classroom_removal', 'classroom_deletion'].includes(notification.type)
      ) {
        fetchClassrooms();
      }
    });

    return () => {
      socket.off('classroom_update');
      socket.off('notification');
    };
  }, []);

  // Carousel animation,  horizontal scrolling animation with pause on hover
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let scrollAmount = 0;
    const scrollStep = 0.2;
    const scrollMax = el.scrollWidth / 2;

    let rafId;
    let isPaused = false;

    const scrollLoop = () => {
      if (!isPaused) {
        scrollAmount += scrollStep;
        if (scrollAmount >= scrollMax) scrollAmount = 0;
        el.scrollLeft = scrollAmount;
      }
      rafId = requestAnimationFrame(scrollLoop);
    };

    // Start animation
    rafId = requestAnimationFrame(scrollLoop);

    // Event listeners for pause on hover
    const handleMouseEnter = () => {
      isPaused = true;
    };
    const handleMouseLeave = () => {
      isPaused = false;
    };

    el.addEventListener('mouseenter', handleMouseEnter);
    el.addEventListener('mouseleave', handleMouseLeave);

    // Cleanup
    return () => {
      cancelAnimationFrame(rafId);
      el.removeEventListener('mouseenter', handleMouseEnter);
      el.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [carouselGroup]);

  // Render carousel items duplicated for infinite scrolling effect
  const renderCarouselItems = () => {
    const items = carouselContent[carouselGroup];
    const allItems = [...items, ...items]; // duplicate for infinite scroll

    return allItems.map((item, idx) => (
      <div
        key={idx}
        className="flex flex-col items-center justify-between w-[300px] sm:w-[350px] md:w-[400px] h-auto min-h-[400px] sm:min-h-[450px] bg-white rounded-2xl shadow-sm flex-shrink-0 mx-2 sm:mx-4 p-4 sm:p-6 border border-gray-100 hover:shadow-md transition-all"
      >
        <div className="w-full h-[200px] sm:h-[250px] md:h-[300px] overflow-hidden rounded-lg mb-4 sm:mb-6">
          <img
            src={item.image}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1 flex flex-col justify-center">
          <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2 text-center">
            {item.title}
          </h3>
          <p className="text-gray-600 text-center text-sm sm:text-base">
            {item.description}
          </p>
        </div>
      </div>
    ));
  };

  //  Will navigate to the clasroom the user clicks
  const handleCardClick = () => {
    navigate(`/classrooms`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar is rendered globally in App.jsx; remove the local nav to avoid duplication */}

      {/* Hero Section */}
      <div className="bg-black text-white pt-20 pb-32">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h1 className="text-5xl font-bold mb-6">Prizeversity</h1>
          <p className="text-2xl text-gray-300 max-w-2xl mx-auto">
            The future of collaborative learning. Simple. Powerful. Beautiful.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 -mt-20">
        {/* Welcome Message */}
        {user && firstName && lastName && (
          <div className="bg-white rounded-xl shadow-md p-6 mb-10 text-center">
            <h2 className="text-2xl font-semibold">Welcome, {firstName} {lastName}!</h2>
            <p className="text-gray-600 mt-2">
              {role === 'teacher' 
                ? 'Ready to create your next classroom?' 
                : 'Ready to join your next learning adventure?'}
            </p>
          </div>
        )}

        {/* Profile Completion (if needed) */}
        {user && (!profileComplete || !role) && (
          <section className="bg-white rounded-xl shadow-md p-8 mb-20 max-w-2xl mx-auto">
            <h2 className="text-2xl font-semibold mb-6 text-center">Complete Your Profile</h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-3">I am a:</h3>
                <div className="flex justify-center gap-4">
                  <button 
                    className={`px-6 py-3 rounded-full ${role === 'teacher' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-800'} transition`}
                    onClick={() => setRole('teacher')}
                  >
                    Teacher
                  </button>
                  <button 
                    className={`px-6 py-3 rounded-full ${role === 'student' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-800'} transition`}
                    onClick={() => setRole('student')}
                  >
                    Student
                  </button>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    type="text" 
                    placeholder="First Name" 
                    value={firstName} 
                    onChange={(e) => setFirstName(e.target.value)} 
                  />
                  {user?.oauthFirstName && !user?.firstName && (
                    <p className="text-xs text-gray-500 mt-1">Pre-filled from your account</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    type="text" 
                    placeholder="Last Name" 
                    value={lastName} 
                    onChange={(e) => setLastName(e.target.value)} 
                  />
                  {user?.oauthLastName && !user?.lastName && (
                    <p className="text-xs text-gray-500 mt-1">Pre-filled from your account</p>
                  )}
                </div>
              </div>
              
              <button 
                className="w-full py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-medium"
                onClick={handleRoleAndProfileSubmit}
              >
                Continue
              </button>
            </div>
          </section>
        )}

        {/* Carousel Section */}
        <section className="mb-20">
          <div className="flex justify-center mb-8">
            <div className="inline-flex rounded-full bg-gray-200 p-1">
              {Object.keys(carouselContent).map((group) => (
                <button
                  key={group}
                  onClick={() => setCarouselGroup(group)}
                  className={`px-4 py-2 text-sm rounded-full transition ${carouselGroup === group ? 'bg-white shadow text-black' : 'text-gray-600 hover:text-black'}`}
                >
                  {group.charAt(0).toUpperCase() + group.slice(1)}
                </button>
              ))}
            </div>
          </div>
          
        <div 
          ref={scrollRef} 
          className="relative flex overflow-x-auto scrollbar-hide py-4 px-2 sm:px-4"
          style={{
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {renderCarouselItems()}
        </div>
        </section>

        {/* Value Proposition */}
        <section className="mb-20 py-16">
          <div className="text-center mb-4">
            <h2 className="text-3xl font-bold text-gray-900">Why Prizeversity Stands Out</h2>
            <p className="text-xl text-gray-600 mt-2">A Gamified Ecosystem Unlike Any Other</p>
          </div>
          <p className="text-center text-gray-600 max-w-3xl mx-auto mb-12">
            At its core, Prizeversity introduces a unique gameplay loop where stats, virtual currency, and rewards are interconnected, creating a continuous cycle of motivation for students and a powerful engagement tool for teachers.
          </p>
          
          {/* The Loop Layout */}
          <div className="max-w-4xl mx-auto mt-12">
            {/* Mobile Layout: Vertical Stack */}
            <div className="md:hidden space-y-8 px-4">
              {/* Step 1 */}
              <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"><BarChart2 className="text-blue-500" size={24} /></div>
                  <div>
                    <h3 className="text-xl font-semibold mb-1">1. Boost Stats</h3>
                    <p className="text-gray-600 text-sm">Teachers empower students to boost key stats like Multiplier and Luck. Students improve these stats through various classroom activities, gaining a competitive edge.</p>
                  </div>
                </div>
              </div>
              {/* Step 2 */}
              <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="bg-yellow-100 w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"><Coins className="text-yellow-500" size={24} /></div>
                  <div>
                    <h3 className="text-xl font-semibold mb-1">2. Earn "Bits"</h3>
                    <p className="text-gray-600 text-sm">Higher stats help students earn virtual currency ("Bits") faster. Teachers control the classroom economy to incentivize participation.</p>
                  </div>
                </div>
              </div>
              {/* Step 3 */}
              <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="bg-purple-100 w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"><Store className="text-purple-500" size={24} /></div>
                  <div>
                    <h3 className="text-xl font-semibold mb-1">3. Shop the Bazaar</h3>
                    <p className="text-gray-600 text-sm">Students spend Bits on unique items. Teachers create a custom Bazaar with perks like deadline extensions or bonus points.</p>
                  </div>
                </div>
              </div>
              {/* Step 4 */}
              <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"><Zap className="text-green-500" size={24} /></div>
                  <div>
                    <h3 className="text-xl font-semibold mb-1">4. Power-Up & Repeat</h3>
                    <p className="text-gray-600 text-sm">New items and abilities create a fun, continuous loop that keeps students engaged and motivated in the course material.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop Layout: Circular */}
            <div className="hidden md:block relative h-[500px]">
              {/* Central Text */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-center">
                <div className="bg-gray-100 rounded-full w-48 h-48 flex items-center justify-center flex-col p-4 shadow-inner">
                  <Zap className="text-green-500 mb-2" size={32} />
                  <h3 className="font-bold text-xl">The Engagement Loop</h3>
                </div>
              </div>

              {/* Arrows SVG */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 500 500">
                <defs>
                  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#d1d5db" />
                  </marker>
                </defs>
                <path d="M 330,85 A 165,165 0 0,1 415,170" stroke="#d1d5db" strokeWidth="2" fill="none" strokeDasharray="5,5" markerEnd="url(#arrowhead)" />
                <path d="M 415,330 A 165,165 0 0,1 330,415" stroke="#d1d5db" strokeWidth="2" fill="none" strokeDasharray="5,5" markerEnd="url(#arrowhead)" />
                <path d="M 170,415 A 165,165 0 0,1 85,330" stroke="#d1d5db" strokeWidth="2" fill="none" strokeDasharray="5,5" markerEnd="url(#arrowhead)" />
                <path d="M 85,170 A 165,165 0 0,1 170,85" stroke="#d1d5db" strokeWidth="2" fill="none" strokeDasharray="5,5" markerEnd="url(#arrowhead)" />
              </svg>

              {/* Step 1: Boost Stats (Top) */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64">
                <div className="bg-white p-4 rounded-xl shadow-md border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"><BarChart2 className="text-blue-500" size={20} /></div>
                    <div>
                      <h3 className="font-semibold">1. Boost Stats</h3>
                      <p className="text-gray-600 text-xs">Teachers empower students to boost stats like Multiplier & Luck for a competitive edge.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: Earn Bits (Right) */}
              <div className="absolute top-1/2 right-0 -translate-y-1/2 w-64">
                <div className="bg-white p-4 rounded-xl shadow-md border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="bg-yellow-100 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"><Coins className="text-yellow-500" size={20} /></div>
                    <div>
                      <h3 className="font-semibold">2. Earn "Bits"</h3>
                      <p className="text-gray-600 text-xs">Students earn currency faster, driven by a teacher-controlled economy.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3: Shop the Bazaar (Bottom) */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64">
                <div className="bg-white p-4 rounded-xl shadow-md border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-100 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"><Store className="text-purple-500" size={20} /></div>
                    <div>
                      <h3 className="font-semibold">3. Shop the Bazaar</h3>
                      <p className="text-gray-600 text-xs">Teachers stock a custom Bazaar; students spend Bits on unique perks.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 4: Power-Up (Left) */}
              <div className="absolute top-1/2 left-0 -translate-y-1/2 w-64">
                <div className="bg-white p-4 rounded-xl shadow-md border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-100 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"><Zap className="text-green-500" size={20} /></div>
                    <div>
                      <h3 className="font-semibold">4. Power-Up & Repeat</h3>
                      <p className="text-gray-600 text-xs">The cycle creates a fun, continuous loop that keeps students motivated.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-12 text-center text-white mb-20">
          <h2 className="text-3xl font-bold mb-4">Ready to transform your learning experience?</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Already making a difference in the classroom—try Prizeversity today.
          </p>
          {!user ? (
            <div className="flex justify-center gap-4">
              <button 
                className="px-6 py-3 bg-white text-green-600 rounded-full font-medium hover:bg-gray-100 transition"
                onClick={() => window.location.href = '/api/auth/google'}
              >
                Sign in with Google
              </button>
              <button 
                className="px-6 py-3 bg-black text-white rounded-full font-medium hover:bg-gray-800 transition"
                onClick={() => window.location.href = '/api/auth/microsoft'}
              >
                Sign in with Microsoft
              </button>
            </div>
          ) : (
            <button 
              className="px-6 py-3 bg-white text-green-600 rounded-full font-medium hover:bg-gray-100 transition"
              onClick={handleCardClick}
            >
              Engage with your classes
            </button>
          )}
        </section>
      </div>

      {/* Footer */}
      <footer className="bg-black text-white py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-6 md:mb-0">
              <h2 className="text-2xl font-bold">Prizeversity</h2>
              <p className="text-gray-400 mt-2">Collaborative learning reimagined</p>
            </div>
            <div className="flex space-x-6">
              <Link to="/privacy" className="text-gray-400 hover:text-white transition">Privacy</Link>
              <Link to="/terms" className="text-gray-400 hover:text-white transition">Terms</Link>
              <Link to="/support" className="text-gray-400 hover:text-white transition">Help</Link>
              <Link to="/feedback" className="text-gray-400 hover:text-white transition">Feedback</Link>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>© {new Date().getFullYear()} Prizeversity. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;