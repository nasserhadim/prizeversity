// Challenge Routes
// path: backend/routes/challenge.js
// ----------------
// This file contains the routes for the challenge system.
// We use this to create GitHub branches, verify passwords, and complete challenges.
// The PAT is from the dummy account Akrm created for this purpose.
// Design Details:
//     - We use the GitHub API to create branches and push files automatically.
//     - We generate a random string for each user and use that to create a branch and link it to the user's account. 
//     - We use the Caesar cipher to encrypt the password for challenge 2.

const express = require('express');
const router = express.Router();
const Challenge = require('../models/Challenge');
const Classroom = require('../models/Classroom');
const User = require('../models/User');
const { ensureAuthenticated, ensureTeacher } = require('../middleware/auth');
const axios = require('axios');
const validators = require('../validators/challenges');

// GitHub Configuration 
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
    // Check if branch already exists
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

    // Get the main branch SHA
    const mainBranch = await axios.get(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/branches/main`,
      { headers }
    );
    const mainSha = mainBranch.data.commit.sha;

    // Create new branch
    await axios.post(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs`,
      {
        ref: `refs/heads/${uniqueId}`,
        sha: mainSha
      },
      { headers }
    );

    // Generate password for Challenge 2
    const challenge2Password = generateChallenge2Password(uniqueId);

    // Create hello_world.txt content
    const fileContent = `
nice job lol: ${challenge2Password}

`;

    // Encode content to base64
    const encodedContent = Buffer.from(fileContent).toString('base64');

    // Create the file in the branch
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
  const suffix = uniqueId.slice(-4).toUpperCase();
  return `GITHUB-${suffix}`;
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

// GET /api/challenges/:classroomId - Get challenge for a classroom
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

    // Always find userChallenge for this user (including teachers)
    const userChallenge = challenge.userChallenges.find(
      uc => uc.userId._id.toString() === userId.toString()
    );

    if (isTeacher) {
      // Teachers get full challenge data + their userChallenge (for student mode)
      return res.json({ 
        challenge,
        userChallenge,
        isTeacher: true
      });
    }

    // Students get limited challenge data + their userChallenge + current challenge info
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
        // Don't send sensitive metadata to frontend
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

