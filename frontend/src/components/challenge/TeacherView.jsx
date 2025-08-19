import { useState, useEffect, useRef } from 'react';
import { Shield, Settings, Users, Eye, EyeOff, UserPlus } from 'lucide-react';
import { getCurrentChallenge } from '../../utils/challengeUtils';
import { getThemeClasses } from '../../utils/themeUtils';
import { updateDueDate } from '../../API/apiChallenge';
import toast from 'react-hot-toast';

const TeacherView = ({ 
  challengeData,
  setChallengeData,
  isDark,
  handleShowConfigModal,
  handleShowDeactivateModal,
  initiating,
  classroomStudents = []
}) => {
  const [showPasswords, setShowPasswords] = useState({});
  const [showDueDateModal, setShowDueDateModal] = useState(false);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [studentNames, setStudentNames] = useState({});
  const dropdownRef = useRef(null);
  const themeClasses = getThemeClasses(isDark);

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
      const response = await fetch(`/api/challenges/${challengeData._id}/assign-student`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ studentId })
      });
      
      if (response.ok) {
        toast.success('Student assigned to challenge successfully');
        setShowAssignDropdown(false);
        window.location.reload();
      } else {
        toast.error('Failed to assign student');
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



  return (
    <div className="p-6 space-y-8">
      <div className={themeClasses.cardBase}>
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-8 h-8 text-red-500" />
          <h1 className="text-3xl font-bold text-base-content">Cyber Challenge</h1>
        </div>
        <p className={`${themeClasses.mutedText} text-lg mb-6`}>
          Initiate the complete Cyber Challenge Series. Students will progress through multiple cybersecurity challenges, each with unique encrypted data and passwords to discover.
        </p>
        
        <div className="flex gap-4">
          {!challengeData || !challengeData.isActive ? (
            <button
              onClick={handleShowConfigModal}
              className="btn btn-error btn-lg gap-2"
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
                <table className="table table-zebra w-full">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Current Challenge</th>
                      <th>Challenge Data</th>
                      <th>Solution</th>
                      <th>Started At</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {challengeData.userChallenges
                      .filter(uc => uc.userId) // Filter out undefined userIds
                      .filter(uc => { // Filter out students who left the classroom
                        const studentInClassroom = classroomStudents.some(studentId => 
                          (typeof studentId === 'string' ? studentId : studentId._id) === uc.userId._id
                        );
                        return studentInClassroom;
                      })
                      .map((uc) => {
                      const currentChallenge = getCurrentChallenge(uc.progress);
                      const challengeNames = ['Little Caesar\'s Secret', 'Check Me Out', 'C++ Bug Hunt', 'I Always Sign My Work...', 'Secrets in the Clouds', 'Needle in a Haystack'];
                      const workingOnChallenge = uc.currentChallenge !== undefined ? uc.currentChallenge : uc.progress;
                      const workingOnTitle = challengeNames[workingOnChallenge] || currentChallenge.name;
                      
                      return (
                        <tr key={uc._id}>
                          <td className="font-medium">
                            {uc.userId.firstName} {uc.userId.lastName}
                            <br />
                            <span className="text-sm text-gray-500">{uc.userId.email}</span>
                          </td>
                          <td>
                            <div className="flex flex-col">
                              <span className="font-semibold">Challenge {workingOnChallenge + 1}</span>
                              <span className="text-sm text-gray-600">{workingOnTitle}</span>
                              <span className="text-xs text-gray-500">{currentChallenge.method}</span>
                            </div>
                          </td>
                          <td>
                            {workingOnChallenge === 0 && (
                              <code className="bg-red-100 px-2 py-1 rounded text-sm font-mono text-red-700">
                                {uc.uniqueId}
                              </code>
                            )}
                            {workingOnChallenge === 1 && (
                              <span className="text-sm text-blue-600 font-medium">GitHub Branch: {uc.uniqueId}</span>
                            )}
                            {workingOnChallenge === 2 && (
                              <span className="text-sm text-purple-600 font-medium">C++ Coding Challenge</span>
                            )}
                            {workingOnChallenge === 3 && (
                              <span className="text-sm text-indigo-600 font-medium">Forensics Evidence: campus_{uc.uniqueId}.jpg</span>
                            )}
                            {workingOnChallenge === 4 && (
                              <span className="text-sm text-green-600 font-medium">WayneAWS Authentication</span>
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
                          </td>
                          <td>
                            {uc.startedAt ? (
                              <div className="text-sm">
                                <div>{new Date(uc.startedAt).toLocaleDateString()}</div>
                                <div className="text-xs text-gray-500">
                                  {new Date(uc.startedAt).toLocaleTimeString()}
                                </div>
                                {uc.currentChallenge !== undefined && (
                                  <div className="badge badge-info badge-xs mt-1">
                                    Working on #{uc.currentChallenge + 1}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">Not started</span>
                            )}
                          </td>
                          <td>
                            <div className={`badge ${uc.completedChallenges?.[workingOnChallenge] ? 'badge-success' : 'badge-warning'}`}>
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
                        const response = await updateDueDate(
                          challengeData._id, 
                          e.target.checked, 
                          e.target.checked ? (challengeData?.settings?.dueDate || new Date().toISOString().slice(0, 16)) : null
                        );
                        setChallengeData(response.challenge);
                        toast.success('Due date settings updated');
                        if (!e.target.checked) {
                          setShowDueDateModal(false);
                        }
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
                    value={challengeData?.settings?.dueDate ? new Date(challengeData.settings.dueDate).toISOString().slice(0, 16) : ''}
                    onChange={async (e) => {
                      if (e.target.value) {
                        try {
                          const response = await updateDueDate(challengeData._id, true, e.target.value);
                          setChallengeData(response.challenge);
                          toast.success('Due date updated');
                        } catch (error) {
                          toast.error(error.message || 'Failed to update due date');
                        }
                      }
                    }}
                    min={new Date().toISOString().slice(0, 16)}
                  />
                  <div className="text-sm text-gray-500 mt-1">
                    Students will not be able to submit answers after this time
                  </div>
                </div>
              )}

              <div className="card-actions justify-end gap-2">
                <button
                  className="btn btn-ghost"
                  onClick={() => setShowDueDateModal(false)}
                >
                  Close
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
