import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Shield, Search, ExternalLink, Coins, Zap, Clover, Percent, Sword } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE } from '../config/api';

const Challenge4Site = () => {
  const { uniqueId } = useParams();
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [checkingCompletion, setCheckingCompletion] = useState(true);
  const [rewardData, setRewardData] = useState(null);

  useEffect(() => {
    const checkCompletion = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/challenges/check-completion/${uniqueId}/3`, {
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

  useEffect(() => {
    const generateEvidence = async () => {
      try {
        await fetch(`${API_BASE}/api/challenges/challenge4/${uniqueId}/generate`, {
          method: 'POST',
          credentials: 'include'
        });
      } catch (error) {
        console.error('Failed to prepare challenge:', error);
      }
    };
    
    generateEvidence();
  }, [uniqueId]);

  const submitAnswer = async () => {
    if (!answer.trim()) {
      toast.error('Please enter the artist name...');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`${API_BASE}/api/challenges/challenge4/${uniqueId}/submit`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: answer.trim() })
      });
      
      const data = await response.json();
      
      if (data.success) {
        localStorage.setItem('challengeCompleted', JSON.stringify({
          challengeIndex: 3,
          challengeName: data.challengeName || "Digital Forensics Lab",
          timestamp: Date.now(),
          rewards: data.rewards || {
            bits: 0,
            multiplier: 0,
            luck: 1.0,
            discount: 0,
            shield: false,
            attackBonus: 0
          },
          allCompleted: data.allCompleted || false,
          nextChallenge: data.nextChallenge
        }));
        
        setRewardData(data.rewards);
        setShowSuccess(true);
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
      
    } catch (error) {
      toast.error('Failed to submit answer');
    } finally {
      setSubmitting(false);
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
            <div className="text-red-400 font-mono text-xs">You have already successfully completed this digital forensics challenge.</div>
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
              FORENSICS COMPLETE
            </h1>
            <div className="text-sm font-mono text-gray-500">INVESTIGATION COMPLETE</div>
          </div>
          
          <div className="bg-gray-900 border border-green-600 rounded-lg p-6 space-y-6">
            <div className="bg-black border border-green-400 rounded p-4">
              <div className="text-green-400 font-mono text-lg text-center tracking-wider">
                DIGITAL FORENSICS LAB
              </div>
            </div>
            
            <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 space-y-2">
              <div className="text-green-300 font-mono text-sm">🕵️ Metadata successfully extracted and analyzed</div>
              <div className="text-gray-400 font-mono text-xs space-y-1">
                <div>Investigation ID: {uniqueId.substring(0, 8)}</div>
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
    <div className="min-h-screen bg-black text-green-400 font-mono">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Shield className="text-green-600" size={24} />
            <div>
              <h1 className="text-xl font-bold text-green-400">Challenge 4: Digital Forensics Lab</h1>
              <p className="text-gray-400 text-sm">Artifact Analysis & Investigation</p>
            </div>
          </div>
          <div className="text-sm text-gray-500 bg-gray-800 px-3 py-1 rounded-full border border-gray-600">
            Evidence ID: {uniqueId.substring(0, 8)}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {/* Mission Brief */}
        <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-green-400">
            <Search className="text-green-600" size={24} />
            Intelligence Briefing
          </h2>
          <div className="space-y-4">
            <p className="text-gray-300 leading-relaxed">
              Our sources have identified suspicious activity in a public repository related to WSU transit systems. 
              Intelligence suggests that evidence has been hidden in plain sight using steganographic techniques.
            </p>
          </div>
        </div>

        {/* Repository Intelligence */}
        <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-green-400">
            <ExternalLink className="text-purple-600" size={20} />
            Target Repository
          </h3>
          <div className="space-y-4">
            <p className="text-gray-300 leading-relaxed">
              Begin your investigation at the following location. Look for anything that seems out of place or recently added.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/cinnamonstic/wsu-transit-delay"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                <ExternalLink size={16} />
                Investigate Repository
              </a>
            </div>
          </div>
        </div>

        {/* Answer Submission */}
        <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-green-400">
            <Search className="text-green-600" size={20} />
            Submit Intelligence
          </h3>
          <div className="space-y-4">
            <p className="text-gray-300 leading-relaxed">
              Once you've located and analyzed the evidence, submit the extracted intelligence below.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Intelligence Report:
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    className="flex-1 px-4 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none bg-gray-800 text-green-400"
                    placeholder="Enter extracted intelligence..."
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    disabled={submitting}
                  />
                  <button
                    onClick={submitAnswer}
                    disabled={submitting || !answer.trim()}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition-colors"
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Submitting...
                      </span>
                    ) : (
                      'Submit Report'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Challenge4Site;
