import React from 'react';
import { Star } from 'lucide-react';

/**
 * AverageRating({ feedbacks = [], user = null, yourRatingLocal = null })
 * - feedbacks: array of feedback objects (each should have .rating and optional .userId)
 * - user: authenticated user object (optional)
 * - yourRatingLocal: number (1-5) saved locally for anonymous submissions
 */
export default function AverageRating({ feedbacks = [], user = null, yourRatingLocal = null }) {
  const total = (feedbacks || []).length;
  if (!total) return null;

  const sum = feedbacks.reduce((s, f) => s + (Number(f.rating) || 0), 0);
  const avg5 = sum / total;
  const avg5Str = avg5.toFixed(1);

  // find feedback by this user (works when f.userId is populated object or just id)
  let userRating = null;
  let userRatingIsAnonymous = false;
  if (user && user._id) {
    const found = (feedbacks || []).find(f => {
      if (!f.userId) return false;
      if (typeof f.userId === 'object') return String(f.userId._id) === String(user._id);
      return String(f.userId) === String(user._id);
    });
    if (found) {
      userRating = Number(found.rating) || null;
      userRatingIsAnonymous = !!found.anonymous;
    }
  }

  // Fallback: use locally saved rating (useful when the user submitted anonymously)
  if (userRating == null && yourRatingLocal != null) {
    userRating = Number(yourRatingLocal) || null;
    userRatingIsAnonymous = true;
  }

  const roundedAvg = Math.round(avg5); // for star display

  return (
    <div className="flex items-center gap-4 mb-4">
      <div className="flex items-center gap-2">
        <Star className="w-6 h-6 text-yellow-400" />
        <div>
          <div className="text-xl font-bold">{avg5Str}/5</div>
          <div className="text-sm text-base-content/70">{total} rating{total !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* visual star row for average */}
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            size={16}
            className={i < roundedAvg ? 'text-yellow-400' : 'text-base-content/30'}
          />
        ))}
      </div>

      {userRating != null && (
        <div className="ml-2 text-sm text-base-content/80">
          <div className="font-medium">Your rating{userRatingIsAnonymous ? ' (private)' : ''}</div>
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold">{userRating}/5</div>
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={14} className={i < Math.round(userRating) ? 'text-yellow-400' : 'text-base-content/30'} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}