import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const Classroom = () => {
  const { id } = useParams();
  const [classroom, setClassroom] = useState(null);

  useEffect(() => {
    const fetchClassroom = async () => {
      try {
        const response = await axios.get(`/api/classroom/${id}`);
        setClassroom(response.data);
      } catch (err) {
        console.error('Failed to fetch classroom', err);
      }
    };
    fetchClassroom();
  }, [id]);

  if (!classroom) return <div>Loading...</div>;

  return (
    <div>
      <h1>{classroom.name}</h1>
      <p>Class Code: {classroom.code}</p>
    </div>
  );
};

export default Classroom;