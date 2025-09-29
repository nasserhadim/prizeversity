import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Lock, User, Shield, Coins, Zap, Clover, Percent, Sword } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE } from '../config/api';

const Challenge5Site = () => {
  const { uniqueId } = useParams();
  const [username, setUsername] = useState('');
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [shake, setShake] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [checkingCompletion, setCheckingCompletion] = useState(true);
  const [rewardData, setRewardData] = useState(null);

  useEffect(() => {
    const checkCompletion = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/challenges/check-completion/${uniqueId}/4`, {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setIsCompleted(data.isCompleted);
        }
      } catch (error) {
        console.error('Error checking completion:', error);
      } finally {
        setCheckingCompletion(false);
      }
    };

    if (uniqueId) {
      checkCompletion();
    }
  }, [uniqueId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !secret.trim()) {
      toast.error('Please enter both username and secret');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('https://0jqaxbqaa2.execute-api.us-east-1.amazonaws.com/prod/verify', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          secret: secret.trim()
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Invalid credentials');
      }

      if (data.valid) {
        toast.success('✅ Verified! Challenge complete.');
        
        // Now call the Prizeversity backend to award bits
        try {
          const challengeResponse = await fetch(`${API_BASE}/api/challenges/verify-challenge5-external`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              uniqueId: uniqueId,
              verified: true
            }),
          });

          console.log('Challenge response status:', challengeResponse.status);
          
          if (challengeResponse.ok) {
            const challengeData = await challengeResponse.json();
            console.log('Challenge completed successfully!', challengeData);
            console.log('Rewards received:', challengeData.rewards);
            setRewardData(challengeData.rewards);
            
            // Store completion data for the main challenge page to pick up
            localStorage.setItem('challengeCompleted', JSON.stringify({
              challengeIndex: 4,
              challengeName: "WayneAWS Verification", 
              timestamp: Date.now(),
              rewards: challengeData.rewards,
              needsRewards: true,
              allCompleted: challengeData.allCompleted || false,
              nextChallenge: challengeData.nextChallenge || null
            }));
          } else {
            const errorData = await challengeResponse.json();
            console.error('Challenge completion failed:', errorData);
            toast.error(errorData.message || 'Failed to complete challenge');
          }
        } catch (challengeError) {
          console.error('Error awarding challenge rewards:', challengeError);
        }
        
        setShowSuccess(true);
      } else {
        throw new Error('❌ Invalid credentials. Try again.');
      }
      
    } catch (error) {
      toast.error(error.message || '❌ Invalid credentials. Try again.');
      setShake(true);
      setUsername('');
      setSecret('');
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  if (checkingCompletion) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-gray-400 font-mono">Checking access...</div>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center">
        <div className="text-center space-y-4 max-w-md w-full px-4">
          <h1 className="text-2xl font-mono text-gray-400 tracking-widest">ACCESS DENIED</h1>
          <div className="bg-gray-900 border border-red-600 rounded-lg p-6">
            <div className="text-red-400 font-mono text-sm font-bold mb-2">CHALLENGE ALREADY COMPLETED</div>
            <div className="text-red-400 font-mono text-xs">You have already successfully completed this cloud authentication challenge.</div>
          </div>
        </div>
      </div>
    );
  }

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center">
        <div className="text-center space-y-8 max-w-2xl w-full px-4">
          <div className="space-y-4">
            <Shield size={64} className="mx-auto text-green-400 animate-pulse" />
            <h1 className="text-3xl font-mono text-green-400 tracking-widest animate-pulse">
              CLOUDS COMPLETE
            </h1>
            <div className="text-sm font-mono text-gray-500">SECRETS IN THE CLOUDS COMPLETE</div>
          </div>
          
          <div className="bg-gray-900 border border-green-600 rounded-lg p-6 space-y-6">
            <div className="bg-black border border-green-400 rounded p-4">
              <div className="text-green-400 font-mono text-lg text-center tracking-wider">
                WAYNEAWS VERIFICATION
              </div>
            </div>
            
            <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 space-y-2">
              <div className="text-green-300 font-mono text-sm">✅ Authentication Successful</div>
              <div className="text-green-300 font-mono text-sm">Advanced security protocols verified!</div>
              <div className="text-gray-400 font-mono text-xs space-y-1">
                <div>Verification ID: {uniqueId.substring(0, 8)}</div>
                <div>System: WayneAWS Authentication Portal</div>
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

                {rewardData.attackBonus > 0 && (
                  <div className="flex items-center justify-between bg-gray-900 border border-red-600 rounded p-2">
                    <div className="flex items-center gap-2">
                      <Sword className="w-4 h-4 text-red-400" />
                      <span className="text-red-400 font-mono text-sm">ATTACK</span>
                    </div>
                    <span className="text-red-400 font-mono text-sm font-bold">+{rewardData.attackBonus}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <button
            onClick={() => {
              localStorage.setItem('challengeCompleted', JSON.stringify({
                challengeIndex: 4,
                challengeName: "WayneAWS Verification",
                timestamp: Date.now(),
                rewards: rewardData,
                needsRewards: true
              }));
              window.close();
            }}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-mono py-3 px-4 rounded border border-green-500 transition-colors"
          >
            RETURN TO BASE
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center">
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
          20%, 40%, 60%, 80% { transform: translateX(10px); }
        }
        .shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
      <div className={`text-center space-y-8 max-w-md w-full px-4 ${shake ? 'shake' : ''}`}>
        <div className="space-y-4">
          <h1 className="text-3xl font-mono text-green-400 tracking-widest animate-pulse">
            CHALLENGE_5
          </h1>
          <div className="text-sm font-mono text-gray-500">WAYNEAWS PORTAL</div>
        </div>
        
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 space-y-6">
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-4">
            <div className="text-center">
              <div className="text-green-300 font-mono text-sm font-bold mb-2">ENTER WAYNEAWS CREDENTIALS</div>
              <div className="text-gray-400 font-mono text-xs">Visit the AWS Student Hub here</div>
              <a
                href="https://wayneaws.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 font-mono text-xs underline hover:text-blue-500"
              > https://wayneaws.dev</a>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-mono text-gray-500">USERNAME:</div>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  className="w-full bg-transparent border border-gray-600 pl-10 pr-4 py-3 font-mono text-center focus:outline-none transition-colors text-green-400 focus:border-green-400"
                  placeholder="ENTER WAYNEAWS USERNAME"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-mono text-gray-500">SECRET:</div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  disabled={loading}
                  className="w-full bg-transparent border border-gray-600 pl-10 pr-4 py-3 font-mono text-center focus:outline-none transition-colors text-green-400 focus:border-green-400"
                  placeholder="ENTER SECRET PASSWORD"
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-mono py-3 px-4 rounded border border-green-500 transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  VERIFYING...
                </span>
              ) : (
                'AUTHENTICATE'
              )}
            </button>
          </form>
        </div>

        <div className="text-center text-sm text-gray-500 space-y-1">
          <div className="mb-2">🔐 Secure WayneAWS Integration</div>
          <div className="text-xs">Your credentials are verified through encrypted channels</div>
        </div>
        
        <div className="text-xs font-mono text-gray-700 space-y-1">
          <div>STATUS: WAYNEAWS AUTHENTICATION REQUIRED</div>
          <div>SESSION ID: {uniqueId}</div>
        </div>
      </div>
    </div>
  );
};

export default Challenge5Site;
