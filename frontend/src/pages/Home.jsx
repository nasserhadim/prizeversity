import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Home.css'; // Add this line to import the CSS file

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
      console.log('Fetched User:', user); // Log the fetched user
      if (user.role) {
        console.log('User Role:', user.role); // Log the user role
        setRole(user.role);
        fetchClassrooms(); // Fetch classrooms when the user role is set
      } else {
        console.log('No role assigned to user'); // Log if no role is assigned
      }
    }
  }, [user]);

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
      setClassroomName('');
      setClassroomCode('');
      fetchClassrooms(); // Refresh the classroom list
    } catch (err) {
      console.error('Failed to create classroom', err);
      alert('Failed to create classroom');
    }
  };

  const handleJoinClassroom = async () => {
    try {
      const response = await axios.post('/api/classroom/join', { code: joinClassroomCode });
      console.log('Joined Classroom:', response.data); // Log the joined classroom
      alert('Joined classroom successfully!');
      setJoinClassroomCode('');
      fetchClassrooms(); // Refresh the classroom list
    } catch (err) {
      console.error('Failed to join classroom', err);
      alert('Failed to join classroom');
    }
  };

  const handleCardClick = (classroomId) => {
    navigate(`/classroom/${classroomId}`);
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
          {role === 'student' && (
            <div>
              <h2>Join Classroom</h2>
              <input
                type="text"
                placeholder="Classroom Code"
                value={joinClassroomCode}
                onChange={(e) => setJoinClassroomCode(e.target.value)}
              />
              <button onClick={handleJoinClassroom}>Join Classroom</button>
            </div>
          )}
          <h2>Classrooms</h2>
          <div className="classroom-cards">
            {classrooms.map((classroom) => (
              <div key={classroom._id} className="classroom-card" onClick={() => handleCardClick(classroom._id)}>
                <h3>{classroom.name}</h3>
                <p>Code: {classroom.code}</p>
              </div>
            ))}
          </div>
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