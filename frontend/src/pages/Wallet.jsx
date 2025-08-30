import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom'; // <-- add this
import { useAuth } from '../context/AuthContext'; 
import BulkBalanceEditor from '../components/BulkBalanceEditor';
import TransactionList, { inferType, TYPES } from '../components/TransactionList';
import toast from 'react-hot-toast';
import Footer from '../components/Footer';

const Wallet = () => {
  const { user } = useAuth();
  const { id: classroomId } = useParams(); // ensure we read the classroom id from the route

  // Default tab: teachers/admins should land on Transactions so they see classroom txs immediately
  const defaultTab = (user && ['teacher','admin'].includes(user.role)) ? 'transactions' : 'edit';
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [transactions, setTransactions] = useState([]);
  const [classroom, setClassroom] = useState(null);
  const [balance, setBalance] = useState(0);
  const [recipientId, setRecipientId] = useState('');
  const [selectedRecipientId, setSelectedRecipientId] = useState(''); 
  const [transferAmount, setTransferAmount] = useState('');
  const [search, setSearch] = useState('');
  const [allTx, setAllTx] = useState([]);
  const [studentFilter, setStudentFilter] = useState('');  
  const [studentList, setStudentList] = useState([]);
  const [roleFilter, setRoleFilter] = useState('all');
  const [directionFilter, setDirectionFilter] = useState('all');
  const [assignerFilter, setAssignerFilter] = useState('');

  // Map role values to readable labels
  const ROLE_LABELS = {
    student: 'Student',
    teacher: 'Teacher',
    admin: 'Admin/TA'
  };

  // Filter transactions based on selected role and direction
  const filteredTx = useMemo(() => {
    const sourceTx = user.role === 'student' ? transactions : allTx;
    return sourceTx.filter(tx => {
      const assignerMatch = !assignerFilter || (tx.assignedBy?._id === assignerFilter);
      const roleMatch = roleFilter === 'all' || (tx.assignedBy?.role === roleFilter);
      const directionMatch = directionFilter === 'all' || (directionFilter === 'credit' ? tx.amount > 0 : tx.amount < 0);
      return assignerMatch && roleMatch && directionMatch;
    });
  }, [allTx, transactions, roleFilter, directionFilter, assignerFilter, user.role]);

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
   // otherwise use description+amount+timestamp (stable enough for de-duping).
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

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">
          {classroom?.name ? `${classroom.name} Wallet` : 'Wallet'}
        </h1>

        {/* ▼ Tab buttons */}
        {(user.role === 'teacher' || user.role === 'admin') && (
          <div role="tablist" className="tabs tabs-boxed">
            <a
              role="tab"
              className={`tab ${activeTab === 'edit' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('edit')}
            >
              Bulk / Edit
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

      {/* ▼ Edit/Bulk tab */}
      {activeTab === 'edit' && (user.role === 'teacher' || user.role === 'admin') && (
        <BulkBalanceEditor classroomId={classroomId} />
      )}

      {/* ▼ Transactions tab */}
      {activeTab === 'transactions' && (user.role === 'teacher' || user.role === 'admin') && (
        <div className="space-y-4">
          <h2 className="font-bold">All Transactions</h2>

          {/* ▼ filter bar */}
          <div className="flex flex-wrap gap-2">
            {/* user selector */}
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
                  {displayName} – {ROLE_LABELS[u.role] || u.role}
                </option>
              );
            })}
            </select>

            {/* Role filter */}
            <select
              className="select select-bordered max-w-xs"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              disabled={!!assignerFilter}
            >
              <option value="all">All Roles</option>
              <option value="teacher">Adjustment by Teacher</option>
              <option value="admin">Adjustment by Admin/TA</option>
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
          </div>

          {}
         <TransactionList transactions={filteredTx} />
        </div>
    )}
      {user.role === 'student' && (
        <>
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
                    classroomId
                  }, { withCredentials: true });
                  toast.success('Transfer successful!');
                  fetchWallet(); // Refresh balance and transactions
                } catch (err) {
                  toast.error(err.response?.data?.error || 'Transfer failed.');
                }
              }}
            >
              Transfer
            </button>
          </div>
          <div className="mt-6">
            <div className="mb-4">
              <p className="font-medium">Base Balance: {balance} ₿</p>
            </div>
            <h2 className="text-lg font-semibold">Transaction History</h2>
            {/* Student's transaction list */}
            <div className="flex flex-wrap gap-2 my-4">
              <select
                className="select select-bordered max-w-xs"
                value={directionFilter}
                onChange={(e) => setDirectionFilter(e.target.value)}
              >
                <option value="all">All Directions</option>
                <option value="credit">Credit</option>
                <option value="debit">Debit</option>
              </select>
            </div>
            <TransactionList transactions={filteredTx} />
          </div>
        </>
      )}
      <Footer />
    </div>
  );
};


export default Wallet;