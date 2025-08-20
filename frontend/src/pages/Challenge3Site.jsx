import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Search, Clock, Shield, CheckCircle, AlertTriangle, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE } from '../config/api';

const Challenge3Site = () => {
  const { uniqueId } = useParams();
  const [loading, setLoading] = useState(true);
  const [studentData, setStudentData] = useState(null);
  const [evidence, setEvidence] = useState(null);
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
        
        // Check if 30 minutes (1800 seconds) have passed
        if (elapsed >= 1800) {
          toast.error('Time limit exceeded! Investigation has expired.');
        }
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [startTime, showSuccess, challengeStarted]);

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
        toast.success('🔍 Investigation started! You have 30 minutes to crack the case.');
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
        throw new Error('Failed to load investigation data');
      }
      
      const data = await response.json();
      setStudentData(data.studentData);
      setEvidence(data.evidence);
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
      toast.error(error.message || 'Failed to load investigation');
      setDataLoaded(true);
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!answer.trim()) {
      toast.error('Please enter the recovered evidence');
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
        setShowSuccess(true);
        toast.success('Investigation solved! Evidence recovered!');
      } else {
        setAttempts(prev => prev + 1);
        if (data.attemptsLeft !== undefined) {
          toast.error(`${data.message} (${data.attemptsLeft} attempts left)`);
        } else {
          toast.error(data.message || 'Incorrect evidence. Try again.');
        }
      }
      
    } catch (error) {
      toast.error('Failed to verify evidence');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading
  if (loading || !dataLoaded) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-6xl animate-pulse">🔍</div>
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
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
      <div className="min-h-screen bg-slate-900 text-green-400 font-mono flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse">CHECKING ACCESS...</div>
        </div>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="min-h-screen bg-slate-900 text-red-400 font-mono flex flex-col items-center justify-center p-8">
        <div className="max-w-md w-full space-y-6 text-center">
          <Shield className="mx-auto text-red-400" size={48} />
          <h1 className="text-2xl font-bold">ACCESS DENIED</h1>
          <div className="border border-red-400 bg-slate-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-300 mb-2">CHALLENGE ALREADY COMPLETED</h2>
            <p className="text-red-400">You have already successfully completed this C++ debugging challenge.</p>
          </div>
        </div>
      </div>
    );
  }

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gray-900 text-green-400 font-mono flex flex-col items-center justify-center p-8">
        <div className="max-w-2xl w-full space-y-8 text-center">
          <CheckCircle size={64} className="mx-auto text-green-400 animate-pulse" />
          <h1 className="text-4xl font-bold">CASE SOLVED!</h1>
          <div className="border border-green-400 p-8 bg-gray-800 rounded-lg">
            <h2 className="text-2xl font-bold mb-4 text-green-300">INVESTIGATION COMPLETE</h2>
            <p className="mb-4">Evidence successfully recovered from intercepted hash!</p>
            <p className="text-green-300">Challenge 4 is now unlocked - ready for digital forensics investigation!</p>
            <div className="mt-4 text-sm text-gray-400">
              <p>Investigation attempts: {attempts}</p>
              <p>Agent ID: {studentData?.agentId}</p>
              <p>Case: {evidence?.caseNumber}</p>
            </div>
          </div>
          <button
            onClick={() => {
              localStorage.setItem('challengeCompleted', JSON.stringify({
                challengeIndex: 2,
                challengeName: "Code Breaker",
                timestamp: Date.now()
              }));
              window.close();
            }}
            className="px-8 py-3 border border-green-400 bg-transparent text-green-400 hover:bg-green-400 hover:text-black transition-colors rounded-lg"
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
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Starting investigation timer...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="bg-black border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Search className="text-blue-500" size={24} />
            <div>
              <h1 className="text-xl font-bold">Challenge 3: Code Breaker</h1>
              <p className="text-gray-400 text-sm">🔍 Case: {evidence?.caseNumber} | Suspect: {evidence?.suspectId}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-400">
              Agent: {studentData?.firstName} {studentData?.lastName}
            </div>
            <div className="text-sm text-gray-400">
              Badge: {studentData?.badgeNumber} | {studentData?.clearanceLevel}
            </div>
            <div className={`text-sm ${timeElapsed > 1500 ? 'text-red-400 animate-pulse' : 'text-yellow-400'}`}>
              Time: {Math.floor(timeElapsed / 60)}:{(timeElapsed % 60).toString().padStart(2, '0')} / 30:00
              {timeElapsed > 1500 && <span className="ml-2">⚠️ HURRY!</span>}
            </div>
            <div className="text-sm text-red-400">
              Attempts: {attempts}/{maxAttempts}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Enter recovered evidence..."
                className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                onKeyPress={(e) => e.key === 'Enter' && submitAnswer()}
                onPaste={(e) => {
                  e.preventDefault();
                  toast.error('Paste disabled - type the evidence manually!');
                }}
                onContextMenu={(e) => e.preventDefault()}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                onClick={submitAnswer}
                disabled={isSubmitting || !answer.trim() || attempts >= maxAttempts}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg transition-colors"
              >
                <Shield size={16} />
                {isSubmitting ? 'Verifying...' : attempts >= maxAttempts ? 'Locked' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-gray-800 rounded-lg border border-gray-700">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2">
                <FileText size={18} />
                Forensics Evidence
              </h3>
              <div className="text-sm text-gray-400">
                Classification: {studentData?.clearanceLevel}
              </div>
            </div>
            <div className="p-6 bg-gray-900 space-y-6">
              <div className="space-y-4">
                <h4 className="text-lg font-bold text-blue-300">INTERCEPTED TRANSMISSION</h4>
                <div className="bg-black p-4 rounded border border-blue-600">
                  <p className="text-blue-200 font-mono text-lg">
                    HASH OUTPUT: <span className="text-yellow-300">{evidence?.interceptedHash}</span>
                  </p>
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="text-lg font-bold text-blue-300">RECOVERED HASH FUNCTION</h4>
                <div className="bg-gray-800 p-4 rounded border border-gray-600">
                  <div className="font-mono text-sm space-y-2">
                    <p className="text-gray-300">def hash_function(input_string):</p>
                    <p className="text-gray-300 ml-4">result = ""</p>
                    <p className="text-gray-300 ml-4">for char in input_string:</p>
                    <p className="text-gray-300 ml-8">if char.isalpha():</p>
                    <p className="text-yellow-300 ml-12">shifted = (ord(char) - ord('A') + {evidence?.hashFunction?.letterShift}) % 26</p>
                    <p className="text-gray-300 ml-12">result += chr(shifted + ord('A'))</p>
                    <p className="text-gray-300 ml-8">elif char.isdigit():</p>
                    <p className="text-yellow-300 ml-12">new_digit = (int(char) * {evidence?.hashFunction?.digitMultiplier}) % 10</p>
                    <p className="text-gray-300 ml-12">result += str(new_digit)</p>
                    <p className="text-gray-300 ml-4"># Add checksum</p>
                    <p className="text-yellow-300 ml-4">checksum = (sum(ord(c) for c in result) * {evidence?.hashFunction?.checksumPrime}) % 1000</p>
                    <p className="text-gray-300 ml-4">return result + str(checksum).zfill(3)</p>
                  </div>
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
                🎯 <strong>OBJECTIVE:</strong> Find the original input that produces the intercepted hash
              </p>
              <p className="text-blue-200 text-sm">
                🔐 <strong>METHOD:</strong> Reverse engineer the hash function to recover the evidence
              </p>
              <p className="text-blue-200 text-sm">
                ⚡ <strong>SUCCESS:</strong> Enter the original 4-character input that was hashed
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
                  <span className={timeElapsed > 1500 ? 'text-red-400 animate-pulse' : 'text-yellow-400'}>
                    {Math.floor(timeElapsed / 60)}:{(timeElapsed % 60).toString().padStart(2, '0')} / 30:00
                  </span>
                </div>
                {timeElapsed > 1500 && (
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
                <h3 className="font-bold">Case Details</h3>
              </div>
              <div className="p-4 text-sm text-gray-300 space-y-2">
                <p><strong>Case Number:</strong> {evidence?.caseNumber}</p>
                <p><strong>Suspect ID:</strong> {evidence?.suspectId}</p>
                <p><strong>Department:</strong> {studentData?.department}</p>
                <p><strong>Agent:</strong> {studentData?.agentId}</p>
                <p><strong>Clearance:</strong> {studentData?.clearanceLevel}</p>
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg border border-gray-700">
              <div className="p-4 border-b border-gray-700">
                <h3 className="font-bold">How to Solve</h3>
              </div>
              <div className="p-4 text-sm text-gray-300 space-y-2">
                <p>1. Analyze the hash function</p>
                <p>2. Work backwards from the hash output</p>
                <p>3. Account for letter shifts and digit multipliers</p>
                <p>4. Remove the checksum (last 3 digits)</p>
                <p>5. Reverse the transformations</p>
                <p>6. Enter the original 4-character input</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Challenge3Site;