// client/src/App.js
import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';

import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import RoleSelectionPage from './pages/RoleSelectionPage';
import DashboardPage from './pages/DashboardPage';
import ClassroomPage from './pages/ClassroomPage';
import BazaarPage from './pages/BazaarPage';
import GroupsPage from './pages/GroupsPage';
import WalletPage from './pages/WalletPage';
import PeoplePage from './pages/PeoplePage';
import NotFoundPage from './pages/NotFoundPage';

// A page for 403 Not Authorized
function NotAuthorizedPage() {
  return (
    <div className="container mt-4">
      <h2>403 - Not Authorized</h2>
      <p>You do not have sufficient permissions to view this page.</p>
    </div>
  );
}

function App() {
  const [isAuth, setIsAuth] = useState(false);
  const [userRole, setUserRole] = useState('');     // e.g. "student", "teacher", "admin"
  const [loading, setLoading] = useState(true);     // for showing a loading state

  useEffect(() => {
    // On initial load, fetch the current user from the backend
    const fetchMe = async () => {
      try {
        // Replace with your actual API URL if needed (or use process.env.REACT_APP_API_URL)
        const res = await axios.get('http://localhost:5000/api/users/me', { 
          withCredentials: true 
        });
        // If successful, user is authenticated
        setIsAuth(true);
        setUserRole(res.data.globalRole);  // or res.data.role if you named it differently
      } catch (error) {
        // If request fails (e.g., 401), user is not authenticated
        setIsAuth(false);
        setUserRole('');
      } finally {
        setLoading(false);
      }
    };

    fetchMe();
  }, []);

  const handleLogoutSuccess = () => {
    // This will cause re-render, hiding the logout button
    setIsAuth(false);
  };

  // If we're still fetching user data, show a loader/spinner
  if (loading) {
    return (
      <div className="container mt-5">
        <p>Loading user info...</p>
      </div>
    );
  }

  return (
    <>
      <Navbar 
        isAuth={isAuth}
        onLogoutSuccess={handleLogoutSuccess}
      />
      <div className="pt-4">
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/role-selection" element={<RoleSelectionPage />} />
          <Route path="/403" element={<NotAuthorizedPage />} />

          {/* Example: If user is not authenticated, redirect root to /login */}
          <Route 
            path="/" 
            element={
              isAuth 
                ? <DashboardPage /> 
                : <Navigate to="/login" replace /> 
            } 
          />

          {/* Protected routes with role-based checks */}
          <Route
            path="/classroom/:id"
            element={
              <ProtectedRoute 
                isAuth={isAuth} 
                userRole={userRole}
                // roles={['student','teacher','admin']} // optional if you want to allow all
              >
                <ClassroomPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/classroom/:id/people"
            element={
              <ProtectedRoute isAuth={isAuth} userRole={userRole}>
                <PeoplePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/classroom/:id/wallet"
            element={
              <ProtectedRoute isAuth={isAuth} userRole={userRole}>
                <WalletPage />
              </ProtectedRoute>
            }
          />

          {/* Example: restricting Bazaar to teacher/admin only */}
          <Route
            path="/classroom/:id/bazaar"
            element={
              <ProtectedRoute 
                isAuth={isAuth} 
                userRole={userRole} 
                roles={['teacher','admin']}
              >
                <BazaarPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/classroom/:id/groups"
            element={
              <ProtectedRoute isAuth={isAuth} userRole={userRole}>
                <GroupsPage />
              </ProtectedRoute>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
    </>
  );
}

export default App;
