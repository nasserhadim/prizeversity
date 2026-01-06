import { Gift, Coins, TrendingUp, Zap, ShoppingCart, Shield, X } from 'lucide-react';

const RewardsModal = ({ isOpen, onClose, rewards, stepTitle, challengeTitle, isDark }) => {
  if (!isOpen || !rewards) return null;

  const hasRewards = rewards.bits > 0 || rewards.multiplier > 0 || rewards.luck > 0 || rewards.discount > 0 || rewards.shield;

  if (!hasRewards) return null;

  const rewardItems = [];

  if (rewards.bits > 0) {
    rewardItems.push({
      icon: Coins,
      label: 'Bits',
      value: `${rewards.bits} ₿`,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/30'
    });
  }

  if (rewards.multiplier > 0) {
    rewardItems.push({
      icon: TrendingUp,
      label: 'Multiplier',
      value: `+${(rewards.multiplier * 100).toFixed(0)}%`,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30'
    });
  }

  if (rewards.luck > 0) {
    const luckPercent = Math.round(rewards.luck * 100);
    rewardItems.push({
      icon: Zap,
      label: 'Luck',
      value: `+${luckPercent}%`,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/30'
    });
  }

  if (rewards.discount > 0) {
    rewardItems.push({
      icon: ShoppingCart,
      label: 'Discount',
      value: `${rewards.discount}%`,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/30'
    });
  }

  if (rewards.shield) {
    rewardItems.push({
      icon: Shield,
      label: 'Shield',
      value: 'Active',
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/30'
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`card w-full max-w-md shadow-2xl ${isDark ? 'bg-base-200' : 'bg-white'}`}>
        <div className="card-body">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center">
                <Gift className="w-6 h-6 text-success" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Rewards Earned!</h3>
                {stepTitle && (
                  <p className="text-sm text-gray-500">{stepTitle}</p>
                )}
                {challengeTitle && !stepTitle && (
                  <p className="text-sm text-gray-500">{challengeTitle}</p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="btn btn-ghost btn-sm btn-circle"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            {rewardItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <div
                  key={index}
                  className={`flex items-center gap-4 p-4 rounded-lg border-2 ${item.bgColor} ${item.borderColor}`}
                >
                  <div className={`p-3 rounded-full ${item.bgColor} ${item.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-600">{item.label}</div>
                    <div className={`text-xl font-bold ${item.color}`}>{item.value}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card-actions justify-end mt-6">
            <button onClick={onClose} className="btn btn-primary">
              Awesome!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RewardsModal;

