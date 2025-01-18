import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

function DashboardPage() {
  const [classrooms, setClassrooms] = useState([]);
  const [className, setClassName] = useState('');
  const [classCode, setClassCode] = useState('');
  const [role, setRole] = useState('student'); // or fetch from user context

  const fetchClassrooms = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/classrooms', { withCredentials: true });
      setClassrooms(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUserRole = async () => {
    // Optionally fetch from /api/users/me
    // For simplicity, let's keep it 'student' or 'teacher'
  };

  useEffect(() => {
    fetchClassrooms();
    fetchUserRole();
  }, []);

  const createClassroom = async () => {
    try {
      await axios.post('http://localhost:5000/api/classrooms', 
        { className }, 
        { withCredentials: true });
      setClassName('');
      fetchClassrooms();
    } catch (err) {
      console.error(err);
      alert('Error creating classroom');
    }
  };

  const joinClassroom = async () => {
    try {
      // we assume the user typed an existing classroom ID or code
      // If we want to join by code, we'd need an API that finds the ID by code
      await axios.post(`http://localhost:5000/api/classrooms/${classCode}/join`, {}, { withCredentials: true });
      setClassCode('');
      fetchClassrooms();
    } catch (err) {
      console.error(err);
      alert('Error joining classroom');
    }
  };

  return (
    <div className="container">
      <h1 className="mb-4">Dashboard</h1>
      
      {role === 'teacher' && (
        <div className="card mb-4">
          <div className="card-header">Create Classroom</div>
          <div className="card-body">
            <input 
              type="text"
              className="form-control mb-2"
              placeholder="Enter class name..."
              value={className}
              onChange={e => setClassName(e.target.value)}
            />
            <button className="btn btn-success" onClick={createClassroom}>Create</button>
          </div>
        </div>
      )}
      
      {role === 'student' && (
        <div className="card mb-4">
          <div className="card-header">Join Classroom</div>
          <div className="card-body">
            <input 
              type="text"
              className="form-control mb-2"
              placeholder="Enter class ID or code..."
              value={classCode}
              onChange={e => setClassCode(e.target.value)}
            />
            <button className="btn btn-primary" onClick={joinClassroom}>Join</button>
          </div>
        </div>
      )}

      <h2>My Classrooms</h2>
      <div className="list-group">
        {classrooms.map(c => (
          <Link key={c._id} to={`/classroom/${c._id}`} className="list-group-item list-group-item-action">
            {c.className} (Code: {c.classCode})
          </Link>
        ))}
      </div>
    </div>
  );
}

export default DashboardPage;
