const express = require('express');
const router = express.Router();
const Challenge = require('../../models/Challenge');
const User = require('../../models/User');
const { ensureAuthenticated } = require('../../middleware/auth');
const validators = require('../../validators/challenges');
const { isChallengeExpired, getChallengeIndex, calculateChallengeRewards, awardChallengeBits, isChallengeVisibleToUser } = require('./utils');
const { CHALLENGE_NAMES } = require('./constants');
const { generateChallengeData } = require('../../utils/tokenGenerator');
const Classroom = require('../../models/Classroom');
const { awardXP } = require('../../utils/awardXP');

// helper reused here
async function awardChallengeXP({ userId, classroomId, rewards }) {
  try {
    const cls = await Classroom.findById(classroomId).select('xpSettings');
    if (!cls?.xpSettings?.enabled) return;

    const bits = Number(rewards?.bits || 0);
    if (bits > 0 && (cls.xpSettings.bitsEarned || 0) > 0) {
      await awardXP(userId, classroomId, bits * (cls.xpSettings.bitsEarned || 0), 'earning bits (challenge reward)', cls.xpSettings);
    }

    const statCount =
      (rewards?.multiplier > 0 ? 1 : 0) +
      ((rewards?.luck || 1) > 1.0 ? 1 : 0) +
      ((rewards?.discount || 0) > 0 ? 1 : 0) +
      (rewards?.shield ? 1 : 0);

    if (statCount > 0 && (cls.xpSettings.statIncrease || 0) > 0) {
      await awardXP(userId, classroomId, statCount * cls.xpSettings.statIncrease, 'stat increase (challenge reward)', cls.xpSettings);
    }

    if ((cls.xpSettings.challengeCompletion || 0) > 0) {
      await awardXP(userId, classroomId, cls.xpSettings.challengeCompletion, 'challenge completion', cls.xpSettings);
    }
  } catch (e) {
    console.warn('[challenge6] awardChallengeXP failed:', e);
  }
}

