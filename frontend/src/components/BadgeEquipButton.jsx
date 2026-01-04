import React from 'react';
import { Star, StarOff } from 'lucide-react';

/**
 * Button to equip or unequip a badge
 */
const BadgeEquipButton = ({ 
  isEquipped, 
  onEquip, 
  onUnequip, 
  disabled = false,
  size = 'sm' 
}) => {
  if (isEquipped) {
    return (
      <button
        className={`btn btn-${size} btn-warning gap-1`}
        onClick={onUnequip}
        disabled={disabled}
        title="Unequip badge"
      >
        <StarOff className="w-3 h-3" />
        Unequip
      </button>
    );
  }

  return (
    <button
      className={`btn btn-${size} btn-outline btn-primary gap-1`}
      onClick={onEquip}
      disabled={disabled}
      title="Equip this badge"
    >
      <Star className="w-3 h-3" />
      Equip
    </button>
  );
};

export default BadgeEquipButton;