import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, Zap, Users, Eye, EyeOff } from 'lucide-react';
import { getChallengeData, initiateChallenge, deactivateChallenge } from '../API/apiChallenge';
import toast from 'react-hot-toast';

const Challenge = () => {
  const { classroomId } = useParams();
  // const { user } = useAuth();
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

  useEffect(() => {
    fetchChallengeData();
  }, [classroomId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <span className="loading loading-ring loading-lg"></span>
      </div>
    );
  }

  // Teacher View
  if (isTeacher) {
    return (
      <div className="p-6 space-y-8">
        <div className="card bg-base-100 border border-base-200 shadow-md rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-8 h-8 text-red-500" />
            <h1 className="text-3xl font-bold text-base-content">Cyber Challenge</h1>
          </div>
          <p className="text-gray-600 text-lg mb-6">
            Initiate a cyber challenge for your students. Each student will receive a unique ID and encrypted password to solve.
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
                <h3 className="text-xl font-semibold mb-4">Student Challenge Data</h3>
                <div className="overflow-x-auto">
                  <table className="table table-zebra w-full">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Unique ID</th>
                        <th>Hashed Password</th>
                        <th>Progress</th>
                      </tr>
                    </thead>
                    <tbody>
                      {challengeData.userChallenges.map((uc) => (
                        <tr key={uc._id}>
                          <td className="font-medium">
                            {uc.userId.firstName} {uc.userId.lastName}
                            <br />
                            <span className="text-sm text-gray-500">{uc.userId.email}</span>
                          </td>
                          <td>
                            <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                              {uc.uniqueId}
                            </code>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                                {showPasswords[uc.userId._id] ? uc.hashedPassword : '••••••••'}
                              </code>
                              <button
                                onClick={() => togglePasswordVisibility(uc.userId._id)}
                                className="btn btn-ghost btn-xs"
                              >
                                {showPasswords[uc.userId._id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </td>
                          <td>
                            <div className="badge badge-outline">
                              Step {uc.progress + 1}
                            </div>
                          </td>
                        </tr>
                      ))}
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
      <div className="card bg-base-100 border border-base-200 shadow-md rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-8 h-8 text-red-500" />
          <h1 className="text-3xl font-bold text-base-content">Cyber Challenge</h1>
        </div>
        <p className="text-gray-600 text-lg">
          Welcome to the Cyber Challenge! Test your cryptographic and problem-solving skills.
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
          <div className="card bg-base-100 border border-base-200 shadow-md rounded-2xl p-6">
            <h2 className="text-2xl font-bold mb-4">Your Mission</h2>
            <p className="text-gray-600 mb-4">
              You have been assigned a unique encrypted ID. Your mission is to decrypt this ID to reveal the password needed to access the first challenge site.
            </p>
            
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-4">
              <h3 className="font-semibold text-lg mb-3 text-red-800">🔐 Encrypted ID</h3>
              <code className="bg-white px-4 py-3 rounded text-2xl font-mono text-red-600 block text-center border">
                {userChallenge.uniqueId}
              </code>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-2">🎯 Your Goal</h4>
                <p className="text-sm text-blue-700">
                  Decrypt the ID above to get the password for accessing the challenge website.
                </p>
              </div>
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-semibold text-green-800 mb-2">💡 Hint</h4>
                <p className="text-sm text-green-700">
                  Think about simple letter/number shifting techniques. What if each character moved forward by a certain amount?
                </p>
              </div>
            </div>
            
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Remember:</strong> Each student has a unique encrypted ID, so you can't share answers with classmates!
              </p>
            </div>
          </div>

          <div className="card bg-base-100 border border-base-200 shadow-md rounded-2xl p-6">
            <h2 className="text-2xl font-bold mb-4">Cyber Challenge Series - Fall Semester</h2>
            <p className="text-gray-600 mb-6">Complete challenges throughout the semester to test your cybersecurity skills.</p>
            
            <div className="card bg-red-50 border border-red-200 shadow-sm p-6 mb-4">
              <div className="flex items-start gap-4">
                <div className="badge badge-error badge-lg">Challenge 1</div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2">🔓 Breaking the Code</h3>
                  <p className="text-gray-600 mb-4">
                    Your first mission: decrypt your unique ID to access a password-protected intelligence site.
                  </p>
                  
                  <div className="bg-white p-4 rounded border mb-4">
                    <p className="text-sm text-gray-600 mb-2">Once you decrypt your ID, access:</p>
                    <code className="text-blue-600 font-mono text-sm">
                      puzzle.wayneaws.dev/[your-decrypted-password]
                    </code>
                  </div>
                  
                  <div className="flex gap-3">
                    <button 
                      className="btn btn-error btn-sm"
                      onClick={() => {
                        const url = prompt("Enter your decrypted password to access the site:");
                        if (url) window.open(`https://puzzle.wayneaws.dev/${url.toLowerCase()}`, '_blank');
                      }}
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      Enter Decrypted Password
                    </button>
                  </div>
                  
                  <div className="mt-4 text-sm text-gray-500">
                    <strong>Status:</strong> {userChallenge.progress >= 1 ? '✅ Completed' : '🔄 In Progress'}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="card bg-gray-50 border border-gray-200 shadow-sm p-4 opacity-60">
                <div className="flex items-center gap-3">
                  <div className="badge badge-neutral">Challenge 2</div>
                  <span className="text-gray-600">🕵️ Social Engineering Defense (Coming Soon)</span>
                </div>
              </div>
              <div className="card bg-gray-50 border border-gray-200 shadow-sm p-4 opacity-60">
                <div className="flex items-center gap-3">
                  <div className="badge badge-neutral">Challenge 3</div>
                  <span className="text-gray-600">🌐 Network Security Analysis (Coming Soon)</span>
                </div>
              </div>
              <div className="card bg-gray-50 border border-gray-200 shadow-sm p-4 opacity-60">
                <div className="flex items-center gap-3">
                  <div className="badge badge-neutral">Challenge 4</div>
                  <span className="text-gray-600">🔐 Advanced Cryptography (Coming Soon)</span>
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
