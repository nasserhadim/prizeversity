import React, { useState, useEffect, useMemo } from 'react';
import { Award, Lock, Trophy, Plus, Edit2, Trash2, Calendar, TrendingUp, ArrowUp, ArrowDown, Package, Save } from 'lucide-react';
import axios from 'axios';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import ExportButtons from '../components/ExportButtons';
import { resolveBadgeSrc } from '../utils/image';
import socket from '../utils/socket'; // Add this import
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import EmojiPicker from '../components/EmojiPicker'; // Import the new EmojiPicker component
import { getBadgeTemplates, saveBadgeTemplate, deleteBadgeTemplate, applyBadgeTemplate } from '../API/apiBadgeTemplate';
import ConfirmModal from '../components/ConfirmModal';

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
    levelRequired: 2,
    icon: '🏅',
    image: null
  });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false); // NEW: state for emoji picker
  // NEW: support URL or file for badge image
  const [imageSource, setImageSource] = useState('file'); // 'file' | 'url'
  const [imageUrl,   setImageUrl]   = useState('');

  // Teacher-specific: student badge data with filters/sorts
  const [studentBadgeData, setStudentBadgeData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all'); // 'all', '1', '2', '3', etc.
  const [badgeFilter, setBadgeFilter] = useState('all'); // 'all', 'hasBadges', 'noBadges'
  const [sortField, setSortField] = useState('name'); // 'name', 'level', 'xp', 'badges'
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'

  // NEW: badge template states
  const [badgeTemplates, setBadgeTemplates] = useState([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deleteTemplateModal, setDeleteTemplateModal] = useState(null);
  // NEW: search/sort state
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateSort, setTemplateSort] = useState('createdDesc'); // createdDesc|createdAsc|nameAsc|nameDesc|badgesDesc|badgesAsc

  // NEW: badge management filters
  const [badgeSearch, setBadgeSearch] = useState('');
  const [badgeSort, setBadgeSort] = useState('addedDesc'); // addedDesc|addedAsc|nameAsc|nameDesc|levelAsc|levelDesc

  // NEW: deep match helper (name + description + level + icon)
  const deepMatchesBadge = (badge, term) => {
    const q = (term || '').trim().toLowerCase();
    if (!q) return true;
    const parts = [
      badge.name || '',
      badge.description || '',
      String(badge.levelRequired || ''),
      badge.icon || ''
    ].join(' ').toLowerCase();
    return parts.includes(q);
  };

  // NEW: sorted + filtered badges for management grid
  const sortedFilteredBadges = useMemo(() => {
    const list = (badges || []).filter(b => deepMatchesBadge(b, badgeSearch));
    list.sort((a, b) => {
      switch (badgeSort) {
        case 'addedDesc': return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        case 'addedAsc':  return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        case 'nameAsc':   return (a.name || '').localeCompare(b.name || '');
        case 'nameDesc':  return (b.name || '').localeCompare(a.name || '');
        case 'levelAsc':  return (a.levelRequired || 0) - (b.levelRequired || 0);
        case 'levelDesc': return (b.levelRequired || 0) - (a.levelRequired || 0);
        default: return 0;
      }
    });
    return list;
  }, [badges, badgeSearch, badgeSort]);

  // NEW: bulk delete (teacher)
  const [confirmDeleteAllBadges, setConfirmDeleteAllBadges] = useState(false);
  const [bulkDeletingBadges, setBulkDeletingBadges] = useState(false);

  const handleBulkDeleteBadges = async () => {
    setBulkDeletingBadges(true);
    try {
      const toDelete = sortedFilteredBadges.map(b => b._id);
      await Promise.all(toDelete.map(id => axios.delete(`/api/badge/${id}`, { withCredentials: true })));
      toast.success(`Deleted ${toDelete.length} badge(s)`);
      // Refresh
      fetchBadges();
      setConfirmDeleteAllBadges(false);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Bulk delete failed');
    } finally {
      setBulkDeletingBadges(false);
    }
  };

  // NEW: bulk delete badge templates
  const [confirmDeleteAllBadgeTemplates, setConfirmDeleteAllBadgeTemplates] = useState(false);
  const [bulkDeletingBadgeTemplates, setBulkDeletingBadgeTemplates] = useState(false);

  const handleBulkDeleteBadgeTemplates = async () => {
    try {
      setBulkDeletingBadgeTemplates(true);

      const ids = (filteredSortedBadgeTemplates || []).map(t => t._id).filter(Boolean);
      if (!ids.length) {
        toast.error('No templates to delete');
        return;
      }

      const results = await Promise.allSettled(ids.map(id => deleteBadgeTemplate(id)));
      const deleted = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.length - deleted;

      if (deleted) toast.success(`Deleted ${deleted} template(s)`);
      if (failed) toast.error(`Failed to delete ${failed} template(s)`);

      const res = await getBadgeTemplates();
      setBadgeTemplates(res.templates || []);
      setConfirmDeleteAllBadgeTemplates(false);
    } catch (e) {
      toast.error(e?.message || 'Failed to delete templates');
    } finally {
      setBulkDeletingBadgeTemplates(false);
    }
  };

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

    // common fields
    const base = {
      name: formData.name,
      description: formData.description,
      levelRequired: formData.levelRequired,
      icon: formData.icon
    };

    try {
      if (imageSource === 'file' && formData.image) {
        // multipart path
        const fd = new FormData();
        Object.entries(base).forEach(([k, v]) => fd.append(k, v));
        fd.append('image', formData.image);

        if (editingBadge) {
          await axios.patch(`/api/badge/${editingBadge._id}`, fd, {
            withCredentials: true,
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          toast.success('Badge updated successfully');
        } else {
          await axios.post(`/api/badge/classroom/${classroomId}`, fd, {
            withCredentials: true,
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          toast.success('Badge created successfully');
        }
      } else {
        // JSON path (optional image URL)
        const payload = { ...base };
        if (imageSource === 'url' && imageUrl.trim()) {
          payload.image = imageUrl.trim();
        }

        if (editingBadge) {
          await axios.patch(`/api/badge/${editingBadge._id}`, payload, { withCredentials: true });
          toast.success('Badge updated successfully');
        } else {
          await axios.post(`/api/badge/classroom/${classroomId}`, payload, { withCredentials: true });
          toast.success('Badge created successfully');
        }
      }

      fetchBadges();
      setShowModal(false);
      resetForm();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save badge');
    }
  };

  const [confirmDeleteBadge, setConfirmDeleteBadge] = useState(null);

  const handleDelete = async (badgeId) => {
    setConfirmDeleteBadge({ id: badgeId });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      levelRequired: 2,
      icon: '🏅',
      image: null
    });
    setEditingBadge(null);
    // NEW
    setImageSource('file');
    setImageUrl('');
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
    // NEW: default to file; teacher can switch to URL if they want to replace image via URL
    setImageSource('file');
    setImageUrl('');
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

  useEffect(() => {
    // teacher only
    if (!isTeacher) return;
    (async () => {
      try {
        const res = await getBadgeTemplates();
        setBadgeTemplates(res.templates || []);
      } catch {}
    })();
  }, [isTeacher]);

  // NEW: filtered + sorted templates (like Bazaar)
  const filteredSortedBadgeTemplates = useMemo(() => {
    const q = (templateSearch || '').trim().toLowerCase();
    const deepMatch = (t) => {
      if (!q) return true;
      const parts = [
        t.name || '',
        t.sourceClassroom?.name || '',
        t.sourceClassroom?.code || '',
        String((t.badges || []).length || 0),
        t.createdAt ? new Date(t.createdAt).toLocaleString() : ''
      ].join(' ').toLowerCase();
      return parts.includes(q);
    };
    const list = (badgeTemplates || []).filter(deepMatch);
    list.sort((a, b) => {
      const ac = new Date(a.createdAt || 0), bc = new Date(b.createdAt || 0);
      const an = (a.name || ''), bn = (b.name || '');
      const ai = (a.badges?.length || 0), bi = (b.badges?.length || 0);
      switch (templateSort) {
        case 'createdDesc': return bc - ac;
        case 'createdAsc':  return ac - bc;
        case 'nameAsc':     return an.localeCompare(bn);
        case 'nameDesc':    return bn.localeCompare(an);
        case 'badgesDesc':  return bi - ai;
        case 'badgesAsc':   return ai - bi;
        default: return 0;
      }
    });
    return list;
  }, [badgeTemplates, templateSearch, templateSort]);

  // NEW: student collection search/sort
  const [collectionSearch, setCollectionSearch] = useState('');
  const [collectionSort, setCollectionSort] = useState('levelAsc'); // levelAsc|levelDesc|nameAsc|nameDesc|addedDesc|addedAsc

  // Helper: deep match by name/description/level/icon
  const deepMatchBadge = (b, q) => {
    const term = (q || '').trim().toLowerCase();
    if (!term) return true;
    return [
      b.name || '',
      b.description || '',
      String(b.levelRequired || ''),
      b.icon || ''
    ].join(' ').toLowerCase().includes(term);
  };

  // Helper: sort badges
  const sortBadges = (list, sort) => {
    const arr = list.slice();
    arr.sort((a, b) => {
      switch (sort) {
        case 'levelAsc':  return (a.levelRequired || 0) - (b.levelRequired || 0);
        case 'levelDesc': return (b.levelRequired || 0) - (a.levelRequired || 0);
        case 'nameAsc':   return (a.name || '').localeCompare(b.name || '');
        case 'nameDesc':  return (b.name || '').localeCompare(a.name || '');
        case 'addedDesc': return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        case 'addedAsc':  return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        default: return 0;
      }
    });
    return arr;
  };

  // Derive filtered+sorted lists for student view
  const earnedFilteredSorted = useMemo(() => {
    const base = (badges || []).filter(b => earnedBadgeIds.includes(String(b._id)));
    return sortBadges(base.filter(b => deepMatchBadge(b, collectionSearch)), collectionSort);
  }, [badges, earnedBadgeIds, collectionSearch, collectionSort]);

  const lockedFilteredSorted = useMemo(() => {
    const base = (badges || []).filter(b => !earnedBadgeIds.includes(String(b._id)));
    return sortBadges(base.filter(b => deepMatchBadge(b, collectionSearch)), collectionSort);
  }, [badges, earnedBadgeIds, collectionSearch, collectionSort]);

  const formatBadgeTemplateApplyMessage = (res) => {
    const s = res?.summary;
    if (!s) return res?.message || 'Template applied.';

    const parts = [];
    parts.push(`Applied template. Created ${s.createdTotal} badge(s), skipped ${s.skippedTotal}.`);

    if (s.skippedTotal > 0) {
      const reasons = s.skippedByReason || {};
      const reasonText = Object.entries(reasons)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      if (reasonText) parts.push(`(${reasonText}).`);

      if (Array.isArray(s.topSkippedNames) && s.topSkippedNames.length) {
        parts.push(`Examples: ${s.topSkippedNames.join(', ')}${s.skippedTotal > s.topSkippedNames.length ? ', …' : ''}`);
      }
    }

    return parts.join(' ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
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
             <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
                 <div className="flex flex-wrap gap-2 w-full sm:w-auto sm:justify-end">
                    <button
                      className="btn btn-primary gap-2 w-full sm:w-auto"
                      onClick={() => {
                        resetForm();
                        setShowModal(true);
                      }}
                    >
                      <Plus className="w-5 h-5" />
                      Create Badge
                    </button>
                    <button className="btn btn-sm btn-outline gap-2 w-full sm:w-auto" onClick={() => setShowTemplateModal(true)}>
                      <Save className="w-4 h-4" /> Save as Template
                    </button>
                    {badgeTemplates.length > 0 && (
                     <button className="btn btn-sm btn-outline btn-info gap-2 w-full sm:w-auto" onClick={() => setShowApplyModal(true)}>
                        <Package className="w-4 h-4" /> View Templates ({badgeTemplates.length})
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Badge List */}
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <h2 className="card-title text-2xl">
                    All Badges ({sortedFilteredBadges.length}/{badges.length})
                  </h2>
                  {isManagement && (
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="search"
                        placeholder="Deep search badges..."
                        className="input input-bordered w-full sm:w-56"
                        value={badgeSearch}
                        onChange={(e) => setBadgeSearch(e.target.value)}
                      />
                      <select
                        className="select select-bordered w-40"
                        value={badgeSort}
                        onChange={(e) => setBadgeSort(e.target.value)}
                      >
                        <option value="nameAsc">Name ↑</option>
                        <option value="nameDesc">Name ↓</option>
                        <option value="levelAsc">Level ↑</option>
                        <option value="levelDesc">Level ↓</option>
                        <option value="addedDesc">Added: Newest</option>
                        <option value="addedAsc">Added: Oldest</option>
                      </select>
                      {sortedFilteredBadges.length > 0 && (
                        <button
                          className="btn btn-outline btn-error gap-2"
                          onClick={() => setConfirmDeleteAllBadges(true)}
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete {sortedFilteredBadges.length === badges.length ? 'All' : 'Filtered'}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {badges.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Award className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>No badges created yet. Click "Create Badge" to get started!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   {sortedFilteredBadges.map((badge) => (
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

                          {/* Optional image (shown under icon) */}
                          {badge.image && (
                            <img
                              src={resolveBadgeSrc(badge.image)}
                              alt={badge.name}
                              className="w-full max-h-40 object-contain mb-2"
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                // Hide broken image, keep the emoji icon
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          )}

                          <h3 className="card-title text-lg badge-name break-words">{badge.name}</h3>
                          <p className="text-sm text-base-content/70 mb-2 badge-description">
                            {badge.description}
                          </p>
                          <div className="badge badge-primary gap-2">
                            <Lock className="w-3 h-3" />
                            Level {badge.levelRequired}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Confirm bulk delete badges */}
            {confirmDeleteAllBadges && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="card bg-base-100 w-full max-w-md shadow-xl border border-base-300">
                  <div className="card-body space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-error">Confirm Delete</h3>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => !bulkDeletingBadges && setConfirmDeleteAllBadges(false)}
                      >✕</button>
                    </div>
                    <p className="text-sm">
                      Delete <strong>{sortedFilteredBadges.length}</strong> badge(s)?
                      {sortedFilteredBadges.length < badges.length && (
                        <span className="block mt-2 text-warning">
                          This will delete only the currently filtered badges, not all badges.
                        </span>
                      )}
                    </p>
                    <div className="card-actions justify-end gap-2">
                      <button
                        className="btn btn-sm"
                        disabled={bulkDeletingBadges}
                        onClick={() => setConfirmDeleteAllBadges(false)}
                      >Cancel</button>
                      <button
                        className="btn btn-sm btn-error"
                        disabled={bulkDeletingBadges}
                        onClick={handleBulkDeleteBadges}
                      >
                        {bulkDeletingBadges ? <span className="loading loading-spinner loading-xs" /> : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

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

            {/* INSERT controls below stats for student view */}
            <div className="flex flex-wrap items-center gap-2 my-4">
              <input
                type="search"
                placeholder="Deep search badges..."
                className="input input-bordered flex-1 min-w-[220px]"
                value={collectionSearch}
                onChange={(e) => setCollectionSearch(e.target.value)}
              />
              <select
                className="select select-bordered w-40"
                value={collectionSort}
                onChange={(e) => setCollectionSort(e.target.value)}
              >
                <option value="levelAsc">Level ↑</option>
                <option value="levelDesc">Level ↓</option>
                <option value="nameAsc">Name ↑</option>
                <option value="nameDesc">Name ↓</option>
                <option value="addedDesc">Added: Newest</option>
                <option value="addedAsc">Added: Oldest</option>
              </select>
            </div>

            {/* Earned Badges */}
            {earnedBadges.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <Award className="w-6 h-6 text-yellow-500" />
                  Earned Badges ({earnedFilteredSorted.length}/{earnedBadges.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {earnedFilteredSorted.map((badge) => {
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
                              className="w-full max-h-40 object-contain mb-3"
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          )}
                          
                          <h3 className="card-title text-lg badge-name">{badge.name}</h3>
                          <p className="text-sm text-base-content/80 mb-2 badge-description">
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
                              {new Date(earnedInfo.earnedAt).toLocaleString()}
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
                  Locked Badges ({lockedFilteredSorted.length}/{lockedBadges.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {lockedFilteredSorted.map((badge) => {
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
                                className="w-full max-h-40 object-contain filter grayscale"
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                              <Lock className="w-8 h-8 text-error absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                            </div>
                          )}
                          
                          <h3 className="card-title text-lg text-base-content/80 badge-name break-words">{badge.name}</h3>
                          <p className="text-sm text-base-content/60 mb-2 badge-description">
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
                  min={2}
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

              {/* Badge Image (Optional) */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Badge Image (Optional)</span>
                </label>

                {/* Toggle: Upload first, then URL */}
                <div className="inline-flex rounded-full bg-gray-200 p-1 mb-2">
                  <button
                    type="button"
                    onClick={() => setImageSource('file')}
                    className={`px-3 py-1 rounded-full text-sm transition ${imageSource === 'file' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    Upload
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageSource('url')}
                    className={`ml-1 px-3 py-1 rounded-full text-sm transition ${imageSource === 'url' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    Use image URL
                  </button>
                </div>

                {imageSource === 'file' ? (
                  <>
                    <input
                      type="file"
                      className="file-input file-input-bordered"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={(e) => setFormData({ ...formData, image: e.target.files[0] })}
                    />
                    <p className="text-xs text-gray-500 mt-1">Allowed: jpg, png, webp, gif. Max: 5 MB.</p>
                  </>
                ) : (
                  <>
                    <input
                      type="url"
                      placeholder="https://example.com/badge.png"
                      className="input input-bordered"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-1">Use a direct image URL (jpg, png, webp, gif). Recommended ≤ 5 MB.</p>
                  </>
                )}
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

      {/* Save Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card bg-base-100 w-full max-w-md shadow-xl border border-base-300">
            <div className="card-body space-y-3">
              <h3 className="text-lg font-bold">Save Badge Template</h3>
              <input
                type="text"
                placeholder="Template name (e.g., 'Fall 2024 Badges')"
                className="input input-bordered w-full"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                autoFocus
              />
              <div className="text-xs text-base-content/60">
                This will save {badges.length} badge(s) from this classroom.
              </div>
              <div className="card-actions justify-end">
                <button className="btn btn-ghost" onClick={() => setShowTemplateModal(false)}>Cancel</button>
                <button
                  className="btn btn-primary"
                  disabled={savingTemplate}
                  onClick={async () => {
                    try {
                      setSavingTemplate(true);
                      await saveBadgeTemplate(templateName.trim(), classroomId);
                      toast.success('Template saved');
                      const res = await getBadgeTemplates();
                      setBadgeTemplates(res.templates || []);
                      setShowTemplateModal(false);
                      setTemplateName('');
                    } catch (e) {
                      toast.error(e.message || 'Failed to save template');
                    } finally {
                      setSavingTemplate(false);
                    }
                  }}
                >
                  {savingTemplate ? <span className="loading loading-spinner loading-xs" /> : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Apply Template Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card bg-base-100 w-full max-w-3xl shadow-xl border border-base-300">
            <div className="card-body space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">
                  Apply Badge Template {badgeTemplates?.length ? `(${badgeTemplates.length})` : ''}
                </h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowApplyModal(false)}>✕</button>
              </div>

              {/* Collapsible: how templating works */}
              <div className="collapse collapse-arrow bg-base-200 rounded">
                <input type="checkbox" />
                <div className="collapse-title text-sm font-semibold">
                  How templating works
                </div>
                <div className="collapse-content text-sm space-y-1">
                  <p>• Applying a template will add any missing badges to this classroom.</p>
                  <p>• Badges with the same name and level are skipped to avoid duplicates.</p>
                  <p>• You can apply templates even if the classroom already has badges.</p>
                </div>
              </div>

              {/* search + sort */}
              <div className="flex flex-wrap gap-2 mb-2">
                <input
                  type="search"
                  className="input input-bordered flex-1 min-w-[200px]"
                  placeholder="Search templates..."
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                />
                <select
                  className="select select-bordered w-40"
                  value={templateSort}
                  onChange={(e) => setTemplateSort(e.target.value)}
                >
                  <option value="createdDesc">Newest</option>
                  <option value="createdAsc">Oldest</option>
                  <option value="nameAsc">Name ↑</option>
                  <option value="nameDesc">Name ↓</option>
                  <option value="badgesDesc">Badges ↓</option>
                  <option value="badgesAsc">Badges ↑</option>
                </select>

                {(badgeTemplates?.length || 0) > 0 && (filteredSortedBadgeTemplates?.length || 0) > 0 && (
                  <button
                    className="btn btn-outline btn-error btn-sm"
                    onClick={() => setConfirmDeleteAllBadgeTemplates(true)}
                    disabled={bulkDeletingBadgeTemplates}
                    title="Delete all (or currently filtered) templates"
                  >
                    Delete {filteredSortedBadgeTemplates.length === badgeTemplates.length ? 'All' : 'Filtered'}
                  </button>
                )}
              </div>

              {filteredSortedBadgeTemplates.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                  {filteredSortedBadgeTemplates.map((t) => (
                    <div key={t._id} className="flex items-center justify-between bg-base-200 p-3 rounded">
                      <div>
                        <div className="font-medium template-name break-words">{t.name}</div>
                        <div className="text-xs text-base-content/60">
                          {(t.sourceClassroom?.name || '')}{t.sourceClassroom?.code ? ` (${t.sourceClassroom.code})` : ''}
                        </div>
                        <div className="text-xs text-base-content/60">
                          {t.badges?.length || 0} badge(s)
                        </div>
                        <div className="text-xs text-base-content/50">
                          Created: {t.createdAt ? new Date(t.createdAt).toLocaleString() : '—'}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          className="btn btn-xs btn-primary"
                          onClick={async () => {
                            try {
                              const res = await applyBadgeTemplate(t._id, classroomId);
                              toast.success(formatBadgeTemplateApplyMessage(res));
                              await fetchBadges?.();
                              setShowApplyModal(false);
                            } catch (e) {
                              toast.error(e.message || 'Failed to apply template');
                            }
                          }}
                        >Apply</button>
                        <button
                          className="btn btn-xs btn-ghost text-error"
                          onClick={() => setDeleteTemplateModal({ id: t._id, name: t.name })}
                        >Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-base-content/60 py-8">No templates saved yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmDeleteAllBadgeTemplates}
        onClose={() => !bulkDeletingBadgeTemplates && setConfirmDeleteAllBadgeTemplates(false)}
        title="Delete Templates?"
        message={`Delete ${filteredSortedBadgeTemplates.length} template(s)? This cannot be undone.`}
        confirmText={bulkDeletingBadgeTemplates ? 'Deleting...' : 'Delete'}
        cancelText="Cancel"
        confirmButtonClass="btn-error"
        onConfirm={handleBulkDeleteBadgeTemplates}
      />

      {/* Delete template confirm */}
      {deleteTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card bg-base-100 w-full max-w-md shadow-xl border border-base-300">
            <div className="card-body space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Delete Template</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setDeleteTemplateModal(null)}>✕</button>
              </div>
              <p className="text-sm">Delete template “{deleteTemplateModal.name}”?</p>
              <div className="card-actions justify-end">
                <button className="btn btn-ghost" onClick={() => setDeleteTemplateModal(null)}>Cancel</button>
                <button
                  className="btn btn-error btn-sm"
                  onClick={async () => {
                    try {
                      await deleteBadgeTemplate(deleteTemplateModal.id);
                      toast.success('Template deleted');
                      const res = await getBadgeTemplates();
                      setBadgeTemplates(res.templates || []);
                      setDeleteTemplateModal(null);
                    } catch (e) {
                      toast.error(e.message || 'Failed to delete template');
                    }
                  }}
                >Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!confirmDeleteBadge}
        onClose={() => setConfirmDeleteBadge(null)}
        onConfirm={async () => {
          try {
            await axios.delete(`/api/badge/${confirmDeleteBadge.id}`, { withCredentials: true });
            toast.success('Badge deleted successfully');
            setConfirmDeleteBadge(null);
            fetchBadges();
          } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to delete badge');
          }
        }}
        title="Delete Badge?"
        message="Are you sure you want to delete this badge? This cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonClass="btn-error"
      />

      <Footer />
    </div>
  );
};

export default Badges;