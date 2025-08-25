const express = require('express');
const router = express.Router();
const Challenge = require('../../models/Challenge');
const User = require('../../models/User');
const { ensureAuthenticated } = require('../../middleware/auth');
const { isChallengeExpired, generateChallenge2Password, calculateChallengeRewards } = require('./utils');
const { CHALLENGE_NAMES } = require('./constants');

router.post('/verify-password', ensureAuthenticated, async (req, res) => {
  try {
    const { uniqueId, password } = req.body;
    const userId = req.user._id;

    if (!uniqueId || !password) {
      return res.status(400).json({ message: 'Unique ID and password are required' });
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

    if (userChallenge.hashedPassword !== password.toUpperCase()) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    if (!userChallenge.completedChallenges) {
      userChallenge.completedChallenges = [false, false, false, false, false, false, false];
    }

    let rewardsEarned = {
      bits: 0,
      multiplier: 0,
      luck: 1.0,
      discount: 0,
      shield: false,
    };

    if (!userChallenge.completedChallenges[0]) {
      userChallenge.completedChallenges[0] = true;
      userChallenge.progress = userChallenge.completedChallenges.filter(Boolean).length;
      userChallenge.completedAt = Date.now();
      
      const user = await User.findById(userId);
      if (user) {
        rewardsEarned = calculateChallengeRewards(user, challenge, 0, userChallenge);
        await user.save();
      }
      
      await challenge.save();
    }

    const { CHALLENGE_NAMES } = require('./constants');
    res.json({ 
      success: true,
      message: `Correct! ${CHALLENGE_NAMES[0]} completed!`,
      challengeName: CHALLENGE_NAMES[0],
      rewards: rewardsEarned,
      progress: userChallenge.progress,
      allCompleted: userChallenge.progress >= 7,
      nextChallenge: userChallenge.progress < 6 ? CHALLENGE_NAMES[userChallenge.progress] : null
    });

  } catch (error) {
    console.error('Error verifying password:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/verify-challenge2-external', ensureAuthenticated, async (req, res) => {
  try {
    const { uniqueId, password } = req.body;
    const userId = req.user._id;

    if (!uniqueId || !password) {
      return res.status(400).json({ message: 'Unique ID and password are required' });
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

    if (isChallengeExpired(challenge)) {
      return res.status(403).json({ 
        success: false, 
        message: 'This challenge series has expired and is no longer accepting submissions' 
      });
    }

    if (!userChallenge.challenge2Password) {
      userChallenge.challenge2Password = generateChallenge2Password(userChallenge.uniqueId);
    }

    if (userChallenge.challenge2Password !== password.toUpperCase()) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    if (!userChallenge.completedChallenges) {
      userChallenge.completedChallenges = [false, false, false, false, false, false, false];
    }

    let rewardsEarned = {
      bits: 0,
      multiplier: 0,
      luck: 1.0,
      discount: 0,
      shield: false,
      attackBonus: 0
    };

    if (!userChallenge.completedChallenges[1]) {
      userChallenge.completedChallenges[1] = true;
      userChallenge.progress = userChallenge.completedChallenges.filter(Boolean).length;
      
      const user = await User.findById(userId);
      let bitsAwarded = 0;

      if (user) {
        const rewards = calculateChallengeRewards(user, challenge, 1, userChallenge);
        Object.assign(rewardsEarned, rewards);
        bitsAwarded = rewards.bits;
        await user.save();
      }
      
      await challenge.save();
    }

    res.json({ 
      success: true,
      message: `Correct! ${CHALLENGE_NAMES[1]} completed!`,
      challengeName: CHALLENGE_NAMES[1],
      rewards: rewardsEarned,
      progress: userChallenge.progress,
      allCompleted: userChallenge.progress >= 7,
      nextChallenge: userChallenge.progress < 6 ? CHALLENGE_NAMES[userChallenge.progress] : null
    });

  } catch (error) {
    console.error('Error verifying Challenge 2:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/challenge3/:uniqueId/verify', ensureAuthenticated, async (req, res) => {
  try {
    const { uniqueId } = req.params;
    const { password } = req.body;
    const userId = req.user._id;
    const crypto = require('crypto');

    if (!uniqueId || !password) {
      return res.status(400).json({ message: 'Unique ID and password are required' });
    }

    const challenge = await Challenge.findOne({
      'userChallenges.uniqueId': uniqueId,
      'userChallenges.userId': userId
    });

    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    const userChallenge = challenge.userChallenges.find(uc => uc.uniqueId === uniqueId);
    if (!userChallenge) {
      return res.status(404).json({ message: 'User challenge not found' });
    }

    if (isChallengeExpired(challenge)) {
      return res.status(403).json({ 
        success: false, 
        message: 'This challenge series has expired and is no longer accepting submissions' 
      });
    }

    const currentAttempts = userChallenge.challenge3Attempts || 0;
    const maxAttempts = userChallenge.challenge3MaxAttempts || 5;
    
    if (currentAttempts >= maxAttempts) {
      return res.status(429).json({ 
        success: false, 
        message: `Maximum attempts (${maxAttempts}) exceeded for this challenge` 
      });
    }

    const startTime = userChallenge.challenge3StartTime;
    const currentTime = new Date();
    const timeElapsed = startTime ? (currentTime - startTime) / (1000 * 60) : 0; // minutes
    
    if (timeElapsed > 30) {
      return res.status(408).json({ 
        success: false, 
        message: 'Time limit exceeded (30 minutes)' 
      });
    }
    
    userChallenge.challenge3Attempts = currentAttempts + 1;

    const { generateCppDebuggingChallenge } = require('./generators');
    
    const user = await User.findById(userId);
    const studentHash = crypto.createHash('md5').update(userId.toString() + uniqueId).digest('hex');
    const hashNum = parseInt(studentHash.substring(0, 8), 16);
    
    const studentData = {
      hashedId: studentHash,
      firstName: user.firstName,
      lastName: user.lastName,
      agentId: `AGENT-${studentHash.substring(0, 6).toUpperCase()}`,
      badgeNumber: `${((hashNum % 9000) + 1000)}`,
      clearanceLevel: ['CLASSIFIED', 'SECRET', 'TOP SECRET'][hashNum % 3],
      department: ['CYBER CRIMES', 'DIGITAL FORENSICS', 'CRYPTO ANALYSIS'][hashNum % 3]
    };
    
    const cppChallenge = generateCppDebuggingChallenge(studentData, uniqueId);
    const expectedAnswer = cppChallenge.actualOutput;
    const submittedAnswer = parseInt(password);
    
    const isCorrect = submittedAnswer === expectedAnswer;

    if (!isCorrect) {
      await challenge.save();
      return res.status(401).json({ 
        success: false, 
        message: 'Incorrect solution. Check your calculations.',
        attemptsRemaining: maxAttempts - userChallenge.challenge3Attempts
      });
    }

    if (!userChallenge.completedChallenges) {
      userChallenge.completedChallenges = [false, false, false, false, false, false, false];
    }

    let rewardsEarned = {
      bits: 0,
      multiplier: 0,
      luck: 1.0,
      discount: 0,
      shield: false,
    };

    if (!userChallenge.completedChallenges[2]) {
      userChallenge.completedChallenges[2] = true;
      userChallenge.progress = userChallenge.completedChallenges.filter(Boolean).length;
      
      rewardsEarned = calculateChallengeRewards(user, challenge, 2, userChallenge);
      await user.save();
      await challenge.save();
    }

    res.json({
      success: true,
      message: `Correct! ${CHALLENGE_NAMES[2]} completed!`,
      challengeName: CHALLENGE_NAMES[2],
      rewards: rewardsEarned,
      progress: userChallenge.progress,
      allCompleted: userChallenge.progress >= 7,
      nextChallenge: userChallenge.progress < 6 ? CHALLENGE_NAMES[userChallenge.progress] : null
    });

  } catch (error) {
    console.error('Error verifying Challenge 3 password:', error);
    res.status(500).json({ message: 'Verification failed' });
  }
});

router.post('/verify-challenge5-external', ensureAuthenticated, async (req, res) => {
  try {
    const { uniqueId, verified } = req.body;
    const userId = req.user._id;

    if (!uniqueId || !verified) {
      return res.status(400).json({ message: 'Invalid verification data' });
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

    if (userChallenge.progress < 4) {
      return res.status(400).json({ message: 'Must complete Challenge 4 first' });
    }

    if (userChallenge.progress >= 7) {
      return res.status(400).json({ message: 'Challenge already completed' });
    }

    userChallenge.progress = 5;
    userChallenge.completedAt = Date.now();
    
    const user = await User.findById(userId);
    let rewardsEarned = {
      bits: 0,
      multiplier: 0,
      luck: 1.0,
      discount: 0,
      shield: false,
    };
    
    if (user) {
      rewardsEarned = calculateChallengeRewards(user, challenge, 4, userChallenge);
      await user.save();
    }
    
    await challenge.save();

    const Notification = require('../../models/Notification');
    const { populateNotification } = require('../../utils/notifications');
    
    const notification = await Notification.create({
      user: user._id,
      actionBy: challenge.createdBy,
      type: 'challenge_completed',
      message: `You completed Challenge 5: "Secrets in the Cloud" and earned ${rewardsEarned.bits} bits!`,
      read: false,
      createdAt: new Date(),
    });

    const populatedNotification = await populateNotification(notification._id);
    if (populatedNotification) {
      req.app.get('io').to(`user-${user._id}`).emit('notification', populatedNotification);
    }

    res.json({ 
      success: true,
      message: `Correct! ${CHALLENGE_NAMES[4]} completed!`,
      challengeName: CHALLENGE_NAMES[4],
      rewards: rewardsEarned,
      progress: userChallenge.progress,
      allCompleted: userChallenge.progress >= 7,
      nextChallenge: userChallenge.progress < 6 ? CHALLENGE_NAMES[userChallenge.progress] : null
    });

  } catch (error) {
    console.error('Error verifying Challenge 5:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
