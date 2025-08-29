import React, { useState } from 'react';
import { Play, Eye, AlertTriangle } from 'lucide-react';
import { getChallengeColors } from '../../../utils/themeUtils';
import { calculatePotentialBits } from '../../../utils/challengeUtils';
import { unlockHint, startChallenge } from '../../../API/apiChallenge';
import { CHALLENGE_IDS } from '../../../constants/challengeConstants';
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
  const isChallengeStarted = userChallenge?.currentChallenge === challengeIndex || isCompleted;
  
  const challengeId = CHALLENGE_IDS[challengeIndex];
  
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
          : colors.cardBg 
      }`}>
      <input type="checkbox" defaultChecked={false} className="peer" />
      
      <div className="collapse-title text-xl font-medium flex items-center gap-3">
        <div className={`badge badge-lg ${
          isCompleted ? 'badge-success' : 'badge-primary' 
        }`}>
          Challenge {challengeIndex + 1}
        </div>
        
        <span className={
          isCompleted 
            ? colors.completedText 
            : colors.textColor 
        }>
          {challengeIcon} {challengeName}
        </span>
        
        <div className={`badge badge-outline badge-sm ${
          userChallenge?.hintsUsed?.[challengeIndex] > 0 ? 'badge-warning' : ''
        }`}>
          {calculatePotentialBits(challengeIndex, challengeData, userChallenge)} bits
          {userChallenge?.hintsUsed?.[challengeIndex] > 0 && (
            <span className="ml-1 text-xs opacity-75">
              (-{userChallenge.hintsUsed[challengeIndex] * (challengeData?.settings?.hintPenaltyPercent || 25)}%)
            </span>
          )}
        </div>
        
        <div className={`ml-auto text-sm ${isDark ? 'text-base-content/50' : 'text-gray-400'}`}>
          {isCompleted 
            ? '✅ Completed' 
            : isChallengeStarted 
              ? '🔓 In Progress'
              : '⏳ Not Started' 
          }
        </div>
      </div>
      
      <div className="collapse-content" onClick={(e) => e.stopPropagation()}>
        <div className="pt-4 space-y-4">
          {!isChallengeStarted && (
            <div className="alert alert-warning">
              <div className="flex items-center gap-2">
                <span className="text-sm">⚠️ You must start this challenge before accessing external resources</span>
              </div>
            </div>
          )}

          {challengeData?.settings?.challengeHintsEnabled?.[challengeIndex] && (
            <div className="flex items-center gap-3">
              <span className="badge badge-outline">Hints enabled</span>
              <span className="text-xs text-gray-500">
                Penalty {challengeData.settings.hintPenaltyPercent || 25}% each
              </span>
            </div>
          )}
          
          <p className={`${isDark ? 'text-gray-200' : 'text-gray-600'}`}>
            {challengeDescription}
          </p>

          <div className="flex items-center gap-3">
            {!isCompleted && !isChallengeStarted && challengeIndex !== 2 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleStartChallenge();
                }}
                className="btn btn-primary btn-sm gap-2"
              >
                <Play className="w-4 h-4" />
                Start Challenge
              </button>
            )}
            {isChallengeStarted && !isCompleted && (
              <div className="badge badge-success gap-2">
                <Play className="w-3 h-3" />
                Working on this challenge
              </div>
            )}
          </div>
          
          {challengeData?.settings?.challengeHintsEnabled?.[challengeIndex] && (
            <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Hints Available</span>
                  <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                    {(userChallenge?.hintsUsed?.[challengeIndex] || 0)}/{challengeData.settings.maxHintsPerChallenge ?? 2} used
                  </span>
                </div>
                <button
                  className="btn btn-sm btn-primary"
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
              
              <div className={`text-sm font-medium ${isDark ? 'text-orange-300' : 'text-orange-600'} flex items-center gap-2`}>
                <span>💰 Cost: -{challengeData.settings.hintPenaltyPercent || 25}% per hint</span>
                <span className="text-xs bg-orange-100 dark:bg-orange-900/20 px-2 py-1 rounded">
                  -{Math.floor((challengeData?.settings?.challengeBits?.[challengeIndex] || 0) * (challengeData.settings.hintPenaltyPercent || 25) / 100)} bits each
                </span>
              </div>

              {userChallenge?.hintsUnlocked?.[challengeIndex]?.length > 0 && (
                <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Your Hints:</span>
                    <Eye className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="space-y-3">
                    {userChallenge.hintsUnlocked[challengeIndex].map((hint, i) => (
                      <div key={i} className={`${isDark ? 'bg-gray-800 border-blue-400' : 'bg-white border-blue-500'} border-2 rounded-lg p-4 shadow-md`} onClick={(e) => e.stopPropagation()}>
                        <div className={`text-sm font-bold ${isDark ? 'text-blue-300' : 'text-blue-600'} mb-3`}>💡 Hint #{i + 1}</div>
                        <div className={`text-lg ${isDark ? 'text-gray-100' : 'text-black'} leading-relaxed whitespace-pre-wrap font-semibold`}>{hint}</div>
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
        <div className={`card w-full max-w-md shadow-2xl ${isDark ? 'bg-base-200' : 'bg-white'}`}>
          <div className="card-body text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-warning/20 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-warning" />
              </div>
            </div>
            
            <div>
              <h3 className="text-xl font-bold mb-2">Start Challenge?</h3>
              <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                If you navigate to this site, it will mark <strong>Challenge {challengeIndex + 1}: {challengeName}</strong> as "In Progress".
              </p>
            </div>

            <div className={`p-3 rounded-lg ${isDark ? 'bg-info/20 border border-info/40' : 'bg-blue-50 border border-blue-200'}`}>
              <p className={`text-xs ${isDark ? 'text-info' : 'text-blue-700'}`}>
                💡 This will officially start your challenge timer and track your progress.
              </p>
            </div>

            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={handleCancelStart}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmStart}
                className="btn btn-primary btn-sm gap-2"
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