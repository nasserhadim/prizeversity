import { Play } from 'lucide-react';
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
      
      <div className="collapse-content">
        <div className="pt-4 space-y-4">
          {challengeData?.settings?.challengeHintsEnabled?.[challengeIndex] && (
            <div className="flex items-center gap-3">
              <span className="badge badge-outline">Hints enabled</span>
              <span className="text-xs text-gray-500">
                Penalty {challengeData.settings.hintPenaltyPercent || 25}% each
              </span>
            </div>
          )}
          
          <p className={isDark ? 'text-base-content/70' : 'text-gray-600'}>
            {challengeDescription}
          </p>

          <div className="flex items-center gap-3">
            {!isCompleted && userChallenge?.currentChallenge !== challengeIndex && challengeIndex !== 2 && (
              <button
                onClick={handleStartChallenge}
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
            <div className="flex items-start gap-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="badge badge-outline">Hints</span>
                <span className="text-xs text-gray-500">
                  -{challengeData.settings.hintPenaltyPercent || 25}% each
                </span>
                <span className="text-xs text-gray-500">
                  {(userChallenge?.hintsUsed?.[challengeIndex] || 0)}/{challengeData.settings.maxHintsPerChallenge ?? 2}
                </span>
                <div className="flex flex-col items-center gap-1">
                  <button
                    className="btn btn-xs btn-primary"
                    disabled={
                      unlockingHint[challengeId] || 
                      ((userChallenge?.hintsUsed?.[challengeIndex] || 0) >= (challengeData.settings.maxHintsPerChallenge ?? 2))
                    }
                    onClick={handleUnlockHint}
                  >
                    {unlockingHint[challengeId] ? '...' : 'Unlock'}
                  </button>
                  {((userChallenge?.hintsUsed?.[challengeIndex] || 0) < (challengeData.settings.maxHintsPerChallenge ?? 2)) && (
                    <span className="text-xs text-warning">
                      -{Math.floor((challengeData?.settings?.challengeBits?.[challengeIndex] || 0) * (challengeData.settings.hintPenaltyPercent || 25) / 100)} bits
                    </span>
                  )}
                </div>
              </div>
              {userChallenge?.hintsUnlocked?.[challengeIndex]?.length > 0 && (
                <ul className="ml-2 list-disc text-xs text-gray-700">
                  {userChallenge.hintsUnlocked[challengeIndex].map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          
          {children}
        </div>
      </div>
    </div>
  );
};

export default ChallengeCard;