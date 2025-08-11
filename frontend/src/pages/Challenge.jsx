import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, Zap, Users, Eye, EyeOff, ArrowLeft, Settings } from 'lucide-react';
import { getChallengeData, initiateChallenge, deactivateChallenge, configureChallenge, submitChallengeAnswer } from '../API/apiChallenge';
import { getChallengeTemplates, saveChallengeTemplate, deleteChallengeTemplate } from '../API/apiChallengeTemplate';
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
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configuring, setConfiguring] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [classroom, setClassroom] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const challengeNames = ['Little Caesar\'s Secret', 'Check Me Out'];
  
  const [challengeConfig, setChallengeConfig] = useState({
    title: 'Cyber Challenge Series - Fall Semester',
    rewardMode: 'individual',
    challengeBits: [50, 75],
    totalRewardBits: 125,
    multiplierMode: 'individual',
    challengeMultipliers: [1.0, 1.0],
    totalMultiplier: 1.0,
    luckMode: 'individual',
    challengeLuck: [0, 0],
    totalLuck: 0,
    discountMode: 'individual',
    challengeDiscounts: [0, 0],
    totalDiscount: 0
  });

  const fetchChallengeData = async () => {
    try {
      setLoading(true);
      const response = await getChallengeData(classroomId);
      setChallengeData(response.challenge);
      setUserChallenge(response.userChallenge);
      setIsTeacher(response.isTeacher);
      
      if (!classroom) {
        const classroomResponse = await fetch(`${API_BASE}/api/classroom/${classroomId}`, {
          credentials: 'include'
        });
        if (classroomResponse.ok) {
          const classroomData = await classroomResponse.json();
          setClassroom(classroomData);
        }
      }
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

   // Handle challenge answer submission
   const handleSubmitAnswer = async (challengeId, answer) => {
     if (!answer || !answer.trim()) {
       toast.error('Please enter an answer');
       return;
     }

     try {
       const response = await submitChallengeAnswer(classroomId, challengeId, answer);
       
       if (response.success) {
         toast.success(response.message);
         if (response.rewards.bits > 0) {
           toast.success(`Earned ${response.rewards.bits} bits!`);
         }
         
         // Refresh challenge data to show updated progress
         await fetchChallengeData();
         
         if (response.allCompleted) {
           toast.success('🎉 All challenges completed! Well done!');
         } else if (response.nextChallenge) {
           toast.success(`Next up: ${response.nextChallenge}`);
         }
       } else {
         toast.error(response.message);
         if (response.hint) {
           toast.info(response.hint);
         }
       }
     } catch (error) {
       toast.error(error.message || 'Failed to submit answer');
     }
   };

   const isTeacherInStudentView = originalUser?.role === 'teacher' && user.role === 'student';

  const fetchTemplates = async () => {
    try {
      const response = await getChallengeTemplates();
      setTemplates(response.templates || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const handleShowConfigModal = () => {
    setShowConfigModal(true);
    fetchTemplates();
  };

  const handleConfigureChallenge = async () => {
    try {
      setConfiguring(true);
      const settings = {
        rewardMode: challengeConfig.rewardMode,
        multiplierMode: challengeConfig.multiplierMode,
        luckMode: challengeConfig.luckMode,
        discountMode: challengeConfig.discountMode,
        difficulty: 'medium'
      };

      // Send arrays directly to backend
      if (challengeConfig.rewardMode === 'individual') {
        settings.challengeBits = challengeConfig.challengeBits.map(bits => bits || 0);
      } else {
        settings.totalRewardBits = challengeConfig.totalRewardBits || 0;
        // In total mode, set all individual bits to 0 except the last one
        settings.challengeBits = challengeConfig.challengeBits.map((_, index) => 
          index === challengeConfig.challengeBits.length - 1 ? (challengeConfig.totalRewardBits || 0) : 0
        );
      }

      if (challengeConfig.multiplierMode === 'individual') {
        settings.challengeMultipliers = challengeConfig.challengeMultipliers.map(mult => mult || 1.0);
      } else {
        settings.totalMultiplier = challengeConfig.totalMultiplier || 1.0;
        settings.challengeMultipliers = challengeConfig.challengeMultipliers.map(() => 1.0);
      }

      if (challengeConfig.luckMode === 'individual') {
        settings.challengeLuck = challengeConfig.challengeLuck.map(luck => luck || 0);
      } else {
        settings.totalLuck = challengeConfig.totalLuck || 0;
        settings.challengeLuck = challengeConfig.challengeLuck.map(() => 0);
      }

      if (challengeConfig.discountMode === 'individual') {
        settings.challengeDiscounts = challengeConfig.challengeDiscounts.map(discount => discount || 0);
      } else {
        settings.totalDiscount = challengeConfig.totalDiscount || 0;
        settings.challengeDiscounts = challengeConfig.challengeDiscounts.map(() => 0);
      }

      await configureChallenge(classroomId, challengeConfig.title, settings);
      toast.success('Challenge configured successfully');
      
      const response = await initiateChallenge(classroomId);
      setChallengeData(response.challenge);
      toast.success(response.message);
      setShowConfigModal(false);
      await fetchChallengeData();
    } catch (error) {
      console.error('Error configuring/initiating challenge:', error);
      toast.error(error.message || 'Failed to configure challenge');
    } finally {
      setConfiguring(false);
    }
  };

  // Deactivate cyber challenge (Teacher only)
  const handleShowDeactivateModal = () => {
    const skipWarning = localStorage.getItem('skipChallengeDeactivateWarning') === 'true';
    if (skipWarning) {
      handleConfirmDeactivate();
    } else {
      setShowDeactivateModal(true);
      setConfirmText('');
      setDontShowAgain(false);
    }
  };

  const handleConfirmDeactivate = async () => {
    try {
      setInitiating(true);
      const response = await deactivateChallenge(classroomId);
      setChallengeData(response.challenge);
      toast.success(response.message);
      setShowDeactivateModal(false);
      if (dontShowAgain) {
        localStorage.setItem('skipChallengeDeactivateWarning', 'true');
      }
      await fetchChallengeData();
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

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    try {
      setSavingTemplate(true);
      const settings = {
        rewardMode: challengeConfig.rewardMode,
        multiplierMode: challengeConfig.multiplierMode,
        luckMode: challengeConfig.luckMode,
        discountMode: challengeConfig.discountMode,
        challengeBits: challengeConfig.challengeBits,
        totalRewardBits: challengeConfig.totalRewardBits,
        challengeMultipliers: challengeConfig.challengeMultipliers,
        totalMultiplier: challengeConfig.totalMultiplier,
        challengeLuck: challengeConfig.challengeLuck,
        totalLuck: challengeConfig.totalLuck,
        challengeDiscounts: challengeConfig.challengeDiscounts,
        totalDiscount: challengeConfig.totalDiscount,
        difficulty: 'medium'
      };

      await saveChallengeTemplate(templateName.trim(), challengeConfig.title, settings);
      toast.success('Template saved successfully!');
      setShowSaveTemplateModal(false);
      setTemplateName('');
      fetchTemplates();
    } catch (error) {
      toast.error(error.message || 'Failed to save template');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleLoadTemplate = (template) => {
    const newConfig = {
      title: template.title,
      rewardMode: template.settings.rewardMode || 'individual',
      challengeBits: template.settings.challengeBits || [50, 75, 100, 125],
      totalRewardBits: template.settings.totalRewardBits || 350,
      multiplierMode: template.settings.multiplierMode || 'individual',
      challengeMultipliers: template.settings.challengeMultipliers || [1.0, 1.0, 1.0, 1.0],
      totalMultiplier: template.settings.totalMultiplier || 1.0,
      luckMode: template.settings.luckMode || 'individual',
      challengeLuck: template.settings.challengeLuck || [0, 0, 0, 0],
      totalLuck: template.settings.totalLuck || 0,
      discountMode: template.settings.discountMode || 'individual',
      challengeDiscounts: template.settings.challengeDiscounts || [0, 0, 0, 0],
      totalDiscount: template.settings.totalDiscount || 0
    };
    
    setChallengeConfig(newConfig);
    toast.success(`Template "${template.name}" loaded!`);
  };

  const handleDeleteTemplate = async (templateId, templateName) => {
    if (!confirm(`Are you sure you want to delete the template "${templateName}"?`)) {
      return;
    }

    try {
      await deleteChallengeTemplate(templateId);
      toast.success('Template deleted successfully!');
      fetchTemplates();
    } catch (error) {
      toast.error(error.message || 'Failed to delete template');
    }
  };

  const getCurrentChallenge = (progress) => {
    if (progress === 0) {
      return {
        number: 1,
        name: "Little Caesar's Secret",
        method: "Caesar Cipher (Shift +3)",
        type: "caesar"
      };
    } else {
      return {
        number: 2,
        name: "Check Me Out", 
        method: "OSINT & Git Exploration",
        type: "github"
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

  if (isTeacher && !isTeacherInStudentView) {
    return (
      <div className="p-6 space-y-8">
        <div className="card bg-base-100 border border-base-200 shadow-md rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-8 h-8 text-red-500" />
            <h1 className="text-3xl font-bold text-base-content">Cyber Challenge</h1>
          </div>
          <p className="text-gray-600 text-lg mb-6">
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

        {showConfigModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
            <div className="card bg-base-100 w-full max-w-2xl my-8 shadow-xl">
              <div className="card-body">
                <div className="flex items-center gap-3 mb-4">
                  <Settings className="w-6 h-6 text-red-500" />
                  <h2 className="text-2xl font-bold">Configure Challenge Series</h2>
                </div>

                {/* Template Section */}
                <div className="bg-base-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold">Templates</h3>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => setShowSaveTemplateModal(true)}
                    >
                      Save Current Config
                    </button>
                  </div>
                  
                  {templates.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {templates.map((template) => (
                        <div key={template._id} className="flex items-center justify-between bg-base-100 p-3 rounded">
                          <div>
                            <div className="font-medium">{template.name}</div>
                            <div className="text-xs text-gray-500">
                              {new Date(template.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button
                              className="btn btn-xs btn-ghost"
                              onClick={() => handleLoadTemplate(template)}
                              title="Load template"
                            >
                              Load
                            </button>
                            <button
                              className="btn btn-xs btn-ghost text-error"
                              onClick={() => handleDeleteTemplate(template._id, template.name)}
                              title="Delete template"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-3">
                      No saved templates. Configure your settings below and save them as a template.
                    </div>
                  )}
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="label">
                      <span className="label-text font-semibold">Challenge Series Name</span>
                    </label>
                    <input
                      type="text"
                      className="input input-bordered w-full"
                      value={challengeConfig.title}
                      onChange={(e) => setChallengeConfig(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Enter challenge series name"
                    />
                  </div>

                  <div className="divider">Reward System</div>

                  <div className="form-control">
                    <div className="flex gap-6">
                      <label className="label cursor-pointer">
                        <input
                          type="radio"
                          name="rewardMode"
                          className="radio radio-primary"
                          checked={challengeConfig.rewardMode === 'individual'}
                          onChange={() => setChallengeConfig(prev => ({ ...prev, rewardMode: 'individual' }))}
                        />
                        <span className="label-text ml-2 font-semibold">Individual Challenge Rewards</span>
                      </label>
                      <label className="label cursor-pointer">
                        <input
                          type="radio"
                          name="rewardMode"
                          className="radio radio-primary"
                          checked={challengeConfig.rewardMode === 'total'}
                          onChange={() => setChallengeConfig(prev => ({ ...prev, rewardMode: 'total' }))}
                        />
                        <span className="label-text ml-2 font-semibold">Total Completion Reward</span>
                      </label>
                    </div>
                  </div>

                  {challengeConfig.rewardMode === 'individual' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {challengeNames.map((name, index) => (
                        <div key={index}>
                          <label className="label">
                            <span className="label-text">Challenge {index + 1}: {name}</span>
                          </label>
                          <input
                            type="number"
                            className="input input-bordered w-full"
                            value={challengeConfig.challengeBits[index]}
                            onChange={(e) => {
                              const value = e.target.value;
                              const newValue = value === '' ? 0 : parseInt(value) || 0;
                              setChallengeConfig(prev => {
                                const newBits = [...prev.challengeBits];
                                newBits[index] = value === '' ? '' : newValue;
                                const total = newBits.reduce((sum, bits) => sum + (bits || 0), 0);
                                return { ...prev, challengeBits: newBits, totalRewardBits: total };
                              });
                            }}
                            min="0"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="label">
                          <span className="label-text font-semibold">Total Bits Awarded for Completing All Challenges</span>
                        </label>
                        <input
                          type="number"
                          className="input input-bordered w-full"
                          value={challengeConfig.totalRewardBits}
                          onChange={(e) => {
                            const value = e.target.value;
                            setChallengeConfig(prev => ({ 
                              ...prev, 
                              totalRewardBits: value === '' ? '' : parseInt(value) || 0 
                            }));
                          }}
                          min="0"
                          placeholder="Enter total reward amount"
                        />
                      </div>
                      <div className="alert alert-info">
                        <span className="text-sm">
                          Students will receive the full reward amount only when they complete all 4 challenges. No bits are awarded for individual challenges.
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="divider">Multiplier Rewards</div>

                  <div className="form-control">
                    <div className="flex gap-6">
                      <label className="label cursor-pointer">
                        <input
                          type="radio"
                          name="multiplierMode"
                          className="radio radio-primary"
                          checked={challengeConfig.multiplierMode === 'individual'}
                          onChange={() => setChallengeConfig(prev => ({ ...prev, multiplierMode: 'individual' }))}
                        />
                        <span className="label-text ml-2 font-semibold">Individual Multipliers</span>
                      </label>
                      <label className="label cursor-pointer">
                        <input
                          type="radio"
                          name="multiplierMode"
                          className="radio radio-primary"
                          checked={challengeConfig.multiplierMode === 'total'}
                          onChange={() => setChallengeConfig(prev => ({ ...prev, multiplierMode: 'total' }))}
                        />
                        <span className="label-text ml-2 font-semibold">Total Series Multiplier</span>
                      </label>
                    </div>
                  </div>

                  {challengeConfig.multiplierMode === 'individual' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {challengeNames.map((name, index) => (
                        <div key={index}>
                          <label className="label">
                            <span className="label-text">Challenge {index + 1}: {name}</span>
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            className="input input-bordered w-full"
                            value={challengeConfig.challengeMultipliers[index]}
                            onChange={(e) => {
                              const value = e.target.value;
                              const newValue = value === '' ? 1.0 : parseFloat(value) || 1.0;
                              setChallengeConfig(prev => {
                                const newMults = [...prev.challengeMultipliers];
                                newMults[index] = value === '' ? '' : newValue;
                                return { ...prev, challengeMultipliers: newMults };
                              });
                            }}
                            min="0"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <label className="label">
                        <span className="label-text font-semibold">Total Series Multiplier</span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        className="input input-bordered w-full"
                        value={challengeConfig.totalMultiplier}
                        onChange={(e) => {
                          const value = e.target.value;
                          setChallengeConfig(prev => ({ 
                            ...prev, 
                            totalMultiplier: value === '' ? '' : parseFloat(value) || 1.0 
                          }));
                        }}
                        min="0"
                      />
                    </div>
                  )}

                  <div className="divider">Luck Rewards</div>

                  <div className="form-control">
                    <div className="flex gap-6">
                      <label className="label cursor-pointer">
                        <input
                          type="radio"
                          name="luckMode"
                          className="radio radio-primary"
                          checked={challengeConfig.luckMode === 'individual'}
                          onChange={() => setChallengeConfig(prev => ({ ...prev, luckMode: 'individual' }))}
                        />
                        <span className="label-text ml-2 font-semibold">Individual Luck</span>
                      </label>
                      <label className="label cursor-pointer">
                        <input
                          type="radio"
                          name="luckMode"
                          className="radio radio-primary"
                          checked={challengeConfig.luckMode === 'total'}
                          onChange={() => setChallengeConfig(prev => ({ ...prev, luckMode: 'total' }))}
                        />
                        <span className="label-text ml-2 font-semibold">Total Series Luck</span>
                      </label>
                    </div>
                  </div>

                  {challengeConfig.luckMode === 'individual' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {challengeNames.map((name, index) => (
                        <div key={index}>
                          <label className="label">
                            <span className="label-text">Challenge {index + 1}: {name}</span>
                          </label>
                          <input
                            type="number"
                            className="input input-bordered w-full"
                            value={challengeConfig.challengeLuck[index]}
                            onChange={(e) => {
                              const value = e.target.value;
                              const newValue = value === '' ? 0 : parseInt(value) || 0;
                              setChallengeConfig(prev => {
                                const newLuck = [...prev.challengeLuck];
                                newLuck[index] = value === '' ? '' : newValue;
                                return { ...prev, challengeLuck: newLuck };
                              });
                            }}
                            min="0"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <label className="label">
                        <span className="label-text font-semibold">Total Series Luck</span>
                      </label>
                      <input
                        type="number"
                        className="input input-bordered w-full"
                        value={challengeConfig.totalLuck}
                        onChange={(e) => {
                          const value = e.target.value;
                          setChallengeConfig(prev => ({ 
                            ...prev, 
                            totalLuck: value === '' ? '' : parseInt(value) || 0 
                          }));
                        }}
                        min="0"
                      />
                    </div>
                  )}

                  <div className="divider">Discount Rewards</div>

                  <div className="form-control">
                    <div className="flex gap-6">
                      <label className="label cursor-pointer">
                        <input
                          type="radio"
                          name="discountMode"
                          className="radio radio-primary"
                          checked={challengeConfig.discountMode === 'individual'}
                          onChange={() => setChallengeConfig(prev => ({ ...prev, discountMode: 'individual' }))}
                        />
                        <span className="label-text ml-2 font-semibold">Individual Discounts</span>
                      </label>
                      <label className="label cursor-pointer">
                        <input
                          type="radio"
                          name="discountMode"
                          className="radio radio-primary"
                          checked={challengeConfig.discountMode === 'total'}
                          onChange={() => setChallengeConfig(prev => ({ ...prev, discountMode: 'total' }))}
                        />
                        <span className="label-text ml-2 font-semibold">Total Series Discount</span>
                      </label>
                    </div>
                  </div>

                  {challengeConfig.discountMode === 'individual' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {challengeNames.map((name, index) => (
                        <div key={index}>
                          <label className="label">
                            <span className="label-text">Challenge {index + 1}: {name} (%)</span>
                          </label>
                          <input
                            type="number"
                            className="input input-bordered w-full"
                            value={challengeConfig.challengeDiscounts[index]}
                            onChange={(e) => {
                              const value = e.target.value;
                              const newValue = value === '' ? 0 : parseInt(value) || 0;
                              setChallengeConfig(prev => {
                                const newDiscounts = [...prev.challengeDiscounts];
                                newDiscounts[index] = value === '' ? '' : newValue;
                                return { ...prev, challengeDiscounts: newDiscounts };
                              });
                            }}
                            min="0"
                            max="100"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <label className="label">
                        <span className="label-text font-semibold">Total Series Discount (%)</span>
                      </label>
                      <input
                        type="number"
                        className="input input-bordered w-full"
                        value={challengeConfig.totalDiscount}
                        onChange={(e) => {
                          const value = e.target.value;
                          setChallengeConfig(prev => ({ 
                            ...prev, 
                            totalDiscount: value === '' ? '' : parseInt(value) || 0 
                          }));
                        }}
                        min="0"
                        max="100"
                      />
                    </div>
                  )}

                  <div className="divider">Future Settings</div>
                  
                  <div className="space-y-2 opacity-50">
                    <div className="form-control">
                      <label className="label cursor-pointer justify-start gap-3">
                        <input type="checkbox" className="checkbox" disabled />
                        <span className="label-text">Enable time limits (Coming Soon)</span>
                      </label>
                    </div>
                    <div className="form-control">
                      <label className="label cursor-pointer justify-start gap-3">
                        <input type="checkbox" className="checkbox" disabled />
                        <span className="label-text">Allow challenge retries (Coming Soon)</span>
                      </label>
                    </div>
                    <div className="form-control">
                      <label className="label cursor-pointer justify-start gap-3">
                        <input type="checkbox" className="checkbox" disabled />
                        <span className="label-text">Randomize challenge order (Coming Soon)</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="card-actions justify-end mt-6 gap-3">
                  <button
                    className="btn btn-ghost"
                    onClick={() => setShowConfigModal(false)}
                    disabled={configuring}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-error"
                    onClick={handleConfigureChallenge}
                    disabled={configuring}
                  >
                    {configuring ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        Launching...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        Launch Challenge Series
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showSaveTemplateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="card bg-base-100 w-full max-w-md mx-4 shadow-xl">
              <div className="card-body">
                <h2 className="text-xl font-bold mb-4">Save Configuration Template</h2>
                <div className="form-control mb-4">
                  <label className="label">
                    <span className="label-text">Template Name</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Enter template name..."
                    maxLength={100}
                  />
                </div>
                <div className="alert alert-info mb-4">
                  <span className="text-sm">
                    This will save your current configuration including all challenge settings, rewards, and modes.
                  </span>
                </div>
                <div className="card-actions justify-end gap-2">
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setShowSaveTemplateModal(false);
                      setTemplateName('');
                    }}
                    disabled={savingTemplate}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleSaveTemplate}
                    disabled={savingTemplate || !templateName.trim()}
                  >
                    {savingTemplate ? (
                      <>
                        <span className="loading loading-spinner loading-xs"></span>
                        Saving...
                      </>
                    ) : (
                      'Save Template'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showDeactivateModal && (
          <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="card bg-base-100 w-full max-w-md mx-4 shadow-xl">
              <div className="card-body">
                <h2 className="text-xl font-bold text-error mb-4">⚠️ Deactivate Challenge Series</h2>
                <p className="text-sm text-gray-600 mb-4">
                  This will permanently delete all student progress and challenge data. This action cannot be undone.
                </p>
                <div className="form-control mb-4">
                  <label className="label">
                    <span className="label-text text-sm">Type "<strong>{classroom?.name} delete</strong>" to confirm:</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered input-sm"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={`${classroom?.name} delete`}
                  />
                </div>
                <div className="form-control mb-4">
                  <label className="label cursor-pointer justify-start gap-2">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={dontShowAgain}
                      onChange={(e) => setDontShowAgain(e.target.checked)}
                    />
                    <span className="label-text text-sm">Don't show this warning again</span>
                  </label>
                </div>
                <div className="card-actions justify-end gap-2">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setShowDeactivateModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-error btn-sm"
                    onClick={handleConfirmDeactivate}
                    disabled={confirmText !== `${classroom?.name} delete` || initiating}
                  >
                    {initiating ? <span className="loading loading-spinner loading-xs"></span> : 'Deactivate'}
                  </button>
                </div>
              </div>
            </div>
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
                <div className="badge badge-outline badge-sm">
                  {challengeData?.settings?.rewardMode === 'total' ? '0' : (challengeData?.settings?.challengeBits?.[0] || challengeConfig.challengeBits[0])} bits
                </div>
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
                                         <div className="space-y-3">
                       <div className="flex gap-2">
                         <input
                           type="text"
                           placeholder="Enter your decrypted password..."
                           className="input input-bordered input-sm flex-1"
                           onKeyPress={(e) => {
                             if (e.key === 'Enter') {
                               handleSubmitAnswer('caesar-secret-001', e.target.value);
                             }
                           }}
                         />
                         <button 
                           className="btn btn-error btn-sm"
                           onClick={(e) => {
                             const input = e.target.parentElement.querySelector('input');
                             handleSubmitAnswer('caesar-secret-001', input.value);
                           }}
                         >
                           Submit
                         </button>
                       </div>
                       <p className="text-xs text-gray-500">
                         Decrypt your encrypted ID and enter the result above
                       </p>
                     </div>
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
                  <div className="badge badge-outline badge-sm">
                    {challengeData?.settings?.rewardMode === 'total' ? '0' : (challengeData?.settings?.challengeBits?.[1] || challengeConfig.challengeBits[1])} bits
                  </div>
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
                                                 <div className="space-y-3">
                           <div className="flex gap-2">
                             <input
                               type="text"
                               placeholder="Enter the password you found..."
                               className="input input-bordered input-sm flex-1"
                               onKeyPress={(e) => {
                                 if (e.key === 'Enter') {
                                   handleSubmitAnswer('github-osint-002', e.target.value);
                                 }
                               }}
                             />
                             <button 
                               className="btn btn-info btn-sm"
                               onClick={(e) => {
                                 const input = e.target.parentElement.querySelector('input');
                                 handleSubmitAnswer('github-osint-002', input.value);
                               }}
                             >
                               Submit
                             </button>
                           </div>
                           <p className="text-xs text-gray-500">
                             Follow the LinkedIn profile link and find your password using your unique ID
                           </p>
                         </div>
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
