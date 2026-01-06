import { useState, useContext, useEffect, useRef } from 'react';
import { Play, Check, X, ExternalLink, Download, Eye, AlertTriangle, Lock, Unlock, Hash, Search, EyeOff, Key, Layers, ChevronRight, Gift, Coins, TrendingUp, Zap, ShoppingCart, Shield } from 'lucide-react';
import { ThemeContext } from '../../../context/ThemeContext';
import { verifyCustomChallenge, startCustomChallenge, unlockCustomChallengeHint, getCustomChallengeAttachmentUrl, getPersonalizedChallengeFileUrl, startCustomChallengeStep, verifyCustomChallengeStep, unlockCustomChallengeStepHint } from '../../../API/apiChallenge';
import RewardsDisplay from '../RewardsDisplay';
import RewardsModal from '../RewardsModal';
import DueDateCountdown from '../DueDateCountdown';
import toast from 'react-hot-toast';

const TEMPLATE_DISPLAY = {
  'passcode': { name: 'Passcode', icon: Key, color: 'warning' },
  'cipher': { name: 'Cipher', icon: Lock, color: 'primary' },
  'hash': { name: 'Hash', icon: Hash, color: 'secondary' },
  'hidden-message': { name: 'Hidden Message', icon: EyeOff, color: 'info' },
  'pattern-find': { name: 'Pattern Find', icon: Search, color: 'success' }
};

