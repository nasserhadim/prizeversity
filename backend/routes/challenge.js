const express = require('express');
const router = express.Router();
const Challenge = require('../models/Challenge');
const Classroom = require('../models/Classroom');
const User = require('../models/User');
const { ensureAuthenticated, ensureTeacher } = require('../middleware/auth');
const axios = require('axios');
const validators = require('../validators/challenges');

// Add missing uploadLocks declaration
const uploadLocks = new Map();

function isChallengeExpired(challenge) {
  if (!challenge.settings.dueDateEnabled || !challenge.settings.dueDate) {
    return false;
  }
  return new Date() > new Date(challenge.settings.dueDate);
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || 'contact-akrm-for-token';
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'cinnamonstic';
const GITHUB_REPO = process.env.GITHUB_REPO || 'contact-akrm-for-repo';

async function createGitHubBranch(uniqueId, userId) {
  if (GITHUB_TOKEN === 'contact-akrm-for-token') {
    console.log('GitHub token not configured, skipping branch creation');
    return;
  }

  const headers = {
    'Authorization': `token ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Prizeversity-Challenge'
  };

  try {
    try {
      await axios.get(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/branches/${uniqueId}`,
        { headers }
      );
      console.log(`Branch ${uniqueId} already exists, skipping...`);
      return;
    } catch (error) {
      if (error.response?.status !== 404) {
        throw error;
      }
    }

    const mainBranch = await axios.get(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/branches/main`,
      { headers }
    );
    const mainSha = mainBranch.data.commit.sha;

    await axios.post(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs`,
      {
        ref: `refs/heads/${uniqueId}`,
        sha: mainSha
      },
      { headers }
    );

    const challenge2Password = generateChallenge2Password(uniqueId);

    const fileContent = `
nice job lol: ${challenge2Password}

`;

    const encodedContent = Buffer.from(fileContent).toString('base64');

    await axios.put(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/hello_world.txt`,
      {
        message: `Add challenge file for ${uniqueId}`,
        content: encodedContent,
        branch: uniqueId
      },
      { headers }
    );

    console.log(`✅ Created GitHub branch ${uniqueId} with Challenge 2 password`);

  } catch (error) {
    console.error('GitHub API Error:', error.response?.data || error.message);
    throw error;
  }
}

function generateChallenge2Password(uniqueId) {
  const crypto = require('crypto');
  const hash = crypto.createHash('md5').update(uniqueId + 'secret_salt_2024').digest('hex');
  const prefix = ['ACCESS', 'TOKEN', 'KEY', 'SECRET', 'CODE'][parseInt(hash.substring(0, 1), 16) % 5];
  const suffix = hash.substring(8, 14).toUpperCase();
  return `${prefix}_${suffix}`;
}

async function awardChallengeBits(userId, challengeLevel, challenge) {
  try {
    const user = await User.findById(userId);
    if (!user) return 0;

    const bitsToAward = challenge.getBitsForChallenge(challengeLevel);
    if (bitsToAward <= 0) return 0;

    user.balance = (user.balance || 0) + bitsToAward;
    await user.save();
    
    const userChallenge = challenge.userChallenges.find(
      uc => uc.userId.toString() === userId.toString()
    );
    if (userChallenge) {
      userChallenge.bitsAwarded += bitsToAward;
    }
    
    return bitsToAward;
  } catch (error) {
    console.error('Error awarding challenge bits:', error);
    return 0;
  }
}

router.get('/:classroomId', ensureAuthenticated, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const userId = req.user._id;

    const classroom = await Classroom.findById(classroomId);
    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    const isTeacher = classroom.teacher.toString() === userId.toString();
    const isStudent = classroom.students.includes(userId);

    if (!isTeacher && !isStudent) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const challenge = await Challenge.findOne({ classroomId })
      .populate('userChallenges.userId', 'firstName lastName email');

    if (!challenge) {
      return res.json({ 
        challenge: null, 
        userChallenge: null,
        isTeacher: isTeacher
      });
    }

    // For existing challenges, populate missing passwords
    let needsSave = false;
    for (const userChallenge of challenge.userChallenges) {
      // Generate Challenge 2 password if missing
      if (!userChallenge.challenge2Password && userChallenge.progress >= 1) {
        userChallenge.challenge2Password = generateChallenge2Password(userChallenge.uniqueId);
        needsSave = true;
      }
      
      // Generate Challenge 4 forensics password if missing
      if (!userChallenge.challenge4Password && userChallenge.progress >= 3) {
        const crypto = require('crypto');
        const studentHash = crypto.createHash('md5').update(userChallenge.userId._id.toString() + userChallenge.uniqueId).digest('hex');
        userChallenge.challenge4Password = `FORENSICS_${studentHash.substring(0, 8).toUpperCase()}`;
        needsSave = true;
      }
    }
    
    if (needsSave) {
      await challenge.save();
    }

    const userChallenge = challenge.userChallenges.find(
      uc => uc.userId._id.toString() === userId.toString()
    );

    if (isTeacher) {
      return res.json({ 
        challenge,
        userChallenge,
        isTeacher: true
      });
    }

    const currentChallengeIndex = userChallenge?.currentChallengeIndex || 0;
    const currentChallengeDefinition = (challenge.challengeDefinitions || [])[currentChallengeIndex];
    
    res.json({ 
      challenge: {
        _id: challenge._id,
        title: challenge.title,
        description: challenge.description,
        isActive: challenge.isActive,
        settings: challenge.settings
      },
      userChallenge,
      currentChallenge: currentChallengeDefinition ? {
        challengeId: currentChallengeDefinition.challengeId,
        title: currentChallengeDefinition.title,
        description: currentChallengeDefinition.description,
        order: currentChallengeDefinition.order,
        rewardBits: currentChallengeDefinition.rewardBits,
        hasExternalLink: ['github-osint'].includes(currentChallengeDefinition.logicType),
        linkedinUrl: currentChallengeDefinition.logicType === 'github-osint' ? currentChallengeDefinition.metadata?.linkedinUrl : null
      } : null,
      isTeacher: false
    });

  } catch (error) {
    console.error('Error fetching challenge:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:classroomId/configure', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const { title, settings } = req.body;
    const teacherId = req.user._id;

    const classroom = await Classroom.findById(classroomId);
    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    if (classroom.teacher.toString() !== teacherId.toString()) {
      return res.status(403).json({ message: 'Only the classroom teacher can configure challenges' });
    }

    let challenge = await Challenge.findOne({ classroomId });
    
    if (challenge && challenge.isActive) {
      return res.status(400).json({ message: 'Cannot modify active challenge. Deactivate first.' });
    }

    if (challenge) {
      challenge.title = title || challenge.title;
      const currentSettings = challenge.settings.toObject();
      const mergedSettings = { ...currentSettings, ...settings };
      
      if (settings.challengeBits) mergedSettings.challengeBits = settings.challengeBits;
      if (settings.challengeMultipliers) mergedSettings.challengeMultipliers = settings.challengeMultipliers;
      if (settings.challengeLuck) mergedSettings.challengeLuck = settings.challengeLuck;
      if (settings.challengeDiscounts) mergedSettings.challengeDiscounts = settings.challengeDiscounts;
      if (settings.challengeShields) mergedSettings.challengeShields = settings.challengeShields;
      if (settings.challengeAttackBonuses) mergedSettings.challengeAttackBonuses = settings.challengeAttackBonuses;
      if (settings.challengeHintsEnabled) mergedSettings.challengeHintsEnabled = settings.challengeHintsEnabled;
      if (settings.challengeHints) mergedSettings.challengeHints = settings.challengeHints;
      if (settings.hintPenaltyPercent !== undefined) mergedSettings.hintPenaltyPercent = settings.hintPenaltyPercent;
      if (settings.maxHintsPerChallenge !== undefined) mergedSettings.maxHintsPerChallenge = settings.maxHintsPerChallenge;
      if (settings.dueDateEnabled !== undefined) mergedSettings.dueDateEnabled = settings.dueDateEnabled;
      if (settings.dueDate !== undefined) mergedSettings.dueDate = settings.dueDate;

      
      challenge.settings = mergedSettings;
      challenge.isConfigured = true;
    } else {
      const defaultSettings = {
        challengeBits: [50, 75, 100, 125],
        challengeMultipliers: [1.0, 1.0, 1.0, 1.0],
        challengeLuck: [1.0, 1.0, 1.0, 1.0],
        challengeDiscounts: [0, 0, 0, 0],
        challengeShields: [false, false, false, false],
        challengeAttackBonuses: [0, 0, 0, 0],
        challengeHintsEnabled: [false, false, false, false],
        ...settings
      };
      
      challenge = new Challenge({
        classroomId,
        createdBy: teacherId,
        title: title || 'Cyber Challenge Series',
        settings: defaultSettings,
        isConfigured: true,
        isActive: false
      });
    }

    await challenge.save();

    res.json({ 
      message: 'Challenge configured successfully',
      challenge: {
        _id: challenge._id,
        title: challenge.title,
        settings: challenge.settings,
        isConfigured: challenge.isConfigured,
        isActive: challenge.isActive
      }
    });

  } catch (error) {
    console.error('Error configuring challenge:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:classroomId/initiate', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const teacherId = req.user._id;

    const classroom = await Classroom.findById(classroomId).populate('students');
    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    if (classroom.teacher.toString() !== teacherId.toString()) {
      return res.status(403).json({ message: 'Only the classroom teacher can initiate challenges' });
    }

    let challenge = await Challenge.findOne({ classroomId });
    
    if (!challenge || !challenge.isConfigured) {
      return res.status(400).json({ message: 'Challenge must be configured before activation' });
    }
    
    if (challenge.isActive) {
      return res.status(400).json({ message: 'Challenge is already active for this classroom' });
    }

    const userChallenges = classroom.students.map(student => 
      challenge.generateUserChallenge(student._id)
    );

    challenge.isActive = true;
    challenge.userChallenges = userChallenges;
    challenge.activatedAt = Date.now();

    await challenge.save();
    await challenge.populate('userChallenges.userId', 'firstName lastName email');

    res.json({ 
      message: 'Cyber Challenge initiated successfully',
      challenge
    });

  } catch (error) {
    console.error('Error initiating challenge:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update due date for active challenge
router.post('/:classroomId/update-due-date', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const { dueDateEnabled, dueDate } = req.body;
    const teacherId = req.user._id;

    const classroom = await Classroom.findById(classroomId);
    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    if (classroom.teacher.toString() !== teacherId.toString()) {
      return res.status(403).json({ message: 'Only the classroom teacher can update due dates' });
    }

    const challenge = await Challenge.findOne({ classroomId });
    if (!challenge) {
      return res.status(404).json({ message: 'No challenge found for this classroom' });
    }

    // Update due date settings
    challenge.settings.dueDateEnabled = dueDateEnabled;
    challenge.settings.dueDate = dueDateEnabled ? dueDate : null;
    await challenge.save();

    res.json({ 
      message: 'Due date updated successfully',
      challenge
    });

  } catch (error) {
    console.error('Error updating due date:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:classroomId/deactivate', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const teacherId = req.user._id;

    const classroom = await Classroom.findById(classroomId);
    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    if (classroom.teacher.toString() !== teacherId.toString()) {
      return res.status(403).json({ message: 'Only the classroom teacher can deactivate challenges' });
    }

    const challenge = await Challenge.findOne({ classroomId });
    if (!challenge) {
      return res.status(404).json({ message: 'No challenge found for this classroom' });
    }

    // Completely delete the challenge document from MongoDB
    await Challenge.deleteOne({ classroomId });

    res.json({ 
      message: 'Challenge deleted successfully',
      challenge: null
    });

  } catch (error) {
    console.error('Error deactivating challenge:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

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

    if (userChallenge.progress < 1) {
      userChallenge.progress = 1;
      if (userChallenge.progress === 1) {
        userChallenge.completedAt = Date.now();
      }
      
      const User = require('../models/User');
      const user = await User.findById(userId);
      let bitsAwarded = 0;
      if (user) {
        const challengeIndex = 0;
        
        if (challenge.settings.rewardMode === 'individual') {
          bitsAwarded = challenge.settings.challengeBits[challengeIndex] || 0;
        }

        if (bitsAwarded > 0) {
          user.balance += bitsAwarded;
          user.transactions.push({
            amount: bitsAwarded,
            description: `Completed Challenge ${challengeIndex + 1}`,
            assignedBy: challenge.createdBy,
            createdAt: new Date()
          });
          userChallenge.bitsAwarded += bitsAwarded;
        }

        if (challenge.settings.multiplierMode === 'individual') {
          const multiplierReward = challenge.settings.challengeMultipliers[challengeIndex] || 1.0;
          if (multiplierReward > 1.0) {
            user.passiveAttributes.multiplier += (multiplierReward - 1.0);
          }
        }

        if (challenge.settings.luckMode === 'individual') {
          const luckReward = challenge.settings.challengeLuck[challengeIndex] || 1.0;
          if (luckReward > 1.0) {
            user.passiveAttributes.luck = user.passiveAttributes.luck * luckReward;
          }
        }

        if (challenge.settings.discountMode === 'individual') {
          const discountReward = challenge.settings.challengeDiscounts[challengeIndex] || 0;
          if (discountReward > 0) {
            if (typeof user.discountShop === 'boolean') {
              user.discountShop = user.discountShop ? 100 : 0;
            }
            user.discountShop = Math.min(100, (user.discountShop || 0) + discountReward);
          }
        }

        if (challenge.settings.shieldMode === 'individual') {
          const shieldReward = challenge.settings.challengeShields[challengeIndex] || false;
          if (shieldReward) {
            user.shieldActive = true;
          }
        }

        if (challenge.settings.attackMode === 'individual') {
          const attackReward = challenge.settings.challengeAttackBonuses[challengeIndex] || 0;
          if (attackReward > 0) {
            user.attackPower = (user.attackPower || 0) + attackReward;
          }
        }

        await user.save();
      }
      
      await challenge.save();
      
      try {
        await createGitHubBranch(userChallenge.uniqueId, userChallenge.userId);
      } catch (error) {
        console.error('Failed to create GitHub branch:', error);
      }
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

    const expectedPassword = generateChallenge2Password(uniqueId);

    if (expectedPassword !== password.toUpperCase()) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    if (userChallenge.progress < 2) {
      userChallenge.progress = 2;
      if (userChallenge.progress === 2) {
        userChallenge.completedAt = Date.now();
      }
      
      const User = require('../models/User');
      const user = await User.findById(userId);
      let bitsAwarded = 0;
      if (user) {
        const challengeIndex = 1;
        
        if (challenge.settings.rewardMode === 'individual') {
          bitsAwarded = challenge.settings.challengeBits[challengeIndex] || 0;
        }

        if (bitsAwarded > 0) {
          user.balance += bitsAwarded;
          user.transactions.push({
            amount: bitsAwarded,
            description: `Completed Challenge ${challengeIndex + 1}`,
            assignedBy: challenge.createdBy,
            createdAt: new Date()
          });
          userChallenge.bitsAwarded += bitsAwarded;
        }

        if (challenge.settings.multiplierMode === 'individual') {
          const multiplierReward = challenge.settings.challengeMultipliers[challengeIndex] || 1.0;
          if (multiplierReward > 1.0) {
            user.passiveAttributes.multiplier += (multiplierReward - 1.0);
          }
        }

        if (challenge.settings.luckMode === 'individual') {
          const luckReward = challenge.settings.challengeLuck[challengeIndex] || 1.0;
          if (luckReward > 1.0) {
            user.passiveAttributes.luck = user.passiveAttributes.luck * luckReward;
          }
        }

        if (challenge.settings.discountMode === 'individual') {
          const discountReward = challenge.settings.challengeDiscounts[challengeIndex] || 0;
          if (discountReward > 0) {
            if (typeof user.discountShop === 'boolean') {
              user.discountShop = user.discountShop ? 100 : 0;
            }
            user.discountShop = Math.min(100, (user.discountShop || 0) + discountReward);
          }
        }

        if (challenge.settings.shieldMode === 'individual') {
          const shieldReward = challenge.settings.challengeShields[challengeIndex] || false;
          if (shieldReward) {
            user.shieldActive = true;
          }
        }

        if (challenge.settings.attackMode === 'individual') {
          const attackReward = challenge.settings.challengeAttackBonuses[challengeIndex] || 0;
          if (attackReward > 0) {
            user.attackPower = (user.attackPower || 0) + attackReward;
          }
        }

        await user.save();
      }
      
      await challenge.save();
    }

    res.json({ 
      message: 'Challenge 2 completed successfully!',
      progress: userChallenge.progress 
    });

  } catch (error) {
    console.error('Error verifying Challenge 2 external:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Challenge 5: WayneAWS Verification
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

    if (userChallenge.progress >= 5) {
      return res.status(400).json({ message: 'Challenge already completed' });
    }

    // Update progress to Challenge 5 completed
    userChallenge.progress = 5;
    userChallenge.completedAt = Date.now();
    
    const User = require('../models/User');
    const user = await User.findById(userId);
    let bitsAwarded = 0;
    if (user) {
      const challengeIndex = 4; // Challenge 5 is index 4
      
      if (challenge.settings.rewardMode === 'individual') {
        bitsAwarded = challenge.settings.challengeBits[challengeIndex] || 0;
      } else if (challengeIndex === 4) {
        bitsAwarded = challenge.settings.totalRewardBits || 0;
      }

      // Apply hint penalty if hints were used
      const hintsEnabled = (challenge.settings.challengeHintsEnabled || [])[challengeIndex];
      const penaltyPercent = challenge.settings.hintPenaltyPercent ?? 25;
      const maxHints = challenge.settings.maxHintsPerChallenge ?? 2;
      const usedHints = Math.min((userChallenge.hintsUsed?.[challengeIndex] || 0), maxHints);
      if (hintsEnabled && bitsAwarded > 0 && usedHints > 0 && penaltyPercent > 0) {
        const totalPenalty = Math.min(100, usedHints * penaltyPercent);
        const deduction = Math.floor((bitsAwarded * totalPenalty) / 100);
        bitsAwarded = Math.max(0, bitsAwarded - deduction);
      }

      if (bitsAwarded > 0) {
        user.balance += bitsAwarded;
        user.transactions.push({
          amount: bitsAwarded,
          description: `Completed Challenge ${challengeIndex + 1}`,
          assignedBy: challenge.createdBy,
          createdAt: new Date()
        });
        userChallenge.bitsAwarded += bitsAwarded;
      }

      // Award other rewards
      if (challenge.settings.multiplierMode === 'individual') {
        const multiplierReward = challenge.settings.challengeMultipliers[challengeIndex] || 1.0;
        if (multiplierReward > 1.0) {
          user.passiveAttributes.multiplier += (multiplierReward - 1.0);
        }
      }

      if (challenge.settings.luckMode === 'individual') {
        const luckReward = challenge.settings.challengeLuck[challengeIndex] || 1.0;
        if (luckReward > 1.0) {
          user.passiveAttributes.luck = user.passiveAttributes.luck * luckReward;
        }
      }

      if (challenge.settings.discountMode === 'individual') {
        const discountReward = challenge.settings.challengeDiscounts[challengeIndex] || 0;
        if (discountReward > 0) {
          if (typeof user.discountShop === 'boolean') {
            user.discountShop = user.discountShop ? 100 : 0;
          }
          user.discountShop = Math.min(100, (user.discountShop || 0) + discountReward);
        }
      }

      if (challenge.settings.shieldMode === 'individual') {
        const shieldReward = challenge.settings.challengeShields[challengeIndex] || false;
        if (shieldReward) {
          user.shieldActive = true;
        }
      }

      if (challenge.settings.attackMode === 'individual') {
        const attackReward = challenge.settings.challengeAttackBonuses[challengeIndex] || 0;
        if (attackReward > 0) {
          user.attackPower = (user.attackPower || 0) + attackReward;
        }
      }

      await user.save();
    }
    
    await challenge.save();

    // Create notification for challenge completion
    const Notification = require('../models/Notification');
    const { populateNotification } = require('../utils/notifications');
    
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

    if (userChallenge.progress < challengeLevel - 1) {
      return res.status(400).json({ message: `Must complete Challenge ${challengeLevel - 1} first` });
    }

    if (userChallenge.progress >= challengeLevel) {
      return res.status(400).json({ message: 'Challenge already completed' });
    }

    let isCorrect = false;
    if (challengeLevel === 3) {
      isCorrect = solution.toUpperCase() === 'NETWORK_ANALYSIS_COMPLETE';
    } else if (challengeLevel === 4) {
      isCorrect = solution.toUpperCase() === 'CRYPTO_MASTER_ACHIEVED';
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

router.get('/:classroomId/stats', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const teacherId = req.user._id;

    const classroom = await Classroom.findById(classroomId);
    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    if (classroom.teacher.toString() !== teacherId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const challenge = await Challenge.findOne({ classroomId })
      .populate('userChallenges.userId', 'firstName lastName email');

    if (!challenge) {
      return res.status(404).json({ message: 'No challenge found for this classroom' });
    }

    const stats = {
      ...challenge.stats.toObject(),
      totalPossibleBits: challenge.calculateTotalBits(),
      progressDistribution: {
        notStarted: challenge.userChallenges.filter(uc => uc.progress === 0).length,
        challenge1: challenge.userChallenges.filter(uc => uc.progress === 1).length,
        challenge2: challenge.userChallenges.filter(uc => uc.progress === 2).length,
        challenge3: challenge.userChallenges.filter(uc => uc.progress === 3).length,
        completed: challenge.userChallenges.filter(uc => uc.progress === 4).length
      }
    };

    res.json({ stats, challenge });

  } catch (error) {
    console.error('Error fetching challenge stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

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

    let challengeIndex = 0;
    if (challengeId === 'caesar-secret-001') challengeIndex = 0;
    else if (challengeId === 'github-osint-002') challengeIndex = 1;
    else if (challengeId === 'network-analysis-003') challengeIndex = 2;
    else if (challengeId === 'advanced-crypto-004') challengeIndex = 3;
    else {
      return res.status(400).json({ success: false, message: 'Invalid challenge ID' });
    }

    if (challengeIndex > userChallenge.progress) {
      return res.status(400).json({ success: false, message: 'Must complete previous challenges first' });
    }

    if (challengeIndex < userChallenge.progress) {
      return res.status(400).json({ success: false, message: 'Challenge already completed' });
    }

    const challengeTypes = ['caesar-decrypt', 'github-osint', 'network-analysis', 'advanced-crypto'];
    const challengeType = challengeTypes[challengeIndex];
    
    const validator = validators[challengeType];
    if (!validator) {
      return res.status(500).json({ success: false, message: 'Unsupported challenge type' });
    }

    const isCorrect = validator(answer, {}, userChallenge.uniqueId);

    if (isCorrect) {
      userChallenge.progress = challengeIndex + 1;
      
      // Trigger Challenge 4 image generation when user completes Challenge 3 (network-analysis-003)
      if (challengeIndex === 2 && userChallenge.progress === 3) {
        try {
          const User = require('../models/User');
          const user = await User.findById(userId);
          
          // Generate Challenge 4 forensics password
          if (!userChallenge.challenge4Password) {
            const crypto = require('crypto');
            const studentHash = crypto.createHash('md5').update(userId.toString() + userChallenge.uniqueId).digest('hex');
            userChallenge.challenge4Password = `FORENSICS_${studentHash.substring(0, 8).toUpperCase()}`;
          }
          
          if (!userChallenge.forensicsImageUrl) {
            console.log(`🔍 Generating Challenge 4 forensics image for user ${userId} after completing Challenge 3`);
            const { filename } = await generateAndUploadForensicsImage(user, userChallenge.uniqueId);
            const imageUrl = `https://raw.githubusercontent.com/cinnamonstic/wsu-transit-delay/main/assets/${filename}`;
            userChallenge.forensicsImageUrl = imageUrl;
            console.log(`✅ Challenge 4 forensics image generated: ${imageUrl}`);
          }
        } catch (imageError) {
          console.error('Failed to generate Challenge 4 forensics image:', imageError);
          // Don't fail the challenge submission if image generation fails
        }
      }

      const User = require('../models/User');
      const user = await User.findById(userId);
      let bitsAwarded = 0;
      
      // Initialize rewards tracking object
      const rewardsEarned = {
        bits: 0,
        multiplier: 0,
        luck: 1.0,
        discount: 0,
        shield: false,
        attackBonus: 0
      };

      if (user) {
        // Calculate bits reward
        if (challenge.settings.rewardMode === 'individual') {
          bitsAwarded = challenge.settings.challengeBits[challengeIndex] || 0;
        } else if (challengeIndex === 4) { // Only award total on final challenge
          bitsAwarded = challenge.settings.totalRewardBits || 0;
        }

        // Apply hint penalty if hints were used
        const hintsEnabled = (challenge.settings.challengeHintsEnabled || [])[challengeIndex];
        const penaltyPercent = challenge.settings.hintPenaltyPercent ?? 25;
        const maxHints = challenge.settings.maxHintsPerChallenge ?? 2;
        const usedHints = Math.min((userChallenge.hintsUsed?.[challengeIndex] || 0), maxHints);
        if (hintsEnabled && bitsAwarded > 0 && usedHints > 0 && penaltyPercent > 0) {
          const totalPenalty = Math.min(100, usedHints * penaltyPercent);
          const deduction = Math.floor((bitsAwarded * totalPenalty) / 100);
          bitsAwarded = Math.max(0, bitsAwarded - deduction);
        }

        rewardsEarned.bits = bitsAwarded;

        // Award bits to user
        if (bitsAwarded > 0) {
          user.balance += bitsAwarded;
          user.transactions.push({
            amount: bitsAwarded,
            description: `Completed Challenge ${challengeIndex + 1}`,
            assignedBy: challenge.createdBy,
            createdAt: new Date()
          });
          userChallenge.bitsAwarded += bitsAwarded;
        }

        // Handle multiplier rewards (individual challenge rewards)
        if (challenge.settings.multiplierMode === 'individual') {
          const multiplierReward = challenge.settings.challengeMultipliers[challengeIndex] || 1.0;
          if (multiplierReward > 1.0) {
            const multiplierIncrease = multiplierReward - 1.0;
            user.passiveAttributes.multiplier += multiplierIncrease;
            rewardsEarned.multiplier = multiplierIncrease;
          }
        }

        // Handle luck rewards (individual challenge rewards)
        if (challenge.settings.luckMode === 'individual') {
          const luckReward = challenge.settings.challengeLuck[challengeIndex] || 1.0;
          if (luckReward > 1.0) {
            user.passiveAttributes.luck = user.passiveAttributes.luck * luckReward;
            rewardsEarned.luck = luckReward;
          }
        }

        // Handle discount rewards (individual challenge rewards)
        if (challenge.settings.discountMode === 'individual') {
          const discountReward = challenge.settings.challengeDiscounts[challengeIndex] || 0;
          if (discountReward > 0) {
            // Ensure discountShop is a number, not boolean
            if (typeof user.discountShop === 'boolean') {
              user.discountShop = user.discountShop ? 100 : 0;
            }
            user.discountShop = Math.min(100, (user.discountShop || 0) + discountReward);
            rewardsEarned.discount = discountReward;
          }
        }

        // Handle shield rewards (individual challenge rewards)
        if (challenge.settings.shieldMode === 'individual') {
          const shieldReward = challenge.settings.challengeShields[challengeIndex] || false;
          if (shieldReward) {
            user.shieldActive = true;
            rewardsEarned.shield = true;
          }
        }

        // Handle attack bonus rewards (individual challenge rewards)
        if (challenge.settings.attackMode === 'individual') {
          const attackReward = challenge.settings.challengeAttackBonuses[challengeIndex] || 0;
          if (attackReward > 0) {
            user.attackPower = (user.attackPower || 0) + attackReward;
            rewardsEarned.attackBonus = attackReward;
          }
        }

        // Handle total mode rewards (only on final challenge completion)
        if (challengeIndex === 4) { // Final challenge
          if (challenge.settings.multiplierMode === 'total') {
            const totalMultiplier = challenge.settings.totalMultiplier || 1.0;
            if (totalMultiplier > 1.0) {
              const multiplierIncrease = totalMultiplier - 1.0;
              user.passiveAttributes.multiplier += multiplierIncrease;
              rewardsEarned.multiplier = multiplierIncrease;
            }
          }

          if (challenge.settings.luckMode === 'total') {
            const totalLuck = challenge.settings.totalLuck || 1.0;
            if (totalLuck > 1.0) {
              user.passiveAttributes.luck = user.passiveAttributes.luck * totalLuck;
              rewardsEarned.luck = totalLuck;
            }
          }

          if (challenge.settings.discountMode === 'total') {
            const totalDiscount = challenge.settings.totalDiscount || 0;
            if (totalDiscount > 0) {
              if (typeof user.discountShop === 'boolean') {
                user.discountShop = user.discountShop ? 100 : 0;
              }
              user.discountShop = Math.min(100, (user.discountShop || 0) + totalDiscount);
              rewardsEarned.discount = totalDiscount;
            }
          }

          if (challenge.settings.shieldMode === 'total') {
            const totalShield = challenge.settings.totalShield || false;
            if (totalShield) {
              user.shieldActive = true;
              rewardsEarned.shield = true;
            }
          }

          if (challenge.settings.attackMode === 'total') {
            const totalAttackBonus = challenge.settings.totalAttackBonus || 0;
            if (totalAttackBonus > 0) {
              user.attackPower = (user.attackPower || 0) + totalAttackBonus;
              rewardsEarned.attackBonus = totalAttackBonus;
            }
          }
        }

        await user.save();
      }

      if (userChallenge.progress === 5) {
        userChallenge.completedAt = new Date();
      }

      await challenge.save();

      const challengeNames = ['Little Caesar\'s Secret', 'Check Me Out', 'Bug Smasher', 'I Always Sign My Work...', 'Secrets in the Clouds'];

      res.json({
        success: true,
        message: `Correct! ${challengeNames[challengeIndex]} completed!`,
        challengeName: challengeNames[challengeIndex],
        rewards: rewardsEarned,
        progress: userChallenge.progress,
        allCompleted: userChallenge.progress >= 5,
        nextChallenge: userChallenge.progress < 5 ? challengeNames[userChallenge.progress] : null
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

// Challenge 4: WayneAWS Verification
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
      if (userChallenge && userChallenge.progress < 4) {
        userChallenge.progress = 4;
        userChallenge.completedAt = new Date();

        const User = require('../models/User');
        const user = await User.findById(userId);
        
        // Initialize rewards tracking
        const rewardsEarned = {
          bits: 0,
          multiplier: 0,
          luck: 1.0,
          discount: 0,
          shield: false,
          attackBonus: 0
        };

        if (user) {
          const challengeIndex = 3; // Challenge 4 = index 3

          // Calculate and award rewards using the same logic as the submit route
          if (challenge.settings.rewardMode === 'individual') {
            const bitsAwarded = challenge.settings.challengeBits[challengeIndex] || 0;
            if (bitsAwarded > 0) {
              user.balance += bitsAwarded;
              user.transactions.push({
                amount: bitsAwarded,
                description: `Completed Challenge ${challengeIndex + 1}`,
                assignedBy: challenge.createdBy,
                createdAt: new Date()
              });
              userChallenge.bitsAwarded += bitsAwarded;
              rewardsEarned.bits = bitsAwarded;
            }
          }

          // Apply other individual rewards
          if (challenge.settings.multiplierMode === 'individual') {
            const multiplierReward = challenge.settings.challengeMultipliers[challengeIndex] || 1.0;
            if (multiplierReward > 1.0) {
              const multiplierIncrease = multiplierReward - 1.0;
              user.passiveAttributes.multiplier += multiplierIncrease;
              rewardsEarned.multiplier = multiplierIncrease;
            }
          }

          if (challenge.settings.luckMode === 'individual') {
            const luckReward = challenge.settings.challengeLuck[challengeIndex] || 1.0;
            if (luckReward > 1.0) {
              user.passiveAttributes.luck = user.passiveAttributes.luck * luckReward;
              rewardsEarned.luck = luckReward;
            }
          }

          if (challenge.settings.discountMode === 'individual') {
            const discountReward = challenge.settings.challengeDiscounts[challengeIndex] || 0;
            if (discountReward > 0) {
              if (typeof user.discountShop === 'boolean') {
                user.discountShop = user.discountShop ? 100 : 0;
              }
              user.discountShop = Math.min(100, (user.discountShop || 0) + discountReward);
              rewardsEarned.discount = discountReward;
            }
          }

          if (challenge.settings.shieldMode === 'individual') {
            const shieldReward = challenge.settings.challengeShields[challengeIndex] || false;
            if (shieldReward) {
              user.shieldActive = true;
              rewardsEarned.shield = true;
            }
          }

          if (challenge.settings.attackMode === 'individual') {
            const attackReward = challenge.settings.challengeAttackBonuses[challengeIndex] || 0;
            if (attackReward > 0) {
              user.attackPower = (user.attackPower || 0) + attackReward;
              rewardsEarned.attackBonus = attackReward;
            }
          }

          await user.save();
        }

        await challenge.save();
      }

      const challengeNames = ['Little Caesar\'s Secret', 'Check Me Out', 'Memory Leak Detective', 'Digital Forensics Lab', 'WayneAWS Verification'];
      
      res.json({
        success: true,
        message: 'Digital forensics investigation complete!',
        challengeName: challengeNames[3],
        rewards: rewardsEarned,
        allCompleted: userChallenge.progress >= 5,
        nextChallenge: userChallenge.progress < 5 ? challengeNames[userChallenge.progress] : null
      });
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
  
async function generateAndUploadForensicsImage(user, uniqueId) {
  const fs = require('fs').promises;
  const path = require('path');
  const sharp = require('sharp');
  const piexifjs = require('piexifjs');
  
  try {
    const crypto = require('crypto');
    const studentHash = crypto.createHash('md5').update(user._id.toString() + uniqueId).digest('hex');
    const artistName = `FORENSICS_${studentHash.substring(0, 8).toUpperCase()}`;
    const filename = `campus_${uniqueId}.jpg`;
    
    const baseImagePath = path.join(__dirname, '../..', 'frontend/src/assets/campus.jpg');
    const baseImageBuffer = await fs.readFile(baseImagePath);
    
    const imageBuffer = await sharp(baseImageBuffer)
      .composite([{
        input: Buffer.from(`<svg width="300" height="50">
          <rect width="300" height="50" fill="rgba(0,0,0,0.7)"/>
          <text x="10" y="30" fill="white" font-size="14" font-family="Arial">
            Evidence ID: ${uniqueId.substring(0, 8)}
          </text>
        </svg>`),
        gravity: 'southeast'
      }])
      .jpeg({ quality: 95 })
      .toBuffer();
    
    const exifObj = {
      '0th': {
        [piexifjs.ImageIFD.Artist]: artistName,
        [piexifjs.ImageIFD.Copyright]: `WSU Cybersecurity Challenge - ${new Date().getFullYear()}`,
        [piexifjs.ImageIFD.Software]: 'WSU Forensics Lab',
        [piexifjs.ImageIFD.DateTime]: new Date().toISOString().replace('T', ' ').substring(0, 19)
      }
    };
    
    const exifBytes = piexifjs.dump(exifObj);
    
    const base64Image = 'data:image/jpeg;base64,' + imageBuffer.toString('base64');
    const finalImageBase64 = piexifjs.insert(exifBytes, base64Image);
    const finalImageBuffer = Buffer.from(finalImageBase64.split(',')[1], 'base64');
    
    // Fix: Use GITHUB_TOKEN instead of undefined githubToken
    await uploadToGitHub(filename, finalImageBuffer, GITHUB_TOKEN);
    
    return { filename, artistName };
    
  } catch (error) {
    console.error('Error generating forensics image:', error);
    throw new Error('Failed to generate forensics evidence');
  }
}

async function uploadToGitHub(filename, fileBuffer, githubToken) {
  const axios = require('axios');
  
  if (!githubToken || githubToken === 'contact-akrm-for-token') {
    throw new Error('GITHUB_TOKEN environment variable not properly configured');
  }
  
  const owner = 'cinnamonstic';
  const repo = 'wsu-transit-delay';
  const path = `assets/${filename}`;
  
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      let sha = null;
      
      // Get the latest SHA right before upload to avoid conflicts
      try {
        const existingFile = await axios.get(url, {
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        sha = existingFile.data.sha;
        console.log(`File ${filename} exists, updating with SHA: ${sha}`);
      } catch (error) {
        if (error.response?.status === 404) {
          console.log(`File ${filename} doesn't exist, creating new file`);
        } else {
          throw error;
        }
      }
      
      const uploadData = {
        message: sha ? `chore: update campus image ${filename}` : `chore: add campus image ${filename}`,
        content: fileBuffer.toString('base64')
      };
      
      if (sha) {
        uploadData.sha = sha;
      }
      
      const response = await axios.put(url, uploadData, {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      console.log(`✅ Successfully uploaded ${filename} to GitHub`);
      return response.data;
      
    } catch (error) {
      if (error.response?.status === 409) {
        console.warn(`⚠️  SHA conflict for ${filename}, retrying... (attempt ${retryCount + 1}/${maxRetries})`);
        retryCount++;
        if (retryCount >= maxRetries) {
          console.log(`✅ File ${filename} exists after max retries - considering this successful`);
          return; // File exists, which is what we want
        }
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      console.error('GitHub upload error:', error.response?.data || error.message);
      throw new Error('Failed to upload to GitHub');
    }
  }
}

// Add route to generate Challenge 4 forensics image
router.post('/challenge4/:uniqueId/generate-image', ensureAuthenticated, async (req, res) => {
  try {
    const { uniqueId } = req.params;
    const userId = req.user._id;

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

    // Change this to allow image generation when user has completed Challenge 3 (progress >= 3)
    if (userChallenge.progress < 3) {
      return res.status(400).json({ message: 'Must complete Challenge 3 (Memory Leak Detective) first' });
    }

    // Check if image already exists
    if (userChallenge.forensicsImageUrl) {
      return res.json({ 
        imageUrl: userChallenge.forensicsImageUrl,
        message: 'Forensics image already generated'
      });
    }

    // Prevent concurrent uploads
    if (uploadLocks.has(uniqueId)) {
      return res.status(429).json({ message: 'Image generation in progress, please wait...' });
    }

    uploadLocks.set(uniqueId, true);

    try {
      const User = require('../models/User');
      const user = await User.findById(userId);
      
      const { filename } = await generateAndUploadForensicsImage(user, uniqueId);
      const imageUrl = `https://raw.githubusercontent.com/cinnamonstic/wsu-transit-delay/main/assets/${filename}`;
      
      // Store the image URL in the user challenge
      userChallenge.forensicsImageUrl = imageUrl;
      await challenge.save();

      res.json({ 
        imageUrl,
        message: 'Digital forensics evidence generated successfully! Download and examine the metadata to find your answer.'
      });

    } finally {
      uploadLocks.delete(uniqueId);
    }

  } catch (error) {
    console.error('Error generating Challenge 4 evidence:', error);
    uploadLocks.delete(req.params.uniqueId);
    res.status(500).json({ message: 'Failed to generate forensics evidence' });
  }
});

router.post('/:classroomId/debug-progress', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const { progress } = req.body;
    const userId = req.user._id;

    const challenge = await Challenge.findOne({ classroomId });
    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    let userChallenge = challenge.userChallenges.find(uc => uc.userId.toString() === userId.toString());
    
    if (!userChallenge) {
      const crypto = require('crypto');
      const uniqueId = crypto.randomBytes(16).toString('hex');
      
      userChallenge = {
        userId,
        uniqueId,
        progress: parseInt(progress),
        completedAt: progress >= 4 ? new Date() : null
      };
      
      challenge.userChallenges.push(userChallenge);
    } else {
      userChallenge.progress = parseInt(progress);
      userChallenge.completedAt = progress >= 4 ? new Date() : null;
    }

    await challenge.save();

    const User = require('../models/User');
    const user = await User.findById(userId);
    if (user && progress > 0) {
      for (let i = 0; i < progress; i++) {
        try {
          await awardChallengeRewards(user, challenge, i);
        } catch (rewardError) {
          console.error(`Error awarding rewards for challenge ${i}:`, rewardError);
        }
      }
      console.log(`Applied rewards for challenges 0-${progress-1} to user ${userId}`);
    }

    res.json({ 
      success: true, 
      message: `Progress set to ${progress}`,
      userChallenge 
    });

  } catch (error) {
    console.error('Error setting debug progress:', error);
    res.status(500).json({ message: 'Failed to set progress' });
  }
});

// Restore the missing Challenge 3 and Challenge 4 code and fix the upload locks declaration
router.get('/challenge3/:uniqueId', ensureAuthenticated, async (req, res) => {
  try {
    const { uniqueId } = req.params;
    const userId = req.user._id;
    
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

    const User = require('../models/User');
    const user = await User.findById(userId);
    
    const crypto = require('crypto');
    const studentHash = crypto.createHash('md5').update(userId.toString() + uniqueId).digest('hex');
    const hashNum = parseInt(studentHash.substring(0, 8), 16);
    
    const studentData = {
      hashedId: studentHash,
      firstName: user.firstName,
      lastName: user.lastName,
      studentId: `CS${(hashNum % 9000) + 1000}`,
      semester: hashNum % 2 === 0 ? 'Fall' : 'Spring',
      year: 2024 + (hashNum % 3),
      gpa: (2.0 + (hashNum % 200) / 100).toFixed(2)
    };

    const varNames = {
      student: `student_${studentData.studentId.slice(-2)}`,
      course: `course_${(hashNum % 900) + 100}`,
      credit: `credits_${hashNum % 4 + 1}`,
      grade: `grade_${String.fromCharCode(65 + (hashNum % 5))}` // A-E
    };

    const codeFiles = generateBuggyCode(studentData, varNames, hashNum);
    
    res.json({
      studentData,
      codeFiles
    });

  } catch (error) {
    console.error('Error generating Challenge 3:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Restore Challenge 3 test route
router.post('/challenge3/:uniqueId/test', ensureAuthenticated, async (req, res) => {
  try {
    const { uniqueId } = req.params;
    const { codeFiles } = req.body;
    const userId = req.user._id;

    const challenge = await Challenge.findOne({ 
      'userChallenges.uniqueId': uniqueId,
      'userChallenges.userId': userId 
    });

    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    const testResults = await runCodeTests(codeFiles, userId, uniqueId);
    const passedTests = testResults.filter(t => t.passed).length;
    const totalTests = testResults.length;
    const success = passedTests === totalTests;

    if (success) {
      const userChallenge = challenge.userChallenges.find(uc => uc.uniqueId === uniqueId);
      if (userChallenge && userChallenge.progress < 3) {
        userChallenge.progress = 3;
        userChallenge.completedAt = new Date();

        const User = require('../models/User');
        const user = await User.findById(userId);
        if (user) {
          await awardChallengeRewards(user, challenge, 2); // Challenge 3 = index 2
          // Generate Challenge 4 forensics image when completing Challenge 3
          try {
            if (!userChallenge.forensicsImageUrl) {
              const { filename } = await generateAndUploadForensicsImage(user, userChallenge.uniqueId);
              const imageUrl = `https://raw.githubusercontent.com/cinnamonstic/wsu-transit-delay/main/assets/${filename}`;
              userChallenge.forensicsImageUrl = imageUrl;
            }
          } catch (imageError) {
            console.error('Failed to generate Challenge 4 forensics image:', imageError);
          }
        }

        await challenge.save();
      }
    }

    const hints = success ? [] : generateDebugHints(testResults, codeFiles);

    res.json({
      success,
      testResults,
      passedTests,
      totalTests,
      hints: hints.slice(0, 3)
    });

  } catch (error) {
    console.error('Error testing Challenge 3 code:', error);
    res.status(500).json({ message: 'Code testing failed' });
  }
});

// Restore Challenge 4 generate route
router.post('/challenge4/:uniqueId/generate', ensureAuthenticated, async (req, res) => {
  try {
    const { uniqueId } = req.params;
    const userId = req.user._id;

    const challenge = await Challenge.findOne({ 
      'userChallenges.uniqueId': uniqueId,
      'userChallenges.userId': userId 
    });

    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    const User = require('../models/User');
    const user = await User.findById(userId);
    
    const filename = `campus_${uniqueId}.jpg`;
    
    // Check if this file is already being processed
    if (uploadLocks.has(filename)) {
      return res.status(429).json({ 
        message: 'File is currently being processed. Please wait and try again.',
        filename: filename
      });
    }

    const githubToken = process.env.GITHUB_TOKEN;
    const url = `https://api.github.com/repos/cinnamonstic/wsu-transit-delay/contents/assets/${filename}`;
    
    try {
      const axios = require('axios');
      await axios.get(url, {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      console.log(`Evidence ${filename} already exists, skipping upload`);
      
      res.json({
        message: 'Forensics evidence ready',
        repoUrl: 'https://github.com/cinnamonstic/wsu-transit-delay',
        filename: filename,
        hint: 'Look for your evidence in the assets/ folder. Examine the metadata carefully.'
      });
      
    } catch (checkError) {
      if (checkError.response?.status === 404) {
        console.log(`Evidence ${filename} doesn't exist, generating new file`);
        
        // Set lock before starting upload
        uploadLocks.set(filename, Date.now());
        
        try {
          const result = await generateAndUploadForensicsImage(user, uniqueId);
          
          res.json({
            message: 'Forensics evidence uploaded successfully',
            repoUrl: 'https://github.com/cinnamonstic/wsu-transit-delay',
            filename: result.filename,
            hint: 'Look for your evidence in the assets/ folder. Examine the metadata carefully.'
          });
        } finally {
          // Always remove lock when done
          uploadLocks.delete(filename);
        }
      } else {
        throw checkError;
      }
    }

  } catch (error) {
    console.error('Error generating Challenge 4 evidence:', error);
    res.status(500).json({ message: 'Failed to generate forensics evidence' });
  }
});

// Add hints unlock route
router.post('/:classroomId/hints/unlock', ensureAuthenticated, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const { challengeId } = req.body;
    const userId = req.user._id;

    const challenge = await Challenge.findOne({ classroomId, isActive: true });
    if (!challenge) return res.status(404).json({ success: false, message: 'No active challenge found' });

    const userChallenge = challenge.userChallenges.find(uc => uc.userId.toString() === userId.toString());
    if (!userChallenge) return res.status(404).json({ success: false, message: 'User not enrolled in challenge' });

    let challengeIndex = 0;
    if (challengeId === 'caesar-secret-001') challengeIndex = 0;
    else if (challengeId === 'github-osint-002') challengeIndex = 1;
    else if (challengeId === 'network-analysis-003') challengeIndex = 2;
    else if (challengeId === 'advanced-crypto-004') challengeIndex = 3;
    else return res.status(400).json({ success: false, message: 'Invalid challenge ID' });

    const enableHints = (challenge.settings.challengeHintsEnabled || [])[challengeIndex];
    if (!enableHints) return res.status(400).json({ success: false, message: 'Hints are disabled for this challenge' });

    const maxHints = challenge.settings.maxHintsPerChallenge ?? 2;
    if (!Array.isArray(userChallenge.hintsUsed)) userChallenge.hintsUsed = [];
    while (userChallenge.hintsUsed.length <= challengeIndex) userChallenge.hintsUsed.push(0);
    const used = userChallenge.hintsUsed[challengeIndex];
    if (used >= maxHints) return res.status(400).json({ success: false, message: 'No hints remaining' });

    userChallenge.hintsUsed[challengeIndex] = used + 1;

    // Get custom hints from teacher configuration or use defaults
    const customHints = challenge.settings.challengeHints?.[challengeIndex] || [];
    const filteredHints = customHints.filter(hint => hint && hint.trim().length > 0);
    
    let hintText = null;
    if (filteredHints.length > 0) {
      // Use teacher's custom hints
      hintText = filteredHints[used] || filteredHints[filteredHints.length - 1];
    } else {
      // Fallback to default hints if teacher didn't configure any
      let defaultHints = [];
      if (challengeIndex === 0) {
        defaultHints = [
          'Think substitution. A constant shift may help align letters.',
          'Try shifting 3 positions; focus on uppercase letters only.'
        ];
      } else if (challengeIndex === 1) {
        defaultHints = [
          'Trace commits and branches that reference your unique ID.',
          'Look in README or commit messages for clues containing your ID.'
        ];
      } else if (challengeIndex === 2) {
        defaultHints = [
          'Look for logic errors in the comparison operators.',
          'Check for missing bounds validation on user input.'
        ];
      } else if (challengeIndex === 3) {
        defaultHints = [
          'Inspect EXIF metadata fields; look for creator or comment.',
          'Compare original and exported images; hash the one tied to your ID.'
        ];
      }
      hintText = defaultHints[used] || defaultHints[defaultHints.length - 1];
    }

    if (!Array.isArray(userChallenge.hintsUnlocked)) userChallenge.hintsUnlocked = [];
    while (userChallenge.hintsUnlocked.length <= challengeIndex) userChallenge.hintsUnlocked.push([]);
    userChallenge.hintsUnlocked[challengeIndex] = userChallenge.hintsUnlocked[challengeIndex] || [];
    userChallenge.hintsUnlocked[challengeIndex].push(hintText);

    await challenge.save();

    res.json({ success: true, hint: hintText, usedHints: userChallenge.hintsUsed[challengeIndex], remaining: Math.max(0, maxHints - userChallenge.hintsUsed[challengeIndex]) });
  } catch (error) {
    console.error('Error unlocking hint:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

function generateBuggyCode(studentData, varNames, hashNum) {
  const bugType = hashNum % 4;
  const studentNum = (hashNum % 9000) + 1000;
  const correctFlag = `SEC${studentNum}_FIXED`;
  
  let buggyCode, bugDescription;
  
  switch(bugType) {
    case 0:   
      buggyCode = `#include <iostream>
#include <string>
using namespace std;

int main() {
    // Secure Login System - ${studentData.firstName} ${studentData.lastName}
    // Student ID: ${studentData.studentId}
    // Fix the security vulnerability below
    
    string username = "admin";
    string password = "secret${studentNum}";
    string input_user, input_pass;
    
    cout << "Username: ";
    cin >> input_user;
    cout << "Password: ";
    cin >> input_pass;
    
    // BUG: This comparison logic is wrong
    if(input_user.compare(username) || input_pass.compare(password)) {
        cout << "Access granted! Flag: ${correctFlag}" << endl;
    } else {
        cout << "Access denied" << endl;
    }
    
    return 0;
}`;
      bugDescription = "Logic error in comparison - should check both conditions are true";
      break;
      
    case 1: 
      buggyCode = `#include <iostream>
#include <string>
using namespace std;

int main() {
    // Password Checker - ${studentData.firstName} ${studentData.lastName}
    // Student ID: ${studentData.studentId}
    // Fix the array bounds issue
    
    char validChars[] = {'A', 'B', 'C', 'D', 'E'};
    int userInput;
    
    cout << "Enter index (0-4): ";
    cin >> userInput;
    
    // BUG: Missing bounds check
    if(validChars[userInput] == 'C') {
        cout << "Correct! Flag: ${correctFlag}" << endl;
    } else {
        cout << "Wrong character" << endl;
    }
    
    return 0;
}`;
      bugDescription = "Missing array bounds check - could access invalid memory";
      break;
      
    case 2: 
      buggyCode = `#include <iostream>
using namespace std;

int main() {
    // Score Calculator - ${studentData.firstName} ${studentData.lastName}
    // Student ID: ${studentData.studentId}
    // Fix the integer overflow vulnerability
    
    int baseScore = ${20000 + (hashNum % 10000)};
    int multiplier;
    
    cout << "Enter multiplier: ";
    cin >> multiplier;
    
    // BUG: No overflow check
    int finalScore = baseScore * multiplier;
    
    if(finalScore == ${studentNum}) {
        cout << "Perfect score! Flag: ${correctFlag}" << endl;
    } else {
        cout << "Score: " << finalScore << endl;
    }
    
    return 0;
}`;
      bugDescription = "Integer overflow vulnerability - large inputs can wrap around";
      break;
      
    case 3: 
      buggyCode = `#include <iostream>
#include <cstring>
using namespace std;

int main() {
    // Name Validator - ${studentData.firstName} ${studentData.lastName}
    // Student ID: ${studentData.studentId}
    // Fix the buffer overflow issue
    
    char buffer[8];
    char target[] = "SEC${studentNum}";
    
    cout << "Enter code: ";
    
    // BUG: No length check on input
    cin >> buffer;
    
    if(strcmp(buffer, target) == 0) {
        cout << "Valid code! Flag: ${correctFlag}" << endl;
    } else {
        cout << "Invalid code" << endl;
    }
    
    return 0;
}`;
      bugDescription = "Buffer overflow - input not limited to buffer size";
      break;
  }
  
  return {
    'main.cpp': buggyCode,
    bugType: bugType,
    bugDescription: bugDescription,
    correctFlag: correctFlag
  };
}

async function runCodeTests(codeFiles, userId, uniqueId) {
  const crypto = require('crypto');
  const studentHash = crypto.createHash('md5').update(userId.toString() + uniqueId).digest('hex');
  const hashNum = parseInt(studentHash.substring(0, 8), 16);
  const bugType = hashNum % 4;
  const studentNum = (hashNum % 9000) + 1000;
  const correctFlag = `SEC${studentNum}_FIXED`;
  
  let test;
  
  switch(bugType) {
    case 0: 
      test = {
        name: "Logic Fix",
        passed: (codeFiles['main.cpp'].includes('input_user.compare(username) == 0 && input_pass.compare(password) == 0') ||
                codeFiles['main.cpp'].includes('input_user == username && input_pass == password') ||
                (codeFiles['main.cpp'].includes('!input_user.compare(username) && !input_pass.compare(password)'))) &&
                !codeFiles['main.cpp'].includes('input_user.compare(username) || input_pass.compare(password)'),
        error: "Login logic still incorrect - should check both username AND password are correct"
      };
      break;
      
    case 1: 
      test = {
        name: "Bounds Check",
        passed: codeFiles['main.cpp'].includes('userInput >= 0 && userInput < 5') ||
                codeFiles['main.cpp'].includes('userInput >= 0 && userInput <= 4') ||
                (codeFiles['main.cpp'].includes('userInput >= 0') && codeFiles['main.cpp'].includes('userInput < 5')),
        error: "Missing array bounds validation - need to check input is within valid range"
      };
      break;
      
    case 2: 
      test = {
        name: "Overflow Check", 
        passed: codeFiles['main.cpp'].includes('INT_MAX') ||
                codeFiles['main.cpp'].includes('overflow') ||
                codeFiles['main.cpp'].includes('multiplier == 0') ||
                (codeFiles['main.cpp'].includes('multiplier >') && codeFiles['main.cpp'].includes('multiplier <')),
        error: "Missing overflow protection - large multipliers can cause integer wraparound"
      };
      break;
      
    case 3: 
      test = {
        name: "Buffer Safety",
        passed: codeFiles['main.cpp'].includes('.length()') ||
                codeFiles['main.cpp'].includes('string ') ||
                codeFiles['main.cpp'].includes('getline') ||
                !codeFiles['main.cpp'].includes('cin >> buffer'),
        error: "Buffer overflow vulnerability - input should be length-limited or use string"
      };
      break;
  }
  
  const tests = [test];

  return tests;
}

function generateDebugHints(testResults, codeFiles) {
  const hints = [];
  const failedTest = testResults.find(t => !t.passed);
  
  if (!failedTest) return hints;
  
  switch(failedTest.name) {
    case "Logic Fix":
      hints.push("The comparison operators are backwards - you want to grant access when BOTH username and password are correct");
      hints.push("compare() returns 0 when strings match, so you need == 0, or use != operator directly");
      break;
      
    case "Bounds Check":
      hints.push("What happens if someone enters -1 or 10? Add checks before accessing the array");
      hints.push("Valid array indices are 0 through 4 (array size - 1)");
      break;
      
    case "Overflow Check":
      hints.push("Very large multipliers can cause integer wraparound - add validation");
      hints.push("Consider what happens when baseScore * multiplier exceeds INT_MAX");
      break;
      
    case "Buffer Safety":
      hints.push("Fixed-size char arrays are dangerous - what if input is longer than 8 characters?");
      hints.push("Consider using std::string instead of char arrays for safer input");
      break;
  }
  
  return hints;
}

async function awardChallengeRewards(user, challenge, challengeIndex) {
  let bitsAwarded = 0;
  
  if (challenge.settings.rewardMode === 'individual') {
    bitsAwarded = challenge.settings.challengeBits[challengeIndex] || 0;
  }

  if (bitsAwarded > 0) {
    user.balance += bitsAwarded;
    user.transactions.push({
      amount: bitsAwarded,
      description: `Completed Challenge ${challengeIndex + 1}`,
      assignedBy: challenge.createdBy,
      createdAt: new Date()
    });
  }

  // Apply other rewards (multiplier, luck, etc.)
  if (challenge.settings.multiplierMode === 'individual') {
    const multiplierReward = (challenge.settings.challengeMultipliers && challenge.settings.challengeMultipliers[challengeIndex]) || 1.0;
    if (multiplierReward > 1.0) {
      user.passiveAttributes.multiplier += (multiplierReward - 1.0);
    }
  }

  if (challenge.settings.luckMode === 'individual') {
    const luckReward = (challenge.settings.challengeLuck && challenge.settings.challengeLuck[challengeIndex]) || 1.0;
    if (luckReward > 1.0) {
      user.passiveAttributes.luck = user.passiveAttributes.luck * luckReward;
    }
  }

  if (challenge.settings.discountMode === 'individual') {
    const discountReward = (challenge.settings.challengeDiscounts && challenge.settings.challengeDiscounts[challengeIndex]) || 0;
    if (discountReward > 0) {
      // Ensure discountShop is a number, not boolean
      if (typeof user.discountShop === 'boolean') {
        user.discountShop = user.discountShop ? 100 : 0;
      }
      user.discountShop = Math.min(100, (user.discountShop || 0) + discountReward);
    }
  }

  if (challenge.settings.shieldMode === 'individual') {
    const shieldReward = (challenge.settings.challengeShields && challenge.settings.challengeShields[challengeIndex]) || false;
    if (shieldReward) {
      user.shieldActive = true;
    }
  }

  if (challenge.settings.attackMode === 'individual') {
    const attackReward = (challenge.settings.challengeAttackBonuses && challenge.settings.challengeAttackBonuses[challengeIndex]) || 0;
    if (attackReward > 0) {
      user.attackPower = (user.attackPower || 0) + attackReward;
    }
  }

  await user.save();
}

// ...existing code...

module.exports = router;