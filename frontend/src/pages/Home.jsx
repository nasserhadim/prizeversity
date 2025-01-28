import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const Home = () => {
  const { user, logout, setUser } = useAuth();
  const [role, setRole] = useState(user?.role || '');
  const [classroomName, setClassroomName] = useState('');
  const [classroomCode, setClassroomCode] = useState('');

  // Fetch the user's role on component mount
  useEffect(() => {
    if (user?.role) {
      setRole(user.role);
    }
  }, [user]);

  const handleRoleSelection = async (selectedRole) => {
    try {
      const response = await axios.post('/api/auth/update-role', { role: selectedRole });
      setRole(selectedRole); // Update the role in the state
      setUser(response.data.user); // Update the user in the AuthContext
    } catch (err) {
      console.error('Failed to update role', err);
    }
  };

  const handleCreateClassroom = async () => {
    try {
      const response = await axios.post('/api/classroom/create', {
        name: classroomName,
        code: classroomCode,
      });
      console.log('Classroom created:', response.data);
      alert('Classroom created successfully!');
    } catch (err) {
      console.error('Failed to create classroom', err);
      alert('Failed to create classroom');
    }
  };

  return (
    <div>
      <h1>Welcome to Gamification App</h1>
      {user ? (
        <div>
          <p>Welcome, {user.email}</p>
          {!role && (
            <div>
              <p>Please select your role:</p>
              <button onClick={() => handleRoleSelection('teacher')}>Teacher</button>
              <button onClick={() => handleRoleSelection('student')}>Student</button>
            </div>
          )}
          {role === 'teacher' && (
            <div>
              <h2>Create Classroom</h2>
              <input
                type="text"
                placeholder="Classroom Name"
                value={classroomName}
                onChange={(e) => setClassroomName(e.target.value)}
              />
              <input
                type="text"
                placeholder="Classroom Code"
                value={classroomCode}
                onChange={(e) => setClassroomCode(e.target.value)}
              />
              <button onClick={handleCreateClassroom}>Create Classroom</button>
            </div>
          )}
          {role === 'student' && <button>Join Classroom</button>}
          <button onClick={logout}>Logout</button>
        </div>
      ) : (
        <div>
          <button onClick={() => window.location.href = '/api/auth/google'}>Login with Google</button>
          <button onClick={() => window.location.href = '/api/auth/microsoft'}>Login with Microsoft</button>
        </div>
      )}
    </div>
  );
};

export default Home;