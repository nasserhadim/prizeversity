import { useState, useEffect, useRef } from 'react';
import { Shield, Settings, Users, Eye, EyeOff, UserPlus } from 'lucide-react';
import { getCurrentChallenge } from '../../utils/challengeUtils';
import { getThemeClasses } from '../../utils/themeUtils';
import { updateDueDate } from '../../API/apiChallenge';
import toast from 'react-hot-toast';
import socket from '../../utils/socket';

const TeacherView = ({ 
  challengeData,
  setChallengeData,
  isDark,
  handleShowConfigModal,
  handleShowDeactivateModal,
  initiating,
  classroomStudents = [],
  classroom,
  classroomId,
  fetchChallengeData
}) => {
  const [showPasswords, setShowPasswords] = useState({});
  const [showDueDateModal, setShowDueDateModal] = useState(false);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [studentNames, setStudentNames] = useState({});
  const [challenge6Data, setChallenge6Data] = useState({});
  const [challenge7Data, setChallenge7Data] = useState({});
  const [localDueDate, setLocalDueDate] = useState('');
  const dropdownRef = useRef(null);
  const themeClasses = getThemeClasses(isDark);

  useEffect(() => {
    if (challengeData?.settings?.dueDate) {
      // Convert UTC date from server to local datetime-local format
      const date = new Date(challengeData.settings.dueDate);
      const localISOString = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setLocalDueDate(localISOString);
    } else {
      setLocalDueDate('');
    }
  }, [challengeData?.settings?.dueDate]);

  // Use the userChallenge _id (uc._id) as the toggle key so each row is stable
  const togglePasswordVisibility = (ucId) => {
    setShowPasswords(prev => ({
      ...prev,
      [ucId]: !prev[ucId]
    }));
  };

  // Find students not assigned to the challenge
  // We've found that in cases where a student joins the class after the challenge is created, they are not automatically assigned to the challenge.
  const assignedStudentIds = challengeData?.userChallenges
    ?.filter(uc => uc.userId && uc.userId._id) // Filter out entries with undefined userId or _id
    ?.map(uc => uc.userId._id) || [];
  
  const unassignedStudentIds = (classroomStudents || [])
    .map(student => typeof student === 'string' ? student : student._id) // Extract ID regardless of structure
    .filter(studentId => studentId && !assignedStudentIds.includes(studentId)); // Filter out assigned students

  useEffect(() => {
    const fetchStudentNames = async () => {
      const newStudentNames = {};
      for (const studentId of unassignedStudentIds) {
        if (!studentNames[studentId]) {
          try {
            const response = await fetch(`/api/profile/student/${studentId}`, {
              credentials: 'include'
            });
            if (response.ok) {
              const student = await response.json();
              newStudentNames[studentId] = `${student.firstName} ${student.lastName}`;
            } else {
              newStudentNames[studentId] = `Student ${studentId.substring(0, 8)}...`;
            }
          } catch (error) {
            console.error('Error fetching student name:', error);
            newStudentNames[studentId] = `Student ${studentId.substring(0, 8)}...`;
          }
        }
      }
      if (Object.keys(newStudentNames).length > 0) {
        setStudentNames(prev => ({ ...prev, ...newStudentNames }));
      }
    };

    if (unassignedStudentIds.length > 0) {
      fetchStudentNames();
    }
  }, [unassignedStudentIds.join(',')]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowAssignDropdown(false);
      }
    };

    if (showAssignDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showAssignDropdown]);

  const handleAssignStudent = async (studentId) => {
    try {
      const challengeId = challengeData?.challenge?._id || challengeData?._id;
      
      if (!challengeId) {
        toast.error('Challenge ID not found');
        return;
      }

      const response = await fetch(`/api/challenges/${challengeId}/assign-student`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ studentId })
      });
      
      if (response.ok) {
        toast.success('Student assigned to challenge successfully');
        setShowAssignDropdown(false);
        await fetchChallengeData();
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Failed to assign student');
      }
    } catch (error) {
      toast.error('Error assigning student');
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showAssignDropdown && !event.target.closest('.relative')) {
        setShowAssignDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAssignDropdown]);

  useEffect(() => {
    const fetchChallenge6Data = async () => {
      if (!challengeData?.userChallenges) return;
      
      const newChallenge6Data = {};
      
      for (const uc of challengeData.userChallenges) {
        if (uc.progress === 5 || uc.currentChallenge === 5) {
          try {
            const response = await fetch(`/api/challenges/challenge6/${uc.uniqueId}`, {
              credentials: 'include'
            });
            
            if (response.ok) {
              const data = await response.json();
              newChallenge6Data[uc.uniqueId] = {
                word: data.generatedWord,
                tokenId: data.expectedTokenId || 'Loading...'
              };
            }
          } catch (error) {
            console.error('Error fetching Challenge 6 data:', error);
            newChallenge6Data[uc.uniqueId] = {
              word: 'Error loading',
              tokenId: 'Error'
            };
          }
        }
      }
      
      setChallenge6Data(newChallenge6Data);
    };

    fetchChallenge6Data();
  }, [challengeData?.userChallenges]);

  // Socket listener for real-time Challenge 7 updates
  useEffect(() => {
    const handleChallenge7Progress = (progressData) => {
      console.log('🔄 Real-time Challenge 7 update received:', {
        userId: progressData.userId,
        uniqueId: progressData.uniqueId,
        word: progressData.word,
        revealedCount: progressData.revealedWordsCount,
        totalCount: progressData.totalWordsCount,
        isFinished: progressData.isCompletelyFinished
      });
      
      setChallengeData(prevData => {
        if (!prevData || !prevData.userChallenges) {
          console.log('⚠️ No challenge data available for update');
          return prevData;
        }
        
        const matchingStudent = prevData.userChallenges.find(uc => 
          uc.uniqueId === progressData.uniqueId && uc.userId._id === progressData.userId
        );
        
        if (!matchingStudent) {
          console.log('⚠️ No matching student found for progress update:', {
            searchingFor: { uniqueId: progressData.uniqueId, userId: progressData.userId },
            availableStudents: prevData.userChallenges.map(uc => ({ uniqueId: uc.uniqueId, userId: uc.userId._id }))
          });
          return prevData;
        }
        
        console.log('✅ Updating progress for student:', matchingStudent.userId.username || matchingStudent.userId.email);
        
        return {
          ...prevData,
          userChallenges: prevData.userChallenges.map(uc => {
            if (uc.uniqueId === progressData.uniqueId && uc.userId._id === progressData.userId) {
              return {
                ...uc,
                challenge7Progress: {
                  revealedWords: progressData.revealedWords,
                  totalWords: progressData.totalWordsCount
                },
                ...(progressData.isCompletelyFinished && {
                  completedChallenges: {
                    ...uc.completedChallenges,
                    6: true
                  }
                })
              };
            }
            return uc;
          })
        };
      });
    };

    console.log('🔌 Setting up Challenge 7 socket listener');
    socket.on('challenge7_progress', handleChallenge7Progress);
    
    return () => {
      console.log('🔌 Cleaning up Challenge 7 socket listener');
      socket.off('challenge7_progress', handleChallenge7Progress);
    };
  }, [setChallengeData]);

  useEffect(() => {
    const fetchChallenge7Data = async () => {
      if (!challengeData?.userChallenges) return;
      
      const newChallenge7Data = {};
      
      for (const uc of challengeData.userChallenges) {
        if (uc.progress === 6 || uc.currentChallenge === 6) {
          try {
            const timestamp = Date.now();
            const response = await fetch(`/api/challenges/challenge7/${uc.uniqueId}?t=${timestamp}&bustCache=true`, {
              credentials: 'include',
              headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
              }
            });
            
            if (response.ok) {
              const data = await response.json();
              
              if (data.uniqueId && data.uniqueId !== uc.uniqueId) {
                console.warn(`Challenge 7 data mismatch! Expected ${uc.uniqueId}, got ${data.uniqueId}`);
                continue;
              }
              
              const uniqueWords = [...new Set(data.words.map(w => w.toLowerCase()))];
              newChallenge7Data[uc.uniqueId] = {
                quote: data.quote,
                author: data.author,
                words: data.words,
                uniqueWords: uniqueWords,
                wordTokens: data.wordTokens,
                uniqueId: data.uniqueId || uc.uniqueId,
                fetchedAt: timestamp
              };
            } else {
              console.error(`Failed to fetch Challenge 7 data for ${uc.uniqueId}:`, response.status);
              newChallenge7Data[uc.uniqueId] = {
                quote: 'Error loading - please refresh',
                author: 'Error',
                words: [],
                uniqueWords: [],
                wordTokens: {},
                uniqueId: uc.uniqueId,
                error: true
              };
            }
          } catch (error) {
            console.error('Error fetching Challenge 7 data:', error);
            newChallenge7Data[uc.uniqueId] = {
              quote: 'Connection error - please refresh',
              author: 'Error',
              words: [],
              uniqueWords: [],
              wordTokens: {},
              uniqueId: uc.uniqueId,
              error: true
            };
          }
        }
      }
      
      setChallenge7Data(prevData => {
        const hasChanges = Object.keys(newChallenge7Data).some(uniqueId => 
          !prevData[uniqueId] || 
          prevData[uniqueId].quote !== newChallenge7Data[uniqueId].quote ||
          prevData[uniqueId].error !== newChallenge7Data[uniqueId].error
        );
        
        return hasChanges ? { ...prevData, ...newChallenge7Data } : prevData;
      });
    };

    fetchChallenge7Data();
  }, [challengeData?.userChallenges]);

  return (
    <div className="p-6 space-y-8">
      <div className={themeClasses.cardBase}>
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-8 h-8 text-red-500" />
          <h1 className="text-3xl font-bold text-base-content">
            {classroom?.name
              ? `${classroom.name}${classroom.code ? ` (${classroom.code})` : ''} - Cyber Challenge`
              : 'Cyber Challenge'}
          </h1>
        </div>
        <p className={`${themeClasses.mutedText} text-lg mb-6`}>
          Initiate the complete Cyber Challenge Series. Students will progress through multiple cybersecurity challenges, each with unique encrypted data and passwords to discover.
        </p>
        
        <div className="flex gap-4">
          {!challengeData || !challengeData.isActive ? (
            <button
              onClick={handleShowConfigModal}
              className="btn btn-error btn-lg gap-2 flex-wrap text-sm sm:text-base"
            >
              <Settings className="w-5 h-5" />
              Configure & Launch Challenge Series
            </button>
          ) : (
            <button
              onClick={handleShowDeactivateModal}
              disabled={initiating}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"
            >
              {initiating ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                <Shield className="w-5 h-5" />
              )}
              Delete Challenge
            </button>
          )}
        </div>
      </div>

      {challengeData && challengeData.isActive !== undefined && (
        <div className="card bg-base-100 border border-base-200 shadow-md rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-blue-500" />
              <h2 className="text-2xl font-bold">Challenge Status</h2>
            </div>
            
            {challengeData.isActive && challengeData.userChallenges && unassignedStudentIds.length > 0 && (
              <div className="relative" ref={dropdownRef}>
                <button
                  className="btn btn-sm btn-primary gap-2"
                  onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                >
                  <UserPlus className="w-4 h-4" />
                  Assign Students ({unassignedStudentIds.length})
                </button>
                
                {showAssignDropdown && (
                  <div className="absolute right-0 top-full mt-1 w-64 bg-base-100 border border-base-300 rounded-lg shadow-lg z-50">
                    <div className="p-3">
                      <div className="text-sm font-medium mb-2">Unassigned Students:</div>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {unassignedStudentIds.length > 0 ? (
                          unassignedStudentIds.map((studentId, index) => (
                            <button
                              key={`unassigned-${studentId}-${index}`}
                              onClick={() => handleAssignStudent(studentId)}
                              className="w-full text-left p-2 text-sm hover:bg-base-200 rounded flex items-center justify-between"
                            >
                              <span>{studentNames[studentId] || 'Loading...'}</span>
                              <UserPlus className="w-3 h-3" />
                            </button>
                          ))
                        ) : (
                          <div className="text-xs text-gray-500 p-2">All students are already assigned to this challenge</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className={`stat ${isDark ? 'bg-base-300 border border-base-700' : 'bg-base-200'} rounded-lg p-4`}>
              <div className="stat-title">Status</div>
              <div className={`stat-value text-lg ${challengeData.isActive ? 'text-success' : 'text-warning'}`}>
                {challengeData.isActive ? 'Active' : 'Inactive'}
              </div>
            </div>
            <div className={`stat ${isDark ? 'bg-base-300 border border-base-700' : 'bg-base-200'} rounded-lg p-4`}>
              <div className="stat-title">Participants</div>
              <div className="stat-value text-lg text-blue-500">
                {challengeData.userChallenges?.length || 0}
              </div>
            </div>
          </div>

          {challengeData.isActive && (
            <div className="mt-6">
              <div className={`card ${isDark ? 'bg-base-300 border border-base-700' : 'bg-base-200'} p-4 rounded-lg`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold">Challenge Due Date</h3>
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => setShowDueDateModal(true)}
                  >
                    {challengeData.settings?.dueDateEnabled ? 'Update Due Date' : 'Set Due Date'}
                  </button>
                </div>
                {challengeData.settings?.dueDateEnabled && challengeData.settings?.dueDate ? (
                  <div className={`p-3 rounded-lg ${new Date() > new Date(challengeData.settings.dueDate) ? 'bg-red-900/18 border-red-800 text-red-200' : 'bg-blue-900/12 border-blue-700 text-blue-200'}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        {new Date() > new Date(challengeData.settings.dueDate) ? '⚠️ Expired:' : '⏰ Due:'}
                      </span>
                      <span>
                        {new Date(challengeData.settings.dueDate).toLocaleDateString()} at{' '}
                        {new Date(challengeData.settings.dueDate).toLocaleTimeString()}
                      </span>
                    </div>
                    {new Date() > new Date(challengeData.settings.dueDate) && (
                      <p className="text-sm mt-1">{isDark ? 'This challenge has expired and submissions are disabled.' : 'This challenge has expired and students can no longer submit answers.'}</p>
                    )}
                  </div>
                ) : (
                  <p className={themeClasses.mutedText}>No due date set - challenge remains open indefinitely</p>
                )}
              </div>
            </div>
          )}

          {challengeData.isActive && challengeData.userChallenges && challengeData.userChallenges.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xl font-semibold mb-4">Student Challenge Progress</h3>
              <div className="overflow-x-auto">
                <table className="table table-zebra w-full table-auto text-sm md:text-base">
                  <thead>
                    <tr>
                      <th className="whitespace-nowrap">Student</th>
                      <th className="whitespace-nowrap">Current Challenge</th>
                      <th className="hidden md:table-cell whitespace-nowrap">Challenge Data</th>
                      <th className="whitespace-nowrap">Solution</th>
                      <th className="hidden sm:table-cell whitespace-nowrap">Started At</th>
                      <th className="whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {challengeData.userChallenges
                      .filter(uc => uc.userId)
                      .filter(uc => {
                        const studentInClassroom = classroomStudents.some(studentId => 
                          (typeof studentId === 'string' ? studentId : studentId._id) === uc.userId._id
                        );
                        return studentInClassroom;
                      })
                      .map((uc) => {
                      const challengeNames = ['Little Caesar\'s Secret', 'Check Me Out', 'C++ Bug Hunt', 'I Always Sign My Work...', 'Secrets in the Clouds', 'Needle in a Haystack', 'Hangman'];
                      const workingOnChallenge = uc.currentChallenge !== undefined ? uc.currentChallenge : uc.progress;
                      const workingOnTitle = challengeNames[workingOnChallenge] || 'Unknown Challenge';
                      const currentChallenge = getCurrentChallenge(workingOnChallenge);
                      
                      return (
                        <tr key={uc._id} className="align-top">
                          <td className="font-medium whitespace-normal break-words">
                            {uc.userId.firstName} {uc.userId.lastName}
                            <br />
                            <span className="text-xs md:text-sm text-gray-500 break-words">{uc.userId.email}</span>
                          </td>
                          <td>
                            <div className="flex flex-col">
                              <span className="font-semibold">Challenge {workingOnChallenge + 1}</span>
                              <span className="text-xs md:text-sm text-gray-600">{workingOnTitle}</span>
                              <span className="text-xs text-gray-500">{currentChallenge.method}</span>
                            </div>
                          </td>
                          <td className="hidden md:table-cell">
                            {workingOnChallenge === 0 && (
                              <div className="space-y-1">
                                <code className="bg-red-100 px-2 py-1 rounded text-sm font-mono text-red-700">
                                  {uc.uniqueId}
                                </code>
                                {uc.completedChallenges?.[0] && (
                                  <div className="text-xs text-green-600 font-semibold">✅ Challenge Complete</div>
                                )}
                              </div>
                            )}
                            {workingOnChallenge === 1 && (
                              <div className="space-y-1">
                                <span className="text-sm text-blue-600 font-medium">GitHub Branch: {uc.uniqueId}</span>
                                {uc.completedChallenges?.[1] && (
                                  <div className="text-xs text-green-600 font-semibold">✅ Challenge Complete</div>
                                )}
                              </div>
                            )}
                            {workingOnChallenge === 2 && (
                              <div className="space-y-1">
                                <span className="text-sm text-purple-600 font-medium">C++ Coding Challenge</span>
                                {uc.completedChallenges?.[2] && (
                                  <div className="text-xs text-green-600 font-semibold">✅ Challenge Complete</div>
                                )}
                              </div>
                            )}
                            {workingOnChallenge === 3 && (
                              <div className="space-y-1">
                                <span className="text-sm text-indigo-600 font-medium">Forensics Evidence: campus_{uc.uniqueId}.jpg</span>
                                {uc.completedChallenges?.[3] && (
                                  <div className="text-xs text-green-600 font-semibold">✅ Challenge Complete</div>
                                )}
                              </div>
                            )}
                            {workingOnChallenge === 4 && (
                              <div className="space-y-1">
                                <span className="text-sm text-green-600 font-medium">WayneAWS Authentication</span>
                                {uc.completedChallenges?.[4] && (
                                  <div className="text-xs text-green-600 font-semibold">✅ Challenge Complete</div>
                                )}
                              </div>
                            )}
                            {workingOnChallenge === 5 && (
                              <div className="space-y-1">
                                {uc.completedChallenges?.[5] ? (
                                  <div className="text-sm text-green-600 font-semibold">
                                    ✅ Digital Archaeology Complete
                                  </div>
                                ) : (
                                  <>
                                    <div className="text-sm text-orange-600 font-medium">
                                      Word: "{challenge6Data[uc.uniqueId]?.word || 'Loading...'}"
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      Digital Archaeology Challenge
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                            {workingOnChallenge === 6 && (
                              <div className="space-y-1">
                                {uc.completedChallenges?.[6] ? (
                                  <div className="text-sm text-green-600 font-semibold">
                                    ✅ Hangman Complete
                                  </div>
                                ) : (
                                  <>
                                    <div className="text-sm text-red-600 font-medium">
                                      {challenge7Data[uc.uniqueId]?.error ? (
                                        <span className="text-orange-600">⚠️ {challenge7Data[uc.uniqueId]?.quote}</span>
                                      ) : (
                                        <>Quote: "{challenge7Data[uc.uniqueId]?.quote || 'Loading...'}"</>
                                      )}
                                    </div>
                                    {!challenge7Data[uc.uniqueId]?.error && (
                                      <div className="text-xs text-gray-500">
                                        By: {challenge7Data[uc.uniqueId]?.author || 'Loading...'}
                                      </div>
                                    )}
                                    {uc.challenge7Progress && !challenge7Data[uc.uniqueId]?.error && (
                                      <div className="text-xs text-blue-600 font-medium">
                                        Progress: {uc.challenge7Progress.revealedWords?.length || 0}/{uc.challenge7Progress.totalWords || challenge7Data[uc.uniqueId]?.uniqueWords?.length || '?'} unique words revealed ({((uc.challenge7Progress.revealedWords?.length || 0) / (uc.challenge7Progress.totalWords || challenge7Data[uc.uniqueId]?.uniqueWords?.length || 1) * 100).toFixed(1)}%)
                                      </div>
                                    )}
                                    <div className="text-xs text-gray-500">
                                      Hangman Challenge {challenge7Data[uc.uniqueId]?.uniqueId ? `(ID: ${challenge7Data[uc.uniqueId].uniqueId})` : ''}
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </td>
                          <td>
                            {workingOnChallenge === 0 && (
                              <div className="flex items-center gap-2">
                                <code className="bg-green-100 px-2 py-1 rounded text-sm font-mono text-green-700">
                                  {showPasswords[uc._id] ? uc.hashedPassword : '••••••••'}
                                </code>
                                <button
                                  onClick={() => togglePasswordVisibility(uc._id)}
                                  className="btn btn-ghost btn-xs"
                                  aria-label="Toggle password visibility"
                                >
                                  {showPasswords[uc._id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
                            )}
                            {workingOnChallenge === 1 && (
                              <div className="flex items-center gap-2">
                                <code className="bg-green-100 px-2 py-1 rounded text-sm font-mono text-green-700">
                                  {showPasswords[uc._id] 
                                    ? (uc.challenge2Password || 'Not generated yet')
                                    : '••••••••••••••'}
                                </code>
                                <button
                                  onClick={() => togglePasswordVisibility(uc._id)}
                                  className="btn btn-ghost btn-xs"
                                  aria-label="Toggle password visibility"
                                >
                                  {showPasswords[uc._id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
                            )}
                            {workingOnChallenge === 3 && (
                              <div className="flex items-center gap-2">
                                <code className="bg-green-100 px-2 py-1 rounded text-sm font-mono text-green-700">
                                  {showPasswords[uc._id] 
                                    ? (uc.challenge4Password || 'Loading...')
                                    : '••••••••••••••••••'}
                                </code>
                                <button
                                  onClick={() => togglePasswordVisibility(uc._id)}
                                  className="btn btn-ghost btn-xs"
                                  aria-label="Toggle password visibility"
                                >
                                  {showPasswords[uc._id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
                            )}
                            {workingOnChallenge === 2 && (
                              <span className="text-sm text-gray-500">Interactive Challenge</span>
                            )}
                            {workingOnChallenge === 4 && (
                              <span className="text-sm text-gray-500">WayneAWS Verification</span>
                            )}
                            {workingOnChallenge === 5 && (
                              <div className="flex items-center gap-2">
                                <code className="bg-green-100 px-2 py-1 rounded text-sm font-mono text-green-700">
                                  {showPasswords[uc._id] 
                                    ? (challenge6Data[uc.uniqueId]?.tokenId || 'Loading...')
                                    : '••••••••'}
                                </code>
                                <button
                                  onClick={() => togglePasswordVisibility(uc._id)}
                                  className="btn btn-ghost btn-xs"
                                  aria-label="Toggle password visibility"
                                >
                                  {showPasswords[uc._id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
                            )}
                            {workingOnChallenge === 6 && (
                              <div className="space-y-2">
                                {uc.completedChallenges?.[6] ? (
                                  <div className="text-sm text-green-600 font-semibold">
                                    ✅ Hangman Complete - All words revealed
                                  </div>
                                ) : challenge7Data[uc.uniqueId]?.error ? (
                                  <div className="text-sm text-orange-600 font-semibold">
                                    ⚠️ Data loading error - please refresh page
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    <div className="bg-gray-50 border border-gray-200 rounded p-2">
                                      <div className="text-xs font-semibold text-gray-700 mb-1">
                                        Progress: {uc.challenge7Progress?.revealedWords?.length || 0}/{challenge7Data[uc.uniqueId]?.uniqueWords?.length || '?'} unique words 
                                        ({((uc.challenge7Progress?.revealedWords?.length || 0) / (challenge7Data[uc.uniqueId]?.uniqueWords?.length || 1) * 100).toFixed(0)}%)
                                      </div>
                                      <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div 
                                          className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                                          style={{
                                            width: `${((uc.challenge7Progress?.revealedWords?.length || 0) / (challenge7Data[uc.uniqueId]?.uniqueWords?.length || 1) * 100)}%`
                                          }}
                                        ></div>
                                      </div>
                                      {challenge7Data[uc.uniqueId]?.uniqueId && (
                                        <div className="text-xs text-gray-500 mt-1">
                                          Challenge ID: {challenge7Data[uc.uniqueId].uniqueId}
                                        </div>
                                      )}
                                    </div>
                                    
                                    <details className="bg-gray-50 border border-gray-200 rounded">
                                      <summary className="cursor-pointer p-2 text-xs font-medium text-gray-700 hover:bg-gray-100">
                                        📝 View Word Details & Tokens
                                      </summary>
                                      <div className="p-2 border-t border-gray-200 max-h-40 overflow-y-auto">
                                        <div className="grid grid-cols-1 gap-1">
                                          {challenge7Data[uc.uniqueId]?.uniqueWords?.length > 0 ? (
                                            challenge7Data[uc.uniqueId].uniqueWords.map((word, idx) => {
                                              const isRevealed = uc.challenge7Progress?.revealedWords?.includes(word.toLowerCase());
                                              const teacherRevealKey = `${uc._id}-${word.toLowerCase()}`;
                                              const isTeacherRevealed = showPasswords[teacherRevealKey];
                                              const shouldShowTokens = isRevealed || isTeacherRevealed;
                                              
                                              return (
                                                <div key={`${uc.uniqueId}-${word}-${idx}`} className={`flex items-center justify-between p-2 rounded text-xs ${isRevealed ? 'bg-green-50 border border-green-200' : shouldShowTokens ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'}`}>
                                                  <div className="flex items-center gap-2">
                                                    <span className={`font-mono ${isRevealed ? 'text-green-700 font-semibold' : shouldShowTokens ? 'text-blue-700 font-semibold' : 'text-gray-500'}`}>
                                                      {isRevealed ? '✅' : shouldShowTokens ? '👁️' : '⬜'} "{word}"
                                                    </span>
                                                    {isRevealed && (
                                                      <span className="text-xs text-green-600 bg-green-100 px-1 py-0.5 rounded">Student solved</span>
                                                    )}
                                                  </div>
                                                  <div className="flex items-center gap-1">
                                                    {shouldShowTokens ? (
                                                      <code className={`px-2 py-1 rounded text-xs font-mono border ${isRevealed ? 'bg-green-100 text-green-700 border-green-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                                                        {challenge7Data[uc.uniqueId]?.wordTokens?.[word.toLowerCase()]?.join(', ') || 'Loading...'}
                                                      </code>
                                                    ) : (
                                                      <button
                                                        onClick={() => togglePasswordVisibility(teacherRevealKey)}
                                                        className="btn btn-xs btn-outline btn-primary gap-1 hover:btn-primary"
                                                        title="Reveal token for this word"
                                                      >
                                                        <Eye className="w-3 h-3" />
                                                        Reveal
                                                      </button>
                                                    )}
                                                    {shouldShowTokens && (
                                                      <button
                                                        onClick={() => togglePasswordVisibility(teacherRevealKey)}
                                                        className="btn btn-xs btn-ghost gap-1"
                                                        title="Hide token"
                                                      >
                                                        <EyeOff className="w-3 h-3" />
                                                      </button>
                                                    )}
                                                  </div>
                                                </div>
                                              );
                                            })
                                          ) : (
                                            <div className="text-xs text-gray-500 p-2">
                                              {challenge7Data[uc.uniqueId]?.error ? 'Error loading word data' : 'Loading word data...'}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </details>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="hidden sm:table-cell">
                            {uc.startedAt ? (
                              <div className="text-xs md:text-sm">
                                <div>{new Date(uc.startedAt).toLocaleDateString()}</div>
                                <div className="text-xs text-gray-500">
                                  {new Date(uc.startedAt).toLocaleTimeString()}
                                </div>
                                {uc.currentChallenge !== undefined && (
                                  <div className="badge badge-info badge-xs mt-1 whitespace-nowrap">
                                    Working on #{uc.currentChallenge + 1}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">Not started</span>
                            )}
                          </td>
                          <td>
                            <div className={`badge ${uc.completedChallenges?.[workingOnChallenge] ? 'badge-success' : 'badge-warning'} whitespace-nowrap`}>
                              {uc.completedChallenges?.[workingOnChallenge] ? 'Completed' : 'In Progress'}
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

      {showDueDateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="card bg-base-100 w-full max-w-md mx-4 shadow-xl">
            <div className="card-body">
              <h2 className="text-xl font-bold mb-4">Manage Due Date</h2>
              
              <div className="form-control mb-4">
                <label className="label cursor-pointer justify-start gap-3">
                  <input 
                    type="checkbox" 
                    className="checkbox"
                    checked={challengeData?.settings?.dueDateEnabled || false}
                    onChange={async (e) => {
                      try {
                        const defaultDate = new Date();
                        defaultDate.setDate(defaultDate.getDate() + 7);
                        const response = await updateDueDate(
                          classroomId, 
                          e.target.checked, 
                          e.target.checked ? (challengeData?.settings?.dueDate || defaultDate.toISOString()) : null
                        );
                        setChallengeData(prev => ({
                          ...prev,
                          settings: {
                            ...prev?.settings,
                            dueDateEnabled: response.challenge.settings.dueDateEnabled,
                            dueDate: response.challenge.settings.dueDate
                          }
                        }));
                        toast.success('Due date settings updated');
                      } catch (error) {
                        toast.error(error.message || 'Failed to update due date');
                      }
                    }}
                  />
                  <span className="label-text font-semibold">Enable due date</span>
                </label>
              </div>
              
              {challengeData?.settings?.dueDateEnabled && (
                <div className="form-control mb-4">
                  <label className="label">
                    <span className="label-text">Due date and time</span>
                  </label>
                  <input
                    type="datetime-local"
                    className="input input-bordered w-full"
                    value={localDueDate}
                    onChange={(e) => {
                      setLocalDueDate(e.target.value);
                    }}
                    min={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                  />
                  <div className="text-sm text-gray-500 mt-1">
                    Students will not be able to submit answers after this time
                  </div>
                </div>
              )}

              <div className="card-actions justify-end gap-2">
                {challengeData?.settings?.dueDateEnabled && localDueDate && (
                  <button
                    className="btn btn-primary"
                    onClick={async () => {
                      try {
                        // Convert local datetime-local value to UTC for storage
                        const localDate = new Date(localDueDate);
                        const utcDate = new Date(localDate.getTime() + localDate.getTimezoneOffset() * 60000);
                        const utcISOString = utcDate.toISOString();
                        
                        const response = await updateDueDate(classroomId, true, utcISOString);
                        setChallengeData(prev => ({
                          ...prev,
                          settings: {
                            ...prev?.settings,
                            dueDateEnabled: response.challenge.settings.dueDateEnabled,
                            dueDate: response.challenge.settings.dueDate
                          }
                        }));
                        toast.success('Due date updated');
                        setLocalDueDate('');
                        await fetchChallengeData();
                      } catch (error) {
                        toast.error(error.message || 'Failed to update due date');
                      }
                    }}
                  >
                    Save Due Date
                  </button>
                )}
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowDueDateModal(false);
                    setLocalDueDate('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherView;