import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
// import './Home.css'; // Add this line to import the CSS file
import socket from '../utils/socket';

import Navbar from '../components/Navbar';

const Home = () => {
  const { user, logout, setUser } = useAuth();
  const [role, setRole] = useState(user?.role || '');
  const [classroomName, setClassroomName] = useState('');
  const [classroomCode, setClassroomCode] = useState('');
  const [classrooms, setClassrooms] = useState([]);
  const [joinClassroomCode, setJoinClassroomCode] = useState('');
  const navigate = useNavigate();

  // Fetch the user's role and classrooms on component mount
  useEffect(() => {
    if (user) {
      // Check if the user that was fetched i logged
      console.log('Fetched User:', user);
      if (user.role) {
        // checking if the user role is fetched
        console.log('User Role:', user.role);
        setRole(user.role);
         // Fetch classrooms when the user role is set
        fetchClassrooms();
      } else {
        // Adding console logs regarding if no role is assinged to the user.
        console.log('No role assigned to user'); 
      }
    }
  }, [user]);

  // Check for session expired parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('session_expired')) {
      alert('Your session has expired. Please sign in again.');
      // Removed the parameter from URL --> will fix the issue regarding the classroom layers 
      window.history.replaceState({}, '', '/');
    }
  }, []);

  // Fetch classrooms from the backend
  const fetchClassrooms = async () => {
    try {
      const endpoint = role === 'teacher' ? '/api/classroom' : '/api/classroom/student';
      const response = await axios.get(endpoint);
      setClassrooms(response.data);
    } catch (err) {
      console.error('Failed to fetch classrooms', err);
    }
  };

  // implement here username inputs?
  const handleRoleSelection = async (selectedRole) => {
    try {
      const response = await axios.post('/api/auth/update-role', { role: selectedRole });
      // update the role in the use state
      setRole(selectedRole); 
      // update the user in the AuthContext.js
      setUser(response.data.user);
    } catch (err) {
      console.error('Failed to update role', err);
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
      console.log('Classroom created:', response.data);
      alert('Classroom created successfully!');
      setClassroomName('');
      setClassroomCode('');
      fetchClassrooms(); // Refresh the classroom list
    } catch (err) {
      if (err.response && err.response.data && err.response.data.error) {
        alert(err.response.data.error); // Will show "A classroom with this code already exists" or other specific errors
        // will add toast errors in the future 
      } else {
        console.error('Failed to create classroom', err);
        alert('Failed to create classroom');
      }
    }
  };

  const handleJoinClassroom = async () => {
    try {
      if (!joinClassroomCode.trim()) {
        alert('Please enter a classroom code');
        return;
      }

      const response = await axios.post('/api/classroom/join', { code: joinClassroomCode });
      console.log('Joined Classroom:', response.data);
      alert('Joined classroom successfully!');
      setJoinClassroomCode('');
      fetchClassrooms(); // Refresh the classroom list
    } catch (err) {
      if (err.response && err.response.data && err.response.data.error) {
        alert(err.response.data.error); // Will show "Invalid classroom code" or "Already joined" messages
        // Will add toast errors in the future
      } else {
        console.error('Failed to join classroom', err);
        alert('Failed to join classroom');
      }
    }
  };

  const handleCardClick = (classroomId) => {
    navigate(`/classroom/${classroomId}`);
  };

  // Add socket listener for classroom updates
  useEffect(() => {
    socket.on('classroom_update', (updatedClassroom) => {
      setClassrooms(prevClassrooms => 
        prevClassrooms.map(classroom => 
          classroom._id === updatedClassroom._id ? updatedClassroom : classroom
        )
      );
    });

    socket.on('notification', (notification) => {
      // Fetch classrooms after receiving classroom-related notifications
      if (notification.type === 'classroom_update' || 
          notification.type === 'classroom_removal' || 
          notification.type === 'classroom_deletion') {
        fetchClassrooms();
      }
    });

    return () => {
      socket.off('classroom_update');
      socket.off('notification');
    };
  }, []);

  return (
    <>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-center text-primary">
          Welcome to Prizeversity
        </h1>

        {user ? (
          <div className="space-y-4">
            <p className="text-lg text-center">
              Welcome, <span className="font-semibold">{user.email}</span>
            </p>

            {!role && (
              <div className="text-center space-y-2">
                <p className="font-medium">Please select your role:</p>
                <div className="flex justify-center gap-4">
                  <button className="btn btn-primary" onClick={() => handleRoleSelection('teacher')}>
                    Teacher
                  </button>
                  <button className="btn btn-secondary" onClick={() => handleRoleSelection('student')}>
                    Student
                  </button>
                </div>
              </div>
            )}

            <p className="text-center mt-6">Use the “Classrooms” menu to access your dashboard.</p>

            <div className="text-right">
              <button className="btn btn-outline btn-error" onClick={logout}>
                Logout
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <button className="btn btn-primary w-full max-w-xs" onClick={() => window.location.href = '/api/auth/google'}>
              Login with Google
            </button>
            <button className="btn btn-secondary w-full max-w-xs" onClick={() => window.location.href = '/api/auth/microsoft'}>
              Login with Microsoft
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default Home;