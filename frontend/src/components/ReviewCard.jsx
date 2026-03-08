import React from 'react';
import { Star, CheckCircle } from 'lucide-react';

export default function ReviewCard({ review }) {
  const { author, rating, title, text, date, verified } = review;
  const stars = Math.max(0, Math.min(5, Math.round(rating)));

  return (
    <div className="card bg-base-100 shadow-sm border border-base-300 mb-3">
      <div className="card-body p-4">
        {/* Header row: stars + author + date */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  size={16}
                  className={i < stars ? 'text-yellow-400 fill-yellow-400' : 'text-base-content/20'}
                />
              ))}
            </div>
            <span className="font-semibold text-sm">{author || 'Anonymous'}</span>
            {verified && (
              <span className="badge badge-success badge-sm gap-1">
                <CheckCircle size={12} /> Verified
              </span>
            )}
          </div>
          <span className="text-xs text-base-content/50">
            {date ? new Date(date).toLocaleDateString() : ''}
          </span>
        </div>

        {/* Title */}
        {title && <h4 className="font-bold text-sm mt-2">{title}</h4>}

        {/* Body */}
        {text && <p className="text-sm text-base-content/80 mt-1 whitespace-pre-line">{text}</p>}
      </div>
    </div>
  );
}
