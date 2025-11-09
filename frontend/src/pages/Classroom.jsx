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
import { resolveBannerSrc } from '../utils/image';
import io from 'socket.io-client';
import { API_BASE } from '../config/api';
import ConfirmModal from '../components/ConfirmModal';
import Footer from '../components/Footer';
import Navbar from '../components/Navbar';
import { computeProgress } from '../utils/xp';


//HEADER-STYLE PROGRESS (matches top badge: need = base * level) ---
const computeHeaderProgress = (carryXP, level, settings = {}) => {
  const base = Number(settings?.baseXPLevel2 ?? 100);
  const lvl  = Math.max(1, Number(level) || 1);
  const need = base * lvl;                 // e.g., L2 => 200 when base=100
  const have = Math.max(0, Number(carryXP) || 0);
  const pct  = need > 0 ? (have / need) * 100 : 0;
  return { have, need, pct: Math.max(0, Math.min(100, pct)) };
};

const socket = io(); // no "/api" needed here

//normalize 0–1 or 0–100 to percent 0–100
const normalizePct = (p) => {
  if (!Number.isFinite(p)) return 0;
  const pct = p <= 1 ? p * 100 : p;
  return Math.max(0, Math.min(100, pct));
};


const Classroom = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const isStudent = user?.role === 'student';

  const navigate = useNavigate();
  const BACKEND_URL = `${API_BASE}`;

  // State variables
  const [classroom, setClassroom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false); // { changed code }
  const [redirectSecs, setRedirectSecs] = useState(5); // { changed code }
  const [students, setStudents] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [visibleCount, setVisibleCount] = useState(10);
  const [confirmModal, setConfirmModal] = useState(null);
  const [xpRefresh, setXpRefresh] = useState(false);
  const [xpSettings, setXpSettings] = useState(null);


//current user's classroom balance (xp/level) for THIS classroom
const myClassroomBalance = React.useMemo(() => {
  const list = user?.classroomBalances || [];
  const found = list.find(cb => String(cb.classroom) === String(id));
  return found || { xp: 0, level: 1 };
}, [user, id, xpRefresh]);

//compute progress values for the progress bar
// const progress = React.useMemo(() => {
//   if (xpSettings == null) {
//     return { need: 100, have: Number(myClassroomBalance?.xp) || 0, pct: 0 };
//   }
//   try {
//     const res = computeProgress(
//       Number(myClassroomBalance?.xp) || 0,
//       Number(myClassroomBalance?.level) || 1,
//       xpSettings
//     );
//     const need = Number(res?.need) || 100;
//     const have = Number(res?.have) || 0;
//     let pct = Number(res?.pct);
//     if (!Number.isFinite(pct)) {
//       pct = need > 0 ? have / need : 0;
//     }
//     return { need, have, pct };
//   } catch (e) {
//     console.error('computeProgress failed:', e);
//     const have = Number(myClassroomBalance?.xp) || 0;
//     const need = 100;
//     const pct = need > 0 ? have / need : 0;
//     return { need, have, pct };
//   }
// }, [myClassroomBalance, xpSettings]);

const progress = React.useMemo(() => {
  // computeHeaderProgress already defaults base to 100 if settings missing
  return computeHeaderProgress(
    Number(myClassroomBalance?.xp) || 0,
    Number(myClassroomBalance?.level) || 1,
    xpSettings
  );
}, [myClassroomBalance, xpSettings]);

