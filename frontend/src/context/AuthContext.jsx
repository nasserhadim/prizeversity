import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  // Check if user is logged in on app load
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await axios.get('/api/auth/current-user');
        setUser(response.data);
      } catch (err) {
        if (err.response && err.response.status === 401) {
          // Expected: no user logged in, clear user silently.
          setUser(null);
        } else {
          console.error('Failed to fetch user:', err);
        }
      }
    };
    fetchUser();
  }, []);

  // Login function
  const login = async (provider) => {
    try {
      window.location.href = `/api/auth/${provider}`;
    } catch (err) {
      console.error('Failed to login', err);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      // Instead of making an axios call, redirect directly:
      window.location.href = '/api/auth/logout';
    } catch (err) {
      console.error('Failed to logout', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);