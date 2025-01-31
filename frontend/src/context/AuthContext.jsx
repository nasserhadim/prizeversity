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
        console.log('Fetched User:', response.data); // Log the fetched user
        setUser(response.data);
      } catch (err) {
        console.error('Failed to fetch user:', err); // Log the error
        setUser(null);
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
      await axios.get('/api/auth/logout');
      setUser(null);
      window.location.href = '/';
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