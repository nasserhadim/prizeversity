import React from 'react';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const { user } = useAuth();

  return (
    <div>
      <h1>Welcome, {user?.email}</h1>
      {user?.role === 'teacher' && <button>Create Classroom</button>}
      {user?.role === 'student' && <button>Join Classroom</button>}
    </div>
  );
};

export default Home;