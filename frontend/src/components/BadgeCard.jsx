import React from 'react';
import { Award, Calendar, Star } from 'lucide-react';
import { resolveBadgeSrc } from '../utils/image';
import BadgeEquipButton from './BadgeEquipButton';

/**
 * Reusable badge card for the collection view
 */
const BadgeCard = ({ 
  badge, 
  earnedInfo, 
  isEquipped, 
  onEquip, 
  onUnequip,
  isOwner = false // true if viewing own badges (can equip)
}) => {
  return (
    <div 
      className={`card bg-gradient-to-br from-yellow-50 to-amber-50 shadow-lg hover:shadow-xl transition-all duration-200 ${
        isEquipped ? 'border-4 border-yellow-400 ring-2 ring-yellow-300' : 'border-2 border-yellow-300'
      }`}
    >
      <div className="card-body items-center text-center">
        {/* Equipped indicator */}
        {isEquipped && (
          <div className="absolute top-2 right-2">
            <span className="badge badge-warning gap-1">
              <Star className="w-3 h-3 fill-current" />
              Equipped
            </span>
          </div>
        )}

        {/* Icon at top */}
        <div className="text-6xl mb-3 animate-bounce">
          {badge.icon}
        </div>
        
        {/* Image below icon */}
        {badge.image && (
          <img 
            src={resolveBadgeSrc(badge.image)}
            alt={badge.name}
            className="w-full max-h-40 object-contain mb-3"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.style.display = 'none';
            }}
          />
        )}
        
        <h3 className="card-title text-lg badge-name">{badge.name}</h3>
        <p className="text-sm text-base-content/80 mb-2 badge-description">
          {badge.description}
        </p>
        <div className="badge badge-success gap-2">
          <Award className="w-3 h-3" />
          Level {badge.levelRequired}
        </div>
        
        {/* Show earned date */}
        {earnedInfo?.earnedAt && (
          <div className="flex items-center gap-1 text-xs text-base-content/60 mt-2">
            <Calendar className="w-3 h-3" />
            {new Date(earnedInfo.earnedAt).toLocaleString()}
          </div>
        )}

        {/* Equip button - only show for owner viewing their own badges */}
        {isOwner && (
          <div className="mt-3">
            <BadgeEquipButton
              isEquipped={isEquipped}
              onEquip={() => onEquip(badge._id)}
              onUnequip={onUnequip}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default BadgeCard;