// POST /api/challenges/:classroomId/configure - Configure challenge settings (Teacher only)
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
      // Merge array-based settings properly
      const currentSettings = challenge.settings.toObject();
      const mergedSettings = { ...currentSettings, ...settings };
      
      // Ensure arrays are properly set
      if (settings.challengeBits) mergedSettings.challengeBits = settings.challengeBits;
      if (settings.challengeMultipliers) mergedSettings.challengeMultipliers = settings.challengeMultipliers;
      if (settings.challengeLuck) mergedSettings.challengeLuck = settings.challengeLuck;
      if (settings.challengeDiscounts) mergedSettings.challengeDiscounts = settings.challengeDiscounts;
      if (settings.challengeShields) mergedSettings.challengeShields = settings.challengeShields;
      if (settings.challengeAttackBonuses) mergedSettings.challengeAttackBonuses = settings.challengeAttackBonuses;
      
      challenge.settings = mergedSettings;
      challenge.isConfigured = true;
    } else {
      // Set default arrays if not provided
      const defaultSettings = {
        challengeBits: [50, 75, 100, 125],
        challengeMultipliers: [1.0, 1.0, 1.0, 1.0],
        challengeLuck: [1.0, 1.0, 1.0, 1.0],
        challengeDiscounts: [0, 0, 0, 0],
        challengeShields: [false, false, false, false],
        challengeAttackBonuses: [0, 0, 0, 0],
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

// POST /api/challenges/:classroomId/initiate - Activate configured challenge (Teacher only)
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

// POST /api/challenges/:classroomId/deactivate - Deactivate challenge (Teacher only)
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

    challenge.isActive = false;
    challenge.updatedAt = Date.now();
    await challenge.save();

    res.json({ 
      message: 'Challenge deactivated successfully',
      challenge
    });

  } catch (error) {
    console.error('Error deactivating challenge:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/challenges/verify-password - Verify password and update progress
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
      
      // Award all rewards for Challenge 1 (index 0)
      const User = require('../models/User');
      const user = await User.findById(userId);
      let bitsAwarded = 0;
      if (user) {
        const challengeIndex = 0; // Challenge 1
        
        // Calculate bits reward
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

        // Award other rewards (multiplier, luck, discount, shield, attack bonus)
        
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

// POST /api/challenges/verify-challenge2-external - Verify Challenge 2 from external site
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

    // Generate expected Challenge 2 password
    const expectedPassword = generateChallenge2Password(uniqueId);

    if (expectedPassword !== password.toUpperCase()) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    if (userChallenge.progress < 2) {
      userChallenge.progress = 2;
      if (userChallenge.progress === 2) {
        userChallenge.completedAt = Date.now();
      }
      
      // Award all rewards for Challenge 2 (index 1)
      const User = require('../models/User');
      const user = await User.findById(userId);
      let bitsAwarded = 0;
      if (user) {
        const challengeIndex = 1; // Challenge 2
        
        // Calculate bits reward
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

        // Award other rewards (multiplier, luck, discount, shield, attack bonus)
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
            // Convert boolean to percentage if needed for backwards compatibility
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

// POST /api/challenges/complete-challenge/:level - Complete challenge level (Student)
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
      userChallenge.completedAt = Date.now();
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

// GET /api/challenges/:classroomId/stats - Get challenge statistics (Teacher only)
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

// POST /api/challenges/:classroomId/submit - Submit answer to current challenge
router.post('/:classroomId/submit', ensureAuthenticated, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const { answer, challengeId } = req.body;
    const userId = req.user._id;

    if (!answer || !answer.trim()) {
      return res.status(400).json({ success: false, message: 'Answer is required' });
    }

    // Get challenge and user data
    const challenge = await Challenge.findOne({ classroomId, isActive: true });
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'No active challenge found' });
    }

    const userChallenge = challenge.userChallenges.find(
      uc => uc.userId.toString() === userId.toString()
    );
    if (!userChallenge) {
      return res.status(404).json({ success: false, message: 'User not enrolled in challenge' });
    }

    // Determine which challenge they're attempting
    let challengeIndex = 0;
    if (challengeId === 'caesar-secret-001') challengeIndex = 0;
    else if (challengeId === 'github-osint-002') challengeIndex = 1;
    else if (challengeId === 'network-analysis-003') challengeIndex = 2;
    else if (challengeId === 'advanced-crypto-004') challengeIndex = 3;
    else {
      return res.status(400).json({ success: false, message: 'Invalid challenge ID' });
    }

    // Check if they can attempt this challenge (must complete previous ones)
    if (challengeIndex > userChallenge.progress) {
      return res.status(400).json({ success: false, message: 'Must complete previous challenges first' });
    }

    // Check if already completed
    if (challengeIndex < userChallenge.progress) {
      return res.status(400).json({ success: false, message: 'Challenge already completed' });
    }

    // Use secure validation - all logic hidden in validators module
    const challengeTypes = ['caesar-decrypt', 'github-osint', 'network-analysis', 'advanced-crypto'];
    const challengeType = challengeTypes[challengeIndex];
    
    const validator = validators[challengeType];
    if (!validator) {
      return res.status(500).json({ success: false, message: 'Unsupported challenge type' });
    }

    // Validate answer using secure validator (no sensitive logic here)
    const isCorrect = validator(answer, {}, userChallenge.uniqueId);

    if (isCorrect) {
      // Update progress
      userChallenge.progress = challengeIndex + 1;
      
      // Award rewards
      const User = require('../models/User');
      const user = await User.findById(userId);
      let bitsAwarded = 0;
      if (user) {
        
        // Calculate bits reward
        if (challenge.settings.rewardMode === 'individual') {
          bitsAwarded = challenge.settings.challengeBits[challengeIndex] || 0;
        } else if (challengeIndex === 3) { // Only award total bits on final challenge
          bitsAwarded = challenge.settings.totalRewardBits || 0;
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

        // Award other rewards (multiplier, luck, discount, shield, attack bonus)
        if (challenge.settings.multiplierMode === 'individual') {
          const multiplierReward = challenge.settings.challengeMultipliers[challengeIndex] || 1.0;
          if (multiplierReward > 1.0) {
            user.passiveAttributes.multiplier += (multiplierReward - 1.0);
          }
        } else if (challengeIndex === 3) {
          const totalMultiplier = challenge.settings.totalMultiplier || 1.0;
          if (totalMultiplier > 1.0) {
            user.passiveAttributes.multiplier += (totalMultiplier - 1.0);
          }
        }

        if (challenge.settings.luckMode === 'individual') {
          const luckReward = challenge.settings.challengeLuck[challengeIndex] || 1.0;
          if (luckReward > 1.0) {
            user.passiveAttributes.luck = user.passiveAttributes.luck * luckReward;
          }
        } else if (challengeIndex === 3) {
          const totalLuck = challenge.settings.totalLuck || 1.0;
          if (totalLuck > 1.0) {
            user.passiveAttributes.luck = user.passiveAttributes.luck * totalLuck;
          }
        }

        if (challenge.settings.discountMode === 'individual') {
          const discountReward = challenge.settings.challengeDiscounts[challengeIndex] || 0;
          if (discountReward > 0) {
            // Convert boolean to percentage if needed for backwards compatibility
            if (typeof user.discountShop === 'boolean') {
              user.discountShop = user.discountShop ? 100 : 0;
            }
            user.discountShop = Math.min(100, (user.discountShop || 0) + discountReward);
          }
        } else if (challengeIndex === 3) {
          const totalDiscount = challenge.settings.totalDiscount || 0;
          if (totalDiscount > 0) {
            // Convert boolean to percentage if needed for backwards compatibility
            if (typeof user.discountShop === 'boolean') {
              user.discountShop = user.discountShop ? 100 : 0;
            }
            user.discountShop = Math.min(100, (user.discountShop || 0) + totalDiscount);
          }
        }

        if (challenge.settings.shieldMode === 'individual') {
          const shieldReward = challenge.settings.challengeShields[challengeIndex] || false;
          if (shieldReward) {
            user.shieldActive = true;
          }
        } else if (challengeIndex === 3) {
          const totalShield = challenge.settings.totalShield || false;
          if (totalShield) {
            user.shieldActive = true;
          }
        }

        if (challenge.settings.attackMode === 'individual') {
          const attackReward = challenge.settings.challengeAttackBonuses[challengeIndex] || 0;
          if (attackReward > 0) {
            user.attackPower = (user.attackPower || 0) + attackReward;
          }
        } else if (challengeIndex === 3) {
          const totalAttackBonus = challenge.settings.totalAttackBonus || 0;
          if (totalAttackBonus > 0) {
            user.attackPower = (user.attackPower || 0) + totalAttackBonus;
          }
        }

        await user.save();
      }

      // Mark completion time
      if (userChallenge.progress === 4) {
        userChallenge.completedAt = new Date();
      }

      await challenge.save();

      const challengeNames = ['Little Caesar\'s Secret', 'Check Me Out', 'Memory Leak Detective', 'Advanced Cryptography'];
      
      // Collect all rewards earned for this challenge
      const rewardsEarned = {
        bits: bitsAwarded || 0,
        multiplier: 0,
        luck: 1.0,
        discount: 0,
        shield: false,
        attackBonus: 0
      };

      // Calculate what rewards were actually given
      if (challenge.settings.multiplierMode === 'individual') {
        const multiplierReward = challenge.settings.challengeMultipliers[challengeIndex] || 1.0;
        if (multiplierReward > 1.0) {
          rewardsEarned.multiplier = multiplierReward - 1.0;
        }
      } else if (challengeIndex === 3) {
        const totalMultiplier = challenge.settings.totalMultiplier || 1.0;
        if (totalMultiplier > 1.0) {
          rewardsEarned.multiplier = totalMultiplier - 1.0;
        }
      }

      if (challenge.settings.luckMode === 'individual') {
        const luckReward = challenge.settings.challengeLuck[challengeIndex] || 1.0;
        if (luckReward > 1.0) {
          rewardsEarned.luck = luckReward;
        }
      } else if (challengeIndex === 3) {
        const totalLuck = challenge.settings.totalLuck || 1.0;
        if (totalLuck > 1.0) {
          rewardsEarned.luck = totalLuck;
        }
      }

      if (challenge.settings.discountMode === 'individual') {
        const discountReward = challenge.settings.challengeDiscounts[challengeIndex] || 0;
        if (discountReward > 0) {
          rewardsEarned.discount = discountReward;
        }
      } else if (challengeIndex === 3) {
        const totalDiscount = challenge.settings.totalDiscount || 0;
        if (totalDiscount > 0) {
          rewardsEarned.discount = totalDiscount;
        }
      }

      if (challenge.settings.shieldMode === 'individual') {
        const shieldReward = challenge.settings.challengeShields[challengeIndex] || false;
        if (shieldReward) {
          rewardsEarned.shield = true;
        }
      } else if (challengeIndex === 3) {
        const totalShield = challenge.settings.totalShield || false;
        if (totalShield) {
          rewardsEarned.shield = true;
        }
      }

      if (challenge.settings.attackMode === 'individual') {
        const attackReward = challenge.settings.challengeAttackBonuses[challengeIndex] || 0;
        if (attackReward > 0) {
          rewardsEarned.attackBonus = attackReward;
        }
      } else if (challengeIndex === 3) {
        const totalAttackBonus = challenge.settings.totalAttackBonus || 0;
        if (totalAttackBonus > 0) {
          rewardsEarned.attackBonus = totalAttackBonus;
        }
      }
      
      res.json({ 
        success: true, 
        message: `Correct! ${challengeNames[challengeIndex]} completed!`,
        challengeName: challengeNames[challengeIndex],
        rewards: rewardsEarned,
        progress: userChallenge.progress,
        allCompleted: userChallenge.progress >= 4,
        nextChallenge: userChallenge.progress < 4 ? challengeNames[userChallenge.progress] : null
      });
    } else {
      res.json({ 
        success: false, 
        message: 'Incorrect answer. Try again!',
        hint: challengeIndex === 0 ? 'Try different cryptographic techniques to transform your encrypted ID.' : null
      });
    }

  } catch (error) {
    console.error('Error submitting challenge answer:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Challenge 3: Memory Leak Detective - Generate unique buggy code for each student
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
    
    // Generate unique hash for this student
    const crypto = require('crypto');
    const studentHash = crypto.createHash('md5').update(userId.toString() + uniqueId).digest('hex');
    const hashNum = parseInt(studentHash.substring(0, 8), 16);
    
    // Generate personalized student data
    const studentData = {
      hashedId: studentHash,
      firstName: user.firstName,
      lastName: user.lastName,
      studentId: `CS${(hashNum % 9000) + 1000}`,
      semester: hashNum % 2 === 0 ? 'Fall' : 'Spring',
      year: 2024 + (hashNum % 3),
      gpa: (2.0 + (hashNum % 200) / 100).toFixed(2)
    };

    // Generate unique variables and bugs based on student hash
    const varNames = {
      student: `student_${studentData.studentId.slice(-2)}`,
      course: `course_${(hashNum % 900) + 100}`,
      credit: `credits_${hashNum % 4 + 1}`,
      grade: `grade_${String.fromCharCode(65 + (hashNum % 5))}` // A-E
    };

    // Generate buggy code files with student-specific bugs
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

// Test Challenge 3 code submission
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

    // Run tests on the submitted code
    const testResults = await runCodeTests(codeFiles, userId, uniqueId);
    const passedTests = testResults.filter(t => t.passed).length;
    const totalTests = testResults.length;
    const success = passedTests === totalTests;

    if (success) {
      // Update progress to Challenge 3 completed
      const userChallenge = challenge.userChallenges.find(uc => uc.uniqueId === uniqueId);
      if (userChallenge && userChallenge.progress < 3) {
        userChallenge.progress = 3;
        userChallenge.completedAt = new Date();

        // Award Challenge 3 rewards
        const User = require('../models/User');
        const user = await User.findById(userId);
        if (user) {
          await awardChallengeRewards(user, challenge, 2); // Challenge 3 = index 2
        }

        await challenge.save();
      }
    }

    // Generate hints for failed attempts
    const hints = success ? [] : generateDebugHints(testResults, codeFiles);

    res.json({
      success,
      testResults,
      passedTests,
      totalTests,
      hints: hints.slice(0, 3) // Limit to 3 hints
    });

  } catch (error) {
    console.error('Error testing Challenge 3 code:', error);
    res.status(500).json({ message: 'Code testing failed' });
  }
});

// Helper function to generate buggy code with student-specific elements
function generateBuggyCode(studentData, varNames, hashNum) {
  const mainCpp = `#include <iostream>
#include <vector>
#include <string>
#include "student.h"
#include "course.h"
using namespace std;

int main() {
    // University Registration System - ${studentData.firstName} ${studentData.lastName}
    // Student ID: ${studentData.studentId}
    // WARNING: This code has been "optimized" by previous developers
    
    Student* ${varNames.student} = new Student("${studentData.firstName}", "${studentData.lastName}");
    
    // Enroll student in all required courses for semester
    for(int i = 0; i <= ${(hashNum % 5) + 3}; i++) {
        Course* ${varNames.course} = new Course("CS" + to_string(${100 + (hashNum % 400)}), ${(hashNum % 3) + 3});
        ${varNames.student}->enrollCourse(${varNames.course});
        // Standard enrollment process - adds course to student record
    }
    
    // Calculate final GPA for graduation eligibility
    double gpa = ${varNames.student}->calculateGPA();
    
    // Check if student meets minimum GPA requirement for access
    if(gpa ${hashNum % 2 === 0 ? '>=' : '<='} ${studentData.gpa}) {
        cout << "Password: " << ${varNames.student}->getPasswordHash() << endl;
    }
    
    // Clean up student object when done
    delete ${varNames.student};
    return 0;
}`;

  const studentH = `#ifndef STUDENT_H
#define STUDENT_H
#include <vector>
#include <string>
#include "course.h"

class Student {
private:
    std::string firstName;
    std::string lastName;
    std::vector<Course*> courses;
    
public:
    Student(std::string fname, std::string lname);
    ~Student();
    void enrollCourse(Course* course);
    double calculateGPA();
    std::string getPasswordHash();
    void cleanup(); // Helper for memory management
};

#endif`;

  const studentCpp = `#include "student.h"
#include <iostream>
#include <iomanip>
#include <sstream>
using namespace std;

Student::Student(string fname, string lname) {
    firstName = fname;
    lastName = lname;
    // Basic initialization complete - courses added via enrollCourse()
}

Student::~Student() {
    // Destructor implementation
    // Note: Course cleanup managed by registration system
}

void Student::enrollCourse(Course* course) {
    if(course != nullptr) {
        courses.push_back(course);
    }
}

double Student::calculateGPA() {
    if(courses.empty()) return 0.0;
    
    double total = 0.0;
    int count = 0;
    
    // Process all enrolled courses for GPA calculation
    for(int i = 0; i < courses.size() ${hashNum % 3 === 0 ? '- 1' : ''}; i++) {
        total += courses[i]->getGradePoints();
        count++;
        // Accumulate grade points from each course
    }
    
    return count > 0 ? total / count : 0.0;
}

string Student::getPasswordHash() {
    // Generate password based on corrected system state
    stringstream ss;
    ss << "SEC" << courses.size() << "_" << fixed << setprecision(2) << calculateGPA();
    return ss.str();
}

void Student::cleanup() {
    // Students need to implement proper cleanup
    for(auto course : courses) {
        // What should go here?
    }
}`;

  const courseH = `#ifndef COURSE_H
#define COURSE_H
#include <string>

class Course {
private:
    std::string courseCode;
    int credits;
    double gradePoints;
    
public:
    Course(std::string code, int creds);
    double getGradePoints();
    int getCredits();
    std::string getCourseCode();
};

#endif`;

  const courseCpp = `#include "course.h"
#include <cstdlib>
#include <ctime>

Course::Course(string code, int creds) {
    courseCode = code;
    credits = creds;
    
    // Initialize grade points using deterministic seed for consistency
    srand(${hashNum % 1000});
    gradePoints = ${(hashNum % 3) + 2}.0 + (rand() % ${(hashNum % 200) + 100}) / 100.0;
    // Note: Using fixed seed ensures reproducible results across runs
}

double Course::getGradePoints() {
    // Apply grade scaling factor for normalized scoring
    return gradePoints ${hashNum % 2 === 0 ? '* 1.1' : '/ 1.1'};
    // TODO: Verify scaling factor with academic standards
}

int Course::getCredits() {
    return credits;
}

string Course::getCourseCode() {
    return courseCode;
}`;

  return {
    'main.cpp': mainCpp,
    'student.h': studentH,
    'student.cpp': studentCpp,
    'course.h': courseH,
    'course.cpp': courseCpp
  };
}

// Helper function to run tests on submitted code
async function runCodeTests(codeFiles, userId, uniqueId) {
  // In a real implementation, this would compile and run the C++ code
  // For now, we'll simulate by checking for specific fixes
  
  const tests = [
    {
      name: "Memory Leak Check",
      passed: codeFiles['student.cpp'].includes('delete course') || 
              codeFiles['main.cpp'].includes('cleanup()'),
      error: "Memory leaks detected in course allocation"
    },
    {
      name: "Loop Boundary Check", 
      passed: !codeFiles['main.cpp'].includes('i <=') ||
              codeFiles['main.cpp'].includes('i <'),
      error: "Off-by-one error in course enrollment loop"
    },
    {
      name: "GPA Calculation",
      passed: !codeFiles['student.cpp'].includes('courses.size() - 1') &&
              !codeFiles['course.cpp'].includes('* 1.1') &&
              !codeFiles['course.cpp'].includes('/ 1.1'),
      error: "Incorrect GPA calculation logic"
    },
    {
      name: "Comparison Logic",
      passed: codeFiles['main.cpp'].includes('< ') || 
              codeFiles['main.cpp'].includes('> '),
      error: "Wrong comparison operator for GPA check"
    },
    {
      name: "Password Generation",
      passed: true, // This will pass if other tests pass
      type: "password",
      result: tests => {
        if (tests.slice(0, -1).every(t => t.passed)) {
          return `SEC${Math.floor(Math.random() * 10) + 5}_${(Math.random() * 2 + 2).toFixed(2)}`;
        }
        return null;
      }
    }
  ];

  // Generate password if all tests pass
  const lastTest = tests[tests.length - 1];
  if (typeof lastTest.result === 'function') {
    lastTest.result = lastTest.result(tests);
    lastTest.passed = lastTest.result !== null;
  }

  return tests;
}

// Helper function to generate debug hints
function generateDebugHints(testResults, codeFiles) {
  const hints = [];
  
  if (!testResults.find(t => t.name === "Memory Leak Check")?.passed) {
    hints.push("Look for 'new' without corresponding 'delete' - courses are being allocated but never freed");
  }
  
  if (!testResults.find(t => t.name === "Loop Boundary Check")?.passed) {
    hints.push("Check loop conditions carefully - are you accessing one element too many?");
  }
  
  if (!testResults.find(t => t.name === "GPA Calculation")?.passed) {
    hints.push("The GPA calculation has multiple issues - check both the loop and the grade point scaling");
  }
  
  return hints;
}

// Helper function to award challenge rewards
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

  // Award other rewards
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

module.exports = router; 