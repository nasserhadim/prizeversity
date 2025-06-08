import React, { useEffect, useState } from 'react';
import axios from 'axios';
// AuthContext.jsx is needed for verifications regarding transactions and amonut very important
import { useAuth } from '../context/AuthContext'; // Don't forget this!
import BulkBalanceEditor from '../components/BulkBalanceEditor';
import TransactionList   from '../components/TransactionList';


const Wallet = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);

  const [recipientId, setRecipientId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');

  const [editStudentId, setEditStudentId] = useState('');
  const [editAmount, setEditAmount] = useState('');

  const [studentInfo, setStudentInfo] = useState(null);
  const [checkError, setCheckError] = useState('');

  const [activeTab, setActiveTab] = useState('edit');    
  const [allTx, setAllTx] = useState([]);
  const [studentFilter, setStudentFilter] = useState('');  
  const [studentList, setStudentList] = useState([]);

const fetchUsers = async () => {
  try {
    const res = await axios.get('/api/users/all', { withCredentials: true });
    setStudentList(res.data);
  } catch (err) {
    if (err.response) {
     
     console.error(
       `Failed to load users (status ${err.response.status}):`,
       err.response.data
     );
   } else {
   
    console.error('Failed to load users:', err.message);
   
   }
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

      {/* teacher/admin tab bar */}
     {['teacher', 'admin'].includes(user.role) && activeTab === 'edit' && (
        <div className="mb-6 space-y-2">
          <h2 className="font-bold">Look Up Student Balance</h2>
          <input
            type="text"
            placeholder="Student ID"
            className="input input-bordered w-full"
            value={editStudentId}
            onChange={(e) => setEditStudentId(e.target.value)}
          />
          <button
            className="btn btn-info w-full"
            onClick={async () => {
              try {
                const res = await axios.get(`/api/users/${editStudentId}`, { withCredentials: true });
                setStudentInfo(res.data);
                setCheckError('');
              } catch (err) {
                setStudentInfo(null);
                setCheckError('Student not found');
                console.error('Failed to fetch student info:', err);
              }
            }}
          >
            Check Balance
          </button>

          {checkError && <p className="text-red-500">{checkError}</p>}

          {studentInfo && (
            <>
              <p className="mt-2">Current Balance: <strong>{studentInfo.balance}B</strong></p>
              <input
                type="number"
                placeholder="Amount to Add/Subtract"
                className="input input-bordered w-full mt-2"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
              />
              <button
                className="btn btn-warning w-full mt-2"
                onClick={async () => {
                  try {
                    await axios.post('/api/wallet/assign', {
                      studentId: editStudentId,
                      amount: Number(editAmount),
                      description: 'Manual adjustment by teacher',
                    }, { withCredentials: true });

                    alert('Balance updated successfully');

                    // Re-fetch updated balance
                    const res = await axios.get(`/api/users/${editStudentId}`, { withCredentials: true });
                    setStudentInfo(res.data);
                    setEditAmount('');
                  } catch (err) {
                    console.error('Failed to update balance:', err);
                    alert('Failed to update balance');
                  }
                }}
              >
                Assign Balance
              </button>
            </>
          )}
        <BulkBalanceEditor />
  
        </div>
      )}
 {}
      {['teacher', 'admin'].includes(user.role) && activeTab === 'tx' && (
        <div className="space-y-4">
          <h2 className="font-bold">All Transactions</h2>

          {}
          <select
            className="select select-bordered w-full max-w-xs"
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

          {}
          <TransactionList transactions={allTx} />
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