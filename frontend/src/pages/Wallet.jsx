import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext'; 
import BulkBalanceEditor from '../components/BulkBalanceEditor';
import TransactionList, { inferType, TYPES } from '../components/TransactionList';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';

const Wallet = () => {
  const { user } = useAuth();
  const { id: classroomId } = useParams();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);

  const [recipientId, setRecipientId] = useState('');
  const [selectedRecipientId, setSelectedRecipientId] = useState(''); 
  const [transferAmount, setTransferAmount] = useState('');
  const [search, setSearch] = useState('');

  const [activeTab, setActiveTab] = useState('edit');    
  const [allTx, setAllTx] = useState([]);
  const [studentFilter, setStudentFilter] = useState('');  
  const [studentList, setStudentList] = useState([]);
  const [typeFilter, setTypeFilter]     = useState('all');

  // Map role values to readable labels
const ROLE_LABELS = {
  student: 'Student',
  admin:   'TA',
  teacher: 'Teacher',
};

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
    fetchWallet();
    fetchUsers();                   
    // If teacher or admin, fetch all transactions for the classroom
  if (['teacher', 'admin'].includes(user.role)) {
    fetchAllTx();
  }
  }, [user]);

  
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



  return (
    <div className="p-4">
      
       {/* ---- teacher/admin tabs ---- */}
      {['teacher', 'admin'].includes(user.role) && (
        <div className="tabs mb-6">
          <a
            className={`tab tab-bordered ${activeTab === 'edit' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('edit')}
          >
            Bulk / Edit
          </a>
          <a
            className={`tab tab-bordered ${activeTab === 'tx' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('tx')}
          >
            Transactions
          </a>
        </div>
      )}

      {['teacher', 'admin'].includes(user.role) && activeTab === 'edit' && (
  <div className="mb-6">
    <BulkBalanceEditor onSuccess={refreshTransactions} />
  </div>
)}



 {}
      {['teacher', 'admin'].includes(user.role) && activeTab === 'tx' && (
        <div className="space-y-4">
          <h2 className="font-bold">All Transactions</h2>

          {/* ▼ filter bar */}
          <div className="flex flex-wrap gap-2">
            {/* user selector */}
            <select
              className="select select-bordered max-w-xs"
              value={studentFilter}
              onChange={(e) => {
                const id = e.target.value;
                setStudentFilter(id);
                fetchAllTx(id);
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

            {/* sel*/}
            <select
              className="select select-bordered max-w-xs"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              {txTypeOptions.map((t) => (
                <option key={t} value={t}>
                  {t === 'all' ? 'All types' : TYPES[t] || t}
                </option>
              ))}
            </select>
          </div>

          {}
         <TransactionList transactions={allTx} filterType={typeFilter} />
        </div>
    )}
      {user.role === 'student' && (
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

              if (!parsedAmount || parsedAmount < 1) {
                toast.error("Transfer amount must be at least 1 bit");
                return;
              }
if (parsedAmount > balance) {
                toast.error("You don't have enough bits for this transfer");
                return;
             }
              try {
               await axios.post(
   '/api/wallet/transfer',
   {
   recipientId: selectedRecipientId || recipientId,  
   amount: parsedAmount
},
   { withCredentials: true }
 );

 
 await fetchWallet();

 
 toast.success("Transfer successful");
 setSelectedRecipientId('');
 setTransferAmount('');
 setRecipientId('');
              } catch (err) {
                const serverError = err.response?.data?.error;
                toast.error(serverError || err.message || "Transfer failed");
                console.error("Transfer failed:", err);
              }
            }}
          >
            Transfer
          </button>
          <div>
            <h1 className="text-2xl font-bold">Wallet</h1>
            <div className="mb-4 space-y-1">
              <p className="font-medium">Base Balance: {balance} bits</p>
            </div>
            <h2 className="text-lg font-semibold">Transaction History</h2>
            <ul className="list-disc ml-5">
              {transactions.map((tx) => (
                <li className="border p-4 rounded mb-2" key={tx._id}>
                  <div><strong>{tx.amount}B</strong> - {tx.description}</div>
                  <div className="text-sm text-gray-500">
                    {new Date(tx.createdAt).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};


export default Wallet;