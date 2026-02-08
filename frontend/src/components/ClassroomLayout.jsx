import React from 'react';
import { useParams, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useSessionActivity from '../hooks/useSessionActivity';

const ClassroomLayout = () => {
  const { id, classroomId, classId } = useParams();
  const resolvedId = id || classroomId || classId;
  const { user } = useAuth();

  // Track session activity across ALL classroom sub-pages
  useSessionActivity({ user, classroomId: resolvedId });

  return <Outlet />;
};

export default ClassroomLayout;