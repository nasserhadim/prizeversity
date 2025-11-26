import React, { useEffect, useState } from 'react';
import { createBadge, getBadges, deleteBadge } from '../API/apiBadges';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { Trash2 } from "lucide-react";
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

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
  const navigate = useNavigate();
  const [confirmDeleteBadgeId, setConfirmDeleteBadgeId] = useState(null);
  const [imageSource, setImageSource] = useState("url");
  const [imageFile, setImageFile] = useState(null);
  const [imageUrlLocal, setImageUrlLocal] = useState("");


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
  const [badgeFilter, setBadgeFilter] = useState('all');

  // Derived filtered students
  const filteredStudents = studentList.filter((s) => {
    const matchesSearch =
      s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = levelFilter ? s.level === Number(levelFilter) : true;

    const badgeCount = s.badgesEarned || 0;
    const matchesBadge =
      badgeFilter === 'all'
        ? true
        : badgeFilter === 'with'
        ? badgeCount > 0
        : badgeCount === 0;

    return matchesSearch && matchesLevel && matchesBadge;
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
    setEditingBadge(badge);
    setShowModal(true);

    setImageSource("url");
    setImageFile(null);
    setImageUrlLocal(
      badge.imageUrl && !badge.imageUrl.startsWith("/uploads/")
        ? badge.imageUrl
        : ""
    );


  };

  // Create / update badge
  const handleCreateBadge = async (e) => {
    e.preventDefault();
    if (!user?._id) return alert('No teacher ID found');
    setLoading(true);

    try {
      const data = new FormData();
      data.append('name', formData.name);
      data.append('description', formData.description);
      data.append('levelRequired', formData.levelRequired);
      data.append('icon', formData.icon);
      data.append('classroomId', classroomId);
      data.append('teacherId', user._id);
      if (imageSource === "file") {
        if (imageFile) {
          data.append("image", imageFile);
        }
      } else if (imageSource === "url") {
        const cleanUrl = imageUrlLocal.trim();
        if (cleanUrl !== "") {
          data.append("imageUrl", cleanUrl);
        }
}
      let res;

      if (editingBadge) {
        res = await axios.put(`/api/badges/${editingBadge._id}`, data, {
          headers: { 'Content-Type': 'multipart/form-data' },
          withCredentials: true,
        });

        setBadges((prev) =>
          prev.map((b) => (b._id === editingBadge._id ? res.data : b))
        );
        setEditingBadge(null);
      } else {
        res = await axios.post('/api/badges', data, {
          headers: { 'Content-Type': 'multipart/form-data' },
          withCredentials: true,
        });

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

  // NEW: delete WITH inline confirm (like templates in Bazaar)
  const handleDeleteBadge = async (badgeId) => {
    try {
      await deleteBadge(badgeId);
      setBadges((prev) => prev.filter((b) => b._id !== badgeId));
      setConfirmDeleteBadgeId(null);
      toast.success('Badge deleted successfully.', { duration: 2000 });
    } catch (err) {
      console.error('Error deleting badge:', err);
      toast.error('Failed to delete badge.');
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

  const BadgeImageInput = ({
    imageSource,
    setImageSource,
    imageFile,
    setImageFile,
    imageUrlLocal,
    setImageUrlLocal
  }) => (
    <div className="form-control">
      <label className="text-sm font-semibold mb-1">Badge Image:</label>

      <div className="inline-flex rounded-full bg-gray-200 p-1 mb-2 w-fit">


        <button
          type="button"
          onClick={() => {
            setImageSource("url");
            setImageFile(null);
            setImageUrlLocal("");
          }}
          className={`px-3 py-1 rounded-full text-sm ${
            imageSource === "url" ? "bg-white shadow" : ""
          }`}
        >
          URL
        </button>

        <button
          type="button"
          onClick={() => {
            setImageSource("file");
            setImageUrlLocal("");
          }}
          className={`ml-1 px-3 py-1 rounded-full text-sm ${
            imageSource === "file" ? "bg-white shadow" : ""
          }`}
        >
          Upload
        </button>
      </div>

      {imageSource === "file" ? (
        <>
          <div className="flex">
            <label className="bg-gray-800 text-white px-4 py-2 rounded-l-md cursor-pointer">
              Choose File
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files[0];
                  setImageFile(file);
                }}
              />
            </label>

            <div className="flex-1 border border-gray-300 px-3 py-2 rounded-r-md truncate">
              {imageFile ? imageFile.name : "No file chosen"}
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-1">
            Allowed: jpg, png, webp, gif. Max 5 MB.
          </p>
        </>
      ) : (
        <input
          type="url"
          className="input input-bordered w-full"
          placeholder="https://example.com/image.png"
          value={imageUrlLocal}
          onChange={(e) => setImageUrlLocal(e.target.value)}
        />
      )}
    </div>
  );



  return (
    <div className="w-full px-6 pb-10">
      <div className="mb-2">
        <Link
          to={`/classroom/${classroomId}`}
          className="link text-green-600 hover:text-green-700 focus:outline-none focus:ring-2 focus:ring-green-300 rounded"
        >
          ← Back to Classroom
        </Link>
      </div>

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Badge Management</h2>
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          onClick={() => {
            setShowModal(true);
            setEditingBadge(null);
            setImageSource("url");
            setImageFile(null);
            setImageUrlLocal("");
          }}
        >
          + Create Badge
        </button>
      </div>

      {/* Classroom info */}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6 w-full">
          {badges.map((badge) => (
            <div
              key={badge._id}
              className="relative flex flex-col justify-between rounded-2xl shadow-md border border-base-200 bg-base-100 hover:shadow-lg transition duration-200 p-6 w-full min-h-[420px]"
            >
              {/* Top row: emoji + edit/delete */}
              <div className="flex justify-between items-start">
                <span className="text-5xl">
                  {badge.icon || '🏅'}
                </span>

                <div className="flex gap-2">
                  {/* Edit button (pretty circle) */}
                  <button
                    onClick={() => handleEditBadge(badge)}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:border-blue-300 transition"
                    title="Edit badge"
                  >
                    ✎
                  </button>

                  {/* Delete with Confirm/Cancel like Bazaar templates */}
                  {confirmDeleteBadgeId === badge._id ? (
                    <>
                      <button
                        onClick={() => handleDeleteBadge(badge._id)}
                        className="px-3 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDeleteBadgeId(null)}
                        className="px-3 py-1 text-xs rounded border border-gray-300 hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteBadgeId(badge._id)}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 transition"
                      title="Delete badge"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>

              {/* Badge text */}
              <div className="mt-4 text-left space-y-2">
                <h4 className="font-semibold text-xl">{badge.name}</h4>

                {badge.description && (
                  <p className="text-base text-base-content/70">
                    {badge.description}
                  </p>
                )}

                <p className="text-base font-semibold text-base-content">
                  Level {badge.levelRequired} Required
                </p>

                <p className="text-sm text-base-content/50">
                  Created {new Date(badge.createdAt).toLocaleDateString()}
                </p>
              </div>

              {/* Bottom: badge image */}
              {badge.imageUrl && (
                <div className="mt-6 flex justify-center">
                  <img
                    src={
                      badge.imageUrl.startsWith('/uploads/')
                        ? `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}${badge.imageUrl}`
                        : badge.imageUrl
                    }
                    alt={badge.name}
                    className="w-56 h-64 object-contain rounded-md"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-md w-96 shadow-lg">
            <h3 className="text-lg font-bold mb-4">
              {editingBadge ? 'Edit Badge' : 'Create Badge'}
            </h3>
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
                    <Picker
                      data={data}
                      onEmojiSelect={(emoji) => {
                        setFormData({ ...formData, icon: emoji.native });
                        setShowEmojiPicker(false);
                      }}
                      theme="light"
                      previewPosition="none"
                    />
                  </div>
                )}
              </label>

              {/* Badge Image Upload */}
              <BadgeImageInput
                imageSource={imageSource}
                setImageSource={setImageSource}
                imageFile={imageFile}
                setImageFile={setImageFile}
                imageUrlLocal={imageUrlLocal}
                setImageUrlLocal={setImageUrlLocal}
              />

              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingBadge(null);
                    setFormData({
                      name: '',
                      description: '',
                      levelRequired: '',
                      icon: '',
                    });
                  }}
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
                    ? editingBadge
                      ? 'Saving...'
                      : 'Creating...'
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

        {/* Export buttons */}
        <div className="flex justify-end gap-2 mb-3">
          <button
            onClick={() => exportToCSV(sortedStudents)}
            className="border px-3 py-1 rounded hover:bg-gray-100 text-sm"
          >
            Export CSV
          </button>
          <button
            onClick={() => exportToJSON(sortedStudents)}
            className="border px-3 py-1 rounded hover:bg-gray-100 text-sm"
          >
            Export JSON
          </button>
        </div>

        {/* Filters and sorting */}
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

          <select
            value={badgeFilter}
            onChange={(e) => setBadgeFilter(e.target.value)}
            className="border rounded px-3 py-1"
          >
            <option value="all">All Students</option>
            <option value="with">With Badges</option>
            <option value="without">Without Badges</option>
          </select>

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
        </div>

        {/* Student table */}
        <div className="card bg-base-100 border border-base-200 shadow-md rounded-2xl overflow-x-auto">
          <div className="card-body p-4">
            <table className="table table-zebra w-full table-auto text-sm md:text-base">
              <thead className="text-base-content/70 border-b border-base-300">
                <tr>
                  <th className="py-3">Student</th>
                  <th className="py-3 text-center">Level</th>
                  <th className="py-3 text-center">XP</th>
                  <th className="py-3 text-center">Badges Earned</th>
                  <th className="py-3 text-center">Next Badge</th>
                  <th className="py-3 text-center">XP Until Next Badge</th>
                  <th className="py-3 text-center">Actions</th>
                </tr>
              </thead>

              <tbody>
                {sortedStudents.length === 0 ? (
                  <tr>
                    <td
                      colSpan="7"
                      className="py-6 text-center text-base-content/60 italic"
                    >
                      No students found.
                    </td>
                  </tr>
                ) : (
                  sortedStudents.map((s, i) => (
                    <tr
                      key={s._id || i}
                      className="hover:bg-base-200 transition-colors"
                    >
                      <td className="py-3">
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs opacity-70">{s.email}</div>
                      </td>

                      <td className="py-3 text-center">{s.level}</td>
                      <td className="py-3 text-center">{s.xp}</td>

                      <td className="py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="font-medium">{s.badgesEarned}</span>
                          <span className="opacity-70">
                            / {s.totalBadges ?? 0}
                          </span>

                          <button
                            onClick={() =>
                              navigate(
                                `/classroom/${classroomId}/student/${s._id}/badges`,
                                { state: { from: 'badges' } }
                              )
                            }
                            className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded-md text-xs sm:text-sm whitespace-nowrap"
                          >
                            View
                          </button>
                        </div>
                      </td>

                      <td className="py-3 text-center">
                        {s.nextBadge ? (
                          <span className="text-sm">{s.nextBadge}</span>
                        ) : (
                          <span className="text-xs opacity-70 italic">—</span>
                        )}
                      </td>

                      <td className="py-3 text-center">
                        {s.nextBadge === 'All badges earned'
                          ? '—'
                          : `${s.xpUntilNextBadge ?? 0} XP`}
                      </td>

                      <td className="py-3 text-center">
                        <div className="flex flex-col sm:flex-row justify-center gap-2">
                          <button
                            className="btn btn-xs sm:btn-sm btn-outline whitespace-nowrap"
                            onClick={() =>
                              navigate(
                                `/classroom/${classroomId}/profile/${s._id}`,
                                { state: { from: 'badges', classroomId } }
                              )
                            }
                          >
                            View Profile
                          </button>

                          <button
                            className="btn btn-xs sm:btn-sm btn-success whitespace-nowrap"
                            onClick={() =>
                              navigate(
                                `/classroom/${classroomId}/student/${s._id}/stats`,
                                { state: { from: 'badges' } }
                              )
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
        </div>
      </div>
    </div>
  );
};

export default TeacherBadgesPage;
