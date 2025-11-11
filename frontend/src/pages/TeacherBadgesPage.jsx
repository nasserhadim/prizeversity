import React, { useEffect, useState } from 'react';
import { createBadge, getBadges, deleteBadge } from '../API/apiBadges';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import EmojiPicker from 'emoji-picker-react';

const TeacherBadgesPage = ({ classroomId }) => {
  const { user } = useAuth();
  const [badges, setBadges] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [classroom, setClassroom] = useState(null);
  const [editingBadge, setEditingBadge] = useState(null);
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    levelRequired: '',
    icon: '',
  });

  // Student Progress States
  const [studentList, setStudentList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('');

  // Derived filtered students
  const filteredStudents = studentList.filter((s) => {
    const matchesSearch =
      s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = levelFilter ? s.level === Number(levelFilter) : true;
    return matchesSearch && matchesLevel;
  });

  const sortedStudents = [...filteredStudents].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Fetch badges on load
  useEffect(() => {
    if (!classroomId) return;
    const fetchBadges = async () => {
      try {
        const res = await getBadges(classroomId);
        setBadges(res.data);
      } catch (err) {
        console.error('Failed to fetch badges:', err);
      }
    };
    fetchBadges();
  }, [classroomId]);

  useEffect(() => {
    if (!classroomId) return;
    const fetchClassroom = async () => {
      try {
        const res = await axios.get(`/api/classroom/${classroomId}`);
        setClassroom(res.data);
      } catch (err) {
        console.error('Failed to fetch classroom info:', err);
      }
    };
    fetchClassroom();
  }, [classroomId]);

  // Fetch student list and progress
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const res = await axios.get(`/api/xp/classroom/${classroomId}/progress`, {
          withCredentials: true,
        });
        setStudentList(res.data);
      } catch (err) {
        console.error('Error fetching student list:', err);
      }
    };

    if (classroomId) fetchStudents();
  }, [classroomId]);



  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // Edit badge (opens modal prefilled)
  const handleEditBadge = (badge) => {
    setFormData({
      name: badge.name,
      description: badge.description,
      levelRequired: badge.levelRequired,
      icon: badge.icon || '',
    });
    setEditingBadge(badge); // track which badge is being edited
    setShowModal(true);
  };

  // Create a new badge (real DB)
  const handleCreateBadge = async (e) => {
    e.preventDefault();
    if (!user?._id) return alert('No teacher ID found');
    setLoading(true);

    try {
      const data = {
        ...formData,
        classroomId,
        teacherId: user._id,
      };

      if (editingBadge) {
        // Update existing badge
        const res = await axios.put(`/api/badges/${editingBadge._id}`, data);
        setBadges((prev) =>
          prev.map((b) => (b._id === editingBadge._id ? res.data : b))
        );
        setEditingBadge(null);
      } else {
        // Create new badge
        const res = await createBadge(data);
        setBadges((prev) => [...prev, res.data]);
      }

      setShowModal(false);
      setFormData({ name: '', description: '', levelRequired: '', icon: '' });
    } catch (err) {
      console.error('Error saving badge:', err);
      alert('Failed to save badge.');
    } finally {
      setLoading(false);
    }
  };

  // Delete badge
  const handleDeleteBadge = async (badgeId) => {
    if (!window.confirm('Are you sure you want to delete this badge?')) return;
    try {
      await deleteBadge(badgeId);
      setBadges((prev) => prev.filter((b) => b._id !== badgeId));
    } catch (err) {
      console.error('Error deleting badge:', err);
      alert('Failed to delete badge.');
    }
  };

  // Export helpers
  const exportToCSV = (data) => {
    if (!data || !data.length) return alert('No data to export.');
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','), 
      ...data.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','))
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'badge_progress.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToJSON = (data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'badge_progress.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Badge Management</h2>
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          onClick={() => setShowModal(true)}
        >
          + Create Badge
        </button>
      </div>

      {/* Classroom info (name + ID) */}
      <div className="mb-4">
        {classroom ? (
          <>
            <p className="text-lg font-semibold">{classroom.name}</p>
            <p className="text-sm text-gray-500">Code: {classroom.code}</p>
          </>
        ) : (
          <p className="text-gray-400">Loading classroom info...</p>
        )}
      </div>
      
      {/* All Badges */}
      <h3 className="font-semibold mb-3">
        All Badges ({badges.length})
      </h3>

      {badges.length === 0 ? (
        <p className="text-gray-500">No badges created yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {badges.map((badge) => (
            <div
              key={badge._id}
              className="border rounded-md p-3 shadow hover:shadow-lg transition relative"
            >
              {/* Edit & Delete Buttons */}
              <div className="absolute top-2 right-2 flex gap-3">
                <button
                  onClick={() => handleEditBadge(badge)}
                  className="text-blue-500 hover:text-blue-700"
                  title="Edit badge"
                >
                  ✎
                </button>
                <button
                  onClick={() => handleDeleteBadge(badge._id)}
                  className="text-red-500 hover:text-red-700"
                  title="Delete badge"
                >
                  ✕
                </button>
              </div>

              <p className="text-lg font-bold">
                {badge.icon || '🏅'} {badge.name}
              </p>
              <p className="text-sm text-gray-600">{badge.description}</p>
              <p className="text-sm mt-1">Level {badge.levelRequired} Required</p>
              <p className="text-xs text-gray-400 mt-1">
                Created {new Date(badge.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-md w-96 shadow-lg">
            <h3 className="text-lg font-bold mb-4">Create Badge</h3>
            <form onSubmit={handleCreateBadge} className="flex flex-col gap-3">
              <label className="text-sm font-semibold">
                Badge Name:
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="border p-2 rounded w-full mt-1"
                  required
                />
              </label>

              <label className="text-sm font-semibold">
                Description:
                <input
                  type="text"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className="border p-2 rounded w-full mt-1"
                  required
                />
              </label>

              <label className="text-sm font-semibold">
                Level Required:
                <input
                  type="number"
                  name="levelRequired"
                  value={formData.levelRequired}
                  onChange={handleChange}
                  className="border p-2 rounded w-full mt-1"
                  required
                />
              </label>

              <label className="text-sm font-semibold">
                Icon (Emoji):
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    name="icon"
                    value={formData.icon}
                    onChange={handleChange}
                    placeholder="Select an emoji..."
                    className="border p-2 rounded w-full mt-1"
                    readOnly
                  />
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="px-2 py-1 border rounded-md hover:bg-gray-100"
                  >
                    😀
                  </button>
                </div>

                {showEmojiPicker && (
                  <div className="mt-2">
                    <EmojiPicker
                      onEmojiClick={(e) => {
                        setFormData({ ...formData, icon: e.emoji });
                        setShowEmojiPicker(false);
                      }}
                    />
                  </div>
                )}
              </label>

              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-md hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading
                    ? (editingBadge ? 'Saving...' : 'Creating...')
                    : editingBadge
                    ? 'Save'
                    : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STUDENT BADGE PROGRESS SECTION */}
<div className="mt-10">
  <h2 className="text-xl font-bold mb-4">Student Badge Progress</h2>

  {/* Filters + Sorting + Export */}
  <div className="flex flex-wrap items-center gap-3 mb-4">
    <input
      type="text"
      placeholder="Search students..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      className="border rounded px-3 py-1 flex-1 min-w-[200px]"
    />
    <select
      value={levelFilter}
      onChange={(e) => setLevelFilter(e.target.value)}
      className="border rounded px-3 py-1"
    >
      <option value="">All Levels</option>
      {[...new Set(studentList.map((s) => s.level))].map((lvl) => (
        <option key={lvl} value={lvl}>
          Level {lvl}
        </option>
      ))}
    </select>

    {/* Sort and order controls */}
    <select
      value={sortField}
      onChange={(e) => setSortField(e.target.value)}
      className="border rounded px-3 py-1"
    >
      <option value="name">Sort by Name</option>
      <option value="level">Sort by Level</option>
      <option value="xp">Sort by XP</option>
      <option value="badgesEarned">Sort by Badges</option>
    </select>

    <button
      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
      className="border px-3 py-1 rounded hover:bg-gray-100"
    >
      {sortOrder === 'asc' ? 'ASC' : 'DESC'}
    </button>

    {/* Export buttons */}
    <button
      onClick={() => exportToCSV(sortedStudents)}
      className="ml-auto border px-3 py-1 rounded hover:bg-gray-100"
    >
      Export CSV
    </button>
    <button
      onClick={() => exportToJSON(sortedStudents)}
      className="border px-3 py-1 rounded hover:bg-gray-100"
    >
      Export JSON
    </button>
  </div>

  {/* Student Table */}
  <table className="w-full border rounded-md text-sm">
    <thead className="bg-gray-100">
      <tr>
        <th className="p-2 border">Student</th>
        <th className="p-2 border">Level</th>
        <th className="p-2 border">XP</th>
        <th className="p-2 border">Badges Earned</th>
        <th className="p-2 border">Next Badge</th>
      </tr>
    </thead>
    <tbody>
      {sortedStudents.length === 0 ? (
        <tr>
          <td colSpan="6" className="p-4 text-center text-gray-500">
            No students found.
          </td>
        </tr>
      ) : (
        sortedStudents.map((s) => (
          <tr key={s._id} className="hover:bg-gray-50">
            <td className="p-2 border">
              <div className="font-medium">{s.name}</div>
              <div className="text-gray-500 text-xs">{s.email}</div>
            </td>
            <td className="p-2 border text-center">{s.level}</td>
            <td className="p-2 border text-center">{s.xp}</td>
            <td className="p-2 border text-center">{s.badgesEarned} / {s.totalBadges ?? 0}</td>
            <td className="p-2 border text-center">{s.nextBadge}</td>
          </tr>
        ))
      )}
    </tbody>
  </table>
</div>
    </div>
  );
};

export default TeacherBadgesPage;
