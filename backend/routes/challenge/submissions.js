const express = require('express');
const router = express.Router();
const Challenge = require('../../models/Challenge');
const User = require('../../models/User');
const { ensureAuthenticated } = require('../../middleware/auth');
const validators = require('../../validators/challenges');
const { isChallengeExpired, getChallengeIndex, calculateChallengeRewards, awardChallengeBits } = require('./utils');
const { CHALLENGE_NAMES } = require('./constants');
const { generateChallengeData } = require('../../utils/tokenGenerator');

router.post('/:classroomId/submit', ensureAuthenticated, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const { answer, challengeId } = req.body;
    const userId = req.user._id;

    if (!answer || !answer.trim()) {
      return res.status(400).json({ success: false, message: 'Answer is required' });
    }

    const challenge = await Challenge.findOne({ classroomId, isActive: true });
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'No active challenge found' });
    }

    if (isChallengeExpired(challenge)) {
      return res.status(403).json({ 
        success: false, 
        message: 'This challenge series has expired and is no longer accepting submissions' 
      });
    }

    const userChallenge = challenge.userChallenges.find(
      uc => uc.userId.toString() === userId.toString()
    );
    if (!userChallenge) {
      return res.status(404).json({ success: false, message: 'User not enrolled in challenge' });
    }

    const challengeIndex = getChallengeIndex(challengeId);

    if (!userChallenge.completedChallenges) {
      userChallenge.completedChallenges = [false, false, false, false, false, false];
    }

    if (userChallenge.completedChallenges[challengeIndex]) {
      return res.status(400).json({ success: false, message: 'Challenge already completed' });
    }

    const challengeValidation = challenge.settings.challengeValidation?.find(
      cv => cv.challengeIndex === challengeIndex
    );

    if (!challengeValidation) {
      return res.status(500).json({ success: false, message: 'Challenge validation not configured' });
    }

    const validator = validators[challengeValidation.logicType];
    if (!validator) {
      return res.status(500).json({ success: false, message: 'Unsupported challenge type' });
    }

    const isCorrect = await validator(answer, challengeValidation.metadata, userChallenge.uniqueId);

    if (isCorrect) {
      userChallenge.completedChallenges[challengeIndex] = true;
      userChallenge.progress = userChallenge.completedChallenges.filter(Boolean).length;
      
      const user = await User.findById(userId);
      let rewardsEarned = {
        bits: 0,
        multiplier: 0,
        luck: 1.0,
        discount: 0,
        shield: false,
      };

      if (user) {
        rewardsEarned = calculateChallengeRewards(user, challenge, challengeIndex, userChallenge);
        await user.save();
      }

      if (userChallenge.progress === 6) {
        userChallenge.completedAt = new Date();
        const Notification = require('../../models/Notification');
        const { populateNotification } = require('../../utils/notifications');
        
        const notification = await Notification.create({
          user: user._id,
          actionBy: challenge.createdBy,
          type: 'challenge_series_completed',
          message: `Congratulations! You completed all 6 challenges and earned the Cyber Champion badge!`,
          read: false,
          createdAt: new Date(),
        });

        const populatedNotification = await populateNotification(notification._id);
        if (populatedNotification) {
          req.app.get('io').to(`user-${user._id}`).emit('notification', populatedNotification);
        }
      }

      await challenge.save();

      res.json({
        success: true,
        message: `Correct! ${CHALLENGE_NAMES[challengeIndex]} completed!`,
        challengeName: CHALLENGE_NAMES[challengeIndex],
        rewards: rewardsEarned,
        progress: userChallenge.progress,
        allCompleted: userChallenge.progress >= 6,
        nextChallenge: userChallenge.progress < 6 ? CHALLENGE_NAMES[userChallenge.progress] : null
      });
    } else {
      const enableHints = (challenge.settings.challengeHintsEnabled || [])[challengeIndex];
      const penalty = challenge.settings.hintPenaltyPercent ?? 25;
      const usedHints = userChallenge.hintsUsed?.[challengeIndex] || 0;
      const canUnlock = enableHints && usedHints < (challenge.settings.maxHintsPerChallenge ?? 2);
      
      res.json({ 
        success: false, 
        message: 'Incorrect answer. Try again!',
        canUnlockHint: !!canUnlock,
        penaltyPercent: enableHints ? penalty : null
      });
    }

  } catch (error) {
    console.error('Error submitting challenge answer:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/challenge4/:uniqueId/submit', ensureAuthenticated, async (req, res) => {
  try {
    const { uniqueId } = req.params;
    const { answer } = req.body;
    const userId = req.user._id;

    const challenge = await Challenge.findOne({ 
      'userChallenges.uniqueId': uniqueId,
      'userChallenges.userId': userId 
    });

    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    if (isChallengeExpired(challenge)) {
      return res.status(403).json({ 
        success: false, 
        message: 'This challenge series has expired and is no longer accepting submissions' 
      });
    }

    const crypto = require('crypto');
    const studentHash = crypto.createHash('md5').update(userId.toString() + uniqueId).digest('hex');
    const expectedAnswer = `FORENSICS_${studentHash.substring(0, 8).toUpperCase()}`;

    if (answer.trim() === expectedAnswer) {
      const userChallenge = challenge.userChallenges.find(uc => uc.uniqueId === uniqueId);
      if (userChallenge && !userChallenge.completedChallenges?.[3]) {
        if (!userChallenge.completedChallenges) {
          userChallenge.completedChallenges = [false, false, false, false, false, false];
        }
        userChallenge.completedChallenges[3] = true;
        userChallenge.progress = userChallenge.completedChallenges.filter(Boolean).length;
        
        const user = await User.findById(userId);
        const rewardsEarned = calculateChallengeRewards(user, challenge, 3, userChallenge);
        await user.save();
        await challenge.save();
        
        res.json({
          success: true,
          message: 'Digital forensics investigation complete!',
          challengeName: CHALLENGE_NAMES[3],
          rewards: rewardsEarned,
          progress: userChallenge.progress,
          allCompleted: userChallenge.progress >= 6,
          nextChallenge: userChallenge.progress < 6 ? CHALLENGE_NAMES[userChallenge.progress] : null
        });
      } else {
        res.json({
          success: false,
          message: 'Challenge already completed or not found'
        });
      }
    } else {
      res.json({
        success: false,
        message: 'Incorrect answer. Make sure you\'re examining the metadata of YOUR specific image.'
      });
    }

  } catch (error) {
    console.error('Error submitting Challenge 4:', error);
    res.status(500).json({ message: 'Submission failed' });
  }
});

router.post('/complete-challenge/:level', ensureAuthenticated, async (req, res) => {
  try {
    const { level } = req.params;
    const { uniqueId, solution } = req.body;
    const userId = req.user._id;
    const challengeLevel = parseInt(level);

    if (!uniqueId || !solution || ![3, 4].includes(challengeLevel)) {
      return res.status(400).json({ message: 'Invalid challenge data' });
    }

    const challenge = await Challenge.findOne({
      'userChallenges.uniqueId': uniqueId
    });

    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    const userChallenge = challenge.userChallenges.find(
      uc => uc.uniqueId === uniqueId && uc.userId.toString() === userId.toString()
    );

    if (!userChallenge) {
      return res.status(403).json({ message: 'Access denied' });
    }

    let isCorrect = false;
    if (challengeLevel === 3) {
      isCorrect = solution.toUpperCase() === 'CODE_BREAKER_COMPLETE';
    } else if (challengeLevel === 4) {
      const crypto = require('crypto');
      const studentHash = crypto.createHash('md5').update(userId.toString() + uniqueId).digest('hex');
      const expectedAnswer = `FORENSICS_${studentHash.substring(0, 8).toUpperCase()}`;
      isCorrect = solution.trim() === expectedAnswer;
    }

    if (!isCorrect) {
      return res.status(401).json({ message: 'Incorrect solution' });
    }

    userChallenge.progress = challengeLevel;
    if (challengeLevel === 4) {
      userChallenge.completedAt = new Date();
    }
    
    const bitsAwarded = await awardChallengeBits(userId, challengeLevel, challenge);
    await challenge.save();

    res.json({ 
      message: `Challenge ${challengeLevel} completed successfully!`,
      progress: userChallenge.progress,
      bitsAwarded 
    });

  } catch (error) {
    console.error('Error completing challenge:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:classroomId/start', ensureAuthenticated, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const { challengeIndex } = req.body;
    const userId = req.user._id;

    const challenge = await Challenge.findOne({ classroomId, isActive: true });
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'No active challenge found' });
    }

    const userChallenge = challenge.userChallenges.find(uc => uc.userId.toString() === userId.toString());
    if (!userChallenge) {
      return res.status(404).json({ success: false, message: 'User not enrolled in challenge' });
    }

    if (isChallengeExpired(challenge)) {
      return res.status(403).json({ 
        success: false, 
        message: 'This challenge series has expired and is no longer accepting submissions' 
      });
    }

    if (challengeIndex < 0 || challengeIndex > 5) {
      return res.status(400).json({ success: false, message: 'Invalid challenge index' });
    }

    if (!userChallenge.startedAt) {
      userChallenge.startedAt = new Date();
    }
    
    userChallenge.currentChallenge = challengeIndex;
    await challenge.save();

    res.json({ 
      success: true, 
      message: 'Challenge started successfully',
      startedAt: userChallenge.startedAt,
      currentChallenge: userChallenge.currentChallenge
    });

  } catch (error) {
    console.error('Error starting challenge:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/:classroomId/hints/unlock', ensureAuthenticated, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const { challengeId } = req.body;
    const userId = req.user._id;

    const challenge = await Challenge.findOne({ classroomId, isActive: true });
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'No active challenge found' });
    }

    const userChallenge = challenge.userChallenges.find(uc => uc.userId.toString() === userId.toString());
    if (!userChallenge) {
      return res.status(404).json({ success: false, message: 'User not enrolled in challenge' });
    }

    const challengeIndex = getChallengeIndex(challengeId);
    
    const hintsEnabled = (challenge.settings.challengeHintsEnabled || [])[challengeIndex];
    if (!hintsEnabled) {
      return res.status(400).json({ success: false, message: 'Hints not enabled for this challenge' });
    }

    if (!userChallenge.hintsUsed) {
      userChallenge.hintsUsed = {};
    }

    const maxHints = challenge.settings.maxHintsPerChallenge ?? 2;
    const currentHints = userChallenge.hintsUsed[challengeIndex] || 0;

    if (currentHints >= maxHints) {
      return res.status(400).json({ success: false, message: 'Maximum hints already used for this challenge' });
    }
    
    userChallenge.hintsUsed[challengeIndex] = currentHints + 1;
    
    if (!userChallenge.hintsUnlocked) {
      userChallenge.hintsUnlocked = {};
    }
    if (!userChallenge.hintsUnlocked[challengeIndex]) {
      userChallenge.hintsUnlocked[challengeIndex] = [];
    }

    const hints = challenge.settings.challengeHints || [];
    const challengeHints = hints[challengeIndex] || [];
    const unlockedHint = challengeHints[currentHints] || 'No hint available';
    
    userChallenge.hintsUnlocked[challengeIndex].push(unlockedHint);
    await challenge.save();

    res.json({
      success: true,
      hint: unlockedHint,
      hintsUsed: userChallenge.hintsUsed[challengeIndex],
      maxHints: maxHints,
      penaltyPercent: challenge.settings.hintPenaltyPercent ?? 25
    });

  } catch (error) {
    console.error('Error unlocking hint:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/submit-challenge6', ensureAuthenticated, async (req, res) => {
  try {
    const { uniqueId, answer } = req.body;
    const userId = req.user._id;

    if (!uniqueId) {
      return res.status(400).json({ message: 'Missing challenge ID' });
    }

    const userTokens = Array.isArray(answer) ? answer : [parseInt(answer, 10)];
    
    const challenge = await Challenge.findOne({
      'userChallenges.uniqueId': uniqueId,
      'userChallenges.userId': userId
    });

    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    const userChallenge = challenge.userChallenges.find(
      uc => uc.uniqueId === uniqueId && uc.userId.toString() === userId.toString()
    );

    if (!userChallenge) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (userChallenge.completedChallenges && userChallenge.completedChallenges[5]) {
      return res.json({
        success: true,
        message: 'Challenge already completed',
        rewards: userChallenge.challengeRewards?.[5] || {}
      });
    }

    const challengeData = await generateChallengeData(uniqueId);
    const validTokens = challengeData.validTokens;

    const isCorrect = userTokens.some(token => validTokens.includes(token));
    
    if (isCorrect) {
      const rewards = generateRewards(userId, uniqueId, challenge);
      
      if (!userChallenge.completedChallenges) {
        userChallenge.completedChallenges = {};
      }
      if (!userChallenge.challengeRewards) {
        userChallenge.challengeRewards = {};
      }
      
      userChallenge.completedChallenges[5] = true;
      userChallenge.challengeRewards[5] = rewards;
      userChallenge.lastCompletedAt = new Date();
      
      await challenge.save();
      
      // Update user stats
      await User.findByIdAndUpdate(userId, {
        $inc: { bits: rewards.bits, multiplier: rewards.multiplier }
      });
      
      return res.json({
        success: true,
        message: 'Challenge completed successfully!',
        rewards
      });
    }
    
    return res.json({
      success: false,
      message: 'Incorrect answer. Try again.'
    });

  } catch (error) {
    console.error('Error processing Challenge 6 submission:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

function generateRewards(userId, uniqueId, challenge) {
  const seed = userId.toString() + uniqueId;
  const crypto = require('crypto');
  const hash = crypto.createHash('md5').update(seed).digest('hex');
  const seedNum = parseInt(hash.substring(0, 8), 16);

  const settings = challenge.settings || {};
  const CHALLENGE_INDEX = 5; // Challenge 6 (index 5)
  
  const rewards = {
    bits: 0,
    multiplier: 0,
    luck: 1.0,
    discount: 0,
    shield: false
  };

  if (settings.rewardMode === 'individual') {
    rewards.bits = settings.challengeBits?.[CHALLENGE_INDEX] || 0;
  } else {
    const totalCompleted = challenge.userChallenges.find(uc => 
      uc.uniqueId === uniqueId
    )?.completedChallenges?.filter(Boolean).length || 0;
    
    if (totalCompleted === 5) { 
      rewards.bits = settings.totalRewardBits || 0;
    }
  }
  
  const variationPercent = 10;
  const variation = rewards.bits * (variationPercent / 100);
  rewards.bits = Math.round(rewards.bits + ((seedNum % variation) - (variation / 2)));
  rewards.bits = Math.max(0, rewards.bits); // Ensure non-negative

  if (settings.multiplierMode === 'individual') {
    rewards.multiplier = (settings.challengeMultipliers?.[CHALLENGE_INDEX] || 1.0) - 1.0;
  } else if (settings.multiplierMode === 'total' && settings.totalMultiplier) {
    const totalCompleted = challenge.userChallenges.find(uc => 
      uc.uniqueId === uniqueId
    )?.completedChallenges?.filter(Boolean).length || 0;
    
    if (totalCompleted === 5) {
      rewards.multiplier = settings.totalMultiplier - 1.0;
    }
  }
  
  if (settings.luckMode === 'individual') {
    rewards.luck = settings.challengeLuck?.[CHALLENGE_INDEX] || 1.0;
  } else if (settings.luckMode === 'total' && settings.totalLuck) {
    const totalCompleted = challenge.userChallenges.find(uc => 
      uc.uniqueId === uniqueId
    )?.completedChallenges?.filter(Boolean).length || 0;
    
    if (totalCompleted === 5) {
      rewards.luck = settings.totalLuck;
    }
  }
  
  if (settings.discountMode === 'individual') {
    rewards.discount = settings.challengeDiscounts?.[CHALLENGE_INDEX] || 0;
  } else if (settings.discountMode === 'total' && settings.totalDiscount) {
    const totalCompleted = challenge.userChallenges.find(uc => 
      uc.uniqueId === uniqueId
    )?.completedChallenges?.filter(Boolean).length || 0;
    
    if (totalCompleted === 5) {
      rewards.discount = settings.totalDiscount;
    }
  }
  
  if (settings.shieldMode === 'individual') {
    rewards.shield = settings.challengeShields?.[CHALLENGE_INDEX] || false;
  } else if (settings.shieldMode === 'total') {

    const totalCompleted = challenge.userChallenges.find(uc => 
      uc.uniqueId === uniqueId
    )?.completedChallenges?.filter(Boolean).length || 0;
    
    if (totalCompleted === 5) {
      rewards.shield = settings.totalShield || false;
    }
  }
  
  return rewards;
}

module.exports = router;