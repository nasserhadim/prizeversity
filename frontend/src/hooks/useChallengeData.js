import { useState, useEffect } from 'react';
import { getChallengeData } from '../API/apiChallenge';
import { API_BASE } from '../config/api';
import toast from 'react-hot-toast';
import { getRewardDataForChallenge } from '../utils/challengeUtils';
import { CHALLENGE_NAMES } from '../constants/challengeConstants';

export const useChallengeData = (classroomId) => {
  const [challengeData, setChallengeData] = useState(null);
  const [userChallenge, setUserChallenge] = useState(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [loading, setLoading] = useState(true);
  const [classroom, setClassroom] = useState(null);
  const [previousProgress, setPreviousProgress] = useState(null);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [rewardData, setRewardData] = useState(null);

  const fetchChallengeData = async () => {
    try {
      setLoading(true);
      const response = await getChallengeData(classroomId);
      setChallengeData(response.challenge || null);
      
      const newProgress = response.userChallenge?.progress || 0;
      if (previousProgress !== null && newProgress > previousProgress && newProgress > 0) {
        const completedChallengeIndex = newProgress - 1;
        const rewardInfo = getRewardDataForChallenge(completedChallengeIndex, response.challenge, response.userChallenge, CHALLENGE_NAMES);
        if (rewardInfo) {
          setRewardData(rewardInfo);
          setShowRewardModal(true);
          toast.success(`${rewardInfo.challengeName} completed! 🎉`);
        }
      }
      
      setUserChallenge(response.userChallenge);
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
        
        if (targetProgress > previousProgressValue && targetProgress > 0) {
          const completedChallengeIndex = targetProgress - 1;
          const rewardInfo = getRewardDataForChallenge(completedChallengeIndex, challengeData, userChallenge, CHALLENGE_NAMES);
          if (rewardInfo) {
            setRewardData(rewardInfo);
            setShowRewardModal(true);
          }
        }
        
        await fetchChallengeData();
      } else {
        toast.error('Failed to set progress');
      }
    } catch (error) {
      console.error('Error setting debug progress:', error);
      toast.error('Failed to set progress');
    }
  };

  useEffect(() => {
    fetchChallengeData();
  }, [classroomId]);

  useEffect(() => {
    const checkForCompletedChallenge = () => {
      const completedData = localStorage.getItem('challengeCompleted');
      if (completedData) {
        try {
          const { challengeIndex, challengeName, timestamp } = JSON.parse(completedData);
          
          const timeDiff = Date.now() - timestamp;
          if (timeDiff < 30000 && challengeData?.settings) {
            const rewardInfo = getRewardDataForChallenge(challengeIndex, challengeData, userChallenge, CHALLENGE_NAMES);
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

  return {
    challengeData,
    setChallengeData,
    userChallenge,
    setUserChallenge,
    isTeacher,
    loading,
    classroom,
    showRewardModal,
    setShowRewardModal,
    rewardData,
    setRewardData,
    fetchChallengeData,
    setDebugProgress
  };
};
