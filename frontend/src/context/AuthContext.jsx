import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await axios.get('/api/auth/current-user');
        setUser(response.data);
      } catch (err) {
        if (err.response && err.response.status === 401) {
          setUser(null);
        } else {
          console.error('Failed to fetch user:', err);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const logout = async () => {
    try {
      await axios.get('/api/auth/logout');
      setUser(null);
      // Redirect to home page after logout
      window.location.href = '/';
    } catch (err) {
      console.error('Failed to logout:', err);
    }
  };

  if (loading) {
    return <div>Loading auth state...</div>;
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);