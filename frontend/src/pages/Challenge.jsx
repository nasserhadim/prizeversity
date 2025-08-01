import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, Zap, Users, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { getChallengeData, initiateChallenge, deactivateChallenge } from '../API/apiChallenge';
import { API_BASE } from '../config/api';
import toast from 'react-hot-toast';

const Challenge = () => {
  const { classroomId } = useParams();
  const { user, originalUser, setPersona } = useAuth();
  const [challengeData, setChallengeData] = useState(null);
  const [userChallenge, setUserChallenge] = useState(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [loading, setLoading] = useState(true);
  const [initiating, setInitiating] = useState(false);
  const [showPasswords, setShowPasswords] = useState({});

  const fetchChallengeData = async () => {
    try {
      setLoading(true);
      const response = await getChallengeData(classroomId);
      setChallengeData(response.challenge);
      setUserChallenge(response.userChallenge);
      setIsTeacher(response.isTeacher);
    } catch (error) {
      console.error('Error fetching challenge data:', error);
      toast.error('Failed to load challenge data');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchToTeacher = () => {
    setPersona(originalUser);
  };

  const isTeacherInStudentView = originalUser?.role === 'teacher' && user.role === 'student';

  // Initiate cyber challenge (Teacher only)
  const handleInitiateChallenge = async () => {
    try {
      setInitiating(true);
      const response = await initiateChallenge(classroomId);
      setChallengeData(response.challenge);
      toast.success(response.message);
      await fetchChallengeData(); // Refresh data
    } catch (error) {
      console.error('Error initiating challenge:', error);
      toast.error(error.message || 'Failed to initiate challenge');
    } finally {
      setInitiating(false);
    }
  };

  // Deactivate cyber challenge (Teacher only)
  const handleDeactivateChallenge = async () => {
    try {
      setInitiating(true);
      const response = await deactivateChallenge(classroomId);
      setChallengeData(response.challenge);
      toast.success(response.message);
      await fetchChallengeData(); // Refresh data
    } catch (error) {
      console.error('Error deactivating challenge:', error);
      toast.error(error.message || 'Failed to deactivate challenge');
    } finally {
      setInitiating(false);
    }
  };

  const togglePasswordVisibility = (userId) => {
    setShowPasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const getCurrentChallenge = (progress) => {
    if (progress === 0) {
      return {
        number: 1,
        name: "Little Caesar's Secret",
        method: "Caesar Cipher (Shift +3)",
        type: "caesar"
      };
    } else if (progress === 1) {
      return {
        number: 2,
        name: "Check Me Out", 
        method: "OSINT & Git Exploration",
        type: "github"
      };
    /* } else if (progress === 2) {
      return {
        number: 3,
        name: "Network Security Analysis",
        method: "Traffic Analysis", 
        type: "network"
      };
    } else { */
      return {
        number: 4,
        name: "Advanced Cryptography",
        method: "Multi-layer Encryption",
        type: "crypto"
      };
    }
  };

  useEffect(() => {
    fetchChallengeData();
  }, [classroomId]);

  useEffect(() => {
    const handleFocus = () => {
      fetchChallengeData();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <span className="loading loading-ring loading-lg"></span>
      </div>
    );
  }

  const first_challenge = "Little Caesar’s Secret"

  if (isTeacher && !isTeacherInStudentView) {
    return (
      <div className="p-6 space-y-8">
        <div className="card bg-base-100 border border-base-200 shadow-md rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-8 h-8 text-red-500" />
            <h1 className="text-3xl font-bold text-base-content">Cyber Challenge</h1>
          </div>
          <p className="text-gray-600 text-lg mb-6">
            Initiate Challenge 1: Little Caesar's Secret. Each student will receive a unique Caesar cipher encrypted word to decrypt.
          </p>
          
          <div className="flex gap-4">
            {!challengeData || !challengeData.isActive ? (
              <button
                onClick={handleInitiateChallenge}
                disabled={initiating}
                className="btn btn-error btn-lg gap-2"
              >
                {initiating ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  <Zap className="w-5 h-5" />
                )}
                Initiate Cyber Challenge
              </button>
            ) : (
              <button
                onClick={handleDeactivateChallenge}
                disabled={initiating}
                className="btn btn-warning btn-lg gap-2"
              >
                {initiating ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  <Shield className="w-5 h-5" />
                )}
                Deactivate Challenge
              </button>
            )}
          </div>
        </div>

        {challengeData && (
          <div className="card bg-base-100 border border-base-200 shadow-md rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Users className="w-6 h-6 text-blue-500" />
              <h2 className="text-2xl font-bold">Challenge Status</h2>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="stat bg-base-200 rounded-lg p-4">
                <div className="stat-title">Status</div>
                <div className={`stat-value text-lg ${challengeData.isActive ? 'text-success' : 'text-warning'}`}>
                  {challengeData.isActive ? 'Active' : 'Inactive'}
                </div>
              </div>
              <div className="stat bg-base-200 rounded-lg p-4">
                <div className="stat-title">Participants</div>
                <div className="stat-value text-lg text-blue-500">
                  {challengeData.userChallenges?.length || 0}
                </div>
              </div>
            </div>

            {/* Student Challenge Data */}
            {challengeData.isActive && challengeData.userChallenges && challengeData.userChallenges.length > 0 && (
              <div className="mt-6">
                <h3 className="text-xl font-semibold mb-4">Student Challenge Progress</h3>
                <div className="overflow-x-auto">
                  <table className="table table-zebra w-full">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Current Challenge</th>
                        <th>Challenge Data</th>
                        <th>Solution</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {challengeData.userChallenges.map((uc) => {
                        const currentChallenge = getCurrentChallenge(uc.progress);
                        return (
                          <tr key={uc._id}>
                            <td className="font-medium">
                              {uc.userId.firstName} {uc.userId.lastName}
                              <br />
                              <span className="text-sm text-gray-500">{uc.userId.email}</span>
                            </td>
                            <td>
                              <div className="flex flex-col">
                                <span className="font-semibold">Challenge {currentChallenge.number}</span>
                                <span className="text-sm text-gray-600">{currentChallenge.name}</span>
                                <span className="text-xs text-gray-500">{currentChallenge.method}</span>
                              </div>
                            </td>
                            <td>
                              {currentChallenge.type === 'caesar' && (
                                <code className="bg-red-100 px-2 py-1 rounded text-sm font-mono text-red-700">
                                  {uc.uniqueId}
                                </code>
                              )}
                              {currentChallenge.type === 'github' && (
                                <span className="text-sm text-blue-600 font-medium">GitHub Branch: {uc.uniqueId}</span>
                              )}
                              {currentChallenge.type === 'network' && (
                                <span className="text-sm text-purple-600 font-medium">Network Logs</span>
                              )}
                              {currentChallenge.type === 'crypto' && (
                                <span className="text-sm text-indigo-600 font-medium">Encrypted Files</span>
                              )}
                            </td>
                            <td>
                              {currentChallenge.type === 'caesar' && (
                                <div className="flex items-center gap-2">
                                  <code className="bg-green-100 px-2 py-1 rounded text-sm font-mono text-green-700">
                                    {showPasswords[uc.userId._id] ? uc.hashedPassword : '••••••••'}
                                  </code>
                                  <button
                                    onClick={() => togglePasswordVisibility(uc.userId._id)}
                                    className="btn btn-ghost btn-xs"
                                  >
                                    {showPasswords[uc.userId._id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                  </button>
                                </div>
                              )}
                              {currentChallenge.type === 'github' && (
                                <code className="bg-green-100 px-2 py-1 rounded text-sm font-mono text-green-700">
                                  GITHUB-{uc.uniqueId.slice(-4).toUpperCase()}
                                </code>
                              )}
                              {(currentChallenge.type !== 'caesar' && currentChallenge.type !== 'github') && (
                                <span className="text-sm text-gray-500">Interactive Challenge</span>
                              )}
                            </td>
                            <td>
                              <div className={`badge ${uc.progress >= currentChallenge.number ? 'badge-success' : 'badge-warning'}`}>
                                {uc.progress >= currentChallenge.number ? 'Completed' : 'In Progress'}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {isTeacherInStudentView && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="card bg-primary text-primary-content shadow-xl">
            <div className="card-body p-4">
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4" />
                <span className="text-sm">Teacher Mode</span>
                <button
                  onClick={handleSwitchToTeacher}
                  className="btn btn-sm btn-secondary gap-1"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Exit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card bg-base-100 border border-base-200 shadow-md rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-8 h-8 text-red-500" />
          <h1 className="text-3xl font-bold text-base-content">Cyber Challenge</h1>
        </div>
        <p className="text-gray-600 text-lg">
          Welcome to WSU's Cyber Challenge! Employ your skills to solve the challenges and earn bits to spend in the bazaar!
        </p>
      </div>

      {!challengeData || !challengeData.isActive ? (
        <div className="card bg-base-100 border border-base-200 shadow-md rounded-2xl p-6 text-center">
          <div className="flex flex-col items-center gap-4">
            <Lock className="w-16 h-16 text-gray-400" />
            <h2 className="text-2xl font-semibold text-gray-600">No Active Challenge</h2>
            <p className="text-gray-500">
              Your instructor hasn't initiated a cyber challenge yet. Check back later!
            </p>
          </div>
        </div>
      ) : userChallenge ? (
        <div className="space-y-6">
          {/* Main Challenge Container */}
          <div className="card bg-base-100 border border-base-200 shadow-md rounded-2xl p-6">
            <h2 className="text-2xl font-bold mb-6">Cyber Challenge Series - Fall Semester</h2>
            
            {/* Challenge 1 - Little Caesar's Secret */}
            <div className={`collapse collapse-arrow mb-4 ${userChallenge.progress >= 1 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <input type="checkbox" defaultChecked={userChallenge.progress < 1} className="peer" />
              <div className="collapse-title text-xl font-medium flex items-center gap-3">
                <div className={`badge badge-lg ${userChallenge.progress >= 1 ? 'badge-success' : 'badge-error'}`}>Challenge 1</div>
                <span className={userChallenge.progress >= 1 ? 'text-green-800' : 'text-red-800'}>🔓 Little Caesar's Secret</span>
                <div className="ml-auto text-sm text-gray-500">
                  {userChallenge.progress >= 1 ? '✅ Completed' : '🔄 In Progress'}
                </div>
              </div>
              <div className="collapse-content">
                <div className="pt-4 space-y-4">
                  <p className="text-gray-600">
                    Your mission: decrypt your unique ID to access a password-protected intelligence site.
                  </p>
                  
                  <div className="bg-white border border-red-300 rounded-lg p-4">
                    <h4 className="font-semibold text-red-800 mb-3">🔐 Your Encrypted ID</h4>
                    <code className="bg-red-100 px-4 py-3 rounded text-2xl font-mono text-red-600 block text-center border">
                      {userChallenge.uniqueId}
                    </code>
                  </div>
                  
                  <div className="bg-white border border-red-300 rounded-lg p-4">
                    <h4 className="font-semibold text-red-800 mb-2">📋 Instructions</h4>
                    <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
                      <li>Decrypt the encrypted ID above using cryptographic techniques</li>
                      <li>Use your decrypted result as the password</li>
                      <li>Access the challenge site with your password</li>
                    </ol>
                  </div>
                  
                  <div className="bg-white border border-red-300 rounded-lg p-4">
                    <h4 className="font-semibold text-red-800 mb-2">🌐 Challenge Site</h4>
                    <p className="text-sm text-gray-600 mb-3">Once you decrypt your ID, access the challenge site:</p>
                    <code className="text-blue-600 font-mono text-sm block mb-3">
                      /challenge-site/{userChallenge.uniqueId}
                    </code>
                    <button 
                      className="btn btn-error btn-sm"
                      onClick={() => {
                        window.open(`/challenge-site/${userChallenge.uniqueId}`, '_blank');
                      }}
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      Access Challenge Site
                    </button>
                  </div>
                  
                  {/* Warning */}
                  <div className="alert alert-warning">
                    <span className="text-sm">
                      <strong>Remember:</strong> Each student has a unique encrypted ID, so you can't share answers with classmates!
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Challenge 2 - Check Me Out */}
            <div className="space-y-3">
              <div className={`collapse collapse-arrow ${userChallenge.progress >= 1 ? (userChallenge.progress >= 2 ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200') : 'bg-gray-50 border border-gray-200 opacity-60'}`}>
                {userChallenge.progress >= 1 && <input type="checkbox" defaultChecked={userChallenge.progress < 2} className="peer" />}
                <div className="collapse-title text-lg font-medium flex items-center gap-3">
                  <div className={`badge ${userChallenge.progress >= 2 ? 'badge-success' : userChallenge.progress >= 1 ? 'badge-info' : 'badge-neutral'}`}>Challenge 2</div>
                  <span className={userChallenge.progress >= 2 ? 'text-green-800' : userChallenge.progress >= 1 ? 'text-blue-800' : 'text-gray-600'}>🔍 Check Me Out</span>
                  <div className="ml-auto text-sm text-gray-400">
                    {userChallenge.progress >= 2 ? '✅ Completed' : userChallenge.progress >= 1 ? '🔓 Unlocked' : '🔒 Locked'}
                  </div>
                </div>
                {userChallenge.progress >= 1 && (
                  <div className="collapse-content">
                    <div className="pt-4 space-y-4">
                      <p className="text-gray-600">
                        Your mission: Follow the digital trail and find your password to the next challenge.
                      </p>
                      
                      <div className="bg-white border border-blue-300 rounded-lg p-4">
                        <h4 className="font-semibold text-blue-800 mb-3">🔗 Your Starting Point</h4>
                        <div className="space-y-3">
                          <div>
                            <span className="text-sm font-medium text-gray-700">LinkedIn Profile:</span>
                            <br />
                            <a 
                              href="https://www.linkedin.com/in/paul-glantz-1b3488378/" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 underline"
                            >
                              linkedin.com/in/paul-glantz-1b3488378/
                            </a>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-700">Your Unique ID:</span>
                            <br />
                            <code className="bg-blue-100 px-2 py-1 rounded text-blue-800 font-mono">
                              {userChallenge.uniqueId}
                            </code>
                          </div>
                        </div>
                      </div>                 
                      
                      <div className="bg-white border border-blue-300 rounded-lg p-4">
                        <h4 className="font-semibold text-blue-800 mb-2">Challenge Terminal</h4>
                        <p className="text-sm text-gray-600 mb-3">Once you find your password, access the challenge terminal:</p>
                        <code className="text-blue-600 font-mono text-sm block mb-3">
                          /challenge-2-site/{userChallenge.uniqueId}
                        </code>
                        <button 
                          className="btn btn-info btn-sm"
                          onClick={() => {
                            window.open(`/challenge-2-site/${userChallenge.uniqueId}`, '_blank');
                          }}
                        >
                          <Lock className="w-4 h-4 mr-2" />
                          Access Challenge Terminal
                        </button>
                      </div>
                      
                      <div className="alert alert-warning">
                        <span className="text-sm">
                          <strong>Remember:</strong> Your unique ID is the key to finding your personal password!
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="collapse bg-gray-50 border border-gray-200 opacity-60">
                <div className="collapse-title text-lg font-medium flex items-center gap-3">
                  <div className="badge badge-neutral">Challenge 3</div>
                  <span className="text-gray-600">🌐 Network Security Analysis</span>
                  <div className="ml-auto text-sm text-gray-400">Coming Soon</div>
                </div>
              </div>
              
              <div className="collapse bg-gray-50 border border-gray-200 opacity-60">
                <div className="collapse-title text-lg font-medium flex items-center gap-3">
                  <div className="badge badge-neutral">Challenge 4</div>
                  <span className="text-gray-600">🔐 Advanced Cryptography</span>
                  <div className="ml-auto text-sm text-gray-400">Coming Soon</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card bg-base-100 border border-base-200 shadow-md rounded-2xl p-6 text-center">
          <div className="flex flex-col items-center gap-4">
            <Lock className="w-16 h-16 text-gray-400" />
            <h2 className="text-2xl font-semibold text-gray-600">Challenge Not Assigned</h2>
            <p className="text-gray-500">
              You haven't been assigned to this challenge yet. Please contact your instructor.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Challenge;
