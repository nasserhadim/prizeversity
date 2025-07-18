
import React, { useMemo } from 'react';



const TYPES = {
  teacherBulk : 'Bulk adjustment by teacher',
  groupAdjust : 'Group adjust'
};

const inferType = (tx) => {
  if (tx.type && Object.keys(TYPES).includes(tx.type)) return tx.type;

  const d = tx.description?.toLowerCase() || '';
    if (d.includes('bulk adjustment by teacher') ||
      d.includes('manual adjustment by teacher')) {
    return 'teacherBulk';
  }
  if (d.includes('group adjust') || d.includes('group bulk')) {
    return 'groupAdjust';
  }
  return null;              
};

const TransactionList = ({ transactions, filterType = 'all' }) => {

  const visible = useMemo(() => (
    filterType === 'all'
      ? transactions
      : transactions.filter(tx => inferType(tx) === filterType)
  ), [transactions, filterType]);


  const colour = (amt) => (amt < 0 ? 'text-red-500' : 'text-green-600');

  return (
    <div className="space-y-4">
     

      {/* list body */}
      {visible.length === 0 && (
        <p className="italic text-gray-500 mt-4">No transactions found.</p>
      )}

      {visible.map(tx => (
        <div
          key={tx._id || tx.createdAt}
          className="border rounded-lg p-4 flex justify-between items-start shadow-sm bg-white"
        >
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{tx.description}</p>
            <p className="text-xs text-gray-500">
              {(tx.studentName || tx.studentEmail) && (
              <>
                {tx.studentName || tx.studentEmail} ·{' '}
              </>
            )}
              {new Date(tx.createdAt).toLocaleString()}
            </p>
          </div>
          <p className={`text-lg font-bold ${colour(tx.amount)}`}>
            {tx.amount > 0 ? '+' : ''}{tx.amount} B
          </p>
        </div>
      ))}
    </div>
  );
};

export default TransactionList;
export { inferType, TYPES };