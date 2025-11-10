import React, { useState, useEffect, useMemo } from 'react';
import { Award, Lock, Trophy, Plus, Edit2, Trash2, Calendar, TrendingUp, ArrowUp, ArrowDown } from 'lucide-react';
import axios from 'axios';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import ExportButtons from '../components/ExportButtons';
import { resolveBadgeSrc } from '../utils/image';
import socket from '../utils/socket'; // Add this import
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import EmojiPicker from '../components/EmojiPicker'; // Import the new EmojiPicker component

const Badges = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { classroomId } = useParams();
  const { user } = useAuth(); // ← define user

  const viewingStudentId = location.state?.studentId || null;
  const forceCollection = location.state?.view === 'collection' || !!viewingStudentId;
  const isTeacher = (user?.role || '').toLowerCase() === 'teacher';

  // Management mode only when teacher AND not viewing a specific student
  const isManagement = isTeacher && !forceCollection;

  // NEW: state for “whose collection”
  const [collectionStudent, setCollectionStudent] = useState(null);
  const [myXP, setMyXP] = useState(null);
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classroom, setClassroom] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingBadge, setEditingBadge] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    levelRequired: 1,
    icon: '🏅',
    image: null
  });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false); // NEW: state for emoji picker

  // Teacher-specific: student badge data with filters/sorts
  const [studentBadgeData, setStudentBadgeData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all'); // 'all', '1', '2', '3', etc.
  const [badgeFilter, setBadgeFilter] = useState('all'); // 'all', 'hasBadges', 'noBadges'
  const [sortField, setSortField] = useState('name'); // 'name', 'level', 'xp', 'badges'
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'

  useEffect(() => {
    if (!classroomId || !user) return;

    const fetchAll = async () => {
      setLoading(true);
      try {
        // Fetch all badges for this classroom
        const badgesRes = await axios.get(
          `/api/badge/classroom/${classroomId}`,
          { withCredentials: true }
        );
        setBadges(badgesRes.data || []);

        // Fetch classroom info
        const classroomRes = await axios.get(
          `/api/classroom/${classroomId}`,
          { withCredentials: true }
        );
        setClassroom(classroomRes.data);

        if (isManagement) {
          // teacher dashboard fetches (students table, etc.)
          await fetchStudentBadgeData?.(); // keep your existing function if present
        } else {
          // COLLECTION MODE: determine target student (student self or selected)
          const targetId = viewingStudentId || user._id;

          try {
            const res = await axios.get(
              `/api/xp/classroom/${classroomId}/user/${targetId}`,
              { withCredentials: true }
            );
            setMyXP(res.data || null);

            // Try to resolve student’s display name for the banner
            if (targetId !== user._id) {
              const p = await axios.get(`/api/profile/student/${targetId}`, { withCredentials: true });
              setCollectionStudent(p.data || null);
            } else {
              setCollectionStudent(user);
            }
          } catch (e) {
            console.error('Failed to fetch XP for collection view', e);
            setMyXP(null);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [classroomId, user?._id, isManagement, viewingStudentId]);

  const fetchStudentBadgeData = async () => {
    try {
      const res = await axios.get(
        `/api/badge/classroom/${classroomId}/student-progress`,
        { withCredentials: true }
      );
      setStudentBadgeData(res.data || []);
    } catch (err) {
      console.error('Failed to fetch student badge data:', err);
    }
  };

  const fetchBadges = async () => {
    try {
      const res = await axios.get(`/api/badge/classroom/${classroomId}`, {
        withCredentials: true
      });
      setBadges(res.data);
      if (isTeacher) {
        await fetchStudentBadgeData();
      }
    } catch (err) {
      toast.error('Failed to load badges');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const formDataToSend = new FormData();
    formDataToSend.append('name', formData.name);
    formDataToSend.append('description', formData.description);
    formDataToSend.append('levelRequired', formData.levelRequired);
    formDataToSend.append('icon', formData.icon);
    if (formData.image) {
      formDataToSend.append('image', formData.image);
    }

    try {
      if (editingBadge) {
        await axios.patch(`/api/badge/${editingBadge._id}`, formDataToSend, {
          withCredentials: true,
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success('Badge updated successfully');
      } else {
        await axios.post(`/api/badge/classroom/${classroomId}`, formDataToSend, {
          withCredentials: true,
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success('Badge created successfully');
      }
      
      fetchBadges();
      setShowModal(false);
      resetForm();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save badge');
    }
  };

  const handleDelete = async (badgeId) => {
    if (!confirm('Are you sure you want to delete this badge?')) return;
    
    try {
      await axios.delete(`/api/badge/${badgeId}`, { withCredentials: true });
      toast.success('Badge deleted successfully');
      fetchBadges();
    } catch (err) {
      toast.error('Failed to delete badge');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      levelRequired: 1,
      icon: '🏅',
      image: null
    });
    setEditingBadge(null);
  };

  const openEditModal = (badge) => {
    setEditingBadge(badge);
    setFormData({
      name: badge.name,
      description: badge.description,
      levelRequired: badge.levelRequired,
      icon: badge.icon,
      image: null
    });
    setShowModal(true);
  };

  // Filter and sort student data
  const filteredAndSortedStudents = useMemo(() => {
    let filtered = [...studentBadgeData];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(student => {
        const name = `${student.firstName || ''} ${student.lastName || ''}`.trim().toLowerCase();
        const email = student.email.toLowerCase();
        return name.includes(query) || email.includes(query);
      });
    }

    // Level filter
    if (levelFilter !== 'all') {
      const targetLevel = parseInt(levelFilter);
      filtered = filtered.filter(s => s.level === targetLevel);
    }

    // Badge filter
    if (badgeFilter === 'hasBadges') {
      filtered = filtered.filter(s => s.earnedBadges?.length > 0);
    } else if (badgeFilter === 'noBadges') {
      filtered = filtered.filter(s => !s.earnedBadges?.length);
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal, bVal;

      switch (sortField) {
        case 'name':
          aVal = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
          bVal = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase();
          break;
        case 'level':
          aVal = a.level || 0;
          bVal = b.level || 0;
          break;
        case 'xp':
          aVal = a.xp || 0;
          bVal = b.xp || 0;
          break;
        case 'badges':
          aVal = a.earnedBadges?.length || 0;
          bVal = b.earnedBadges?.length || 0;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [studentBadgeData, searchQuery, levelFilter, badgeFilter, sortField, sortDirection]);

  // Export functions
  const exportStudentProgressToCSV = async () => {
    const data = filteredAndSortedStudents.map(s => ({
      'Student Name': `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.email,
      'Email': s.email,
      'Level': s.level || 1,
      'XP': s.xp || 0,
      'Badges Earned': s.earnedBadges?.length || 0,
      'Total Badges': badges.length,
      'Next Badge': s.nextBadge?.name || 'All earned',
      'XP Until Next Badge': s.xpUntilNextBadge || 0,
      'Levels Until Next Badge': s.levelsUntilNextBadge || 0
    }));

    const headers = Object.keys(data[0] || {});
    const csvRows = data.map(row => 
      headers.map(h => {
        const val = row[h];
        return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
      }).join(',')
    );

    const csv = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${classroom?.name || 'classroom'}_${classroom?.code || classroomId}_badge_progress_${timestamp}.csv`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return filename;
  };

  const exportStudentProgressToJSON = async () => {
    const data = filteredAndSortedStudents.map(s => ({
      studentId: s._id,
      name: `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.email,
      email: s.email,
      level: s.level || 1,
      xp: s.xp || 0,
      earnedBadges: s.earnedBadges?.map(eb => ({
        badgeId: eb.badge,
        earnedAt: eb.earnedAt
      })) || [],
      badgesEarnedCount: s.earnedBadges?.length || 0,
      totalBadges: badges.length,
      nextBadge: s.nextBadge ? {
        name: s.nextBadge.name,
        icon: s.nextBadge.icon,
        levelRequired: s.nextBadge.levelRequired
      } : null,
      xpUntilNextBadge: s.xpUntilNextBadge || 0,
      levelsUntilNextBadge: s.levelsUntilNextBadge || 0
    }));

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${classroom?.name || 'classroom'}_${classroom?.code || classroomId}_badge_progress_${timestamp}.json`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return filename;
  };

  // Get unique levels for filter dropdown
  const uniqueLevels = useMemo(() => {
    const levels = new Set(studentBadgeData.map(s => s.level || 1));
    return Array.from(levels).sort((a, b) => a - b);
  }, [studentBadgeData]);

  useEffect(() => {
    const handleFocus = () => {
      // Force refetch badge data when window regains focus
      fetchBadges();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [classroomId]);

  useEffect(() => {
    if (!classroomId || !user) return;

    const handleBadgeEarned = (data) => {
      if (String(data.userId) === String(user._id)) {
        toast.success(`🏆 You earned a badge: ${data.badgeName}`);
        // Refetch badges to update the UI
        fetchBadges();
      }
    };

    socket.on('badge_earned', handleBadgeEarned);
    
    return () => {
      socket.off('badge_earned', handleBadgeEarned);
    };
  }, [classroomId, user]);

  // Compute earned/locked using appropriate source
  const earnedBadgeIds = (isManagement
    ? [] // management view uses the table, not the collection grid
    : (myXP?.earnedBadges || []).map(b => String(b.badge)));

  const earnedBadges = (badges || []).filter(b => earnedBadgeIds.includes(String(b._id)));
  const lockedBadges = (badges || []).filter(b => !earnedBadgeIds.includes(String(b._id)));

  // Determine navigation source and back link BEFORE any early returns
  const source = location.state?.source || null;
  const backLink = useMemo(() => {
    if (source === 'leaderboard') {
      return { to: `/classroom/${classroomId}/leaderboard`, label: '← Back to Leaderboard' };
    }
    if (source === 'badges') {
      return { to: `/classroom/${classroomId}/badges`, label: '← Back to Badges' };
    }
    return { to: `/classroom/${classroomId}/people`, label: '← Back to People' };
  }, [source, classroomId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 p-6 space-y-8">
        {/* TEACHER MANAGEMENT DASHBOARD */}
        {isManagement && (
          <>
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-2">
                <Link 
                  to={`/classroom/${classroomId}`}
                  className="link link-hover text-sm"
                >
                  ← Back to Classroom
                </Link>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-4xl font-bold flex items-center gap-3">
                    <Trophy className="w-10 h-10 text-yellow-500" />
                    Badge Management
                  </h1>
                  {classroom && (
                    <p className="text-base-content/70 mt-2">
                      {classroom.name} {classroom.code && `(${classroom.code})`}
                    </p>
                  )}
                </div>
                
                {/* Teacher: Create Badge Button */}
                {isTeacher && (
                  <button
                    className="btn btn-primary gap-2"
                    onClick={() => {
                      resetForm();
                      setShowModal(true);
                    }}
                  >
                    <Plus className="w-5 h-5" />
                    Create Badge
                  </button>
                )}
              </div>
            </div>

            {/* Badge List */}
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <h2 className="card-title text-2xl mb-4">
                  All Badges ({badges.length})
                </h2>
                
                {badges.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Award className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>No badges created yet. Click "Create Badge" to get started!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {badges.map((badge) => (
                      <div 
                        key={badge._id}
                        className="card bg-base-200 border-2 border-primary/20 shadow-md hover:shadow-lg transition-all"
                      >
                        <div className="card-body">
                          <div className="flex justify-between items-start">
                            <div className="text-5xl mb-2">{badge.icon}</div>
                            <div className="flex gap-2">
                              <button
                                className="btn btn-sm btn-ghost"
                                onClick={() => openEditModal(badge)}
                                title="Edit badge"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                className="btn btn-sm btn-ghost text-error"
                                onClick={() => handleDelete(badge._id)}
                                title="Delete badge"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <h3 className="card-title text-lg">{badge.name}</h3>
                          <p className="text-sm text-base-content/70 mb-2">
                            {badge.description}
                          </p>
                          <div className="badge badge-primary gap-2">
                            <Lock className="w-3 h-3" />
                            Level {badge.levelRequired} Required
                          </div>
                          {badge.image && (
                            <img 
                              src={resolveBadgeSrc(badge.image)}
                              alt={badge.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                // Fallback to showing just the icon if image fails
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Student Progress Dashboard */}
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="card-title text-2xl">
                    Student Badge Progress
                  </h2>
                  
                  {/* Export Buttons */}
                  <ExportButtons
                    onExportCSV={exportStudentProgressToCSV}
                    onExportJSON={exportStudentProgressToJSON}
                    userName={classroom?.name || 'badge_progress'}
                    exportLabel="badge_progress"
                  />
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {/* Search */}
                  <input
                    type="text"
                    placeholder="Search students..."
                    className="input input-bordered flex-1 min-w-[200px]"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />

                  {/* Level Filter */}
                  <select
                    className="select select-bordered"
                    value={levelFilter}
                    onChange={(e) => setLevelFilter(e.target.value)}
                  >
                    <option value="all">All Levels</option>
                    {uniqueLevels.map(level => (
                      <option key={level} value={level}>Level {level}</option>
                    ))}
                  </select>

                  {/* Badge Filter */}
                  <select
                    className="select select-bordered"
                    value={badgeFilter}
                    onChange={(e) => setBadgeFilter(e.target.value)}
                  >
                    <option value="all">All Students</option>
                    <option value="hasBadges">Has Badges</option>
                    <option value="noBadges">No Badges</option>
                  </select>

                  {/* Sort Field */}
                  <select
                    className="select select-bordered"
                    value={sortField}
                    onChange={(e) => setSortField(e.target.value)}
                  >
                    <option value="name">Sort by Name</option>
                    <option value="level">Sort by Level</option>
                    <option value="xp">Sort by XP</option>
                    <option value="badges">Sort by Badges</option>
                  </select>

                  {/* Sort Direction */}
                  <button
                    className="btn btn-outline gap-2"
                    onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                  >
                    {sortDirection === 'asc' ? (
                      <>
                        <ArrowUp className="w-4 h-4" />
                        Asc
                      </>
                    ) : (
                      <>
                        <ArrowDown className="w-4 h-4" />
                        Desc
                      </>
                    )}
                  </button>

                  {/* Clear Filters */}
                  {(searchQuery || levelFilter !== 'all' || badgeFilter !== 'all') && (
                    <button
                      className="btn btn-ghost"
                      onClick={() => {
                        setSearchQuery('');
                        setLevelFilter('all');
                        setBadgeFilter('all');
                      }}
                    >
                      Clear Filters
                    </button>
                  )}
                </div>

                {/* Student List */}
                <div className="overflow-x-auto">
                  <table className="table table-zebra w-full">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Level</th>
                        <th>XP</th>
                        <th>Badges Earned</th>
                        <th>Next Badge</th>
                        <th>XP Until Next Badge</th>
                        {/* NEW: actions column */}
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAndSortedStudents.length === 0 ? (
                        <tr>
                          {/* updated colSpan from 6 -> 7 */}
                          <td colSpan="7" className="text-center text-base-content/60 py-8">
                            {searchQuery || levelFilter !== 'all' || badgeFilter !== 'all' 
                              ? 'No students match the current filters' 
                              : 'No student data available'}
                          </td>
                        </tr>
                      ) : (
                        filteredAndSortedStudents.map((student) => (
                          <tr key={student._id}>
                            <td>
                              <div>
                                <div className="font-semibold">
                                  {student.firstName || student.lastName
                                    ? `${student.firstName || ''} ${student.lastName || ''}`.trim()
                                    : student.email}
                                </div>
                                <div className="text-xs text-base-content/60">{student.email}</div>
                              </div>
                            </td>
                            <td>
                              <div className="badge badge-primary">
                                Level {student.level || 1}
                              </div>
                            </td>
                            <td>{student.xp || 0} XP</td>
                            <td>
                              {/* Badges earned + quick link to collection */}
                              <div className="flex items-center gap-2">
                                <Award className="w-4 h-4 text-yellow-500" />
                                <span>{student.earnedBadges?.length || 0} / {badges.length}</span>
                                <button
                                  className="btn btn-ghost btn-xs"
                                  onClick={() =>
                                    navigate(`/classroom/${classroomId}/badges`, {
                                      state: {
                                        studentId: student._id,
                                        view: 'collection',
                                        source: 'badges' // for back link
                                      }
                                    })
                                  }
                                  title="View Badge Collection"
                                >
                                  🏅 Collection
                                </button>
                              </div>
                            </td>
                            <td>
                              {student.nextBadge ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-2xl">{student.nextBadge.icon}</span>
                                  <div>
                                    <div className="font-medium">{student.nextBadge.name}</div>
                                    <div className="text-xs text-base-content/60">
                                      Level {student.nextBadge.levelRequired}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-500 italic">All badges earned!</span>
                              )}
                            </td>
                            <td>
                              {student.nextBadge ? (
                                <div>
                                  <div className="flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-blue-500" />
                                    <span className="font-semibold">{student.xpUntilNextBadge || 0} XP</span>
                                  </div>
                                  <div className="text-xs text-base-content/60">
                                    {student.levelsUntilNextBadge || 0} level(s) needed
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-500">—</span>
                              )}
                            </td>
                            {/* NEW: actions per student */}
                            <td>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  className="btn btn-xs btn-outline"
                                  onClick={() =>
                                    navigate(`/classroom/${classroomId}/profile/${student._id}`, {
                                      state: { from: 'badges', classroomId }
                                    })
                                  }
                                >
                                  Profile
                                </button>
                                <button
                                  className="btn btn-xs btn-success"
                                  onClick={() =>
                                    navigate(`/classroom/${classroomId}/student/${student._id}/stats`, {
                                      state: { from: 'badges' }
                                    })
                                  }
                                >
                                  View Stats
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Results count */}
                {filteredAndSortedStudents.length > 0 && (
                  <div className="text-sm text-base-content/60 mt-4">
                    Showing {filteredAndSortedStudents.length} of {studentBadgeData.length} students
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* COLLECTION MODE (student or teacher viewing a student) */}
        {!isManagement && (
          <>
            {/* Page Header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Link 
                  to={backLink.to}
                  className="link link-hover text-sm"
                >
                  {backLink.label}
                </Link>
                {isTeacher && viewingStudentId && (
                  <button
                    className="btn btn-xs btn-outline ml-auto"
                    onClick={() => navigate(`/classroom/${classroomId}/badges`, { replace: true })}
                  >
                    Back to All Students
                  </button>
                )}
              </div>
              <h1 className="text-3xl font-bold">
                {classroom ? `${classroom.name}${classroom.code ? ` (${classroom.code})` : ''} — ` : ''}
                {(() => {
                  const displayName = collectionStudent
                    ? (`${collectionStudent.firstName || ''} ${collectionStudent.lastName || ''}`.trim() || collectionStudent.email)
                    : (user?.firstName || user?.lastName ? `${user?.firstName || ''} ${user?.lastName || ''}`.trim() : 'Student');
                  return viewingStudentId ? `${displayName} Badge Collection` : 'Your Badge Collection';
                })()}
              </h1>
            </div>

            {/* Stats Overview */}
            <div className="stats stats-horizontal shadow w-full">
              <div className="stat">
                <div className="stat-title">Badges Earned</div>
                <div className="stat-value text-success">
                  {earnedBadges.length}
                </div>
              </div>
              <div className="stat">
                <div className="stat-title">Total Badges</div>
                <div className="stat-value">{badges.length}</div>
              </div>
              <div className="stat">
                <div className="stat-title">Completion</div>
                <div className="stat-value text-primary">
                  {badges.length > 0 
                    ? Math.round((earnedBadges.length / badges.length) * 100)
                    : 0}%
                </div>
              </div>
            </div>

            {/* Earned Badges */}
            {earnedBadges.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <Award className="w-6 h-6 text-yellow-500" />
                  Earned Badges ({earnedBadges.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {earnedBadges.map((badge) => {
                    // Use myXP for collection view; fall back to table data if available
                    const earnedInfo =
                      (myXP?.earnedBadges || []).find(
                        eb => String(eb.badge) === String(badge._id)
                      ) ||
                      studentBadgeData
                        ?.find(s => String(s._id) === String(viewingStudentId || user._id))
                        ?.earnedBadges?.find(eb => String(eb.badge) === String(badge._id));
                    return (
                      <div 
                        key={badge._id}
                        className="card bg-gradient-to-br from-yellow-50 to-amber-50 border-2 border-yellow-300 shadow-lg hover:shadow-xl transition-all duration-200"
                      >
                        <div className="card-body items-center text-center">
                          {/* Icon at top */}
                          <div className="text-6xl mb-3 animate-bounce">
                            {badge.icon}
                          </div>
                          {/* Image below icon */}
                          {badge.image && (
                            <img 
                              src={resolveBadgeSrc(badge.image)}
                              alt={badge.name}
                              className="w-full h-32 object-cover rounded-lg mb-3"
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          )}
                          
                          <h3 className="card-title text-lg">{badge.name}</h3>
                          <p className="text-sm text-base-content/80 mb-2">
                            {badge.description}
                          </p>
                          <div className="badge badge-success gap-2">
                            <Award className="w-3 h-3" />
                            Level {badge.levelRequired}
                          </div>
                          {/* Show earned date sourced from myXP */}
                          {earnedInfo?.earnedAt && (
                            <div className="flex items-center gap-1 text-xs text-base-content/60 mt-2">
                              <Calendar className="w-3 h-3" />
                              {new Date(earnedInfo.earnedAt).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Locked Badges */}
            {lockedBadges.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <Lock className="w-6 h-6 text-gray-500" />
                  Locked Badges ({lockedBadges.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {lockedBadges.map((badge) => {
                    // Use the fetched XP (works for students and teacher viewing a student)
                    const currentLevel = myXP?.level || 1; // ← remove undefined "current"
                    const levelsNeeded = Math.max(0, badge.levelRequired - currentLevel);
                    return (
                      <div 
                        key={badge._id}
                        className="card bg-base-100 border-2 border-gray-300 shadow-md opacity-70 hover:opacity-100 transition-opacity"
                      >
                        <div className="card-body items-center text-center">
                          {/* Icon at top with grayscale */}
                          <div className="text-6xl mb-3 filter grayscale">
                            {badge.icon}
                          </div>
                          
                          {/* Image below icon with lock overlay */}
                          {badge.image && (
                            <div className="relative w-full mb-3">
                              <img 
                                src={resolveBadgeSrc(badge.image)}
                                alt={badge.name}
                                className="w-full h-32 object-cover rounded-lg filter grayscale"
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                              <Lock className="w-8 h-8 text-error absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                            </div>
                          )}
                          
                          <h3 className="card-title text-lg text-base-content/80">{badge.name}</h3>
                          <p className="text-sm text-base-content/60 mb-2">
                            {badge.description}
                          </p>
                          <div className="badge badge-error gap-2">
                            <Lock className="w-3 h-3" />
                            Level {badge.levelRequired}
                          </div>
                          {levelsNeeded > 0 && (
                            <p className="text-xs text-base-content/60 mt-2">
                              {levelsNeeded} level{levelsNeeded !== 1 ? 's' : ''} to unlock
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty State */}
            {badges.length === 0 && (
              <div className="card bg-base-100 shadow-lg">
                <div className="card-body items-center text-center">
                  <Award className="w-16 h-16 text-base-content/50 mb-4" />
                  <h3 className="text-xl font-bold">No Badges Yet</h3>
                  <p className="text-base-content/70">
                    Your teacher hasn't created any badges for this classroom yet.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Badge Creation/Edit Modal (Teacher Only) */}
      {isTeacher && showModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl relative">
            {/* Emoji picker popover */}
            {showEmojiPicker && (
              <EmojiPicker
                onSelect={(emoji) => setFormData(f => ({ ...f, icon: emoji }))}
                onClose={() => setShowEmojiPicker(false)}
              />
            )}
            <h3 className="font-bold text-lg mb-4">
              {editingBadge ? 'Edit Badge' : 'Create Badge'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Badge Name</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  maxLength={100}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Description</span>
                </label>
                <textarea
                  className="textarea textarea-bordered"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  maxLength={500}
                  rows={3}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Level Required</span>
                </label>
                <input
                  type="number"
                  className="input input-bordered"
                  value={formData.levelRequired}
                  onChange={(e) => setFormData({ ...formData, levelRequired: parseInt(e.target.value) })}
                  min={1}
                  required
                />
              </div>

              <div className="form-control relative">
                <label className="label">
                  <span className="label-text">Icon (Emoji)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="input input-bordered flex-1"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    maxLength={4}
                  />
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setShowEmojiPicker(v => !v)}
                    title="Pick Emoji"
                  >
                    {formData.icon || '😀'}
                  </button>
                </div>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Badge Image (Optional)</span>
                </label>
                <input
                  type="file"
                  className="file-input file-input-bordered"
                  accept="image/*"
                  onChange={(e) => setFormData({ ...formData, image: e.target.files[0] })}
                />
              </div>

              <div className="modal-action">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingBadge ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default Badges;