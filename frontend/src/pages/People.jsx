import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import PendingApprovals from '../components/PendingApprovals';
import socket, { joinClassroom, joinUserRoom } from '../utils/socket';
import Footer from '../components/Footer';
import ExportButtons from '../components/ExportButtons';
import formatExportFilename from '../utils/formatExportFilename';

const ROLE_LABELS = {
  student: 'Student',
  admin: 'Admin/TA',
  teacher: 'Teacher',
};

const People = () => {
  // Get classroom ID from URL params
  const { id: classroomId } = useParams();
  const { user } = useAuth();
  const [studentSendEnabled, setStudentSendEnabled] = useState(null);
  const [tab, setTab] = useState('everyone');
  const [taBitPolicy, setTaBitPolicy] = useState('full');
  const [studentsCanViewStats, setStudentsCanViewStats] = useState(true); // Add this
  const [students, setStudents] = useState([]);
  const [groupSets, setGroupSets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('default');
  const [classroom, setClassroom] = useState(null); // Add classroom state

  const navigate = useNavigate();

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

  // Initial data fetch + robust realtime handlers
  useEffect(() => {
    fetchClassroom();
    fetchStudents();
    fetchGroupSets();
    fetchTaBitPolicy();

    // Add classroom removal handler
    const handleClassroomRemoval = (data) => {
      if (String(data.classroomId) === String(classroomId)) {
        toast.error(data.message || 'You have been removed from this classroom');
        // Redirect to classroom dashboard after a short delay
        setTimeout(() => {
          navigate('/classrooms');
        }, 2000);
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

  // Filter and sort students based on searchQuery and sortOption
  const filteredStudents = [...students]
    .filter((student) => {
      const name = (student.firstName || student.name || '').toLowerCase();
      const email = (student.email || '').toLowerCase();
      return (
        name.includes(searchQuery.toLowerCase()) ||
        email.includes(searchQuery.toLowerCase())
      );
    })
    .sort((a, b) => {
      // Only allow balance sorting for teachers/admins
      if (sortOption === 'balanceDesc' && (user?.role === 'teacher' || user?.role === 'admin')) {
        return (b.balance || 0) - (a.balance || 0);
      } else if (sortOption === 'nameAsc') {
        const nameA = (a.firstName || a.name || '').toLowerCase();
        const nameB = (b.firstName || b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      }
      return 0; // Default order
    });

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

    // Build comprehensive data including stats and groups
    const dataToExport = await Promise.all(
      filteredStudents.map(async (student) => {
        let stats = {};
        let groups = [];
        
        try {
          // Fetch student stats
          const statsRes = await axios.get(`/api/stats/student/${student._id}?classroomId=${classroomId}`, { withCredentials: true });
          stats = statsRes.data;
        } catch (err) {
          console.error('Failed to fetch stats for student:', student._id);
        }

        try {
          // Find groups this student belongs to
          groupSets.forEach(groupSet => {
            groupSet.groups.forEach(group => {
              const isMember = group.members.some(member => 
                String(member._id._id || member._id) === String(student._id)
              );
              if (isMember) {
                groups.push(`${groupSet.name}: ${group.name}`);
              }
            });
          });
        } catch (err) {
          console.error('Failed to process groups for student:', student._id);
        }

        return {
          Name: `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.email,
          Email: student.email,
          Role: ROLE_LABELS[student.role] || student.role,
          Balance: student.balance?.toFixed(2) || '0.00',
          Luck: stats.luck || 1,
          Multiplier: stats.multiplier || 1,
          GroupMultiplier: stats.groupMultiplier || 1,
          ShieldActive: stats.shieldActive ? 'Yes' : 'No',
          ShieldCount: stats.shieldCount || 0,
          AttackPower: stats.attackPower || 0,
          DoubleEarnings: stats.doubleEarnings ? 'Yes' : 'No',
          DiscountShop: stats.discountShop || 0,
          PassiveItemsCount: stats.passiveItemsCount || 0,
          Groups: groups.join('; ') || 'None'
        };
      })
    );

    // Create CSV
    const headers = Object.keys(dataToExport[0]);
    const csvContent = [
      headers.join(','),
      ...dataToExport.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escape CSV values that contain commas, quotes, or newlines
          if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const classroomName = classroom?.name || 'Unknown';
    const classroomCode = classroom?.code || classroomId;
    const base = formatExportFilename(`${classroomName}_${classroomCode}_people`, 'export');
    a.download = `${base}.csv`;
    
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

    // Build comprehensive data including stats and groups
    const dataToExport = await Promise.all(
      filteredStudents.map(async (student) => {
        let stats = {};
        let groups = [];
        
        try {
          // Fetch student stats
          const statsRes = await axios.get(`/api/stats/student/${student._id}?classroomId=${classroomId}`, { withCredentials: true });
          stats = statsRes.data;
        } catch (err) {
          console.error('Failed to fetch stats for student:', student._id);
        }

        try {
          // Find groups this student belongs to
          groupSets.forEach(groupSet => {
            groupSet.groups.forEach(group => {
              const isMember = group.members.some(member => 
                String(member._id._id || member._id) === String(student._id)
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

        return {
          _id: student._id,
          name: `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.email,
          firstName: student.firstName,
          lastName: student.lastName,
          email: student.email,
          role: student.role,
          balance: student.balance || 0,
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
          groups: groups,
          classroom: {
            _id: classroomId,
            name: classroom?.name,
            code: classroom?.code
          },
          exportedAt: new Date().toISOString(),
          exportedFrom: 'people_page'
        };
      })
    );

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const classroomName = classroom?.name || 'Unknown';
    const classroomCode = classroom?.code || classroomId;
    const base = formatExportFilename(`${classroomName}_${classroomCode}_people`, 'export');
    a.download = `${base}.json`;
    
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

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow p-6 w-full max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">
            {classroom
              ? `${classroom.name}${classroom.code ? ` (${classroom.code})` : ''} People`
              : 'People'}
          </h1>
        </div>

        <div className="flex space-x-4 mb-6">
          <button
            className={`btn ${tab === 'everyone' ? 'btn-success' : 'btn-outline'}`}
            onClick={() => setTab('everyone')}
          >
            Everyone
          </button>
          <button
            className={`btn ${tab === 'groups' ? 'btn-success' : 'btn-outline'}`}
            onClick={() => setTab('groups')}
          >
            Groups
          </button>
          {user?.role?.toLowerCase() === 'teacher' && (                    
           <button
             className={`btn ${tab === 'settings' ? 'btn-success' : 'btn-outline'}`}
             onClick={() => setTab('settings')}
           >
             Settings
           </button>
         )}
        </div>
{/* ─────────────── Settings TAB ─────────────── */}
        {tab === 'settings' && (user?.role || '').toLowerCase() === 'teacher' && (
          <div className="w-full space-y-6 min-w-0">
             <h2 className="text-2xl font-semibold">Classroom Settings</h2>

            <label className="form-control w-full">
              <span className="label-text mb-2 font-medium">
                Admin/TA bit assignment
              </span>

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
                    toast.success('Updated Admin/TA bit policy');
                    setTaBitPolicy(newPolicy);
                  } catch (err) {
                    toast.error(
                      err.response?.data?.error || 'Failed to update policy'
                    );
                  }
                }}
              >
                <option value="full">① Full power (Admins/TAs can assign bits)</option>
                <option value="approval">② Needs teacher approval</option>
                <option value="none">③ Cannot assign bits</option>
              </select>
            </label>

             {/* render only after we know the value */}
            {studentSendEnabled !== null && (
              <label className="form-control w-full">
                <span className="label-text mb-2 font-medium">
                  Student-to-student wallet transfers
                </span>
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
                      toast.success(
                        `Student transfers ${isEnabled ? 'enabled' : 'disabled'}`
                      );
                      setStudentSendEnabled(isEnabled);
                    } catch (err) {
                      toast.error('Failed to update setting');
                    }
                  }}
                />
              </label>
            )}

            {/* Add the new setting for students viewing stats */}
            <label className="form-control w-full">
              <span className="label-text mb-2 font-medium">
                Allow students to view other students' stats
              </span>
              <input
                type="checkbox"
                className="toggle toggle-success"
                checked={studentsCanViewStats}
                onChange={async (e) => {
                  const isEnabled = e.target.checked;
                  
                  // Optimistically update the UI immediately
                  setStudentsCanViewStats(isEnabled);
                  
                  try {
                    // Send the update to the server
                    await axios.patch(
                      `/api/classroom/${classroomId}/students-can-view-stats`,
                      { studentsCanViewStats: isEnabled },
                      { withCredentials: true }
                    );
                    toast.success(
                      `Students can ${isEnabled ? 'now' : 'no longer'} view other students' stats`
                    );
                    
                    // The socket event will update other users, but this user sees immediate feedback
                    
                  } catch (err) {
                    // If the request fails, revert the optimistic update
                    setStudentsCanViewStats(!isEnabled);
                    toast.error('Failed to update setting');
                  }
                }}
              />
            </label>

            {/* Show teacher's approval queue when policy=approval */}
    {taBitPolicy === 'approval' && (
      <PendingApprovals classroomId={classroomId} />
    )}
          </div>
        )}
        {/* ───────────────────────────────────────────── */}
        {tab === 'everyone' && (
          <div>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
              <input
                type="text"
                placeholder="Search by name or email..."
                className="input input-bordered w-full md:w-1/2"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              <div className="flex flex-wrap gap-2 items-center">
               {user?.role?.toLowerCase() === 'teacher' && (
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    className="file-input file-input-sm"
                    onChange={handleExcelUpload}
                  />
                )}

                {/* Only show export for teachers/admins */}
                {(user?.role === 'teacher' || user?.role === 'admin') && (
                  <ExportButtons
                    onExportCSV={exportPeopleToCSV}
                    onExportJSON={exportPeopleToJSON}
                    userName={classroom?.name || 'classroom'}
                    exportLabel="people"
                    className="mr-2"
                  />
                )}

                <select
                  className="select select-bordered"
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value)}
                >
                  <option value="default">Sort By</option>
                  {/* Only show balance sorting for teachers/admins */}
                  {(user?.role === 'teacher' || user?.role === 'admin') && (
                    <option value="balanceDesc">Balance (High → Low)</option>
                  )}
                  <option value="nameAsc">Name (A → Z)</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              {filteredStudents.length === 0 ? (
                <p>No matching students found.</p>
              ) : (
                filteredStudents.map((student) => (
                  <div
                    key={student._id}
                    className="border p-3 rounded shadow flex justify-between items-center"
                  >
                    <div>
                      <div className="font-medium text-lg">
                        {student.firstName || student.lastName
                          ? `${student.firstName || ''} ${student.lastName || ''}`.trim()
                          : student.name || student.email}
                        <span className="ml-2 text-gray-600 text-sm">
                          – Role: {ROLE_LABELS[student.role] || student.role}
                        </span>
                      </div>

                      {/* Only show balance to teachers/admins */}
                      {(user?.role?.toLowerCase() === 'teacher' || user?.role?.toLowerCase() === 'admin') && (
                        <div className="text-sm text-gray-500 mt-1">
                          Balance: B{student.balance?.toFixed(2) || '0.00'}
                        </div>
                      )}

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
                        {(user?.role === 'teacher' || user?.role === 'admin' || String(student._id) === String(user?._id) || (user?.role === 'student' && studentsCanViewStats)) && (
                          <button
                            className="btn btn-xs sm:btn-sm btn-success"
                            onClick={() => navigate(`/classroom/${classroomId}/student/${student._id}/stats`, {
                              state: { from: 'people' }
                            })}
                          >
                            View Stats
                          </button>
                        )}

                        {/* Add Remove Student button for teachers */}
                        {user?.role?.toLowerCase() === 'teacher' && student.role !== 'teacher' && String(student._id) !== String(user._id) && (
                          <button
                            className="btn btn-xs sm:btn-sm btn-error"
                            onClick={() => handleRemoveStudent(student._id, student.firstName || student.lastName ? `${student.firstName || ''} ${student.lastName || ''}`.trim() : student.email)}
                          >
                            Remove
                          </button>
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
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === 'groups' && (
          <div className="space-y-6 w-full min-w-0">
            {groupSets.length === 0 ? (
              <p>No groups available yet.</p>
            ) : (
              groupSets.map((gs) => (
                <div key={gs._id} className="w-full min-w-0">
                  <h2 className="text-xl font-semibold">{gs.name}</h2>
                  <div className="mt-2 grid grid-cols-1 gap-4 w-full">
                    {gs.groups.map((group) => (
                      <div key={group._id} className="border p-4 rounded w-full min-w-0 bg-base-100">
                         <h3 className="text-lg font-bold">{group.name}</h3>
                         {group.members.length === 0 ? (
                           <p className="text-gray-500">No members</p>
                        ) : (
                          <ul className="list-disc ml-5 space-y-1">
                            {group.members
                              .filter(m => m && m._id) // skip deleted / null members
                              .map((m) => {
                                const user = m._id;
                                const userId = user._id || user; // handle populated object or raw id
                                const displayName = user && (user.firstName || user.lastName)
                                  ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                                  : user?.name || user?.email || 'Unknown User';

                                return (
                                  <li key={String(userId)} className="flex justify-between items-center w-full">
                                    <span>{displayName}</span>
                                    <button
                                      className="btn btn-sm btn-outline ml-4"
                                      onClick={() => navigate(`/classroom/${classroomId}/profile/${userId}`)}
                                    >
                                      View Profile
                                    </button>
                                  </li>
                                );
                              })}
                        </ul>
                      )}
                      </div>
                     ))}
                  </div>
                </div>
              ))
             )}
          </div>
        )}
      </main>
       <Footer />
     </div>
   );
 };
 
 export default People;
