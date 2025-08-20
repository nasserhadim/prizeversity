import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Lock, User, Shield } from 'lucide-react';
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
      const response = await fetch(`${API_BASE}/api/verify-wayneaws`, {
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

          if (challengeResponse.ok) {
            const challengeData = await challengeResponse.json();
            console.log('Challenge completed, bits awarded:', challengeData.bitsAwarded);
            
            // Store completion data for the main challenge page to pick up
            localStorage.setItem('challengeCompleted', JSON.stringify({
              challengeIndex: 4, // This is Challenge 5 (0-indexed)
              challengeName: "WayneAWS Verification",
              timestamp: Date.now(),
              bitsAwarded: challengeData.bitsAwarded,
              allCompleted: true // Mark as all completed since this is the final challenge
            }));
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
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-600">Checking access...</div>
        </div>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="min-h-screen bg-red-50 flex flex-col items-center justify-center p-8">
        <div className="max-w-md w-full space-y-6 text-center">
          <Shield className="mx-auto text-red-600" size={48} />
          <h1 className="text-2xl font-bold text-red-800">ACCESS DENIED</h1>
          <div className="bg-white border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-700 mb-2">Challenge Already Completed</h2>
            <p className="text-red-600">You have already successfully completed this cloud authentication challenge.</p>
          </div>
        </div>
      </div>
    );
  }

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 text-cyan-400 font-mono flex flex-col items-center justify-center p-8">
        <div className="max-w-2xl w-full space-y-8 text-center">
          <Shield size={64} className="mx-auto text-cyan-400 animate-pulse" />
          <h1 className="text-4xl font-bold">SECRETS IN THE CLOUDS COMPLETE</h1>
          <div className="border border-cyan-400 p-6 bg-black/40 backdrop-blur-sm rounded-lg">
            <h2 className="text-2xl font-bold mb-4 text-cyan-300">CHALLENGE 5 COMPLETE</h2>
            <p className="mb-4">WayneAWS credentials successfully validated.</p>
            <div className="bg-green-900/30 border border-green-400/50 p-4 rounded mb-4">
              <p className="text-green-300 text-lg font-medium">
                ✅ Authentication Successful
              </p>
            </div>
            <p className="text-cyan-400 font-medium">Advanced security protocols verified!</p>
            <div className="mt-4 text-sm text-gray-400 bg-black/30 p-3 rounded">
              <p>Verification ID: {uniqueId.substring(0, 8)}</p>
              <p>System: WayneAWS Authentication Portal</p>
            </div>
          </div>
          <button
            onClick={() => {
              window.close();
            }}
            className="px-8 py-3 border border-cyan-400 bg-transparent text-cyan-400 hover:bg-cyan-400 hover:text-black transition-colors font-medium rounded-lg"
          >
            RETURN TO BASE
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 text-white font-mono flex flex-col items-center justify-center p-8">
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
      <div className={`max-w-md w-full space-y-8 ${shake ? 'shake' : ''}`}>
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">WAYNEAWS PORTAL</h1>
          <p className="text-cyan-400">SECURE AUTHENTICATION</p>
        </div>
        
        <div className="border border-cyan-400 p-8 bg-black/40 backdrop-blur-sm rounded-lg">
          <h2 className="text-xl font-bold mb-6 text-center text-cyan-300">ENTER WAYNEAWS CREDENTIALS</h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold mb-2 text-cyan-300" htmlFor="username">
                USERNAME
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-black/60 border border-cyan-400 text-white font-mono focus:outline-none focus:border-cyan-300 focus:bg-black/80 rounded"
                  placeholder="ENTER WAYNEAWS USERNAME"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2 text-cyan-300" htmlFor="secret">
                SECRET
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  id="secret"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-black/60 border border-cyan-400 text-white font-mono focus:outline-none focus:border-cyan-300 focus:bg-black/80 rounded"
                  placeholder="ENTER SECRET PASSWORD"
                  disabled={loading}
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 border border-cyan-400 bg-transparent text-white hover:bg-cyan-400 hover:text-black transition-colors disabled:opacity-50 rounded font-bold"
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
          
          <div className="mt-6 text-xs text-gray-400 text-center">
            <p>WAYNEAWS AUTHENTICATION REQUIRED</p>
            <p>SESSION ID: {uniqueId}</p>
          </div>
        </div>

        <div className="text-center text-sm text-cyan-400/70">
          <p className="mb-2">🔐 Secure WayneAWS Integration</p>
          <p>Your credentials are verified through encrypted channels</p>
        </div>
      </div>
    </div>
  );
};

export default Challenge5Site;