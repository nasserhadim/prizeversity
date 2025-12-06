import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import socket from '../utils/socket';
import toast from 'react-hot-toast';
import { API_BASE } from '../config/api'; 
import Footer from '../components/Footer';
import { resolveBannerSrc } from '../utils/image';

// Helper to generate a random 6-character alphanumeric code
const generateRandomCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export default function ClassroomPage() {
  const { user } = useAuth();
  const [role, setRole] = useState(user?.role || '');
  const [classrooms, setClassrooms] = useState([]);
  // Search state + derived filtered list
  const [searchClassrooms, setSearchClassrooms] = useState('');
  // NEW: sorting state
  const [sortField, setSortField] = useState('createdAt'); // 'createdAt' | 'name' | 'code' | 'joinedAt'
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' | 'desc'

  // NEW: map classroomId -> joinedAt for the current user
  const joinDateMap = useMemo(() => {
    const map = {};
    (user?.classroomJoinDates || []).forEach(cjd => {
      if (cjd?.classroom) map[String(cjd.classroom)] = cjd.joinedAt;
    });
    return map;
  }, [user]);

  const filteredClassrooms = useMemo(() => {
    const q = (searchClassrooms || '').trim().toLowerCase();
    let list = classrooms || [];
    if (q) {
      list = list.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.code || '').toLowerCase().includes(q)
      );
    }
    // NEW: apply sorting
    const cmp = (a, b) => {
      let av, bv;
      if (sortField === 'createdAt') {
        av = new Date(a.createdAt || 0).getTime();
        bv = new Date(b.createdAt || 0).getTime();
      } else if (sortField === 'joinedAt') {
        av = new Date(joinDateMap[a._id] || 0).getTime();
        bv = new Date(joinDateMap[b._id] || 0).getTime();
      } else if (sortField === 'name') {
        av = (a.name || '').toLowerCase();
        bv = (b.name || '').toLowerCase();
      } else {
        av = (a.code || '').toLowerCase();
        bv = (b.code || '').toLowerCase();
      }
      if (av < bv) return sortDirection === 'asc' ? -1 : 1;
      if (av > bv) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    };
    return list.slice().sort(cmp);
  }, [classrooms, searchClassrooms, sortField, sortDirection, joinDateMap]);

  const [classroomName, setClassroomName] = useState('');
  const [classroomCode, setClassroomCode] = useState('');
  const [color, setColor] = useState('#22c55e');
  const [backgroundFile, setBackgroundFile] = useState(null);
  // Add new states for background image source toggle
  const [backgroundImageSource, setBackgroundImageSource] = useState('file');
  const [backgroundImageUrl, setBackgroundImageUrl] = useState('');
  const [joinClassroomCode, setJoinClassroomCode] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Add tab state for different user roles
  const [studentTab, setStudentTab] = useState('join'); // 'join' or 'classrooms'
  const [teacherTab, setTeacherTab] = useState('create'); // 'create', 'classrooms', or 'archived'
  
  const navigate = useNavigate();
  const BACKEND_URL = `${API_BASE}`;

  // Update role state whenever user changes (e.g., login/logout)
  useEffect(() => {
    setRole(user?.role || '');
  }, [user]);

   // Fetch classrooms when role is known or changes
  useEffect(() => {
    if (role) fetchClassrooms();
  }, [role]);

  // Fetch classrooms from backend depending on role
  const fetchClassrooms = async () => {
    try {
      const endpoint = role === 'teacher' ? '/api/classroom' : '/api/classroom/student';
      const res = await axios.get(endpoint);
      setClassrooms(res.data);
      
      // If user has at least one classroom, prefer "My Classrooms" view
      // for students and for teachers (instead of the join/create default).
      try {
        if (role === 'student' && Array.isArray(res.data) && res.data.length > 0) {
          setStudentTab('classrooms');
        }
        if (role === 'teacher' && Array.isArray(res.data) && res.data.length > 0) {
          setTeacherTab('classrooms');
        }
      } catch (e) {
        // non-fatal - keep defaults on error
        console.debug('Could not set default tab from fetchClassrooms', e);
      }
    } catch (err) {
      console.error('Error fetching classrooms', err);
    } finally {
      setLoading(false);
    }
  };

  // Handler to create a new classroom
  const handleCreateClassroom = async () => {
    console.group('Creating classroom with');
    console.log({ classroomName, classroomCode, color, backgroundFile });
    console.groupEnd();

    // Validate required inputs
    if (!classroomName.trim() || !classroomCode.trim()) {
      toast.error('Please enter both Classroom Name and Code!');
      return;
    }
    if (classroomCode.length < 5 || classroomCode.length > 6) {
      toast.error('Classroom code must be 5-6 characters long!');
      return;
    }

    try {
      let createdClassroom;
      
      // If user chose file upload and selected a file, send multipart form
      if (backgroundImageSource === 'file' && backgroundFile) {
        const formData = new FormData();
        formData.append('name', classroomName);
        formData.append('code', classroomCode);
        formData.append('color', color);
        formData.append('backgroundImage', backgroundFile);
        
        const response = await axios.post('/api/classroom/create', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        createdClassroom = response.data;
      } else {
        // JSON path: use image URL or no image
        const payload = {
          name: classroomName,
          code: classroomCode,
          color: color
        };

        if (backgroundImageSource === 'url' && backgroundImageUrl.trim()) {
          // Normalize URL (add https if no protocol)
          const normalizeUrl = (url) => {
            const trimmed = url.trim();
            if (trimmed.startsWith('http') || trimmed.startsWith('data:')) return trimmed;
            return `https://${trimmed}`;
          };
          payload.backgroundImage = normalizeUrl(backgroundImageUrl);
        }

        const response = await axios.post('/api/classroom/create', payload);
        createdClassroom = response.data;
      }

      toast.success('Classroom Created!');
      
      // Reset form fields
      setClassroomName('');
      setClassroomCode('');
      setColor('#22c55e');
      setBackgroundFile(null);
      setBackgroundImageUrl('');
      setBackgroundImageSource('file');
      
      // Automatically navigate to the created classroom
      navigate(`/classroom/${createdClassroom._id}`);
      
    } catch (err) {
      console.error('Create error:', err);
      toast.error(err.response?.data?.error || 'Error creating classroom');
    }
  };

  // Handler to join classroom via join code
  const handleJoinClassroom = async () => {
    const code = joinClassroomCode.trim();
    if (!joinClassroomCode.trim()) {
      toast.error('Enter a classroom code!');
      return;
    }
    try {
      // POST to join classroom endpoint
      const res = await axios.post('/api/classroom/join', { code: code });
      toast.success('Joined classroom!', { duration: 800 });
      
      // Reset join code input
      setJoinClassroomCode('');
      
      // Automatically navigate to the joined classroom
      navigate(`/classroom/${res.data.classroom._id}`);
      
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error joining classroom');
    }
  };

   // Navigate into a classroom when its card is clicked
  const handleCardClick = (id) => {
    navigate(`/classroom/${id}`);
    toast.success('Entered classroom!');
  };

  // Listen for real-time classroom updates via socket.io and refresh list accordingly
  useEffect(() => {
    socket.on('classroom_update', updated =>
      setClassrooms(prev =>
        prev.map(c => (c._id === updated._id ? updated : c))
      )
    );
    socket.on('notification', note => {
      // For certain notification types, re-fetch classrooms
      if (['classroom_update', 'classroom_removal', 'classroom_deletion'].includes(note.type)) {
        fetchClassrooms();
      }
    });
     // Cleanup listeners on unmount
    return () => {
      socket.off('classroom_update');
      socket.off('notification');
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col p-6">
      <div className="flex-1 space-y-6">
        <h1 className="text-2xl font-bold text-center">Classroom Dashboard</h1>

        {/* Archived Classrooms Button for Teachers - moved to tab */}
        
        {/* Student Tab Switcher */}
        {(role === 'student' || role === 'admin') && (
          <div role="tablist" className="tabs tabs-boxed justify-center">
            <a
              role="tab"
              className={`tab text-xs sm:text-sm ${studentTab === 'join' ? 'tab-active' : ''}`}
              onClick={() => setStudentTab('join')}
            >
              <span className="hidden sm:inline">Join Classroom</span>
              <span className="sm:hidden">Join</span>
            </a>
            <a
              role="tab"
              className={`tab text-xs sm:text-sm ${studentTab === 'classrooms' ? 'tab-active' : ''}`}
              onClick={() => setStudentTab('classrooms')}
            >
              <span className="hidden sm:inline">My Classrooms</span>
              <span className="sm:hidden">Classrooms</span>
            </a>
          </div>
        )}

        {/* Teacher Tab Switcher */}
        {role === 'teacher' && (
          <div role="tablist" className="tabs tabs-boxed justify-center">
            <a
              role="tab"
              className={`tab text-xs sm:text-sm ${teacherTab === 'create' ? 'tab-active' : ''}`}
              onClick={() => setTeacherTab('create')}
            >
              <span className="hidden sm:inline">Create Classroom</span>
              <span className="sm:hidden">Create</span>
            </a>
            <a
              role="tab"
              className={`tab text-xs sm:text-sm ${teacherTab === 'classrooms' ? 'tab-active' : ''}`}
              onClick={() => setTeacherTab('classrooms')}
            >
              <span className="hidden sm:inline">My Classrooms</span>
              <span className="sm:hidden">Classrooms</span>
            </a>
            <a
              role="tab"
              className={`tab text-xs sm:text-sm ${teacherTab === 'archived' ? 'tab-active' : ''}`}
              onClick={() => setTeacherTab('archived')}
            >
              Archived
            </a>
          </div>
        )}

        {/* Student Content */}
        {(role === 'student' || role === 'admin') && (
          <>
            {/* Join Classroom Tab */}
            {studentTab === 'join' && (
              <div className="space-y-2 bg-base-100 p-4 rounded shadow max-w-md mx-auto">
                <h2 className="text-lg font-semibold text-center mb-4">Join a Classroom</h2>
                <input
                  type="text"
                  placeholder="Classroom Code"
                  className="input input-bordered w-full"
                  value={joinClassroomCode}
                  onChange={e => setJoinClassroomCode(e.target.value)}
                />
                <button
                  className="btn btn-success w-full"
                  onClick={handleJoinClassroom}
                >
                  Join Classroom
                </button>
              </div>
            )}

            {/* My Classrooms Tab */}
            {studentTab === 'classrooms' && (
              <div>
                <h2 className="text-xl font-semibold text-center mb-4">My Classrooms</h2>

                <div className="max-w-2xl mx-auto mb-4 flex flex-col sm:flex-row gap-2">
                  <input
                    type="search"
                    placeholder="Search by classroom name or code..."
                    className="input input-bordered w-full"
                    value={searchClassrooms}
                    onChange={e => setSearchClassrooms(e.target.value)}
                  />
                  {/* NEW: include Joined in sort options for students */}
                  <select
                    className="select select-bordered"
                    value={sortField}
                    onChange={e => setSortField(e.target.value)}
                    title="Sort field"
                  >
                    <option value="createdAt">Created</option>
                    <option value="joinedAt">Joined</option>
                    <option value="name">Name</option>
                    <option value="code">Code</option>
                  </select>
                  <button
                    className="btn btn-outline"
                    title="Toggle sort direction"
                    onClick={() => setSortDirection(d => (d === 'asc' ? 'desc' : 'asc'))}
                  >
                    {sortDirection === 'asc' ? 'Asc' : 'Desc'}
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {filteredClassrooms.map(c => {
                    const style = {};
                    let textClass = 'text-black';
                    if (c.color && c.color.toLowerCase() !== '#ffffff') {
                      style.backgroundColor = c.color;
                      textClass = 'text-white';
                    }
                    if (c.backgroundImage) {
                      const imageUrl = resolveBannerSrc(c.backgroundImage);
                      style.backgroundImage = `url(${imageUrl})`;
                      style.backgroundSize = 'cover';
                      style.backgroundPosition = 'center';
                      textClass = 'text-white';
                    }

                    const joinedAt = joinDateMap[c._id] ? new Date(joinDateMap[c._id]).toLocaleString() : '—';

                    return (
                      <div
                        key={c._id}
                        className={`card bg-base-100 shadow cursor-pointer hover:shadow-lg transition-shadow ${textClass}`}
                        style={style}
                        onClick={() => handleCardClick(c._id)}
                      >
                        <div className="card-body">
                          <h2 className="card-title">{c.name}</h2>
                          <p className="text-sm opacity-75">Code: {c.code}</p>
                          {/* NEW: created + joined timestamps */}
                          <p className="text-xs opacity-60">
                            Created: {c.createdAt ? new Date(c.createdAt).toLocaleString() : '—'}
                          </p>
                          <p className="text-xs opacity-60">
                            Joined: {joinedAt}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Teacher Content */}
        {role === 'teacher' && (
          <>
            {/* Create Classroom Tab */}
            {teacherTab === 'create' && (
              <div className="space-y-4 bg-base-100 p-4 rounded shadow max-w-md mx-auto">
                <h2 className="text-lg font-semibold text-center mb-4">Create New Classroom</h2>
                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-1">
                    Classroom Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    placeholder="Enter classroom name"
                    className="input input-bordered w-full"
                    value={classroomName}
                    onChange={e => setClassroomName(e.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor="code" className="block text-sm font-medium mb-1">
                    Classroom Code
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="code"
                      type="text"
                      placeholder="Enter or Generate a class code"
                      className="input input-bordered flex-1"
                      value={classroomCode}
                      onChange={e => setClassroomCode(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setClassroomCode(generateRandomCode())}
                      title="Generate random code"
                    >
                      🎲
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="color" className="block text-sm font-medium mb-1">
                    Theme Color
                  </label>
                  <input
                    id="color"
                    type="color"
                    value={color}
                    onChange={e => setColor(e.target.value)}
                    className="input w-full h-10 p-0 border"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="background" className="block text-sm font-medium">
                    Background Image (Optional)
                  </label>
                  
                  {/* Image source toggle */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="inline-flex rounded-full bg-gray-200 p-1">
                      <button
                        type="button"
                        onClick={() => setBackgroundImageSource('file')}
                        className={`px-3 py-1 rounded-full text-sm transition ${
                          backgroundImageSource === 'file'
                            ? 'bg-white shadow text-gray-900'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        Upload
                      </button>
                      <button
                        type="button"
                        onClick={() => setBackgroundImageSource('url')}
                        className={`ml-1 px-3 py-1 rounded-full text-sm transition ${
                          backgroundImageSource === 'url'
                            ? 'bg-white shadow text-gray-900'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        Use image URL
                      </button>
                    </div>
                  </div>

                  {/* File upload or URL input */}
                  {backgroundImageSource === 'file' ? (
                    <div className="flex items-center gap-2">
                      <input
                        id="background"
                        type="file"
                        accept="image/*"
                        onChange={e => setBackgroundFile(e.target.files[0])}
                        className="file-input file-input-bordered flex-1 file-input-sm"
                      />
                      {backgroundFile && (
                        <img
                          src={URL.createObjectURL(backgroundFile)}
                          alt="Preview"
                          className="w-12 h-12 object-cover rounded border"
                        />
                      )}
                    </div>
                  ) : (
                    <input
                      type="url"
                      placeholder="https://example.com/background.jpg"
                      value={backgroundImageUrl}
                      onChange={e => setBackgroundImageUrl(e.target.value)}
                      className="input input-bordered w-full"
                    />
                  )}

                  <p className="text-sm text-gray-500">
                    Allowed: jpg, png, webp, gif. Max: 5 MB.
                  </p>
                </div>

                <button
                  className="btn btn-success w-full"
                  onClick={handleCreateClassroom}
                >
                  Create Classroom
                </button>
              </div>
            )}

            {/* My Classrooms Tab */}
            {teacherTab === 'classrooms' && (
              <div>
                <h2 className="text-xl font-semibold text-center mb-4">My Classrooms</h2>

                {/* Search + NEW sort controls */}
                <div className="max-w-2xl mx-auto mb-4 flex flex-col sm:flex-row gap-2">
                  <input
                    type="search"
                    placeholder="Search by classroom name or code..."
                    className="input input-bordered w-full"
                    value={searchClassrooms}
                    onChange={e => setSearchClassrooms(e.target.value)}
                  />
                  <select
                    className="select select-bordered"
                    value={sortField}
                    onChange={e => setSortField(e.target.value)}
                    title="Sort field"
                  >
                    <option value="createdAt">Created</option>
                    <option value="name">Name</option>
                    <option value="code">Code</option>
                  </select>
                  <button
                    className="btn btn-outline"
                    title="Toggle sort direction"
                    onClick={() => setSortDirection(d => (d === 'asc' ? 'desc' : 'asc'))}
                  >
                    {sortDirection === 'asc' ? 'Asc' : 'Desc'}
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="card bg-base-200 shadow">
                        <div className="card-body">
                          <div className="skeleton h-6 w-1/2 mb-2"></div>
                          <div className="skeleton h-4 w-1/3"></div>
                        </div>
                      </div>
                    ))
                  ) : filteredClassrooms.length === 0 ? (
                    <div className="col-span-full text-center text-gray-500 py-8">
                      {searchClassrooms ? 'No classrooms match your search.' : "You haven't created any classrooms yet. Create your first classroom to get started!"}
                    </div>
                  ) : (
                    filteredClassrooms.map(c => {
                       const style = {};
                       let textClass = 'text-black';
                       if (c.color && c.color.toLowerCase() !== '#ffffff') {
                         style.backgroundColor = c.color;
                         textClass = 'text-white';
                       }
                       if (c.backgroundImage) {
                         const imageUrl = resolveBannerSrc(c.backgroundImage);
                         style.backgroundImage = `url(${imageUrl})`;
                         style.backgroundSize = 'cover';
                         style.backgroundPosition = 'center';
                         textClass = 'text-white';
                       }

                       return (
                         <div
                           key={c._id}
                           className={`card bg-base-100 shadow cursor-pointer hover:shadow-lg transition-shadow ${textClass}`}
                           style={style}
                           onClick={() => handleCardClick(c._id)}
                         >
                           <div className="card-body">
                             <h2 className="card-title">{c.name}</h2>
                             <p className="text-sm opacity-75">Code: {c.code}</p>
                             {/* NEW: created timestamp */}
                             <p className="text-xs opacity-60">
                               Created: {c.createdAt ? new Date(c.createdAt).toLocaleString() : '—'}
                             </p>
                           </div>
                         </div>
                       );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Archived Classrooms Tab */}
            {teacherTab === 'archived' && (
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-4">Archived Classrooms</h2>
                <p className="text-gray-600 mb-4">
                  View and restore your archived classrooms
                </p>
                <button
                  className="btn btn-neutral"
                  onClick={() => navigate('/classrooms/archived')}
                >
                  View Archived Classrooms
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <Footer />
    </div>
  );
};