import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Coins, Zap, Shield, Percent, Clover } from 'lucide-react';

const Challenge6Site = () => {
  const { uniqueId } = useParams();
  const [input, setInput] = useState('');
  const [challengeData, setChallengeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [rewardData, setRewardData] = useState(null);

  useEffect(() => {
    const fetchChallengeData = async () => {
      try {
        const response = await fetch(`/api/challenges/challenge6/${uniqueId}`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.isCompleted) {
            setError('Challenge already completed');
            return;
          }
          
          setChallengeData(data);
        } else {
          setError('Failed to load challenge data');
        }
      } catch (err) {
        setError('Connection error');
      } finally {
        setLoading(false);
      }
    };

    if (uniqueId) {
      fetchChallengeData();
    }
  }, [uniqueId]);

  const handleSubmit = async () => {
    if (!input.trim() || submitting) return;
    
    setSubmitting(true);
    setSubmitMessage('');
    
    try {
      // Parse user input - could be a single number or comma-separated values
      const userTokens = input.trim()
        .split(',')
        .map(t => t.trim())
        .filter(t => t)
        .map(t => parseInt(t, 10))
        .filter(t => !isNaN(t));
      
      // Validate at least one token provided
      if (userTokens.length === 0) {
        setSubmitMessage('❌ Please enter a valid token ID number');
        setSubmitting(false);
        return;
      }
      
      const response = await fetch(`/api/challenges/submit-challenge6`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          uniqueId: uniqueId,
          answer: userTokens 
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSubmitMessage('✅ CORRECT! Challenge completed successfully!');
        setIsSuccess(true);
        setRewardData(result.rewards);
      } else {
        setSubmitMessage('❌ INCORRECT. Try again...');
      }
    } catch (error) {
      setSubmitMessage('⚠️ Connection error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isSuccess) {
      handleSubmit();
    }
  };

  const handleReturnToPrizeversity = () => {
    localStorage.setItem('challengeCompleted', JSON.stringify({
      challengeIndex: 5,
      challengeName: 'Needle in a Haystack',
      timestamp: Date.now(),
      rewards: rewardData || {
        bits: 0,
        multiplier: 0,
        luck: 1.0,
        discount: 0,
        shield: false
      },
      allCompleted: false,
      nextChallenge: null
    }));
    window.close();
    try {
      window.close();
      setTimeout(() => {
        const classroomMatch = window.location.pathname.match(/\/challenge-6-site\/(.+)/);
        if (classroomMatch) {
          const challengeUrl = document.referrer || `/challenges`;
          window.location.href = challengeUrl;
        } else {
          window.location.href = '/challenges';
        }
      }, 100);
    } catch (error) {
      const challengeUrl = document.referrer || '/challenges';
      window.location.href = challengeUrl;
    }
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
              You have already successfully completed this challenge.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center">
      <div className="text-center space-y-8 max-w-2xl w-full px-4">
        <div className="space-y-4">
          <h1 className="text-3xl font-mono text-green-400 tracking-widest animate-pulse">
            SECTOR_{challengeData?.sectorCode}
          </h1>
          <div className="text-sm font-mono text-gray-500">
            DIGITAL ARCHAEOLOGY DIVISION
          </div>
        </div>
        
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 space-y-6">
          <div className="bg-black border border-green-400 rounded p-4">
            <div className="text-green-400 font-mono text-xl text-center tracking-wider">
              "{challengeData?.generatedWord}"
            </div>
          </div>
          
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-4">
            <div className="text-center">
              <div className="text-orange-300 font-mono text-sm font-bold mb-2">MISSION OBJECTIVE</div>
              <div className="text-gray-300 font-mono text-sm">
                Determine the numerical index position of the target word
              </div>
              <div className="text-cyan-400 font-mono text-xs mt-2">
                Think about how AI systems process language into numbers
              </div>
              <div className="text-cyan-300 font-mono text-xs mt-2">
                You may enter a single token ID or multiple IDs separated by commas
              </div>
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="text-sm font-mono text-gray-500">
            ENTER NUMERICAL LOCATION:
          </div>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={submitting}
            className={`w-full bg-transparent border px-4 py-3 font-mono text-center focus:outline-none transition-colors text-lg ${
              submitting 
                ? 'border-gray-700 text-gray-500' 
                : 'border-gray-600 text-green-400 focus:border-green-400'
            }`}
            placeholder={submitting ? "PROCESSING..." : "TOKEN ID"}
          />
          <div className="text-xs font-mono text-gray-500 space-y-1">
            <div className="flex items-center justify-center gap-2">
              <span className="text-green-400">⏎</span>
              <span>Press ENTER to submit</span>
            </div>
            {submitMessage && (
              <div className={`text-center ${
                submitMessage.includes('✅') ? 'text-green-400' : 
                submitMessage.includes('❌') ? 'text-red-400' : 'text-yellow-400'
              }`}>
                {submitMessage}
              </div>
            )}
            {isSuccess && (
              <div className="mt-4 space-y-3">
                <div className="text-center space-y-2">
                  <div className="text-green-400 font-mono text-sm">
                    🎉 MISSION ACCOMPLISHED 🎉
                  </div>
                  <div className="text-gray-400 font-mono text-xs">
                    Digital archaeology expertise confirmed
                  </div>
                </div>

                {/* Rewards Display */}
                {rewardData && (
                  <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 space-y-2">
                    <div className="text-center text-yellow-400 font-mono text-sm mb-3">
                      REWARDS ACQUIRED
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

                <button
                  onClick={handleReturnToPrizeversity}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-mono py-3 px-4 rounded border border-green-500 transition-colors"
                >
                  Return to Prizeversity HQ
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="text-xs font-mono text-gray-700 space-y-1">
          <div>STATUS: ARCHAEOLOGICAL SITE ACTIVE</div>
          <div>CLEARANCE: LEVEL 6 REQUIRED</div>
          <div>AGENT: {uniqueId?.substring(0, 6).toUpperCase()}</div>
        </div>
      </div>
    </div>
  );
};

export default Challenge6Site;