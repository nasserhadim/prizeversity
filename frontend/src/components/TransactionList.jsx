import React, { useMemo } from 'react';


// Mapping of known transaction types to human-readable labels
const TYPES = {
  teacherBulk : 'Bulk adjustment by teacher',
  groupAdjust : 'Group adjust'
};

// Function to infer transaction type from tx object or description text
const inferType = (tx) => {
  // If tx.type exists and is a known type, return it directly
  if (tx.type && Object.keys(TYPES).includes(tx.type)) return tx.type;

   // Otherwise, check description text (case-insensitive) for keywords
  const d = tx.description?.toLowerCase() || '';
    if (d.includes('bulk adjustment by teacher') ||
      d.includes('manual adjustment by teacher')) {
    return 'teacherBulk';
  }
  if (d.includes('group adjust') || d.includes('group bulk')) {
    return 'groupAdjust';
  }
  // Return null if no known type is inferred
  return null;              
};

const TransactionList = ({ transactions }) => {

  // Memoized list of transactions filtered by type (or all if filterType='all')
  const visible = transactions;


   // Function returning CSS text color class based on positive/negative amount
  const colour = (amt) => (amt < 0 ? 'text-red-500' : 'text-green-600');

  return (
    <ul className="space-y-4">
      {/* list body */}
      {visible.length === 0 && (
        <p className="italic text-gray-500 mt-4">No transactions found.</p>
      )}

      {visible.map((tx) => (
        <li
          key={tx._id}
          className="border p-4 rounded-lg flex justify-between items-center"
        >
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{tx.description}</p>
            <p className="text-xs text-gray-500">
              {(tx.studentName || tx.studentEmail) && !tx.description.includes(tx.studentName) && (
              <>
                {tx.studentName || tx.studentEmail} ·{' '}
              </>
            )}
              {new Date(tx.createdAt).toLocaleString()}
            </p>
            {tx.calculation && (
              <p className="text-xs text-gray-400 mt-1">
                (Base: {tx.calculation.baseAmount}₿, 
                Personal: {tx.calculation.personalMultiplier?.toFixed(2)}x, 
                Group: {tx.calculation.groupMultiplier?.toFixed(2)}x, 
                Total: {tx.calculation.totalMultiplier?.toFixed(2)}x)
              </p>
            )}
            <p className="text-xs text-gray-400 font-mono mt-1">
              ID: {tx._id}
            </p>
          </div>
          <p className={`text-lg font-bold ${colour(tx.amount)}`}>
            {tx.amount > 0 ? '+' : ''}{tx.amount} ₿
          </p>
        </li>
      ))}
    </ul>
  );
};

export default TransactionList;
export { inferType, TYPES };