import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getNews } from '../API/apiNewsfeed';
import { useAuth } from '../context/AuthContext';
import '../styles/MemberManagement.css';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LoaderIcon } from 'lucide-react';
import ClassroomBanner from '../components/ClassroomBanner';
import io from 'socket.io-client';
import { API_BASE } from '../config/api';
import ConfirmModal from '../components/ConfirmModal';
import Footer from '../components/Footer';

const socket = io(); // no "/api" needed here

const Classroom = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const BACKEND_URL = `${API_BASE}`;

  // State variables
  const [classroom, setClassroom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [visibleCount, setVisibleCount] = useState(10);
  const [confirmModal, setConfirmModal] = useState(null);

  // Fetch classroom and student data on mount
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        await fetchClassroomDetails();
      } catch (err) {
        if (err.response?.status === 401) {
          localStorage.removeItem('hadPreviousSession');
          navigate('/?session_expired=true');
          return;
        }
        console.error('Error fetching classroom details:', err);
      }
    };

    fetchData();
  }, [id, user, navigate]);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const res = await getNews(id);
        setAnnouncements(res.data);
      } catch (err) {
        console.error('Failed to fetch announcements', err);
      }
    };
    fetchAnnouncements();
  }, [id]);

  useEffect(() => {
  if (!id) return;
  socket.emit('join-classroom', id);
  socket.emit('join-user', user._id);
  console.log(`Joined user room: user-${user._id}`);

  const handleNewAnnouncement = (announcement) => {
    setAnnouncements(prev => [announcement, ...prev]);
  };

  socket.on('receive-announcement', handleNewAnnouncement);

   // listen for personal notifications
  const handleNotification = (notification) => {
    console.log('Realtime notification:', notification);
  };
  socket.on('notification', handleNotification);

  return () => {
    socket.off('receive-announcement', handleNewAnnouncement);
  };
}, [id]);

  // Fetch classroom info and ensure user has access
  const fetchClassroomDetails = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/classroom/${id}`);
      const classroom = response.data;
      const hasAccess =
        user.role === 'admin' ||
        (user.role === 'teacher' && classroom.teacher === user._id) ||
        (user.role === 'student' && classroom.students.includes(user._id));

      if (!hasAccess) {
        toast.error('You no longer have access to this classroom');
        navigate('/');
        return;
      }

      setClassroom(response.data);
      await fetchStudents();
    } catch (err) {
      if (err.response?.status === 403) {
        toast.error('You no longer have access to this classroom');
        navigate('/');
        return;
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Fetch the list of students in the classroom
  const fetchStudents = async () => {
    try {
      const response = await axios.get(`/api/classroom/${id}/students`);
      setStudents(response.data);
    } catch (err) {
      if (err.response?.status === 401) {
        throw err;
      }
      console.error('Failed to fetch students', err);
    }
  };

  // Confirm and leave classroom
  const handleLeaveClassroomConfirm = () => {
    setConfirmModal({
      title: "Leave Classroom",
      message: `You are about to leave the classroom "${classroom.name}". Are you sure?`,
      onConfirm: async () => {
        try {
          await axios.post(`/api/classroom/${id}/leave`);
          toast.success('Left classroom successfully!');
          navigate('/classrooms');
        } catch (err) {
          console.error('Failed to leave classroom', err);
          toast.error('Failed to leave classroom!');
        }
      }
    });
  };

  // Confirm and remove student from classroom
  const handleRemoveStudentConfirm = (studentId) => {
    setConfirmModal({
      title: "Remove Student",
      message: "Are you sure you want to remove this student?",
      onConfirm: async () => {
        try {
          await axios.delete(`/api/classroom/${id}/students/${studentId}`);
          toast.success('Student removed successfully!');
          fetchStudents();
        } catch (err) {
          console.error('Failed to remove student', err);
          toast.error('Failed to remove student');
        }
      }
    });
  };

  // Confirm and delete classroom
  const handleDeleteClassroomConfirm = () => {
    setConfirmModal({
      title: "Delete Classroom",
      message: `You're about to delete classroom "${classroom.name}". All data will be purged! Are you sure?`,
      confirmText: "Delete",
      onConfirm: async () => {
        try {
          await axios.delete(`/api/classroom/${id}`);
          toast.success('Classroom deleted successfully!');
          navigate('/');
        } catch (err) {
          console.error('Failed to delete classroom', err);
          toast.error('Failed to delete classroom!');
        }
      }
    });
  };

  // Render loading spinner
  if (loading || !user) {
    return (
      <div className='min-h-screen bg-base-200 flex items-center justify-center'>
        <LoaderIcon className='animate-spin size-10' />
      </div>
    );
  }

  // Render empty state
  if (!classroom) {
    return (
      <div className='min-h-screen bg-base-200 flex items-center justify-center'>
        <LoaderIcon className='animate-spin size-10' />
      </div>
    );
  }

  // Main render
  return (
    <div className="flex flex-col min-h-screen bg-base-200">
      <div className="flex-grow">
        {/* Classroom banner inside the classroom page */}
        <ClassroomBanner
          name={classroom.name}
          code={classroom.code}
           bgColor={classroom.color}
           backgroundImage={
             classroom.backgroundImage
               ? (
                 classroom.backgroundImage.startsWith('http')
                   ? classroom.backgroundImage
                   : `${BACKEND_URL}${classroom.backgroundImage}`
               )
               : undefined
           }
         />

        <div className="max-w-3xl mx-auto p-6 bg-green-50 rounded-lg space-y-6">
          {/* Navigation */}
          <Link to="/classrooms" className="link text-accent">
            ← Back to Classroom Dashboard
          </Link>

          <nav className="flex space-x-4 mb-4">
            {user.role === 'teacher' && (
              <>
                <Link
                  to={`/classroom/${id}/teacher-news`}
                  className="link text-accent hover:text-accent-focus font-semibold"
                >
                  Manage Announcements
                </Link>
                <Link
                  to={`/classroom/${id}/settings`}
                  className="link text-accent hover:text-accent-focus font-semibold"
                >
                  Class Settings
                </Link>
              </>
            )}
          </nav>

          {/* Teacher/Admin Controls */}
          {(user.role === 'teacher' || user.role === 'admin') && (
            <div id="class-settings" className="space-y-4">
              {/* settings UI goes here */}
            </div>
          )}

          {/* Announcements List */}
          <div className="space-y-6">
            <h3 className="text-center text-green-500 text-4xl font-bold mb-4">
              Announcements
            </h3>
            {announcements.slice(0, visibleCount).map((item) => (
              <div key={item._id} className="bg-white p-4 border border-green-200 rounded-lg shadow-sm mx-auto">
                {/* render formatted HTML */}
                <div
                  className="text-gray-700 mb-2"
                  dangerouslySetInnerHTML={{ __html: item.content }}
                />

                {/* list attachments, if any */}
                {item.attachments && item.attachments.length > 0 && (
                  <ul className="mt-1 space-y-1">
                    {item.attachments.map(a => (
                      <li key={a.url}>
                        <a
                          href={a.url}
                          download
                          className="text-blue-500 underline"
                        >
                          {a.originalName}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-sm text-gray-500">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
          <div className="flex justify-center space-x-4 mt-4">
            {announcements.length > visibleCount && (
              <button
                className="btn bg-green-500 hover:bg-green-600 text-white px-4 py-2"
                onClick={() => setVisibleCount(announcements.length)}
              >
                Show more announcements
              </button>
            )}
            {visibleCount > 10 && (
              <button
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg"
                onClick={() => setVisibleCount(10)}
              >
                Show less announcements
              </button>
            )}
          </div>
        </div>
      </div>
      <Footer />

      <ConfirmModal
        isOpen={!!confirmModal}
        onClose={() => setConfirmModal(null)}
        title={confirmModal?.title}
        message={confirmModal?.message}
        confirmText={confirmModal?.confirmText}
        onConfirm={confirmModal?.onConfirm}
      />
    </div>
  );
};

export default Classroom;
