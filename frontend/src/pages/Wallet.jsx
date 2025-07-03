import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext'; 
import BulkBalanceEditor from '../components/BulkBalanceEditor';
import TransactionList, { inferType, TYPES } from '../components/TransactionList';
import { useParams } from 'react-router-dom';

const Wallet = () => {
  const { user } = useAuth();
  const { id: classroomId } = useParams();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);

  const [recipientId, setRecipientId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [search, setSearch] = useState('');

  const [activeTab, setActiveTab] = useState('edit');    
  const [allTx, setAllTx] = useState([]);
  const [studentFilter, setStudentFilter] = useState('');  
  const [studentList, setStudentList] = useState([]);
  const [typeFilter, setTypeFilter]     = useState('all');


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

    useEffect(() => {
   if (!user) return;
    fetchWallet();
    if (['teacher', 'admin'].includes(user.role)) {
      fetchUsers();
      fetchAllTx();
    }
  }, [user]);

  

  const fetchAllTx = async (studentId = '') => {
    const url = studentId ? `/api/wallet/transactions/all?studentId=${studentId}` : '/api/wallet/transactions/all';
    const res = await axios.get(url, { withCredentials: true });
    setAllTx(res.data);          
  };


  const txTypeOptions = useMemo(() => {
    const set = new Set(allTx.map(inferType).filter(Boolean));
    return ['all', ...Array.from(set)];    
  }, [allTx]);

    const fetchWallet = async () => {
      try {
        const response = await axios.get('/api/wallet/transactions', { withCredentials: true });
        setTransactions(response.data);

        if (user.role === 'student') {
          const userRes = await axios.get(`/api/users/${user._id}`, { withCredentials: true });
          setBalance(userRes.data.balance);
        }
      } catch (err) {
        console.error('Failed to fetch wallet', err);
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
    <BulkBalanceEditor />
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
              {studentList.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.email} – {u.role}
                </option>
              ))}
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
          <h2 className="font-bold">Send Bits</h2>
          <input
            type="text"
            placeholder="Recipient ID"
            className="input input-bordered w-full"
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
            className="btn btn-primary w-full"
            onClick={async () => {
              const parsedAmount = parseInt(transferAmount, 10);

              if (!parsedAmount || parsedAmount < 1) {
                alert("Transfer amount must be at least 1 bit");
                return;
              }

              try {
                await axios.post('/api/wallet/transfer', {
                  recipientId,
                  amount: parsedAmount,
                }, { withCredentials: true });

                alert("Transfer successful");
                setTransferAmount('');
                setRecipientId('');
                fetchWallet();
              } catch (err) {
                console.error("Transfer failed", err);
              }
            }}
          >
            Send Bits
          </button>
          <div>
            <h1 className="text-2xl font-bold">Wallet</h1>
            <p className="mb-4">Balance: {balance}</p>
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