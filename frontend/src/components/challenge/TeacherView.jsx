import { useState, useEffect, useRef } from 'react';
import { useMemo } from 'react';
import { Shield, Settings, Users, Eye, EyeOff, UserPlus, Edit3, Trophy, Coins, TrendingUp, Zap, Percent } from 'lucide-react';
import { CHALLENGE_NAMES } from '../../constants/challengeConstants';
import { getCurrentChallenge } from '../../utils/challengeUtils';
import { getThemeClasses } from '../../utils/themeUtils';
import { updateDueDate, toggleChallengeVisibility, resetStudentChallenge, resetSpecificChallenge } from '../../API/apiChallenge';
import { API_BASE } from '../../config/api';
import ChallengeUpdateModal from './modals/ChallengeUpdateModal';
import toast from 'react-hot-toast';
import socket from '../../utils/socket';
import Footer from '../Footer';
import ExportButtons from '../ExportButtons';
import ConfirmModal from '../ConfirmModal'; // <-- NEW import

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
  // Search state for deep filtering in the student table
  const [search, setSearch] = useState('');
  // New filter UI state
  const [roleFilter, setRoleFilter] = useState('all'); // 'all' | 'student' | 'teacher'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'inprogress' | 'completed' | 'failed'
  const [challengeFilter, setChallengeFilter] = useState('all'); // 'all' or '0'..'6'
  // Clear filters helper (reset search + selects)
  const clearFilters = () => {
    setSearch('');
    setRoleFilter('all');
    setStatusFilter('all');
    setChallengeFilter('all');
  };
  const [showPasswords, setShowPasswords] = useState({});
  const [showDueDateModal, setShowDueDateModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [studentNames, setStudentNames] = useState({});
  const [assignSearch, setAssignSearch] = useState('');
  const [challenge6Data, setChallenge6Data] = useState({});
  const [challenge7Data, setChallenge7Data] = useState({});
  const [challenge3Data, setChallenge3Data] = useState({});
  const [localDueDate, setLocalDueDate] = useState('');
  const [togglingVisibility, setTogglingVisibility] = useState(false);
  const [showHintModal, setShowHintModal] = useState(false);
  const [editingHints, setEditingHints] = useState(null);
  const dropdownRef = useRef(null);
  const themeClasses = getThemeClasses(isDark);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmOptions, setConfirmOptions] = useState({
    title: 'Confirm',
    message: '',
    confirmText: 'Confirm',
    onConfirm: null
  });

  // Open a consistent ConfirmModal used across this component
  const openConfirm = ({ title = 'Confirm', message = '', confirmText = 'Confirm', cancelText = 'Cancel', confirmButtonClass = 'btn-primary', onConfirm = null }) => {
    setConfirmOptions({ title, message, confirmText, cancelText, confirmButtonClass, onConfirm });
    setShowConfirm(true);
  };

  // Called when the modal's Confirm button is pressed
  const handleConfirm = async () => {
    setShowConfirm(false);
    if (typeof confirmOptions.onConfirm === 'function') {
      try {
        await confirmOptions.onConfirm();
      } catch (err) {
        // caller is responsible for showing errors (toast), swallow here to avoid unhandled rejections
        console.error('Confirm callback error', err);
      }
    }
  };

  useEffect(() => {
    if (challengeData?.settings?.dueDate) {
      const utcDate = new Date(challengeData.settings.dueDate);
      const year = utcDate.getFullYear();
      const month = String(utcDate.getMonth() + 1).padStart(2, '0');
      const day = String(utcDate.getDate()).padStart(2, '0');
      const hours = String(utcDate.getHours()).padStart(2, '0');
      const minutes = String(utcDate.getMinutes()).padStart(2, '0');
      const localISOString = `${year}-${month}-${day}T${hours}:${minutes}`;
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
            const response = await fetch(`${API_BASE}/api/profile/student/${studentId}`, {
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

      const response = await fetch(`${API_BASE}/api/challenges/${challengeId}/assign-student`, {
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

  // Clear assign search when dropdown closes
  useEffect(() => {
    if (!showAssignDropdown) setAssignSearch('');
  }, [showAssignDropdown]);

  useEffect(() => {
    const fetchChallenge3Data = async () => {
      if (!challengeData?.userChallenges) return;
      
      const newChallenge3Data = {};
      
      for (const uc of challengeData.userChallenges) {
        if (uc.progress === 2 || uc.currentChallenge === 2 || (uc.progress > 2 && uc.completedChallenges?.[2])) {
          try {
            const response = await fetch(`${API_BASE}/api/challenges/challenge3/${uc.uniqueId}/teacher`, {
              credentials: 'include'
            });
            
            if (response.ok) {
              const data = await response.json();
              newChallenge3Data[uc.uniqueId] = {
                expectedOutput: data.cppChallenge?.actualOutput || 'Error'
              };
            }
          } catch (error) {
            console.error('Error fetching Challenge 3 data:', error);
            newChallenge3Data[uc.uniqueId] = {
              expectedOutput: 'Error'
            };
          }
        }
      }
      
      setChallenge3Data(newChallenge3Data);
    };

    const fetchChallenge6Data = async () => {
      if (!challengeData?.userChallenges) return;
      
      const newChallenge6Data = {};
      
      for (const uc of challengeData.userChallenges) {
        if (uc.progress === 5 || uc.currentChallenge === 5 || (uc.progress > 5 && uc.completedChallenges?.[5])) {
          try {
            const response = await fetch(`${API_BASE}/api/challenges/challenge6/${uc.uniqueId}/teacher`, {
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

    fetchChallenge3Data();
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
        if (uc.progress === 6 || uc.currentChallenge === 6 || (uc.progress > 6 && uc.completedChallenges?.[6])) {
          try {
            const timestamp = Date.now();
            const response = await fetch(`${API_BASE}/api/challenges/challenge7/${uc.uniqueId}/teacher?t=${timestamp}&bustCache=true`, {
              credentials: 'include',
              headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
              }
            });
            
            if (response.ok) {
              const data = await response.json();
              
              console.log(`🔍 Received Challenge 7 data for ${uc.uniqueId}:`, {
                hasQuote: !!data.quote,
                hasAuthor: !!data.author,
                hasWords: !!data.words,
                quote: data.quote,
                author: data.author,
                wordsLength: data.words?.length
              });
              
              if (data.uniqueId && data.uniqueId !== uc.uniqueId) {
                console.warn(`Challenge 7 data mismatch! Expected ${uc.uniqueId}, got ${data.uniqueId}`);
                continue;
              }
              
              const uniqueWords = data.words && Array.isArray(data.words) 
                ? [...new Set(data.words.map(w => w.toLowerCase()))] 
                : [];
              newChallenge7Data[uc.uniqueId] = {
                quote: data.quote || 'Quote not available',
                author: data.author || 'Unknown author',
                words: data.words || [],
                uniqueWords: uniqueWords,
                wordTokens: data.wordTokens || {},
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

  const handleToggleVisibility = async () => {
    try {
      setTogglingVisibility(true);
      const result = await toggleChallengeVisibility(classroomId);
      toast.success(result.message);
      await fetchChallengeData();
    } catch (error) {
      toast.error(error.message || 'Failed to toggle challenge visibility');
    } finally {
      setTogglingVisibility(false);
    }
  };

  // ---------- visibleUserChallenges (memoized, respects filters + deep search) ----------
  const visibleUserChallenges = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    if (!challengeData?.userChallenges) return [];

    return challengeData.userChallenges
      .filter(uc => uc.userId) // must have a user
      .filter(uc => {
        // ensure user is still part of the classroom
        const studentInClassroom = (classroomStudents || []).some(student =>
          (typeof student === 'string' ? student : student._id) === uc.userId._id
        );
        if (!studentInClassroom) return false;

        // role filter
        if (roleFilter !== 'all') {
          // Normalize role: prefer populated role, otherwise try to infer from classroom data
          let role = '';
          if (uc.userId && typeof uc.userId === 'object') {
            role = String(uc.userId.role || '').toLowerCase();
          } else {
            role = '';
          }
  
          // If not populated, attempt to infer by matching ids against classroom.teacher / classroom.students
          if (!role) {
            const uid = typeof uc.userId === 'object' ? (uc.userId._id || '') : uc.userId;
            if (String(classroom?.teacher?._id || classroom?.teacher) === String(uid)) {
              role = 'teacher';
            } else if ((classroom?.students || []).some(s => String(s._id || s) === String(uid))) {
              // classroom.students usually contains students and may include promoted Admin/TAs; treat as 'student' unless role is known
              role = 'student';
            } else {
              // fallback: leave unknown empty so it won't incorrectly match 'student' or 'teacher'
              role = '';
            }
          }
  
          if (role !== roleFilter) return false;
        }

        // challenge filter (workingOn = currentChallenge || progress)
        const workingOn = uc.currentChallenge !== undefined ? uc.currentChallenge : uc.progress;
        if (challengeFilter !== 'all' && Number(challengeFilter) !== workingOn) return false;

        // status filter: compute completed / failed / in-progress for the working challenge
        if (statusFilter !== 'all') {
          const isCompleted = Boolean(uc.completedChallenges?.[workingOn]);
          let isFailed = false;
          if (workingOn === 2) {
            const maxAttempts = uc.challenge3MaxAttempts || 5;
            const maxAttemptsReached = (uc.challenge3Attempts || 0) >= maxAttempts;
            let timeExpired = false;
            if (uc.challenge3StartTime) {
              const startTime = new Date(uc.challenge3StartTime);
              const currentTime = new Date();
              const timeElapsed = (currentTime - startTime) / (1000 * 60);
              timeExpired = timeElapsed > 120;
            }
            isFailed = maxAttemptsReached || timeExpired;
          } else if (workingOn === 5) {
            isFailed = (uc.challenge6Attempts || 0) >= 3;
          } else if (workingOn === 6) {
            isFailed = (uc.challenge7Attempts || 0) >= 3;
          }
          const inProgress = !isCompleted && !isFailed;

          if (statusFilter === 'completed' && !isCompleted) return false;
          if (statusFilter === 'failed' && !isFailed) return false;
          if (statusFilter === 'inprogress' && !inProgress) return false;
        }

        // deep search across user fields + challenge-specific fields
        if (!q) return true;
        const hay = [
          `${uc.userId.firstName || ''} ${uc.userId.lastName || ''}`,
          uc.userId.email || '',
          uc.uniqueId || '',
          challenge3Data[uc.uniqueId]?.expectedOutput || '',
          challenge6Data[uc.uniqueId]?.word || '',
          challenge7Data[uc.uniqueId]?.quote || '',
          Object.values(challenge7Data[uc.uniqueId]?.wordTokens || {}).flat().join(' ')
        ].join(' ').toLowerCase();

        return hay.includes(q);
      });
  }, [
    challengeData?.userChallenges,
    classroomStudents,
    search,
    roleFilter,
    statusFilter,
    challengeFilter,
    challenge3Data,
    challenge6Data,
    challenge7Data
  ]);
  // -------------------------------------------------------------------------------

  // ---------------- Export helpers ----------------
  const buildExportRows = () => {
    if (!challengeData || !challengeData.userChallenges) return [];
    const rows = [];

    for (const uc of challengeData.userChallenges) {
      const studentName = `${uc.userId?.firstName || ''} ${uc.userId?.lastName || ''}`.trim() || (uc.userId?.email || '');
      const email = uc.userId?.email || '';
      const uniqueId = uc.uniqueId || '';
      
      for (let idx = 0; idx < 7; idx++) {
        const challengeName = (CHALLENGE_NAMES && CHALLENGE_NAMES[idx]) || `Challenge ${idx + 1}`;
        const completed = Boolean(uc.completedChallenges?.[idx]);
        const attempts = Number(uc[`challenge${idx + 1}Attempts`] || 0);
        
        let maxAttemptsValue = uc[`challenge${idx + 1}MaxAttempts`] || '';
        if (idx === 2 && !maxAttemptsValue) maxAttemptsValue = 5; // C++ Bug Hunt
        if (idx === 5 && !maxAttemptsValue) maxAttemptsValue = 3; // Needle in a Haystack
        if (idx === 6 && !maxAttemptsValue) maxAttemptsValue = 3; // Hangman

        const startedAt = uc.challengeStartedAt?.[idx] || (idx === 0 ? uc.startedAt : null);
        const completedAt = uc.challengeCompletedAt?.[idx] || null;
        let status = 'Not Started';
        if (completed) status = 'Completed';
        else if (attempts > 0) status = 'In Progress';
        
        if ((maxAttemptsValue && attempts >= maxAttemptsValue) || ((idx === 5 || idx === 6) && attempts >= 3 && !completed)) {
          status = 'Failed';
        }

        // Get challenge-specific data and solutions
        let challengeData_specific = '';
        let solution = '';
        let rewardsEarned = '';
        let rewardsAvailable = ''; // NEW: What rewards are available for this challenge
        let hintsUsed = '';
        let hintsAvailable = ''; // NEW: What hints are available for this challenge

        switch (idx) {
          case 0: // Caesar Cipher
            challengeData_specific = uniqueId;
            solution = uc.hashedPassword || '';
            break;
          case 1: // GitHub OSINT
            challengeData_specific = `GitHub Branch: ${uniqueId}`;
            solution = uc.challenge2Password || '';
            break;
          case 2: // C++ Bug Hunt
            challengeData_specific = 'C++ Debugging Challenge';
            solution = challenge3Data[uniqueId]?.expectedOutput || '';
            break;
          case 3: // Forensics
            challengeData_specific = `Forensics Evidence: campus_${uniqueId}.jpg`;
            solution = uc.challenge4Password || '';
            break;
          case 4: // WayneAWS
            challengeData_specific = 'WayneAWS Authentication Portal';
            solution = 'External Verification Required';
            break;
          case 5: // Needle in Haystack
            challengeData_specific = `Search Word: "${challenge6Data[uniqueId]?.word || 'N/A'}"`;
            solution = challenge6Data[uniqueId]?.tokenId || '';
            break;
          case 6: // Hangman
            const challenge7Info = challenge7Data[uniqueId];
            if (challenge7Info && !challenge7Info.error) {
              challengeData_specific = `Quote: "${challenge7Info.quote}" - ${challenge7Info.author}`;
              const wordTokens = challenge7Info.wordTokens || {};
              const tokenSolutions = Object.entries(wordTokens)
                .map(([word, tokens]) => `${word}: [${tokens.join(', ')}]`)
                .join('; ');
              solution = tokenSolutions;
            
              // Add progress info for Challenge 7
              const revealedCount = uc.challenge7Progress?.revealedWords?.length || 0;
              const totalCount = challenge7Info.uniqueWords?.length || 0;
              if (totalCount > 0) {
                challengeData_specific += ` | Progress: ${revealedCount}/${totalCount} words (${((revealedCount / totalCount) * 100).toFixed(1)}%)`;
              }
            } else {
              challengeData_specific = 'Hangman Challenge - Data loading error';
              solution = 'Error loading solution data';
            }
            break;
        }

        // NEW: Get available rewards for this challenge (what could be earned)
        if (challengeData?.settings) {
          const availableRewards = [];
        
          if (challengeData.settings.rewardMode === 'individual') {
            const baseBits = challengeData.settings.challengeBits?.[idx] || 0;
            if (baseBits > 0) availableRewards.push(`${baseBits} ₿`);
          } else if (challengeData.settings.rewardMode === 'total' && idx === 6) {
            const totalBits = challengeData.settings.totalRewardBits || 0;
            if (totalBits > 0) availableRewards.push(`${totalBits} ₿ (series completion)`);
          }
        
          if (challengeData.settings.multiplierMode === 'individual') {
            const multiplier = challengeData.settings.challengeMultipliers?.[idx] || 1.0;
            if (multiplier > 1.0) availableRewards.push(`${multiplier}x Multiplier`);
          }
        
          if (challengeData.settings.luckMode === 'individual') {
            const luck = challengeData.settings.challengeLuck?.[idx] || 1.0;
            if (luck > 1.0) availableRewards.push(`${luck}x Luck`);
          }
        
          if (challengeData.settings.discountMode === 'individual') {
            const discount = challengeData.settings.challengeDiscounts?.[idx] || 0;
            if (discount > 0) availableRewards.push(`${discount}% Discount`);
          }
        
          if (challengeData.settings.shieldMode === 'individual') {
            const shield = challengeData.settings.challengeShields?.[idx];
            if (shield) availableRewards.push('Shield');
          }
        
          rewardsAvailable = availableRewards.join(', ') || 'No rewards configured';
        }

        // NEW: Get available hints for this challenge
        if (challengeData?.settings?.challengeHintsEnabled?.[idx]) {
          const challengeHints = challengeData.settings.challengeHints?.[idx] || [];
          const nonEmptyHints = challengeHints.filter(hint => hint && hint.trim());
          if (nonEmptyHints.length > 0) {
            hintsAvailable = nonEmptyHints.map((hint, i) => `Hint ${i + 1}: ${hint}`).join(' | ');
          } else {
            hintsAvailable = 'Hints enabled but not configured';
          }
        } else {
          hintsAvailable = 'No hints available';
        }

        // Calculate earned rewards for completed challenges
        if (completed && challengeData?.settings) {
          const earnedRewards = [];
        
          // Bits calculation with hint penalty
          if (challengeData.settings.rewardMode === 'individual') {
            let baseBits = challengeData.settings.challengeBits?.[idx] || 0;
            const hintsUsedCount = uc.hintsUsed?.[idx] || 0;
            const hintsEnabled = challengeData.settings.challengeHintsEnabled?.[idx];
            
            if (hintsEnabled && baseBits > 0 && hintsUsedCount > 0) {
              const penaltyPercent = challengeData.settings.hintPenaltyPercent ?? 25;
              const totalPenalty = (penaltyPercent * hintsUsedCount) / 100;
              const cappedPenalty = Math.min(totalPenalty, 0.8);
              const originalBits = baseBits;
              baseBits = Math.round(baseBits * (1 - cappedPenalty));
              hintsUsed = `${hintsUsedCount} hints used (${originalBits} → ${baseBits} ₿ after ${(penaltyPercent * hintsUsedCount)}% penalty)`;
            } else if (hintsUsedCount > 0) {
              hintsUsed = `${hintsUsedCount} hints used (no penalty)`;
            }
            
            if (baseBits > 0) earnedRewards.push(`${baseBits} ₿`);
          }
        
          // Other earned rewards
          if (challengeData.settings.multiplierMode === 'individual') {
            const multiplier = challengeData.settings.challengeMultipliers?.[idx] || 1.0;
            if (multiplier > 1.0) earnedRewards.push(`${multiplier}x Multiplier`);
          }
        
          if (challengeData.settings.luckMode === 'individual') {
            const luck = challengeData.settings.challengeLuck?.[idx] || 1.0;
            if (luck > 1.0) earnedRewards.push(`${luck}x Luck`);
          }
        
          if (challengeData.settings.discountMode === 'individual') {
            const discount = challengeData.settings.challengeDiscounts?.[idx] || 0;
            if (discount > 0) earnedRewards.push(`${discount}% Discount`);
          }
        
          if (challengeData.settings.shieldMode === 'individual') {
            const shield = challengeData.settings.challengeShields?.[idx];
            if (shield) earnedRewards.push('Shield');
          }
        
          rewardsEarned = earnedRewards.join(', ') || 'No rewards earned';
        } else if (completed) {
          rewardsEarned = 'Completed (rewards data unavailable)';
        } else {
          rewardsEarned = 'Not completed';
        }

        // Add hints used info if not already set
        if (!hintsUsed && uc.hintsUsed?.[idx]) {
          hintsUsed = `${uc.hintsUsed[idx]} hints used`;
        } else if (!hintsUsed) {
          hintsUsed = 'No hints used';
        }

        rows.push({
          classroomId: String(challengeData.classroomId || classroomId || ''),
          studentName,
          email,
          uniqueId,
          challengeIndex: idx,
          challengeName,
          status,
          attempts,
          maxAttempts: maxAttemptsValue,
          startedAt: startedAt ? new Date(startedAt).toISOString() : '',
          completedAt: completedAt ? new Date(completedAt).toISOString() : '',
          challengeData: challengeData_specific,
          solution: solution,
          rewardsAvailable: rewardsAvailable, // NEW
          rewardsEarned: rewardsEarned,
          hintsAvailable: hintsAvailable, // NEW
          hintsUsed: hintsUsed,
          // Additional useful fields
          timeToComplete: startedAt && completedAt ? 
            Math.round((new Date(completedAt) - new Date(startedAt)) / (1000 * 60)) + ' minutes' : '',
          failureReason: status === 'Failed' ? 
            (idx === 2 ? 'Max attempts or time limit exceeded' : 
             idx === 5 || idx === 6 ? 'Max attempts exceeded' : 'Unknown') : '',
          hintPenaltyPercent: challengeData.settings?.hintPenaltyPercent || 0
        });
      }
    }

    return rows;
  };

  const downloadBlob = (content, mimeType, filename) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportAsJSON = () => {
    const rows = buildExportRows();
    // Updated filename format: classroom + challenge + timestamp
    const classroomPart = classroom?.name || 'classroom';
    const codePart = classroom?.code ? `_${classroom.code}` : '';
    const challengePart = challengeData?.title ? `_${challengeData.title.replace(/[^a-zA-Z0-9_-]/g, '_')}` : '_challenge';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `${classroomPart}${codePart}${challengePart}_${timestamp}.json`;
    downloadBlob(JSON.stringify(rows, null, 2), 'application/json;charset=utf-8', filename);
    return filename;
  };

  const exportAsCSV = () => {
    const rows = buildExportRows();
    // Updated filename format: classroom + challenge + timestamp
    const classroomPart = classroom?.name || 'classroom';
    const codePart = classroom?.code ? `_${classroom.code}` : '';
    const challengePart = challengeData?.title ? `_${challengeData.title.replace(/[^a-zA-Z0-9_-]/g, '_')}` : '_challenge';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `${classroomPart}${codePart}${challengePart}_${timestamp}.csv`;
    
    if (!rows.length) {
      downloadBlob('', 'text/csv;charset=utf-8', filename);
      return filename;
    }
    const headers = Object.keys(rows[0]);
    const escapeCell = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (s.includes('"') || s.includes(',') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => escapeCell(r[h])).join(','))
    ].join('\n');

    downloadBlob(csv, 'text/csv;charset=utf-8', filename);
    return filename;
  };
  // --------------------------------------------------

  // Add this helper function near the top of the component

  const getRewardsForChallenge = (challengeIdx) => {
    if (!challengeData?.settings) return 'No rewards configured';
    
    const rewards = [];
    
    if (challengeData.settings.rewardMode === 'individual') {
      const baseBits = challengeData.settings.challengeBits?.[challengeIdx] || 0;
      if (baseBits > 0) rewards.push(`${baseBits} ₿`);
    }
    
    if (challengeData.settings.multiplierMode === 'individual') {
      const multiplier = challengeData.settings.challengeMultipliers?.[challengeIdx] || 1.0;
      if (multiplier > 1.0) rewards.push(`${multiplier}x Multiplier`);
    }
    
    if (challengeData.settings.luckMode === 'individual') {
      const luck = challengeData.settings.challengeLuck?.[challengeIdx] || 1.0;
      if (luck > 1.0) rewards.push(`${luck}x Luck`);
    }
    
    if (challengeData.settings.discountMode === 'individual') {
      const discount = challengeData.settings.challengeDiscounts?.[challengeIdx] || 0;
      if (discount > 0) rewards.push(`${discount}% Discount`);
    }
    
    if (challengeData.settings.shieldMode === 'individual') {
      const shield = challengeData.settings.challengeShields?.[challengeIdx];
      if (shield) rewards.push('Shield');
    }
    
    return rewards.length > 0 ? rewards.join(', ') : 'No rewards';
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 p-6 space-y-8">
      <div className={themeClasses.cardBase}>
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-8 h-8 text-red-500" />
          <h1 className="text-3xl font-bold text-base-content">
            {/* Prepend classroom name/code when available, then show configured title (or fallback) */}
            {classroom?.name ? `${classroom.name}${classroom.code ? ` (${classroom.code})` : ''} — ` : ''}
            {challengeData?.title || 'Cyber Challenge'}
          </h1>
        </div>
        <p className={`${themeClasses.mutedText} text-lg mb-6`}>
          The Exciting Cyber Challenge Series! Students progress through multiple cybersecurity-oriented, OSINT-inspired challenges, each with unique encrypted data and pass phrases to uncover.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4">
          {!challengeData || !challengeData.isActive ? (
            <button
              onClick={handleShowConfigModal}
              className="btn btn-error btn-lg gap-2 flex-wrap text-sm sm:text-base"
            >
              <Settings className="w-5 h-5" />
              Configure & Launch Challenge Series
            </button>
          ) : (
            <>
              <button
                onClick={handleToggleVisibility}
                disabled={togglingVisibility}
                className={`btn btn-lg gap-2 flex-wrap text-sm sm:text-base ${
                  challengeData.isVisible 
                    ? 'btn-warning' 
                    : 'btn-success'
                }`}
              >
                {togglingVisibility ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : challengeData.isVisible ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
                {challengeData.isVisible ? 'Hide from Students' : 'Show to Students'}
              </button>
              <button
                onClick={() => setShowUpdateModal(true)}
                className="btn btn-primary btn-lg gap-2 flex-wrap text-sm sm:text-base"
              >
                <Edit3 className="w-5 h-5" />
                Update Challenge
              </button>
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
            </>
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
                     <input
                       type="text"
                       placeholder="Search students..."
                       className="input input-sm input-bordered w-full mb-2"
                       value={assignSearch}
                       onChange={(e) => setAssignSearch(e.target.value)}
                       autoFocus
                     />
 
                     {/* filter unassigned by name / id */}
                     {(() => {
                       const q = (assignSearch || '').trim().toLowerCase();
                       return (q === '')
                         ? unassignedStudentIds
                         : unassignedStudentIds.filter(id => {
                             const name = (studentNames[id] || '').toLowerCase();
                             return name.includes(q) || String(id).toLowerCase().includes(q);
                           });
                     })().length > 0 ? (
                       (() => {
                         const filtered = (assignSearch || '').trim() === ''
                           ? unassignedStudentIds
                           : unassignedStudentIds.filter(id => {
                               const name = (studentNames[id] || '').toLowerCase();
                               const q = (assignSearch || '').trim().toLowerCase();
                               return name.includes(q) || String(id).toLowerCase().includes(q);
                             });
                         return filtered.map((studentId, index) => (
                           <button
                             key={`unassigned-${studentId}-${index}`}
                             onClick={() => handleAssignStudent(studentId)}
                             className="w-full text-left p-2 text-sm hover:bg-base-200 rounded flex items-center justify-between"
                           >
                             <span>{studentNames[studentId] || 'Loading...'}</span>
                             <UserPlus className="w-3 h-3" />
                           </button>
                         ));
                       })()
                     ) : (
                       <div className="text-xs text-gray-500 p-2">No matching students</div>
                     )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
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
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-semibold">Student Challenge Progress</h3>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 items-stretch w-full max-w-4xl">
                  <input
                    type="search"
                    placeholder="Search students, email, unique id, challenge text..."
                    className="input input-sm input-bordered w-full sm:flex-auto"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <div className="flex gap-2 flex-wrap items-center justify-start">
                    <select
                      className="select select-sm w-full sm:w-auto flex-shrink-0"
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                      title="Filter by role"
                    >
                      <option value="all">All roles</option>
                      <option value="student">Students</option>
                    </select>
                    <select
                      className="select select-sm w-full sm:w-auto flex-shrink-0"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      title="Filter by status"
                    >
                      <option value="all">All status</option>
                      <option value="inprogress">In progress</option>
                      <option value="completed">Completed</option>
                      <option value="failed">Failed</option>
                    </select>
                    <select
                      className="select select-sm w-full sm:w-auto flex-shrink-0"
                      value={challengeFilter}
                      onChange={(e) => setChallengeFilter(e.target.value)}
                      title="Filter by challenge"
                    >
                      <option value="all">All challenges</option>
                      {CHALLENGE_NAMES.map((n, i) => (
                        <option key={i} value={String(i)}>{`Ch ${i + 1}: ${n}`}</option>
                      ))}
                    </select>
                    <button
                      className="btn btn-sm btn-ghost ml-0 sm:ml-2"
                      onClick={clearFilters}
                      title="Clear search and filters"
                    >
                      Clear
                    </button>
                    {/* Export buttons moved here */}
                    <ExportButtons
                      onExportCSV={exportAsCSV}
                      onExportJSON={exportAsJSON}
                      userName={classroom?.name || challengeData?.title || 'challenge'}
                      exportLabel="challenge"
                    />
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
                <table className="table table-zebra w-full table-auto text-sm md:text-base">
                  <thead>
                    <tr>
                      <th className="whitespace-nowrap">Student</th>
                      <th className="whitespace-nowrap">Current Challenge</th>
                      <th className="hidden md:table-cell whitespace-nowrap">Challenge Data</th>
                      <th className="whitespace-nowrap">Solution</th>
                      <th className="hidden xl:table-cell whitespace-nowrap">Available Rewards</th> {/* NEW */}
                      <th className="hidden sm:table-cell whitespace-nowrap">Started At</th>
                      <th className="hidden lg:table-cell whitespace-nowrap">Completed At</th>
                      <th className="whitespace-nowrap">Status</th>
                      <th className="whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleUserChallenges.map((uc) => {
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
                              <span className="text-xs text-gray-500 mt-1">{currentChallenge.method}</span>

                              {/* Mobile-only: show Started / Completed info when table columns arehidden */}
                              <div className="sm:hidden mt-2 text-xs text-gray-500">
                                <div>
                                  <strong>Started:</strong>{' '}
                                  {uc.challengeStartedAt?.[workingOnChallenge]
                                    ? new Date(uc.challengeStartedAt[workingOnChallenge]).toLocaleString()
                                    : (uc.startedAt && workingOnChallenge === 0)
                                      ? new Date(uc.startedAt).toLocaleString()
                                      : 'Not started'}
                                </div>
                                <div className="mt-1">
                                  <strong>Completed:</strong>{' '}
                                  {uc.completedChallenges?.[workingOnChallenge] && uc.challengeCompletedAt?.[workingOnChallenge]
                                    ? new Date(uc.challengeCompletedAt[workingOnChallenge]).toLocaleString()
                                    : (uc.progress >= 7 && uc.completedAt)
                                      ? new Date(uc.completedAt).toLocaleString()
                                      : 'Not completed'}
                                </div>
                              </div>
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
                                {!uc.completedChallenges?.[2] && (() => {
                                  const maxAttempts = uc.challenge3MaxAttempts || 5;
                                  const maxAttemptsReached = (uc.challenge3Attempts || 0) >= maxAttempts;
                                  
                                  let timeExpired = false;
                                  if (uc.challenge3StartTime) {
                                    const startTime = new Date(uc.challenge3StartTime);
                                    const currentTime = new Date();
                                    const timeElapsed = (currentTime - startTime) / (1000 * 60);
                                    timeExpired = timeElapsed > 120;
                                  }
                                  
                                  return (maxAttemptsReached || timeExpired);
                                })() && (
                                  <div className="text-xs text-red-600 font-semibold">❌ Challenge Failed</div>
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
                                <div className="text-sm text-orange-600 font-medium">
                                  Word: "{challenge6Data[uc.uniqueId]?.word || 'Loading...'}"
                                </div>
                                <div className="flex justify-between items-center">
                                  <div className="text-xs text-gray-500">
                                    Digital Archaeology Challenge
                                  </div>
                                  {!uc.completedChallenges?.[5] && (
                                    <button
                                      onClick={async () => {
                                        try {
                                          const response = await fetch(`${API_BASE}/api/challenges/challenge6/${uc.uniqueId}/complete`, {
                                            method: 'POST',
                                            credentials: 'include'
                                          });
                                          if (response.ok) {
                                            toast.success('Challenge 6 completed for student');
                                            await fetchChallengeData();
                                          } else {
                                            toast.error('Failed to complete challenge');
                                          }
                                        } catch (error) {
                                          toast.error('Error completing challenge');
                                        }
                                      }}
                                      className="btn btn-xs btn-warning"
                                    >
                                      Skip to Completion
                                    </button>
                                  )}
                                </div>
                                {uc.completedChallenges?.[5] && (
                                  <div className="text-xs text-green-600 font-semibold">✅ Challenge Complete</div>
                                )}
                                {!uc.completedChallenges?.[5] && (uc.challenge6Attempts || 0) >= 3 && (
                                  <div className="text-xs text-red-600 font-semibold">❌ Challenge Failed</div>
                                )}
                              </div>
                            )}
                            {workingOnChallenge === 6 && (
                              <div className="space-y-1">
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
                                {uc.challenge7Progress && !challenge7Data[uc.uniqueId]?.error && !uc.completedChallenges?.[6] && (
                                  <div className="text-xs text-blue-600 font-medium">
                                    Progress: {uc.challenge7Progress.revealedWords?.length || 0}/{uc.challenge7Progress.totalWords || challenge7Data[uc.uniqueId]?.uniqueWords?.length || '?'} unique words revealed ({((uc.challenge7Progress.revealedWords?.length || 0) / (uc.challenge7Progress.totalWords || challenge7Data[uc.uniqueId]?.uniqueWords?.length || 1) * 100).toFixed(1)}%)
                                  </div>
                                )}
                                <div className="text-xs text-gray-500">
                                  Hangman Challenge {challenge7Data[uc.uniqueId]?.uniqueId ? `(ID: ${challenge7Data[uc.uniqueId].uniqueId})` : ''}
                                </div>
                                {uc.completedChallenges?.[6] && (
                                  <div className="text-xs text-green-600 font-semibold">✅ Challenge Complete</div>
                                )}
                                {!uc.completedChallenges?.[6] && (uc.challenge7Attempts || 0) >= 3 && (
                                  <div className="text-xs text-red-600 font-semibold">❌ Challenge Failed</div>
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
                              <div className="flex items-center gap-2">
                                <code className="bg-green-100 px-2 py-1 rounded text-sm font-mono text-green-700">
                                  {showPasswords[uc._id] 
                                    ? (challenge3Data[uc.uniqueId]?.expectedOutput || 'Loading...')
                                    : '••••••••'}
                                </code>
                                <button
                                  onClick={() => togglePasswordVisibility(uc._id)}
                                  className="btn btn-ghost btn-xs"
                                  aria-label="Toggle answer visibility"
                                >
                                  {showPasswords[uc._id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
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
                                {challenge7Data[uc.uniqueId]?.error ? (
                                  <div className="text-sm text-orange-600 font-semibold">
                                    ⚠️ Data loading error - please refresh page
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    {!uc.completedChallenges?.[6] && (
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
                                        <div className="flex justify-between items-center mt-2">
                                          {challenge7Data[uc.uniqueId]?.uniqueId && (
                                            <div className="text-xs text-gray-500">
                                              Challenge ID: {challenge7Data[uc.uniqueId].uniqueId}
                                            </div>
                                          )}
                                          <button
                                            onClick={async () => {
                                              try {
                                                const response = await fetch(`${API_BASE}/api/challenges/challenge7/${uc.uniqueId}/complete`, {
                                                  method: 'POST',
                                                  credentials: 'include'
                                                });
                                                if (response.ok) {
                                                  toast.success('Challenge 7 completed for student');
                                                  await fetchChallengeData();
                                                } else {
                                                  toast.error('Failed to complete challenge');
                                                }
                                              } catch (error) {
                                                toast.error('Error completing challenge');
                                              }
                                            }}
                                            className="btn btn-xs btn-warning"
                                          >
                                            Skip to Completion
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                    
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
                                                        title="Reveal value for this word"
                                                      >
                                                        <Eye className="w-3 h-3" />
                                                        Reveal
                                                      </button>
                                                    )}
                                                    {shouldShowTokens && (
                                                      <button
                                                        onClick={() => togglePasswordVisibility(teacherRevealKey)}
                                                        className="btn btn-xs btn-ghost gap-1"
                                                        title="Hide value"
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
                          <td className="hidden xl:table-cell">
                            <div className="space-y-1">
                              <div className="text-xs font-medium text-blue-600">
                                {getRewardsForChallenge(workingOnChallenge)}
                              </div>
                              {/* hint penalty / count */}
                              {challengeData?.settings?.challengeHintsEnabled?.[workingOnChallenge] && (
                                <>
                                  <div className="text-xs text-orange-600">
                                    -{challengeData.settings.hintPenaltyPercent || 25}% per hint
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {(() => {
                                      const hints = challengeData.settings.challengeHints?.[workingOnChallenge] || [];
                                      const nonEmpty = hints.filter(h => h && h.trim()).length;
                                      return nonEmpty > 0 ? `${nonEmpty} hint(s) available` : 'Hints enabled (not configured)';
                                    })()}
                                  </div>
                                </>
                              )}
                              {uc.hintsUsed?.[workingOnChallenge] > 0 && (
                                <div className="text-xs text-red-600 font-medium">
                                  Used: {uc.hintsUsed[workingOnChallenge]} hint(s)
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="hidden sm:table-cell">
                            {uc.challengeStartedAt?.[workingOnChallenge] ? (
                              <div className="text-xs md:text-sm">
                                <div>{new Date(uc.challengeStartedAt[workingOnChallenge]).toLocaleDateString()}</div>
                                <div className="text-xs text-gray-500">
                                  {new Date(uc.challengeStartedAt[workingOnChallenge]).toLocaleTimeString()}
                                </div>
                              </div>
                            ) : uc.startedAt && workingOnChallenge === 0 ? (
                              <div className="text-xs md:text-sm">
                                <div>{new Date(uc.startedAt).toLocaleDateString()}</div>
                                <div className="text-xs text-gray-500">
                                  {new Date(uc.startedAt).toLocaleTimeString()}
                                </div>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">Not started</span>
                            )}
                          </td>
                          <td className="hidden lg:table-cell">
                            {uc.completedChallenges?.[workingOnChallenge] && uc.challengeCompletedAt?.[workingOnChallenge] ? (
                              <div className="text-xs md:text-sm">
                                <div>{new Date(uc.challengeCompletedAt[workingOnChallenge]).toLocaleDateString()}</div>
                                <div className="text-xs text-gray-500">
                                  {new Date(uc.challengeCompletedAt[workingOnChallenge]).toLocaleTimeString()}
                                </div>
                              </div>
                            ) : uc.progress >= 7 && uc.completedAt ? (
                              <div className="text-xs md:text-sm">
                                <div>{new Date(uc.completedAt).toLocaleDateString()}</div>
                                <div className="text-xs text-gray-500">
                                  {new Date(uc.completedAt).toLocaleTimeString()}
                                </div>
                                <div className="text-xs text-blue-600 font-medium">
                                  Series Complete
                                </div>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">Not completed</span>
                            )}
                          </td>
                          <td>
                            {(() => {
                              if (uc.completedChallenges?.[workingOnChallenge]) {
                                return (
                                  <div className="badge badge-success whitespace-nowrap">
                                    Completed
                                  </div>
                                );
                              }
                                let isFailed = false;
                                if (workingOnChallenge === 2) { 
                                  const maxAttempts = uc.challenge3MaxAttempts || 5;
                                  const maxAttemptsReached = (uc.challenge3Attempts || 0) >= maxAttempts;
                                  
                                  let timeExpired = false;
                                  if (uc.challenge3StartTime) {
                                    const startTime = new Date(uc.challenge3StartTime);
                                    const currentTime = new Date();
                                    const timeElapsed = (currentTime - startTime) / (1000 * 60);
                                    timeExpired = timeElapsed > 120;
                                  }
                                  
                                  isFailed = maxAttemptsReached || timeExpired;
                                } else if (workingOnChallenge === 5) { 
                                  isFailed = (uc.challenge6Attempts || 0) >= 3;
                                } else if (workingOnChallenge === 6) { 
                                  isFailed = (uc.challenge7Attempts || 0) >= 3;
                                }
                              
                              if (isFailed) {
                                return (
                                  <div className="badge badge-error whitespace-nowrap">
                                    Failed
                                  </div>
                                );
                              }
                              
                              return (
                                <div className="badge badge-warning whitespace-nowrap">
                                  In Progress
                                </div>
                              );
                            })()} 
                          </td>
                          <td>
                            <div className="dropdown dropdown-end">
                              <div tabIndex={0} role="button" className="btn btn-xs btn-outline btn-warning gap-1 hover:btn-warning">
                                🔄 Reset ▼
                              </div>
                              <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow border border-base-300">
                                <li className="menu-title">
                                  <span className="text-xs text-gray-500">Reset Options</span>
                                </li>
                                {[0, 1, 2, 3, 4, 5, 6].map((challengeIdx) => {
                                  const challengeNames = ['Challenge 1: Caesar Cipher', 'Challenge 2: GitHub OSINT', 'Challenge 3: C++ Debug', 'Challenge 4: Forensics', 'Challenge 5: WayneAWS', 'Challenge 6: Haystack', 'Challenge 7: Hangman'];
                                  const isCompleted = uc.completedChallenges?.[challengeIdx];
                                  const isStarted = uc.challengeStartedAt?.[challengeIdx] || (challengeIdx === 0 && uc.startedAt);
                                  
                                  return (
                                    <li key={challengeIdx}>
                                      <button
                                        className={`text-xs ${!isStarted ? 'text-gray-400' : isCompleted ? 'text-green-600' : 'text-blue-600'}`}
                                        disabled={!isStarted}
                                        onClick={async () => {
                                          // replace window.confirm(...) with modal
                                          openConfirm({
                                            title: `Reset ${challengeNames[challengeIdx]}`,
                                            message: `Reset ${challengeNames[challengeIdx]} for ${uc.userId.firstName} ${uc.userId.lastName}? This will clear their progress for this specific challenge.`,
                                            confirmText: 'Reset',
                                            onConfirm: async () => {
                                              try {
                                                await resetSpecificChallenge(classroomId, uc.userId._id, challengeIdx);
                                                toast.success(`Reset ${challengeNames[challengeIdx]} for ${uc.userId.firstName} ${uc.userId.lastName}`);
                                                await fetchChallengeData();
                                              } catch (error) {
                                                toast.error(`Failed to reset challenge: ${error.message}`);
                                              }
                                            }
                                          });
                                        }}
                                      >
                                        {isCompleted ? '✅' : isStarted ? '🔄' : '⏹️'} {challengeNames[challengeIdx]}
                                      </button>
                                    </li>
                                  );
                                })}
                                <div className="divider my-1"></div>
                                <li>
                                  <button
                                    className="text-xs text-red-600 font-semibold"
                                    onClick={async () => {
                                      openConfirm({
                                        title: 'Reset ALL Challenges',
                                        message: `Are you sure you want to reset ALL challenges for ${uc.userId.firstName} ${uc.userId.lastName}? This will clear all their progress and they will start from Challenge  1.`,
                                        confirmText: 'Reset ALL',
                                        onConfirm: async () => {
                                          try {
                                            await resetStudentChallenge(classroomId, uc.userId._id);
                                            toast.success(`Reset all challenges for ${uc.userId.firstName} ${uc.userId.lastName}`);
                                            await fetchChallengeData();
                                          } catch (error) {
                                            toast.error(`Failed to reset all challenges: ${error.message}`);
                                          }
                                        }
                                      });
                                    }}
                                  >
                                    🗑️ Reset ALL Challenges
                                  </button>
                                </li>
                              </ul>
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
                        const [datePart, timePart] = localDueDate.split('T');
                        const [year, month, day] = datePart.split('-').map(Number);
                        const [hours, minutes] = timePart.split(':').map(Number);
                        
                        const localDate = new Date(year, month - 1, day, hours, minutes);
                        const utcISOString = localDate.toISOString();
                        
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

      <ChallengeUpdateModal
        showUpdateModal={showUpdateModal}
        setShowUpdateModal={setShowUpdateModal}
        challengeData={challengeData}
        fetchChallengeData={fetchChallengeData}
        classroomId={classroomId}
        setShowHintModal={setShowHintModal}
        setEditingHints={setEditingHints}
      />

      {showHintModal && editingHints && challengeData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="card bg-base-100 w-full max-w-2xl mx-4 shadow-xl">
            <div className="card-body">
              <h2 className="text-xl font-bold mb-4">
                Configure Hints - {editingHints.challengeName}
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Add custom hints that will help students when they're stuck. Hints will be revealed in order.
              </p>
              
              <div className="space-y-3">
                {Array.from({ length: challengeData.settings?.maxHintsPerChallenge || 2 }, (_, hintIndex) => (
                  <div key={hintIndex}>
                    <label className="label">
                      <span className="label-text font-medium">Hint {hintIndex + 1}</span>
                    </label>
                    <textarea
                      className="textarea textarea-bordered w-full"
                      placeholder={`Enter hint ${hintIndex + 1}...`}
                      value={challengeData.settings?.challengeHints?.[editingHints.challengeIndex]?.[hintIndex] || ''}
                      onChange={(e) => {
                        setChallengeData(prev => {
                          const newData = { ...prev };
                          if (!newData.settings) newData.settings = {};
                          if (!newData.settings.challengeHints) newData.settings.challengeHints = [[], [], [], [], [], [], []];
                          if (!newData.settings.challengeHints[editingHints.challengeIndex]) {
                            newData.settings.challengeHints[editingHints.challengeIndex] = [];
                          }
                          newData.settings.challengeHints[editingHints.challengeIndex][hintIndex] = e.target.value;
                          return newData;
                        });
                      }}
                      rows={2}
                    />
                  </div>
                ))}
              </div>

              <div className="alert alert-info mt-4">
                <span className="text-sm">
                  💡 <strong>Tip:</strong> Make hints progressively more specific. Start general, then get more detailed.
                </span>
              </div>

              <div className="card-actions justify-end gap-2 mt-6">
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowHintModal(false);
                    setEditingHints(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                   
                    setShowHintModal(false);
                    setEditingHints(null);
                  }}
                >
                  Save Hints
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showConfirm && (
        <ConfirmModal
          isOpen={showConfirm}
          onClose={() => setShowConfirm(false)}
          title={confirmOptions.title}
          message={confirmOptions.message}
          confirmText={confirmOptions.confirmText}
          onConfirm={handleConfirm}
        />
      )}
      </div>
      <Footer />
    </div>
  );
};

export default TeacherView;