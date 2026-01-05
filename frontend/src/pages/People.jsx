import React, { useEffect, useState, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import PendingApprovals from '../components/PendingApprovals';
import socket, { joinUserRoom, joinClassroom } from '../utils/socket';
import Footer from '../components/Footer';
import ExportButtons from '../components/ExportButtons';
import formatExportFilename from '../utils/formatExportFilename';
import StatsAdjustModal from '../components/StatsAdjustModal';
import Avatar from '../components/Avatar';
import XPSettings from '../components/XPSettings';
import { ThemeContext } from '../context/ThemeContext'; // NEW
import { inferAssignerRole } from '../utils/transactions';
import BulkStatsEditor from '../components/BulkStatsEditor';
import EquippedBadge from '../components/EquippedBadge';

// NEW helper for classroom-scoped admin detection (uses fetched classroom + students)
function userIsClassroomAdmin({ user, classroom, students }) {
  if (!user) return false;
  if (classroom && String(classroom.teacher?._id || classroom.teacher) === String(user._id)) return true;
  if (Array.isArray(students)) {
    const me = students.find(s => String(s._id) === String(user._id));
    if (me && me.isClassroomAdmin) return true;
  }
  return false;
}

const ROLE_LABELS = {
  student: 'Student',
  admin: 'Admin/TA',
  teacher: 'Teacher',
};

// Extract a human‑readable source from a stats_adjusted message
const getStatChangeSource = (message) => {
  if (!message) return null;
  const text = String(message);

  // Prefer "via ...:"
  const via = text.match(/via\s+(.+?):/i);
  if (via?.[1]) return via[1].trim();

  // Fallback to "from ...:"
  const from = text.match(/from\s+(.+?):/i);
  if (from?.[1]) return from[1].trim();

  // Last resort: detect Bazaar context like "Bazaar - Shield activated"
  if (/bazaar/i.test(text)) {
    const m = text.match(/Bazaar\s*-\s*([^-:]+)(?=$|[.:])/i);
    return (m?.[1] || 'Bazaar').trim();
  }
  return null;
};

// NEW: parse "Effects: ..." (image parsing removed)
const getEffectsText = (message) => {
  const m = String(message || '').match(/Effects:\s*(.+?)(?:\s*\[img:|$)/i);
  return m?.[1]?.trim() || null;
};

// Extract a trailing suffix from stats_adjusted messages.
// Supports both "Effects:" (system/item) and "Reason:" (manual teacher adjustment).
const getMessageSuffix = (message) => {
  if (!message) return null;
  const text = String(message);

  const reasonIdx = text.lastIndexOf('Reason:');
  if (reasonIdx !== -1) {
    return { label: 'Reason', text: text.slice(reasonIdx + 'Reason:'.length).trim() };
  }

  const effectsIdx = text.lastIndexOf('Effects:');
  if (effectsIdx !== -1) {
    return { label: 'Effects', text: text.slice(effectsIdx + 'Effects:'.length).trim() };
  }

  return null;
};

// add helper near top of file (after imports / before component)
function formatStatChange(c) {
  if (!c || !c.field) return null;
  const raw = String(c.field || '');
  const parts = raw.split('.');
  const base = parts.pop();
  const prefix = parts.length ? parts.join('.') + '.' : '';

  const safeNum = (v, dec = 1) => {
    if (v == null || v === '') return 0;
    const n = Number(v);
    if (Number.isNaN(n)) return 0;
    return dec === 0 ? Math.round(n) : Number(n.toFixed(dec));
  };

  const renderArrowBold = (from, to) => (
    <span>
      {String(from)} <strong>→ {String(to)}</strong>
    </span>
  );

  const renderDelta = (from, to, decimals = null, isXP = false) => {
    // FIX: use the requested decimals when computing delta (not always 0)
    const dec = (decimals == null) ? 1 : decimals;
    const fromN = safeNum(from, dec);
    const toN = safeNum(to, dec);
    const deltaN = toN - fromN;

    const deltaText = (dec === 0) ? `${deltaN}` : `${Number(deltaN).toFixed(dec)}`;
    const cls = deltaN >= 0 ? 'text-success' : 'text-error';
    return <span className={cls}>{` (${deltaN >= 0 ? '+' : ''}${deltaText}${isXP ? ' XP' : ''})`}</span>;
  };

  // xp (integer)
  if (base === 'xp') {
    const from = safeNum(c.from, 0);
    const to = safeNum(c.to, 0);
    return (
      <>
        {prefix}
        <strong>xp:</strong> {renderArrowBold(from, to)}
        {renderDelta(from, to, 0, true)}
      </>
    );
  }

  // multiplier / luck / groupMultiplier (one decimal)
  if (['multiplier', 'luck', 'groupMultiplier'].includes(base)) {
    const fromN = safeNum(c.from, 1);
    const toN = safeNum(c.to, 1);
    return (
      <>
        {prefix}
        <strong>{base}:</strong> {renderArrowBold(fromN.toFixed(1), toN.toFixed(1))}
        {renderDelta(fromN, toN, 1)}
      </>
    );
  }

  // discount (integer percent)
  if (base === 'discount') {
    const from = safeNum(c.from, 0);
    const to = safeNum(c.to, 0);
    return (
      <>
        {prefix}
        <strong>discount:</strong> {renderArrowBold(from, to)}
        {renderDelta(from, to, 0)}
      </>
    );
  }

  // shield (integer)
  if (base === 'shield') {
    const from = safeNum(c.from, 0);
    const to = safeNum(c.to, 0);
    return (
      <>
        {prefix}
        <strong>shield:</strong> {renderArrowBold(from, to)}
        {renderDelta(from, to, 0)}
      </>
    );
  }

  // fallback: raw text
  return (
    <>
      {raw}: <strong>{String(c.from)} → {String(c.to)}</strong>
    </>
  );
}

// add helper near the top (after imports / before component)
const computeTotalSpent = (transactions = [], classroomId, studentList = []) => {
  return (transactions || []).reduce((sum, t) => {
    const amt = Number(t?.amount) || 0;
    if (amt >= 0) return sum;

    // Skip attacks and siphons from "Total Spent"
    const tType = String(t?.type || t?.metadata?.type || '').toLowerCase();
    if (tType === 'attack' || tType === 'siphon') return sum;

    // Also check description for attack-related keywords (for older transactions without type)
    const desc = String(t?.description || '').toLowerCase();
    if (desc.includes('attack:') || desc.includes('drained') || desc.includes('split bits')) return sum;

    // Keep classroom filter
    if (classroomId && t?.classroom && String(t.classroom) !== String(classroomId)) return sum;

    // Exclude teacher/admin adjustments (classroom-scoped)
    const assignerRole = inferAssignerRole(t, studentList);
    if (assignerRole === 'teacher' || assignerRole === 'admin') return sum;

    return sum + Math.abs(amt);
  }, 0);
};

const People = () => {
  // Get classroom ID from URL params
  const { id: classroomId } = useParams();
  const { user } = useAuth();
  // NEW: theme-aware muted text helpers
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'dark';
  const subtleText = isDark ? 'text-base-content/70' : 'text-gray-600';
  const extraSubtleText = isDark ? 'text-base-content/60' : 'text-gray-500';

  const [studentSendEnabled, setStudentSendEnabled] = useState(null);
  const [tab, setTab] = useState('everyone');
  const [statSearch, setStatSearch] = useState('');
  const [statSort, setStatSort] = useState('desc'); // 'desc' | 'asc'
  const [taBitPolicy, setTaBitPolicy] = useState('full');
  const [taGroupPolicy, setTaGroupPolicy] = useState('none'); // NEW
  const [taFeedbackPolicy, setTaFeedbackPolicy] = useState('none'); // NEW
  const [taStatsPolicy, setTaStatsPolicy] = useState('none'); // NEW
  const [studentsCanViewStats, setStudentsCanViewStats] = useState(true);

  // NEW: Settings sub-tabs + pending count badge
  const [settingsSubTab, setSettingsSubTab] = useState('general'); // 'general' | 'ta-requests'
  const [taRequestCount, setTaRequestCount] = useState(0);

  // NEW: refresh pending/assigned Admin/TA request count even if the Requests sub-tab isn't open
  const refreshTaRequestCount = React.useCallback(async () => {
    try {
      if (!classroomId) return;
      if ((user?.role || '').toLowerCase() !== 'teacher') return;
      if (taBitPolicy !== 'approval') {
        setTaRequestCount(0);
        return;
      }

      const res = await axios.get(`/api/pending-assignments/${classroomId}`, { withCredentials: true });
      setTaRequestCount(Array.isArray(res.data) ? res.data.length : 0);
    } catch {
      // don't spam toast; just fail closed
      setTaRequestCount(0);
    }
  }, [classroomId, user?.role, taBitPolicy]);

  // When opening Settings, compute the count immediately (no click needed)
  useEffect(() => {
    if (tab !== 'settings') return;
    refreshTaRequestCount();
  }, [tab, refreshTaRequestCount]);

  // Optional: update count when teacher receives request/approval/rejection notifications
  useEffect(() => {
    if ((user?.role || '').toLowerCase() !== 'teacher') return;
    if (taBitPolicy !== 'approval') return;

    const onNotif = (payload) => {
      const type = String(payload?.type || '');
      const relevant = new Set([
        'bit_assignment_request',
        'bit_assignment_approved',
        'bit_assignment_rejected',
      ]);
      if (!relevant.has(type)) return;

      const notifClassroomId = payload?.classroom?._id || payload?.classroom;
      if (notifClassroomId && String(notifClassroomId) !== String(classroomId)) return;

      refreshTaRequestCount();
    };

    socket.on('notification', onNotif);
    return () => socket.off('notification', onNotif);
  }, [classroomId, taBitPolicy, user?.role, refreshTaRequestCount]);

  // If approval is disabled, don't leave user stuck on the Requests tab
  useEffect(() => {
    if (taBitPolicy !== 'approval' && settingsSubTab === 'ta-requests') {
      setSettingsSubTab('general');
    }
  }, [taBitPolicy, settingsSubTab]);

  const [students, setStudents] = useState([]);
  const [classroom, setClassroom] = useState(null);
  // Compute classroom-scoped admin flag from annotated students list
  const isClassroomAdmin = React.useMemo(() => {
    return userIsClassroomAdmin({ user, classroom, students });
  }, [user?._id, classroom, students]);

  // NEW: detect if current user is a student member of this classroom
  const isMemberStudent = React.useMemo(() => {
    if (!user?._id || !Array.isArray(students)) return false;
    return students.some(s => String(s._id) === String(user._id));
  }, [students, user?._id]);

  // NEW: viewer is student-only (not teacher, not classroom TA) — should still see "My Stat Changes"
  const isTeacher = String(classroom?.teacher?._id || classroom?.teacher || '') === String(user?._id);
  const studentViewOnly = !isTeacher && !isClassroomAdmin && isMemberStudent;

  // NEW: compute if viewer can adjust stats (teacher OR Admin/TA with permission)
  const canAdjustStats = React.useMemo(() => {
    if (!user || !classroomId) return false;
    if (isTeacher) return true;
    if (isClassroomAdmin && taStatsPolicy === 'full') return true;
    return false;
  }, [user?._id, isTeacher, isClassroomAdmin, taStatsPolicy]);

  // Map of studentId -> total spent (number)
  const [totalSpentMap, setTotalSpentMap] = useState({});
  // per-student cached stats and loading flag
  const [studentStatsMap, setStudentStatsMap] = useState({}); // NEW: per-student stats cache
  const [studentStatsLoading, setStudentStatsLoading] = useState(false);
  const [groupSets, setGroupSets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('default');
  const [roleFilter, setRoleFilter] = useState('all'); // Add role filter state
  const [siphonTimeoutHours, setSiphonTimeoutHours] = useState(72);
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [unassignedSearch, setUnassignedSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState(''); // New state for group search
  // Stats adjust modal state (teacher-only)
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [statsModalStudent, setStatsModalStudent] = useState(null);
  // NEW: stat-change log (teacher view only)
  const [statChanges, setStatChanges] = useState([]);
  const [loadingStatChanges, setLoadingStatChanges] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'online' | 'offline'
  // Helper: compute online presence for a student
  const isStudentOnline = (s) => onlineUserIds.has(String(s._id));

  // Presence: initial fetch + live updates
  useEffect(() => {
    if (!classroomId || !user?._id) return;

    // ensure server gets my userId regardless of socket auth
    socket.emit('join', `classroom-${classroomId}`, { userId: user._id });
    socket.emit('join-classroom', classroomId, { userId: user._id });

    const onPresence = (payload) => {
      if (String(payload?.classroomId) !== String(classroomId)) return;
      const ids = (payload?.onlineUserIds || []).map(String);
      const set = new Set(ids);
      setOnlineUserIds(set);
      window.__classroomOnlineSet = set;
    };
    socket.on('presence:update', onPresence);

    // initial presence fetch
    axios.get(`/api/classroom/${classroomId}/online-users`, { withCredentials: true })
      .then(r => {
        const ids = (r.data?.onlineUserIds || []).map(String);
        const set = new Set(ids);
        setOnlineUserIds(set);
        window.__classroomOnlineSet = set;
      })
      .catch(() => {
        setOnlineUserIds(new Set());
        window.__classroomOnlineSet = new Set();
      });

    return () => {
      // Remove listener only; do NOT emit leave-classroom on tab switch
      socket.off('presence:update', onPresence);
    };
  }, [classroomId, user?._id]);

  const navigate = useNavigate();

  // Load stat-change log for teacher/admin/student viewers
 useEffect(() => {
   const viewerRole = (user?.role || '').toLowerCase();
   if (!classroomId || !user || !['teacher', 'admin', 'student'].includes(viewerRole)) return;
   let mounted = true;
   (async () => {
     try {
       await fetchStatChanges({ page: 1, append: false });
     } catch (e) {
       if (mounted) console.debug('[People] failed to auto-load stat changes', e);
     }
   })();
   return () => { mounted = false; };
 }, [user, classroomId]);

  // Fetch classroom settings including students can view stats
  const fetchClassroom = async () => {
    try {
      const res = await axios.get(`/api/classroom/${classroomId}`, {
        withCredentials: true,
      });
      setClassroom(res.data);
      setStudentsCanViewStats(res.data.studentsCanViewStats !== false); // Default to true if not set
    } catch (err) {
      console.error('Failed to fetch classroom', err);
    }
  };

  // Add this function
  const fetchSiphonTimeout = async () => {
    try {
      const res = await axios.get(
        `/api/classroom/${classroomId}/siphon-timeout`,
        { withCredentials: true }
      );
      setSiphonTimeoutHours(res.data.siphonTimeoutHours || 72);
    } catch (err) {
      console.error('Failed to fetch siphon timeout', err);
      setSiphonTimeoutHours(72); // Default fallback
    }
  };

  // Fetch Admin/TA bit sending policy for classroom
  const fetchTaBitPolicy = async () => {
    try {
      const res = await axios.get(
        `/api/classroom/${classroomId}/ta-bit-policy`,
        { withCredentials: true }
      );
      setTaBitPolicy(res.data.taBitPolicy);
    } catch (err) {
      console.error('Failed to fetch Admin/TA bit policy', err);
    }
  };

  // NEW: fetch Admin/TA group management policy
  const fetchTaGroupPolicy = async () => {
    try {
      const res = await axios.get(
        `/api/classroom/${classroomId}/ta-group-policy`,
        { withCredentials: true }
      );
      setTaGroupPolicy(res.data.taGroupPolicy || 'none');
    } catch (err) {
      // endpoint is teacher-only; default safely
      setTaGroupPolicy('none');
    }
  };

  // NEW: fetch Admin/TA feedback moderation policy
  const fetchTaFeedbackPolicy = async () => {
    try {
      const res = await axios.get(
        `/api/classroom/${classroomId}/ta-feedback-policy`,
        { withCredentials: true }
      );
      setTaFeedbackPolicy(res.data.taFeedbackPolicy || 'none');
    } catch (err) {
      // endpoint is teacher-only; default safely
      setTaFeedbackPolicy('none');
    }
  };

  // NEW: fetch Admin/TA stats adjustment policy
  const fetchTaStatsPolicy = async () => {
    try {
      const res = await axios.get(
        `/api/classroom/${classroomId}/ta-stats-policy`,
        { withCredentials: true }
      );
      setTaStatsPolicy(res.data.taStatsPolicy || 'none');
    } catch (err) {
      // endpoint is teacher-only; default safely
      setTaStatsPolicy('none');
    }
  };

  // Add function to fetch the students can view stats setting
  const fetchStudentsCanViewStatsSetting = async () => {
    try {
      const res = await axios.get(`/api/classroom/${classroomId}/students-can-view-stats`, {
        withCredentials: true,
      });
      setStudentsCanViewStats(res.data.studentsCanViewStats !== false);
    } catch (err) {
      console.error('Failed to fetch students can view stats setting', err);
      setStudentsCanViewStats(true); // Default to true
    }
  };

  // NEW: stat-changes paging state
  const STAT_CHANGES_PER_PAGE = 200;
  const [statChangesTotal, setStatChangesTotal] = useState(0);
  const [statChangesPage, setStatChangesPage] = useState(1);

  // UPDATED: Fetch stat-change log for this classroom with pagination
  const fetchStatChanges = async ({ page = 1, append = false } = {}) => {
    if (!classroomId) return;
    try {
      setLoadingStatChanges(true);

      const res = await axios.get(`/api/classroom/${classroomId}/stat-changes`, {
        withCredentials: true,
        params: { page, perPage: STAT_CHANGES_PER_PAGE }
      });

      const data = res.data;

      // Back-compat: old endpoint returned an array
      const logs = Array.isArray(data) ? (data || []) : (data?.logs || []);
      const total = Array.isArray(data) ? logs.length : Number(data?.total ?? logs.length);

      setStatChangesTotal(Number.isFinite(total) ? total : logs.length);
      setStatChangesPage(Array.isArray(data) ? 1 : Number(data?.page ?? page));

      if (!append || page === 1) {
        setStatChanges(Array.isArray(logs) ? logs : []);
        return;
      }

      // append with de-dupe by _id
      setStatChanges(prev => {
        const map = new Map();
        (Array.isArray(prev) ? prev : []).forEach(x => {
          const k = x?._id ? String(x._id) : null;
          if (k) map.set(k, x);
        });
        (Array.isArray(logs) ? logs : []).forEach(x => {
          const k = x?._id ? String(x._id) : null;
          if (k && !map.has(k)) map.set(k, x);
        });
        return Array.from(map.values());
      });
    } catch (err) {
      console.error('[People] fetchStatChanges failed', err);
      setStatChanges([]);
      setStatChangesTotal(0);
      setStatChangesPage(1);
    } finally {
      setLoadingStatChanges(false);
    }
  };

  // Initial data fetch + robust realtime handlers
  useEffect(() => {
    if (!classroomId) return;
    // Record "Last Accessed" for the current user
    (async () => {
      try {
        await axios.post(`/api/classroom/${classroomId}/access`, {}, { withCredentials: true });
      } catch (e) {
        console.debug('[People] failed to record access', e?.message || e);
      }
    })();

    fetchClassroom();
    fetchStudents();
    fetchGroupSets();
    fetchTaBitPolicy();
    fetchTaGroupPolicy(); // NEW
    fetchTaFeedbackPolicy(); // NEW
    fetchTaStatsPolicy(); // NEW
    fetchSiphonTimeout();
    fetchStatChanges({ page: 1, append: false });

    // Add classroom removal handler
    const handleClassroomRemoval = (data) => {
      // data may include userId and classroomId
      const payloadUserId = String(data?.userId || data?.targetUser || '');
      const myId = String(user?._id || '');
      const sameClass = String(data?.classroomId) === String(classroomId);

      // Only react if this removal targets ME and it’s for THIS classroom
      if (sameClass && payloadUserId && payloadUserId === myId) {
        try { socket.emit('leave-classroom', classroomId, { userId: user._id }); } catch(e){/*ignore*/}
        toast.error(data.message || 'You have been removed from this classroom');
        setTimeout(() => navigate('/classrooms'), 2000);
      }
    };

    socket.on('classroom_removal', handleClassroomRemoval);

    // Fetch if student send is enabled, with fallback default false
    axios
      .get(`/api/classroom/${classroomId}/student-send-enabled`, {
        withCredentials: true,
      })
     .then((r) => setStudentSendEnabled(!!r.data.studentSendEnabled))
      .catch(() => setStudentSendEnabled(false)); // safe default

      // This is now the single source of truth for real-time updates to this setting.
      socket.on('classroom_update', (updatedClassroom) => {
        console.log('classroom_update received, banLog:', updatedClassroom.banLog);
        if (updatedClassroom._id === classroomId) {
          console.debug('[socket] People classroom_update received, updating state from payload.');
          console.debug('[socket] Updated classroom data:', updatedClassroom);
          // Update the entire classroom object and the specific setting state from the socket payload.
          setClassroom(prev => ({ ...prev, ...updatedClassroom }));
          setStudentsCanViewStats(updatedClassroom.studentsCanViewStats !== false);
        }
      });

    // Join helper (use shared helpers so server room names match)
    const joinRooms = () => {
      if (user?._id) {
        console.debug('[socket] People joining user room', user._id);
        joinUserRoom(user._id);
      }
      if (classroomId) {
        console.debug('[socket] People joining classroom room', classroomId);
        joinClassroom(classroomId);
      }
    };
    if (socket.connected) joinRooms();
    socket.on('connect', joinRooms);

    // Normalize payloads from various backend emits
    const normalize = (p) => {
      // common shapes:
      // { studentId, newBalance, classroomId }
      // { type, user: { _id, balance }, classroom: <id|obj>, ... }
      // { results: [{ id, newBalance }, ...], classroomId }
      const uid = p?.studentId || p?.user?._id || p?.userId || p?.user?._id || p?.userId || p?.id;
      const classroom = p?.classroom?._id || p?.classroomId || p?.classroom;
      const newBalance =
        p?.newBalance ??
        p?.balance ??
        p?.user?.balance ??
        p?.amount ?? // sometimes payload carries amount only
        null;
      return { uid, newBalance, classroom };
    };

    // Apply update for single user; fallback to fetch if we don't have newBalance
    const applyUpdateForUser = async (uid, newBalance, fromClassroom) => {
      if (!uid) return;
      // if event specifies a classroom and it doesn't match current, ignore
      if (fromClassroom && String(fromClassroom) !== String(classroomId)) return;

      if (newBalance != null) {
        setStudents(prev =>
          prev.map(s => {
            if (String(s._id) !== String(uid)) return s;
            const updated = { ...s };
            // update top-level balance
            updated.balance = newBalance;
            // update per-classroom entry if present
            const cb = Array.isArray(updated.classroomBalances) ? [...updated.classroomBalances] : [];
            const idx = cb.findIndex(item => String(item.classroom) === String(classroomId));
            if (idx >= 0) {
              cb[idx] = { ...cb[idx], balance: newBalance };
            } else if (newBalance != null) {
              cb.push({ classroom: classroomId, balance: newBalance });
            }
            if (cb.length) updated.classroomBalances = cb;
            return updated;
          })
        );
        return;
      }

      // no newBalance in payload → re-fetch the user's per-classroom balance
      try {
        const { data } = await axios.get(`/api/users/${uid}?classroomId=${classroomId}`, { withCredentials: true });
        setStudents(prev => prev.map(s => (String(s._id) === String(uid) ? { ...s, balance: data.balance } : s)));
      } catch (err) {
        console.error('[People] failed to refresh single user balance', err);
      }
    };

    // Handlers accept a variety of event shapes
    const balanceHandler = (payload) => {
      console.debug('[socket] People balance_update payload:', payload);
      // group emits sometimes include results array
      if (Array.isArray(payload?.results) && payload.results.length > 0) {
        payload.results.forEach(r => {
          const uid = r.id || r._id || r.userId;
          const nb = r.newBalance ?? r.newBal ?? r.balance ?? null;
          applyUpdateForUser(uid, nb, payload.classroomId || payload.classroom);
        });
        return;
      }

      const { uid, newBalance, classroom } = normalize(payload);
      // sometimes notification wraps user object
      applyUpdateForUser(uid, newBalance, classroom);
    };

    const notificationHandler = (payload) => {
      console.debug('[socket] People notification payload:', payload);
      // React only to wallet-related notifications
      const walletTypes = new Set(['wallet_topup','wallet_transfer','wallet_adjustment','wallet_payment','wallet_transaction']);
      if (payload?.type && !walletTypes.has(payload.type)) return;

      // If notification carries a populated user or studentId, use it
      if (Array.isArray(payload?.results) && payload.results.length) {
        payload.results.forEach(r => applyUpdateForUser(r.id || r._id, r.newBalance ?? r.newBal ?? null, payload.classroomId || payload.classroom));
        return;
      }

      const uid = payload?.user?._id || payload?.studentId || payload?.userId || payload?.user;
      const newBalance = payload?.newBalance ?? payload?.amount ?? payload?.user?.balance ?? null;
      const classroom = payload?.classroom?._id || payload?.classroomId || payload?.classroom;
      applyUpdateForUser(uid, newBalance, classroom);
    };

    // Also listen for group-adjust events that return results array
    const groupBalanceHandler = (payload) => {
      console.debug('[socket] People balance_adjust payload:', payload);
      if (!Array.isArray(payload?.results)) return;
      payload.results.forEach(r => applyUpdateForUser(r.id || r._id, r.newBalance ?? r.newBal ?? null, payload.classroomId || payload.classroom));
    };

    socket.on('balance_update', balanceHandler);
    socket.on('notification', notificationHandler);
    socket.on('balance_adjust', groupBalanceHandler);

    // ── Ensure classroom-scoped / bulk wallet events refresh the full student list ──
    const refreshOnBulkHandler = (payload) => {
      try {
        // If payload is classroom-scoped and does not specifically target the signed-in user,
        // or if it contains a results array (bulk adjust), refresh the full students list.
        const classroomFromPayload = payload?.classroomId || payload?.classroom?._id || payload?.classroom;
        const hasResults = Array.isArray(payload?.results) && payload.results.length > 0;
        const targetsMultiple = hasResults || (!payload?.studentId && !payload?.user?._id);

        if (classroomFromPayload && String(classroomFromPayload) !== String(classroomId)) return;
        if (hasResults || targetsMultiple) {
          console.debug('[socket] People bulk balance event — refreshing all students', payload);
          fetchStudents();
          return;
        }

        // If single-target event but not ourselves, re-fetch that single user (ensure other users update)
        const studentId = payload?.studentId || payload?.user?._id || payload?.userId;
        if (studentId && String(studentId) !== String(user?._id)) {
          console.debug('[socket] People single-target event for other user — refetch single user', { studentId });
          axios.get(`/api/users/${studentId}?classroomId=${classroomId}`, { withCredentials: true })
            .then(({ data }) => {
              setStudents(prev => prev.map(s => (String(s._id) === String(studentId) ? { ...s, balance: data.balance } : s)));
            })
            .catch(err => console.error('[People] failed to refresh single user (bulk fallback)', err));
        }
      } catch (err) {
        console.error('[People] refreshOnBulkHandler error', err);
      }
    };

    socket.on('balance_update', refreshOnBulkHandler); // classroom-scoped single/multi emits
    socket.on('balance_adjust', () => {
      console.debug('[socket] balance_adjust received — refreshing students');
      fetchStudents();
    }); // group bulk events
    socket.on('notification', (payload) => {
      const walletTypes = new Set(['wallet_topup','wallet_transfer','wallet_adjustment','wallet_payment','wallet_transaction']);
      if (payload?.type && walletTypes.has(payload.type)) {
        // Some notifications are per-user, some are bulk — refresh to be safe
        console.debug('[socket] wallet notification received — refreshing students', payload);
        fetchStudents();
      }
    });
    // ── end bulk-refresh handlers ──

    return () => {
      socket.off('connect', joinRooms);
      socket.off('balance_update', balanceHandler);
      socket.off('notification', notificationHandler);
      socket.off('balance_adjust', groupBalanceHandler);
      socket.off('balance_update', refreshOnBulkHandler);
      socket.off('balance_adjust');
      socket.off('notification');
      socket.off('classroom_removal', handleClassroomRemoval); // Add cleanup
    };
  }, [classroomId, user?._id, navigate]); // Add navigate to dependencies


// Fetch students with per-classroom balances
  const fetchStudents = async () => {
    try {
      const res = await axios.get(`/api/classroom/${classroomId}/students`, { withCredentials: true });
      setStudents(res.data); // Should include per-classroom balance
    } catch (err) {
      console.error('Failed to fetch students', err);
    }
  };

  // Fetch group sets for this classroom
  const fetchGroupSets = async () => {
    try {
      const res = await axios.get(`/api/group/groupset/classroom/${classroomId}`);
      setGroupSets(res.data);
    } catch (err) {
      console.error('Failed to fetch group sets', err);
    }
  };

  // Add helper to detect ban info for a student
const getBanInfo = (student, classroomObj) => {
  const banLog = (Array.isArray(classroomObj?.banLog) && classroomObj.banLog.length)
    ? classroomObj.banLog
    : (Array.isArray(classroomObj?.bannedRecords) ? classroomObj.bannedRecords : []);
  const banRecord = (banLog || []).find(br => String(br.user?._id || br.user) === String(student._id));
  if (banRecord) {
    return { banned: true, reason: banRecord.reason || '', bannedAt: banRecord.bannedAt || null };
  }
  const bannedStudents = Array.isArray(classroomObj?.bannedStudents) ? classroomObj.bannedStudents : [];
  const bannedIds = bannedStudents.map(b => (b && b._id) ? String(b._id) : String(b));
  if (bannedIds.includes(String(student._id))) {
    return { banned: true, reason: '', bannedAt: null };
  }
  return { banned: false, reason: '', bannedAt: null };
};

  // Filter and sort students based on searchQuery, sortOption, and roleFilter
  const filteredStudents = [...students]
    .filter((student) => {
      const firstName = (student.firstName || '').toLowerCase();
      const lastName = (student.lastName || '').toLowerCase();
      const email = (student.email || '').toLowerCase();
      const fullName = `${firstName} ${lastName}`.trim().toLowerCase();
      const query = searchQuery.toLowerCase();
      
      // Search filter
      const matchesSearch = (
        firstName.includes(query) ||
        lastName.includes(query) ||
        email.includes(query) ||
        fullName.includes(query)
      );

      // Role filter (adds 'banned' option)
      if (roleFilter === 'banned') {
        const banInfo = getBanInfo(student, classroom);
        return matchesSearch && banInfo.banned;
      }
      const matchesRole = roleFilter === 'all' || student.role === roleFilter;
      
      if (statusFilter === 'online' && !isStudentOnline(student)) return false;
      if (statusFilter === 'offline' && isStudentOnline(student)) return false;

      return matchesSearch && matchesRole;
    })
    .sort((a, b) => {
      // Only allow balance sorting for teachers/admins
      if (sortOption === 'balanceDesc' && (user?.role === 'teacher' || isClassroomAdmin)) {
        return (b.balance || 0) - (a.balance || 0);
      } else if (sortOption === 'balanceAsc' && (user?.role === 'teacher' || isClassroomAdmin)) {
        return (a.balance || 0) - (b.balance || 0);
      } else if (sortOption === 'totalSpentDesc' && (user?.role === 'teacher' || isClassroomAdmin)) {
        const aVal = Number(totalSpentMap[a._id] || 0);
        const bVal = Number(totalSpentMap[b._id] || 0);
        return bVal - aVal;
      } else if (sortOption === 'totalSpentAsc' && (user?.role === 'teacher' || isClassroomAdmin)) {
        const aVal = Number(totalSpentMap[a._id] || 0);
        const bVal = Number(totalSpentMap[b._id] || 0);
        return aVal - bVal;
      } else if (sortOption === 'multiplierDesc') {
        const aStats = studentStatsMap[a._id] || {};
        const bStats = studentStatsMap[b._id] || {};
        const aVal = Number(aStats.multiplier || aStats.multiplier || 1);
        const bVal = Number(bStats.multiplier || bStats.multiplier || 1);
        return bVal - aVal;
      } else if (sortOption === 'multiplierAsc') {
        const aStats = studentStatsMap[a._id] || {};
        const bStats = studentStatsMap[b._id] || {};
        const aVal = Number(aStats.multiplier || 1);
        const bVal = Number(bStats.multiplier || 1);
        return aVal - bVal;
      } else if (sortOption === 'luckDesc') {
        const aStats = studentStatsMap[a._id] || {};
        const bStats = studentStatsMap[b._id] || {};
        const aVal = Number(aStats.luck ?? 1);
        const bVal = Number(bStats.luck ?? 1);
        return bVal - aVal;
      } else if (sortOption === 'luckAsc') {
        const aStats = studentStatsMap[a._id] || {};
        const bStats = studentStatsMap[b._id] || {};
        const aVal = Number(aStats.luck ?? 1);
        const bVal = Number(bStats.luck ?? 1);
        return aVal - bVal;
      } else if (sortOption === 'shieldDesc') {
        // sort by shieldCount then boolean active
        const aStats = studentStatsMap[a._id] || {};
        const bStats = studentStatsMap[b._id] || {};
        const aVal = Number(aStats.shieldCount || (aStats.shieldActive ? 1 : 0));
        const bVal = Number(bStats.shieldCount || (bStats.shieldActive ? 1 : 0));
        return bVal - aVal;
      } else if (sortOption === 'shieldAsc') {
        const aStats = studentStatsMap[a._id] || {};
        const bStats = studentStatsMap[b._id] || {};
        const aVal = Number(aStats.shieldCount || (aStats.shieldActive ? 1 : 0));
        const bVal = Number(bStats.shieldCount || (bStats.shieldActive ? 1 : 0));
        return aVal - bVal;
      } else if (sortOption === 'attackDesc') {
        const aStats = studentStatsMap[a._id] || {};
        const bStats = studentStatsMap[b._id] || {};
        const aVal = Number(aStats.attackPower || 0);
        const bVal = Number(bStats.attackPower || 0);
        return bVal - aVal;
      } else if (sortOption === 'attackAsc') {
        const aStats = studentStatsMap[a._id] || {};
        const bStats = studentStatsMap[b._id] || {};
        const aVal = Number(aStats.attackPower || 0);
        const bVal = Number(bStats.attackPower || 0);
        return aVal - bVal;
      } else if (sortOption === 'discountDesc') {
        const aStats = studentStatsMap[a._id] || {};
        const bStats = studentStatsMap[b._id] || {};
        const aVal = Number(aStats.discountShop || aStats.discount || 0);
        const bVal = Number(bStats.discountShop || bStats.discount || 0);
        return bVal - aVal;
      } else if (sortOption === 'discountAsc') {
        const aStats = studentStatsMap[a._id] || {};
        const bStats = studentStatsMap[b._id] || {};
        const aVal = Number(aStats.discountShop || aStats.discount || 0);
        const bVal = Number(bStats.discountShop || bStats.discount || 0);
        return aVal - bVal;
      } else if (sortOption === 'nameAsc') {
        const nameA = (a.firstName || a.name || '').toLowerCase();
        const nameB = (b.firstName || b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      } else if (sortOption === 'joinDateAsc') {
        const dateA = new Date(a.joinedAt || a.createdAt || 0);
        const dateB = new Date(b.joinedAt || b.createdAt || 0);
        return dateA - dateB;
      } else if (sortOption === 'joinDateDesc') {
        const dateA = new Date(a.joinedAt || a.createdAt || 0);
        const dateB = new Date(b.joinedAt || b.createdAt || 0);
        return dateB - dateA;
      } else if (sortOption === 'lastAccessedDesc') {
        const ad = new Date(a.lastAccessed || 0).getTime();
        const bd = new Date(b.lastAccessed || 0).getTime();
        return bd - ad;
      } else if (sortOption === 'lastAccessedAsc') {
        const ad = new Date(a.lastAccessed || 0).getTime();
        const bd = new Date(b.lastAccessed || 0).getTime();
        return ad - bd;
      }
      return 0; // Default order
    });

  // ── Fetch per-student "total spent" (sum of negative transaction amounts) for teacher/admin viewers ──
  useEffect(() => {
    // Only fetch when classroom teacher or classroom-scoped Admin/TA is viewing
    if (!user || !(user?.role === 'teacher' || isClassroomAdmin)) return;
    if (!classroomId) return;

    // Fetch for all students in the classroom (not just first N)
    const ids = Array.isArray(students) ? students.map(s => s._id).filter(Boolean) : [];
    if (!ids.length) {
      setTotalSpentMap({});
      return;
    }
 
    let cancelled = false;
    (async () => {
      try {
        const promises = ids.map(id =>
          axios
            .get(`/api/wallet/transactions/all?studentId=${id}&classroomId=${classroomId}`, { withCredentials: true })
            .then(res => {
              const txs = Array.isArray(res.data) ? res.data : (res.data?.transactions || []);
              // Exclude teacher/admin adjustments and non-matching classroom txs
              const spent = txs.reduce((sum, t) => {
                const amt = Number(t?.amount) || 0;
                if (amt >= 0) return sum;

                const assignerRole = inferAssignerRole(t, students);
                if (assignerRole === 'teacher' || assignerRole === 'admin') return sum;

                if (classroomId && t?.classroom && String(t.classroom) !== String(classroomId)) return sum;

                return sum + Math.abs(amt);
              }, 0);
              return { id, spent };
            })
            .catch((err) => {
              console.debug('[People] failed to fetch transactions for', id, err?.message || err);
              return { id, spent: 0 };
            })
        );
 
        const results = await Promise.all(promises);
        if (cancelled) return;
        const map = {};
        results.forEach(r => { map[r.id] = r.spent; });
        setTotalSpentMap(map);
       } catch (err) {
         if (!cancelled) console.error('[People] failed to load per-student totals', err);
       }
     })();
 
     return () => { cancelled = true; };
  }, [user, classroomId, students]);
  // ── end per-student totals effect ──

  // ── Fetch per-student stats (all students) — debounced so rapid sort/select changes don't refire immediately ──
  useEffect(() => {
    const viewerRole = (user?.role || '').toLowerCase();
    const statFields = ['multiplier','luck','shield','attack','discount'];
    const statSortSelected = statFields.some(f => sortOption.includes(f));
 
    // Only fetch stats if:
    // - we have a classroom and students
    // - and either viewer is teacher/admin, or student view is allowed, or a stat-based sort is active
    const viewerIsTeacherOrClassAdmin = (user?.role === 'teacher' || isClassroomAdmin);
    const shouldFetch = classroomId &&
      Array.isArray(students) && students.length > 0 &&
      (viewerIsTeacherOrClassAdmin || (user?.role === 'student' && studentsCanViewStats) || statSortSelected);
 
    if (!shouldFetch) {
      setStudentStatsMap({});
      setStudentStatsLoading(false);
      return;
    }
 
    let cancelled = false;
    setStudentStatsLoading(true);
 
    // Debounce to avoid refiring many requests for quick select changes
    const idsKey = students.map(s => s._id).join(',');
    const timer = setTimeout(async () => {
      try {
        const ids = students.map(s => s._id).filter(Boolean);
        const promises = ids.map(id =>
          axios.get(`/api/stats/student/${id}?classroomId=${classroomId}`, { withCredentials: true })
            .then(r => ({ id, stats: r.data || {} }))
            .catch((err) => {
              console.debug('[People] failed to fetch stats for', id, err?.message || err);
              return { id, stats: {} };
            })
        );
        const results = await Promise.all(promises);
        if (cancelled) return;
        const statsMap = {};
        results.forEach(r => { statsMap[r.id] = r.stats || {}; });
        setStudentStatsMap(statsMap);
      } catch (err) {
        if (!cancelled) console.error('[People] failed to fetch student stats', err);
      } finally {
        if (!cancelled) setStudentStatsLoading(false);
      }
    }, 350); // 350ms debounce
 
    return () => { cancelled = true; clearTimeout(timer); setStudentStatsLoading(false); };
  }, [
    classroomId,
    // watch student ids, sortOption, viewer role, and the classroom setting for student visibility
    students.map(s => s._id).join(','),
    sortOption,
    (user?.role || '').toLowerCase(),
    studentsCanViewStats
  ]);
  // ── end stats fetch effect ──

  // Handle bulk user upload via Excel file
  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      try {
        await axios.post(
          '/api/users/bulk-upload',
          { classroomId, users: jsonData },
          { withCredentials: true }
        );
        toast.success('Users uploaded successfully');
        fetchStudents();
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to upload users');
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Replace the old handleExportToExcel function with these new export functions
  const exportPeopleToCSV = async () => {
    if (!filteredStudents.length) {
      throw new Error('No students to export');
    }

    const dataToExport = await Promise.all(
      filteredStudents.map(async (student) => {
        let stats = {};
        let groups = [];
        let xpData = {};

        // Fetch stats + XP (run in parallel)
        try {
          const [statsRes, xpRes] = await Promise.all([
            axios.get(`/api/stats/student/${student._id}?classroomId=${classroomId}`, { withCredentials: true }),
            axios.get(`/api/xp/classroom/${classroomId}/user/${student._id}`, { withCredentials: true })
          ]);
          stats = statsRes.data || {};
          xpData = xpRes.data || {};
        } catch (err) {
          console.error('Failed to fetch stats/xp for student:', student._id);
        }

        // Collect groups
        try {
          groupSets.forEach(groupSet => {
            groupSet.groups.forEach(group => {
              const isMember = group.members.some(member =>
                String(member._id._id || member._id) === String(student._id) &&
                member.status === 'approved'
              );
              if (isMember) groups.push(`${groupSet.name}: ${group.name}`);
            });
          });
        } catch (err) {
          console.error('Failed to process groups for student:', student._id);
        }

        return {
          ClassroomId: classroomId,
          ClassroomName: classroom?.name || '',
          ClassroomCode: classroom?.code || '',
          Name: `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.email,
          Email: student.email,
          UserId: student._id,
          ShortId: student.shortId || '',
          Role: student.isClassroomAdmin ? ROLE_LABELS['admin'] : (ROLE_LABELS[student.role] || student.role),
          Balance: student.balance?.toFixed(2) || '0.00',
          TotalSpent: (Number(totalSpentMap[student._id] || 0)).toFixed(2),
          JoinedDate: student.joinedAt
            ? new Date(student.joinedAt).toLocaleString()
            : student.createdAt
              ? new Date(student.createdAt).toLocaleString()
              : 'Unknown',
          LastAccessed: student.lastAccessed
            ? new Date(student.lastAccessed).toLocaleString()
            : '—',
          Level: xpData.level || 1,
          XP: xpData.xp || 0,
          Luck: stats.luck || 1,
          Multiplier: stats.multiplier || 1,
          GroupMultiplier: stats.groupMultiplier || 1,
          ShieldActive: stats.shieldActive ? 'Yes' : 'No',
          ShieldCount: stats.shieldCount || 0,
          AttackPower: stats.attackPower || 0,
          DoubleEarnings: stats.doubleEarnings ? 'Yes' : 'No',
          DiscountShop: stats.discountShop || 0,
          PassiveItemsCount: stats.passiveItemsCount || 0,
          Groups: groups.length > 0 ? groups.join('; ') : 'Unassigned',
          // ADD: OnlineStatus value to match CSV header
          OnlineStatus: onlineUserIds.has(String(student._id)) ? 'Online' : 'Offline',
        };
      })
    );

    // Explicit header ordering (ADD LastAccessed after JoinedDate)
    const headers = [
      'ClassroomId','ClassroomName','ClassroomCode','Name','Email',
      'UserId','ShortId','Role','Balance','TotalSpent',
      'JoinedDate','LastAccessed','Level','XP','Luck','Multiplier','GroupMultiplier','ShieldActive','ShieldCount',
      'AttackPower','DoubleEarnings','DiscountShop','PassiveItemsCount','Groups','OnlineStatus' // add here
    ];

    const csvContent = [
      headers.join(','),
      ...dataToExport.map(row =>
        headers.map(header => {
          const value = row[header];
          if (value === null || value === undefined) return '';
          const str = String(value);
          return (/[",\n]/.test(str)) ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const classroomName = classroom?.name || 'Unknown';
    const classroomCode = classroom?.code || classroomId;
    const base = formatExportFilename(`${classroomName}_${classroomCode}_people`, 'export');
    a.download = `${base}.csv`;
    a.href = url;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return `${base}.csv`;
  };

  const exportPeopleToJSON = async () => {
    if (!filteredStudents.length) {
      throw new Error('No students to export');
    }

    const dataToExport = await Promise.all(
      filteredStudents.map(async (student) => {
        let stats = {};
        let groups = [];
        let xpData = {};

        try {
          const [statsRes, xpRes] = await Promise.all([
            axios.get(`/api/stats/student/${student._id}?classroomId=${classroomId}`, { withCredentials: true }),
            axios.get(`/api/xp/classroom/${classroomId}/user/${student._id}`, { withCredentials: true })
          ]);
          stats = statsRes.data || {};
          xpData = xpRes.data || {};
        } catch (err) {
          console.error('Failed to fetch stats/xp for student:', student._id);
        }

        try {
          groupSets.forEach(groupSet => {
            groupSet.groups.forEach(group => {
              const isMember = group.members.some(member =>
                String(member._id._id || member._id) === String(student._id) &&
                member.status === 'approved'
              );
              if (isMember) {
                groups.push({
                  groupSetName: groupSet.name,
                  groupName: group.name,
                  groupSetId: groupSet._id,
                  groupId: group._id
                });
              }
            });
          });
        } catch (err) {
          console.error('Failed to process groups for student:', student._id);
        }

        const banInfo = getBanInfo(student, classroom);

        return {
          classroomId,
          classroomName: classroom?.name || '',
          classroomCode: classroom?.code || '',
          _id: student._id,
          userId: student._id,
          shortId: student.shortId || null,
          name: `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.email,
          firstName: student.firstName,
          lastName: student.lastName,
          email: student.email,
          role: student.role,
          balance: student.balance || 0,
          totalSpent: Number(
            (totalSpentMap && typeof totalSpentMap[student._id] !== 'undefined')
              ? totalSpentMap[student._id]
              : computeTotalSpent(student.transactions || [], classroomId, students)
          ),
          joinedDate: student.joinedAt || student.createdAt || null,
          lastAccessed: student.lastAccessed ? new Date(student.lastAccessed).toISOString() : null,
          level: xpData.level || 1,
          xp: xpData.xp || 0,
          stats: {
            luck: stats.luck || 1,
            multiplier: stats.multiplier || 1,
            groupMultiplier: stats.groupMultiplier || 1,
            shieldActive: stats.shieldActive || false,
            shieldCount: stats.shieldCount || 0,
            attackPower: stats.attackPower || 0,
            doubleEarnings: stats.doubleEarnings || false,
            discountShop: stats.discountShop || 0,
            passiveItemsCount: stats.passiveItemsCount || 0
          },
          groups: groups.length ? groups : ['Unassigned'],
          classroom: { _id: classroomId, name: classroom?.name, code: classroom?.code },
          status: banInfo.banned ? 'banned' : (student.role || 'unknown'),
          banReason: banInfo.reason || '',
          banTimestamp: banInfo.bannedAt ? new Date(banInfo.bannedAt).toISOString() : null,
          // ADD: online boolean for JSON export
          online: onlineUserIds.has(String(student._id)),
          exportedAt: new Date().toISOString(),
          exportedFrom: 'people_page'
        };
      })
    );

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const classroomName = classroom?.name || 'Unknown';
    const classroomCode = classroom?.code || classroomId;
    const base = formatExportFilename(`${classroomName}_${classroomCode}_people`, 'export');
    a.download = `${base}.json`;
    a.href = url;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return `${base}.json`;
  };
  // ── Join each student's user room so per-user notifications/balance events are received ──
  useEffect(() => {
    if (!Array.isArray(students) || students.length === 0) return;

    const joinAllStudentRooms = () => {
      console.debug('[socket] People joining student user rooms for', students.length, 'students');
      students.forEach(s => {
        if (s && s._id) {
          try {
            // Prefer shared helper
            joinUserRoom(s._id);
          } catch (e) {
            // fallback: emit the alternate join events the server may expect
            try { socket.emit('join-user', s._id); } catch (err) { /* ignore */ }
            try { socket.emit('join', `user-${s._id}`); } catch (err) { /* ignore */ }
          }
        }
      });
    };

    if (socket.connected) joinAllStudentRooms();
    socket.on('connect', joinAllStudentRooms); // re-join on reconnect

    // --- New: handle classroom-scoped balance_update for other students by re-fetching that single user ---
    const otherStudentBalanceHandler = async (payload) => {
      try {
        const studentId = payload?.studentId || payload?.user?._id || payload?.userId;
        const classroomFromPayload = payload?.classroomId || payload?.classroom?._id || payload?.classroom;
        if (!studentId) return;
        // ignore events not for this classroom (if classroom specified)
        if (classroomFromPayload && String(classroomFromPayload) !== String(classroomId)) return;
        // ignore current signed-in user here (already handled elsewhere)
        if (String(studentId) === String(user?._id)) return;

        // Re-fetch that single user's per-classroom balance (works even if server prevents joining other user rooms)
        const { data } = await axios.get(`/api/users/${studentId}?classroomId=${classroomId}`, { withCredentials: true });
        setStudents(prev => prev.map(s => (String(s._id) === String(studentId) ? { ...s, balance: data.balance } : s)));
        console.debug('[People] updated student balance from server', { studentId, balance: data.balance });
      } catch (err) {
        console.error('[People] failed to refresh other student balance', err);
      }
    };

    socket.on('balance_update', otherStudentBalanceHandler);

    // optional cleanup: server may manage room membership so leaving is optional
    return () => {
      socket.off('connect', joinAllStudentRooms);
      socket.off('balance_update', otherStudentBalanceHandler);
    };
  }, [students]);
  // ── end join student rooms effect ──

  // Add this function with the other handler functions
  const handleRemoveStudent = (studentId, studentName) => {
    toast((t) => (
      <div className="flex flex-col">
        <span>Remove "{studentName}" from this classroom?</span>
        <div className="flex justify-end gap-2 mt-2">
          <button
            className="btn btn-error btn-sm"
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                await axios.delete(`/api/classroom/${classroomId}/students/${studentId}`, {
                  withCredentials: true
                });
                toast.success('Student removed successfully!');
                fetchStudents(); // Refresh the student list
              } catch (err) {
                console.error('Failed to remove student:', err);
                toast.error(err.response?.data?.error || 'Failed to remove student');
              }
            }}
          >
            Remove
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => toast.dismiss(t.id)}
          >
            Cancel
          </button>
        </div>
      </div>
    ));
  };

  { /* Add helper to unban (place near other handlers like handleRemoveStudent) */ }
const handleUnbanStudent = async (studentId) => {
  try {
    await axios.post(`/api/classroom/${classroomId}/students/${studentId}/unban`, {}, { withCredentials: true });
    toast.success('Student unbanned');
    await fetchStudents();
    await fetchClassroom();
    // Add a small delay to ensure state propagates
    setTimeout(() => setClassroom(prev => ({ ...prev })), 500); // Force re-render if needed
  } catch (err) {
    console.error('Failed to unban', err);
    toast.error(err.response?.data?.error || 'Failed to unban student');
  }
};

  // Add this helper function near the top of the People component
  const getUnassignedStudents = (students, groupSets) => {
    const assignedStudentIds = new Set();
    
    // Collect all student IDs that are assigned to any group in any group set
    groupSets.forEach(groupSet => {
      groupSet.groups.forEach(group => {
        group.members.forEach(member => {
          if (member._id && member.status === 'approved') {
            const studentId = member._id._id || member._id;
            assignedStudentIds.add(String(studentId));
          }
        });
      });
    });
    
    // Return students who are not in any group
    return students.filter(student => 
      student.role === 'student' && 
      !assignedStudentIds.has(String(student._id))
    );
  };

  // Add this helper function
const getGroupAssignmentStats = (students, groupSets) => {
  const totalStudents = students.filter(s => s.role === 'student').length;
  const assignedStudents = totalStudents - getUnassignedStudents(students, groupSets).length;
  const assignmentRate = totalStudents > 0 ? (assignedStudents / totalStudents * 100).toFixed(1) : 0;
  
  return { totalStudents, assignedStudents, assignmentRate };
};

  const stats = getGroupAssignmentStats(students, groupSets);

  // Add visible / total counts for UI
const totalPeople = students.length;
const visibleCount = filteredStudents.length;

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow p-6 w-full max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">
            {classroom
              ? `${classroom.name}${classroom.code ? ` (${classroom.code})` : ''} People`
              : 'People'}
          </h1>

          {/* New: show counts */}
          <div className={`text-sm ${subtleText} mt-1`}>
            Showing {visibleCount} of {totalPeople} people
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mb-6 items-center">
          <button
            className={`btn flex-shrink-0 ${tab === 'everyone' ? 'btn-success' : 'btn-outline'}`}
            onClick={() => setTab('everyone')}
          >
            Everyone
          </button>
          <button
            className={`btn flex-shrink-0 ${tab === 'groups' ? 'btn-success' : 'btn-outline'}`}
            onClick={() => setTab('groups')}
          >
            Groups
          </button>
          {/* Stat Changes tab (teacher, classroom TA, or student member of this classroom) */}
          {(isTeacher || isClassroomAdmin || isMemberStudent) && (
            <button
              className={`btn flex-shrink-0 ${tab === 'stat-changes' ? 'btn-success' : 'btn-outline'}`}
              onClick={() => setTab('stat-changes')}
            >
              {studentViewOnly ? 'My Stat Changes' : 'Stat Changes'}
            </button>
          )}
          {user?.role?.toLowerCase() === 'teacher' && (
            <button
              className={`btn flex-shrink-0 ${tab === 'settings' ? 'btn-success' : 'btn-outline'}`}
              onClick={() => setTab('settings')}
            >
              Settings
            </button>
          )}
          {(user?.role?.toLowerCase() === 'teacher' || (isClassroomAdmin && taStatsPolicy === 'full')) && (
  <button
    className={`btn flex-shrink-0 ${tab === 'bulk-stats' ? 'btn-success' : 'btn-outline'}`}
    onClick={() => setTab('bulk-stats')}
  >
    Bulk Adjust Stats
  </button>
)}
        </div>
{/* ─────────────── Settings TAB ─────────────── */}
        {tab === 'settings' && (user?.role || '').toLowerCase() === 'teacher' && (
          <div className="w-full space-y-6 min-w-0">
             <h2 className="text-2xl font-semibold">People Settings</h2>

            {/* settings sub-tabs */}
            <div role="tablist" className="tabs tabs-boxed flex-wrap">
              <button
                type="button"
                role="tab"
                className={`tab min-w-0 ${settingsSubTab === 'general' ? 'tab-active' : ''}`}
                onClick={() => setSettingsSubTab('general')}
              >
                General
              </button>

              <button
                type="button"
                role="tab"
                className={`tab min-w-0 ${settingsSubTab === 'xp-leveling' ? 'tab-active' : ''}`}
                onClick={() => setSettingsSubTab('xp-leveling')}
              >
                <span className="hidden sm:inline">XP & Leveling</span>
                <span className="sm:hidden">XP/Leveling</span>
              </button>

              {taBitPolicy === 'approval' && (
                <button
                  type="button"
                  role="tab"
                  className={`tab min-w-0 ${settingsSubTab === 'ta-requests' ? 'tab-active' : ''}`}
                  onClick={() => setSettingsSubTab('ta-requests')}
                >
                  <span className="hidden sm:inline">Admin/TA Requests ({taRequestCount})</span>
                  <span className="sm:hidden">Requests ({taRequestCount})</span>
                </button>
              )}
            </div>

            {/* GENERAL SETTINGS PANEL */}
            {settingsSubTab === 'general' && (
              <div className="space-y-6">
                <label className="form-control w-full">
                  <span className="label-text mb-2 font-medium">Admin/TA bit assignment</span>

                  <select
                    className="select select-bordered w-full"
                    value={taBitPolicy ?? 'full'}
                    onChange={async (e) => {
                      const newPolicy = e.target.value;
                      try {
                        await axios.patch(
                          `/api/classroom/${classroomId}/ta-bit-policy`,
                          { taBitPolicy: newPolicy },
                          { withCredentials: true }
                        );
                        toast.success('Updated Admin/TA bit policy');
                        setTaBitPolicy(newPolicy);
                      } catch (err) {
                        toast.error(err.response?.data?.error || 'Failed to update policy');
                      }
                    }}
                  >
                    <option value="full">Full permission (no approval needed)</option>
                    <option value="approval">Approval required</option>
                    <option value="none">No permission</option>
                  </select>

                  <div className="label">
                    <span className="label-text-alt">
                      Controls whether Admin/TAs can assign bits to students and adjust group balances directly or need
                      teacher approval
                    </span>
                  </div>
                </label>

                {/* NEW: Admin/TA group management */}
                <label className="form-control w-full">
                  <span className="label-text mb-2 font-medium">Admin/TA group management</span>

                  <select
                    className="select select-bordered w-full"
                    value={taGroupPolicy ?? 'none'}
                    onChange={async (e) => {
                      const newPolicy = e.target.value;
                      try {
                        await axios.patch(
                          `/api/classroom/${classroomId}/ta-group-policy`,
                          { taGroupPolicy: newPolicy },
                          { withCredentials: true }
                        );
                        toast.success('Updated Admin/TA group management policy');
                        setTaGroupPolicy(newPolicy);
                      } catch (err) {
                        toast.error(err.response?.data?.error || 'Failed to update policy');
                      }
                    }}
                  >
                    <option value="full">Enabled (Admin/TA can manage groups)</option>
                    <option value="none">Disabled (teacher only)</option>
                  </select>

                  <div className="label">
                    <span className="label-text-alt">
                      Controls whether classroom Admin/TAs can add/edit/delete GroupSets/Groups, approve/reject/suspend members, and modify GroupSet/Group multipliers.
                      (Group Adjust remains controlled by the Admin/TA bit policy.)
                    </span>
                  </div>
                </label>

                {/* NEW: Admin/TA feedback moderation */}
                <label className="form-control w-full">
                  <span className="label-text mb-2 font-medium">Admin/TA feedback moderation</span>

                  <select
                    className="select select-bordered w-full"
                    value={taFeedbackPolicy ?? 'none'}
                    onChange={async (e) => {
                      const newPolicy = e.target.value;
                      try {
                        await axios.patch(
                          `/api/classroom/${classroomId}/ta-feedback-policy`,
                          { taFeedbackPolicy: newPolicy },
                          { withCredentials: true }
                        );
                        toast.success('Updated Admin/TA feedback moderation policy');
                        setTaFeedbackPolicy(newPolicy);
                      } catch (err) {
                        toast.error(err.response?.data?.error || 'Failed to update policy');
                      }
                    }}
                  >
                    <option value="full">Enabled (Admin/TA can moderate feedback)</option>
                    <option value="none">Disabled (teacher only)</option>
                  </select>

                  <div className="label">
                    <span className="label-text-alt">
                      Controls whether classroom Admin/TAs can view hidden feedback, access moderation logs, hide/unhide feedback, and respond to reports.
                    </span>
                  </div>
                </label>

                {/* NEW: Admin/TA stats adjustment */}
                <label className="form-control w-full">
                  <span className="label-text mb-2 font-medium">Admin/TA stats adjustment</span>

                  <select
                    className="select select-bordered w-full"
                    value={taStatsPolicy ?? 'none'}
                    onChange={async (e) => {
                      const newPolicy = e.target.value;
                      try {
                        await axios.patch(
                          `/api/classroom/${classroomId}/ta-stats-policy`,
                          { taStatsPolicy: newPolicy },
                          { withCredentials: true }
                        );
                        toast.success('Updated Admin/TA stats adjustment policy');
                        setTaStatsPolicy(newPolicy);
                      } catch (err) {
                        toast.error(err.response?.data?.error || 'Failed to update policy');
                      }
                    }}
                  >
                    <option value="full">Enabled (Admin/TA can adjust stats)</option>
                    <option value="none">Disabled (teacher only)</option>
                  </select>

                  <div className="label">
                    <span className="label-text-alt">
                      Controls whether classroom Admin/TAs can adjust student stats (multiplier, luck, discount, shield, XP) using the Adjust Stats button.
                    </span>
                  </div>
                </label>

                {/* Add Siphon Timeout Setting */}
                <label className="form-control w-full">
                  <span className="label-text mb-2 font-medium">Siphon Review Timeout</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="168"
                      className="input input-bordered w-24"
                      value={siphonTimeoutHours}
                      onChange={async (e) => {
                        const newTimeout = parseInt(e.target.value);
                        if (newTimeout < 1 || newTimeout > 168) {
                          toast.error('Timeout must be between 1 and 168 hours');
                          return;
                        }
                        try {
                          await axios.post(
                            `/api/classroom/${classroomId}/siphon-timeout`,
                            { siphonTimeoutHours: newTimeout },
                            { withCredentials: true }
                          );
                          toast.success('Updated siphon timeout');
                          setSiphonTimeoutHours(newTimeout);
                        } catch (err) {
                          toast.error(err.response?.data?.error || 'Failed to update siphon timeout');
                        }
                      }}
                    />
                    <span className="label-text">hours</span>
                  </div>
                  <div className="label">
                    <span className="label-text-alt">
                      How long students have to vote and teacher has to review siphon requests before they automatically
                      expire
                    </span>
                  </div>
                </label>

                <label className="form-control w-full">
                  <span className="label-text mb-2 font-medium">Student-to-student bit transfers</span>
                  <input
                    type="checkbox"
                    className="toggle toggle-success"
                    checked={studentSendEnabled}
                    onChange={async (e) => {
                      const isEnabled = e.target.checked;
                      try {
                        await axios.patch(
                          `/api/classroom/${classroomId}/student-send-enabled`,
                          { studentSendEnabled: isEnabled },
                          { withCredentials: true }
                        );
                        toast.success(`Student transfers ${isEnabled ? 'enabled' : 'disabled'}`);
                        setStudentSendEnabled(isEnabled);
                      } catch (err) {
                        toast.error('Failed to update setting');
                      }
                    }}
                  />
                  <div className="label">
                    <span className="label-text-alt">Allow students to send bits to each other directly</span>
                  </div>
                </label>

                <label className="form-control w-full">
                  <span className="label-text mb-2 font-medium">Allow students to view other students' stats</span>
                  <input
                    type="checkbox"
                    className="toggle toggle-success"
                    checked={studentsCanViewStats}
                    onChange={async (e) => {
                      const isEnabled = e.target.checked;
                      setStudentsCanViewStats(isEnabled);
                      try {
                        await axios.patch(
                          `/api/classroom/${classroomId}/students-can-view-stats`,
                          { studentsCanViewStats: isEnabled },
                          { withCredentials: true }
                        );
                        toast.success(
                          `Students can ${isEnabled ? 'now' : 'no longer'} view other students' stats`
                        );
                      } catch (err) {
                        setStudentsCanViewStats(!isEnabled);
                        toast.error('Failed to update setting');
                      }
                    }}
                  />
                  <div className="label">
                    <span className="label-text-alt">
                      Allow students to see each other's luck, multiplier, and other stats
                    </span>
                  </div>
                </label>
              </div>
            )}

            {/* XP & LEVELING SETTINGS PANEL - NEW TAB */}
            {settingsSubTab === 'xp-leveling' && (
              <div className="space-y-6">
                <XPSettings classroomId={classroomId} />
              </div>
            )}

            {/* ADMIN/TA REQUESTS PANEL */}
            {settingsSubTab === 'ta-requests' && taBitPolicy === 'approval' && (
              <div className="card bg-base-100 border border-base-200">
                <div className="card-body">
                  <h3 className="card-title text-base">Admin/TA Adjustment Requests</h3>
                  <p className="text-sm text-base-content/70">
                    These requests require teacher approval.
                  </p>

                  <PendingApprovals
                    classroomId={classroomId}
                    onCountChange={setTaRequestCount}
                  />
                </div>
              </div>
            )}
          </div>
        )}
        {/* ───────────────────────────────────────────── */}
        {tab === 'everyone' && (
          <div>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
              {/* Unified filter bar: search -> role/sort -> exports */}
              <div className="mb-4 flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[220px]">
                  <input
                    type="search"
                    placeholder="Search by name or email..."
                    className="input input-bordered w-full"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Role Filter */}
                <select
                  className="select select-bordered"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <option value="all">All Roles</option>
                  <option value="student">Students</option>
                  <option value="admin">Admin/TAs</option>
                  <option value="teacher">Teachers</option>
                  <option value="banned">Banned</option> {/* <-- NEW */}
                </select>

                {/* Status Filter - NEW */}
                <select
                  className="select select-bordered"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                </select>

                {/* Sort */}
                <div className="flex items-center gap-2">
                <select
                  className="select select-bordered"
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value)}
                >
                   <option value="default">Sort By</option>
                   {(user?.role === 'teacher' || isClassroomAdmin) && (
                     <>
                       <option value="balanceDesc">Balance (High → Low)</option>
                       <option value="balanceAsc">Balance (Low → High)</option>
                       <option value="totalSpentDesc">Total Spent (High → Low)</option>
                       <option value="totalSpentAsc">Total Spent (Low → High)</option>
                     </>
                   )}
                {/* Stat-based sorting — only show if viewer allowed to see stats */}
                {(() => {
                  const canSeeStats = (user?.role === 'teacher' || user?.role === 'admin' || (user?.role === 'student' && studentsCanViewStats));
                  if (!canSeeStats) return null;
                  return (
                    <>
                      <option value="multiplierDesc">Multiplier (High → Low)</option>
                      <option value="multiplierAsc">Multiplier (Low → High)</option>
                      <option value="luckDesc">Luck (High → Low)</option>
                      <option value="luckAsc">Luck (Low → High)</option>
                      <option value="shieldDesc">Shield (Most → Least)</option>
                      <option value="shieldAsc">Shield (Least → Most)</option>
                      <option value="attackDesc">Attack (High → Low)</option>
                      <option value="attackAsc">Attack (Low → High)</option>
                      <option value="discountDesc">Discount (High → Low)</option>
                      <option value="discountAsc">Discount (Low → High)</option>
                    </>
                  );
                })()}
                   <option value="nameAsc">Name (A → Z)</option>
                   <option value="joinDateDesc">Join Date (Newest)</option>
                   <option value="joinDateAsc">Join Date (Oldest)</option>
                   {/* NEW: last accessed */}
                   <option value="lastAccessedDesc">Last Accessed (Newest)</option>
                   <option value="lastAccessedAsc">Last Accessed (Oldest)</option>
                </select>
                {/* loading indicator when a stat-based sort is selected and stats are still loading */}
                {studentStatsLoading && ['multiplier','luck','shield','attack','discount'].some(f => sortOption.includes(f)) && (
                  <span className="loading loading-spinner loading-sm ml-2" title="Loading stats…"></span>
                )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {(user?.role === 'teacher' || isClassroomAdmin) && (
                  <div className="ml-auto flex items-center">
                    <ExportButtons
                      onExportCSV={exportPeopleToCSV}
                      onExportJSON={exportPeopleToJSON}
                      userName={classroom?.name || 'classroom'}
                      exportLabel="people"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {filteredStudents.length === 0 ? (
                <p>No matching {roleFilter === 'all' ? 'people' : roleFilter === 'admin' ? 'Admin/TAs' : `${roleFilter}s`} found.</p>
              ) : (
                filteredStudents.map((student) => {
                  const isBanned = Boolean(
                    // Normalize bannedStudents entries (may be Object or id) and prefer banLog if present
                    (() => {
                      // Prefer canonical banLog but fall back to older 'bannedRecords' shape.
                      const banLog = (Array.isArray(classroom?.banLog) && classroom.banLog.length) 
                        ? classroom.banLog 
                        : (Array.isArray(classroom?.bannedRecords) ? classroom.bannedRecords : []);
                      const banRecord = (banLog || []).find(br => String(br.user?._id || br.user) === String(student._id));
                      console.log('classroom.banLog:', classroom?.banLog);
                      console.log('student._id:', student._id);
                      console.log('banRecord found:', banRecord);
                      if (banRecord) {
                        console.log('banRecord.reason:', banRecord.reason);
                        console.log('banRecord.bannedAt:', banRecord.bannedAt);
                        return true;
                      }
                      const bannedStudents = Array.isArray(classroom?.bannedStudents) ? classroom.bannedStudents : [];
                      const bannedIds = bannedStudents.map(b => (b && b._id) ? String(b._id) : String(b));
                      return bannedIds.includes(String(student._id));
                    })()
                  );
                  const banRecord = (classroom?.banLog || []).find(br => String(br.user?._id || br.user) === String(student._id));

                  return (
                    <div key={student._id} className="border p-3 rounded shadow flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-3">
                          {/* NEW: avatar next to the name */}
                          <Avatar user={student} size={36} showStatus />
                        </div>
                        <div className="font-medium text-lg flex items-center gap-2">
                          {student.firstName || student.lastName
                            ? `${student.firstName || ''} ${student.lastName || ''}`.trim()
                            : student.name || student.email}
                          {/* NEW: Show equipped badge */}
                          {student.equippedBadge && (
                            <EquippedBadge badge={student.equippedBadge} size={20} />
                          )}
                        <span className={`ml-2 ${subtleText} text-sm`}>
                          {/* Classroom‑scoped role label */}
                          {(() => {
                            const teacherId = String(classroom?.teacher?._id || classroom?.teacher || '');
                            const isTeacher = String(student._id) === teacherId || student.role === 'teacher';
                            const isTA = !!student.isClassroomAdmin;
                            const label = isTeacher
                              ? ROLE_LABELS.teacher
                              : isTA
                                ? ROLE_LABELS.admin
                                : ROLE_LABELS.student;
                            return <> – Role: {label}</>;
                          })()}
                        </span>
                        </div>

                        {isBanned && (
                          <div className="mt-1">
                            <span className="badge badge-error mr-2">BANNED</span>
                            <div className="text-xs text-red-600">
                              {banRecord ? (
                                <div>
                                  {(user?.role === 'teacher' || isClassroomAdmin) ? (
                                    <div>
                                      Reason: {banRecord.reason || 'Not specified'}
                                      <div>• {new Date(banRecord.bannedAt).toLocaleString()}</div>
                                    </div>
                                  ) : (
                                    <div>• {new Date(banRecord.bannedAt).toLocaleString()}</div>
                                  )}
                                </div>
                              ) : (
                                <div>Banned (no details available)</div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Only show balance to teachers/admins */}
                        {(user?.role?.toLowerCase() === 'teacher' || isClassroomAdmin) && (
                          <div className="text-sm text-gray-500 mt-1">
                            Balance: ₿{student.balance?.toFixed(2) || '0.00'}
                          </div>
                        )}

                        {/* Show total spent to teachers/admins */}
                        {(user?.role?.toLowerCase() === 'teacher' || isClassroomAdmin) && (
                          <div className="text-sm text-gray-500">
                            Total spent: ₿{((totalSpentMap[student._id] || 0)).toFixed(2)}
                          </div>
                        )}

                        {/* Join date display */}
                        <div className="text-sm text-gray-500 mt-1">
                          Joined: {student.joinedAt
                            ? new Date(student.joinedAt).toLocaleString()
                            : student.createdAt
                              ? new Date(student.createdAt).toLocaleString()

                              : 'Unknown'}
                        </div>
                        {/* NEW: Last accessed display */}
                        <div className="text-sm text-gray-500">
                          Last Accessed: {student.lastAccessed
                            ? new Date(student.lastAccessed).toLocaleString()
                            : '—'}
                        </div>
                      </div>

                      <div className="flex gap-2 mt-2 flex-wrap">
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => navigate(
                            `/classroom/${classroomId}/profile/${student._id}`,
                            { state: { from: 'people', classroomId } }
                          )}
                        >
                          View Profile
                        </button>

                        {/* 
                          Show "View Stats" button if:
                          1. The current user is a teacher or admin.
                          OR
                          2. The student in the list is the current user (you can always see your own stats).
                          OR
                          3. The current user is a student AND the classroom setting allows it.
                                               */}
                        {(user?.role === 'teacher' || isClassroomAdmin || String(student._id) === String(user?._id) || (user?.role === 'student' && studentsCanViewStats)) && (
                          <button
                            className="btn btn-xs sm:btn-sm btn-success"
                            onClick={() => navigate(`/classroom/${classroomId}/student/${student._id}/stats`, {
                              state: { from: 'people' }
                            })}
                          >
                            View Stats
                          </button>
                        )}

                        {/* Teacher OR Admin/TA (if allowed): open modal to adjust student stats */}
                        {canAdjustStats && String(student._id) !== String(user._id) && (
                          <button
                            className="btn btn-xs sm:btn-sm btn-outline ml-2"
                            onClick={(e) => { e.stopPropagation(); setStatsModalStudent(student); setStatsModalOpen(true); }}
                          >
                            Adjust Stats
                          </button>
                        )}

                        {/* Add Remove Student button for teachers */}
                        {user?.role?.toLowerCase() === 'teacher' && student.role !== 'teacher' && String(student._id) !== String(user._id) && (
                          <>
                            <button
                              type="button"
                              className="btn btn-xs sm:btn-sm btn-error"
                              onClick={() => handleRemoveStudent(student._id, student.firstName || student.lastName ? `${student.firstName || ''} ${student.lastName || ''}`.trim() : student.email)}
                            >
                              Remove
                            </button>



                            {/* Show Unban if banned, otherwise show Ban */}
                            {isBanned ? (
                              <button
                                type="button"
                                className="btn btn-xs sm:btn-sm btn-success"
                                onClick={(e) => { e.stopPropagation(); handleUnbanStudent(student._id); }}
                              >
                                Unban
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-xs sm:btn-sm btn-warning"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toast((t) => (
                                    <div className="flex flex-col" onClick={(ev) => ev.stopPropagation()}>
                                      <span>Ban "{student.firstName || student.lastName ? `${student.firstName || ''} ${student.lastName || ''}`.trim() : student.email}" from this classroom?</span>
                                      <textarea
                                        id={`ban-reason-${student._id}`}
                                        placeholder="Optional reason (shown to student)"
                                        autoFocus
                                        rows={3}
                                        className="textarea textarea-sm textarea-bordered mt-2 w-full"
                                        style={{ backgroundColor: '#ffffff', color: '#000000', padding: '8px' }}
                                      />
                                      <div className="flex justify-end gap-2 mt-2">
                                        <button
                                          type="button"
                                          className="btn btn-warning btn-sm"
                                          onClick={async (ev) => {
                                            ev.stopPropagation();
                                            const input = document.getElementById(`ban-reason-${student._id}`);
                                            const reason = input ? input.value : '';
                                            toast.dismiss(t.id);
                                            try {
                                              await axios.post(
                                                `/api/classroom/${classroomId}/students/${student._id}/ban`,
                                                { reason },
                                                { withCredentials: true }
                                              );
                                              toast.success('Student banned');
                                              await fetchStudents();
                                              await fetchClassroom();
                                              setTimeout(() => setClassroom(prev => ({ ...prev })), 500);
                                            } catch (err) {
                                              console.error('Failed to ban', err);
                                              toast.error(err.response?.data?.error || 'Failed to ban student');
                                                                                       }
                                          }}
                                        >
                                          Yes
                                        </button>
                                        <button type="button" className="btn btn-ghost btn-sm" onClick={(ev) => { ev.stopPropagation(); toast.dismiss(t.id); }}>
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ), { duration: Infinity }); // <- keep modal visible until dismissed programmatically
                                }}
                              >
                                Ban
                              </button>
                            )}
                          </>
                        )}

                        {/* Role change dropdown */}
                        {user?.role?.toLowerCase() === 'teacher'
            && student.role !== 'teacher'
          && String(student._id) !== String(user._id) && (
                          <select
                            className="select select-sm ml-2"
                            value={student.role}
                            onChange={async (e) => {
                              const newRole = e.target.value;
                              try {
                                if (newRole === 'admin') {
                                  await axios.post(`/api/users/${student._id}/make-admin`,{ classroomId });
                                  console.log('Student promoted to Admin/TA in classroom:', classroomId);
                                  toast.success('Student promoted to Admin/TA');
                                } else {
                                  await axios.post(`/api/users/${student._id}/demote-admin`, { classroomId });
                                  console.log('Admin/TA demoted to Student in classroom:', classroomId);
                                  toast.success('Admin/TA demoted to Student');
                                }
                                fetchStudents();
                              } catch (err) {
                                toast.error(err.response?.data?.error || 'Error changing role');
                              }
                            }}
                          >
                            <option value="student">{ROLE_LABELS.student}</option>
                            <option value="admin">{ROLE_LABELS.admin}</option>
                          </select>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {tab === 'groups' && (
          <div className="space-y-6 w-full min-w-0">
            {/* Add search input for groups */}
    <div className="flex items-center gap-2 mb-4">
      <input
        type="text"
        placeholder="Search groups..."
        className="input input-bordered flex-1"
        value={groupSearch}
        onChange={(e) => setGroupSearch(e.target.value)}
      />
    </div>

    {/* Add Unassigned Students Filter */}
    {(user?.role === 'teacher' || user?.role === 'admin' || user?.role === 'student') && (
      <div className="card bg-base-100 shadow-sm border">
        <div className="card-body p-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">
              Unassigned Students ({getUnassignedStudents(students, groupSets).length})
            </h3>
            <button
              className="btn btn-sm btn-outline"
              onClick={() => setShowUnassigned(!showUnassigned)}
            >
              {showUnassigned ? 'Hide' : 'Show'} Unassigned
            </button>
          </div>
          
          {showUnassigned && (
            <div className="mt-4">
              {getUnassignedStudents(students, groupSets).length === 0 ? (
                <p className="text-gray-500 italic">All students are assigned to groups!</p>
              ) : (
                <div className="space-y-2">
                  <p className={`text-sm ${subtleText} mb-3`}>
                    Students who haven't joined any group yet:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {getUnassignedStudents(students, groupSets)
                      .filter(student => {
                        const name = `${student.firstName || ''} ${student.lastName || ''}`.trim().toLowerCase();
                        const email = student.email.toLowerCase();
                        const query = unassignedSearch.toLowerCase();
                        return name.includes(query) || email.includes(query);
                      })
                      .map(student => {
                        const banInfo = getBanInfo(student, classroom);
                        const isBanned = Boolean(banInfo?.banned);

                        return (
                          <div 
                            key={student._id} 
                            className="flex justify-between items-center p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800"
                          >
                            {/* avatar + name + equipped badge */}
                            <div className="flex items-center gap-2">
                              <Avatar user={student} size={24} />
                              <span className="font-medium">
                                {student.firstName || student.lastName
                                  ? `${student.firstName || ''} ${student.lastName || ''}`.trim()
                                  : student.email}
                              </span>
                              {/* Show equipped badge */}
                              {student.equippedBadge && (
                                <EquippedBadge badge={student.equippedBadge} size={18} />
                              )}
                              {isBanned && <span className="badge badge-error ml-2">BANNED</span>}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                className="btn btn-xs btn-outline"
                                onClick={() => navigate(
                                  `/classroom/${classroomId}/profile/${student._id}`,
                                  { state: { from: 'people', classroomId } }
                                )}
                              >
                                Profile
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )}
    
    {/* Existing group sets content */}
    {groupSets.length === 0 ? (
      <p>No groups available yet.</p>
    ) : (
      groupSets
        // Keep a groupset if:
        // - no query, OR groupset name matches, OR any group name matches, OR any member name/email matches
        .filter(gs => {
          const q = groupSearch.toLowerCase().trim(); // Define q here
          if (!q) return true;
          if ((gs.name || '').toLowerCase().includes(q)) return true;
          if (Array.isArray(gs.groups) && gs.groups.some(g => (g.name || '').toLowerCase().includes(q))) return true;
          if (Array.isArray(gs.groups) && gs.groups.some(g => (g.members || []).some(m => {
            const memberUser = m._id || {};
            const memberName = (typeof memberUser === 'object' && memberUser) ? `${memberUser.firstName || ''} ${memberUser.lastName || ''}`.trim() : '';
            const memberEmail = (typeof memberUser === 'object' && memberUser) ? (memberUser.email || '') : '';
            const hay = `${memberName || ''} ${memberEmail || ''}`.toLowerCase();
            return hay.includes(q);
          }))) return true;
          return false;
        })
        .map((gs) => (
        <div key={gs._id} className="w-full min-w-0">


          <h2 className="text-xl font-semibold">{gs.name}</h2>
          <div className="mt-2 grid grid-cols-1 gap-4 w-full">
            {gs.groups
              // Keep a group if:
              // - no query, OR group name matches, OR any member name/email matches
              .filter(group => {
                const q = groupSearch.toLowerCase().trim(); // Define q here
                if (!q) return true;
                if ((group.name || '').toLowerCase().includes(q)) return true;
                if ((group.members || []).some(m => {
                  const memberUser = m._id || {};
                  const memberName = (typeof memberUser === 'object' && memberUser) ? `${memberUser.firstName || ''} ${memberUser.lastName || ''}`.trim() : '';
                  const memberEmail = (typeof memberUser === 'object' && memberUser) ? (memberUser.email || '') : '';
                  const hay = `${memberName || ''} ${memberEmail || ''}`.toLowerCase();
                  return hay.includes(q);
                })) return true;
                return false;
              })
              .map((group) => (
              <div key={group._id} className="border p-4 rounded w-full min-w-0 bg-base-100">
                 <h3 className="text-lg font-bold">{group.name}</h3>
                 {/* Add group multiplier display */}
                 <p className={`text-sm ${subtleText}`}>
                  Members: {group.members.filter(m => m._id && m.status === 'approved').length}/{group.maxMembers || 'No limit'} • 
                  Multiplier: {Number(group.groupMultiplier || 1).toFixed(2).replace(/\.?0+$/,'')}x
                   {group.isAutoMultiplier ? (
                     <span className="text-green-600 text-xs ml-1">(Auto)</span>
                   ) : (
                     <span className="text-orange-600 text-xs ml-1">(Manual)</span>
                   )}
                 </p>
                 {group.members.length === 0 ? (
                   <p className="text-gray-500">No members</p>
                ) : (
                  <ul className="list-disc ml-5 space-y-1">
                    {group.members
                      .filter(m => m && m._id && (m.status === 'approved' || m.status === 'pending')) // include pending
                      .map((m) => {
                        const memberUser = m._id;
                        const userId = memberUser._id || memberUser; // handle populated object or raw id
                        const displayName = memberUser && (memberUser.firstName || memberUser.lastName)
                          ? `${memberUser.firstName || ''} ${memberUser.lastName || ''}`.trim()
                          : memberUser?.name || memberUser?.email || 'Unknown User';

                        // Find equipped badge from students array (which has equippedBadge from backend)
                        const studentData = students.find(s => String(s._id) === String(userId));
                        const equippedBadge = studentData?.equippedBadge || null;

                         // Determine banned state for this member (reuse classroom shape logic)
                        const banLog = (Array.isArray(classroom?.banLog) && classroom.banLog.length)
                          ? classroom.banLog
                          : (Array.isArray(classroom?.bannedRecords) ? classroom.bannedRecords : []);
                        const isBannedMember = Boolean(
                          banLog.find(br => String(br.user?._id || br.user) === String(userId)) ||
                          (Array.isArray(classroom?.bannedStudents) &&
                            classroom.bannedStudents.map(b => (b && b._id) ? String(b._id) : String(b)).includes(String(userId)))
                        );

                        // Determine siphoned state: either account frozen for this classroom OR an active siphon targeting them
                        const isFrozenForClassroom = Boolean(
                          memberUser?.classroomFrozen?.some(cf => String(cf.classroom) === String(classroomId))
                        );
                        const isTargetOfActiveSiphon = Boolean(
                           (group?.siphonRequests || []).some(r =>
                            String(r.targetUser?._id || r.targetUser) === String(userId) &&
                            ['pending','group_approved'].includes(r.status)
                           )
                         );
                         const isSiphoned = isFrozenForClassroom || isTargetOfActiveSiphon;

                        // Only allow viewing the siphoned badge if the current viewer is a teacher/admin
                        // or is an approved member of this group (mirrors Groups.jsx visibility rules)
                        const currentUserId = user?._id;
                        const isViewerTeacherOrAdmin = (user?.role === 'teacher' || user?.role === 'admin');
                        const isViewerGroupMember = Boolean(
                          group?.members?.some(m => {
                            const mid = m._id?._id || m._id;
                            return String(mid) === String(currentUserId) && m.status === 'approved';
                          })
                        );
                        const canSeeSiphon = isViewerTeacherOrAdmin || isViewerGroupMember;
                        const isPending = m.status === 'pending';
 
                        return (
                          <li key={String(userId)} className="flex justify-between items-center w-full">
                            {/* NEW: avatar + name + equipped badge + status badges */}
                            <span className="flex items-center gap-2">
                              <Avatar user={memberUser} size={24} />
                              <span>{displayName}</span>
                              {/* Show equipped badge */}
                              {equippedBadge && (
                                <EquippedBadge badge={equippedBadge} size={18} />
                              )}
                              {isBannedMember && <span className="badge badge-error">BANNED</span>}
                              {isSiphoned && canSeeSiphon && <span className="badge badge-warning">SIPHONED</span>}
                              {isPending && <span className="badge badge-info">PENDING</span>}
                            </span>

                            <button
                              className="btn btn-sm btn-outline ml-4"
                              onClick={() =>
                                navigate(`/classroom/${classroomId}/profile/${userId}`, {
                                  state: { from: 'people', classroomId }
                                })
                              }
                            >
                              View Profile
                            </button>
                          </li>
                        );
                      })}
                </ul>
              )}</div>
             ))}
          </div>
        </div>
      ))
     )}

     {/* Add this stats display section */}
     {(user?.role === 'teacher' || isClassroomAdmin) && (
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-4">Group Assignment Stats</h2>
        <div className="stats stats-vertical md:stats-horizontal shadow mb-4">
          <div className="stat">
            <div className="stat-title">Total Students</div>
            <div className="stat-value text-lg">{stats.totalStudents}</div>
          </div>
          <div className="stat">
            <div className="stat-title">Assigned</div>
            <div className="stat-value text-lg text-success">{stats.assignedStudents}</div>
          </div>
          <div className="stat">
            <div className="stat-title">Assignment Rate</div>
            <div className="stat-value text-lg">{stats.assignmentRate}%</div>
          </div>
        </div>
      </div>
    )}
          </div>
        )}
                  {/* NEW: Recent stat changes - teacher/classroom TA see all, student (including global admin not TA) sees own */}
          {tab === 'stat-changes' && (isTeacher || isClassroomAdmin || isMemberStudent) && (
            <div className="bg-base-100 border border-base-300 rounded p-4 mt-4">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="font-medium flex-1">
                  {studentViewOnly ? 'My recent stat changes' : 'Recent stat changes'}
                </h3>

                {/* UPDATED: show total + load older */}
                <div className="text-sm text-base-content/70">
                  Showing {statChanges.length} of {statChangesTotal || statChanges.length}
                </div>

                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => fetchStatChanges({ page: 1, append: false })}
                  disabled={loadingStatChanges}
                >
                  Refresh
                </button>

                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => fetchStatChanges({ page: statChangesPage + 1, append: true })}
                  disabled={loadingStatChanges || (statChangesTotal ? statChanges.length >= statChangesTotal : statChanges.length < STAT_CHANGES_PER_PAGE)}
                  title="Load older records"
                >
                  Load older
                </button>
              </div>

              {/* Controls: deep search + sort */}
               <div className="flex flex-col sm:flex-row gap-2 mb-4">
                 <input
                   type="search"
                   placeholder={studentViewOnly ? 'Search your stat changes...' : 'Search by user, actor, field, or value...'}
                  className="input input-bordered flex-1 min-w-[220px]"
                   value={statSearch}
                   onChange={(e) => setStatSearch(e.target.value)}
                 />
                 <select
                   className="select select-bordered max-w-xs"
                   value={statSort}
                   onChange={(e) => setStatSort(e.target.value)}
                 >
                   <option value="desc">Date: Newest first</option>
                   <option value="asc">Date: Oldest first</option>
                 </select>
                 <button
                   className="btn btn-sm btn-ghost"
                   onClick={() => { setStatSearch(''); setStatSort('desc'); }}
                 >
                   Clear
                 </button>
               </div>
 
               {/* List */}
               {loadingStatChanges ? (
                <div className="text-sm text-base-content/60">Loading…</div>
               ) : statChanges.length === 0 ? (
                <div className="text-sm text-base-content/60">
                  {user?.role?.toLowerCase() === 'student' ? 'No stat changes found for you' : 'No recent stat changes'}
                </div>
               ) : (
                 (() => {
                   const q = (statSearch || '').toLowerCase().trim();
                   let filtered = statChanges.filter(s => {
                    // Student-view (including global admin not TA): only show own entries
                    if (studentViewOnly) {
                      if (String(s.user) !== String(user._id) && String(s.targetUser) !== String(user._id)) return false;
                    }

                     if (!q) return true;

                     // target user
                     const target = s.targetUser || {};
                     const targetName = `${target.firstName || ''} ${target.lastName || ''}`.trim().toLowerCase();
                     const targetEmail = (target.email || '').toLowerCase();
                     if (targetName.includes(q) || targetEmail.includes(q)) return true;

                     // actionBy
                     const actor = s.actionBy || {};
                     const actorName = `${actor.firstName || ''} ${actor.lastName || ''}`.trim().toLowerCase();
                     const actorEmail = (actor.email || '').toLowerCase();
                     if (actorName.includes(q) || actorEmail.includes(q)) return true;

                     // NEW: search the label shown in UI (“via …”) and the effects text
                     const label = (getStatChangeSource(s.message) || '').toLowerCase();
                     if (label && label.includes(q)) return true;

                     const effects = (getEffectsText(s.message) || '').toLowerCase();
                     if (effects && effects.includes(q)) return true;

                     // changes content
                     if (Array.isArray(s.changes)) {
                       for (const c of s.changes) {
                         const field = String(c.field || '').toLowerCase();
                         const from = String(c.from || '').toLowerCase();
                         const to = String(c.to || '').toLowerCase();
                         if (field.includes(q) || from.includes(q) || to.includes(q)) return true;
                       }
                     }

                     // fallback: createdAt
                     if ((s.createdAt || '').toLowerCase().includes(q)) return true;
                     return false;
                   });

                   filtered.sort((a, b) => {
                     const ad = new Date(a.createdAt || 0).getTime();
                     const bd = new Date(b.createdAt || 0).getTime();
                     return statSort === 'desc' ? bd - ad : ad - bd;
                   });

                   return (
                     <ul className="space-y-2 text-sm">
                       {filtered.map((s) => (
                         <li key={s._id} className="p-2 border border-base-300 rounded bg-base-100">
                           <div className="text-xs text-base-content/60 mb-1">
                             {new Date(s.createdAt).toLocaleString()}
                             {(() => {
                               // Prefer the populated actor when present (manual adjustments, teacher/admin-triggered logs, etc.)
                               if (s.actionBy) {
                                 const actor =
                                   `${s.actionBy.firstName || ''} ${s.actionBy.lastName || ''}`.trim() ||
                                   'Unknown';
                                 return ` — by ${actor}`;
                               }
                               const src = getStatChangeSource(s.message);
                               return src ? ` — via ${src}` : ' — from System';
                             })()}
                           </div>
                           {/* For student view, do not show target user */}
                          {!studentViewOnly && (
                             <div className="font-semibold text-lg mt-1">
                               {s.targetUser ? (
                                 `${s.targetUser.firstName || ''} ${s.targetUser.lastName || ''}`.trim()
                               ) : 'Unknown user'}
                             </div>
                           )}
                           <div className="mt-1">
                              {Array.isArray(s.changes) && s.changes.length ? (
                                <ul className="list-disc ml-4">
                                  {s.changes.map((c, idx) => (
                                    <li key={idx} className="flex items-start gap-2">
                                      <span className="bullet">•</span>
                                      <span className="break-words">{formatStatChange(c)}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="text-xs text-base-content/60">No details available</div>
                              )}
                            </div>
                            <div className="mt-1">
                              {(() => {
                                const suffix = getMessageSuffix(s.message);
                                if (!suffix?.text) return null;
                                return (
                                  <div className="flex items-start gap-2 mt-1">
                                    <div className="text-xs text-base-content/60 flex-1">
                                      {suffix.label}: <span className="italic">{suffix.text}</span>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </li>
                        ))}
                     </ul>
                   );
                 })()
               )}
             </div>
           )}
           {tab === 'bulk-stats' && (user?.role?.toLowerCase() === 'teacher' || (isClassroomAdmin && taStatsPolicy === 'full')) && (
  <div className="bg-base-100 border border-base-300 rounded p-4 mt-4">
    <h3 className="font-medium mb-4">Bulk Stats Adjustment</h3>
    <p className="text-sm text-base-content/70 mb-4">
      Select multiple students and adjust their stats (multiplier, luck, discount, shield, XP) in bulk.
      Changes are applied as deltas (added to current values).
    </p>
    <BulkStatsEditor
      onSuccess={async () => {
        await fetchStudents();
        await fetchClassroom();
      }}
    />
  </div>
)}
      </main>

      {/* Stats adjust modal (teacher only) */}
      <StatsAdjustModal
        isOpen={statsModalOpen}
        onClose={() => setStatsModalOpen(false)}
        student={statsModalStudent}
        classroomId={classroomId}
        onUpdated={async () => { await fetchStudents(); await fetchClassroom(); }}
      />
      
       <Footer />
     </div>
   );
 };
 
 export default People;
