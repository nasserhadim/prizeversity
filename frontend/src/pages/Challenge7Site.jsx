import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Coins, Zap, Shield, Percent, Clover, Target, Lightbulb } from 'lucide-react';

const Challenge7Site = () => {
  const { uniqueId } = useParams();
  const [challengeData, setChallengeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedWord, setSelectedWord] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [rewardData, setRewardData] = useState(null);
  const [revealedWords, setRevealedWords] = useState(new Set());
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [blockedWords, setBlockedWords] = useState(new Set());

  const fetchChallengeData = async (retryCount = 0) => {
    try {
      const response = await fetch(`/api/challenges/challenge7/${uniqueId}?t=${Date.now()}`, {
        credentials: 'include',
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.isCompleted) {
            setError('Challenge already completed');
            return;
          }
          
          setChallengeData(data);
          
          if (data.totalAttempts !== undefined) {
            setTotalAttempts(data.totalAttempts);
            
            if (data.totalAttempts >= 3) {
              setError('Challenge failed - maximum attempts reached');
              return;
            }
          }
          
          if (data.challenge7Progress?.revealedWords) {
            setRevealedWords(new Set(data.challenge7Progress.revealedWords));
            
            const revealedCount = data.challenge7Progress.revealedWords.length;
            const totalCount = data.words?.length || 0;

            if (revealedCount >= totalCount && totalCount > 0) {
              setIsSuccess(true);
            } else if (revealedCount > 0) {
              setSubmitMessage(`📥 Previous progress restored: ${revealedCount}/${totalCount} words revealed`);
            }
          } else {
          }
        } else if (response.status === 401) {
          setError('Challenge failed - maximum attempts reached');
        } else {
          setError('Failed to load challenge data');
        }
      } catch (err) {
        setError('Connection error');
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    if (uniqueId && !challengeData) {
      fetchChallengeData();
    }
  }, [uniqueId, challengeData]);

  const handleWordSelect = (word) => {
    const wordLower = word.toLowerCase();
    if (!revealedWords.has(wordLower) && totalAttempts < 3) {
      setSelectedWord(word);
      setSubmitMessage('');
    }
  };

  const handleSubmit = async () => {
    if (!selectedWord || !tokenInput.trim() || submitting) return;
    
    setSubmitting(true);
    setSubmitMessage('');
    
    try {
      const userTokens = tokenInput.trim()
        .split(',')
        .map(t => t.trim())
        .filter(t => t)
        .map(t => parseInt(t, 10))
        .filter(t => !isNaN(t));
      
      if (userTokens.length === 0) {
        setSubmitMessage('❌ Please enter valid numbers');
        setSubmitting(false);
        return;
      }
      
      const response = await fetch(`/api/challenges/submit-challenge7`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          uniqueId: uniqueId,
          word: selectedWord,
          tokenIds: userTokens
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSubmitMessage(result.message);
        setRevealedWords(prev => new Set([...prev, selectedWord.toLowerCase()]));
        setSelectedWord('');
        setTokenInput('');
        
        if (challengeData && result.revealedWordsCount !== undefined && result.totalWordsCount !== undefined) {
          setChallengeData(prev => ({
            ...prev,
            challenge7Progress: {
              revealedWords: [...(prev.challenge7Progress?.revealedWords || []), selectedWord.toLowerCase()].filter((word, index, arr) => arr.indexOf(word) === index),
              totalWords: result.totalWordsCount
            }
          }));
        }
        
        if (result.isCompletelyFinished) {
          setRewardData(result.rewards);
          setIsSuccess(true);
        } else {
          const saveMessage = `💾 Progress saved: ${result.revealedWordsCount}/${result.totalWordsCount} words revealed`;
          setTimeout(() => {
            setSubmitMessage(prev => prev + ` • ${saveMessage}`);
          }, 1000);
          
          setTimeout(async () => {
            try {
              const oldData = challengeData;
              setChallengeData(null); 
              await fetchChallengeData();
            } catch (error) {
              console.error('Error refreshing challenge data');
            }
          }, 500);
        }
        } else if (result.maxAttemptsReached) {
          setSubmitMessage(`❌ CHALLENGE FAILED - Maximum attempts reached. No more submissions allowed.`);
          setError('Challenge failed - maximum attempts reached');
        } else {
          if (result.totalAttempts !== undefined) {
            setTotalAttempts(result.totalAttempts);
          }
          
          const attemptsText = result.attemptsRemaining !== undefined ? 
            ` (${result.attemptsRemaining} attempts remaining)` : '';
          setSubmitMessage(`❌ Incorrect value for "${selectedWord}". Try again.${attemptsText}`);
        }
    } catch (error) {
      setSubmitMessage('⚠️ Connection error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isSuccess && selectedWord) {
      handleSubmit();
    }
  };

  const handleReturnToPrizeversity = () => {
    localStorage.setItem('challengeCompleted', JSON.stringify({
      challengeIndex: 6,
      challengeName: 'Hangman',
      timestamp: Date.now(),
      rewards: rewardData || {
        bits: 0,
        multiplier: 0,
        luck: 1.0,
        discount: 0,
        shield: false
      },
      allCompleted: isSuccess,
      nextChallenge: null
    }));
    
    try {
      window.close();
      setTimeout(() => {
        const challengeUrl = document.referrer || '/challenges';
        window.location.href = challengeUrl;
      }, 100);
    } catch (error) {
      const challengeUrl = document.referrer || '/challenges';
      window.location.href = challengeUrl;
    }
  };

  const renderWord = (word, index) => {
    const wordLower = word.toLowerCase();
    const isRevealed = revealedWords.has(wordLower);
    const isBlocked = totalAttempts >= 3;
    const isSelected = selectedWord === word;
    
    return (
      <button
        key={index}
        onClick={() => handleWordSelect(word)}
        disabled={isRevealed || isBlocked || submitting}
        className={`
          inline-block m-1 px-3 py-2 font-mono text-sm border-2 rounded transition-all relative
          ${isRevealed 
            ? 'bg-green-900 border-green-400 text-green-200 cursor-default' 
            : isBlocked
              ? 'bg-red-900 border-red-400 text-red-200 cursor-not-allowed'
              : isSelected 
                ? 'bg-yellow-900 border-yellow-400 text-yellow-200 cursor-pointer hover:bg-yellow-800' 
                : 'bg-gray-800 border-gray-600 text-gray-300 cursor-pointer hover:bg-gray-700 hover:border-gray-500'
          }
        `}
        title={isBlocked ? `Max attempts reached (${totalAttempts}/3)` : isRevealed ? 'Revealed' : `Total attempts: ${totalAttempts}/3`}
      >
        {isRevealed ? word : isBlocked ? '✗'.repeat(word.length) : '_'.repeat(word.length)}
      </button>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-gray-400 font-mono">LOADING...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center">
        <div className="text-center space-y-4 max-w-md w-full px-4">
          <h1 className="text-2xl font-mono text-gray-400 tracking-widest">
            ACCESS DENIED
          </h1>
          <div className="text-red-400 font-mono text-sm">
            {error.includes('already completed') ? 
              'CHALLENGE ALREADY COMPLETED' : 
              `ERROR: ${error}`
            }
          </div>
          {error.includes('already completed') && (
            <div className="text-gray-500 font-mono text-xs mt-4">
              You have already completed this challenge.
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center">
        <div className="text-center space-y-8 max-w-2xl w-full px-4">
          <div className="space-y-4">
            <h1 className="text-3xl font-mono text-green-400 tracking-widest animate-pulse">
              CHALLENGE COMPLETE
            </h1>
            <div className="text-sm font-mono text-gray-500">
              HANGMAN SOLVED
            </div>
          </div>
          
          <div className="bg-gray-900 border border-green-600 rounded-lg p-6 space-y-6">
            <div className="bg-black border border-green-400 rounded p-4">
              <div className="text-green-400 font-mono text-lg text-center">
                COMPLETE QUOTE REVEALED
              </div>
              <div className="text-green-300 font-mono text-sm text-center mt-2">
                "{challengeData?.quote}"
              </div>
              <div className="text-green-300 font-mono text-xs text-center mt-2">
                — {challengeData?.author}
              </div>
            </div>
            
            <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 text-center">
              <div className="text-green-300 font-mono text-sm">
                You've successfully decoded the complete quote!
              </div>
              <div className="text-green-300 font-mono text-xs mt-2">
                Each word revealed through correct decoding.
              </div>
            </div>

            {rewardData && (
              <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 space-y-2">
                <div className="text-center text-yellow-400 font-mono text-sm mb-3">
                  REWARDS EARNED
                </div>
                
                {rewardData.bits > 0 && (
                  <div className="flex items-center justify-between bg-gray-900 border border-yellow-600 rounded p-2">
                    <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-yellow-400" />
                      <span className="text-yellow-400 font-mono text-sm">BITS</span>
                    </div>
                    <span className="text-yellow-400 font-mono text-sm font-bold">+{rewardData.bits}</span>
                  </div>
                )}

                {rewardData.multiplier > 0 && (
                  <div className="flex items-center justify-between bg-gray-900 border border-blue-600 rounded p-2">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-blue-400" />
                      <span className="text-blue-400 font-mono text-sm">MULTIPLIER</span>
                    </div>
                    <span className="text-blue-400 font-mono text-sm font-bold">+{rewardData.multiplier.toFixed(1)}</span>
                  </div>
                )}

                {rewardData.luck > 1.0 && (
                  <div className="flex items-center justify-between bg-gray-900 border border-green-600 rounded p-2">
                    <div className="flex items-center gap-2">
                      <Clover className="w-4 h-4 text-green-400" />
                      <span className="text-green-400 font-mono text-sm">LUCK</span>
                    </div>
                    <span className="text-green-400 font-mono text-sm font-bold">×{rewardData.luck.toFixed(1)}</span>
                  </div>
                )}

                {rewardData.discount > 0 && (
                  <div className="flex items-center justify-between bg-gray-900 border border-purple-600 rounded p-2">
                    <div className="flex items-center gap-2">
                      <Percent className="w-4 h-4 text-purple-400" />
                      <span className="text-purple-400 font-mono text-sm">DISCOUNT</span>
                    </div>
                    <span className="text-purple-400 font-mono text-sm font-bold">+{rewardData.discount}%</span>
                  </div>
                )}

                {rewardData.shield && (
                  <div className="flex items-center justify-between bg-gray-900 border border-cyan-600 rounded p-2">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-cyan-400" />
                      <span className="text-cyan-400 font-mono text-sm">SHIELD</span>
                    </div>
                    <span className="text-cyan-400 font-mono text-sm font-bold">ACTIVE</span>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <button
            onClick={handleReturnToPrizeversity}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-mono py-3 px-4 rounded border border-green-500 transition-colors"
          >
            RETURN TO PRIZEVERSITY
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center">
      <div className="text-center space-y-8 max-w-4xl w-full px-4">
        <div className="space-y-4">
          <h1 className="text-3xl font-mono text-green-400 tracking-widest animate-pulse">
            HANGMAN_7
          </h1>
          <div className="text-sm font-mono text-gray-500">
            DECODE THE QUOTE
          </div>
        </div>
        
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 space-y-6">
          <div className="bg-black border border-green-400 rounded p-4">
            <div className="text-green-400 font-mono text-lg text-center mb-2">
              🎯 QUOTE
            </div>
            <div className="text-gray-300 font-mono text-sm text-center mb-3">
              By {challengeData?.author}:
            </div>
            <div className="text-green-300 font-mono text-sm text-center italic">
              "{challengeData?.quote}"
            </div>
          </div>
          
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-4">
            <div className="text-center">
              <div className="text-cyan-300 font-mono text-sm font-bold mb-2">GAME RULES</div>
              <div className="text-gray-300 font-mono text-xs space-y-1">
                <div className="flex items-center justify-center gap-2">
                  <Target className="w-3 h-3 text-cyan-400" />
                  <span>Select a word to reveal by entering its matching value</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Lightbulb className="w-3 h-3 text-cyan-400" />
                  <span>Enter the correct value(s) for the selected word</span>
                </div>
                <div className="text-yellow-400">
                  Multiple answers accepted - enter any or all separated by commas
                </div>
              </div>
            </div>
          </div>

          {selectedWord && (
            <div className="bg-gray-800 border border-yellow-600 rounded-lg p-4">
              <div className="text-center">
                <div className="text-yellow-400 font-mono text-sm font-bold">
                  SELECTED WORD
                </div>
                <div className="text-yellow-300 font-mono text-lg mt-1">
                  "{selectedWord}"
                </div>
              </div>
            </div>
          )}
          
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-4">
            <div className="text-center">
              <div className="text-orange-300 font-mono text-sm font-bold mb-3">QUOTE TO DECODE</div>
              <div className="text-left bg-black border border-gray-700 rounded p-4 font-mono text-sm">
                {challengeData?.words?.map((word, index) => renderWord(word, index))}
              </div>
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          
          <div className="text-sm font-mono text-gray-500">
            {selectedWord ? 'ENTER VALUE(S):' : 'SELECT A WORD ABOVE FIRST'}
          </div>
          
          <input
            type="text"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={submitting || !selectedWord || totalAttempts >= 3}
            className={`w-full bg-transparent border px-4 py-3 font-mono text-center focus:outline-none transition-colors text-lg ${
              submitting || !selectedWord || totalAttempts >= 3
                ? 'border-gray-700 text-gray-500' 
                : 'border-gray-600 text-red-400 focus:border-red-400'
            }`}
            placeholder={selectedWord ? "VALUE(S)" : "Please Select a word first to enter its value!"}
          />
          
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedWord || !tokenInput.trim() || totalAttempts >= 3}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-mono py-3 px-4 rounded border border-green-500 transition-colors"
          >
                          {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  VERIFYING...
                </span>
              ) : (
                'SUBMIT'
              )}
          </button>
          
            <div className="text-xs font-mono text-gray-500 space-y-1">
            <div className="flex items-center justify-center gap-2">
              <span className="text-green-400">⏎</span>
              <span>Press ENTER to submit</span>
            </div>
            <div className="text-center text-gray-400">
              Total Attempts: {totalAttempts}/3
            </div>
            {submitMessage && (
              <div className={`text-center ${
                submitMessage.includes('✅') ? 'text-green-400' : 
                submitMessage.includes('❌') ? 'text-red-400' : 'text-yellow-400'
              }`}>
                {submitMessage}
              </div>
            )}
          </div>
        </div>
        
        <div className="text-xs font-mono text-gray-700 space-y-1">
          <div>STATUS: GAME IN PROGRESS</div>
          <div>PROGRESS: {revealedWords.size}/{challengeData?.words?.length || 0} WORDS REVEALED</div>
          <div>ATTEMPTS: {totalAttempts}/3 USED</div>
          <div>PLAYER: {uniqueId?.substring(0, 6).toUpperCase()}</div>
        </div>
      </div>
    </div>
  );
};

export default Challenge7Site;