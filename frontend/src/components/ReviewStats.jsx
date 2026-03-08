import React from 'react';
import { Star } from 'lucide-react';

export default function ReviewStats({ summary }) {
  if (!summary || !summary.totalReviews) return null;

  const { averageRating, totalReviews, ratingDistribution } = summary;
  const avg = Number(averageRating) || 0;
  const roundedAvg = Math.round(avg);

  return (
    <div className="mb-6">
      {/* Average + star row */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
          <div>
            <div className="text-xl font-bold">{avg.toFixed(1)}/5</div>
            <div className="text-sm text-base-content/70">
              {totalReviews} review{totalReviews !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              size={16}
              className={i < roundedAvg ? 'text-yellow-400 fill-yellow-400' : 'text-base-content/30'}
            />
          ))}
        </div>
      </div>

      {/* Distribution bars */}
      {ratingDistribution && (
        <div className="rating-distribution mb-4">
          {Array.from({ length: 5 }).map((_, idx) => {
            const star = 5 - idx;
            const count = ratingDistribution[star] || 0;
            const pct = totalReviews ? Math.round((count / totalReviews) * 100) : 0;
            const visiblePct = pct > 0 ? Math.max(pct, 4) : 0;
            return (
              <div key={star} className="rating-row flex items-center gap-3">
                <div className="rating-label text-sm text-base-content/70 w-14">{star}★</div>
                <div className="rating-bar w-full rounded h-3 overflow-hidden">
                  <div
                    className="rating-fill"
                    style={{ width: `${visiblePct}%` }}
                    title={`${pct}% (${count})`}
                  >
                    {pct >= 5 && <span className="pct-label">{pct}%</span>}
                  </div>
                </div>
                <div className="rating-count text-sm text-base-content/60 w-12 text-right">{count}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