//load xp settings when classroom changes or xpRefresh toggles
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const r = await axios.get(`/api/xpSettings/${id}`);
        //default to enabled if backend returns null/empty
        setXpSettings(r.data ?? { isXPEnabled: true });
        console.log('[xpSettings]', r.data ?? { isXPEnabled: true });
      } catch (e) {
        console.error('Failed to load xpSettings', e);
        setXpSettings({ isXPEnabled: true });
      }
    })();
  }, [id, xpRefresh]);


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
        // NEW: handle 404 with friendly message + redirect
        if (err.response?.status === 404) {
          console.warn('Classroom not found:', id);
          setNotFound(true); // { changed code }
          setLoading(false);
          return;
        }
        console.error('Error fetching classroom details:', err);
      }
    };

    fetchData();
  }, [id, user, navigate]);

  // Auto-redirect countdown when notFound
  useEffect(() => {
    if (!notFound) return; // { changed code }
    if (redirectSecs <= 0) {
      navigate('/');
      return;
    }
    const t = setTimeout(() => setRedirectSecs(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [notFound, redirectSecs, navigate]); // { changed code }

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
    // If we don't yet have a user, skip socket joins to avoid reading user._id (fixes crash/white page)
    if (!id || !user) return;

    socket.emit('join-classroom', id);
    socket.emit('join-user', user._id);
    console.log(`Joined user room: user-${user._id}`);

    const handleNewAnnouncement = (announcement) => {
      setAnnouncements(prev => [announcement, ...prev]);
    };


    // Add classroom removal handler
    const handleClassroomRemoval = (data) => {
      if (String(data.classroomId) === String(id)) {
        toast.error(data.message || 'You have been removed from this classroom');
        setTimeout(() => {
          navigate('/classrooms');
        }, 2000);
      }
    };

    socket.on('receive-announcement', handleNewAnnouncement);
    socket.on('classroom_removal', handleClassroomRemoval);

    // listen for personal notifications
    const handleNotification = (notification) => {
      console.log('Realtime notification:', notification);
    };
    socket.on('notification', handleNotification);

    return () => {
      socket.off('receive-announcement', handleNewAnnouncement);
      socket.off('classroom_removal', handleClassroomRemoval);
      socket.off('notification', handleNotification);
    };
  }, [id, navigate, user]); // include user so effect re-runs when user becomes available

  // Fetch classroom info and ensure user has access
  const fetchClassroomDetails = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/classroom/${id}`);
      const classroom = response.data;
      // Normalize comparisons to strings to avoid ObjectId vs string mismatches
      const userIdStr = String(user._id);
      const teacherIdStr = String(classroom.teacher?._id || classroom.teacher);
      const studentIdStrs = Array.isArray(classroom.students) ? classroom.students.map(s => String(s._id || s)) : [];
      const hasAccess =
        user.role === 'admin' ||
        (user.role === 'teacher' && teacherIdStr === userIdStr) ||
        (user.role === 'student' && studentIdStrs.includes(userIdStr));

      if (!hasAccess) {
        toast.error('You do not have access to this classroom');
        navigate('/');
        return;
      }

      setClassroom(response.data);
      await fetchStudents();
    } catch (err) {
      if (err.response?.status === 403) {
        toast.error('You do not have access to this classroom');
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
          const msg = err.response?.data?.error || err.response?.data?.message || 'Failed to leave classroom!';
          toast.error(msg);
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
  // 1) Show spinner while we are loading data
  if (loading) {
    return (
      <div style={{ paddingTop: user ? '5rem' : '4rem' }}>
        <Navbar />
        <div className="min-h-screen bg-base-200 flex items-center justify-center">
          <LoaderIcon className="animate-spin size-10" />
        </div>
        <Footer />
      </div>
    );
  }

  // 2) If user is not signed-in, show a helpful prompt instead of rendering classroom UI
  if (!user) {
    return (
      <div style={{ paddingTop: '4rem' }}>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center bg-base-200 p-6">
          <div className="max-w-xl text-center bg-base-100 dark:bg-base-300 rounded-lg shadow p-8 border border-base-300">
            <h1 className="text-2xl font-bold mb-4 text-base-content">Sign in to view this classroom</h1>
            <p className="text-base-content/70 mb-6">
              You must be signed in and a member of the classroom to view this page.
            </p>
            <div className="flex justify-center gap-3">
              {/* Stack on mobile, row on larger screens. full-width buttons on small screens to avoid overflow */}
              <div className="w-full max-w-sm flex flex-col sm:flex-row items-center justify-center gap-3">
                <a href="/api/auth/google" className="btn btn-primary w-full sm:w-auto">Sign in with Google</a>
                <a href="/api/auth/microsoft" className="btn btn-outline w-full sm:w-auto">Sign in with Microsoft</a>
                <button className="btn btn-outline w-full sm:w-auto" onClick={() => navigate('/')}>Go home</button>
              </div>
            </div>
            <p className="text-xs text-base-content/50 mt-4">If you think this is an error, check the URL or contact support.</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }
  
  if (notFound) { // { changed code }
    return (
      <div style={{ paddingTop: user ? '5rem' : '4rem' }}>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center bg-base-200 p-6">
          <div className="max-w-xl text-center bg-base-100 dark:bg-base-300 rounded-lg shadow p-8 border border-base-300">
            <h1 className="text-2xl font-bold mb-4 text-base-content">Classroom not found</h1>
            <p className="text-base-content/70 mb-4">We couldn't find that classroom. You may have typed an incorrect URL or the classroom was removed.</p>
            <p className="text-base-content/60 mb-6">Redirecting to the home page in {redirectSecs} second{redirectSecs !== 1 ? 's' : ''}…</p>
            <div className="flex justify-center gap-3">
              {/* Same responsive pattern for not-found actions */}
              <div className="w-full max-w-sm flex flex-col sm:flex-row items-center justify-center gap-3">
                <button className="btn btn-primary w-full sm:w-auto" onClick={() => navigate('/')}>Go home now</button>
                <button className="btn btn-outline w-full sm:w-auto" onClick={() => navigate('/classrooms')}>View classrooms</button>
              </div>
            </div>
          </div>
        </div>
        <Footer />
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
          backgroundImage={resolveBannerSrc(classroom.backgroundImage)}
          classroomId={id}
        />

        <div className="max-w-3xl mx-auto p-6 bg-green-50 rounded-lg space-y-6">
        {isStudent && xpSettings?.isXPEnabled && (
          (() => {
            const pct = normalizePct(progress?.pct);
            const need = Number(progress?.need) || 100;
            const have = Number(progress?.have) || 0;
            const level = Number(myClassroomBalance?.level) || 1;

            return (
              <div className="card bg-white border border-base-300 shadow-sm rounded-lg p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold">Level {level}</div>
                  <div className="text-sm text-gray-600">
                    {have} / {need} XP
                  </div>
                </div>

                {/* Primary progress (DaisyUI) */}
                <progress
                  className="progress progress-success w-full"
                  value={Math.min(100, Math.max(0, Math.round(progress.pct)))}
                  max="100"
                ></progress>
                  <div className="text-xs text-gray-500 mt-1">
                    {Math.round(progress.pct)}% to next level
                  </div>

                  

                {/* Fallback bar in case <progress> isn't styled */}
                <div className="mt-2">
                  <div className="h-2 bg-gray-200 rounded">
                    <div className="h-2 rounded bg-green-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            );
          })()
        )}


        
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

            {/* settings loaded  
           {xpSettings && (
           
            <div className="text-xs text-gray-500">XP settings loaded</div>
            )}
*/}


          {/* Teacher/Admin Controls */}
          {(user.role === 'teacher' || user.role === 'admin') && (
            <div id="class-settings" className="space-y-4">
              {/* settings UI goes here */}
            </div>
          )}

          {/* Student "Leave Classroom" button */}
          {user.role !== 'teacher' && (
            <div className="my-4">
              <button
                className="btn btn-warning btn-sm"
                onClick={handleLeaveClassroomConfirm}
              >
                Leave Classroom
              </button>
            </div>
          )}

          {/* XP test buttons jsut for students (temporary) */}
          {(user.role === 'teacher' || user.role === 'admin') && (
            <div className="flex gap-3 mb-6 justify-center">
              <button
                onClick={async () => {
                  try {
                    await axios.post('/api/xp/test/add', {
                      userId: user._id,
                      classroomId: id,
                      xpToAdd: 50,
                    });
                    toast.success('Added 50 XP');
                    setXpRefresh(prev => !prev);
                  } catch (err) {
                    console.error('Error adding XP:', err);
                    toast.error('Failed to add XP');
                  }
                }}
                className="btn btn-success btn-sm"
              >
                +50 XP
              </button>

              <button
                onClick={async () => {
                  try {
                    await axios.post('/api/xp/test/reset', {
                      userId: user._id,
                      classroomId: id,
                    });
                    toast.success('XP Reset');
                    setXpRefresh(prev => !prev);
                  } catch (err) {
                    console.error('Error resetting XP:', err);
                    toast.error('Failed to reset XP');
                  }
                }}
                className="btn btn-warning btn-sm"
              >
                Reset XP
              </button>
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
