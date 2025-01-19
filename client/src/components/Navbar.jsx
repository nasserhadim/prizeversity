// client/src/components/Navbar.jsx
import React from 'react';
import { Link } from 'react-router-dom';

function Navbar({ isAuth, onLogoutSuccess }) {
  // We'll define an inline logout function for simplicity:
  const handleLogout = async () => {
    try {
      await fetch('http://localhost:5000/api/auth/logout', { credentials: 'include' });
      onLogoutSuccess(); // sets isAuth=false in parent
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <nav style={{ display: 'flex', gap: '10px' }}>
      <Link to="/">Home</Link>
      {isAuth ? (
        <button onClick={handleLogout}>Logout</button>
      ) : (
        <Link to="/login">Login</Link>
      )}
    </nav>
  );
}

export default Navbar;
