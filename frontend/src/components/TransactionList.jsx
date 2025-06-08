import React from 'react';

const TransactionList = ({ transactions }) => (
  <ul className="list-disc ml-5">
    {transactions.length === 0 && (
      <li className="text-sm italic">No transactions found.</li>
    )}
    {transactions.map((tx) => (
      <li key={tx._id || tx.createdAt} className="border p-3 rounded mb-2">
        <div>
          <strong>{tx.amount} B</strong> – {tx.description}
        </div>
        <div className="text-xs text-gray-500">
          {tx.studentEmail && (<>{tx.studentEmail} · </>)}
          {new Date(tx.createdAt).toLocaleString()}
        </div>
      </li>
    ))}
  </ul>
);

export default TransactionList;
