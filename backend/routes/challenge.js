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
    const currentChallengeDefinition = challenge.challengeDefinitions[currentChallengeIndex];
    
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
        linkedinUrl: currentChallengeDefinition.logicType === 'github-osint' ? currentChallengeDefinition.metadata.linkedinUrl : null
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
      
      challenge.settings = mergedSettings;
      challenge.isConfigured = true;
    } else {
      // Set default arrays if not provided
      const defaultSettings = {
        challengeBits: [50, 75, 100, 125],
        challengeMultipliers: [1.0, 1.0, 1.0, 1.0],
        challengeLuck: [0, 0, 0, 0],
        challengeDiscounts: [0, 0, 0, 0],
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
      
      const bitsAwarded = await awardChallengeBits(userId, 1, challenge);
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
      
      const bitsAwarded = await awardChallengeBits(userId, 2, challenge);
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
      if (user) {
        let bitsAwarded = 0;
        
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

        // Award other rewards (multiplier, luck, discount)
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
          const luckReward = challenge.settings.challengeLuck[challengeIndex] || 0;
          if (luckReward > 0) {
            user.passiveAttributes.luck += luckReward;
          }
        } else if (challengeIndex === 3) {
          const totalLuck = challenge.settings.totalLuck || 0;
          if (totalLuck > 0) {
            user.passiveAttributes.luck += totalLuck;
          }
        }

        if (challenge.settings.discountMode === 'individual') {
          const discountReward = challenge.settings.challengeDiscounts[challengeIndex] || 0;
          if (discountReward > 0) {
            user.discountShop = Math.min(100, (user.discountShop || 0) + discountReward);
          }
        } else if (challengeIndex === 3) {
          const totalDiscount = challenge.settings.totalDiscount || 0;
          if (totalDiscount > 0) {
            user.discountShop = Math.min(100, (user.discountShop || 0) + totalDiscount);
          }
        }

        await user.save();
      }

      // Mark completion time
      if (userChallenge.progress === 4) {
        userChallenge.completedAt = new Date();
      }

      await challenge.save();

      const challengeNames = ['Little Caesar\'s Secret', 'Check Me Out', 'Network Security Analysis', 'Advanced Cryptography'];
      
      res.json({ 
        success: true, 
        message: `Correct! ${challengeNames[challengeIndex]} completed!`,
        rewards: {
          bits: bitsAwarded || 0,
          progress: userChallenge.progress
        },
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

module.exports = router; 