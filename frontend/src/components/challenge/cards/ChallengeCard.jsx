import { Play, Eye } from 'lucide-react';
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
  const colors = getChallengeColors(challengeIndex, isDark);
  const isCompleted = userChallenge?.completedChallenges?.[challengeIndex] || false;
  
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

  return (
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
            : '🔓 Available' 
          }
        </div>
      </div>
      
      <div className="collapse-content" onClick={(e) => e.stopPropagation()}>
        <div className="pt-4 space-y-4">
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
            {!isCompleted && userChallenge?.currentChallenge !== challengeIndex && challengeIndex !== 2 && (
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
            {userChallenge?.currentChallenge === challengeIndex && !isCompleted && (
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
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChallengeCard;