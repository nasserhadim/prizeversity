import React from 'react';
import { Trophy, Coins, Zap, Shield, Sword, Percent, Clover, X } from 'lucide-react';

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full mx-auto overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-4 text-center relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-white hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <Trophy className="w-12 h-12 mx-auto mb-2 animate-bounce" />
          <h2 className="text-xl font-bold mb-1">Challenge Completed!</h2>
          <p className="text-green-100 text-sm">{challengeName}</p>
        </div>

        {/* Rewards */}
        <div className="p-4">
          {hasRewards ? (
            <>
              <h3 className="text-base font-semibold text-gray-800 mb-3 text-center">
                🎉 Rewards Earned
              </h3>
              <div className="space-y-2">
                {rewards.bits > 0 && (
                  <div className="flex items-center justify-between bg-yellow-50 p-2 rounded-lg border border-yellow-200">
                    <div className="flex items-center gap-2">
                      <Coins className="w-5 h-5 text-yellow-600" />
                      <span className="font-medium text-gray-800 text-sm">Bits</span>
                    </div>
                    <span className="text-base font-bold text-yellow-600">+{rewards.bits}</span>
                  </div>
                )}

                {rewards.multiplier > 0 && (
                  <div className="flex items-center justify-between bg-blue-50 p-2 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-blue-600" />
                      <span className="font-medium text-gray-800 text-sm">Multiplier Increase</span>
                    </div>
                    <span className="text-base font-bold text-blue-600">+{rewards.multiplier.toFixed(1)}</span>
                  </div>
                )}

                {rewards.luck > 1.0 && (
                  <div className="flex items-center justify-between bg-green-50 p-2 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2">
                      <Clover className="w-5 h-5 text-green-600" />
                      <span className="font-medium text-gray-800 text-sm">Luck Bonus</span>
                    </div>
                    <span className="text-base font-bold text-green-600">+{Math.round((rewards.luck - 1) * 100)}%</span>
                  </div>
                )}

                {rewards.discount > 0 && (
                  <div className="flex items-center justify-between bg-purple-50 p-2 rounded-lg border border-purple-200">
                    <div className="flex items-center gap-2">
                      <Percent className="w-5 h-5 text-purple-600" />
                      <span className="font-medium text-gray-800 text-sm">Shop Discount</span>
                    </div>
                    <span className="text-base font-bold text-purple-600">+{rewards.discount}%</span>
                  </div>
                )}

                {rewards.shield && (
                  <div className="flex items-center justify-between bg-cyan-50 p-2 rounded-lg border border-cyan-200">
                    <div className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-cyan-600" />
                      <span className="font-medium text-gray-800 text-sm">Shield Protection</span>
                    </div>
                    <span className="text-sm font-bold text-cyan-600">ACTIVATED</span>
                  </div>
                )}

                {rewards.attackBonus > 0 && (
                  <div className="flex items-center justify-between bg-red-50 p-2 rounded-lg border border-red-200">
                    <div className="flex items-center gap-2">
                      <Sword className="w-5 h-5 text-red-600" />
                      <span className="font-medium text-gray-800 text-sm">Attack Power</span>
                    </div>
                    <span className="text-base font-bold text-red-600">+{rewards.attackBonus}</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-600">Challenge completed successfully!</p>
              <p className="text-sm text-gray-500 mt-2">No additional rewards for this challenge.</p>
            </div>
          )}

          {/* Progress Info */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            {allCompleted ? (
              <div className="text-center">
              </div>
            ) : null}
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-full mt-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 px-4 font-semibold hover:from-green-600 hover:to-emerald-700 transition-all duration-200"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default RewardModal;
