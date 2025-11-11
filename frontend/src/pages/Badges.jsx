import { useAuth } from '../context/AuthContext';
import TeacherBadgesPage from './TeacherBadgesPage';
import StudentBadgesPage from './StudentBadgesPage';
import { Navigate, useParams, useLocation } from 'react-router-dom';

function Badges() {
  const { user } = useAuth();
  const { classroomId } = useParams();
  const location = useLocation();

  const queryParams = new URLSearchParams(location.search);
  const studentId = queryParams.get('studentId');

  if (!user) return <Navigate to="/" />;

  // If a teacher is viewing a student's badge page, show the student's badge collection
  if (user.role === 'teacher' && studentId) {
    return <StudentBadgesPage classroomId={classroomId} studentId={studentId} />;
  }

  // Otherwise, use normal behavior
  return user.role === 'teacher' ? (
    <TeacherBadgesPage classroomId={classroomId} />
  ) : (
    <StudentBadgesPage classroomId={classroomId} studentId={studentId || user._id} />
  );
}

export default Badges;