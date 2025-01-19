// client/src/components/LogoutButton.jsx
import React from 'react';
import axios from 'axios';

function LogoutButton({ onLogoutSuccess }) {
  const handleLogout = async () => {
    try {
      // Call the server logout endpoint
      await axios.get('http://localhost:5000/api/auth/logout', {
        withCredentials: true
      });
      // After success, either:
      // 1) Refresh local state:
      if (onLogoutSuccess) {
        onLogoutSuccess();
      }
      // 2) Or do a simple page reload/redirect:
      // window.location.href = '/';
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <button onClick={handleLogout}>
      Logout
    </button>
  );
}

export default LogoutButton;
