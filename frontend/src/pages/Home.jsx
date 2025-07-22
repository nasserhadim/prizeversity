import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import socket from '../utils/socket';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
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
    if (user?.firstName) setFirstName(user.firstName);
    if (user?.lastName) setLastName(user.lastName);
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
      {!user && (
        <nav className="fixed top-0 left-0 right-0 bg-white shadow z-50 w-full">
          <div className="w-full flex flex-col sm:flex-row justify-between items-center px-4 sm:px-6 py-3 gap-2 sm:gap-0">
            {/* Top Left: Brand */}
            <div className="text-xl font-bold text-black">
              Prizeversity
            </div>

            {/* Top Right: Sign In Buttons */}
            <div className="flex gap-2 sm:gap-4 w-full sm:w-auto justify-center sm:justify-end">
              <button 
                className="px-3 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm rounded-full bg-black text-white hover:bg-gray-800 transition whitespace-nowrap"
                onClick={() => window.location.href = '/api/auth/google'}
              >
                Sign in with Google
              </button>
              <button 
                className="px-3 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm rounded-full bg-black text-white hover:bg-gray-800 transition whitespace-nowrap"
                onClick={() => window.location.href = '/api/auth/microsoft'}
              >
                Sign in with Microsoft
              </button>
            </div>
          </div>
        </nav>
      )}


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
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-12">Why Prizeversity Stands Out</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
              <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                <School className="text-green-500" size={24} />
              </div>
              <h3 className="text-xl font-semibold mb-2">For Educators</h3>
              <p className="text-gray-600">
                Create and manage classrooms with intuitive tools designed to save you time.
              </p>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
              <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                <GraduationCap className="text-green-500" size={24} />
              </div>
              <h3 className="text-xl font-semibold mb-2">For Students</h3>
              <p className="text-gray-600">
                Collaborate with peers and engange in a gamification environment.
              </p>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
              <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                <Bell className="text-green-500" size={24} />
              </div>
              <h3 className="text-xl font-semibold mb-2">Real Time Updates</h3>
              <p className="text-gray-600">
                Be up to date with classroom activities and events.
              </p>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-12 text-center text-white mb-20">
          <h2 className="text-3xl font-bold mb-4">Ready to transform your learning experience?</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Join thousands of educators and students already using Prizeversity.
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
              <a href="#" className="text-gray-400 hover:text-white transition">Privacy</a>
              <a href="#" className="text-gray-400 hover:text-white transition">Terms</a>
              <a href="#" className="text-gray-400 hover:text-white transition">Help</a>
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