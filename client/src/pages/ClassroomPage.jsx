import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';

function ClassroomPage() {
  const { id } = useParams();
  const [classroom, setClassroom] = useState(null);

  const getClassroomDetails = async () => {
    try {
      // For now, fetch the list of all user’s classrooms and filter
      const res = await axios.get('http://localhost:5000/api/classrooms', { withCredentials: true });
      const data = res.data.find(cls => cls._id === id);
      setClassroom(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    getClassroomDetails();
  }, [id]);

  if (!classroom) return <div className="container">Loading Classroom...</div>;

  return (
    <div className="container">
      <h2>{classroom.className}</h2>
      <p>Class Code: {classroom.classCode}</p>

      <div className="mt-3">
        <Link to={`/classroom/${id}/people`} className="btn btn-outline-primary me-2">
          People
        </Link>
        <Link to={`/classroom/${id}/bazaar`} className="btn btn-outline-secondary me-2">
          Bazaar
        </Link>
        <Link to={`/classroom/${id}/groups`} className="btn btn-outline-success me-2">
          Groups
        </Link>
        <Link to={`/classroom/${id}/wallet`} className="btn btn-outline-warning">
          My Wallet
        </Link>
      </div>
    </div>
  );
}

export default ClassroomPage;
