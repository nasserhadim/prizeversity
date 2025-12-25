import { useState, useContext, useEffect } from 'react';
import { Play, Check, X, ExternalLink, Download, Eye, AlertTriangle, Lock, Shield, Hash, Search, EyeOff, Key } from 'lucide-react';
import { ThemeContext } from '../../../context/ThemeContext';
import { verifyCustomChallenge, startCustomChallenge, unlockCustomChallengeHint, getCustomChallengeAttachmentUrl, getPersonalizedChallengeFileUrl } from '../../../API/apiChallenge';
import RewardsDisplay from '../RewardsDisplay';
import toast from 'react-hot-toast';

// Template type display info
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
  const [pendingExternalUrl, setPendingExternalUrl] = useState(null);
  const [generatedData, setGeneratedData] = useState(null);

  const progress = challenge.progress || {};
  const isCompleted = progress.completed || false;
  const isStarted = !!progress.startedAt;
  const isFailed = challenge.maxAttempts && progress.attempts >= challenge.maxAttempts && !isCompleted;
  const attemptsLeft = challenge.maxAttempts ? challenge.maxAttempts - (progress.attempts || 0) : null;
  
  const templateType = challenge.templateType || 'passcode';
  const isTemplateChallenge = templateType !== 'passcode';
  const templateInfo = TEMPLATE_DISPLAY[templateType] || TEMPLATE_DISPLAY.passcode;
  const TemplateIcon = templateInfo.icon;

  // Get generated content from state or from challenge data
  const displayContent = generatedData?.displayData || challenge.generatedDisplayData;

  // Auto-fetch generated content for template challenges that are started but missing content
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
          // Silent fail - will show loading state
        }
      }
    };
    fetchMissingContent();
  }, [isTemplateChallenge, isStarted, isCompleted, displayContent, generatedData, classroomId, challenge._id]);

  // Render generated challenge content based on template type
  const renderGeneratedContent = () => {
    if (!displayContent) {
      return (
        <div className="text-sm text-gray-500">
          Loading your personalized challenge content...
        </div>
      );
    }

    // Try to parse JSON content
    let parsedContent = displayContent;
    try {
      parsedContent = JSON.parse(displayContent);
    } catch {
      // Content is not JSON, display as-is
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
                <div className="text-xs text-gray-500">
                  <p><strong>Algorithm:</strong> {parsedContent.algorithm}</p>
                  {parsedContent.format && <p><strong>Format:</strong> {parsedContent.format}</p>}
                </div>
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

  const rewards = {
    bits: challenge.bits || 0,
    multiplier: challenge.multiplier > 1 ? challenge.multiplier - 1 : 0,
    luck: challenge.luck || 1.0,
    discount: challenge.discount || 0,
    shield: challenge.shield || false
  };

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
      
      // Store generated content for template challenges
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

    if (challengeExpired) {
      toast.error('Challenge series has expired');
      return;
    }

    setSubmitting(true);
    try {
      const result = await verifyCustomChallenge(classroomId, challenge._id, passcode.trim());
      
      if (result.success) {
        toast.success('Challenge completed!');
        setPasscode('');
        if (onUpdate) onUpdate();
      }
    } catch (error) {
      toast.error(error.message || 'Incorrect passcode');
      setPasscode('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlockHint = async () => {
    setUnlockingHint(true);
    try {
      const result = await unlockCustomChallengeHint(classroomId, challenge._id);
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
          <div className="flex flex-col gap-2 sm:hidden">
            <div className="flex items-center gap-2">
              <span className={`badge badge-sm gap-1 ${isCompleted ? 'badge-success' : isFailed ? 'badge-error' : `badge-${templateInfo.color}`}`}>
                <TemplateIcon className="w-3 h-3" />
                {templateInfo.name}
              </span>
              {isTemplateChallenge && !isCompleted && (
                <span className="badge badge-sm badge-outline badge-success gap-1">
                  <Shield className="w-2.5 h-2.5" />
                  Unique
                </span>
              )}
              <span className={`text-xs ${isDark ? 'text-base-content/50' : 'text-gray-400'}`}>
                {isCompleted ? 'Completed' : isFailed ? 'Failed' : isStarted ? 'In Progress' : 'Not Started'}
              </span>
            </div>
            <span className={`font-medium ${isCompleted ? 'text-green-600' : ''}`}>
              {challenge.title}
            </span>
            <RewardsDisplay rewards={rewards} isDark={isDark} isCompleted={isCompleted} size="sm" />
          </div>

          <div className="hidden sm:flex items-center gap-3">
            <span className={`badge gap-1 ${isCompleted ? 'badge-success' : isFailed ? 'badge-error' : `badge-${templateInfo.color}`}`}>
              <TemplateIcon className="w-3 h-3" />
              {templateInfo.name}
            </span>
            {isTemplateChallenge && !isCompleted && (
              <span className="badge badge-sm badge-outline badge-success gap-1">
                <Shield className="w-2.5 h-2.5" />
                Unique
              </span>
            )}
            <span className={`flex-1 font-medium ${isCompleted ? 'text-green-600' : ''}`}>
              {challenge.title}
            </span>
            <RewardsDisplay rewards={rewards} isDark={isDark} isCompleted={isCompleted} size="sm" />
            <span className={`text-sm ${isDark ? 'text-base-content/50' : 'text-gray-400'}`}>
              {isCompleted ? 'Completed' : isFailed ? 'Failed' : isStarted ? 'In Progress' : 'Not Started'}
            </span>
          </div>
        </div>

        <div className="collapse-content" onClick={(e) => e.stopPropagation()}>
          <div className="pt-4 space-y-4">
            {!isStarted && !isCompleted && (
              <div className="alert alert-warning">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">You must start this challenge before submitting answers</span>
              </div>
            )}

            <div className={`rounded-lg p-3 ${isDark ? 'bg-base-100' : 'bg-white'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium">Challenge Rewards</span>
              </div>
              <RewardsDisplay rewards={rewards} isDark={isDark} isCompleted={isCompleted} size="lg" />
            </div>

            {challenge.description && (
              <div className={`prose prose-sm max-w-none ${isDark ? 'prose-invert' : ''}`}>
                <p className="whitespace-pre-wrap">{challenge.description}</p>
              </div>
            )}

            {/* Display generated challenge content for template challenges */}
            {isTemplateChallenge && isStarted && !isCompleted && (
              <div className={`rounded-lg border-2 ${isDark ? 'bg-base-100 border-primary/30' : 'bg-gray-50 border-primary/20'}`}>
                <div className={`px-3 py-2 border-b ${isDark ? 'border-primary/30 bg-primary/10' : 'border-primary/20 bg-primary/5'}`}>
                  <div className="flex items-center gap-2">
                    <TemplateIcon className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Your Challenge Content</span>
                    <span className="badge badge-xs badge-success">Unique to you</span>
                  </div>
                </div>
                <div className="p-3">
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

            {(challenge.attachments?.length || 0) > 0 && (
              <div className="space-y-2">
                <span className="text-sm font-medium">Resources</span>
                <div className="flex flex-wrap gap-2">
                  {challenge.attachments.map(att => (
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
                </div>
              </div>
            )}

            {templateType === 'hidden-message' && isStarted && !isCompleted && !isFailed && (
              <div className="space-y-2">
                <span className="text-sm font-medium">Challenge File</span>
                <a
                  href={getPersonalizedChallengeFileUrl(classroomId, challenge._id)}
                  className="btn btn-info btn-sm gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Challenge File
                </a>
              </div>
            )}

            {!isCompleted && !isFailed && !challengeExpired && (
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
                  <p className={`text-sm ${attemptsLeft <= 1 ? 'text-error' : 'text-gray-500'}`}>
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

            {challengeExpired && !isCompleted && (
              <div className="flex items-center gap-2 text-warning">
                <Lock className="w-5 h-5" />
                <span className="font-medium">Challenge series has expired</span>
              </div>
            )}

            {challenge.hintsEnabled && isStarted && !isCompleted && !isFailed && (
              <div className="space-y-3 pt-2 border-t border-base-content/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Hints</span>
                    <span className="text-xs text-gray-500">
                      {progress.hintsUsed || 0}/{challenge.hintsCount || 0} used
                    </span>
                  </div>
                  <button
                    onClick={handleUnlockHint}
                    disabled={unlockingHint || (progress.hintsUsed || 0) >= (challenge.hintsCount || 0)}
                    className="btn btn-sm btn-primary"
                  >
                    {unlockingHint ? <span className="loading loading-spinner loading-xs"></span> : 'Unlock Hint'}
                  </button>
                </div>

                {(progress.hintsUnlocked?.length || 0) > 0 && (
                  <div className="space-y-2">
                    {progress.hintsUnlocked.map((hint, i) => (
                      <div key={i} className={`p-3 rounded-lg ${isDark ? 'bg-blue-900/20 border border-blue-700/50' : 'bg-blue-50 border border-blue-200'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <Eye className="w-4 h-4 text-blue-500" />
                          <span className="text-sm font-medium text-blue-600">Hint {i + 1}</span>
                        </div>
                        <p className="text-sm">{hint}</p>
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
    </>
  );
};

export default CustomChallengeCard;

