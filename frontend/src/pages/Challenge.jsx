import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, Zap, Users, Eye, EyeOff, ArrowLeft, Settings } from 'lucide-react';
import RewardModal from '../components/RewardModal';
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
  const [confirmText, setConfirmText] = useState('');
  const [classroom, setClassroom] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [rewardData, setRewardData] = useState(null);
  const [challengeAnswers, setChallengeAnswers] = useState({
    'network-analysis-003': '',
    'advanced-crypto-004': ''
  });
  const [submittingAnswers, setSubmittingAnswers] = useState({});
  const [previousProgress, setPreviousProgress] = useState(null);
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [dontShowDeleteWarning, setDontShowDeleteWarning] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const challengeNames = ['Little Caesar\'s Secret', 'Check Me Out', 'Memory Leak Detective', 'Digital Forensics Lab'];
  
  const [challengeConfig, setChallengeConfig] = useState({
    title: 'Cyber Challenge Series - Fall Semester',
    rewardMode: 'individual',
    challengeBits: [50, 75, 100, 125],
    totalRewardBits: 350,
    multiplierMode: 'individual',
    challengeMultipliers: [1.0, 1.0, 1.0, 1.0],
    totalMultiplier: 1.0,
    luckMode: 'individual',
    challengeLuck: [1.0, 1.0, 1.0, 1.0],
    totalLuck: 1.0,
    discountMode: 'individual',
    challengeDiscounts: [0, 0, 0, 0],
    totalDiscount: 0,
    shieldMode: 'individual',
    challengeShields: [false, false, false, false],
    totalShield: false,
    attackMode: 'individual',
    challengeAttackBonuses: [0, 0, 0, 0],
    totalAttackBonus: 0,
    dueDateEnabled: false,
    dueDate: '',
    retryEnabled: false,
    maxRetries: 3
  });

  const fetchChallengeData = async () => {
    try {
      setLoading(true);
      const response = await getChallengeData(classroomId);
      setChallengeData(response.challenge);
      
      // Check if progress has increased (challenge completed)
      const newProgress = response.userChallenge?.progress || 0;
      if (previousProgress !== null && newProgress > previousProgress && newProgress > 0) {
        const completedChallengeIndex = newProgress - 1;
        const rewardInfo = getRewardDataForChallenge(completedChallengeIndex);
        if (rewardInfo) {
          setRewardData(rewardInfo);
          setShowRewardModal(true);
          toast.success(`${rewardInfo.challengeName} completed! 🎉`);
        }
      }
      
      // Update states
      setUserChallenge(response.userChallenge);
      // Update previousProgress (only check for increases if not first load)
      setPreviousProgress(newProgress);
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

  const setDebugProgress = async (targetProgress) => {
    try {
      const previousProgressValue = userChallenge?.progress || 0;
      
      const response = await fetch(`${API_BASE}/api/challenges/${classroomId}/debug-progress`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress: targetProgress })
      });
      
      if (response.ok) {
        toast.success(`Progress set to Challenge ${targetProgress + 1}!`);
        
        // If progress increased, show reward modal for the latest completed challenge
        if (targetProgress > previousProgressValue && targetProgress > 0) {
          const completedChallengeIndex = targetProgress - 1;
          const rewardInfo = getRewardDataForChallenge(completedChallengeIndex);
          if (rewardInfo) {
            setRewardData(rewardInfo);
            setShowRewardModal(true);
          }
        }
        
        await fetchChallengeData(); // Refresh data
        setShowDebugPanel(false);
      } else {
        toast.error('Failed to set progress');
      }
    } catch (error) {
      console.error('Error setting debug progress:', error);
      toast.error('Failed to set progress');
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
       setSubmittingAnswers(prev => ({ ...prev, [challengeId]: true }));
       const response = await submitChallengeAnswer(classroomId, challengeId, answer);
       
       if (response.success) {
         // Show reward modal with all earned rewards
         setRewardData({
           rewards: response.rewards,
           challengeName: response.challengeName,
           allCompleted: response.allCompleted,
           nextChallenge: response.nextChallenge
         });
         setShowRewardModal(true);
         
         // Clear the answer input
         setChallengeAnswers(prev => ({ ...prev, [challengeId]: '' }));
         
         // Refresh challenge data to show updated progress
         await fetchChallengeData();
       } else {
         toast.error(response.message);
         if (response.hint) {
           toast.info(response.hint);
         }
       }
     } catch (error) {
       toast.error(error.message || 'Failed to submit answer');
     } finally {
       setSubmittingAnswers(prev => ({ ...prev, [challengeId]: false }));
     }
   };

   // Get reward data for completed challenge
   const getRewardDataForChallenge = (challengeIndex) => {
     if (!challengeData?.settings) return null;

     const rewards = {
       bits: 0,
       multiplier: 0,
       luck: 1.0,
       discount: 0,
       shield: false,
       attackBonus: 0
     };

     // Calculate bits
     if (challengeData.settings.rewardMode === 'individual') {
       rewards.bits = challengeData.settings.challengeBits?.[challengeIndex] || 0;
     }

     // Calculate other rewards
     if (challengeData.settings.multiplierMode === 'individual') {
       const multiplierReward = challengeData.settings.challengeMultipliers?.[challengeIndex] || 1.0;
       if (multiplierReward > 1.0) {
         rewards.multiplier = multiplierReward - 1.0;
       }
     }

     if (challengeData.settings.luckMode === 'individual') {
       const luckReward = challengeData.settings.challengeLuck?.[challengeIndex] || 1.0;
       if (luckReward > 1.0) {
         rewards.luck = luckReward;
       }
     }

     if (challengeData.settings.discountMode === 'individual') {
       const discountReward = challengeData.settings.challengeDiscounts?.[challengeIndex] || 0;
       if (discountReward > 0) {
         rewards.discount = discountReward;
       }
     }

     if (challengeData.settings.shieldMode === 'individual') {
       const shieldReward = challengeData.settings.challengeShields?.[challengeIndex] || false;
       if (shieldReward) {
         rewards.shield = true;
       }
     }

     if (challengeData.settings.attackMode === 'individual') {
       const attackReward = challengeData.settings.challengeAttackBonuses?.[challengeIndex] || 0;
       if (attackReward > 0) {
         rewards.attackBonus = attackReward;
       }
     }

     return {
       rewards,
       challengeName: challengeNames[challengeIndex],
       allCompleted: challengeIndex === 3, // All 4 challenges completed
       nextChallenge: challengeIndex < 3 ? challengeNames[challengeIndex + 1] : null
     };
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
        shieldMode: challengeConfig.shieldMode,
        attackMode: challengeConfig.attackMode,
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
        settings.challengeLuck = challengeConfig.challengeLuck.map(luck => luck || 1.0);
      } else {
        settings.totalLuck = challengeConfig.totalLuck || 1.0;
        settings.challengeLuck = challengeConfig.challengeLuck.map(() => 1.0);
      }

      if (challengeConfig.discountMode === 'individual') {
        settings.challengeDiscounts = challengeConfig.challengeDiscounts.map(discount => discount || 0);
      } else {
        settings.totalDiscount = challengeConfig.totalDiscount || 0;
        settings.challengeDiscounts = challengeConfig.challengeDiscounts.map(() => 0);
      }

      if (challengeConfig.shieldMode === 'individual') {
        settings.challengeShields = challengeConfig.challengeShields.map(shield => shield || false);
      } else {
        settings.totalShield = challengeConfig.totalShield || false;
        settings.challengeShields = challengeConfig.challengeShields.map(() => false);
      }

      if (challengeConfig.attackMode === 'individual') {
        settings.challengeAttackBonuses = challengeConfig.challengeAttackBonuses.map(attack => attack || 0);
      } else {
        settings.totalAttackBonus = challengeConfig.totalAttackBonus || 0;
        settings.challengeAttackBonuses = challengeConfig.challengeAttackBonuses.map(() => 0);
      }

      // Add due date and retry settings
      settings.dueDateEnabled = challengeConfig.dueDateEnabled || false;
      settings.dueDate = challengeConfig.dueDate || '';
      settings.retryEnabled = challengeConfig.retryEnabled || false;
      settings.maxRetries = challengeConfig.maxRetries || 3;

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
      setShowDeleteWarning(true);
      setDontShowDeleteWarning(false);
    }
  };

  const handleConfirmDeactivate = async () => {
    try {
      setInitiating(true);
      const response = await deactivateChallenge(classroomId);
      setChallengeData(response.challenge);
      toast.success(response.message);
      setShowDeleteWarning(false);
      if (dontShowDeleteWarning) {
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
        shieldMode: challengeConfig.shieldMode,
        attackMode: challengeConfig.attackMode,
        challengeBits: challengeConfig.challengeBits,
        totalRewardBits: challengeConfig.totalRewardBits,
        challengeMultipliers: challengeConfig.challengeMultipliers,
        totalMultiplier: challengeConfig.totalMultiplier,
        challengeLuck: challengeConfig.challengeLuck,
        totalLuck: challengeConfig.totalLuck,
        challengeDiscounts: challengeConfig.challengeDiscounts,
        totalDiscount: challengeConfig.totalDiscount,
        challengeShields: challengeConfig.challengeShields,
        totalShield: challengeConfig.totalShield,
        challengeAttackBonuses: challengeConfig.challengeAttackBonuses,
        totalAttackBonus: challengeConfig.totalAttackBonus,
        dueDateEnabled: challengeConfig.dueDateEnabled,
        dueDate: challengeConfig.dueDate,
        retryEnabled: challengeConfig.retryEnabled,
        maxRetries: challengeConfig.maxRetries,
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
      challengeLuck: template.settings.challengeLuck || [1.0, 1.0, 1.0, 1.0],
      totalLuck: template.settings.totalLuck || 1.0,
      discountMode: template.settings.discountMode || 'individual',
      challengeDiscounts: template.settings.challengeDiscounts || [0, 0, 0, 0],
      totalDiscount: template.settings.totalDiscount || 0,
      shieldMode: template.settings.shieldMode || 'individual',
      challengeShields: template.settings.challengeShields || [false, false, false, false],
      totalShield: template.settings.totalShield || false,
      attackMode: template.settings.attackMode || 'individual',
      challengeAttackBonuses: template.settings.challengeAttackBonuses || [0, 0, 0, 0],
      totalAttackBonus: template.settings.totalAttackBonus || 0,
      dueDateEnabled: template.settings.dueDateEnabled || false,
      dueDate: template.settings.dueDate || '',
      retryEnabled: template.settings.retryEnabled || false,
      maxRetries: template.settings.maxRetries || 3
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
    } else if (progress === 1) {
      return {
        number: 2,
        name: "Check Me Out", 
        method: "OSINT & Git Exploration",
        type: "github"
      };
    } else if (progress === 2) {
      return {
        number: 3,
        name: "Memory Leak Detective",
        method: "C++ Debugging", 
        type: "debugging"
      };
    } else {
      return {
        number: 4,
        name: "Digital Forensics Lab",
        method: "Image Metadata Analysis",
        type: "forensics"
      };
    }
  };

  useEffect(() => {
    fetchChallengeData();
  }, [classroomId]);

  // Check for completed challenge on component mount and window focus
  useEffect(() => {
    const checkForCompletedChallenge = () => {
      const completedData = localStorage.getItem('challengeCompleted');
      if (completedData) {
        try {
          const { challengeIndex, challengeName, timestamp } = JSON.parse(completedData);
          
          const timeDiff = Date.now() - timestamp;
          if (timeDiff < 30000 && challengeData?.settings) {
            const rewardInfo = getRewardDataForChallenge(challengeIndex);
            if (rewardInfo) {
              setRewardData(rewardInfo);
              setShowRewardModal(true);
              toast.success(`${challengeName} completed! 🎉`);
            }
            localStorage.removeItem('challengeCompleted');
          } else if (timeDiff >= 30000) {
            localStorage.removeItem('challengeCompleted');
          }
        } catch (error) {
          localStorage.removeItem('challengeCompleted');
        }
      }
    };

    if (challengeData?.settings) {
      checkForCompletedChallenge();
    }

    const handleFocus = () => {
      checkForCompletedChallenge();
      fetchChallengeData();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [challengeData]);



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

                  <div className="divider">Luck Multiplier Rewards</div>

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
                        <span className="label-text ml-2 font-semibold">Individual Luck Multipliers</span>
                      </label>
                      <label className="label cursor-pointer">
                        <input
                          type="radio"
                          name="luckMode"
                          className="radio radio-primary"
                          checked={challengeConfig.luckMode === 'total'}
                          onChange={() => setChallengeConfig(prev => ({ ...prev, luckMode: 'total' }))}
                        />
                        <span className="label-text ml-2 font-semibold">Total Series Luck Multiplier</span>
                      </label>
                    </div>
                  </div>

                  {challengeConfig.luckMode === 'individual' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {challengeNames.map((name, index) => (
                        <div key={index}>
                          <label className="label">
                            <span className="label-text">Challenge {index + 1}: {name} (1.0 = no bonus)</span>
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            className="input input-bordered w-full"
                            value={challengeConfig.challengeLuck[index]}
                            onChange={(e) => {
                              const value = e.target.value;
                              const newValue = value === '' ? 1.0 : parseFloat(value) || 1.0;
                              setChallengeConfig(prev => {
                                const newLuck = [...prev.challengeLuck];
                                newLuck[index] = value === '' ? '' : newValue;
                                return { ...prev, challengeLuck: newLuck };
                              });
                            }}
                            min="1.0"
                            placeholder="e.g. 1.2"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <label className="label">
                        <span className="label-text font-semibold">Total Series Luck Multiplier (1.0 = no bonus)</span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        className="input input-bordered w-full"
                        value={challengeConfig.totalLuck}
                        onChange={(e) => {
                          const value = e.target.value;
                          setChallengeConfig(prev => ({ 
                            ...prev, 
                            totalLuck: value === '' ? '' : parseFloat(value) || 1.0 
                          }));
                        }}
                        min="1.0"
                        placeholder="e.g. 1.5"
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

                  <div className="divider">Shield Rewards</div>

                  <div className="form-control">
                    <div className="flex gap-6">
                      <label className="label cursor-pointer">
                        <input
                          type="radio"
                          name="shieldMode"
                          className="radio radio-primary"
                          checked={challengeConfig.shieldMode === 'individual'}
                          onChange={() => setChallengeConfig(prev => ({ ...prev, shieldMode: 'individual' }))}
                        />
                        <span className="label-text ml-2 font-semibold">Individual Shields</span>
                      </label>
                      <label className="label cursor-pointer">
                        <input
                          type="radio"
                          name="shieldMode"
                          className="radio radio-primary"
                          checked={challengeConfig.shieldMode === 'total'}
                          onChange={() => setChallengeConfig(prev => ({ ...prev, shieldMode: 'total' }))}
                        />
                        <span className="label-text ml-2 font-semibold">Total Series Shield</span>
                      </label>
                    </div>
                  </div>

                  {challengeConfig.shieldMode === 'individual' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {challengeNames.map((name, index) => (
                        <div key={index}>
                          <label className="label">
                            <span className="label-text">Challenge {index + 1}: {name}</span>
                          </label>
                          <div className="form-control">
                            <label className="label cursor-pointer justify-start gap-3">
                              <input
                                type="checkbox"
                                className="checkbox checkbox-primary"
                                checked={challengeConfig.challengeShields[index]}
                                onChange={(e) => {
                                  setChallengeConfig(prev => {
                                    const newShields = [...prev.challengeShields];
                                    newShields[index] = e.target.checked;
                                    return { ...prev, challengeShields: newShields };
                                  });
                                }}
                              />
                              <span className="label-text">Award Shield Protection</span>
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="form-control">
                      <label className="label cursor-pointer justify-start gap-3">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-primary"
                          checked={challengeConfig.totalShield}
                          onChange={(e) => {
                            setChallengeConfig(prev => ({ 
                              ...prev, 
                              totalShield: e.target.checked 
                            }));
                          }}
                        />
                        <span className="label-text font-semibold">Award Shield for Completing All Challenges</span>
                      </label>
                    </div>
                  )}

                  <div className="divider">Attack Bonus Rewards</div>

                  <div className="form-control">
                    <div className="flex gap-6">
                      <label className="label cursor-pointer">
                        <input
                          type="radio"
                          name="attackMode"
                          className="radio radio-primary"
                          checked={challengeConfig.attackMode === 'individual'}
                          onChange={() => setChallengeConfig(prev => ({ ...prev, attackMode: 'individual' }))}
                        />
                        <span className="label-text ml-2 font-semibold">Individual Attack Bonuses</span>
                      </label>
                      <label className="label cursor-pointer">
                        <input
                          type="radio"
                          name="attackMode"
                          className="radio radio-primary"
                          checked={challengeConfig.attackMode === 'total'}
                          onChange={() => setChallengeConfig(prev => ({ ...prev, attackMode: 'total' }))}
                        />
                        <span className="label-text ml-2 font-semibold">Total Series Attack Bonus</span>
                      </label>
                    </div>
                  </div>

                  {challengeConfig.attackMode === 'individual' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {challengeNames.map((name, index) => (
                        <div key={index}>
                          <label className="label">
                            <span className="label-text">Challenge {index + 1}: {name}</span>
                          </label>
                          <input
                            type="number"
                            className="input input-bordered w-full"
                            value={challengeConfig.challengeAttackBonuses[index]}
                            onChange={(e) => {
                              const value = e.target.value;
                              const newValue = value === '' ? 0 : parseInt(value) || 0;
                              setChallengeConfig(prev => {
                                const newAttackBonuses = [...prev.challengeAttackBonuses];
                                newAttackBonuses[index] = value === '' ? '' : newValue;
                                return { ...prev, challengeAttackBonuses: newAttackBonuses };
                              });
                            }}
                            min="0"
                            placeholder="e.g. 50"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <label className="label">
                        <span className="label-text font-semibold">Total Series Attack Bonus</span>
                      </label>
                      <input
                        type="number"
                        className="input input-bordered w-full"
                        value={challengeConfig.totalAttackBonus}
                        onChange={(e) => {
                          const value = e.target.value;
                          setChallengeConfig(prev => ({ 
                            ...prev, 
                            totalAttackBonus: value === '' ? '' : parseInt(value) || 0 
                          }));
                        }}
                        min="0"
                        placeholder="e.g. 200"
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

                {/* Due Dates and Retry Settings */}
                <div className="bg-base-200 p-4 rounded-lg">
                  <h3 className="font-bold text-lg mb-4">📅 Due Dates & Retries</h3>
                  
                  <div className="divider">Due Date</div>
                  <div className="form-control mb-4">
                    <label className="label cursor-pointer justify-start gap-3">
                      <input 
                        type="checkbox" 
                        className="checkbox"
                        checked={challengeConfig.dueDateEnabled}
                        onChange={(e) => setChallengeConfig(prev => ({ ...prev, dueDateEnabled: e.target.checked }))}
                      />
                      <span className="label-text font-semibold">Set due date for challenge series</span>
                    </label>
                  </div>
                  
                  {challengeConfig.dueDateEnabled && (
                    <div className="ml-6 mb-4">
                      <label className="label">
                        <span className="label-text">Due date and time</span>
                      </label>
                      <input
                        type="datetime-local"
                        className="input input-bordered w-64"
                        value={challengeConfig.dueDate}
                        onChange={(e) => setChallengeConfig(prev => ({ ...prev, dueDate: e.target.value }))}
                        min={new Date().toISOString().slice(0, 16)}
                      />
                      <div className="text-sm text-gray-500 mt-1">Students must complete all challenges by this date and time</div>
                    </div>
                  )}

                  <div className="divider">Retry Limits</div>
                  <div className="form-control mb-4">
                    <label className="label cursor-pointer justify-start gap-3">
                      <input 
                        type="checkbox" 
                        className="checkbox"
                        checked={challengeConfig.retryEnabled}
                        onChange={(e) => setChallengeConfig(prev => ({ ...prev, retryEnabled: e.target.checked }))}
                      />
                      <span className="label-text font-semibold">Limit retry attempts</span>
                    </label>
                  </div>
                  
                  {challengeConfig.retryEnabled && (
                    <div className="ml-6 mb-4">
                      <label className="label">
                        <span className="label-text">Maximum retries per challenge</span>
                      </label>
                      <input
                        type="number"
                        className="input input-bordered w-32"
                        value={challengeConfig.maxRetries}
                        onChange={(e) => setChallengeConfig(prev => ({ ...prev, maxRetries: parseInt(e.target.value) || 3 }))}
                        min="1"
                        max="10"
                        placeholder="3"
                      />
                      <div className="text-sm text-gray-500 mt-1">Number of failed attempts allowed per challenge</div>
                    </div>
                  )}
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

        {showDeleteWarning && (
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
                      checked={dontShowDeleteWarning}
                      onChange={(e) => setDontShowDeleteWarning(e.target.checked)}
                    />
                    <span className="label-text text-sm">Don't show this warning again</span>
                  </label>
                </div>
                <div className="card-actions justify-end gap-2">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setShowDeleteWarning(false)}
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
                  onClick={() => setShowDebugPanel(true)}
                  className="btn btn-sm btn-accent gap-1"
                >
                  🔧 Debug
                </button>
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
        
        {/* Due Date Display */}
        {challengeData?.settings?.dueDateEnabled && challengeData?.settings?.dueDate && (
          <div className={`mt-4 p-3 rounded-lg border ${
            new Date() > new Date(challengeData.settings.dueDate) 
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            <div className="flex items-center gap-2">
              <span className="font-semibold">
                {new Date() > new Date(challengeData.settings.dueDate) ? '⚠️ Past Due:' : '⏰ Due Date:'}
              </span>
              <span>
                {new Date(challengeData.settings.dueDate).toLocaleDateString()} at{' '}
                {new Date(challengeData.settings.dueDate).toLocaleTimeString()}
              </span>
            </div>
            {new Date() > new Date(challengeData.settings.dueDate) && (
              <p className="text-sm mt-1">This challenge series has expired and is no longer available for completion.</p>
            )}
          </div>
        )}
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
        // Check if challenge is expired (unless user is a teacher)
        challengeData?.settings?.dueDateEnabled && 
        challengeData?.settings?.dueDate && 
        new Date() > new Date(challengeData.settings.dueDate) && 
        !isTeacher ? (
          <div className="card bg-base-100 border border-red-200 shadow-md rounded-2xl p-6 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="text-6xl">⏰</div>
              <h2 className="text-2xl font-semibold text-red-600">Challenge Series Expired</h2>
              <p className="text-gray-600 max-w-md">
                This challenge series was due on {new Date(challengeData.settings.dueDate).toLocaleDateString()} at{' '}
                {new Date(challengeData.settings.dueDate).toLocaleTimeString()}. 
                You can no longer participate in this challenge.
              </p>
              {userChallenge.progress > 0 && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-blue-800 font-medium">
                    Your Progress: Completed {userChallenge.progress} out of 4 challenges
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
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
                      <a href={`/challenge-site/${userChallenge.uniqueId}`} target="_blank" rel="noopener noreferrer">
                        /challenge-site/{userChallenge.uniqueId}
                      </a>
                    </code>
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
                          <a href={`/challenge-2-site/${userChallenge.uniqueId}`} target="_blank" rel="noopener noreferrer">
                            /challenge-2-site/{userChallenge.uniqueId}
                          </a>
                        </code>
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

            {/* Challenge 3 - Memory Leak Detective */}
            <div className="space-y-3">
              <div className={`collapse collapse-arrow ${userChallenge.progress >= 2 ? (userChallenge.progress >= 3 ? 'bg-green-50 border border-green-200' : 'bg-purple-50 border border-purple-200') : 'bg-gray-50 border border-gray-200 opacity-60'}`}>
                {userChallenge.progress >= 2 && <input type="checkbox" defaultChecked={userChallenge.progress < 3} className="peer" />}
                <div className="collapse-title text-lg font-medium flex items-center gap-3">
                  <div className={`badge ${userChallenge.progress >= 3 ? 'badge-success' : userChallenge.progress >= 2 ? 'badge-info' : 'badge-neutral'}`}>Challenge 3</div>
                  <span className={userChallenge.progress >= 3 ? 'text-green-800' : userChallenge.progress >= 2 ? 'text-purple-800' : 'text-gray-600'}>🐛 Memory Leak Detective</span>
                  <div className="badge badge-outline badge-sm">
                    {challengeData?.settings?.rewardMode === 'total' ? '0' : (challengeData?.settings?.challengeBits?.[2] || challengeConfig.challengeBits[2])} bits
                  </div>
                  <div className="ml-auto text-sm text-gray-400">
                    {userChallenge.progress >= 3 ? '✅ Completed' : userChallenge.progress >= 2 ? '🔓 Unlocked' : '🔒 Locked'}
                  </div>
                </div>
                {userChallenge.progress >= 2 && (
                  <div className="collapse-content">
                    <div className="pt-4 space-y-4">
                      <p className="text-gray-600">
                        Debug a legacy C++ university registration system with multiple memory leaks and logic errors.
                      </p>
                      
                      <div className="bg-purple-50 border border-purple-300 rounded-lg p-4">
                        <h4 className="font-semibold text-purple-800 mb-2">🔧 Your Mission</h4>
                        <p className="text-sm text-gray-700 mb-3">
                          Fix all bugs in the provided C++ codebase. When all tests pass, the system will reveal your password.
                        </p>
                        <div className="space-y-2">
                          <p className="text-xs text-gray-600">⚠️ Warning: The code contains misleading comments and red herring bugs</p>
                          <p className="text-xs text-gray-600">🎯 Each student gets unique bugs and variable names</p>
                        </div>
                      </div>
                      
                      <div className="bg-white border border-purple-300 rounded-lg p-4">
                        <h4 className="font-semibold text-purple-800 mb-2">🌐 Debugging Environment</h4>
                        <p className="text-sm text-gray-600 mb-3">Access your personalized debugging challenge:</p>
                        <code className="text-blue-600 font-mono text-sm block mb-3">
                          <a href={`/challenge-3-site/${userChallenge.uniqueId}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            /challenge-3-site/{userChallenge.uniqueId}
                          </a>
                        </code>
                        <p className="text-xs text-gray-500">
                          Opens in a new window with a full C++ debugging environment
                        </p>
                      </div>
                      
                      <div className="alert alert-warning">
                        <span className="text-sm">
                          <strong>Advanced Challenge:</strong> This will test your C++ debugging skills, memory management, and logical reasoning. Expect to spend 1-3 hours on this challenge.
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Challenge 4 - Digital Forensics Lab */}
            <div className="space-y-3">
              <div className={`collapse collapse-arrow ${userChallenge.progress >= 3 ? (userChallenge.progress >= 4 ? 'bg-green-50 border border-green-200' : 'bg-orange-50 border border-orange-200') : 'bg-gray-50 border border-gray-200 opacity-60'}`}>
                {userChallenge.progress >= 3 && <input type="checkbox" defaultChecked={userChallenge.progress < 4} className="peer" />}
                <div className="collapse-title text-lg font-medium flex items-center gap-3">
                  <div className={`badge ${userChallenge.progress >= 4 ? 'badge-success' : userChallenge.progress >= 3 ? 'badge-info' : 'badge-neutral'}`}>Challenge 4</div>
                  <span className={userChallenge.progress >= 4 ? 'text-green-800' : userChallenge.progress >= 3 ? 'text-orange-800' : 'text-gray-600'}>🕵️ Digital Forensics Lab</span>
                  <div className="badge badge-outline badge-sm">
                    {challengeData?.settings?.rewardMode === 'total' ? (challengeData?.settings?.totalRewardBits || challengeConfig.totalRewardBits) : (challengeData?.settings?.challengeBits?.[3] || challengeConfig.challengeBits[3])} bits
                  </div>
                  <div className="ml-auto text-sm text-gray-400">
                    {userChallenge.progress >= 4 ? '✅ Completed' : userChallenge.progress >= 3 ? '🔓 Unlocked' : '🔒 Locked'}
                  </div>
                </div>
                {userChallenge.progress >= 3 && (
                  <div className="collapse-content">
                    <div className="pt-4 space-y-4">
                      <p className="text-gray-600">
                        Your final mission: Conduct a digital forensics investigation to extract hidden information from image metadata.
                      </p>
                      
                      <div className="bg-orange-50 border border-orange-300 rounded-lg p-4">
                        <h4 className="font-semibold text-orange-800 mb-2">🕵️ Your Investigation</h4>
                        <p className="text-sm text-gray-700 mb-3">
                          A suspicious image containing forensics evidence has been planted in a GitHub repository. Your task is to find it and extract the hidden metadata.
                        </p>
                        <div className="space-y-2">
                          <p className="text-xs text-gray-600">🔍 Use OSINT techniques to locate your evidence</p>
                          <p className="text-xs text-gray-600">🖼️ Analyze EXIF metadata to find hidden information</p>
                          <p className="text-xs text-gray-600">📊 Each student has unique evidence with personalized data</p>
                        </div>
                      </div>
                      
                      <div className="bg-white border border-orange-300 rounded-lg p-4">
                        <h4 className="font-semibold text-orange-800 mb-2">🌐 Forensics Investigation</h4>
                        <p className="text-sm text-gray-600 mb-3">Begin your digital forensics investigation:</p>
                        <code className="text-blue-600 font-mono text-sm block mb-3">
                          <a href={`/challenge-4-site/${userChallenge.uniqueId}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            /challenge-4-site/{userChallenge.uniqueId}
                          </a>
                        </code>
                        <p className="text-xs text-gray-500">
                          Opens the forensics investigation environment with evidence generation and analysis tools
                        </p>
                      </div>
                      
                      <div className="alert alert-error">
                        <span className="text-sm">
                          <strong>Final Challenge:</strong> This investigation combines OSINT, digital forensics, and metadata analysis. Master all skills learned in the previous challenges!
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        )
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



      {/* Reward Modal */}
      {showRewardModal && rewardData && (
        <RewardModal
          isOpen={showRewardModal}
          onClose={() => setShowRewardModal(false)}
          rewards={rewardData.rewards}
          challengeName={rewardData.challengeName}
          allCompleted={rewardData.allCompleted}
          nextChallenge={rewardData.nextChallenge}
        />
      )}

      {/* Debug Panel Modal */}
      {showDebugPanel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">🔧 Teacher Debug Panel</h3>
              <button
                onClick={() => setShowDebugPanel(false)}
                className="btn btn-sm btn-circle btn-ghost"
              >
                ✕
              </button>
            </div>
            
            <p className="text-gray-600 mb-4">
              Skip to any challenge for testing purposes:
            </p>
            
            <div className="space-y-2">
              {challengeNames.map((name, index) => (
                <button
                  key={index}
                  onClick={() => setDebugProgress(index)}
                  className={`w-full text-left btn btn-outline ${
                    userChallenge?.progress === index ? 'btn-primary' : ''
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="badge badge-neutral">Challenge {index + 1}</span>
                    {name}
                  </span>
                </button>
              ))}
            </div>
            
            <div className="mt-4 pt-4 border-t">
              <button
                onClick={() => setDebugProgress(4)}
                className="w-full btn btn-success"
              >
                🎉 Complete All Challenges
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Challenge;
