import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; 
import BulkBalanceEditor from '../components/BulkBalanceEditor';
import TransactionList, { inferType, TYPES } from '../components/TransactionList';
import toast from 'react-hot-toast';
import Footer from '../components/Footer';
import socket from '../utils/socket';
import ExportButtons from '../components/ExportButtons';
import { Info } from 'lucide-react';

const Wallet = () => {
  const { user } = useAuth();
  // Only show the "All users" / assigner filter to teachers/admins
  const canSeeUserFilter = Boolean(user && ['teacher', 'admin'].includes((user.role || '').toString().toLowerCase()));

  const { id: classroomId } = useParams();

  // Default tab logic for students
  const isStudent = user && user.role === 'student';
  const [studentTab, setStudentTab] = useState('transfer'); // 'transfer' or 'transactions'

  // Default tab: teachers/admins should land on Transactions so they see classroom txs immediately
  const defaultTab = (user && ['teacher','admin'].includes(user.role)) ? 'transactions' : 'edit';
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [transactions, setTransactions] = useState([]);
  const [classroom, setClassroom] = useState(null);
  const [balance, setBalance] = useState(0);
  const [recipientId, setRecipientId] = useState('');
  const [selectedRecipientId, setSelectedRecipientId] = useState(''); 
  const [transferAmount, setTransferAmount] = useState('');
  const [transferMessage, setTransferMessage] = useState(''); // Add transfer message state
  const [search, setSearch] = useState(''); // Add search state
  const [allTx, setAllTx] = useState([]);
  const [studentFilter, setStudentFilter] = useState('');  
  const [studentList, setStudentList] = useState([]);
  const [roleFilter, setRoleFilter] = useState('all');
  const [directionFilter, setDirectionFilter] = useState('all');
  const [assignerFilter, setAssignerFilter] = useState('');

  // Sorting for transactions (date by default)
  const [sortField, setSortField] = useState('date'); // 'date' | 'amount'
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' | 'desc'
  
  // Map role values to readable labels
  const ROLE_LABELS = {
    student: 'Student',
    teacher: 'Teacher',
    admin: 'Admin/TA'
  };

  // Export functions with classroom code in filename
  const exportTransactionsToCSV = async () => {
    if (!filteredTx.length) {
      throw new Error('No transactions to export');
    }
    
    // Include User ID and Classroom Name/Code next to their IDs
    const csvHeaders = ['User','User ID','Transaction ID','Classroom ID','Classroom Name','Classroom Code','Date','Amount','Description','Type','Role'];
    const csvRows = filteredTx.map(tx => {
      const isSiphon =
        tx.description?.toLowerCase().includes('siphon') ||
        tx.type === 'siphon' ||
        (tx.description?.includes('transferred from') && tx.description?.includes('group'));

      const ownerName =
        tx.studentName ||
        (tx.studentEmail ? tx.studentEmail : null) ||
        ((user?.firstName || user?.lastName)
          ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
          : (user?.email || 'Unknown'));

      // NEW: ownerId for CSV
      const ownerId = tx.studentId || user?._id || '';

      let assignerRole = 'unknown';
      if (isSiphon) assignerRole = 'siphon';
      else if (tx.assignedBy?.role) assignerRole = tx.assignedBy.role;

      // IDs and classroom label data
      const txnId = tx._id || '';
      const classroomObj = (tx.classroom && typeof tx.classroom === 'object') ? tx.classroom : null;
      const classroomIdVal = classroomObj ? (classroomObj._id || classroomObj.id || '') : (tx.classroom || '');
      const classroomNameVal = classroomObj?.name || classroom?.name || '';
      const classroomCodeVal = classroomObj?.code || classroom?.code || '';

      return [
        ownerName,
        ownerId,
        txnId,
        classroomIdVal,
        classroomNameVal,
        classroomCodeVal,
        new Date(tx.createdAt || tx.date).toLocaleString(),
        tx.amount,
        tx.description || '',
        isSiphon ? 'siphon' : (tx.type || 'adjustment'),
        assignerRole
      ].map(field => `"${String(field ?? '').replace(/"/g, '""')}"`).join(',');
    });

    const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    const classroomName = classroom?.name || 'wallet';
    const classroomCode = classroom?.code || '';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = classroomCode 
      ? `${classroomName}_${classroomCode}_transactions_${timestamp}.csv`
      : `${classroomName}_transactions_${timestamp}.csv`;

    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return filename;
  };

  const exportTransactionsToJSON = async () => {
    if (!filteredTx.length) {
      throw new Error('No transactions to export');
    }

    const data = filteredTx.map(tx => {
      const isSiphon =
        tx.description?.toLowerCase().includes('siphon') ||
        tx.type === 'siphon' ||
        (tx.description?.includes('transferred from') && tx.description?.includes('group'));

      const ownerName =
        tx.studentName ||
        (tx.studentEmail ? tx.studentEmail : null) ||
        ((user?.firstName || user?.lastName)
          ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
          : (user?.email || 'Unknown'));
      const ownerEmail = tx.studentEmail || user?.email || null;
      const ownerId = tx.studentId || user?._id || null;

      let assignerInfo = null;
      if (!isSiphon && tx.assignedBy) {
        assignerInfo = {
          _id: tx.assignedBy._id,
          name: `${tx.assignedBy.firstName || ''} ${tx.assignedBy.lastName || ''}`.trim() || tx.assignedBy.email,
          email: tx.assignedBy.email,
          role: tx.assignedBy.role
        };
      } else if (isSiphon) {
        assignerInfo = { _id: null, name: 'Siphon System', email: null, role: 'siphon' };
      }

      const classroomObj = (tx.classroom && typeof tx.classroom === 'object') ? tx.classroom : null;
      const classroomIdVal = classroomObj ? (classroomObj._id || classroomObj.id || null) : (tx.classroom ?? null);
      const classroomNameVal = classroomObj?.name || classroom?.name || null;
      const classroomCodeVal = classroomObj?.code || classroom?.code || null;

      return {
        _id: tx._id, // Transaction ID
        userId: ownerId, // NEW: flat userId next to user object
        user: {
          _id: ownerId,
          name: ownerName,
          email: ownerEmail
        },
        date: tx.createdAt || tx.date || null,
        amount: tx.amount,
        description: tx.description,
        assignedBy: assignerInfo,
        classroom: classroomIdVal,          // Classroom ID
        classroomName: classroomNameVal,    // NEW
        classroomCode: classroomCodeVal,    // NEW
        type: isSiphon ? 'siphon' : (tx.type || 'adjustment')
      };
    });

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    const classroomName = classroom?.name || 'wallet';
    const classroomCode = classroom?.code || '';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = classroomCode 
      ? `${classroomName}_${classroomCode}_transactions_${timestamp}.json`
      : `${classroomName}_transactions_${timestamp}.json`;

    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return filename;
  };

  // Filter + sort transactions based on selected role, direction, search and sort settings
  const filteredTx = useMemo(() => {
    const sourceTx = user.role === 'student' ? transactions : allTx;

    // Filtering (deep search)
    const qRaw = (search || '').trim();
    const q = qRaw.toLowerCase();
    const isNumericQuery = q !== '' && !Number.isNaN(Number(q));

    const matchesDeep = (tx) => {
      if (!q) return true;

      // Collect candidate strings from many places in the tx object
      const parts = [];
      parts.push(tx.description || '');
      parts.push(tx._id || '');
      parts.push(tx.orderId || '');
      parts.push(String(tx.amount || ''));
      parts.push(tx.type || '');
      parts.push(tx.studentName || '');
      parts.push(tx.studentEmail || '');
      // assignedBy fields (may be populated object or id)
      if (tx.assignedBy) {
        parts.push(tx.assignedBy.firstName || '');
        parts.push(tx.assignedBy.lastName || '');
        parts.push(tx.assignedBy.email || '');
        parts.push(tx.assignedBy.role || '');
      }
      // items (checkout) - search names, descriptions, price
      if (Array.isArray(tx.items)) {
        tx.items.forEach(it => {
          parts.push(it.name || '');
          parts.push(it.description || '');
          parts.push(String(it.price || ''));
        });
      }
      // calculation / metadata fields
      if (tx.calculation) {
        parts.push(String(tx.calculation.baseAmount || ''));
        parts.push(String(tx.calculation.total || ''));
        parts.push(JSON.stringify(tx.calculation || {}));
      }
      if (tx.metadata) parts.push(JSON.stringify(tx.metadata));

      // Date strings
      const created = new Date(tx.createdAt || tx.date || Date.now());
      if (!Number.isNaN(created.getTime())) {
        parts.push(created.toISOString());
        parts.push(created.toLocaleString());
        parts.push(created.toDateString());
      }

      const hay = parts.join(' ').toLowerCase();

      // If the user typed a number, match amounts/price tokens as substring
      if (isNumericQuery) {
        return hay.includes(q);
      }

      // Support multi-word queries: require all tokens (AND)
      const tokens = q.split(/\s+/).filter(Boolean);
      return tokens.every(t => hay.includes(t));
    };

    // Apply existing role/direction/assigner filters, but use matchesDeep for search
    let list = sourceTx.filter((tx) => {
      const isSiphon =
        tx.description?.toLowerCase().includes('siphon') ||
        tx.type === 'siphon' ||
        (tx.description?.includes('transferred from') && tx.description?.includes('group'));

      const rawAssigner = tx.assignedBy;
      const assignerId = rawAssigner ? (rawAssigner._id || rawAssigner).toString() : '';
      
      // Infer assigner role for unpopulated transactions (students' own view)
      let assignerRole = isSiphon ? 'siphon' : 'system';
      if (rawAssigner) {
        // If backend populated assignedBy with role, prefer that
        if (typeof rawAssigner === 'object' && rawAssigner.role) {
          assignerRole = rawAssigner.role;
        } else {
          // rawAssigner is likely an id string -> try to resolve from classroom/studentList
          if (classroom?.teacher && assignerId === String(classroom.teacher?._id || classroom.teacher)) {
            assignerRole = 'teacher';
          } else {
            const found = (studentList || []).find(u => String(u._id) === assignerId);
            if (found) assignerRole = found.role || 'student';
            else assignerRole = 'unknown';
          }
        }
      }

      const roleMatch =
        roleFilter === 'all' ||
        (assignerRole === roleFilter) ||
        (roleFilter === 'siphon' && isSiphon) ||
        (roleFilter === 'purchase' && tx.type === 'purchase');

      const directionMatch =
        directionFilter === 'all'
          ? true
          : directionFilter === 'credit'
          ? Number(tx.amount) > 0
          : Number(tx.amount) < 0;

      const assignerMatch = !assignerFilter || assignerFilter === assignerId;

      const searchMatch = matchesDeep(tx);

      return roleMatch && directionMatch && assignerMatch && searchMatch;
    });
 
     // Sort
     const sorted = list.slice().sort((a, b) => {
       let aVal, bVal;
       if (sortField === 'amount') {
         aVal = Number(a.amount || 0);
         bVal = Number(b.amount || 0);
       } else {
         // default to date
         aVal = new Date(a.createdAt || a.date || 0).getTime();
         bVal = new Date(b.createdAt || b.date || 0).getTime();
       }
       if (aVal === bVal) return 0;
       const asc = sortDirection === 'asc';
       return asc ? (aVal < bVal ? -1 : 1) : (aVal < bVal ? 1 : -1);
     });
 
     return sorted;
   }, [
     allTx,
     transactions,
     roleFilter,
     directionFilter,
     assignerFilter,
     search,
     user.role,
     classroom,
     studentList,
     sortField,
     sortDirection
   ]);

  // Number of transactions currently visible after filters/sort
  const transactionCount = filteredTx.length;
  
  // Fetch students in classroom to populate dropdown/filter UI
  const fetchUsers = async () => {
    if (!classroomId) return;
    try {
      const res = await axios.get(
        `/api/classroom/${classroomId}/students`,
        { withCredentials: true }
      );
      setStudentList(res.data);
    } catch (err) {
      console.error('Failed to load students:', err);
      setStudentList([]);
    }
  };
  // On user or initial load, fetch wallet info and students
    useEffect(() => {
   if (!user) return;
    // always fetch classroom info & own wallet
    fetchClassroom();
    fetchWallet();
    fetchUsers();
    fetchBalance(); // Add this to fetch per-classroom balance

    const role = (user.role || '').toString().toLowerCase();
    if ((role === 'teacher' || role === 'admin') && classroomId) {
      // explicit call so teachers see classroom transactions reliably
      fetchAllTx();
    }
  }, [user, classroomId]);

  // Fetch transactions whenever teacher/admin switches to Transactions tab (or on initial load)
  useEffect(() => {
    if (!user) return;
    const role = (user.role || '').toString().toLowerCase();
    if ((role === 'teacher' || role === 'admin') && activeTab === 'transactions' && classroomId) {
      fetchAllTx(studentFilter);
    }
  }, [activeTab, user, classroomId, studentFilter]);

  // ensure fetchAllTx includes classroomId
  const fetchAllTx = async (studentId = '') => {
    try {
      const params = new URLSearchParams();
      if (classroomId) params.append('classroomId', classroomId);
      if (studentId) params.append('studentId', studentId);
      const url = params.toString() ? `/api/wallet/transactions/all?${params.toString()}` : '/api/wallet/transactions/all';
      const res = await axios.get(url, { withCredentials: true });
      console.debug('fetchAllTx url:', url, 'status:', res.status, 'count:', Array.isArray(res.data) ? res.data.length : 0);
      setAllTx(res.data);
    } catch (err) {
      console.error('fetchAllTx error:', err.response?.status, err.response?.data || err.message);
      setAllTx([]);
    }
  };

  // Compute all distinct transaction types present in allTx, memoized
  const txTypeOptions = useMemo(() => {
    const set = new Set(allTx.map(inferType).filter(Boolean));
    return ['all', ...Array.from(set)];    
  }, [allTx]);

  // Fetch the wallet data for current user (student) or transactions for teacher/admin
const fetchWallet = async () => {
  try {
    const url = classroomId ? `/api/wallet/transactions?classroomId=${classroomId}` : '/api/wallet/transactions';
    const { data } = await axios.get(url, { withCredentials: true });

    // DEBUG: print transactions returned by backend to browser console for inspection
    console.log('wallet transactions response:', data);

    const sorted = data
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

   // Deduplicate transactions by a stable key:
   // prefer the transaction _id (if present), otherwise fallback to orderId,
   // otherwise use description+amount+timestamp (stable enough for de-dupping).
   const unique = (() => {
     const seen = new Map();
     for (const tx of sorted) {
       const ts = tx._id || tx.orderId || `${tx.description || ''}::${tx.amount}::${new Date(tx.date || tx.createdAt || Date.now()).toISOString()}`;
       if (!seen.has(ts)) seen.set(ts, tx);
     }
     return Array.from(seen.values());
   })();

  setTransactions(unique); 
  if (user.role === 'student') {
    // Use per-classroom balance
    const params = classroomId ? `?classroomId=${classroomId}` : '';
    const userRes = await axios.get(`/api/users/${user._id}${params}`, { withCredentials: true });
    setBalance(userRes.data.balance);
  }
} catch (err) {
  console.error('Failed to fetch wallet', err);
}
};
    // Calculate effective balance considering multiplier passive attribute
    const getEffectiveBalance = (user) => {
      const baseBalance = user.balance || 0;
      const multiplier = user.passiveAttributes?.multiplier || 1;
      return Math.floor(baseBalance * multiplier);
    };

    // Refresh wallet transactions and all transactions (for teachers/admins)
    const refreshTransactions = async () => {
      await fetchWallet();
      if (['teacher', 'admin'].includes(user.role)) {
        await fetchAllTx(studentFilter);
      }
    };

    // Fetch classroom details
  const fetchClassroom = async () => {
    if (!classroomId) return;
    try {
      const response = await axios.get(`/api/classroom/${classroomId}`);
      setClassroom(response.data);
    } catch (err) {
      console.error('Failed to fetch classroom:', err);
    }
  };

  // Fetch balance (updated for per-classroom)
  const fetchBalance = async () => {
    if (!user?._id) return;
    try {
      const params = classroomId ? `?classroomId=${classroomId}` : '';
      const { data } = await axios.get(`/api/wallet/${user._id}/balance${params}`, { withCredentials: true });
      setBalance(data.balance);
    } catch (error) {
      console.error("Failed to fetch balance for wallet", error);
    }
  };

  // ─ Add realtime wallet update listener ─
  useEffect(() => {
    if (!user) return;
    const handler = (payload) => {
      try {
        // payload example: { studentId, newBalance, classroomId }
        // If this update is for the current user (student) and same classroom scope, refresh
        if (payload?.studentId && String(payload.studentId) === String(user._id)) {
          // refresh the wallet view/balance/transactions
          fetchBalance();
          fetchWallet && fetchWallet();
        }

        // If teacher/admin and classroom matches, refresh teacher views (all transactions)
        const role = (user.role || '').toString().toLowerCase();
        if ((role === 'teacher' || role === 'admin') && payload?.classroomId && String(payload.classroomId) === String(classroomId)) {
          fetchAllTx && fetchAllTx();
        }
      } catch (e) {
        console.error('Realtime balance handler error:', e);
      }
    };

    socket.on('balance_update', handler);
    return () => {
      socket.off('balance_update', handler);
    };
  }, [user, classroomId]); // fetchBalance/fetchWallet/fetchAllTx are stable in this module
  // ─ end realtime listener ─

  // Join rooms after socket connects and debug incoming events
useEffect(() => {
  if (!user?._id) return;

  const joinRooms = () => {
    console.debug('[socket] connect -> joining rooms', { userId: user._id, classroomId });
    socket.emit('join-user', user._id);
    if (classroomId) socket.emit('join-classroom', classroomId);
  };

  // If already connected, join immediately; also join on future connects
  if (socket.connected) joinRooms();
  socket.on('connect', joinRooms);

  // Enhanced handler with debug
  const handler = (payload) => {
    console.debug('[socket] balance_update received in Wallet:', payload);
    try {
      if (payload?.studentId && String(payload.studentId) === String(user._id)) {
        fetchBalance();
        fetchWallet && fetchWallet();
      }
      const role = (user.role || '').toString().toLowerCase();
      if ((role === 'teacher' || role === 'admin') && payload?.classroomId && String(payload.classroomId) === String(classroomId)) {
        fetchAllTx && fetchAllTx();
      }
    } catch (e) {
      console.error('Realtime balance handler error:', e);
    }
  };

  socket.on('balance_update', handler);

  return () => {
    socket.off('connect', joinRooms);
    socket.off('balance_update', handler);
  };
}, [user?._id, classroomId]);

// Add notification listener to trigger wallet refreshes
useEffect(() => {
  if (!user?._id) return;

  const notificationHandler = (payload) => {
    console.debug('[socket] Wallet received notification:', payload);
    // backend notification payload shape includes: { type, user, classroom, ... }
    const affectedUserId = payload?.user?._id || payload?.studentId || payload?.student?._id;
    const notifType = payload?.type;

    // Only react to wallet-related notifications
    const walletTypes = new Set(['wallet_topup', 'wallet_transfer', 'wallet_adjustment', 'wallet_payment']);
    if (!walletTypes.has(notifType)) return;

    // If notification targets this user, refresh their wallet
    if (String(affectedUserId) === String(user._id)) {
      fetchBalance();
      fetchWallet && fetchWallet();
    }

    // If teacher/admin viewing a classroom and the notification is classroom-scoped, refresh all tx
    const role = (user.role || '').toString().toLowerCase();
    if ((role === 'teacher' || role === 'admin') && payload?.classroom?._id && String(payload.classroom._id) === String(classroomId)) {
      fetchAllTx && fetchAllTx();
    }
  };

  socket.on('notification', notificationHandler);
  return () => {
    socket.off('notification', notificationHandler);
  };
}, [user?._id, classroomId]);

  // Compute total spent (sum of negative amounts) scoped to current classroom if provided
  const totalSpent = useMemo(() => {
    if (!transactions || transactions.length === 0) return 0;
    const txs = classroomId
      ? transactions.filter(t => String(t.classroom) === String(classroomId))
      : transactions;

    return txs.reduce((sum, t) => {
      const amt = Number(t.amount) || 0;
      if (amt >= 0) return sum;

      // Exclude teacher/admin adjustments from "total spent"
      // `assignedBy` is populated by backend for the student's own transactions route:
      // see router.get('/transactions') in backend/routes/wallet.js
      const assignerRole = (t.assignedBy && t.assignedBy.role) ? String(t.assignedBy.role).toLowerCase() : '';

      // Exclude teacher/admin adjustments
      if (assignerRole === 'teacher' || assignerRole === 'admin') {
        return sum;
      }

      // Exclude attacks and siphons from "spent"
      const tType = String(t?.type || t?.metadata?.type || '').toLowerCase();
      if (tType === 'attack' || tType === 'siphon') {
        return sum;
      }

      // Otherwise count as spent (abs of the negative amount)
      return sum + Math.abs(amt);
    }, 0);
  }, [transactions, classroomId]);

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <div className="w-full max-w-4xl mx-auto flex-grow py-6 px-4 sm:px-6 box-border">
         <div className="flex justify-between items-center mb-4">
           <h1 className="text-2xl font-bold">
             {classroom?.name ? `${classroom.name}${classroom.code ? ` (${classroom.code})` : ''} Wallet` : 'Wallet'}
           </h1>

        {/* ▼ Tab buttons */}
        {(user.role === 'teacher' || user.role === 'admin') && (
          <div role="tablist" className="tabs tabs-boxed">
            <a
              role="tab"
              className={`tab ${activeTab === 'edit' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('edit')}
            >
              Adjust
            </a>
            <a
              role="tab"
              className={`tab ${activeTab === 'transactions' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('transactions')}
            >
              Transactions
            </a>
          </div>
        )}
      </div>

      {/* ▼ Student tab switcher */}
      {isStudent && classroom?.studentSendEnabled && (
        <div role="tablist" className="tabs tabs-boxed mb-6">
          <a
            role="tab"
            className={`tab ${studentTab === 'transfer' ? 'tab-active' : ''}`}
            onClick={() => setStudentTab('transfer')}
          >
            Transfer
          </a>
          <a
            role="tab"
            className={`tab ${studentTab === 'transactions' ? 'tab-active' : ''}`}
            onClick={() => setStudentTab('transactions')}
          >
            Transactions
          </a>
        </div>
      )}

      {/* ▼ Edit/Bulk tab */}
      {activeTab === 'edit' && (user.role === 'teacher' || user.role === 'admin') && (
        <BulkBalanceEditor classroomId={classroomId} />
      )}

      {/* ▼ Transactions tab */}
      {activeTab === 'transactions' && (user.role === 'teacher' || user.role === 'admin') && (
        <div className="space-y-4">
          <h2 className="font-bold">
            All Transactions <span className="text-sm text-gray-500">({transactionCount})</span>
          </h2>

          {/* ▼ Enhanced filter bar with search and export */}
          <div className="flex flex-wrap gap-2 items-center">
            {/* Search bar */}
            <input
              type="search"
              placeholder="Search transactions..."
              className="input input-bordered flex-1 min-w-[200px]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {/* user selector */}
            {canSeeUserFilter && (
              <select
                className="select select-bordered max-w-xs"
                value={assignerFilter}
                onChange={(e) => {
                  const id = e.target.value;
                  setAssignerFilter(id);
                  if (id) {
                    const selectedUser = studentList.find(u => u._id === id);
                    if (selectedUser) {
                      setRoleFilter(selectedUser.role);
                    }
                  } else {
                    setRoleFilter('all');
                  }
                }}
              >
                <option value="">All users</option>
                {studentList.map((u) => {
                  const displayName = (u.firstName || u.lastName)
                    ? `${u.firstName || ''} ${u.lastName || ''}`.trim()
                    : u.name || u.email;
                  return (
                    <option key={u._id} value={u._id}>
                      {displayName} – {ROLE_LABELS[u.role] || u.role}
                    </option>
                  );
                })}
              </select>
            )}

            {/* Role filter with siphon option */}
            <select
              className="select select-bordered max-w-xs"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              disabled={!!assignerFilter}
            >
              <option value="all">All Types</option>
              <option value="purchase">Checkout</option>
              <option value="teacher">Adjustment by Teacher</option>
              <option value="admin">Adjustment by Admin/TA</option>
              <option value="siphon">Siphon Transfers</option>
            </select>

            {/* Direction filter */}
            <select
              className="select select-bordered max-w-xs"
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value)}
            >
              <option value="all">All Directions</option>
              <option value="credit">Credit</option>
              <option value="debit">Debit</option>
            </select>

            {/* Sort controls (Date / Amount) */}
            <select
              className="select select-bordered max-w-xs"
              value={sortField}
              onChange={(e) => setSortField(e.target.value)}
              title="Sort field"
            >
              <option value="date">Sort: Date</option>
              <option value="amount">Sort: Amount</option>
            </select>
            
            <button
              className="btn btn-outline btn-sm"
              title="Toggle sort direction"
              onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
            >
              {sortDirection === 'asc' ? 'Asc' : 'Desc'}
            </button>

             {/* Export buttons */}
             <ExportButtons
               onExportCSV={exportTransactionsToCSV}
               onExportJSON={exportTransactionsToJSON}
               userName={classroom?.name || 'classroom'}
               exportLabel="transactions"
             />
          </div>

          <TransactionList transactions={filteredTx} />
        </div>
      )}
      {user.role === 'student' && (
        <>
          {/* ▼ Student: Wallet Transfer */}
          {isStudent && studentTab === 'transfer' && classroom?.studentSendEnabled && (
            <div className="mb-6 space-y-2">
              <h2 className="font-bold mb-2">Wallet Transfer</h2>

              {/* pick a classmate by name */}
              <select
                className="select select-bordered w-full mb-3"
                value={selectedRecipientId}
                onChange={(e) => {
                  const uid = e.target.value;
                  setSelectedRecipientId(uid);

                  const chosen = studentList.find(s => s._id === uid);
                  if (chosen) setRecipientId(chosen.shortId);
                }}
              >
                <option value="">Select Recipient by Name…</option>
                {studentList
                  .filter(s => s._id !== user._id)
                  .map(s => {
                    const name = (s.firstName || s.lastName)
                      ? `${s.firstName || ''} ${s.lastName || ''}`.trim()
                      : s.email;
                    return (
                      <option key={s._id} value={s._id}>
                        {name} – {s.shortId}
                      </option>
                    );
                  })}
              </select>

              <input
                type="text"
                placeholder="Enter Recipient ID"
                className="input input-bordered w-full tracking-wider [&:not(:placeholder-shown)]:uppercase"
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
              />


              <input
                type="number"
                placeholder="Amount"
                className="input input-bordered w-full"
                value={transferAmount}
                min={1}
                step={1}
                // Prevent typing '-' and scientific notation, strip any minus signs
                onChange={(e) => {
                  const raw = e.target.value;
                  const cleaned = raw.replace(/-/g, '').replace(/[eE+]/g, '');
                  setTransferAmount(cleaned);
                }}
                // Ensure empty or positive integer on blur
                onBlur={() => {
                  if (!transferAmount) return;
                  const n = parseInt(transferAmount, 10);
                  if (isNaN(n) || n < 1) setTransferAmount('');
                  else setTransferAmount(String(n));
                }}
                // Prevent scroll from changing the value when focused
                onWheel={(e) => e.currentTarget.blur()}
                // Prevent non-numeric keys like 'e', '+', '-'
                onKeyDown={(e) => {
                  if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                }}
              />

              {/* Add message input field */}
              <textarea
                placeholder="Optional message (e.g., 'Thanks for helping with homework!')"
                className="textarea textarea-bordered w-full"
                value={transferMessage}
                onChange={(e) => setTransferMessage(e.target.value)}
                rows={2}
                maxLength={200}
              />
              {transferMessage.length > 0 && (
                <div className="text-xs text-gray-500 text-right">
                  {transferMessage.length}/200 characters
                </div>
              )}

              <button
                className="btn btn-success w-full"
                onClick={async () => {
                  const parsedAmount = parseInt(transferAmount, 10);
                  if (!recipientId || !parsedAmount || parsedAmount <= 0) {
                    toast.error('Please enter a valid recipient and a positive amount.');
                    return;
                  }
                  try {
                    // include classroomId so backend notifications reference the classroom
                    await axios.post('/api/wallet/transfer', {
                      recipientShortId: recipientId,
                      amount: parsedAmount,
                      message: transferMessage.trim() || undefined, // Include message if provided
                      classroomId
                    }, { withCredentials: true });
                    toast.success('Transfer successful!');
                    await fetchWallet(); // Refresh balance and transactions

                    // Reset transfer form fields after successful transfer
                    setRecipientId('');
                    setSelectedRecipientId('');
                    setTransferAmount('');
                    setTransferMessage(''); // Reset message field
                  } catch (err) {
                    toast.error(err.response?.data?.error || 'Transfer failed.');
                  }
                }}
              >
                Transfer
              </button>
            </div>
          )}

          {/* ▼ Student: Transaction History */}
          {isStudent && (studentTab === 'transactions' || !classroom?.studentSendEnabled) && (
            <div className="mt-6">
              <div className="mb-4">
                <p className="font-medium">Base Balance: {balance} ₿</p>
                {/* Total spent line with info tooltip */}
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  Total spent: ₿{totalSpent.toFixed(2)}
                  <span
                    className="tooltip tooltip-bottom"
                    data-tip="Includes bazaar purchases and wallet transfers. Excludes siphons/attacks and teacher/admin debits."
                  >
                    <Info className="w-4 h-4 text-base-content/60" />
                  </span>
                </p>
              </div>
              <h2 className="text-lg font-semibold">
                Transaction History <span className="text-sm text-gray-500">({transactionCount})</span>
              </h2>
              
              {/* Student search and filter controls */}
              <div className="flex flex-wrap gap-2 my-4">
                {/* Search bar for students too */}
                <input
                  type="search"
                  placeholder="Search your transactions..."
                  className="input input-bordered flex-1 min-w-[200px]"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />

                {/* User selector (All users) */}
                {canSeeUserFilter && (
                  <select
                    className="select select-bordered max-w-xs"
                    value={assignerFilter}
                    onChange={(e) => {
                      const id = e.target.value;
                      setAssignerFilter(id);
                      if (id) {
                        const selectedUser = studentList.find(u => u._id === id);
                        if (selectedUser) setRoleFilter(selectedUser.role);
                      } else {
                        setRoleFilter('all');
                      }
                    }}
                  >
                    <option value="">All users</option>
                    {studentList.map((u) => {
                      const displayName = (u.firstName || u.lastName)
                        ? `${u.firstName || ''} ${u.lastName || ''}`.trim()
                        : u.name || u.email;
                      return (
                        <option key={u._id} value={u._id}>
                          {displayName} – {ROLE_LABELS[u.role] || u.role}
                        </option>
                      );
                    })}
                  </select>
                )}

                {/* Role filter (All roles) with siphon option */}
                <select
                  className="select select-bordered max-w-xs"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  disabled={!!assignerFilter}
                >
                  <option value="all">All Types</option>
                  <option value="purchase">Checkout</option>
                  <option value="teacher">Adjustment by Teacher</option>
                  <option value="admin">Adjustment by Admin/TA</option>
                  <option value="siphon">Siphon Transfers</option>
                </select>

                {/* Direction filter (All directions) */}
                <select
                  className="select select-bordered max-w-xs"
                  value={directionFilter}
                  onChange={(e) => setDirectionFilter(e.target.value)}
                >
                  <option value="all">All Directions</option>
                  <option value="credit">Credit</option>
                  <option value="debit">Debit</option>
                </select>

                {/* ── Sort controls for student Transactions (also used by teachers above) ── */}
                <div className="flex items-center gap-2 mb-3">
                  <select
                    className="select select-bordered max-w-xs"
                    value={sortField}
                    onChange={(e) => setSortField(e.target.value)}
                    title="Sort field"
                  >
                    <option value="date">Sort: Date</option>
                    <option value="amount">Sort: Amount</option>
                  </select>

                  <button
                    className="btn btn-outline btn-sm"
                    title="Toggle sort direction"
                    onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                  >
                    {sortDirection === 'asc' ? 'Asc' : 'Desc'}
                  </button>
                </div>

                {/* Export for students too */}
                <ExportButtons
                  onExportCSV={exportTransactionsToCSV}
                  onExportJSON={exportTransactionsToJSON}
                  userName={`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email}
                  exportLabel="transactions"
                />
              </div>

              <TransactionList transactions={filteredTx} />
            </div>
          )}
        </>
      )}
      </div>
      <Footer />
    </div>
   );
 };
 
 export default Wallet;