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

const TransactionList = ({ transactions, filterType = 'all' }) => {
// Memoized list of transactions filtered by type (or all if filterType='all')
  const visible = useMemo(() => (
    filterType === 'all'
      ? transactions
      : transactions.filter(tx => inferType(tx) === filterType)
  ), [transactions, filterType]);


   // Function returning CSS text color class based on positive/negative amount
  const colour = (amt) => (amt < 0 ? 'text-red-500' : 'text-green-600');

  return (
    <div className="space-y-4">
     

      {/* list body */}
      {visible.length === 0 && (
        <p className="italic text-gray-500 mt-4">No transactions found.</p>
      )}

      {visible.map(tx => {
        const title = tx.description;
        const isCredit = tx.amount > 0;

        return (
          <div key={tx._id} className="border p-4 rounded-lg flex justify-between items-center">
            <div className="flex-1">
              <p className="font-bold">{title}</p>
              <p className="text-sm text-gray-500">
                {tx.user?.firstName} {tx.user?.lastName} - {new Date(tx.createdAt).toLocaleString()}
              </p>
            </div>
            <div className={`font-bold text-lg ${isCredit ? 'text-green-500' : 'text-red-500'}`}>
              {isCredit ? '+' : ''}
              {tx.amount} Ƀ
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TransactionList;
export { inferType, TYPES };