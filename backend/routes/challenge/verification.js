const express = require('express');
const router = express.Router();
const Challenge = require('../../models/Challenge');
const User = require('../../models/User');
const { ensureAuthenticated } = require('../../middleware/auth');
const { isChallengeExpired, generateChallenge2Password, calculateChallengeRewards } = require('./utils');

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
      userChallenge.completedChallenges = [false, false, false, false, false, false];
    }

    if (!userChallenge.completedChallenges[0]) {
      userChallenge.completedChallenges[0] = true;
      userChallenge.progress = userChallenge.completedChallenges.filter(Boolean).length;
      userChallenge.completedAt = Date.now();
      
      const user = await User.findById(userId);
      let bitsAwarded = 0;
      if (user) {
        const rewardsEarned = calculateChallengeRewards(user, challenge, 0, userChallenge);
        bitsAwarded = rewardsEarned.bits;
        await user.save();
      }
      
      await challenge.save();
    }

    res.json({ 
      message: 'Password verified successfully',
      progress: userChallenge.progress 
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
      userChallenge.completedChallenges = [false, false, false, false, false, false];
    }

    if (!userChallenge.completedChallenges[1]) {
      userChallenge.completedChallenges[1] = true;
      userChallenge.progress = userChallenge.completedChallenges.filter(Boolean).length;
      
      const user = await User.findById(userId);
      let bitsAwarded = 0;
      
      const rewardsEarned = {
        bits: 0,
        multiplier: 0,
        luck: 1.0,
        discount: 0,
        shield: false,
        attackBonus: 0
      };

      if (user) {
        const rewards = calculateChallengeRewards(user, challenge, 1, userChallenge);
        Object.assign(rewardsEarned, rewards);
        bitsAwarded = rewards.bits;
        await user.save();
      }
      
      await challenge.save();
    }

    res.json({ 
      message: 'Challenge 2 completed successfully!',
      progress: userChallenge.progress
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

    const validators = require('../../validators/challenges');
    const metadata = { salt: 'cpp_debug_salt_2024', algorithmParams: {} };
    
    const user = await User.findById(userId);
    const studentData = {
      firstName: user.firstName,
      lastName: user.lastName,
      agentId: `AGENT-${crypto.createHash('md5').update(userId.toString() + uniqueId).digest('hex').substring(0, 6).toUpperCase()}`,
      department: ['CYBER CRIMES', 'DIGITAL FORENSICS', 'CRYPTO ANALYSIS'][parseInt(crypto.createHash('md5').update(userId.toString() + uniqueId).digest('hex').substring(0, 8), 16) % 3]
    };
    
    const isCorrect = validators['cpp-debugging'](password, metadata, uniqueId, studentData);

    if (!isCorrect) {
      await challenge.save();
      return res.status(401).json({ 
        success: false, 
        message: 'Incorrect solution. Check your calculations.',
        attemptsRemaining: maxAttempts - userChallenge.challenge3Attempts
      });
    }

    if (!userChallenge.completedChallenges) {
      userChallenge.completedChallenges = [false, false, false, false, false, false];
    }

    if (!userChallenge.completedChallenges[2]) {
      userChallenge.completedChallenges[2] = true;
      userChallenge.progress = userChallenge.completedChallenges.filter(Boolean).length;
      
      const rewards = calculateChallengeRewards(user, challenge, 2, userChallenge);
      await user.save();
      await challenge.save();
    }

    res.json({
      success: true,
      message: 'Investigation solved! Evidence recovered successfully!',
      progress: userChallenge.progress
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

    if (userChallenge.progress >= 6) {
      return res.status(400).json({ message: 'Challenge already completed' });
    }

    userChallenge.progress = 5;
    userChallenge.completedAt = Date.now();
    
    const user = await User.findById(userId);
    let bitsAwarded = 0;
    if (user) {
      const rewards = calculateChallengeRewards(user, challenge, 4, userChallenge);
      bitsAwarded = rewards.bits;
      await user.save();
    }
    
    await challenge.save();

    const Notification = require('../../models/Notification');
    const { populateNotification } = require('../../utils/notifications');
    
    const notification = await Notification.create({
      user: user._id,
      actionBy: challenge.createdBy,
      type: 'challenge_completed',
      message: `You completed Challenge 5: "Secrets in the Cloud" and earned ${bitsAwarded} bits!`,
      read: false,
      createdAt: new Date(),
    });

    const populatedNotification = await populateNotification(notification._id);
    if (populatedNotification) {
      req.app.get('io').to(`user-${user._id}`).emit('notification', populatedNotification);
    }

    res.json({ 
      message: 'WayneAWS verification completed successfully!',
      progress: userChallenge.progress,
      bitsAwarded 
    });

  } catch (error) {
    console.error('Error verifying Challenge 5:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
