import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Search, Clock, Shield, CheckCircle, AlertTriangle, FileText, Coins, Zap, Clover, Percent, Sword, Code } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE } from '../config/api';

// Challenge timing constants
const CHALLENGE_DURATION_SEC = 60 * 60 * 2; // 2 hours
const HURRY_THRESHOLD_SEC = CHALLENGE_DURATION_SEC - 5 * 60; // last 5 minutes

const Challenge3Site = () => {
  const { uniqueId } = useParams();
  const [loading, setLoading] = useState(true);
  const [studentData, setStudentData] = useState(null);
  const [cppChallenge, setCppChallenge] = useState(null);
  const [answer, setAnswer] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [maxAttempts, setMaxAttempts] = useState(5);
  const [startTime, setStartTime] = useState(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [challengeStarted, setChallengeStarted] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [checkingCompletion, setCheckingCompletion] = useState(true);
  const [rewardData, setRewardData] = useState(null);
  const [expiredNotified, setExpiredNotified] = useState(false);
  const isExpired = timeElapsed >= CHALLENGE_DURATION_SEC;

  useEffect(() => {
    const checkCompletion = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/challenges/check-completion/${uniqueId}/2`, {
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
    if (!checkingCompletion && !isCompleted) {
      fetchChallengeData();
    }
  }, [uniqueId, checkingCompletion, isCompleted]);

  // Timer for elapsed time
  useEffect(() => {
    if (startTime && !showSuccess && challengeStarted) {
      const timer = setInterval(() => {
        const elapsed = Math.floor((new Date() - startTime) / 1000);
        setTimeElapsed(elapsed);
        
        if (elapsed >= CHALLENGE_DURATION_SEC && !expiredNotified) {
          setExpiredNotified(true);
          toast.error('Time limit exceeded! Investigation has expired.');
        }
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [startTime, showSuccess, challengeStarted, expiredNotified]);

  const startChallenge = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/challenges/challenge3/${uniqueId}/start`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setStartTime(new Date(data.startTime));
        setChallengeStarted(true);
        toast.success('🔍 Investigation started! You have 2 hours to crack the case.');
      } else {
        toast.error('Failed to start investigation');
      }
    } catch (error) {
      toast.error('Failed to start investigation');
    }
  };

  const fetchChallengeData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/challenges/challenge3/${uniqueId}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to load C++ debugging challenge');
      }
      
      const data = await response.json();
      setStudentData(data.studentData);
      setCppChallenge(data.cppChallenge);
      setAttempts(data.attempts || 0);
      setMaxAttempts(data.maxAttempts || 5);
      
      setDataLoaded(true);
      
      if (data.startTime) {
        setStartTime(new Date(data.startTime));
        setChallengeStarted(true);
      } else {
        setChallengeStarted(false);
        // Auto-start the challenge
        setTimeout(() => {
          startChallenge();
        }, 500);
      }
      
    } catch (error) {
      toast.error(error.message || 'Failed to load C++ debugging challenge');
      setDataLoaded(true);
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!answer.trim()) {
      toast.error('Please enter the program output');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch(`${API_BASE}/api/challenges/challenge3/${uniqueId}/verify`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: answer.trim() })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setRewardData(data.rewards);
        setShowSuccess(true);
        toast.success('C++ debugging challenge solved!');
      } else {
        setAttempts(prev => prev + 1);
        if (data.attemptsLeft !== undefined) {
          toast.error(`${data.message} (${data.attemptsLeft} attempts left)`);
        } else {
          toast.error(data.message || 'Incorrect output. Try again.');
        }
      }
      
    } catch (error) {
      toast.error('Failed to verify output');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading
  if (loading || !dataLoaded) {
    return (
      <div className="min-h-screen bg-black text-green-400 font-mono flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-6xl animate-pulse">🔍</div>
          <div className="animate-spin h-8 w-8 border-2 border-green-500 border-t-transparent rounded-full mx-auto"></div>
          <div className="space-y-2">
            <p className="text-xl font-bold">Initializing Investigation...</p>
            <p className="text-gray-400">Preparing forensics case files</p>
            <p className="text-sm text-yellow-400">⚡ Starting timer in a moment</p>
          </div>
        </div>
      </div>
    );
  }

  if (checkingCompletion) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-gray-400 font-mono">CHECKING ACCESS...</div>
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
            <div className="text-red-400 font-mono text-xs">You have already successfully completed this C++ debugging challenge.</div>
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
            <CheckCircle size={64} className="mx-auto text-green-400 animate-pulse" />
            <h1 className="text-3xl font-mono text-green-400 tracking-widest animate-pulse">
              CODE DEBUGGED!
            </h1>
            <div className="text-sm font-mono text-gray-500">C++ DEBUGGING COMPLETE</div>
          </div>
          
          <div className="bg-gray-900 border border-green-600 rounded-lg p-6 space-y-6">
            <div className="bg-black border border-green-400 rounded p-4">
              <div className="text-green-400 font-mono text-lg text-center tracking-wider">
                C++ MASTER
              </div>
            </div>
            
            <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 space-y-2">
              <div className="text-green-300 font-mono text-sm">Algorithm traced successfully! Output calculated correctly.</div>
              <div className="text-green-300 font-mono text-sm">Challenge 4 is now unlocked - ready for digital forensics investigation!</div>
              <div className="text-gray-400 font-mono text-xs space-y-1">
                <div>Debugging attempts: {attempts}</div>
                <div>Agent ID: {studentData?.agentId}</div>
                <div>Mission: {cppChallenge?.missionId}</div>
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
                challengeIndex: 2,
                challengeName: "C++ Master",
                timestamp: Date.now(),
                rewards: rewardData
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

  // Don't show main challenge if data is loaded but challenge hasn't started
  if (dataLoaded && !challengeStarted) {
    return (
      <div className="min-h-screen bg-black text-green-400 font-mono flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-green-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Starting investigation timer...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono">
      <div className="bg-gray-900 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Code className="text-green-500" size={24} />
            <div>
              <h1 className="text-xl font-bold">Challenge 3: C++ Master</h1>
              <p className="text-gray-400 text-sm">🔧 Mission: {cppChallenge?.missionId} | Manual Code Tracing</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-400">
              Agent: {studentData?.firstName} {studentData?.lastName}
            </div>
            <div className="text-sm text-gray-400">
              Badge: {studentData?.badgeNumber} | {studentData?.clearanceLevel}
            </div>
            <div className={`text-sm ${timeElapsed > HURRY_THRESHOLD_SEC ? 'text-red-400 animate-pulse' : 'text-yellow-400'}`}>
              Time: {Math.floor(timeElapsed / 60)}:{(timeElapsed % 60).toString().padStart(2, '0')} / 120:00
              {timeElapsed > HURRY_THRESHOLD_SEC && <span className="ml-2">⚠️ HURRY!</span>}
            </div>
            <div className="text-sm text-red-400">
              Attempts: {attempts}/{maxAttempts}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Enter program output..."
                className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-green-400 placeholder-gray-400 focus:border-green-500 focus:outline-none"
                onKeyPress={(e) => e.key === 'Enter' && submitAnswer()}
                onPaste={(e) => {
                  e.preventDefault();
                  toast.error('Paste disabled - calculate manually!');
                }}
                onContextMenu={(e) => e.preventDefault()}
                autoComplete="off"
                spellCheck={false}
                disabled={isExpired}
              />
              <button
                onClick={submitAnswer}
                disabled={isSubmitting || !answer.trim() || attempts >= maxAttempts || isExpired}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg transition-colors"
              >
                <Shield size={16} />
                {isExpired ? 'Expired' : isSubmitting ? 'Verifying...' : attempts >= maxAttempts ? 'Locked' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-gray-900 rounded-lg border border-gray-700">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2">
                <Code size={18} />
                C++ Algorithm Code
              </h3>
              <div className="text-sm text-gray-400">
                Personalized for: {cppChallenge?.studentName}
              </div>
            </div>
            <div className="p-6 bg-gray-900 space-y-6">
              <div className="space-y-4">
                <h4 className="text-lg font-bold text-blue-300">SECURITY ALGORITHM</h4>
                <div className="bg-black p-4 rounded border border-blue-600 overflow-x-auto">
                  <pre className="text-green-300 font-mono text-sm whitespace-pre-wrap">
                    {cppChallenge?.cppCode}
                  </pre>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-6 bg-blue-900 border border-blue-600 rounded-lg">
            <div className="p-4 border-b border-blue-600">
              <h3 className="font-bold flex items-center gap-2 text-blue-300">
                <Search size={16} />
                Your Mission
              </h3>
            </div>
            <div className="p-4 space-y-2">
              <p className="text-blue-200 text-sm">
                🎯 <strong>OBJECTIVE:</strong> {cppChallenge?.task}
              </p>
              <p className="text-blue-200 text-sm">
                🔐 <strong>METHOD:</strong> Manually trace through the algorithm step by step
              </p>
              <p className="text-blue-200 text-sm">
                ⚡ <strong>SUCCESS:</strong> Enter the exact numeric output the program produces
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg border border-gray-700">
              <div className="p-4 border-b border-gray-700">
                <h3 className="font-bold">Investigation Status</h3>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between">
                  <span>Attempts:</span>
                  <span className={attempts >= maxAttempts ? 'text-red-400' : 'text-white'}>{attempts}/{maxAttempts}</span>
                </div>
                <div className="flex justify-between">
                  <span>Time:</span>
                  <span className={timeElapsed > HURRY_THRESHOLD_SEC ? 'text-red-400 animate-pulse' : 'text-yellow-400'}>
                    {Math.floor(timeElapsed / 60)}:{(timeElapsed % 60).toString().padStart(2, '0')} / 120:00
                  </span>
                </div>
                {timeElapsed > HURRY_THRESHOLD_SEC && (
                  <div className="p-2 bg-red-900 border border-red-600 rounded text-red-300 text-sm text-center animate-pulse">
                    ⚠️ Less than 5 minutes remaining!
                  </div>
                )}
                {attempts >= maxAttempts && (
                  <div className="p-2 bg-red-900 border border-red-600 rounded text-red-300 text-sm text-center">
                    Investigation Locked
                  </div>
                )}
              </div>
            </div>
                
            <div className="bg-gray-800 rounded-lg border border-gray-700">
              <div className="p-4 border-b border-gray-700">
                <h3 className="font-bold">Mission Details</h3>
              </div>
              <div className="p-4 text-sm text-gray-300 space-y-2">
                <p><strong>Mission ID:</strong> {cppChallenge?.missionId}</p>
                <p><strong>Agent:</strong> {cppChallenge?.agentId}</p>
                <p><strong>Difficulty:</strong> {cppChallenge?.difficulty}</p>
                <p><strong>Time Limit:</strong> {cppChallenge?.timeLimit}</p>
                <div className="mt-3 p-2 bg-gray-900 rounded border border-gray-600">
                  <p className="text-xs text-gray-400">{cppChallenge?.scenario}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg border border-gray-700">
              <div className="p-4 border-b border-gray-700">
                <h3 className="font-bold">How to Debug</h3>
              </div>
              <div className="p-4 text-sm text-gray-300 space-y-2">
                <p>1. Read through the C++ code carefully</p>
                <p>2. Identify the initial values</p>
                <p>3. Trace through each loop iteration</p>
                <p>4. Track variable changes step by step</p>
                <p>5. Apply the final modifier</p>
                <p>6. Enter the final result</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Challenge3Site;