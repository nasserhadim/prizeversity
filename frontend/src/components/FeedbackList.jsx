import React, { useState, useMemo } from 'react';
import { Star } from 'lucide-react';

export default function FeedbackList({
  feedbacks = [],
  total = null,
  showAuthor = true,
  showModeration = false,
  onToggleHide,
  onReport
}) {
  // normalize input: support either an array or the API { feedbacks, total, ... } envelope
  const list = Array.isArray(feedbacks)
    ? feedbacks
    : (feedbacks && Array.isArray(feedbacks.feedbacks))
      ? feedbacks.feedbacks
      : [];

  // Rating-distribution removed from list level; page renders it (so the bars span full page width).

  const [sortBy, setSortBy] = useState('newest'); // newest | highest | lowest | oldest

  const sorted = useMemo(() => {
    const copy = [...list];
    if (sortBy === 'highest') return copy.sort((a, b) => b.rating - a.rating || (new Date(b.createdAt) - new Date(a.createdAt)));
    if (sortBy === 'lowest') return copy.sort((a, b) => a.rating - b.rating || (new Date(b.createdAt) - new Date(a.createdAt)));
    if (sortBy === 'oldest') return copy.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    // default newest
    return copy.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [list, sortBy]);

  if (!list || list.length === 0) {
    return <div className="text-center text-base-content/60 py-4">No feedback yet.</div>;
  }

  // Render rating distribution chart before the "Showing X of Y" control
  const renderDistribution = () => {
    if (!ratingTotal) return null;
    return (
      <div className="rating-distribution mb-3">
        {Array.from({ length: 5 }).map((_, idx) => {
          const star = 5 - idx; // show 5 -> 1
          const count = ratingCounts[star] || 0;
          const pct = ratingTotal ? Math.round((count / ratingTotal) * 100) : 0;
          // ensure tiny values remain visible (but keep actual pct in title)
          const visiblePct = pct > 0 ? Math.max(pct, 4) : 0;
          return (
            <div key={star} className="rating-row flex items-center gap-3">
              <div className="rating-label text-sm text-base-content/70 w-14">{star}★</div>
              <div className="rating-bar w-full rounded h-3 overflow-hidden" aria-hidden={count === 0}>
                <div
                  className="rating-fill"
                  style={{ width: `${visiblePct}%` }}
                  title={`${pct}% (${count})`}
                  aria-label={`${star} star: ${pct}% (${count})`}
                />
              </div>
              <div className="rating-count text-sm text-base-content/60 w-12 text-right">{count}</div>
            </div>
          );
        })}
      </div>
    );
  };
 
  return (
    <div>
      {/* distribution moved to page components */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-base-content/60">
          {typeof total === 'number' ? `Showing ${list.length} of ${total}` : `Showing ${list.length}`}
        </div>
         <div className="flex items-center gap-2">
           <label className="text-sm text-base-content/60">Sort</label>
           <select className="select select-sm select-bordered" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
             <option value="newest">Newest</option>
             <option value="oldest">Oldest</option>
             <option value="highest">Highest rating</option>
             <option value="lowest">Lowest rating</option>
           </select>
         </div>
       </div>
 
     <ul className="space-y-4">
       {sorted.map((f, idx) => (
         <li key={f._id} className={`feedback-card p-4 bg-base-100 border rounded-lg shadow-sm ${f.hidden ? 'opacity-60' : ''}`}>
           <div className="flex items-center mb-1 text-xs text-base-content/50 gap-2">
             <span>#{idx + 1}</span>
             <span className="font-mono">{middleTruncateId(f._id)}</span>
             <button
               type="button"
               className="btn btn-xs"
               onClick={() => navigator.clipboard.writeText(String(f._id))}
               title="Copy full ID"
             >Copy</button>
           </div>
           <div className="card-row mb-2">
             <div className="card-left flex items-center gap-2 min-w-0">
               <div className="flex items-center gap-0.5">
                 {Array.from({ length: f.rating }).map((_, i) => (
                   // keep an explicit size so the icon doesn't collapse on some devices
                   <Star key={i} size={20} className="feedback-star-display text-yellow-400" />
                 ))}
               </div>
               {showAuthor && (
                 <div className="author text-sm text-base-content/70 ml-2 truncate">
                   {f.userId ? `${f.userId.firstName || ''} ${f.userId.lastName || ''}`.trim() || f.userId.email : (f.anonymous ? 'Anonymous' : 'Guest')}
                 </div>
               )}
             </div>

             <div className="card-right flex items-center gap-2 flex-shrink-0">
               <small className="text-xs text-base-content/50 whitespace-nowrap">{new Date(f.createdAt).toLocaleString()}</small>
               {onReport && (
                 <button className="btn btn-ghost btn-xs" onClick={() => onReport(f._id)}>
                   Report
                 </button>
               )}
               {showModeration && (
                 <button
                   className={`btn btn-xs ${f.hidden ? 'btn-success' : 'btn-warning'}`}
                   onClick={() => onToggleHide && onToggleHide(f._id, !f.hidden)}
                 >
                   {f.hidden ? 'Unhide' : 'Hide'}
                 </button>
               )}
             </div>
           </div>

            {f.comment && <p className="text-base-content/80 whitespace-pre-wrap">{f.comment}</p>}
            {f.hidden && <div className="mt-2 text-xs text-red-500 italic">Hidden by moderator</div>}
         </li>
       ))}
     </ul>
     </div>
     );
   }

   const middleTruncateId = (id) => {
     if (!id) return '';
     const s = String(id);
     if (s.length <= 16) return s;
     return `${s.slice(0,6)}…${s.slice(-6)}`;
   };