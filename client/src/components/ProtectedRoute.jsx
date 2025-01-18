// client/src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';

function ProtectedRoute({ isAuth, roles, userRole, children }) {
  // Check if not authenticated
  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }

  // If roles are specified but current userRole not in them => 403
  if (roles && !roles.includes(userRole)) {
    return <Navigate to="/403" replace />;
  }

  // Otherwise, render children
  return children;
}

export default ProtectedRoute;
