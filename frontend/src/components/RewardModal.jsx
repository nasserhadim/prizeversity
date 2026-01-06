import React from 'react';
import { Trophy, Coins, Zap, Shield, Sword, Percent, Clover, X, Users } from 'lucide-react';

const RewardModal = ({ isOpen, onClose, rewards, challengeName, allCompleted, nextChallenge }) => {
  if (!isOpen) return null;

  const hasRewards = rewards && (
    rewards.bits > 0 || 
    rewards.multiplier > 0 || 
    rewards.luck > 1.0 || 
    rewards.discount > 0 || 
    rewards.shield || 
    rewards.attackBonus > 0
  );

  // Check if multipliers were applied
  const showMultiplierInfo = rewards?.appliedPersonalMultiplier || rewards?.appliedGroupMultiplier;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full mx-auto overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-4 text-center relative">
          <button
            onClick={onClose}
            className="absolute top-2 right-2 p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <Trophy className="w-12 h-12 mx-auto mb-2" />
          <h2 className="text-xl font-bold">Challenge Completed!</h2>
          <p className="text-sm opacity-90">{challengeName}</p>
        </div>

        {/* Rewards */}
        <div className="p-4">
          {hasRewards && (
            <>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🎉</span>
                <span className="font-semibold">Rewards Earned</span>
              </div>
              
              <div className="space-y-2">
                {rewards.bits > 0 && (
                  <div className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Coins className="w-5 h-5 text-yellow-600" />
                      <span className="text-yellow-800">Bits</span>
                    </div>
                    <span className="text-yellow-600 font-bold">+{rewards.bits}</span>
                  </div>
                )}

                {/* NEW: Show multiplier breakdown if applied */}
                {showMultiplierInfo && rewards.bits > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="w-4 h-4 text-blue-600" />
                      <span className="text-blue-800 font-medium">Multipliers Applied</span>
                    </div>
                    <div className="text-blue-600 text-xs space-y-1 ml-6">
                      {rewards.baseBits && rewards.baseBits !== rewards.bits && (
                        <div>Base: {rewards.baseBits} bits</div>
                      )}
                      {rewards.appliedPersonalMultiplier && rewards.personalMultiplier > 1 && (
                        <div className="flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          Personal: ×{rewards.personalMultiplier.toFixed(2)}
                        </div>
                      )}
                      {rewards.appliedGroupMultiplier && rewards.groupMultiplier > 1 && (
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          Group: ×{rewards.groupMultiplier.toFixed(2)}
                        </div>
                      )}
                      {rewards.totalMultiplier > 1 && (
                        <div className="font-medium">Total: ×{rewards.totalMultiplier.toFixed(2)}</div>
                      )}
                    </div>
                  </div>
                )}

                {rewards.multiplier > 0 && (
                  <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-blue-600" />
                      <span className="text-blue-800">Multiplier Increase</span>
                    </div>
                    <span className="text-blue-600 font-bold">+{rewards.multiplier.toFixed(1)}</span>
                  </div>
                )}

                {rewards.luck > 1.0 && (
                  <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Clover className="w-5 h-5 text-green-600" />
                      <span className="text-green-800">Luck Bonus</span>
                    </div>
                    <span className="text-green-600 font-bold">+{((rewards.luck - 1) * 100).toFixed(0)}%</span>
                  </div>
                )}

                {rewards.discount > 0 && (
                  <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Percent className="w-5 h-5 text-purple-600" />
                      <span className="text-purple-800">Discount</span>
                    </div>
                    <span className="text-purple-600 font-bold">+{rewards.discount}%</span>
                  </div>
                )}

                {rewards.shield && (
                  <div className="flex items-center justify-between bg-cyan-50 border border-cyan-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-cyan-600" />
                      <span className="text-cyan-800">Shield Protection</span>
                    </div>
                    <span className="text-cyan-600 font-bold">ACTIVATED</span>
                  </div>
                )}

                {rewards.attackBonus > 0 && (
                  <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Sword className="w-5 h-5 text-red-600" />
                      <span className="text-red-800">Attack Bonus</span>
                    </div>
                    <span className="text-red-600 font-bold">+{rewards.attackBonus}</span>
                  </div>
                )}
              </div>
            </>
          )}

          <button
            onClick={onClose}
            className="w-full mt-4 bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default RewardModal;
