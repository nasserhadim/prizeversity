import React from 'react';
import { Coins, Zap, TrendingUp, ShoppingCart, Shield } from 'lucide-react';

const BadgeRewardsDisplay = ({ rewards, size = 'sm', showEmpty = false }) => {
  if (!rewards) return null;

  const hasRewards = 
    (rewards.bits || 0) > 0 || 
    (rewards.multiplier || 0) > 0 || 
    (rewards.luck || 0) > 0 || 
    (rewards.discount || 0) > 0 || 
    (rewards.shield || 0) > 0;

  if (!hasRewards && !showEmpty) return null;

  if (!hasRewards && showEmpty) {
    return (
      <div className={`badge badge-outline badge-${size} text-gray-400`}>
        No rewards
      </div>
    );
  }

  const rewardItems = [];

  if ((rewards.bits || 0) > 0) {
    rewardItems.push({
      icon: <Coins className="w-3 h-3" />,
      value: rewards.bits,
      label: 'bits',
      color: 'text-yellow-500'
    });
  }

  if ((rewards.multiplier || 0) > 0) {
    rewardItems.push({
      icon: <TrendingUp className="w-3 h-3" />,
      value: `+${rewards.multiplier.toFixed(1)}`,
      label: 'multiplier',
      color: 'text-blue-500'
    });
  }

  if ((rewards.luck || 0) > 0) {
    rewardItems.push({
      icon: <Zap className="w-3 h-3" />,
      value: `+${rewards.luck.toFixed(1)}`,
      label: 'luck',
      color: 'text-purple-500'
    });
  }

  if ((rewards.discount || 0) > 0) {
    rewardItems.push({
      icon: <ShoppingCart className="w-3 h-3" />,
      value: `${rewards.discount}%`,
      label: 'discount',
      color: 'text-green-500'
    });
  }

  if ((rewards.shield || 0) > 0) {
    rewardItems.push({
      icon: <Shield className="w-3 h-3" />,
      value: `+${rewards.shield}`,
      label: 'shield',
      color: 'text-cyan-500'
    });
  }

  const sizeClasses = {
    xs: 'badge-xs gap-0.5 text-[10px]',
    sm: 'badge-sm gap-1 text-xs',
    md: 'gap-1.5 text-sm',
    lg: 'badge-lg gap-2 text-base'
  };

  return (
    <div className="flex flex-wrap gap-1">
      {rewardItems.map((item, idx) => (
        <div
          key={idx}
          className={`badge badge-outline ${sizeClasses[size]} ${item.color} border-current/30`}
          title={item.label}
        >
          {item.icon}
          <span className="font-medium">{item.value}</span>
        </div>
      ))}
      {(rewards.applyPersonalMultiplier || rewards.applyGroupMultiplier) && rewards.bits > 0 && (
        <div className="badge badge-ghost badge-xs text-base-content/60">
          ×{[
            rewards.applyPersonalMultiplier && 'personal',
            rewards.applyGroupMultiplier && 'group'
          ].filter(Boolean).join('+')}
        </div>
      )}
    </div>
  );
};

export default BadgeRewardsDisplay;