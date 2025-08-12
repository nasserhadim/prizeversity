import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Lock, Play, FileText, Bug, CheckCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE } from '../config/api';

const Challenge3Site = () => {
  const { uniqueId } = useParams();
  const [loading, setLoading] = useState(true);
  const [studentData, setStudentData] = useState(null);
  const [codeFiles, setCodeFiles] = useState({});
  const [testResults, setTestResults] = useState([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [hints, setHints] = useState([]);
  const [bugDescription, setBugDescription] = useState('');

  useEffect(() => {
    fetchChallengeData();
  }, [uniqueId]);

  const fetchChallengeData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/challenges/challenge3/${uniqueId}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to load challenge data');
      }
      
      const data = await response.json();
      setStudentData(data.studentData);
      setCodeFiles(data.codeFiles);
      setBugDescription(data.codeFiles.bugDescription || '');
      
    } catch (error) {
      toast.error(error.message || 'Failed to load challenge');
    } finally {
      setLoading(false);
    }
  };

  const runCode = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/challenges/challenge3/${uniqueId}/test`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeFiles })
      });
      
      const data = await response.json();
      setTestResults(data.testResults);
      setAttempts(prev => prev + 1);
      
      if (data.success) {
        setShowSuccess(true);
        toast.success('All tests passed! Password revealed!');
      } else {
        if (attempts >= 1 && data.hints && data.hints.length > 0) {
          setHints(prev => [...prev, ...data.hints]);
        }
        toast.error(`${data.passedTests}/${data.totalTests} tests passed`);
      }
      
    } catch (error) {
      toast.error('Failed to test code');
    } finally {
      setLoading(false);
    }
  };

  const updateCode = (newCode) => {
    setCodeFiles(prev => ({
      ...prev,
      'main.cpp': newCode
    }));
  };

  if (loading && !codeFiles['main.cpp']) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-green-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Loading challenge environment...</p>
        </div>
      </div>
    );
  }

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gray-900 text-green-400 font-mono flex flex-col items-center justify-center p-8">
        <div className="max-w-2xl w-full space-y-8 text-center">
          <CheckCircle size={64} className="mx-auto text-green-400 animate-pulse" />
          <h1 className="text-4xl font-bold">BUG FIXED!</h1>
          <div className="border border-green-400 p-8 bg-gray-800 rounded-lg">
            <h2 className="text-2xl font-bold mb-4 text-green-300">CHALLENGE 3 COMPLETE</h2>
            <p className="mb-4">Security vulnerability patched successfully!</p>
            <p className="text-green-300">Challenge 4 is now unlocked - ready for digital forensics investigation!</p>
            <div className="mt-4 text-sm text-gray-400">
              <p>Debugging attempts: {attempts}</p>
              <p>Student ID: {studentData?.hashedId?.slice(0, 8)}</p>
            </div>
          </div>
          <button
            onClick={() => {
              localStorage.setItem('challengeCompleted', JSON.stringify({
                challengeIndex: 2,
                challengeName: "Security Bug Fix",
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

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="bg-black border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Bug className="text-red-500" size={24} />
            <div>
              <h1 className="text-xl font-bold">Challenge 3: Security Bug Fix</h1>
              <p className="text-gray-400 text-sm">{bugDescription}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-400">
              Student: {studentData?.firstName} {studentData?.lastName}
            </div>
            <button
              onClick={runCode}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
            >
              <Play size={16} />
              {loading ? 'Testing...' : 'Run Tests'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-gray-800 rounded-lg border border-gray-700 h-[600px]">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="font-bold">main.cpp</h3>
              <div className="text-sm text-gray-400">
                Lines: {codeFiles['main.cpp']?.split('\n').length || 0}
              </div>
            </div>
            <textarea
              value={codeFiles['main.cpp'] || ''}
              onChange={(e) => updateCode(e.target.value)}
              className="w-full h-[calc(100%-60px)] p-4 bg-gray-900 text-white font-mono text-sm resize-none border-0 outline-none focus:ring-2 focus:ring-blue-500"
              spellCheck={false}
              style={{ 
                tabSize: 2,
                lineHeight: '1.5',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace'
              }}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              placeholder="Loading code..."
            />
          </div>
          
          {hints.length > 0 && (
            <div className="mt-6 bg-yellow-900 border border-yellow-600 rounded-lg">
              <div className="p-4 border-b border-yellow-600">
                <h3 className="font-bold flex items-center gap-2 text-yellow-300">
                  <AlertTriangle size={16} />
                  Debug Hints
                </h3>
              </div>
              <div className="p-4 space-y-2">
                {hints.map((hint, idx) => (
                  <p key={idx} className="text-yellow-200 text-sm">
                    💡 {hint}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg border border-gray-700">
              <div className="p-4 border-b border-gray-700">
                <h3 className="font-bold">Test Results</h3>
              </div>
              <div className="p-4">
                {testResults.length === 0 ? (
                  <p className="text-gray-400 text-sm">Run tests to see results</p>
                ) : (
                  <div className="space-y-2">
                    {testResults.map((result, idx) => (
                      <div key={idx} className={`p-2 rounded text-sm ${
                        result.passed 
                          ? 'bg-green-900 text-green-300 border border-green-600' 
                          : 'bg-red-900 text-red-300 border border-red-600'
                      }`}>
                        <div className="flex items-center gap-2">
                          {result.passed ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                          <span>{result.name}</span>
                        </div>
                        {result.error && (
                          <div className="mt-1 text-xs opacity-80">
                            {result.error}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
                
            <div className="bg-gray-800 rounded-lg border border-gray-700">
              <div className="p-4 border-b border-gray-700">
                <h3 className="font-bold">Challenge Info</h3>
              </div>
              <div className="p-4 text-sm text-gray-300 space-y-2">
                <p><strong>Objective:</strong> Fix the security vulnerability in the code</p>
                <p><strong>Method:</strong> Edit the code to correct the bug</p>
                <p><strong>Success:</strong> When fixed, you'll get your password</p>
                <p className="text-yellow-400"><strong>Tip:</strong> Read error messages carefully for clues</p>
                <div className="mt-4 p-3 bg-gray-700 rounded text-xs">
                  <p><strong>Bug Type:</strong> {bugDescription}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Challenge3Site;
