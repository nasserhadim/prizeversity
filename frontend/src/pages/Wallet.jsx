import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext'; 
import BulkBalanceEditor from '../components/BulkBalanceEditor';
import TransactionList, { inferType, TYPES } from '../components/TransactionList';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Footer from '../components/Footer';

const Wallet = () => {
  const { user } = useAuth();
  const { id: classroomId } = useParams();
  const [transactions, setTransactions] = useState([]);
  const [classroom, setClassroom] = useState(null);
  const [balance, setBalance] = useState(0);
  const [recipientId, setRecipientId] = useState('');
  const [selectedRecipientId, setSelectedRecipientId] = useState(''); 
  const [transferAmount, setTransferAmount] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('edit');    
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
    fetchClassroom();
    fetchWallet();
    fetchUsers();                   
    // If teacher or admin, fetch all transactions for the classroom
  if (['teacher', 'admin'].includes(user.role)) {
    fetchAllTx();
  }
  }, [user, classroomId]);

  
// Fetch all transactions optionally filtered by student ID
  const fetchAllTx = async (studentId = '') => {
    const url = studentId ? `/api/wallet/transactions/all?studentId=${studentId}` : '/api/wallet/transactions/all';
    const res = await axios.get(url, { withCredentials: true });
    setAllTx(res.data);          
  };

// Compute all distinct transaction types present in allTx, memoized
  const txTypeOptions = useMemo(() => {
    const set = new Set(allTx.map(inferType).filter(Boolean));
    return ['all', ...Array.from(set)];    
  }, [allTx]);

  // Fetch the wallet data for current user (student) or transactions for teacher/admin
    const fetchWallet = async () => {
      try {
    const { data } = await axios.get('/api/wallet/transactions', { withCredentials: true });
   
     const sorted = data
       .slice()
       .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
     setTransactions(sorted);

        if (user.role === 'student') {
          const userRes = await axios.get(`/api/users/${user._id}`, { withCredentials: true });
          setBalance(userRes.data.balance);
        }
      } catch (err) {
        console.error('Failed to fetch wallet', err);
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
              onChange={(e) => setTransferAmount(e.target.value)}
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
                  await axios.post('/api/wallet/transfer', {
                    recipientShortId: recipientId,
                    amount: parsedAmount
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