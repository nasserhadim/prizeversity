import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const Home = () => {
  const { user, logout, setUser } = useAuth();
  const [role, setRole] = useState(user?.role || '');
  const [classroomName, setClassroomName] = useState('');
  const [classroomCode, setClassroomCode] = useState('');
  const [classrooms, setClassrooms] = useState([]);
  const [joinClassroomCode, setJoinClassroomCode] = useState('');
  const [bazaarName, setBazaarName] = useState('');
  const [bazaarDescription, setBazaarDescription] = useState('');
  const [bazaarImage, setBazaarImage] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupImage, setGroupImage] = useState('');
  const [groupMaxMembers, setGroupMaxMembers] = useState(0);

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

  const handleDeleteClassroom = async (classroomId) => {
    try {
      await axios.delete(`/api/classroom/${classroomId}`);
      alert('Classroom deleted successfully!');
      fetchClassrooms(); // Refresh the classroom list
    } catch (err) {
      console.error('Failed to delete classroom', err);
      alert('Failed to delete classroom');
    }
  };

  const handleCreateBazaar = async (classroomId) => {
    try {
      const response = await axios.post('/api/bazaar/create', {
        name: bazaarName,
        description: bazaarDescription,
        image: bazaarImage,
        classroomId,
      });
      console.log('Bazaar created:', response.data);
      alert('Bazaar created successfully!');
      setBazaarName('');
      setBazaarDescription('');
      setBazaarImage('');
    } catch (err) {
      console.error('Failed to create bazaar', err);
      alert('Failed to create bazaar');
    }
  };

  const handleCreateGroup = async (classroomId) => {
    try {
      const response = await axios.post('/api/group/create', {
        name: groupName,
        image: groupImage,
        maxMembers: groupMaxMembers,
        classroomId,
      });
      console.log('Group created:', response.data);
      alert('Group created successfully!');
      setGroupName('');
      setGroupImage('');
      setGroupMaxMembers(0);
    } catch (err) {
      console.error('Failed to create group', err);
      alert('Failed to create group');
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
          <ul>
            {classrooms.map((classroom) => (
              <li key={classroom._id}>
                <h3>{classroom.name}</h3>
                <p>Code: {classroom.code}</p>
                {role === 'teacher' && (
                  <div>
                    <button onClick={() => handleDeleteClassroom(classroom._id)}>Delete Classroom</button>
                    <div>
                      <h4>Create Bazaar</h4>
                      <input
                        type="text"
                        placeholder="Bazaar Name"
                        value={bazaarName}
                        onChange={(e) => setBazaarName(e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="Description"
                        value={bazaarDescription}
                        onChange={(e) => setBazaarDescription(e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="Image URL"
                        value={bazaarImage}
                        onChange={(e) => setBazaarImage(e.target.value)}
                      />
                      <button onClick={() => handleCreateBazaar(classroom._id)}>Create Bazaar</button>
                    </div>
                    <div>
                      <h4>Create Group</h4>
                      <input
                        type="text"
                        placeholder="Group Name"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="Image URL"
                        value={groupImage}
                        onChange={(e) => setGroupImage(e.target.value)}
                      />
                      <input
                        type="number"
                        placeholder="Max Members"
                        value={groupMaxMembers}
                        onChange={(e) => setGroupMaxMembers(e.target.value)}
                      />
                      <button onClick={() => handleCreateGroup(classroom._id)}>Create Group</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
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