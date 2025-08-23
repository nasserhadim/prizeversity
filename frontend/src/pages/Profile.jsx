import { useEffect, useState, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
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
  const { user } = useContext(AuthContext);
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

  const { id: profileId } = useParams();

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
              const res = await axios.get(`/api/profile/student/${profileId}`, {
                  withCredentials: true
              });

              setProfile(res.data);
          } catch (err) {
              console.error('Profile fetch error:', err);
          } finally {
              setLoadingOrders(false);
          }
      };

      if (profileId) fetchProfile();
  }, [profileId]);

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
              const res = await axios.get(`/api/profile/student/${profileId}/stats`, {
                  withCredentials: true
              });
              setStats(res.data);
          } catch (err) {
              console.error('Stats fetch error:', err);
          }
      };
      if (profileId) fetchStats();
  }, [profileId]);

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
              <h2 className="text-2xl font-bold text-center text-base-content">
                  Profile
              </h2>

              <div className="space-y-4">
                  <div className="flex justify-center">
                      {profile?.avatar ? (
                          <img
                              src={profile.avatar.startsWith('data:') ? profile.avatar : (profile.avatar.startsWith('http') ? profile.avatar : `${BACKEND_URL}/uploads/${profile.avatar}`)}
                              alt="Profile"
                              className="w-24 h-24 rounded-full object-cover border-4 border-success"
                              onError={(e) => {
                                  e.target.onerror = null;
                                  if (profile?.profileImage) {
                                      e.target.src = profile.profileImage;
                                  } else {
                                      e.target.style.display = 'none';
                                      if (e.target.nextElementSibling) {
                                          e.target.nextElementSibling.style.display = 'flex';
                                      }
                                  }
                              }}
                          />
                      ) : profile?.profileImage ? (
                          <img
                              src={profile.profileImage}
                              alt="OAuth Profile"
                              className="w-24 h-24 rounded-full object-cover border-4 border-success"
                              onError={(e) => {
                                  e.target.style.display = 'none';
                                  if (e.target.nextElementSibling) {
                                      e.target.nextElementSibling.style.display = 'flex';
                                  }
                              }}
                          />
                      ) : (
                          <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-4xl font-bold text-gray-500">
                              {`${(profile?.firstName?.[0] || profile?.email?.[0] || 'U')}${(profile?.lastName?.[0] || '')}`.toUpperCase()}
                          </div>
                      )}
                  </div>

                  <div className="space-y-2">
                      <InfoRow label="Name" value={[profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || 'Not set (Complete your profile)'} />
                      <InfoRow label="Email" value={profile?.email || 'N/A'} />
                      <InfoRow label="User ID" value={profile?.shortId || '—'} />
                      {profile?.role && (
                          <InfoRow label="Role" value={ROLE_LABELS[profile.role] || profile.role.charAt(0).toUpperCase() + profile.role.slice(1)} />
                      )}
                  </div>

                  {user.role === 'teacher' && profile.role === 'student' && (
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
};

const InfoRow = ({ label, value }) => (
  <div className="flex justify-between border-b border-base-300 pb-2">
      <span className="font-medium text-base-content/70">{label}:</span>
      <span className="text-base-content">{value}</span>
  </div>
);
