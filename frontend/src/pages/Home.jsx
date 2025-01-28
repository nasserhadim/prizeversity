import React from 'react';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const { user, login, logout } = useAuth();

  return (
    <div>
      <h1>Welcome to Gamification App</h1>
      {user ? (
        <div>
          <p>Welcome, {user.email}</p>
          <button onClick={logout}>Logout</button>
          {user.role === 'teacher' && <button>Create Classroom</button>}
          {user.role === 'student' && <button>Join Classroom</button>}
        </div>
      ) : (
        <div>
          <button onClick={() => login('google')}>Login with Google</button>
          <button onClick={() => login('microsoft')}>Login with Microsoft</button>
        </div>
      )}
    </div>
  );
};

export default Home;