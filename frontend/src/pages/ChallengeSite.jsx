// Challenge Site
// path: frontend/src/pages/ChallengeSite.jsx
// --------------
// This is the site that students see when they complete challenge 1.
// It's a simple site that allows them to enter their password and verify it.
// If they're successful, they'll be able to access challenge 2.
// Once again, we'll ensure we find a better way to do this than just naming them challenge 2, 3, etc.

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE } from '../config/api';

const ChallengeSite = () => {
  const { uniqueId } = useParams();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showClue, setShowClue] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      toast.error('Please enter a password');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/challenges/verify-password`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uniqueId,
          password: password.toUpperCase()
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Invalid password');
      }

      toast.success('Access granted!');
      setShowClue(true);
      
    } catch (error) {
      toast.error(error.message || 'Access denied');
      setShake(true);
      setPassword('');
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  if (showClue) {
    return (
      <div className="min-h-screen bg-black text-green-400 font-mono flex flex-col items-center justify-center p-8">
        <div className="max-w-2xl w-full space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">ACCESS GRANTED</h1>
            <div className="border border-green-400 p-6 bg-gray-900">
              <h2 className="text-2xl font-bold mb-4 text-green-300">CLASSIFIED INTELLIGENCE</h2>
              <div className="text-left space-y-4">
                <p>okay...nice job.</p>
                <p>but that was easy.</p>
                <p>Head back to the classroom and see if you can find the next password.</p>
                <p className="text-red-400 mt-6">This intelligence will self-destruct in your memory.</p>
              </div>
            </div>
            <button
              onClick={() => {
                localStorage.setItem('challengeCompleted', JSON.stringify({
                  challengeIndex: 0,
                  challengeName: "Little Caesar's Secret",
                  timestamp: Date.now()
                }));
                window.close();
              }}
              className="mt-6 px-6 py-2 border border-green-400 bg-transparent text-green-400 hover:bg-green-400 hover:text-black transition-colors"
            >
              RETURN TO BASE
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-mono flex flex-col items-center justify-center p-8">
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
          <h1 className="text-4xl font-bold mb-2">CLASSIFIED ACCESS</h1>
          <p className="text-gray-400">RESTRICTED ZONE</p>
        </div>
        
        <div className="border border-white p-8 bg-gray-900">
          <h2 className="text-xl font-bold mb-6 text-center">ENTER DECRYPTED CREDENTIALS</h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold mb-2" htmlFor="password">
                PASSWORD
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-black border border-white text-white font-mono focus:outline-none focus:border-green-400"
                  placeholder="ENTER DECRYPTED ID"
                  disabled={loading}
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 border border-white bg-transparent text-white hover:bg-white hover:text-black transition-colors disabled:opacity-50"
            >
              {loading ? 'VERIFYING...' : 'ACCESS SYSTEM'}
            </button>
          </form>
          
          <div className="mt-6 text-xs text-gray-500 text-center">
            <p>UNAUTHORIZED ACCESS IS PROHIBITED</p>
            <p>ID: {uniqueId}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChallengeSite;