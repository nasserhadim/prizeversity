import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [persona, setPersona] = useState(null);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await axios.get('/api/auth/current-user');
        setUser(response.data);
        setPersona(response.data);
        localStorage.setItem('hadPreviousSession', 'true');
      } catch (err) {
        if (err.response?.status === 401) {
          setUser(null);
          // Only redirect if we had a previous session and we're not already on the home page
          if (localStorage.getItem('hadPreviousSession') && window.location.pathname !== '/') {
            localStorage.removeItem('hadPreviousSession'); // Clear the session flag
            window.location.href = '/?session_expired=true';
          }
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
      localStorage.removeItem('hadPreviousSession');
      window.location.href = '/';
    } catch (err) {
      console.error('Failed to logout:', err);
    }
  };

  if (loading) {
    return <div>Loading auth state...</div>;
  }

  if (serverError) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}>
        <h2>Server Connection Lost</h2>
        <p>It seems the server has been restarted.</p>
        <p>Redirecting to homepage in 5 seconds...</p>
        <p>You may need to sign in again.</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user: persona,
        originalUser: user,     
        setUser,
        persona,          
        setPersona,       
        loading,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

  export const useAuth = () => useContext(AuthContext);