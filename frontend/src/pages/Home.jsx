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
  Search,
  Puzzle,
  Award,
  Compass
} from 'lucide-react';

// Importing images, credits: https://unsplash.com/
import interactiveLearning from '../assets/Education/interactive-learning.jpg'
import academicExcellence from '../assets/Education/academic-excellence.jpg'
import stayInformed from '../assets/Education/notifications.jpg'
import rpgSchoolChars from '../assets/Education/rpg-school-chars.svg';

import './Home.css';

import XPBar from '../components/XPBarComponent.jsx';


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

  // How it works steps
  const howSteps = [
    {
      title: 'Sign up',
      desc: 'Choose Student or Teacher role at signup.',
      icon: <UserPlus size={28} className="text-green-500" />
    },
    {
      title: 'Join a Classroom',
      desc: "Teachers create classrooms and share a join code; students enter the code to join.",
      icon: <School size={28} className="text-indigo-500" />
    },
    {
      title: 'Set up Bazaar & Groups',
      desc: "Teachers configure group sets and stock the classroom Bazaar with items.",
      icon: <Store size={28} className="text-purple-500" />
    },
    {
      title: 'Participate & Earn',
      desc: "Students engage in groups, challenges and activities to earn Bits and stat boosts. Stat boosts increase earnings.",
      icon: <Coins size={28} className="text-yellow-500" />
    },
    {
      title: 'Spend & Redeem',
      desc: "Students can spend their earned Bits in the classroom Bazaar; transactions are logged and teachers can manage redemptions.",
      icon: <Zap size={28} className="text-green-600" />
    }
  ];

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

        {user && role === 'student' && (
          <>
          <XPBar userId={user._id} classroomId={user.currentClassroomId || ''} />
          {/* Temporary XP Testing Buttons */}
          <div style={{ marginTop: '10px', textAlign: 'right', paddingRight: '20px' }}>
            <button
              onClick={handleAddXP}
              style={{
                marginRight: '8px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                padding: '6px 10px',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              +XP Test
            </button>

            <button
              onClick={handleResetXP}
              style={{
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                padding: '6px 10px',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Reset XP
            </button>
          </div>
        </>
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

        {/* MMORPG Character Stats Section */}
        <section className="mb-20 py-16 bg-white">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Gamification Reimagined</h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                PrizeVersity transforms learning into an MMORPG-like experience where students develop their academic character with real stats that impact their classroom journey. It’s a cyclical economy — students boost stats or buy power‑ups to earn bits faster, spend bits to buy advantages or protection, and use shields/attacks strategically to manage risk and reward.
              </p>
            </div>

            <div className="flex flex-col lg:flex-row items-center justify-center gap-12">
              {/* Character Diagram */}
              <div className="relative flex flex-col items-center justify-center min-h-[400px] w-full md:w-[420px]">
                {/* SVG Character Silhouette */}
                <img
                  src={rpgSchoolChars}
                  alt="Student MMORPG Character"
                  className="w-[260px] md:w-[320px] mx-auto drop-shadow-xl"
                  style={{ zIndex: 1 }}
                  draggable={false}
                />

                {/* Stat Lines (SVG overlay for crisp lines) */}
                {/* Floating stat labels (no lines) */}
                <div className="absolute left-0 top-0 w-full h-full pointer-events-none" style={{ zIndex: 2 }}>
                  <div className="stat-label stat-label-bits stat-badge bits">
                    <div className="stat-label-title">Bits</div>
                    <div className="stat-label-sub">Powers the Bazaar</div>
                  </div>

                   <div className="stat-label stat-label-level stat-badge level">
                     <div className="stat-label-title">Level</div>
                     <div className="stat-label-sub">Overall progress &amp; XP</div>
                   </div>
                   
                   <div className="stat-label stat-label-multiplier stat-badge multiplier">
                     <div className="stat-label-title">Multiplier</div>
                     <div className="stat-label-sub">Boosts earnings</div>
                   </div>
                   
                   <div className="stat-label stat-label-luck stat-badge luck">
                     <div className="stat-label-title">Luck</div>
                     <div className="stat-label-sub">Improves reward odds</div>
                   </div>

                   <div className="stat-label stat-label-discount stat-badge discount">
                     <div className="stat-label-title">Discount</div>
                     <div className="stat-label-sub">Reduces bazaar prices</div>
                   </div>

                   <div className="stat-label stat-label-attack stat-badge attack">
                     <div className="stat-label-title">Attack Bonus</div>
                     <div className="stat-label-sub">Manipulation items</div>
                   </div>

                   <div className="stat-label stat-label-shield stat-badge shield">
                     <div className="stat-label-title">Shield</div>
                     <div className="stat-label-sub">Protects against attacks</div>
                   </div>
                </div>
              </div>

              {/* Description */}
              <div className="max-w-lg">
                <h3 className="text-2xl font-bold mb-6">The Academic MMORPG Character</h3>
                <div className="space-y-4">

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-amber-600 text-sm">Ƀ</span>
                    </div>
                    <div>
                      <h4 className="font-semibold">Bits</h4>
                      <p className="text-gray-600 text-sm">
                        The virtual currency that powers the Bazaar — used to redeem rewards or buy gameplay effects.
                      </p>
                      <ul className="list-disc list-inside text-gray-600 text-sm mt-2">
                        <li><strong>Passive</strong>: Redeemable rewards (extra credit, passes, etc.)</li>
                        <li><strong>Effect</strong>: Power‑ups (attacks, swappers, nullifiers, shields, stat boosts)</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-yellow-600 text-sm">⭐</span>
                    </div>
                    <div>
                      <h4 className="font-semibold">Level</h4>
                      <p className="text-gray-600 text-sm">Visual representation of overall progress and experience. <span className="text-purple-600 font-medium">(Coming Soon)</span></p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-green-600 text-sm">✖️</span>
                    </div>
                    <div>
                      <h4 className="font-semibold">Multiplier</h4>
                      <p className="text-gray-600 text-sm">Amplifies the bits earned from participation and achievements.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-purple-600 text-sm">🍀</span>
                    </div>
                    <div>
                      <h4 className="font-semibold">Luck</h4>
                      <p className="text-gray-600 text-sm">Increases chances of better rewards in classroom activities like Mystery Box.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-600 text-sm">🏷️</span>
                    </div>
                    <div>
                      <h4 className="font-semibold">Discount</h4>
                      <p className="text-gray-600 text-sm">Reduces prices in the classroom bazaar, stretching bits further.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-rose-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-rose-600 text-sm">⚔️</span>
                    </div>
                    <div>
                      <h4 className="font-semibold">Attack Bonus</h4>
                      <p className="text-gray-600 text-sm">Bazaar items that let students target others' stats (e.g. swap, nullify) to gain advantage.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-sky-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sky-600 text-sm">🛡️</span>
                    </div>
                    <div>
                      <h4 className="font-semibold">Shield</h4>
                      <p className="text-gray-600 text-sm">Protects against attack effects; shields are stackable and consumed when triggered.</p>
                    </div>
                  </div>
                  
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mb-20 py-16 bg-white">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">How it works</h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                A simple loop for teachers and students — create, join, participate, and redeem.
              </p>
            </div>

            <div className="hidden md:flex items-start justify-between gap-6">
              {howSteps.map((s, i) => (
                <div key={s.title} className="relative flex-1 bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
                  <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-green-50">
                    {s.icon}
                  </div>
                  <h3 className="font-semibold mb-2">{s.title}</h3>
                  <p className="text-sm text-gray-600">{s.desc}</p>

                  {i < howSteps.length - 1 && (
                    <div className="absolute right-[-48px] top-1/2 -translate-y-1/2 hidden md:block">
                      <svg width="48" height="24" viewBox="0 0 48 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M0 12h36" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round" />
                        <path d="M30 6l6 6-6 6" fill="none" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Mobile / stacked */}
            <div className="md:hidden space-y-4">
              {howSteps.map((s) => (
                <div key={s.title} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4 items-start">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center bg-green-50">
                    {s.icon}
                  </div>
                  <div>
                    <h4 className="font-semibold">{s.title}</h4>
                    <p className="text-sm text-gray-600">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
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

        {/* OSINT-inspired Challenges Section (stylized with gradients + micro animations) */}
        <section className="mb-20 py-16 bg-gradient-to-b from-white to-gray-50 osint-section">
          <div className="max-w-6xl mx-auto px-6 relative">
            {/* Decorative top SVG */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-10 pointer-events-none">
              <svg width="360" height="36" viewBox="0 0 360 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 18C60 6 120 30 180 18C240 6 300 30 360 18" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            <div className="text-center mb-8 relative z-20">
              <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-3">OSINT‑inspired Challenges</h2>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                Puzzle-style activities inspired by OSINT that teachers can configure as additional exercises.
                <br />
                Challenges award Bits and/or stat boosts—Multiplier, Luck, Discount—so students level up, earn more, and sharpen critical thinking.
              </p>
            </div>

            {/* Triangle layout: cards at triangle vertices + compass center */}
            <div className="triangle-wrap relative z-10 mx-auto w-full max-w-4xl h-[420px]">
             {/* SVG connector triangle (behind) */}
             <svg className="triangle-lines absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 400" preserveAspectRatio="none" aria-hidden>
               <polyline points="200,40 60,340 340,340 200,40" fill="none" stroke="#e6eef6" strokeWidth="2" strokeDasharray="6 8" strokeLinecap="round" strokeLinejoin="round" />
             </svg>
 
             {/* Center Compass */}
             <div className="triangle-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-full w-28 h-28 flex items-center justify-center shadow-md z-30">
               <Compass className="text-green-500" size={36} />
             </div>
 
             {/* Top Card */}
             <article className="osint-card triangle-card top-card osint-indigo">
               <div className="flex items-start gap-4">
                 <div className="icon-badge" aria-hidden>
                   <Award size={28} />
                 </div>
                 <div>
                   <h3 className="font-semibold mb-1 text-gray-900">Flexible Rewards</h3>
                   <p className="text-sm text-gray-600">
                     Teachers assign Bits and/or stat boosts (Multiplier, Luck, Discount) per challenge — fully composable rewards to shape classroom behavior.
                   </p>
                 </div>
               </div>
               <div className="card-footer">
                 <span className="micro-meta">Customizable per-challenge</span>
                 <span className="pill">Rewards</span>
               </div>
             </article>
 
             {/* Bottom-left Card */}
             <article className="osint-card triangle-card left-card osint-amber">
               <div className="flex items-start gap-4">
                 <div className="icon-badge" aria-hidden>
                   <Puzzle size={28} />
                 </div>
                 <div>
                   <h3 className="font-semibold mb-1 text-gray-900">Customizable Difficulty</h3>
                   <p className="text-sm text-gray-600">
                     From quick one-off riddles to multi-step investigations — determine difficulty, time limits, hints, and retries.
                   </p>
                 </div>
               </div>
               <div className="card-footer">
                 <span className="micro-meta">Hints & retries</span>
                 <span className="pill">Difficulty</span>
               </div>
             </article>
 
             {/* Bottom-right Card */}
             <article className="osint-card triangle-card right-card osint-emerald">
               <div className="flex items-start gap-4">
                 <div className="icon-badge" aria-hidden>
                   <School size={28} />
                 </div>
                 <div>
                   <h3 className="font-semibold mb-1 text-gray-900">Classroom‑First</h3>
                   <p className="text-sm text-gray-600">
                     Built for teachers: moderate, review outcomes, map challenges to curriculum goals, and tie rewards directly into the classroom economy.
                   </p>
                 </div>
               </div>
               <div className="card-footer">
                 <span className="micro-meta">Teacher moderated</span>
                 <span className="pill">Classroom</span>
               </div>
             </article>
           </div>
            {/* end triangle-wrap */}
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
              <Link to="/feedback" className="text-gray-400 hover:text-white transition">Site Feedback</Link>
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