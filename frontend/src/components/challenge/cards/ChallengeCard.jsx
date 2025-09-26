import React, { useState } from 'react';
import { Play, Eye, AlertTriangle } from 'lucide-react';
import { getChallengeColors } from '../../../utils/themeUtils';
import { getRewardDataForChallenge } from '../../../utils/challengeUtils';
import { unlockHint, startChallenge } from '../../../API/apiChallenge';
import { CHALLENGE_IDS, CHALLENGE_NAMES } from '../../../constants/challengeConstants';
import RewardsDisplay from '../RewardsDisplay';
import toast from 'react-hot-toast';

const ChallengeCard = ({ 
  challengeIndex,
  challengeName,
  challengeIcon,
  challengeDescription,
  userChallenge,
  challengeData,
  isDark,
  unlockingHint,
  setUnlockingHint,
  fetchChallengeData,
  classroomId,
  onHintUnlocked,
  children
}) => {
  const [showStartModal, setShowStartModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  
  const colors = getChallengeColors(challengeIndex, isDark);
  const isCompleted = userChallenge?.completedChallenges?.[challengeIndex] || false;
  const isChallengeStarted = (userChallenge?.currentChallenge !== undefined && userChallenge?.currentChallenge === challengeIndex) || isCompleted;
  
  const isFailed = (() => {
    if (isCompleted) return false;
    
    if (challengeIndex === 2) {
      const maxAttempts = userChallenge?.challenge3MaxAttempts || 5;
      const maxAttemptsReached = (userChallenge?.challenge3Attempts || 0) >= maxAttempts;
      
      let timeExpired = false;
      if (userChallenge?.challenge3StartTime) {
        const startTime = new Date(userChallenge.challenge3StartTime);
        const currentTime = new Date();
        const timeElapsed = (currentTime - startTime) / (1000 * 60);
        timeExpired = timeElapsed > 120;
      }
      
      return maxAttemptsReached || timeExpired;
    } else if (challengeIndex === 5) {
      return (userChallenge?.challenge6Attempts || 0) >= 3;
    } else if (challengeIndex === 6) {
      return (userChallenge?.challenge7Attempts || 0) >= 3;
    }
    
    return false;
  })();
  
  const challengeId = CHALLENGE_IDS[challengeIndex];
  const rewardData = getRewardDataForChallenge(challengeIndex, challengeData, userChallenge, CHALLENGE_NAMES);
  const challengeRewards = rewardData?.rewards;
  
  const handleUnlockHint = async () => {
    try {
      setUnlockingHint(prev => ({ ...prev, [challengeId]: true }));
      const res = await unlockHint(classroomId, challengeId);
      if (res.success) {
        if (res.hint && onHintUnlocked) {
          onHintUnlocked(res.hint, challengeName, res.hintsUsed || 1);
        }
        await fetchChallengeData();
      } else {
        toast.error(res.message || 'Unable to unlock hint');
      }
    } catch (e) {
      toast.error(e.message || 'Unable to unlock hint');
    } finally {
      setUnlockingHint(prev => ({ ...prev, [challengeId]: false }));
    }
  };

  const handleStartChallenge = async () => {
    try {
      const res = await startChallenge(classroomId, challengeIndex);
      if (res.success) {
        toast.success('Challenge started!');
        await fetchChallengeData();
      } else {
        toast.error(res.message || 'Unable to start challenge');
      }
    } catch (e) {
      toast.error(e.message || 'Unable to start challenge');
    }
  };

  // Enhanced click handler for challenge content
  const handleChallengeContentClick = async (e, isExternalLink = false) => {
    // If challenge is already started or completed, allow normal behavior
    if (isChallengeStarted) {
      return;
    }

    // If it's an external link and challenge hasn't started, show confirmation
    if (isExternalLink) {
      e.preventDefault();
      e.stopPropagation();
      
      // Store the navigation details for later
      setPendingNavigation({
        href: e.target.href,
        target: e.target.target || '_blank'
      });
      setShowStartModal(true);
    }
  };

  const handleConfirmStart = async () => {
    try {
      const res = await startChallenge(classroomId, challengeIndex);
      if (res.success) {
        toast.success('Challenge started!');
        await fetchChallengeData();
        
        // Navigate to the pending URL
        if (pendingNavigation) {
          window.open(pendingNavigation.href, pendingNavigation.target);
        }
      } else {
        toast.error(res.message || 'Unable to start challenge');
      }
    } catch (error) {
      toast.error(error.message || 'Unable to start challenge');
    } finally {
      setShowStartModal(false);
      setPendingNavigation(null);
    }
  };

  const handleCancelStart = () => {
    setShowStartModal(false);
    setPendingNavigation(null);
  };

  // Wrap children with click handler
  const enhancedChildren = children && React.cloneElement(children, {
    onExternalLinkClick: handleChallengeContentClick
  });

  return (
    <>
      <div className={`collapse collapse-arrow ${
        isCompleted 
          ? colors.completedBg 
          : isFailed 
            ? isDark ? 'bg-red-900/20 border border-red-800' : 'bg-red-50 border border-red-200'
            : colors.cardBg 
      }`}>
      <input type="checkbox" defaultChecked={false} className="peer" />
      
      {/* Mobile-first responsive header */}
      <div className="collapse-title">
        {/* Mobile layout - stacked vertically */}
        <div className="flex flex-col gap-2 sm:hidden">
          <div className="flex items-center gap-2">
            <div className={`badge badge-sm ${
              isCompleted ? 'badge-success' : isFailed ? 'badge-error' : 'badge-primary' 
            }`}>
              Challenge {challengeIndex + 1}
            </div>
            <div className={`text-xs ${isDark ? 'text-base-content/50' : 'text-gray-400'}`}>
              {isCompleted 
                ? '✅ Completed' 
                : isFailed 
                  ? '❌ Failed'
                : isChallengeStarted 
                  ? '🔓 In Progress'
                  : '⏳ Not Started' 
              }
            </div>
          </div>
          
          <div className={`text-base font-medium ${
            isCompleted 
              ? colors.completedText 
              : colors.textColor 
          }`}>
            <span className="mr-2">{challengeIcon}</span>
            {challengeName}
          </div>
          
          <div className="flex flex-wrap gap-1">
            <RewardsDisplay 
              rewards={challengeRewards} 
              isDark={isDark} 
              isCompleted={isCompleted}
              size="sm"
            />
            {userChallenge?.hintsUsed?.[challengeIndex] > 0 && (
              <div className="badge badge-warning badge-xs">
                -{userChallenge.hintsUsed[challengeIndex] * (challengeData?.settings?.hintPenaltyPercent || 25)}% hints
              </div>
            )}
          </div>
        </div>

        {/* Desktop layout - horizontal */}
        <div className="hidden sm:flex items-center gap-3 text-lg font-medium">
          <div className={`badge badge-lg ${
            isCompleted ? 'badge-success' : isFailed ? 'badge-error' : 'badge-primary' 
          }`}>
            Challenge {challengeIndex + 1}
          </div>
          
          <span className={`flex-1 ${
            isCompleted 
              ? colors.completedText 
              : colors.textColor 
          }`}>
            {challengeIcon} {challengeName}
          </span>
          
          <div className="flex items-center gap-2">
            <RewardsDisplay 
              rewards={challengeRewards} 
              isDark={isDark} 
              isCompleted={isCompleted}
              size="sm"
            />
            {userChallenge?.hintsUsed?.[challengeIndex] > 0 && (
              <div className="badge badge-warning badge-xs">
                -{userChallenge.hintsUsed[challengeIndex] * (challengeData?.settings?.hintPenaltyPercent || 25)}% hints
              </div>
            )}
          </div>
          
          <div className={`text-sm ${isDark ? 'text-base-content/50' : 'text-gray-400'}`}>
            {isCompleted 
              ? '✅ Completed' 
              : isFailed 
                ? '❌ Failed'
              : isChallengeStarted 
                ? '🔓 In Progress'
                : '⏳ Not Started' 
            }
          </div>
        </div>
      </div>
      
      <div className="collapse-content" onClick={(e) => e.stopPropagation()}>
        <div className="pt-4 space-y-4 px-2 sm:px-0">
          {!isChallengeStarted && (
            <div className="alert alert-warning p-3 sm:p-4">
              <div className="flex items-start gap-2">
                <span className="text-sm leading-relaxed">⚠️ You must start this challenge before accessing external resources</span>
              </div>
            </div>
          )}

          <div className="bg-base-200 rounded-lg p-3 sm:p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Challenge Rewards</span>
              </div>
              <RewardsDisplay 
                rewards={challengeRewards} 
                isDark={isDark} 
                isCompleted={isCompleted}
                size="lg"
              />
              {userChallenge?.hintsUsed?.[challengeIndex] > 0 && (
                <div className="text-xs text-orange-600 dark:text-orange-400">
                  ⚠️ Hints used: {userChallenge.hintsUsed[challengeIndex]} 
                  (reducing rewards by {userChallenge.hintsUsed[challengeIndex] * (challengeData?.settings?.hintPenaltyPercent || 25)}%)
                </div>
              )}
            </div>
          </div>

          {challengeData?.settings?.challengeHintsEnabled?.[challengeIndex] && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <span className="badge badge-outline text-xs">Hints enabled</span>
              <span className="text-xs text-gray-500">
                Penalty {challengeData.settings.hintPenaltyPercent || 25}% each
              </span>
            </div>
          )}
          
          <p className={`text-sm sm:text-base leading-relaxed ${isDark ? 'text-gray-200' : 'text-gray-600'}`}>
            {challengeDescription}
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {!isCompleted && !isChallengeStarted && !isFailed && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleStartChallenge();
                }}
                className="btn btn-primary btn-sm gap-2 w-full sm:w-auto"
              >
                <Play className="w-4 h-4" />
                Start Challenge
              </button>
            )}
            {isChallengeStarted && !isCompleted && !isFailed && (
              <div className="badge badge-success gap-2 w-full sm:w-auto justify-center sm:justify-start">
                <Play className="w-3 h-3" />
                Working on this challenge
              </div>
            )}
            {isFailed && (
              <div className="badge badge-error gap-2 w-full sm:w-auto justify-center sm:justify-start">
                <AlertTriangle className="w-3 h-3" />
                Challenge Failed
              </div>
            )}
          </div>
          
          {challengeData?.settings?.challengeHintsEnabled?.[challengeIndex] && (
            <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                  <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Hints Available</span>
                  <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                    {(userChallenge?.hintsUsed?.[challengeIndex] || 0)}/{challengeData.settings.maxHintsPerChallenge ?? 2} used
                  </span>
                </div>
                <button
                  className="btn btn-sm btn-primary w-full sm:w-auto"
                  disabled={
                    unlockingHint[challengeId] || 
                    ((userChallenge?.hintsUsed?.[challengeIndex] || 0) >= (challengeData.settings.maxHintsPerChallenge ?? 2))
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleUnlockHint();
                  }}
                >
                  {unlockingHint[challengeId] ? 'Unlocking...' : '💡 Unlock Hint'}
                </button>
              </div>
              
              <div className={`text-sm font-medium ${isDark ? 'text-orange-300' : 'text-orange-600'} space-y-2`}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                  <span>💰 Cost: -{challengeData.settings.hintPenaltyPercent || 25}% per hint</span>
                  <span className="text-xs bg-orange-100 dark:bg-orange-900/20 px-2 py-1 rounded w-fit">
                    -{Math.floor((challengeData?.settings?.challengeBits?.[challengeIndex] || 0) * (challengeData.settings.hintPenaltyPercent || 25) / 100)} bits each
                  </span>
                </div>
              </div>

              {userChallenge?.hintsUnlocked?.[challengeIndex]?.length > 0 && (
                <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Your Hints:</span>
                    <Eye className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="space-y-3">
                    {userChallenge.hintsUnlocked[challengeIndex].map((hint, i) => (
                      <div key={i} className={`${isDark ? 'bg-gray-800 border-blue-400' : 'bg-white border-blue-500'} border-2 rounded-lg p-3 sm:p-4 shadow-md`} onClick={(e) => e.stopPropagation()}>
                        <div className={`text-sm font-bold ${isDark ? 'text-blue-300' : 'text-blue-600'} mb-2 sm:mb-3`}>💡 Hint #{i + 1}</div>
                        <div className={`text-base sm:text-lg ${isDark ? 'text-gray-100' : 'text-black'} leading-relaxed whitespace-pre-wrap font-medium sm:font-semibold`}>{hint}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div onClick={(e) => e.stopPropagation()}>
            {enhancedChildren}
          </div>
        </div>
      </div>
    </div>

    {/* Start Challenge Confirmation Modal */}
    {showStartModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className={`card w-full max-w-md mx-4 shadow-2xl ${isDark ? 'bg-base-200' : 'bg-white'}`}>
          <div className="card-body text-center space-y-4 p-4 sm:p-6">
            <div className="flex justify-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-warning/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 text-warning" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg sm:text-xl font-bold">Start Challenge?</h3>
              <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                If you navigate to this site, it will mark <strong>Challenge {challengeIndex + 1}: {challengeName}</strong> as "In Progress".
              </p>
            </div>

            <div className={`p-3 rounded-lg ${isDark ? 'bg-info/20 border border-info/40' : 'bg-blue-50 border border-blue-200'}`}>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-info' : 'text-blue-700'}`}>
                💡 This will officially start your challenge timer and track your progress.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:gap-3 sm:justify-center pt-2">
              <button
                onClick={handleCancelStart}
                className="btn btn-ghost btn-sm order-2 sm:order-1"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmStart}
                className="btn btn-primary btn-sm gap-2 order-1 sm:order-2"
              >
                <Play className="w-4 h-4" />
                Start & Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default ChallengeCard;