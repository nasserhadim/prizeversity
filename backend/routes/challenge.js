const express = require('express');
const router = express.Router();
const Challenge = require('../models/Challenge');
const Classroom = require('../models/Classroom');
const User = require('../models/User');
const { ensureAuthenticated, ensureTeacher } = require('../middleware/auth');
const axios = require('axios');
const validators = require('../validators/challenges');

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

    let needsSave = false;
    for (const userChallenge of challenge.userChallenges) {
      if (!userChallenge.challenge2Password) {
        userChallenge.challenge2Password = generateChallenge2Password(userChallenge.uniqueId);
        needsSave = true;
      }
      
      if (!userChallenge.challenge4Password) {
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

    res.json({ 
      challenge: {
        _id: challenge._id,
        title: challenge.title,
        description: challenge.description,
        isActive: challenge.isActive,
        settings: challenge.settings
      },
      userChallenge,
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

    console.log('Creating GitHub branches for all students...');
    const branchCreationPromises = challenge.userChallenges.map(async (userChallenge) => {
      try {
        await createGitHubBranch(userChallenge.uniqueId, userChallenge.userId);
        console.log(`✅ Created GitHub branch for ${userChallenge.uniqueId}`);
      } catch (error) {
        console.error(`❌ Failed to create GitHub branch for ${userChallenge.uniqueId}:`, error.message);
      }
    });

    await Promise.allSettled(branchCreationPromises);
    console.log('GitHub branch creation process completed');

    res.json({ 
      message: 'Cyber Challenge initiated successfully',
      challenge
    });

  } catch (error) {
    console.error('Error initiating challenge:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

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

    if (!userChallenge.completedChallenges) {
      userChallenge.completedChallenges = [false, false, false, false, false];
    }

    if (!userChallenge.completedChallenges[0]) {
      userChallenge.completedChallenges[0] = true;
      userChallenge.progress = userChallenge.completedChallenges.filter(Boolean).length;
      userChallenge.completedAt = Date.now();
      
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

    if (userChallenge.forensicsImageUrl) {
      return res.json({ 
        imageUrl: userChallenge.forensicsImageUrl,
        message: 'Forensics image already generated'
      });
    }

    if (uploadLocks.has(uniqueId)) {
      return res.status(429).json({ message: 'Image generation in progress, please wait...' });
    }

    uploadLocks.set(uniqueId, true);

    try {
      const User = require('../models/User');
      const user = await User.findById(userId);
      
      const { filename } = await generateAndUploadForensicsImage(user, uniqueId);
      const imageUrl = `https://raw.githubusercontent.com/cinnamonstic/wsu-transit-delay/main/assets/${filename}`;
      
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

    if (!userChallenge.completedChallenges) {
      userChallenge.completedChallenges = [false, false, false, false, false];
    }

    if (userChallenge.completedChallenges[challengeIndex]) {
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
      if (!userChallenge.completedChallenges) {
        userChallenge.completedChallenges = [false, false, false, false, false];
      }
      userChallenge.completedChallenges[challengeIndex] = true;
      userChallenge.progress = userChallenge.completedChallenges.filter(Boolean).length;
      
      const User = require('../models/User');
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
        if (challenge.settings.rewardMode === 'individual') {
          bitsAwarded = challenge.settings.challengeBits[challengeIndex] || 0;
        } else if (challengeIndex === 4) {
          bitsAwarded = challenge.settings.totalRewardBits || 0;
        }

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

        if (challengeIndex === 4) {
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
      userChallenge.completedChallenges = [false, false, false, false, false];
    }

    if (!userChallenge.completedChallenges[1]) {
      userChallenge.completedChallenges[1] = true;
      userChallenge.progress = userChallenge.completedChallenges.filter(Boolean).length;
      
      const User = require('../models/User');
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
        const challengeIndex = 1;
        
        if (challenge.settings.rewardMode === 'individual') {
          bitsAwarded = challenge.settings.challengeBits[challengeIndex] || 0;
        }

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

    res.json({ 
      message: 'Challenge 2 completed successfully!',
      progress: userChallenge.progress
    });

  } catch (error) {
    console.error('Error verifying Challenge 2:', error);
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

    userChallenge.progress = 5;
    userChallenge.completedAt = Date.now();
    
    const User = require('../models/User');
    const user = await User.findById(userId);
    let bitsAwarded = 0;
    if (user) {
      const challengeIndex = 4;
      
      if (challenge.settings.rewardMode === 'individual') {
        bitsAwarded = challenge.settings.challengeBits[challengeIndex] || 0;
      } else if (challengeIndex === 4) {
        bitsAwarded = challenge.settings.totalRewardBits || 0;
      }

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

    if (!userChallenge.completedChallenges) {
      userChallenge.completedChallenges = [false, false, false, false, false];
    }

    if (userChallenge.completedChallenges[challengeIndex]) {
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
      if (!userChallenge.completedChallenges) {
        userChallenge.completedChallenges = [false, false, false, false, false];
      }
      userChallenge.completedChallenges[challengeIndex] = true;
      userChallenge.progress = userChallenge.completedChallenges.filter(Boolean).length;
      
      const User = require('../models/User');
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
        if (challenge.settings.rewardMode === 'individual') {
          bitsAwarded = challenge.settings.challengeBits[challengeIndex] || 0;
        } else if (challengeIndex === 4) {
          bitsAwarded = challenge.settings.totalRewardBits || 0;
        }

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

        if (challengeIndex === 4) {
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
      if (userChallenge) {
        if (!userChallenge.completedChallenges) {
          userChallenge.completedChallenges = [false, false, false, false, false];
        }
        
        const rewardsEarned = {
          bits: 0,
          multiplier: 0,
          luck: 1.0,
          discount: 0,
          shield: false,
          attackBonus: 0
        };
        
        if (!userChallenge.completedChallenges[3]) {
          userChallenge.completedChallenges[3] = true;
          userChallenge.progress = userChallenge.completedChallenges.filter(Boolean).length;
          userChallenge.completedAt = new Date();

          const User = require('../models/User');
        const user = await User.findById(userId);

        if (user) {
          const challengeIndex = 3;

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
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      console.error('GitHub upload error:', error.response?.data || error.message);
      throw new Error('Failed to upload to GitHub');
    }
  }
}

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

    if (userChallenge.forensicsImageUrl) {
      return res.json({ 
        imageUrl: userChallenge.forensicsImageUrl,
        message: 'Forensics image already generated'
      });
    }

    if (uploadLocks.has(uniqueId)) {
      return res.status(429).json({ message: 'Image generation in progress, please wait...' });
    }

    uploadLocks.set(uniqueId, true);

    try {
      const User = require('../models/User');
      const user = await User.findById(userId);
      
      const { filename } = await generateAndUploadForensicsImage(user, uniqueId);
      const imageUrl = `https://raw.githubusercontent.com/cinnamonstic/wsu-transit-delay/main/assets/${filename}`;
      
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

    function generateBuggyCode(studentData, varNames, hashNum) {
      const bugs = [
        { type: 'off_by_one', line: 'for (int i = 1; i <= size; i++)' },
        { type: 'memory_leak', line: 'int* ptr = new int[10];' },
        { type: 'null_pointer', line: 'if (ptr != nullptr)' },
        { type: 'infinite_loop', line: 'while (i < 10)' },
        { type: 'array_bounds', line: 'arr[size] = value;' }
      ];

      const selectedBugs = [];
      for (let i = 0; i < 3; i++) {
        selectedBugs.push(bugs[(hashNum + i) % bugs.length]);
      }

      const cppCode = `#include <iostream>
#include <vector>
#include <string>
using namespace std;

class Student {
private:
    string name;
    int id;
    double gpa;

public:
    Student(string n, int i, double g) : name(n), id(i), gpa(g) {}
    
    void calculateGrade() {
        vector<int> scores = {85, 92, 78, 96, 89};
        int total = 0;
        
        ${selectedBugs[0].line}
            total += scores[i];
        }
        
        double average = total / scores.size();
        cout << "Average: " << average << endl;
    }
    
    void processData() {
        ${selectedBugs[1].line}
        
        ${selectedBugs[2].line} {
            *ptr = 42;
            cout << "Value: " << *ptr << endl;
        }
    }
    
    void runLoop() {
        int i = 0;
        ${selectedBugs[3].line} {
            cout << "Processing " << i << endl;
        }
    }
};

int main() {
    Student ${varNames.student}("${studentData.firstName} ${studentData.lastName}", ${studentData.studentId.slice(-4)}, ${studentData.gpa});
    
    int arr[5] = {1, 2, 3, 4, 5};
    int size = 5;
    int value = 10;
    
    ${selectedBugs[4].line}
    
    ${varNames.student}.calculateGrade();
    ${varNames.student}.processData();
    
    return 0;
}`;

      return {
        'main.cpp': cppCode,
        bugs: selectedBugs
      };
    }

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
      if (userChallenge) {
        if (!userChallenge.completedChallenges) {
          userChallenge.completedChallenges = [false, false, false, false, false];
        }
        if (!userChallenge.completedChallenges[2]) {
          userChallenge.completedChallenges[2] = true;
          userChallenge.progress = userChallenge.completedChallenges.filter(Boolean).length;
        userChallenge.completedAt = new Date();

        const User = require('../models/User');
        const user = await User.findById(userId);
        if (user) {
          await awardChallengeRewards(user, challenge, 2);
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

router.post('/:classroomId/start', ensureAuthenticated, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const { challengeIndex } = req.body;
    const userId = req.user._id;

    const challenge = await Challenge.findOne({ classroomId, isActive: true });
    if (!challenge) return res.status(404).json({ success: false, message: 'No active challenge found' });

    const userChallenge = challenge.userChallenges.find(uc => uc.userId.toString() === userId.toString());
    if (!userChallenge) return res.status(404).json({ success: false, message: 'User not enrolled in challenge' });

    if (isChallengeExpired(challenge)) {
      return res.status(403).json({ 
        success: false, 
        message: 'This challenge series has expired and is no longer accepting submissions' 
      });
    }

    if (challengeIndex < 0 || challengeIndex > 4) {
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
    if (!challenge) return res.status(404).json({ success: false, message: 'No active challenge found' });

    const userChallenge = challenge.userChallenges.find(uc => uc.userId.toString() === userId.toString());
    if (!userChallenge) return res.status(404).json({ success: false, message: 'User not enrolled in challenge' });

        let challengeIndex = 0;
        if (challengeId === 'caesar-secret-001') challengeIndex = 0;
        else if (challengeId === 'github-osint-002') challengeIndex = 1;
        else if (challengeId === 'network-analysis-003') challengeIndex = 2;
        else if (challengeId === 'advanced-crypto-004') challengeIndex = 3;
        else {
          return res.status(400).json({ success: false, message: 'Invalid challenge ID' });
        }
    
        const hintsEnabled = (challenge.settings.challengeHintsEnabled || [])[challengeIndex];
        if (!hintsEnabled) {
          return res.status(400).json({ success: false, message: 'Hints are not enabled for this challenge' });
        }
    
        if (!userChallenge.hintsUsed) {
          userChallenge.hintsUsed = {};
        }
    
        const maxHints = challenge.settings.maxHintsPerChallenge ?? 2;
        const currentHints = userChallenge.hintsUsed[challengeIndex] || 0;
    
        if (currentHints >= maxHints) {
          return res.status(400).json({ success: false, message: 'Maximum hints already unlocked for this challenge' });
        }
        
        userChallenge.hintsUsed[challengeIndex] = currentHints + 1;
        await challenge.save();
    
        const hints = challenge.settings.challengeHints || [];
        const challengeHints = hints[challengeIndex] || [];
        const unlockedHint = challengeHints[currentHints] || 'No hint available';
    
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
    
    module.exports = router;