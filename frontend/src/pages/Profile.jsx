import { useEffect, useState, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import ConfirmModal from '../components/ConfirmModal';
import toast from 'react-hot-toast';
import { API_BASE } from '../config/api';
import Footer from '../components/Footer';
import { Image as ImageIcon } from 'lucide-react';
import OrderCard from '../components/OrderCard';
import { getEffectDescription, splitDescriptionEffect } from '../utils/itemHelpers';
import { useRef, useMemo } from 'react';
import usePaginatedList from '../hooks/usePaginatedList';
import OrderFilterBar from '../components/OrderFilterBar';
import ExportButtons from '../components/ExportButtons';
import { exportOrdersToCSV, exportOrdersToJSON } from '../utils/exportOrders';
import formatExportFilename from '../utils/formatExportFilename';
import { useLocation, Link } from 'react-router-dom';

const ROLE_LABELS = {
    student: 'Student',
    admin: 'Admin/TA',
    teacher: 'Teacher',
};

// helper: compute classroom label for an order (module scope so usable before render)
function classroomLabel(o) {
  if (!o) return '—';
  const c = o.classroom || o.items?.[0]?.bazaar?.classroom;
  if (!c) return '—';
  return c.name ? `${c.name}${c.code ? ` (${c.code})` : ''}` : '—';
}

export default function Profile() {
  const { user, updateUser } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [ordersError, setOrdersError] = useState('');
  // Purchase-history filter/sort state (ensure these are defined)
  const [searchOrders, setSearchOrders] = useState('');
  const [classroomFilter, setClassroomFilter] = useState('all');
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [stats, setStats] = useState({});

  // Edit profile state (restore edit/avatar functionality)
  const [editing, setEditing] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [confirmRemoveAvatar, setConfirmRemoveAvatar] = useState(false);
  const [confirmDiscardEdit, setConfirmDiscardEdit] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // New states for undo/restore and URL upload support
  const [prevAvatar, setPrevAvatar] = useState(null); // holds previous avatar value for undo restore
  const [removedOnServer, setRemovedOnServer] = useState(false); // indicates server-side deletion happened
  const [imageSource, setImageSource] = useState('file'); // 'file' | 'url'
  const [imageUrl, setImageUrl] = useState(''); // for URL uploads
  const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB

  // Update useParams to get classroomId
  const { id: profileId, classroomId } = useParams();
  const location = useLocation();
  const navFrom = location.state?.from || null;
  const navClassroomId = location.state?.classroomId || classroomId;
  // helper: build a back link target based on where we came from
  const backLink = (() => {
    if (navFrom === 'leaderboard' && navClassroomId) return { to: `/classroom/${navClassroomId}/leaderboard`, label: 'Leaderboard' };
    if (navFrom === 'people' && navClassroomId) return { to: `/classroom/${navClassroomId}/people`, label: 'People' };
    if (navFrom === 'groups' && navClassroomId) return { to: `/classroom/${navClassroomId}/groups`, label: 'Groups' };
    if (navClassroomId) return { to: `/classroom/${navClassroomId}`, label: 'Classroom' };
    return { to: '/classrooms', label: 'My Classrooms' };
  })();

  // Backend URL base
  const BACKEND_URL = `${API_BASE}`;

  // Helper to format ISO date/time strings into readable US Eastern time format
  const formatDateTime = (iso) =>
      new Date(iso).toLocaleString('en-US', {
          timeZone: 'America/Detroit',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
      });

  // Fetch the profile data when component mounts or profileId changes
  useEffect(() => {
  const fetchProfile = async () => {
    try {
      const url = classroomId
        ? `/api/profile/student/${profileId}?classroomId=${classroomId}`
        : `/api/profile/student/${profileId}`;
      const res = await axios.get(url, {
        withCredentials: true
      });
      // initialize edit fields when loading profile
      setEditFirstName(res.data.firstName || '');
      setEditLastName(res.data.lastName || '');
      setAvatarFile(null);
      setRemoveAvatar(false);
      setPrevAvatar(null);
      setRemovedOnServer(false);
      setImageUrl('');
      setImageSource('file');
      setProfile(res.data);
    } catch (err) {
      console.error('Profile fetch error:', err);
      setProfile(null); // Ensure profile is set to null on error
    } finally {
      setLoadingOrders(false);
    }
  };

  if (profileId) fetchProfile();
}, [profileId, classroomId]);

  // Added new useEffect to fetch the stats into a table.
  useEffect(() => {
      if (user.role === 'teacher' && profile?.role === 'student') {
          axios
              .get(`/api/bazaar/orders/user/${profileId}`, {
                  withCredentials: true
              })
              .then(res => {
                  setOrders(res.data);
                  setLoadingOrders(false);
              })
              .catch(err => {
                  setOrdersError(err.response?.data?.error || 'Failed to load orders');
                  setLoadingOrders(false);
              });
      }
  }, [profile, user?.role, profileId]);

  // Fetch additional stats about the profile (e.g., balances, activity)
  useEffect(() => {
      const fetchStats = async () => {
          try {
              const url = classroomId
                ? `/api/profile/student/${profileId}/stats?classroomId=${classroomId}`
                : `/api/profile/student/${profileId}/stats`;
              const res = await axios.get(url, {
                  withCredentials: true
              });
              setStats(res.data);
          } catch (err) {
              console.error('Stats fetch error:', err);
          }
      };
      if (profileId) fetchStats();
  }, [profileId, classroomId]);

  // compute filtered + sorted list for purchase history (same rules as OrderHistory)
  // classroom options for filter dropdown (derived from orders)
  const classroomOptions = useMemo(() => {
    const m = new Map();
    (orders || []).forEach(o => {
      const c = o.items?.[0]?.bazaar?.classroom;
      if (c && c._id) m.set(c._id, `${c.name}${c.code ? ` (${c.code})` : ''}`);
    });
    return Array.from(m.entries()).map(([id, label]) => ({ id, label }));
  }, [orders]);

  const visibleOrders = useMemo(() => {
     return orders
       .filter(o => {
         // Filter by search term (order ID, item name, classroom, total)
         const q = (searchOrders || '').trim().toLowerCase();
         const searchMatch = !q || (
           (o._id || '').toLowerCase().includes(q) ||
           ((o.items || []).some(i => (i.name || '').toLowerCase().includes(q))) ||
           (classroomLabel(o) || '').toLowerCase().includes(q) ||
           (o.total || '').toString().toLowerCase().includes(q)
         );
         return searchMatch;
       })
       .sort((a, b) => {
         // Sort by selected field and direction
         const aVal = sortField === 'date' ? new Date(a.createdAt) : a[sortField];
         const bVal = sortField === 'date' ? new Date(b.createdAt) : b[sortField];
         const order = sortDirection === 'asc' ? 1 : -1;
         return aVal < bVal ? -order : aVal > bVal ? order : 0;
       });
   }, [orders, searchOrders, classroomFilter, sortField, sortDirection]);

  // Pagination / lazy-load (shared hook)
  const {
     displayed,
     visible,
     page,
     setPage,
     displayCount,
     setDisplayCount,
     sentinelRef,
     perPage,
     totalPages
   } = usePaginatedList(visibleOrders, {
     perPage: 6,
     resetDeps: [searchOrders, classroomFilter, sortField, sortDirection, visibleOrders.length]
   });

  // Export wrapper for Profile (returns filename so ExportButtons can show it)
  const buildBaseFilename = (displayName, label) => {
    const name = (displayName || 'user').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    return `${name}_${label}_${ts}`;
  };

  const exportCSVProfile = async () => {
    if (!visibleOrders.length) throw new Error('No orders to export');
    const displayName = `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() || profile?.email || `profile_${profileId || 'user'}`;
    const base = formatExportFilename(displayName, 'purchase_history');
    exportOrdersToCSV(visibleOrders, base);
    return `${base}.csv`;
  };

  const exportJSONProfile = async () => {
    if (!visibleOrders.length) throw new Error('No orders to export');
    const displayName = `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() || profile?.email || `profile_${profileId || 'user'}`;
    const base = formatExportFilename(displayName, 'purchase_history');
    exportOrdersToJSON(visibleOrders, base);
    return `${base}.json`;
  };

  // Avatar file select with validation (images only + size limit)
  const handleAvatarChange = (e) => {
    const f = e?.target?.files?.[0] || null;
    if (!f) return;
    // Validate type
    if (!f.type || !f.type.startsWith('image/')) {
      toast.error('Please choose an image file (jpg/png/webp/gif).');
      return;
    }
    if (f.size > MAX_AVATAR_BYTES) {
      toast.error('Image too large — max 5 MB.');
      return;
    }
    setAvatarFile(f);
    // If user selects a new file, clear remove flag and URL
    setRemoveAvatar(false);
    setRemovedOnServer(false);
    setImageSource('file');
    setImageUrl('');
  };

  // Wrapper used by the "X" overlay button to start the remove flow.
  // Kept as a tiny wrapper so JSX references a stable name.
  const handleRemoveAvatarToggle = () => {
    setConfirmRemoveAvatar(true);
  };

  // Upload avatar (if any) and return server response (user or avatar info)
  const uploadAvatarIfNeeded = async () => {
    if (!avatarFile) return null;
    const fd = new FormData();
    fd.append('avatar', avatarFile);
    const r = await axios.post('/api/profile/upload-avatar', fd, {
      withCredentials: true,
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return r.data;
  };

  // Ask for confirmation before removing avatar; on confirm perform server delete and offer undo
  const confirmRemoveAvatarAction = async () => {
    try {
      setConfirmRemoveAvatar(false);
      const currentAvatar = profile?.avatar || null;
      setPrevAvatar(currentAvatar);

      const del = await axios.delete('/api/profile/remove-avatar', { withCredentials: true });

      // reflect removal immediately in UI
      setProfile(prev => ({ ...(prev || {}), avatar: undefined }));
      setAvatarFile(null);
      setRemoveAvatar(true);
      setRemovedOnServer(true);

      // Undo toast: use restore endpoint for local files, PUT for URLs/data
      toast((t) => (
        <div className="flex items-center gap-4">
          <span>Photo removed</span>
          <div className="ml-2">
            <button
              className="btn btn-xs btn-ghost"
              onClick={async () => {
                try {
                  if (!currentAvatar) {
                    toast.error('No previous photo to restore');
                    return;
                  }

                  if (!/^(https?:|data:)/.test(currentAvatar)) {
                    // restore local file from trash
                    const r = await axios.post('/api/profile/restore-avatar', { filename: currentAvatar }, { withCredentials: true });
                    if (r?.data) {
                      setProfile(r.data);
                      setRemoveAvatar(false);
                      setRemovedOnServer(false);
                      setPrevAvatar(null);
                      toast.success('Photo restored');
                      toast.dismiss(t.id);
                      return;
                    }
                    toast.error('Failed to restore photo');
                    return;
                  }

                  // remote/data URL: PUT it back
                  const r2 = await axios.put(`/api/profile/student/${profileId}`, { avatar: currentAvatar }, { withCredentials: true });
                  if (r2?.data) {
                    setProfile(r2.data);
                    setRemoveAvatar(false);
                    setRemovedOnServer(false);
                    setPrevAvatar(null);
                    toast.success('Photo restored');
                    toast.dismiss(t.id);
                  } else {
                    toast.error('Failed to restore photo');
                  }
                } catch (err) {
                  console.error('Restore avatar failed:', err);
                  toast.error('Failed to restore photo');
                }
              }}
            >
              Undo
            </button>
          </div>
        </div>
      ), { duration: 8000 });

    } catch (err) {
      console.error('Server-side remove avatar failed', err);
      toast.error('Failed to remove photo');
      setConfirmRemoveAvatar(false);
    }
  };

  const cancelRemoveAvatarAction = () => {
    setConfirmRemoveAvatar(false);
  };

  // Check for unsaved changes
  const hasUnsavedChanges = () => {
    if (!profile) return false;
    const nameChanged =
      (String(editFirstName || '') !== String(profile.firstName || '')) ||
      (String(editLastName || '') !== String(profile.lastName || ''));
    const avatarChanged = !!avatarFile || removeAvatar || (imageSource === 'url' && imageUrl.trim() !== '');
    return nameChanged || avatarChanged;
  };

  // Save profile edits (names + avatar file/url/remove)
  const handleSaveProfile = async () => {
    // Basic validation: at least one name required
    if (!(editFirstName || editLastName)) {
      toast.error('Please provide a first name or last name');
      return;
    }

    // Collect changed fields
    const payload = {};
    if (editFirstName !== (profile?.firstName || '')) payload.firstName = editFirstName;
    if (editLastName !== (profile?.lastName || '')) payload.lastName = editLastName;

    const hasUrlToSave = imageSource === 'url' && imageUrl.trim() !== '';
    if (!avatarFile && !removeAvatar && !hasUrlToSave && Object.keys(payload).length === 0) {
      toast('No changes made');
      setEditing(false);
      return;
    }

    setSavingProfile(true);
    try {
      let updated = { ...(profile || {}) };

      // If user marked removal but removal wasn't already applied on server, delete now
      if (removeAvatar && !removedOnServer) {
        const r = await axios.delete('/api/profile/remove-avatar', { withCredentials: true });
        if (r?.data) updated = { ...updated, ...(r.data || {}) };
      }

      // Upload file if provided (overrides removal)
      if (avatarFile) {
        const av = await uploadAvatarIfNeeded();
        if (av && av.avatar) {
          updated.avatar = av.avatar;
        } else if (av && av._id) {
          updated = { ...updated, ...(av || {}) };
        }
        setRemovedOnServer(false);
        setPrevAvatar(null);
      } else if (imageSource === 'url' && imageUrl.trim()) {
        const r = await axios.put(`/api/profile/student/${profileId}`, { avatar: imageUrl.trim() }, { withCredentials: true });
        if (r?.data) updated = { ...updated, ...(r.data || {}) };
        setRemovedOnServer(false);
        setPrevAvatar(null);
      }

      // Persist name changes
      if (Object.keys(payload).length > 0) {
        const res = await axios.put(`/api/profile/student/${profileId}`, payload, { withCredentials: true });
        if (res?.data) updated = { ...updated, ...(res.data || {}) };
      }

      setProfile(updated);

      // Update global auth if editing own profile
      if (String(user?._id) === String(profileId) && updateUser) {
        updateUser(updated);
      }

      toast.success('Profile updated');
      setEditing(false);
      setAvatarFile(null);
      setRemoveAvatar(false);
      setImageUrl('');
      setImageSource('file');
      setRemovedOnServer(false);
      setPrevAvatar(null);
    } catch (err) {
      console.error('Failed to save profile', err);
      toast.error(err.response?.data?.error || 'Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCancelEdit = () => {
    // reset fields to profile values
    setEditing(false);
    setEditFirstName(profile?.firstName || '');
    setEditLastName(profile?.lastName || '');
    setAvatarFile(null);
    setRemoveAvatar(false);
    setConfirmRemoveAvatar(false);
    setConfirmDiscardEdit(false);
  };

  // Cancel button handler that shows confirm modal when there are unsaved changes
  const handleCancelClick = () => {
    if (hasUnsavedChanges()) {
      setConfirmDiscardEdit(true);
    } else {
      handleCancelEdit();
    }
  };

  // Show loading spinner while profile data is loading
  if (loadingOrders) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-base-200">
              <span className="loading loading-ring loading-lg"></span>
          </div>
      );
  }

  // Show error alert if loading profile failed and not in edit mode
  if (ordersError) {
      return (
          <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded shadow">
              <div className="alert alert-error">
                  <span>{ordersError}</span>
                  <button onClick={() => window.location.reload()} className="btn btn-sm ml-4">Retry</button>
              </div>
          </div>
      );
  }

  return (
      <div className="min-h-screen flex flex-col">
          <div className="flex-grow w-full max-w-2xl mx-auto p-6 mt-10 bg-base-100 rounded-xl shadow space-y-6">
              <p>
                <Link to={backLink.to} className="link text-accent">← Back to {backLink.label}</Link>
              </p>
              <h2 className="text-2xl font-bold text-center text-base-content">
                  Profile
              </h2>

              <div className="space-y-4">
                  <div className="flex justify-center relative">
                    <div className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center border-4 border-success relative">
                      {avatarFile ? (
                        <img src={URL.createObjectURL(avatarFile)} alt="Preview" className="w-full h-full object-cover" />
                      ) : removeAvatar ? (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center text-3xl font-bold text-gray-500">
                          {`${(profile?.firstName?.[0] || profile?.email?.[0] || 'U')}${(profile?.lastName?.[0] || '')}`.toUpperCase()}
                        </div>
                      ) : profile?.avatar ? (
                        <img
                          src={typeof profile.avatar === 'string' && (profile.avatar.startsWith('data:') || profile.avatar.startsWith('http')) ? profile.avatar : `${BACKEND_URL}/uploads/${profile.avatar}`}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      ) : profile?.profileImage ? (
                        <img src={profile.profileImage} alt="OAuth" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center text-3xl font-bold text-gray-500">
                          {`${(profile?.firstName?.[0] || profile?.email?.[0] || 'U')}${(profile?.lastName?.[0] || '')}`.toUpperCase()}
                        </div>
                      )}

                      {/* show X overlay only when editing and there is a photo/preview to remove (hide after removal) */}
                      {editing && !removeAvatar && (avatarFile || profile?.avatar || profile?.profileImage || (imageSource === 'url' && imageUrl.trim())) && (
                        <button
                          type="button"
                          onClick={handleRemoveAvatarToggle}
                          aria-label="Remove photo"
                          title="Remove photo"
                          className="absolute top-1 right-1 z-20 bg-white border border-gray-200 text-gray-700 hover:bg-red-600 hover:text-white rounded-full p-1 shadow transition"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {editing && (
                      <div className="ml-4 flex flex-col gap-2">
                        <div className="flex items-center">
                          <div
                            role="tablist"
                            aria-label="Avatar source"
                            className="inline-flex rounded-full bg-gray-200 p-1"
                          >
                            <button
                              type="button"
                              role="tab"
                              aria-pressed={imageSource === 'file'}
                              onClick={() => setImageSource('file')}
                              className={`px-3 py-1 rounded-full text-sm transition ${
                                imageSource === 'file'
                                  ? 'bg-white shadow text-gray-900'
                                  : 'text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              Upload
                            </button>
                            <button
                              type="button"
                              role="tab"
                              aria-pressed={imageSource === 'url'}
                              onClick={() => setImageSource('url')}
                              className={`ml-1 px-3 py-1 rounded-full text-sm transition ${
                                imageSource === 'url'
                                  ? 'bg-white shadow text-gray-900'
                                  : 'text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              Use image URL
                            </button>
                          </div>
                        </div>

                        {imageSource === 'file' ? (
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif"
                            onChange={handleAvatarChange}
                            className="file-input file-input-bordered w-full max-w-xs"
                          />
                        ) : (
                          <input
                            type="url"
                            placeholder="https://example.com/avatar.jpg"
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                            className="input input-bordered w-full max-w-xs"
                          />
                        )}

                        <p className="text-xs text-gray-500">Allowed types: jpg, png, webp, gif. Max size: 5 MB.</p>
                      </div>
                    )}
                  </div>
 
                  <div className="space-y-2">
                    <InfoRow label="Name" value={editing ? (
                      <div className="flex flex-col md:flex-row gap-2">
                        <input className="input input-bordered w-full" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} placeholder="First name" />
                        <input className="input input-bordered w-full" value={editLastName} onChange={(e) => setEditLastName(e.target.value)} placeholder="Last name" />
                      </div>
                    ) : ([profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || 'Not set (Complete your profile)')} />
                    <InfoRow label="Email" value={profile?.email || 'N/A'} />
                    <InfoRow label="User ID" value={profile?.shortId || '—'} />
                    {profile?.role && <InfoRow label="Role" value={ROLE_LABELS[profile.role] || profile.role} />}
                    
                    {/* Add Member Since row */}
                    <InfoRow 
                      label="Member Since" 
                      value={profile?.createdAt || user?.createdAt
                        ? new Date(profile?.createdAt || user?.createdAt).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          })
                        : 'Unknown'
                      } 
                    />

                    {/* Edit / Save controls */}
                    {String(user?._id) === String(profileId || profile?._id) && (
                      <div className="mt-4 flex justify-center gap-2">
                        {editing ? (
                          <>
                            <button
                              className="btn btn-primary"
                              onClick={handleSaveProfile}
                              disabled={savingProfile}
                            >
                              {savingProfile ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              className="btn btn-ghost"
                              onClick={handleCancelClick}
                              disabled={savingProfile}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            className="btn btn-outline btn-info"
                            onClick={() => setEditing(true)}
                          >
                            Edit Profile
                          </button>
                        )}
                      </div>
                    )}

                    {/* Discard changes confirmation modal */}
                    <ConfirmModal
                      isOpen={confirmDiscardEdit}
                      onClose={() => setConfirmDiscardEdit(false)}
                      onConfirm={() => { handleCancelEdit(); }}
                      title="Discard changes?"
                      message="You have unsaved changes. Are you sure you want to discard them?"
                      confirmText="Discard"
                      cancelText="Keep editing"
                      confirmButtonClass="btn-error"
                    />

                   {/* Confirm remove avatar modal (triggered by X button) */}
                   <ConfirmModal
                     isOpen={confirmRemoveAvatar}
                     onClose={cancelRemoveAvatarAction}
                     onConfirm={confirmRemoveAvatarAction}
                     title="Remove profile photo?"
                     message="This will remove your current profile photo. You can undo shortly after removal."
                     confirmText="Remove"
                     cancelText="Keep photo"
                     confirmButtonClass="btn-error"
                   />
                  </div>
 
                  {user?.role === 'teacher' && profile?.role === 'student' && (
                        <div className="mt-6">
                            <h2 className="text-xl mb-2">Purchase History</h2>
                            {loadingOrders ? (
                                <p>Loading…</p>
                            ) : ordersError ? (
                                <p className="text-red-500">{ordersError}</p>
                            ) : orders.length === 0 ? (
                                <p>No purchases by this student.</p>
                            ) : (
                                <div>
                                    {/* Filter / sort bar (same controls as OrderHistory) */}
                                    <OrderFilterBar
                                      search={searchOrders}
                                      setSearch={setSearchOrders}
                                      classroomFilter={classroomFilter}
                                      setClassroomFilter={setClassroomFilter}
                                      classroomOptions={classroomOptions}
                                      sortField={sortField}
                                      setSortField={setSortField}
                                      sortDirection={sortDirection}
                                      setSortDirection={setSortDirection}
                                      onExportCSV={exportCSVProfile}
                                      onExportJSON={exportJSONProfile}
                                      userName={`${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() || profile?.email}
                                      exportLabel="purchase_history"
                                    />

                                    <div className="space-y-4">
                                        {displayed.map(o => (
                                            <OrderCard key={o._id} order={o} />
                                        ))}
                                    </div>

                                    {displayCount < visible.length && <div ref={sentinelRef} className="h-10" />}

                                    <div className="flex justify-center items-center gap-3 mt-4">
                                        <button className="btn btn-sm" onClick={() => setDisplayCount(prev => Math.max(perPage, prev - perPage))} disabled={displayCount <= perPage}>Prev</button>
                                        <div>Showing {Math.min(displayCount, visible.length)} of {visible.length}</div>
                                        <button className="btn btn-sm" onClick={() => setDisplayCount(prev => Math.min(prev + perPage, visible.length))} disabled={displayCount >= visible.length}>More</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
              </div>
          </div>
          <Footer />
      </div>
  );
}

const InfoRow = ({ label, value }) => (
  <div className="flex justify-between border-b border-base-300 pb-2">
      <span className="font-medium text-base-content/70">{label}:</span>
      <span className="text-base-content">{value}</span>
  </div>
);
