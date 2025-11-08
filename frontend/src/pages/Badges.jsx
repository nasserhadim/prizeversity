import { useAuth } from '../context/AuthContext';
import TeacherBadgesPage from './TeacherBadgesPage';
import StudentBadgesPage from './StudentBadgesPage';
import { Navigate, useParams } from 'react-router-dom';

function Badges() {
  const { user } = useAuth();
  const { classroomId } = useParams();

  if (!user) return <Navigate to="/" />;

  return user.role === 'teacher' ? (
    <TeacherBadgesPage classroomId={classroomId} />
  ) : (
    <StudentBadgesPage classroomId={classroomId} />
  );
}

export default Badges;
