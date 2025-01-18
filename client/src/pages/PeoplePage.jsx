import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';

function PeoplePage() {
  const { id } = useParams(); // classroomId
  const [classroom, setClassroom] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchClassroom = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/classrooms', { withCredentials: true });
      const cls = res.data.find(c => c._id === id);
      setClassroom(cls);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchClassroom();
  }, [id]);

  if (!classroom) {
    return <div className="container">Loading...</div>;
  }

  // Simple client-side search
  const filteredUsers = classroom.users.filter(u => {
    const nameMatch = (u.userId.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    return nameMatch;
  });

  return (
    <div className="container">
      <h2>People in {classroom.className}</h2>
      <div className="mb-3">
        <input 
          className="form-control" 
          placeholder="Search by name..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>Date Joined</th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.map((user, idx) => (
            <tr key={idx}>
              <td>{user.userId?.name || 'Unknown'}</td>
              <td>{user.role}</td>
              <td>{new Date(user.joinedAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PeoplePage;
