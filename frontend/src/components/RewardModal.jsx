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
      <div className="bg-white rounded-2xl max-w-md w-full mx-4 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6 text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <Trophy className="w-16 h-16 mx-auto mb-4 animate-bounce" />
          <h2 className="text-2xl font-bold mb-2">Challenge Completed!</h2>
          <p className="text-green-100">{challengeName}</p>
        </div>

        {/* Rewards */}
        <div className="p-6">
          {hasRewards ? (
            <>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">
                🎉 Rewards Earned
              </h3>
              <div className="space-y-3">
                {rewards.bits > 0 && (
                  <div className="flex items-center justify-between bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                    <div className="flex items-center gap-3">
                      <Coins className="w-6 h-6 text-yellow-600" />
                      <span className="font-medium text-gray-800">Bits</span>
                    </div>
                    <span className="text-xl font-bold text-yellow-600">+{rewards.bits}</span>
                  </div>
                )}

                {rewards.multiplier > 0 && (
                  <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-3">
                      <Zap className="w-6 h-6 text-blue-600" />
                      <span className="font-medium text-gray-800">Multiplier Bonus</span>
                    </div>
                    <span className="text-xl font-bold text-blue-600">{(rewards.multiplier + 1).toFixed(1)}x</span>
                  </div>
                )}

                {rewards.luck > 1.0 && (
                  <div className="flex items-center justify-between bg-green-50 p-3 rounded-lg border border-green-200">
                    <div className="flex items-center gap-3">
                      <Clover className="w-6 h-6 text-green-600" />
                      <span className="font-medium text-gray-800">Luck Multiplier</span>
                    </div>
                    <span className="text-xl font-bold text-green-600">x{rewards.luck.toFixed(1)}</span>
                  </div>
                )}

                {rewards.discount > 0 && (
                  <div className="flex items-center justify-between bg-purple-50 p-3 rounded-lg border border-purple-200">
                    <div className="flex items-center gap-3">
                      <Percent className="w-6 h-6 text-purple-600" />
                      <span className="font-medium text-gray-800">Shop Discount</span>
                    </div>
                    <span className="text-xl font-bold text-purple-600">+{rewards.discount}%</span>
                  </div>
                )}

                {rewards.shield && (
                  <div className="flex items-center justify-between bg-cyan-50 p-3 rounded-lg border border-cyan-200">
                    <div className="flex items-center gap-3">
                      <Shield className="w-6 h-6 text-cyan-600" />
                      <span className="font-medium text-gray-800">Shield Protection</span>
                    </div>
                    <span className="text-lg font-bold text-cyan-600">ACTIVATED</span>
                  </div>
                )}

                {rewards.attackBonus > 0 && (
                  <div className="flex items-center justify-between bg-red-50 p-3 rounded-lg border border-red-200">
                    <div className="flex items-center gap-3">
                      <Sword className="w-6 h-6 text-red-600" />
                      <span className="font-medium text-gray-800">Attack Power</span>
                    </div>
                    <span className="text-xl font-bold text-red-600">+{rewards.attackBonus}</span>
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
                <p className="text-lg font-semibold text-green-600 mb-2">
                  🎊 All Challenges Completed!
                </p>
                <p className="text-gray-600">Congratulations on completing the entire challenge series!</p>
              </div>
            ) : null}
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-full mt-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-green-600 hover:to-emerald-700 transition-all duration-200 transform hover:scale-105"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default RewardModal;
