import React from 'react';
import { resolveBadgeSrc } from '../utils/image';

/**
 * Displays a user's equipped badge icon (inline, next to their name)
 * @param {Object} badge - { _id, name, icon, image }
 * @param {number} size - size in pixels (default 20)
 * @param {boolean} showTooltip - whether to show tooltip on hover
 */
const EquippedBadge = ({ badge, size = 20, showTooltip = true }) => {
  if (!badge) return null;

  const content = badge.image ? (
    <img
      src={resolveBadgeSrc(badge.image)}
      alt={badge.name}
      className="inline-block rounded-full object-cover"
      style={{ width: size, height: size }}
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.style.display = 'none';
        // Show icon as fallback
        e.currentTarget.insertAdjacentHTML('afterend', `<span style="font-size: ${size * 0.8}px">${badge.icon || '🏅'}</span>`);
      }}
    />
  ) : (
    <span style={{ fontSize: size * 0.8 }}>{badge.icon || '🏅'}</span>
  );

  if (showTooltip) {
    return (
      <span 
        className="tooltip tooltip-bottom cursor-help inline-flex items-center" 
        data-tip={`Badge: ${badge.name}`}
      >
        {content}
      </span>
    );
  }

  return <span className="inline-flex items-center">{content}</span>;
};

export default EquippedBadge;