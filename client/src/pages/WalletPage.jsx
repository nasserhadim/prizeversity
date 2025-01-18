// client/src/pages/WalletPage.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';

function WalletPage() {
  const { id } = useParams(); // classroomId
  const [wallet, setWallet] = useState(null);

  // For transactions
  const [transactions, setTransactions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('createdAt'); // 'createdAt', 'type', 'amount'
  const [order, setOrder] = useState('desc'); // 'asc' or 'desc'
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);
  const [total, setTotal] = useState(0);

  // Transfer form
  const [transferAmount, setTransferAmount] = useState('');
  const [recipientId, setRecipientId] = useState('');

  // Fetch wallet balance
  const fetchWallet = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/wallets/${id}`, {
        withCredentials: true
      });
      setWallet(res.data);
    } catch (err) {
      console.error(err.response?.data || err);
    }
  };

  // Retrieve transactions with advanced params
  const fetchTransactions = async () => {
    try {
      const url = `http://localhost:5000/api/wallets/${id}/transactions?search=${searchTerm}&sort=${sortField}&order=${order}&page=${page}&limit=${limit}`;
      const res = await axios.get(url, { withCredentials: true });
      setTransactions(res.data.data);
      setTotal(res.data.total);
    } catch (err) {
      console.error(err.response?.data || err);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, [id]);

  // Re-fetch transactions whenever these change
  useEffect(() => {
    fetchTransactions();
    // eslint-disable-next-line
  }, [searchTerm, sortField, order, page, limit, id]);

  const transfer = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`http://localhost:5000/api/wallets/${id}/transfer`, {
        recipientId,
        amount: Number(transferAmount)
      }, { withCredentials: true });
      alert('Transfer successful');
      setTransferAmount('');
      setRecipientId('');
      // Refresh balance & transactions
      fetchWallet();
      fetchTransactions();
    } catch (err) {
      alert(err.response?.data?.message || 'Transfer failed');
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage > 0) {
      setPage(newPage);
    }
  };

  if (!wallet) {
    return (
      <div className="container mt-4">
        <h3>Loading wallet...</h3>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <h2>My Wallet</h2>
      <div className="alert alert-info">
        <strong>Balance:</strong> {wallet.balance} Bits
      </div>

      {/* Transfer Form */}
      <div className="card mb-4">
        <div className="card-header">Transfer Bits</div>
        <div className="card-body">
          <form onSubmit={transfer}>
            <div className="mb-3">
              <label className="form-label">Recipient User ID</label>
              <input
                type="text"
                className="form-control"
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                required
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Amount</label>
              <input
                type="number"
                className="form-control"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                required
                min="1"
              />
            </div>
            <button type="submit" className="btn btn-primary">Transfer</button>
          </form>
        </div>
      </div>

      {/* Transactions with search/sort/pagination */}
      <div className="card">
        <div className="card-header">
          <div className="row g-2 align-items-center">
            <div className="col-auto">
              <h5 className="mb-0">Transactions</h5>
            </div>
            <div className="col-md-3">
              <input
                type="text"
                className="form-control"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => {
                  setPage(1);
                  setSearchTerm(e.target.value);
                }}
              />
            </div>
            <div className="col-md-2">
              <select
                className="form-select"
                value={sortField}
                onChange={(e) => {
                  setPage(1);
                  setSortField(e.target.value);
                }}
              >
                <option value="createdAt">Date</option>
                <option value="type">Type</option>
                <option value="amount">Amount</option>
              </select>
            </div>
            <div className="col-md-2">
              <select
                className="form-select"
                value={order}
                onChange={(e) => {
                  setPage(1);
                  setOrder(e.target.value);
                }}
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
            <div className="col-md-2">
              <select
                className="form-select"
                value={limit}
                onChange={(e) => {
                  setPage(1);
                  setLimit(e.target.value);
                }}
              >
                <option value="5">5 / page</option>
                <option value="10">10 / page</option>
                <option value="20">20 / page</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card-body p-0">
          <table className="table table-striped mb-0">
            <thead>
              <tr>
                <th>#</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Description</th>
                <th>Performed By</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t, idx) => (
                <tr key={idx}>
                  <td>{(page - 1) * limit + idx + 1}</td>
                  <td>{t.type}</td>
                  <td>{t.amount}</td>
                  <td>{t.description}</td>
                  <td>{t.performedBy}</td>
                  <td>{new Date(t.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center">No transactions found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card-footer d-flex justify-content-between align-items-center">
          <button
            className="btn btn-secondary"
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 1}
          >
            Prev
          </button>
          <span>Page {page}</span>
          <button
            className="btn btn-secondary"
            onClick={() => handlePageChange(page + 1)}
            disabled={(page * limit) >= total}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export default WalletPage;
