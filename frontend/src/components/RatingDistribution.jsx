import React from 'react';

/* Shared rating distribution bar chart used by Feedback pages.
   Props:
   - feedbacks: array of feedback objects (each should have .rating)
   - className: optional extra classes for wrapper
*/
export default function RatingDistribution({ feedbacks = [], className = '' }) {
  const counts = [0, 0, 0, 0, 0, 0];
  (feedbacks || []).forEach(f => {
    const r = Math.max(1, Math.min(5, Number(f?.rating) || 0));
    counts[r] = (counts[r] || 0) + 1;
  });
  const total = (feedbacks || []).length;
  if (!total) return null;

  return (
    <div className={`rating-distribution mb-4 ${className}`}>
      {Array.from({ length: 5 }).map((_, idx) => {
        const star = 5 - idx;
        const count = counts[star] || 0;
        const pct = total ? Math.round((count / total) * 100) : 0;
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
              >
                {/* show percentage inside bar when there's enough room (readability) */}
                {pct >= 5 && (
                  <span className="pct-label">{`${pct}%`}</span>
                )}
              </div>
            </div>
            <div className="rating-count text-sm text-base-content/60 w-12 text-right">
              {count}
              {/* small fallback: show percent beside the count for tiny slices */}
              {pct > 0 && pct < 5 && <span className="ml-1 text-xs text-base-content/50"> {pct}%</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}