const CustomChallengeCard = ({
  challenge,
  classroomId,
  onUpdate,
  isTeacher = false,
  challengeExpired = false
}) => {
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'dark';
  
  const [passcode, setPasscode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [unlockingHint, setUnlockingHint] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showHintModal, setShowHintModal] = useState(false);
  const [showRewardsModal, setShowRewardsModal] = useState(false);
  const [earnedRewards, setEarnedRewards] = useState(null);
  const [rewardStepTitle, setRewardStepTitle] = useState(null);
  const [pendingUpdate, setPendingUpdate] = useState(false);
  
  useEffect(() => {
    if (showRewardsModal) {
      window.__modalOpen = true;
    } else {
      window.__modalOpen = false;
    }
    return () => {
      window.__modalOpen = false;
    };
  }, [showRewardsModal]);
  const [pendingExternalUrl, setPendingExternalUrl] = useState(null);
  const [generatedData, setGeneratedData] = useState(null);
  const [localAttemptsLeft, setLocalAttemptsLeft] = useState(null);
  
  const [activeStepId, setActiveStepId] = useState(null);
  const [stepPasscodes, setStepPasscodes] = useState({});
  const [stepGeneratedData, setStepGeneratedData] = useState({});
  const [stepLocalAttemptsLeft, setStepLocalAttemptsLeft] = useState({});
  const [locallyStartedSteps, setLocallyStartedSteps] = useState({});
  const [locallyCompletedSteps, setLocallyCompletedSteps] = useState({});
  const [startingSteps, setStartingSteps] = useState({});
  const [locallyStartedChallenge, setLocallyStartedChallenge] = useState(false);
  const startingStepsRef = useRef(new Set());

  const normalizeId = (id) => {
    if (!id) return id;
    return typeof id === 'object' && typeof id.toString === 'function' ? id.toString() : id;
  };

  const isMultiStep = challenge.isMultiStep && (challenge.steps?.length || 0) > 0;
  const progress = challenge.progress || {};
  const isCompleted = isMultiStep ? progress.completed || false : progress.completed || false;
  const isStarted = !!progress.startedAt || (isMultiStep && locallyStartedChallenge) || (isMultiStep && Object.keys(locallyStartedSteps).length > 0);
  const serverAttemptsLeft = challenge.maxAttempts ? challenge.maxAttempts - (progress.attempts || 0) : null;
  const attemptsLeft = localAttemptsLeft !== null ? localAttemptsLeft : serverAttemptsLeft;
  const isFailed = challenge.maxAttempts && attemptsLeft !== null && attemptsLeft <= 0 && !isCompleted;
  
  useEffect(() => {
    setLocalAttemptsLeft(null);
  }, [challenge.progress?.attempts]);
  
  useEffect(() => {
    if (isMultiStep && challenge.steps) {
      const serverStartedSteps = {};
      const serverCompletedSteps = {};
      
      challenge.steps.forEach(step => {
        if (step.progress?.startedAt) {
          serverStartedSteps[normalizeId(step._id)] = true;
        }
        if (step.progress?.completed) {
          serverCompletedSteps[normalizeId(step._id)] = true;
        }
      });
      
      setLocallyStartedSteps(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(stepId => {
          if (serverStartedSteps[stepId]) {
            delete updated[stepId];
          }
        });
        return updated;
      });
      
      setLocallyCompletedSteps(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(stepId => {
          if (serverCompletedSteps[stepId]) {
            delete updated[stepId];
          }
        });
        return updated;
      });
      
        setStartingSteps(prev => {
          const updated = { ...prev };
          Object.keys(updated).forEach(stepId => {
            if (serverStartedSteps[stepId]) {
              delete updated[stepId];
              startingStepsRef.current.delete(stepId);
            }
          });
          return updated;
        });
      
      if (progress?.startedAt) {
        setLocallyStartedChallenge(false);
      }
    }
  }, [challenge.steps, isMultiStep, progress?.startedAt]);
  
  const customChallengeExpired = challenge.dueDateEnabled && challenge.dueDate 
    ? new Date() > new Date(challenge.dueDate) 
    : false;
  const isExpired = challengeExpired || customChallengeExpired;
  
  const templateType = challenge.templateType || 'passcode';
  const isTemplateChallenge = templateType !== 'passcode';
  const templateInfo = TEMPLATE_DISPLAY[templateType] || TEMPLATE_DISPLAY.passcode;
  const TemplateIcon = templateInfo.icon;
  
  // Compute hintsCount from hints array if not provided
  const hintsCount = challenge.hintsCount ?? (challenge.hints?.length || 0);

  
  const displayContent = generatedData?.displayData || challenge.generatedDisplayData;

  
  useEffect(() => {
    const fetchMissingContent = async () => {
      if (isTemplateChallenge && isStarted && !isCompleted && !displayContent && !generatedData) {
        try {
          const result = await startCustomChallenge(classroomId, challenge._id);
          if (result.displayData) {
            setGeneratedData({
              displayData: result.displayData,
              metadata: result.metadata
            });
          }
        } catch {
          
        }
      }
    };
    fetchMissingContent();
  }, [isTemplateChallenge, isStarted, isCompleted, displayContent, generatedData, classroomId, challenge._id]);

  
  const renderGeneratedContent = () => {
    if (!displayContent) {
      return (
        <div className="text-sm text-gray-500">
          Loading your personalized challenge content...
        </div>
      );
    }

    
    let parsedContent = displayContent;
    try {
      parsedContent = JSON.parse(displayContent);
    } catch {
      
    }

    switch (templateType) {
      case 'cipher':
        return (
          <div className="space-y-2">
            <p className="text-sm">Decrypt this message to find your answer:</p>
            <div className={`font-mono text-lg p-3 rounded ${isDark ? 'bg-base-300' : 'bg-white'} break-all`}>
              {displayContent}
            </div>
          </div>
        );

      case 'hash':
        return (
          <div className="space-y-2">
            {typeof parsedContent === 'object' && parsedContent.hash ? (
              <>
                <p className="text-sm">Crack this hash to find the code:</p>
                <div className={`font-mono text-sm p-3 rounded ${isDark ? 'bg-base-300' : 'bg-white'} break-all`}>
                  {parsedContent.hash}
                </div>
                {parsedContent.format && (
                  <div className="text-xs text-gray-500">
                    <p><strong>Format:</strong> {parsedContent.format}</p>
                  </div>
                )}
              </>
            ) : (
              <div className={`font-mono text-sm p-3 rounded ${isDark ? 'bg-base-300' : 'bg-white'}`}>
                {displayContent}
              </div>
            )}
          </div>
        );

      case 'hidden-message':
        return (
          <div className="space-y-2">
            {typeof parsedContent === 'object' ? (
              <>
                <p className="text-sm">
                  {parsedContent.instructions || 'Download the challenge file and examine its metadata.'}
                </p>
                {parsedContent.format && (
                  <p className="text-xs text-gray-500"><strong>Answer format:</strong> {parsedContent.format}</p>
                )}
                {parsedContent.filename && (
                  <p className="text-xs text-gray-500"><strong>Filename:</strong> {parsedContent.filename}</p>
                )}
              </>
            ) : (
              <div className={`text-sm p-3 rounded ${isDark ? 'bg-base-300' : 'bg-white'}`}>
                {displayContent}
              </div>
            )}
          </div>
        );

      case 'pattern-find':
        return (
          <div className="space-y-2">
            <p className="text-sm">Find the hidden pattern in the text below:</p>
            {typeof parsedContent === 'object' && parsedContent.document ? (
              <div className={`font-mono text-xs p-3 rounded max-h-48 overflow-y-auto ${isDark ? 'bg-base-300' : 'bg-white'}`}>
                <pre className="whitespace-pre-wrap">{parsedContent.document}</pre>
              </div>
            ) : (
              <div className={`font-mono text-xs p-3 rounded max-h-48 overflow-y-auto ${isDark ? 'bg-base-300' : 'bg-white'}`}>
                <pre className="whitespace-pre-wrap">{displayContent}</pre>
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className={`text-sm p-3 rounded ${isDark ? 'bg-base-300' : 'bg-white'}`}>
            {displayContent}
          </div>
        );
    }
  };

  const baseBits = challenge.bits || 0;
  const hintsUsed = progress.hintsUsed || 0;
  const hintPenaltyPercent = challenge.hintPenaltyPercent || 0;
  const totalPenalty = Math.min(80, hintsUsed * hintPenaltyPercent);
  const effectiveBits = hintsUsed > 0 && hintPenaltyPercent > 0
    ? Math.round(baseBits * (1 - totalPenalty / 100))
    : baseBits;

  const rewards = (() => {
    if (isMultiStep && challenge.steps?.length) {
      let totalBits = 0;
      let maxMultiplier = 0;
      let maxLuck = 1.0;
      let maxDiscount = 0;
      let hasShield = false;
      
      challenge.steps.forEach(step => {
        totalBits += Number(step.bits || 0);
        if (step.multiplier > 1) {
          maxMultiplier = Math.max(maxMultiplier, step.multiplier - 1);
        }
        if (step.luck > 1) {
          maxLuck = Math.max(maxLuck, step.luck);
        }
        maxDiscount = Math.max(maxDiscount, Number(step.discount || 0));
        if (step.shield) hasShield = true;
      });
      
      // Add completion bonus to total bits
      totalBits += Number(challenge.completionBonus || 0);
      
      return {
        bits: totalBits,
        baseBits: totalBits,
        multiplier: maxMultiplier,
        luck: maxLuck,
        discount: maxDiscount,
        shield: hasShield,
        hintPenalty: 0
      };
    }
    
    return {
      bits: effectiveBits,
      baseBits: baseBits,
      multiplier: challenge.multiplier > 1 ? challenge.multiplier - 1 : 0,
      luck: challenge.luck || 1.0,
      discount: challenge.discount || 0,
      shield: challenge.shield || false,
      hintPenalty: hintsUsed > 0 && hintPenaltyPercent > 0 ? totalPenalty : 0
    };
  })();

  const getCardColors = () => {
    if (isCompleted) {
      return isDark ? 'bg-green-900/20 border-green-700/50' : 'bg-green-50 border-green-200';
    }
    if (isFailed) {
      return isDark ? 'bg-red-900/20 border-red-700/50' : 'bg-red-50 border-red-200';
    }
    return isDark ? 'bg-base-300 border-base-content/10' : 'bg-base-200 border-base-300';
  };

  const handleStart = async () => {
    try {
      const result = await startCustomChallenge(classroomId, challenge._id);
      
      
      if (result.displayData) {
        setGeneratedData({
          displayData: result.displayData,
          metadata: result.metadata
        });
      }
      
      if (onUpdate) onUpdate();
      
      if (pendingExternalUrl) {
        window.open(pendingExternalUrl, '_blank');
        setPendingExternalUrl(null);
      }
      setShowStartModal(false);
    } catch (error) {
      toast.error(error.message || 'Failed to start challenge');
    }
  };

  const handleExternalLinkClick = (e, url) => {
    if (!isStarted && !isCompleted) {
      e.preventDefault();
      setPendingExternalUrl(url);
      setShowStartModal(true);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!passcode.trim()) {
      toast.error('Please enter a passcode');
      return;
    }

    if (isExpired) {
      toast.error('This challenge has expired');
      return;
    }

    setSubmitting(true);
    try {
      const result = await verifyCustomChallenge(classroomId, challenge._id, passcode.trim());
      
      if (result.success) {
        localStorage.setItem('challengeCompleted', JSON.stringify({
          challengeIndex: -1, 
          challengeName: challenge.title,
          timestamp: Date.now(),
          rewards: result.rewards || {
            bits: challenge.bits || 0,
            multiplier: challenge.multiplier > 1 ? challenge.multiplier - 1 : 0,
            luck: challenge.luck || 1.0,
            discount: challenge.discount || 0,
            shield: challenge.shield || false
          },
          allCompleted: result.allCompleted || false,
          nextChallenge: null,
          needsRewards: false
        }));
        
        setPasscode('');
        if (onUpdate) onUpdate();
      }
    } catch (error) {
      toast.error(error.message || 'Incorrect passcode');
      setPasscode('');
      if (error.attemptsLeft !== undefined) {
        setLocalAttemptsLeft(error.attemptsLeft);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleHintClick = () => {
    setShowHintModal(true);
  };

  const handleConfirmUnlockHint = async () => {
    setUnlockingHint(true);
    try {
      const result = await unlockCustomChallengeHint(classroomId, challenge._id);
      if (result.success && result.hint) {
        toast.success('Hint unlocked!');
        setShowHintModal(false);
        if (onUpdate) onUpdate();
      }
    } catch (error) {
      toast.error(error.message || 'Failed to unlock hint');
    } finally {
      setUnlockingHint(false);
    }
  };

  const handleStartStep = async (rawStepId) => {
    const stepId = normalizeId(rawStepId);
    // Use ref for synchronous check to prevent double-clicks
    if (startingStepsRef.current.has(stepId)) {
      return;
    }
    
    // Check if already started
    const step = challenge.steps?.find(s => normalizeId(s._id) === stepId);
    if (step?.progress?.startedAt || locallyStartedSteps[stepId]) {
      return;
    }
    
    // Mark as starting immediately (synchronous)
    startingStepsRef.current.add(stepId);
    
    // Update state for UI
    setStartingSteps(prev => ({ ...prev, [stepId]: true }));
    setLocallyStartedSteps(prev => ({ ...prev, [stepId]: true }));
    if (isMultiStep && !progress.startedAt) {
      setLocallyStartedChallenge(true);
    }
    
    try {
      const result = await startCustomChallengeStep(classroomId, challenge._id, stepId);
      if (result.success) {
        if (result.displayData) {
          setStepGeneratedData(prev => ({
            ...prev,
            [stepId]: { displayData: result.displayData, metadata: result.metadata }
          }));
        }
        setActiveStepId(stepId);
        toast.success('Step started!');
        startingStepsRef.current.delete(stepId);
        setStartingSteps(prev => {
          const updated = { ...prev };
          delete updated[stepId];
          return updated;
        });
        setTimeout(async () => {
          if (onUpdate) {
            await onUpdate();
          }
        }, 300);
      } else {
        startingStepsRef.current.delete(stepId);
        setLocallyStartedSteps(prev => {
          const updated = { ...prev };
          delete updated[stepId];
          return updated;
        });
        if (isMultiStep && locallyStartedChallenge) {
          setLocallyStartedChallenge(false);
        }
        setStartingSteps(prev => {
          const updated = { ...prev };
          delete updated[stepId];
          return updated;
        });
        toast.error(result.message || 'Failed to start step');
      }
    } catch (error) {
      startingStepsRef.current.delete(stepId);
      setLocallyStartedSteps(prev => {
        const updated = { ...prev };
        delete updated[stepId];
        return updated;
      });
      if (isMultiStep && locallyStartedChallenge) {
        setLocallyStartedChallenge(false);
      }
      setStartingSteps(prev => {
        const updated = { ...prev };
        delete updated[stepId];
        return updated;
      });
      toast.error(error.message || 'Failed to start step');
    }
  };

  const handleStepSubmit = async (e, stepId) => {
    e.preventDefault();
    const stepPasscode = stepPasscodes[stepId] || '';
    
    if (!stepPasscode.trim()) {
      toast.error('Please enter a passcode');
      return;
    }

    if (isExpired) {
      toast.error('This challenge has expired');
      return;
    }

    const stepProgress = challenge.steps?.find(s => s._id === stepId)?.progress;
    const isStepStarted = stepProgress?.startedAt || locallyStartedSteps[stepId];
    
    if (!isStepStarted) {
      toast.error('Please start this step first');
      return;
    }

    setSubmitting(true);
    try {
      const result = await verifyCustomChallengeStep(classroomId, challenge._id, stepId, stepPasscode.trim());
      
      if (result.success) {
        const step = challenge.steps.find(s => s._id === stepId);
        toast.success(result.allRequiredComplete ? 'Challenge completed!' : 'Step completed!');
        
        if (result.rewards) {
          const hasAnyRewards = 
            (result.rewards.bits > 0) || 
            (result.rewards.multiplier > 0) || 
            (result.rewards.luck > 0) || 
            (result.rewards.discount > 0) || 
            (result.rewards.shield === true);
          
          if (hasAnyRewards) {
            setEarnedRewards(result.rewards);
            setRewardStepTitle(step?.title || null);
            setShowRewardsModal(true);
          }
        }
        
        if (result.allRequiredComplete && result.completionBonusAwarded > 0) {
          localStorage.setItem('challengeCompleted', JSON.stringify({
            challengeIndex: -1,
            challengeName: challenge.title,
            timestamp: Date.now(),
            rewards: {
              bits: result.completionBonusAwarded,
              multiplier: 0,
              luck: 1.0,
              discount: 0,
              shield: false
            },
            allCompleted: true
          }));
        }
        
        setLocallyCompletedSteps(prev => ({ ...prev, [stepId]: true }));
        setStepPasscodes(prev => ({ ...prev, [stepId]: '' }));
        setActiveStepId(null);
        
        if (result.rewards && (result.rewards.bits > 0 || result.rewards.multiplier > 0 || result.rewards.luck > 0 || result.rewards.discount > 0 || result.rewards.shield === true)) {
          setPendingUpdate(true);
        } else {
          if (onUpdate) {
            await onUpdate();
          }
        }
      }
    } catch (error) {
      if (error.message && error.message.includes('start this step first')) {
        if (onUpdate) {
          await onUpdate();
        }
      }
      toast.error(error.message || 'Incorrect passcode');
      setStepPasscodes(prev => ({ ...prev, [stepId]: '' }));
      if (error.attemptsLeft !== undefined) {
        setStepLocalAttemptsLeft(prev => ({ ...prev, [stepId]: error.attemptsLeft }));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleStepHintUnlock = async (stepId) => {
    setUnlockingHint(true);
    try {
      const result = await unlockCustomChallengeStepHint(classroomId, challenge._id, stepId);
      if (result.success && result.hint) {
        toast.success('Hint unlocked!');
        if (onUpdate) onUpdate();
      }
    } catch (error) {
      toast.error(error.message || 'Failed to unlock hint');
    } finally {
      setUnlockingHint(false);
    }
  };

  const getStepStatus = (step) => {
    const stepProgress = step.progress;
    if (stepProgress?.completed || locallyCompletedSteps[step._id]) return 'completed';
    if (step.isUnlocked === false) return 'locked';
    if (stepProgress?.startedAt || locallyStartedSteps[step._id]) return 'in_progress';
    return 'available';
  };

  const nextHintsUsed = (progress.hintsUsed || 0) + 1;
  const nextTotalPenalty = Math.min(80, nextHintsUsed * hintPenaltyPercent);
  const bitsAfterNextHint = hintPenaltyPercent > 0
    ? Math.round(baseBits * (1 - nextTotalPenalty / 100))
    : baseBits;

  if (!challenge.visible && !isTeacher) {
    return (
      <div className={`collapse collapse-arrow ${isDark ? 'bg-base-300/50' : 'bg-base-200/50'} opacity-70`}>
        <input type="checkbox" className="peer" defaultChecked={false} />
        <div className="collapse-title flex items-center gap-2">
          <span className="badge badge-ghost badge-sm">Custom</span>
          <span className={`font-medium ${isDark ? 'text-base-content/70' : 'text-gray-500'}`}>
            {challenge.title}
          </span>
          <span className="text-sm text-gray-400 ml-auto">Hidden</span>
        </div>
        <div className="collapse-content">
          <p className="text-sm text-gray-500">This challenge is temporarily unavailable.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`collapse collapse-arrow border ${getCardColors()}`}>
        <input type="checkbox" className="peer" defaultChecked={false} />
        
        <div className="collapse-title">
          <div className="flex flex-col gap-2 sm:hidden min-w-0">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              {isMultiStep ? (
                <span className={`badge badge-sm gap-1 ${isCompleted ? 'badge-success' : isFailed ? 'badge-error' : 'badge-primary'}`}>
                  <Layers className="w-3 h-3" />
                  {challenge.steps.length} Steps
                </span>
              ) : (
                <span className={`badge badge-sm gap-1 ${isCompleted ? 'badge-success' : isFailed ? 'badge-error' : `badge-${templateInfo.color}`}`}>
                  <TemplateIcon className="w-3 h-3" />
                  {templateInfo.name}
                </span>
              )}
              <span className={`text-xs ${isDark ? 'text-base-content/50' : 'text-gray-400'}`}>
                {isCompleted ? 'Completed' : isFailed ? 'Failed' : isStarted ? 'In Progress' : 'Not Started'}
              </span>
            </div>

            {}
            <span className={`font-medium min-w-0 wrap-any ${isCompleted ? 'text-success' : ''}`}>
              {challenge.title}
            </span>

            <RewardsDisplay 
              rewards={rewards} 
              isDark={isDark} 
              isCompleted={isCompleted} 
              size="sm"
              showMultiplierIndicator={true}
              applyPersonalMultiplier={challenge.applyPersonalMultiplier}
              applyGroupMultiplier={challenge.applyGroupMultiplier}
            />
            
            {challenge.dueDateEnabled && challenge.dueDate && (
              <DueDateCountdown dueDate={challenge.dueDate} />
            )}
          </div>

          {}
          <div className="hidden sm:flex items-center gap-3 flex-wrap min-w-0">
            {isMultiStep ? (
              <span className={`badge gap-1 ${isCompleted ? 'badge-success' : isFailed ? 'badge-error' : 'badge-primary'}`}>
                <Layers className="w-3 h-3" />
                {challenge.completedStepsCount || 0}/{challenge.steps.length} Steps
              </span>
            ) : (
              <span className={`badge gap-1 ${isCompleted ? 'badge-success' : isFailed ? 'badge-error' : `badge-${templateInfo.color}`}`}>
                <TemplateIcon className="w-3 h-3" />
                {templateInfo.name}
              </span>
            )}

            {}
            <span className={`flex-1 min-w-0 font-medium wrap-any ${isCompleted ? 'text-success' : ''}`}>
              {challenge.title}
            </span>

            <RewardsDisplay 
              rewards={rewards} 
              isDark={isDark} 
              isCompleted={isCompleted} 
              size="sm"
              showMultiplierIndicator={true}
              applyPersonalMultiplier={challenge.applyPersonalMultiplier}
              applyGroupMultiplier={challenge.applyGroupMultiplier}
            />

            <span className={`text-sm ${isDark ? 'text-base-content/50' : 'text-gray-400'}`}>
              {isCompleted ? 'Completed' : isFailed ? 'Failed' : isStarted ? 'In Progress' : 'Not Started'}
            </span>
            
            {challenge.dueDateEnabled && challenge.dueDate && (
              <DueDateCountdown dueDate={challenge.dueDate} />
            )}
          </div>
        </div>

        <div className="collapse-content" onClick={(e) => e.stopPropagation()}>
          <div className="pt-4 space-y-4">
            {!isMultiStep && !isStarted && !isCompleted && (
              
              <div className="alert alert-warning">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span className="text-sm wrap-any">You must start this challenge before submitting answers</span>
                </div>
              </div>
            )}

            {isMultiStep ? (
              challenge.completionBonus > 0 && (
                <div className={`rounded-lg p-4 ${isDark ? 'bg-base-100' : 'bg-base-200'}`}>
                  <div className="flex items-center gap-2">
                    <Gift className="w-4 h-4 text-warning" />
                    <span className="opacity-70">Completion Bonus:</span>
                    <span className="font-medium">{challenge.completionBonus} bits</span>
                  </div>
                </div>
              )
            ) : (
              <div className={`rounded-lg p-4 ${isDark ? 'bg-base-100' : 'bg-base-200'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-medium">Challenge Rewards</span>
                </div>
                <RewardsDisplay 
                  rewards={rewards} 
                  isDark={isDark} 
                  isCompleted={isCompleted} 
                  size="lg"
                  showMultiplierIndicator={true}
                  applyPersonalMultiplier={challenge.applyPersonalMultiplier}
                  applyGroupMultiplier={challenge.applyGroupMultiplier}
                />
              </div>
            )}
              <div className="prose prose-sm max-w-none">
                {}
                <p className={`whitespace-pre-wrap wrap-any ${isDark ? 'text-base-content' : 'text-gray-700'}`}>
                  {challenge.description}
                </p>
              </div>
            

            {isMultiStep && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    Challenge Steps
                  </span>
                  <span className="text-xs opacity-70">
                    {challenge.completedStepsCount || 0} of {challenge.steps.length} completed
                  </span>
                </div>
                
                <div className="space-y-2">
                  {challenge.steps.map((step, stepIndex) => {
                    const stepStatus = getStepStatus(step);
                    const stepProgress = step.progress;
                    const isStepActive = activeStepId === step._id;
                    const stepTemplateType = step.templateType || 'passcode';
                    const stepIsTemplate = stepTemplateType !== 'passcode';
                    const StepIcon = TEMPLATE_DISPLAY[stepTemplateType]?.icon || Key;
                    
                    const stepServerAttemptsLeft = step.maxAttempts ? step.maxAttempts - (stepProgress?.attempts || 0) : null;
                    const stepAttemptsLeft = stepLocalAttemptsLeft[step._id] !== undefined ? stepLocalAttemptsLeft[step._id] : stepServerAttemptsLeft;
                    const isStepFailed = step.maxAttempts && stepAttemptsLeft !== null && stepAttemptsLeft <= 0 && stepStatus !== 'completed';

                    return (
                      <div 
                        key={step._id} 
                        className={`rounded-lg border ${
                          stepStatus === 'completed' ? (isDark ? 'bg-success/10 border-success/30' : 'bg-success/5 border-success/20') :
                          stepStatus === 'locked' ? (isDark ? 'bg-base-300/50 border-base-content/10 opacity-60' : 'bg-gray-100 border-gray-200 opacity-60') :
                          isStepFailed ? (isDark ? 'bg-error/10 border-error/30' : 'bg-error/5 border-error/20') :
                          isStepActive ? (isDark ? 'bg-primary/10 border-primary/30' : 'bg-primary/5 border-primary/20') :
                          (isDark ? 'bg-base-100 border-base-content/10' : 'bg-white border-gray-200')
                        }`}
                      >
                        <div className="p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {stepStatus === 'completed' ? (
                                <Check className="w-4 h-4 text-success shrink-0" />
                              ) : stepStatus === 'locked' ? (
                                <Lock className="w-4 h-4 opacity-50 shrink-0" />
                              ) : isStepFailed ? (
                                <X className="w-4 h-4 text-error shrink-0" />
                              ) : (
                                <span className="badge badge-sm badge-outline">{stepIndex + 1}</span>
                              )}
                              <span className={`font-medium text-sm truncate ${stepStatus === 'completed' ? 'text-success' : stepStatus === 'locked' ? 'opacity-50' : ''}`}>
                                {step.title}
                              </span>
                              {!step.isRequired && (
                                <span className="badge badge-ghost badge-xs">Optional</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                              {step.bits > 0 && (
                                <span className={`flex items-center gap-1 text-xs ${stepStatus === 'completed' ? 'text-success' : 'opacity-70'}`} title="Bits">
                                  <Coins className="w-3 h-3" />
                                  {step.bits} ₿
                                </span>
                              )}
                              {step.multiplier > 1 && (
                                <span className={`flex items-center gap-1 text-xs ${stepStatus === 'completed' ? 'text-success' : 'opacity-70'}`} title="Multiplier">
                                  <TrendingUp className="w-3 h-3" />
                                  +{(step.multiplier - 1).toFixed(1)}x
                                </span>
                              )}
                              {step.luck > 1 && (
                                <span className={`flex items-center gap-1 text-xs ${stepStatus === 'completed' ? 'text-success' : 'opacity-70'}`} title="Luck">
                                  <Zap className="w-3 h-3" />
                                  +{(step.luck - 1).toFixed(1)}
                                </span>
                              )}
                              {step.discount > 0 && (
                                <span className={`flex items-center gap-1 text-xs ${stepStatus === 'completed' ? 'text-success' : 'opacity-70'}`} title="Discount">
                                  <ShoppingCart className="w-3 h-3" />
                                  -{step.discount}%
                                </span>
                              )}
                              {step.shield && (
                                <span className={`flex items-center gap-1 text-xs ${stepStatus === 'completed' ? 'text-success' : 'opacity-70'}`} title="Shield">
                                  <Shield className="w-3 h-3" />
                                </span>
                              )}
                              {stepStatus === 'locked' && (
                                <span className="text-xs opacity-50">Locked</span>
                              )}
                              {stepStatus === 'completed' && (
                                <span className="badge badge-success badge-sm">Done</span>
                              )}
                              {isStepFailed && (
                                <span className="badge badge-error badge-sm">Failed</span>
                              )}
                            </div>
                          </div>

                          {step.description && stepStatus !== 'locked' && (
                            <p className="text-xs mt-2 opacity-70">{step.description}</p>
                          )}

                          {stepStatus === 'locked' && step.prerequisites?.length > 0 && (
                            <div className="text-xs mt-2 opacity-50">
                              Complete required steps first
                            </div>
                          )}

                          {stepStatus !== 'locked' && stepStatus !== 'completed' && !isStepFailed && !isExpired && (
                            <div className="mt-3 space-y-2">
                              {!stepProgress?.startedAt && !locallyStartedSteps[step._id] && !startingSteps[step._id] && !startingStepsRef.current.has(step._id) ? (
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleStartStep(step._id);
                                  }}
                                  disabled={startingStepsRef.current.has(step._id)}
                                  className="btn btn-primary btn-xs gap-1"
                                >
                                  <Play className="w-3 h-3" />
                                  Start Step
                                </button>
                              ) : startingSteps[step._id] || startingStepsRef.current.has(step._id) || (locallyStartedSteps[step._id] && !stepProgress?.startedAt) ? (
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="loading loading-spinner loading-xs" />
                                  <span className="text-xs opacity-70">Starting step...</span>
                                </div>
                              ) : (
                                <>
                                  {stepIsTemplate && (stepGeneratedData[step._id]?.displayData || step.generatedDisplayData) && (
                                    <div className={`p-2 rounded text-xs ${isDark ? 'bg-base-300' : 'bg-gray-100'}`}>
                                      <div className="flex items-center gap-1 mb-1 font-medium">
                                        <StepIcon className="w-3 h-3" />
                                        Content
                                      </div>
                                      <div className="font-mono break-all">
                                        {stepGeneratedData[step._id]?.displayData || step.generatedDisplayData}
                                      </div>
                                    </div>
                                  )}
                                  
                                  <form onSubmit={(e) => handleStepSubmit(e, step._id)} className="flex gap-2">
                                    <input
                                      type="text"
                                      className="input input-bordered input-sm flex-1"
                                      value={stepPasscodes[step._id] || ''}
                                      onChange={(e) => setStepPasscodes(prev => ({ ...prev, [step._id]: e.target.value }))}
                                      placeholder="Enter passcode"
                                      disabled={submitting}
                                    />
                                    <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                                      {submitting ? <span className="loading loading-spinner loading-xs" /> : <ChevronRight className="w-4 h-4" />}
                                    </button>
                                  </form>

                                  <div className="flex items-center gap-2 text-xs">
                                    {step.maxAttempts && (
                                      <span className={stepAttemptsLeft <= 1 ? 'text-error' : 'opacity-70'}>
                                        {stepAttemptsLeft} attempt{stepAttemptsLeft !== 1 ? 's' : ''} left
                                      </span>
                                    )}
                                    {step.hintsEnabled && step.hintsCount > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => handleStepHintUnlock(step._id)}
                                        disabled={unlockingHint || (stepProgress?.hintsUsed || 0) >= step.hintsCount}
                                        className="btn btn-ghost btn-xs gap-1"
                                      >
                                        {unlockingHint ? <span className="loading loading-spinner loading-xs" /> : '💡'}
                                        {(stepProgress?.hintsUsed || 0)}/{step.hintsCount}
                                      </button>
                                    )}
                                  </div>

                                  {stepProgress?.hintsUnlocked?.length > 0 && (
                                    <div className={`p-2 rounded text-xs ${isDark ? 'bg-warning/10' : 'bg-warning/5'}`}>
                                      {stepProgress.hintsUnlocked.map((hint, i) => (
                                        <div key={i}>💡 {hint}</div>
                                      ))}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {}
            {!isMultiStep && isTemplateChallenge && isStarted && !isCompleted && (
              <div className={`rounded-lg border ${isDark ? 'bg-base-100 border-base-content/20' : 'bg-base-200 border-base-300'}`}>
                <div className={`px-4 py-3 border-b ${isDark ? 'border-base-content/10' : 'border-base-300'}`}>
                  <div className="flex items-center gap-2">
                    <TemplateIcon className="w-4 h-4" />
                    <span className="text-sm font-medium">Challenge Content</span>
                  </div>
                </div>
                <div className="p-4">
                  {renderGeneratedContent()}
                </div>
              </div>
            )}

            {challenge.externalUrl && (
              <a
                href={challenge.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => handleExternalLinkClick(e, challenge.externalUrl)}
                className="btn btn-outline btn-sm gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Open Challenge Site
              </a>
            )}

            {((challenge.attachments?.length || 0) > 0 || (templateType === 'hidden-message' && isStarted && !isCompleted && !isFailed)) && (
              <div className="space-y-2">
                <span className="text-sm font-medium">Resources</span>
                <div className="flex flex-wrap gap-2">
                  {challenge.attachments?.map(att => (
                    <a
                      key={att._id}
                      href={getCustomChallengeAttachmentUrl(classroomId, challenge._id, att._id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost btn-sm gap-2"
                    >
                      <Download className="w-4 h-4" />
                      {att.originalName}
                    </a>
                  ))}
                  {templateType === 'hidden-message' && isStarted && !isCompleted && !isFailed && (
                    <a
                      href={getPersonalizedChallengeFileUrl(classroomId, challenge._id)}
                      className="btn btn-info btn-sm gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Challenge File
                    </a>
                  )}
                </div>
              </div>
            )}

            {!isMultiStep && !isCompleted && !isFailed && !isExpired && (
              <div className="space-y-3">
                {!isStarted && (
                  <button onClick={handleStart} className="btn btn-primary btn-sm gap-2">
                    <Play className="w-4 h-4" />
                    Start Challenge
                  </button>
                )}

                {isStarted && (
                  <form onSubmit={handleSubmit} className="flex gap-2">
                    <input
                      type="text"
                      className="input input-bordered flex-1"
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value)}
                      placeholder="Enter passcode"
                      disabled={submitting}
                    />
                    <button type="submit" className="btn btn-primary" disabled={submitting || !passcode.trim()}>
                      {submitting ? <span className="loading loading-spinner loading-sm"></span> : <Check className="w-4 h-4" />}
                    </button>
                  </form>
                )}

                {attemptsLeft !== null && (
                  <p className={`text-sm ${attemptsLeft <= 1 ? 'text-error' : isDark ? 'text-base-content/60' : 'text-gray-500'}`}>
                    {attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} remaining
                  </p>
                )}
              </div>
            )}

            {isCompleted && (
              <div className="flex items-center gap-2 text-success">
                <Check className="w-5 h-5" />
                <span className="font-medium">Challenge Completed!</span>
              </div>
            )}

            {isFailed && (
              <div className="flex items-center gap-2 text-error">
                <X className="w-5 h-5" />
                <span className="font-medium">Maximum attempts reached</span>
              </div>
            )}

            {isExpired && !isCompleted && (
              <div className="flex items-center gap-2 text-warning">
                <Lock className="w-5 h-5" />
                <span className="font-medium">Challenge has expired</span>
              </div>
            )}

            {!isMultiStep && challenge.hintsEnabled && isStarted && !isCompleted && !isFailed && hintsCount > 0 && (
              <div className="space-y-3 pt-2 border-t border-base-content/10">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Hints</span>
                    <span className="text-xs text-gray-500">
                      {progress.hintsUsed || 0}/{hintsCount} used
                    </span>
                    {challenge.hintPenaltyPercent > 0 && (
                      <span className="text-xs text-warning">
                        (-{challenge.hintPenaltyPercent}% per hint)
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleHintClick}
                    disabled={unlockingHint || (progress.hintsUsed || 0) >= hintsCount}
                    className="btn btn-sm btn-primary"
                  >
                    Unlock Hint
                  </button>
                </div>

                {rewards.hintPenalty > 0 && (
                  <div className="text-xs text-warning">
                    Hint penalty: {baseBits} → {effectiveBits} bits (-{rewards.hintPenalty}%)
                  </div>
                )}

                {(progress.hintsUnlocked?.length || 0) > 0 && (
                  <div className="space-y-2">
                    {progress.hintsUnlocked.map((hint, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-lg border ${isDark ? 'bg-info/10 border-info/30' : 'bg-info/5 border-info/20'}`}
                      >
                        <div className="flex items-center gap-2 mb-1 min-w-0">
                          <Eye className="w-4 h-4 shrink-0" />
                          <div className="text-sm font-semibold">Hint {i + 1}</div>
                        </div>

                        {/* FIX: allow long/unbroken strings to wrap instead of overflowing */}
                        <div className={`text-sm ${isDark ? 'text-base-content' : 'text-gray-700'} whitespace-pre-wrap wrap-any min-w-0`}>
                          {hint}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showStartModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`card w-full max-w-md shadow-2xl ${isDark ? 'bg-base-200' : 'bg-white'}`}>
            <div className="card-body text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-12 h-12 rounded-full bg-warning/20 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-warning" />
                </div>
              </div>
              
              <h3 className="text-lg font-bold">Start Challenge?</h3>
              <p className="text-sm text-gray-500">
                Navigating to this site will mark <strong>{challenge.title}</strong> as "In Progress".
              </p>

              <div className="flex justify-center gap-3">
                <button onClick={() => { setShowStartModal(false); setPendingExternalUrl(null); }} className="btn btn-ghost">
                  Cancel
                </button>
                <button onClick={handleStart} className="btn btn-primary gap-2">
                  <Play className="w-4 h-4" />
                  Start & Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showHintModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`card w-full max-w-md shadow-2xl ${isDark ? 'bg-base-200' : 'bg-white'}`}>
            <div className="card-body text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-12 h-12 rounded-full bg-info/20 flex items-center justify-center">
                  <Eye className="w-6 h-6 text-info" />
                </div>
              </div>
              
              <h3 className="text-lg font-bold">Unlock Hint?</h3>
              
              <div className="space-y-2">
                <p className="text-sm text-gray-500">
                  This will be hint <strong>{(progress.hintsUsed || 0) + 1}</strong> of <strong>{hintsCount}</strong>.
                </p>
                
                {hintPenaltyPercent > 0 ? (
                  <div className={`p-3 rounded-lg ${isDark ? 'bg-warning/10' : 'bg-warning/5'} border border-warning/30`}>
                    <p className="text-sm text-warning font-medium">
                      ⚠️ Penalty: -{hintPenaltyPercent}% bits
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Reward will change: {effectiveBits} → {bitsAfterNextHint} bits
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-success">✓ No penalty for using hints</p>
                )}
              </div>

              <div className="flex justify-center gap-3">
                <button 
                  onClick={() => setShowHintModal(false)} 
                  className="btn btn-ghost"
                  disabled={unlockingHint}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmUnlockHint} 
                  className="btn btn-info gap-2"
                  disabled={unlockingHint}
                >
                  {unlockingHint ? (
                    <span className="loading loading-spinner loading-sm"></span>
                  ) : (
                    <>
                      <Eye className="w-4 h-4" />
                      Unlock Hint
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRewardsModal && earnedRewards && (
        <RewardsModal
          isOpen={showRewardsModal}
          onClose={async () => {
            setShowRewardsModal(false);
            setEarnedRewards(null);
            setRewardStepTitle(null);
            
            if (pendingUpdate && onUpdate) {
              setPendingUpdate(false);
              await onUpdate();
            }
          }}
          rewards={earnedRewards}
          stepTitle={rewardStepTitle}
          challengeTitle={challenge.title}
          isDark={isDark}
        />
      )}
    </>
  );
};

export default CustomChallengeCard;

