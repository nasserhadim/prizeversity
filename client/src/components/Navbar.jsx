// client/src/components/Navbar.jsx
import React from 'react';
import LogoutButton from './LogoutButton';

function Navbar({ isAuth, onLogoutSuccess }) {
  return (
    <nav>
      <a href="/">Home</a>
      {isAuth ? (
        // Use our LogoutButton component
        <LogoutButton onLogoutSuccess={onLogoutSuccess} />
      ) : (
        <>
          <a href="http://localhost:5000/api/auth/google">Sign in w/ Google</a>
          <a href="http://localhost:5000/api/auth/microsoft">Sign in w/ Microsoft</a>
        </>
      )}
    </nav>
  );
}

export default Navbar;
