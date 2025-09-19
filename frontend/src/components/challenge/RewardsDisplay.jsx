import React from 'react';
import { Coins, Zap, TrendingUp, ShoppingCart, Shield } from 'lucide-react';

const RewardsDisplay = ({ rewards, isDark, isCompleted, size = 'sm' }) => {
  if (!rewards) return null;

  const hasRewards = rewards.bits > 0 || rewards.multiplier > 0 || rewards.luck > 1.0 || rewards.discount > 0 || rewards.shield || rewards.attackBonus > 0;
  
  if (!hasRewards) {
    return (
      <div className={`badge badge-outline badge-${size} text-gray-400`}>
        No rewards
      </div>
    );
  }

  const rewardItems = [];

  if (rewards.bits > 0) {
    rewardItems.push({
      icon: <Coins className="w-3 h-3" />,
      value: rewards.bits,
      label: 'bits',
      color: isCompleted ? 'text-green-500' : 'text-yellow-500'
    });
  }

  if (rewards.multiplier > 0) {
    rewardItems.push({
      icon: <TrendingUp className="w-3 h-3" />,
      value: `+${(rewards.multiplier * 100).toFixed(0)}%`,
      label: 'multiplier',
      color: isCompleted ? 'text-green-500' : 'text-blue-500'
    });
  }

  if (rewards.luck > 1.0) {
    rewardItems.push({
      icon: <Zap className="w-3 h-3" />,
      value: `${rewards.luck.toFixed(1)}x`,
      label: 'luck',
      color: isCompleted ? 'text-green-500' : 'text-purple-500'
    });
  }

  if (rewards.discount > 0) {
    rewardItems.push({
      icon: <ShoppingCart className="w-3 h-3" />,
      value: `${rewards.discount}%`,
      label: 'discount',
      color: isCompleted ? 'text-green-500' : 'text-orange-500'
    });
  }

  if (rewards.shield) {
    rewardItems.push({
      icon: <Shield className="w-3 h-3" />,
      value: '',
      label: 'shield',
      color: isCompleted ? 'text-green-500' : 'text-cyan-500'
    });
  }

  if (rewards.attackBonus > 0) {
    rewardItems.push({
      icon: <span className="text-red-500">⚔️</span>,
      value: `+${rewards.attackBonus}`,
      label: 'attack',
      color: isCompleted ? 'text-green-500' : 'text-red-500'
    });
  }

  if (size === 'lg') {
    return (
      <div className="flex flex-wrap gap-2">
        {rewardItems.map((item, index) => (
          <div 
            key={index}
            className={`badge badge-outline badge-lg gap-1 ${item.color} ${isDark ? 'border-gray-600' : 'border-gray-300'}`}
          >
            {item.icon}
            {item.value && <span className="font-medium">{item.value}</span>}
            <span className="text-xs opacity-75">{item.label}</span>
          </div>
        ))}
      </div>
    );
  }

  if (rewardItems.length === 1) {
    const item = rewardItems[0];
    return (
      <div className={`badge badge-outline badge-${size} gap-1 ${item.color} ${isDark ? 'border-gray-600' : 'border-gray-300'}`}>
        {item.icon}
        {item.value && <span className="font-medium">{item.value}</span>}
        <span className="text-xs opacity-75">{item.label}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {rewardItems.map((item, index) => (
        <div 
          key={index}
          className={`badge badge-outline badge-xs gap-1 ${item.color} ${isDark ? 'border-gray-600' : 'border-gray-300'}`}
        >
          {item.icon}
          {item.value && <span className="font-medium">{item.value}</span>}
        </div>
      ))}
    </div>
  );
};

export default RewardsDisplay;
