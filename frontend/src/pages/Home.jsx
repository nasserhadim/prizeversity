import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import socket from '../utils/socket';
import Navbar from '../components/Navbar';

import toast from 'react-hot-toast';
import { School, UserPlus, GraduationCap, Bell, Pencil, BookOpen, MessagesSquare, LayoutDashboard, Clock, ShieldCheck } from 'lucide-react';

const Home = () => {
  const { user, logout, setUser } = useAuth();
  const [role, setRole] = useState(user?.role || '');
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [profileComplete, setProfileComplete] = useState(!!(user?.firstName && user?.lastName));
  const [classrooms, setClassrooms] = useState([]);
  const [classroomName, setClassroomName] = useState('');
  const [classroomCode, setClassroomCode] = useState('');
  const [joinClassroomCode, setJoinClassroomCode] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      if (user.role) setRole(user.role);
      if (user.firstName && user.lastName) setProfileComplete(true);
    }
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('session_expired')) {
      alert('Your session has expired. Please sign in again.');
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const fetchClassrooms = async () => {
    try {
      const endpoint = role === 'teacher' ? '/api/classroom' : '/api/classroom/student';
      const response = await axios.get(endpoint);
      setClassrooms(response.data);
    } catch (error) {
      console.error('Failed to fetch classrooms', error);
    }
  };

  useEffect(() => {
    if (role && profileComplete) {
      fetchClassrooms();
    }
  }, [role, profileComplete]);

  const handleRoleAndProfileSubmit = async () => {
    if (!role || !firstName.trim() || !lastName.trim()) {
      toast.error('Please select your role and enter your full name.');
      return;
    }

    try {
      const response = await axios.post('/api/users/update-profile', {
        role,
        firstName,
        lastName,
      });
      setUser(response.data.user);
      setProfileComplete(true);
    } catch (error) {
      console.error('Failed to update profile', error);
      toast.error('Could not update your profile.');
    }
  };

  const handleCreateClassroom = async () => {
    try {
      if (!classroomName.trim() || !classroomCode.trim()) {
        alert('Classroom name and code are required');
        return;
      }

      const response = await axios.post('/api/classroom/create', {
        name: classroomName,
        code: classroomCode,
      });

      alert('Classroom created successfully!');
      setClassroomName('');
      setClassroomCode('');
      fetchClassrooms();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to create classroom');
    }
  };

  const handleJoinClassroom = async () => {
    try {
      if (!joinClassroomCode.trim()) {
        alert('Please enter a classroom code');
        return;
      }

      const response = await axios.post('/api/classroom/join', { code: joinClassroomCode });
      alert('Joined classroom successfully!');
      setJoinClassroomCode('');
      fetchClassrooms();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to join classroom');
    }
  };

  const handleCardClick = (classroomId) => {
    navigate(`/classroom/${classroomId}`);
  };

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

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-center text-green-500">
        Welcome to Prizeversity
      </h1>

      <p className='text-center text-gray-600 max-w-2xl mx-auto mt-4'>
        <strong>Prizeversity</strong> is a collaborative learning platform that brings teachers and students together. Teachers can create and manage classrooms, post materials, and track progress, while students can join classrooms, participate in group discussions, and receive feedback all in one seamless experience.
      </p>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
        <div className="p-6 border rounded-2xl shadow bg-white">
          <School className="mx-auto h-8 w-8 text-green-500" />
          <h3 className="font-semibold text-lg mb-1">For Teachers</h3>
          <p className="text-sm text-gray-600">
            Create and manage classrooms, organize groups, and post announcements.
          </p>
        </div>

        <div className="p-6 border rounded-2xl shadow bg-white">
          <GraduationCap className="mx-auto h-8 w-8 text-green-500" />
          <h3 className="font-semibold text-lg mb-1">For Students</h3>
          <p className="text-sm text-gray-600">
            Join classrooms, collaborate with peers, and track assignments.
          </p>
        </div>

        <div className="p-6 border rounded-2xl shadow bg-white">
          <Bell className="mx-auto h-8 w-8 text-green-500" />
          <h3 className="font-semibold text-lg mb-1">Real-Time Updates</h3>
          <p className="text-sm text-gray-600">
            Stay informed with instant classroom notifications and updates.
          </p>
        </div>
      </div>

      <div className="mt-10 space-y-4">
        <h2 className="text-xl font-bold text-center">How Prizeversity Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
          <div>
            <UserPlus className="mx-auto h-8 w-8 text-green-500" />
            <p className="font-semibold mt-2">Sign Up</p>
            <p className="text-sm text-gray-600">Login using Google or Microsoft.</p>
          </div>
          <div>
            <Pencil className="mx-auto h-8 w-8 text-green-500" />
            <p className="font-semibold mt-2">Complete Profile</p>
            <p className="text-sm text-gray-600">Choose your role and enter your name.</p>
          </div>
          <div>
            <BookOpen className="mx-auto h-8 w-8 text-green-500" />
            <p className="font-semibold mt-2">Create or Join Classrooms</p>
            <p className="text-sm text-gray-600">Teachers create. Students join.</p>
          </div>
          <div>
            <MessagesSquare className="mx-auto h-8 w-8 text-green-500" />
            <p className="font-semibold mt-2">Collaborate</p>
            <p className="text-sm text-gray-600">Engage in groups, discussions, and tasks.</p>
          </div>
        </div>
      </div>

      <h2 className="text-xl font-bold text-center mt-10">Why Use Prizeversity?</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
        <div className="p-4 rounded-xl shadow bg-white">
          <LayoutDashboard className="mx-auto h-8 w-8 text-green-500" />
          <h4 className="font-semibold">Simple Dashboard</h4>
          <p className="text-sm text-gray-600">Navigate classrooms and groups easily.</p>
        </div>
        <div className="p-4 rounded-xl shadow bg-white">
          <Clock className="mx-auto h-8 w-8 text-green-500" />
          <h4 className="font-semibold">Real-time Updates</h4>
          <p className="text-sm text-gray-600">Get notified instantly on changes.</p>
        </div>
        <div className="p-4 rounded-xl shadow bg-white">
          <ShieldCheck className="mx-auto h-8 w-8 text-green-500" />
          <h4 className="font-semibold">Secure & Private</h4>
          <p className="text-sm text-gray-600">Backed by authentication and data protection.</p>
        </div>
      </div>



      {!user ? (
        <div className="text-center space-y-4">
          <button className="btn btn-primary w-full max-w-xs" onClick={() => window.location.href = '/api/auth/google'}>
            Login with Google
          </button>
          <button className="btn btn-secondary w-full max-w-xs" onClick={() => window.location.href = '/api/auth/microsoft'}>
            Login with Microsoft
          </button>
        </div>
      ) : !profileComplete || !role ? (
        <div className="space-y-6 text-center">
          <p className="text-lg">Please tell us more about you before continuing:</p>

          <div className="flex justify-center gap-4">
            <button
              className={`btn ${role === 'teacher' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setRole('teacher')}
            >
              Teacher
            </button>
            <button
              className={`btn ${role === 'student' ? 'btn-secondary' : 'btn-outline'}`}
              onClick={() => setRole('student')}
            >
              Student
            </button>
          </div>

          <div className="space-y-2">
            <input
              className="input input-bordered w-full max-w-xs"
              type="text"
              placeholder="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <input
              className="input input-bordered w-full max-w-xs"
              type="text"
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>

          <button
            className="btn btn-success mt-2"
            onClick={handleRoleAndProfileSubmit}
          >
            Save & Continue
          </button>
        </div>
      ) : (
        <>
          <p className="text-lg text-center">
            Welcome, <span className="font-semibold">{user.firstName} {user.lastName}</span>
          </p>

          <div className="text-center mt-6">
            <p>Use the “Classrooms” menu to access your dashboard.</p>
          </div>

          <div className="text-right">
            <button className="btn btn-outline btn-error" onClick={logout}>
              Logout
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Home;