router.post('/:classroomId/submit', ensureAuthenticated, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const { answer, challengeId } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role; // Get the user's role from the request

    if (!answer || !answer.trim()) {
      return res.status(400).json({ success: false, message: 'Answer is required' });
    }

    const challenge = await Challenge.findOne({ classroomId, isActive: true });
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'No active challenge found' });
    }

    if (!challenge.isVisible) {
      return res.status(403).json({ success: false, message: 'Challenge is temporarily unavailable' });
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
    if (!isChallengeVisibleToUser(challenge, userRole, challengeIndex)) {
      return res.status(403).json({ message: 'This challenge is currently hidden' });
    }

    if (!userChallenge.completedChallenges) {
      userChallenge.completedChallenges = [false, false, false, false, false, false, false];
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
      
      if (!userChallenge.challengeCompletedAt) {
        userChallenge.challengeCompletedAt = [];
      }
      while (userChallenge.challengeCompletedAt.length <= challengeIndex) {
        userChallenge.challengeCompletedAt.push(null);
      }
      userChallenge.challengeCompletedAt[challengeIndex] = new Date();
      
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
        // NEW: award XP for challenge 6 rewards + completion
        await awardChallengeXP({
          userId: user._id,
          classroomId: challenge.classroomId,
          rewards: rewardsEarned
        });
      }

      if (userChallenge.progress === 7) {
        userChallenge.completedAt = new Date();
        const Notification = require('../../models/Notification');
        const { populateNotification } = require('../../utils/notifications');
        
        const notification = await Notification.create({
          user: user._id,
          actionBy: challenge.createdBy,
          type: 'challenge_series_completed',
          message: `Congratulations! You completed all 7 challenges and earned the Cyber Champion badge!`,
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
        allCompleted: userChallenge.progress >= 7,
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
          userChallenge.completedChallenges = [false, false, false, false, false, false, false];
        }
        userChallenge.completedChallenges[3] = true;
        userChallenge.progress = userChallenge.completedChallenges.filter(Boolean).length;
        
        if (!userChallenge.challengeCompletedAt) {
          userChallenge.challengeCompletedAt = [];
        }
        while (userChallenge.challengeCompletedAt.length <= 3) {
          userChallenge.challengeCompletedAt.push(null);
        }
        userChallenge.challengeCompletedAt[3] = new Date();
        
        const user = await User.findById(userId);
        const rewardsEarned = calculateChallengeRewards(user, challenge, 3, userChallenge);
        await user.save();
        // NEW: award XP for Challenge 4
        await awardChallengeXP({
          userId: user._id,
          classroomId: challenge.classroomId,
          rewards: rewardsEarned
        });
        await challenge.save();
        
        res.json({
          success: true,
          message: 'Digital forensics investigation complete!',
          challengeName: CHALLENGE_NAMES[3],
          rewards: rewardsEarned,
          progress: userChallenge.progress,
          allCompleted: userChallenge.progress >= 7,
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
        message: 'Incorrect answer. Try again!'
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

    if (!userChallenge.completedChallenges) {
      userChallenge.completedChallenges = [false, false, false, false, false, false, false];
    }
    userChallenge.completedChallenges[challengeLevel - 1] = true;
    userChallenge.progress = userChallenge.completedChallenges.filter(Boolean).length;
    
    if (!userChallenge.challengeCompletedAt) {
      userChallenge.challengeCompletedAt = [];
    }
    while (userChallenge.challengeCompletedAt.length <= challengeLevel - 1) {
      userChallenge.challengeCompletedAt.push(null);
    }
    userChallenge.challengeCompletedAt[challengeLevel - 1] = new Date();
    
    if (userChallenge.progress >= 7) {
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

    if (!challenge.isVisible) {
      return res.status(403).json({ success: false, message: 'Challenge is temporarily unavailable' });
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

    if (challengeIndex < 0 || challengeIndex > 6) {
      return res.status(400).json({ success: false, message: 'Invalid challenge index' });
    }

    if (!userChallenge.startedAt) {
      userChallenge.startedAt = new Date();
    }
    
    if (!userChallenge.challengeStartedAt) {
      userChallenge.challengeStartedAt = [];
    }
    
    if (!userChallenge.challengeStartedAt[challengeIndex]) {
      userChallenge.challengeStartedAt[challengeIndex] = new Date();
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

    if (!challenge.isVisible) {
      return res.status(403).json({ success: false, message: 'Challenge is temporarily unavailable' });
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

    if (!userChallenge.challenge6Attempts) {
      userChallenge.challenge6Attempts = 0;
    }

    const isCorrect = userTokens.some(token => validTokens.includes(token));
    
    if (isCorrect) {
      // Reset attempt counter on correct answer
      userChallenge.challenge6Attempts = 0;
      
      const challengeIndex = 5;
      const user = await User.findById(userId);
      let rewards = {
        bits: 0,
        multiplier: 0,
        luck: 1.0,
        discount: 0,
        shield: false,
      };

      if (user) {
        rewards = calculateChallengeRewards(user, challenge, challengeIndex, userChallenge);
        await user.save();
        // NEW: award XP for challenge 6 rewards + completion
        await awardChallengeXP({
          userId: user._id,
          classroomId: challenge.classroomId,
          rewards
        });
      }
      
      if (!userChallenge.completedChallenges) {
        userChallenge.completedChallenges = [false, false, false, false, false, false, false];
      }
      
      userChallenge.completedChallenges[5] = true;
      userChallenge.progress = userChallenge.completedChallenges.filter(Boolean).length;
      
      if (!userChallenge.challengeCompletedAt) {
        userChallenge.challengeCompletedAt = [];
      }
      while (userChallenge.challengeCompletedAt.length <= 5) {
        userChallenge.challengeCompletedAt.push(null);
      }
      userChallenge.challengeCompletedAt[5] = new Date();
      
      if (userChallenge.progress >= 7) {
        userChallenge.completedAt = new Date();
      }
      
      challenge.markModified('userChallenges');
      await challenge.save();
      
      return res.json({
        success: true,
        message: 'Challenge completed successfully!',
        challengeName: CHALLENGE_NAMES[5],
        rewards: rewards,
        progress: userChallenge.progress,
        allCompleted: userChallenge.progress >= 7,
        nextChallenge: userChallenge.progress < 6 ? CHALLENGE_NAMES[userChallenge.progress] : null
      });
    }
    
    userChallenge.challenge6Attempts++;
    
    if (userChallenge.challenge6Attempts >= 3) {
      challenge.markModified('userChallenges');
      await challenge.save();
      return res.json({
        success: false,
        message: 'Maximum attempts reached. Access denied.',
        maxAttemptsReached: true
      });
    }
    
    challenge.markModified('userChallenges');
    await challenge.save();
    
    return res.json({
      success: false,
      message: 'Incorrect answer. Try again.',
      attemptsRemaining: 3 - userChallenge.challenge6Attempts
    });

  } catch (error) {
    console.error('Error processing Challenge 6 submission:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/submit-challenge7', ensureAuthenticated, async (req, res) => {
  try {
    const { uniqueId, word, tokenIds } = req.body;
    const userId = req.user._id;

    if (!uniqueId || !word || !tokenIds) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const userTokens = Array.isArray(tokenIds) ? tokenIds : [parseInt(tokenIds, 10)];
    
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
    
    console.log('🔍 Found userChallenge for submission:', {
      uniqueId: userChallenge?.uniqueId,
      userId: userChallenge?.userId?.toString(),
      hasExistingProgress: !!userChallenge?.challenge7Progress,
      existingProgress: userChallenge?.challenge7Progress
    });

    if (!userChallenge) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (userChallenge.completedChallenges && userChallenge.completedChallenges[6]) {
      return res.json({
        success: true,
        message: 'Challenge already completed',
        rewards: userChallenge.challengeRewards?.[6] || {}
      });
    }

    const { generateHangmanData } = require('../../utils/quoteGenerator');
    const hangmanData = await generateHangmanData(uniqueId);
    const validTokens = hangmanData.wordTokens[word.toLowerCase()] || [];
    const wordLower = word.toLowerCase();

    if (!userChallenge.challenge7Progress) {
      userChallenge.challenge7Progress = {
        revealedWords: [],
        totalWords: 0
      };
    }
    
    if (!userChallenge.challenge7Attempts) {
      userChallenge.challenge7Attempts = 0;
    }

    if (userChallenge.challenge7Attempts >= 3) {
      return res.json({
        success: false,
        message: 'Maximum attempts reached. Challenge failed.',
        maxAttemptsReached: true
      });
    }

    const isCorrect = userTokens.some(token => validTokens.includes(token));
    
    if (isCorrect) {
      console.log('✅ Correct submission for Challenge 7:', { word, uniqueId, userId });
      
      const uniqueWords = [...new Set(hangmanData.words.map(w => w.toLowerCase()))];
      
      if (!userChallenge.challenge7Progress) {
        console.log('🆕 Creating new Challenge 7 progress object');
        userChallenge.challenge7Progress = {
          revealedWords: [],
          totalWords: uniqueWords.length
        };
      }
      
      if (!userChallenge.challenge7Progress.revealedWords) {
        userChallenge.challenge7Progress.revealedWords = [];
      }
      
      userChallenge.challenge7Progress.totalWords = uniqueWords.length;
      
      const wordLower = word.toLowerCase();
      if (!userChallenge.challenge7Progress.revealedWords.includes(wordLower)) {
        console.log('📝 Adding new word to progress:', wordLower);
        userChallenge.challenge7Progress.revealedWords.push(wordLower);
      } else {
        console.log('⚠️ Word already revealed:', wordLower);
      }
      
      console.log('📊 Current progress after update:', {
        revealedWords: userChallenge.challenge7Progress.revealedWords,
        totalWords: userChallenge.challenge7Progress.totalWords,
        uniqueWordsTotal: uniqueWords.length
      });
      
      const revealedCount = userChallenge.challenge7Progress.revealedWords.length;
      const totalCount = uniqueWords.length;
      const progressPercentage = (revealedCount / totalCount * 100).toFixed(1);
      const isCompletelyFinished = revealedCount >= totalCount;
      
      let rewards = null;
      if (isCompletelyFinished) {
        const challengeIndex = 6;
        const user = await User.findById(userId);
        
        if (user) {
          rewards = calculateChallengeRewards(user, challenge, challengeIndex, userChallenge);
          await user.save();
          // NEW: award XP for Challenge 7
          await awardChallengeXP({
            userId: user._id,
            classroomId: challenge.classroomId,
            rewards
          });
        }
        
        if (!userChallenge.completedChallenges) {
          userChallenge.completedChallenges = [false, false, false, false, false, false, false];
        }
        if (!userChallenge.challengeRewards) {
          userChallenge.challengeRewards = {};
        }
        
        userChallenge.completedChallenges[6] = true;
        userChallenge.challengeRewards[6] = rewards;
        userChallenge.progress = userChallenge.completedChallenges.filter(Boolean).length;
        
        if (!userChallenge.challengeCompletedAt) {
          userChallenge.challengeCompletedAt = [];
        }
        while (userChallenge.challengeCompletedAt.length <= 6) {
          userChallenge.challengeCompletedAt.push(null);
        }
        userChallenge.challengeCompletedAt[6] = new Date();
        
        if (userChallenge.progress >= 7) {
          userChallenge.completedAt = new Date();
        }
        
        console.log('💰 Challenge 7 rewards calculated:', rewards);
      }
      
      challenge.markModified('userChallenges');
      const challengeIndex = challenge.userChallenges.findIndex(
        uc => uc.uniqueId === uniqueId && uc.userId.toString() === userId.toString()
      );
      if (challengeIndex !== -1) {
        challenge.markModified(`userChallenges.${challengeIndex}.challenge7Progress`);
      }
      await challenge.save();
      console.log('💾 Challenge 7 progress saved to database');
      
      const verifyChallenge = await Challenge.findOne({
        'userChallenges.uniqueId': uniqueId,
        'userChallenges.userId': userId
      });
      const verifyUserChallenge = verifyChallenge?.userChallenges.find(
        uc => uc.uniqueId === uniqueId && uc.userId.toString() === userId.toString()
      );
      console.log('✅ Verified save - progress in DB:', verifyUserChallenge?.challenge7Progress);
      
      const socketData = {
        userId: userId.toString(),
        uniqueId: uniqueId,
        word: word,
        revealedWordsCount: revealedCount,
        totalWordsCount: totalCount,
        progressPercentage: progressPercentage,
        isCompletelyFinished: isCompletelyFinished,
        revealedWords: userChallenge.challenge7Progress.revealedWords
      };
      
      console.log('📡 Emitting Challenge 7 progress to classroom:', `classroom-${challenge.classroomId}`, socketData);
      req.app.get('io').to(`classroom-${challenge.classroomId}`).emit('challenge7_progress', socketData);
      
      return res.json({
        success: true,
        message: isCompletelyFinished 
          ? 'Challenge completed successfully!' 
          : `Word "${word}" revealed! Progress: ${progressPercentage}%`,
        rewards: rewards,
        correctWord: word,
        isCompletelyFinished: isCompletelyFinished,
        progressPercentage: progressPercentage,
        revealedWordsCount: userChallenge.challenge7Progress.revealedWords.length,
        totalWordsCount: userChallenge.challenge7Progress.totalWords,
        attemptsRemaining: 3 - userChallenge.challenge7Attempts
      });
    }
    
    userChallenge.challenge7Attempts++;
    
    challenge.markModified('userChallenges');
    await challenge.save();
    
    const uniqueWords = [...new Set(hangmanData.words.map(w => w.toLowerCase()))];
    const currentProgress = userChallenge.challenge7Progress || { revealedWords: [], totalWords: uniqueWords.length };
    
    return res.json({
      success: false,
      message: userChallenge.challenge7Attempts >= 3 
        ? `Incorrect value for "${word}". Maximum attempts reached.`
        : `Incorrect value for "${word}". Try again.`,
      revealedWordsCount: currentProgress.revealedWords.length,
      totalWordsCount: uniqueWords.length,
      progressPercentage: (currentProgress.revealedWords.length / uniqueWords.length * 100).toFixed(1),
      totalAttempts: userChallenge.challenge7Attempts,
      attemptsRemaining: 3 - userChallenge.challenge7Attempts
    });

  } catch (error) {
    console.error('Error processing Challenge 7 submission:', error);
    res.status(500).json({ message: 'Server error' });
  }
});



module.exports = router;