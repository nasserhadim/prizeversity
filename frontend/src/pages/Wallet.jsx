import React, { useEffect, useState } from 'react';
import axios from 'axios';

const Wallet = () => {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    const fetchWallet = async () => {
      try {
        const response = await axios.get('/api/wallet');
        setBalance(response.data.balance);
        setTransactions(response.data.transactions);
      } catch (err) {
        console.error('Failed to fetch wallet', err);
      }
    };
    fetchWallet();
  }, []);

  return (
    <div>
      <h1>Wallet</h1>
      <p>Balance: {balance}B</p>
      <h2>Transactions</h2>
      <ul>
        {transactions.map((transaction) => (
          <li key={transaction._id}>
            {transaction.amount}B - {transaction.description}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Wallet;