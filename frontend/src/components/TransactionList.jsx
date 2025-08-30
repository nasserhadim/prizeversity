import React, { useMemo, useState, useEffect } from 'react';
import apiBazaar from '../API/apiBazaar';
import { getEffectDescription, splitDescriptionEffect } from '../utils/itemHelpers';
import toast from 'react-hot-toast';
import { resolveImageSrc } from '../utils/image';

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

// Shorten id like OrderHistory/OrderCard do
const shortId = (id) => {
  if (!id) return '';
  if (id.length <= 14) return id;
  return `${id.slice(0,6)}...${id.slice(-6)}`;
};

const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast.success('Copied ID');
  } catch {
    toast.error('Copy failed');
  }
};

const TransactionList = ({ transactions }) => {
  // Memoized list of transactions filtered by type (or all if filterType='all')
  const visible = transactions || [];

  // cache for order lookups when tx.items is missing
  const [orderCache, setOrderCache] = useState({});

  // fetch missing orders for transactions that reference an orderId but have no items
  useEffect(() => {
    const idsToFetch = Array.from(new Set(
      visible
        .filter(tx => (!tx.items || tx.items.length === 0) && tx.orderId)
        .map(tx => tx.orderId)
        .filter(id => id && !orderCache[id])
    ));
    if (idsToFetch.length === 0) return;

    idsToFetch.forEach(async (orderId) => {
      try {
        const res = await apiBazaar.get(`/orders/${orderId}`); // GET /api/bazaar/orders/:orderId
        // order endpoint should return an order with items
        const items = res.data?.items || res.data?.order?.items || [];
        setOrderCache(prev => ({ ...prev, [orderId]: items }));
      } catch (err) {
        console.error('Failed to fetch order for tx:', orderId, err);
        setOrderCache(prev => ({ ...prev, [orderId]: [] }));
      }
    });
  }, [visible, orderCache]);

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
          key={tx._id || `${tx.orderId || ''}-${tx.date || ''}`}
          className="border p-4 rounded-lg flex justify-between items-center"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <p className="font-medium truncate">{tx.description}</p>
              {/* short id + copy button (single place, same as OrderHistory/OrderCard) */}
              <button
                className="ml-3 inline-flex items-center gap-2 text-xs text-base-content/50 hover:text-base-content"
                onClick={() => copyToClipboard(tx.orderId || tx._id)}
                title="Copy ID"
                aria-label="Copy transaction/order id"
              >
                {shortId(tx.orderId || tx._id)}
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-1">
              {(tx.studentName || tx.studentEmail) && !tx.description.includes(tx.studentName) && (
                <>
                  {tx.studentName || tx.studentEmail} ·{' '}
                </>
              )}
              {new Date(tx.createdAt || tx.date || Date.now()).toLocaleString()}
            </p>

            {tx.calculation && (
              <p className="text-xs text-gray-400 mt-1">
                (Base: {tx.calculation.baseAmount}₿, 
                Personal: {tx.calculation.personalMultiplier?.toFixed(2)}x, 
                Group: {tx.calculation.groupMultiplier?.toFixed(2)}x, 
                Total: {tx.calculation.totalMultiplier?.toFixed(2)}x)
              </p>
            )}

            {/* If this transaction contains purchased items (checkout), render item list summary */}
            {((tx.items && tx.items.length > 0) || (tx.orderId && orderCache[tx.orderId]?.length)) && (
              <div className="mt-3 space-y-2">
                {(tx.items && tx.items.length > 0 ? tx.items : orderCache[tx.orderId] || []).map((it) => {
                   // Split description into main + Effect (same helper used by OrderCard)
                   const { main: descMain, effect: effectFromDesc } = splitDescriptionEffect(it.description || '');
                   const autoEffect = !effectFromDesc && getEffectDescription(it);
                   return (
                     <div key={it.id || it._id || it.name} className="flex items-start gap-3">
                       <div className="w-10 h-10 bg-base-200 rounded overflow-hidden flex items-center justify-center flex-shrink-0">
                         <img
                           src={resolveImageSrc(it.image)}
                           alt={it.name}
                           className="object-cover w-full h-full"
                           onError={(e) => {
                             e.currentTarget.onerror = null;
                             e.currentTarget.src = '/images/item-placeholder.svg';
                           }}
                         />
                       </div>

                       <div className="flex-1 min-w-0">
                         <div className="font-medium truncate">
                           {it.name} <span className="text-xs text-base-content/50">({Number.isFinite(Number(it.price)) ? `${it.price} ₿` : '—'})</span>
                         </div>

                         {/* Description main text */}
                         {descMain ? (
                           <div className="text-xs text-base-content/70 whitespace-pre-wrap mt-1">
                             {descMain}
                           </div>
                         ) : it.description ? (
                           <div className="text-xs text-base-content/70 line-clamp-2 mt-1">
                             {it.description}
                           </div>
                         ) : null}

                         {/* Explicit Effect line (if present) or auto-generated effect */}
                         {effectFromDesc ? (
                           <div className="text-xs text-base-content/60 mt-1"><strong>Effect:</strong> {effectFromDesc}</div>
                         ) : (autoEffect && (
                           <div className="text-xs text-base-content/60 mt-1"><strong>Effect:</strong> {autoEffect}</div>
                         )) }
                       </div>
                     </div>
                   );
                 })}
               </div>
             )}
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