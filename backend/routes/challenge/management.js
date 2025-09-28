const express = require('express');
const router = express.Router();
const Challenge = require('../../models/Challenge');
const Classroom = require('../../models/Classroom');
const User = require('../../models/User');
const { ensureAuthenticated, ensureTeacher } = require('../../middleware/auth');
const { createGitHubBranch } = require('./generators');
const { DEFAULT_CHALLENGE_SETTINGS } = require('./constants');

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

    if (!isTeacher && !challenge.isVisible) {
      return res.json({ 
        challenge: null, 
        userChallenge: null,
        isTeacher: false,
        hidden: true
      });
    }

    let needsSave = false;
    for (const userChallenge of challenge.userChallenges) {
      // Skip invalid entries (e.g. user deleted -> userId may be null)
      if (!userChallenge) continue;
      if (!userChallenge.userId) {
        console.warn(`[Challenge management] skipping userChallenge ${userChallenge.uniqueId} - missing userId`);
        continue;
      }

      if (!userChallenge.challenge2Password) {
        const { generateChallenge2Password } = require('./utils');
        userChallenge.challenge2Password = generateChallenge2Password(userChallenge.uniqueId);
        needsSave = true;
      }
      
      if (!userChallenge.challenge4Password) {
        const crypto = require('crypto');
        // userId may be populated object or raw id - normalize to string
        const studentIdStr = userChallenge.userId._id ? userChallenge.userId._id.toString() : userChallenge.userId.toString();
        const studentHash = crypto.createHash('md5').update(studentIdStr + userChallenge.uniqueId).digest('hex');
        userChallenge.challenge4Password = `FORENSICS_${studentHash.substring(0, 8).toUpperCase()}`;
        needsSave = true;
      }
    }
    
    if (needsSave) {
      await challenge.save();
    }

    const userChallenge = challenge.userChallenges.find(
      uc => {
        if (!uc || !uc.userId) return false;
        const ucUserIdStr = uc.userId._id ? uc.userId._id.toString() : uc.userId.toString();
        return ucUserIdStr === userId.toString();
      }
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

router.post('/:classroomId/toggle-visibility', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const userId = req.user._id;

    const classroom = await Classroom.findById(classroomId);
    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    if (classroom.teacher.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const challenge = await Challenge.findOne({ classroomId });
    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    challenge.isVisible = !challenge.isVisible;
    await challenge.save();

    res.json({ 
      success: true, 
      isVisible: challenge.isVisible,
      message: challenge.isVisible ? 'Challenge is now visible to students' : 'Challenge is now hidden from students'
    });

  } catch (error) {
    console.error('Error toggling challenge visibility:', error);
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

      if (!mergedSettings.challengeValidation) {
        mergedSettings.challengeValidation = createDefaultValidationSettings();
      }
      
      challenge.settings = mergedSettings;
      challenge.isConfigured = true;
    } else {
      const defaultSettings = {
        ...DEFAULT_CHALLENGE_SETTINGS,
        challengeValidation: createDefaultValidationSettings(),
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
    const { password } = req.body;
    const teacherId = req.user._id;

    if (!process.env.CHALLENGE_PASSWORD) {
      return res.status(500).json({ message: 'Challenge password not configured on server' });
    }

    if (!password || password !== process.env.CHALLENGE_PASSWORD) {
      return res.status(403).json({ message: 'Invalid challenge password' });
    }

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
        await createGitHubBranch(userChallenge.uniqueId, userChallenge.userId._id);
      } catch (error) {
        console.error(`Failed to create branch for ${userChallenge.uniqueId}:`, error.message);
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

router.put('/:classroomId/update', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const { title, challengeBits, totalRewardBits, rewardMode, challengeMultipliers, totalMultiplier, multiplierMode, challengeLuck, totalLuck, luckMode, challengeDiscounts, totalDiscount, discountMode, challengeShields, totalShield, shieldMode, challengeHints, challengeHintsEnabled, hintPenaltyPercent, maxHintsPerChallenge, dueDateEnabled, dueDate } = req.body;
    const teacherId = req.user._id;

    const classroom = await Classroom.findById(classroomId);
    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    if (classroom.teacher.toString() !== teacherId.toString()) {
      return res.status(403).json({ message: 'Only the classroom teacher can update challenges' });
    }

    const challenge = await Challenge.findOne({ classroomId });
    if (!challenge) {
      return res.status(404).json({ message: 'No challenge found for this classroom' });
    }

    if (title !== undefined) {
      challenge.title = title;
    }

    if (challengeBits !== undefined) {
      challenge.settings.challengeBits = challengeBits;
    }

    if (totalRewardBits !== undefined) {
      challenge.settings.totalRewardBits = totalRewardBits;
    }

    if (rewardMode !== undefined) {
      challenge.settings.rewardMode = rewardMode;
    }

    if (challengeMultipliers !== undefined) {
      challenge.settings.challengeMultipliers = challengeMultipliers;
    }

    if (totalMultiplier !== undefined) {
      challenge.settings.totalMultiplier = totalMultiplier;
    }

    if (multiplierMode !== undefined) {
      challenge.settings.multiplierMode = multiplierMode;
    }

    if (challengeLuck !== undefined) {
      challenge.settings.challengeLuck = challengeLuck;
    }

    if (totalLuck !== undefined) {
      challenge.settings.totalLuck = totalLuck;
    }

    if (luckMode !== undefined) {
      challenge.settings.luckMode = luckMode;
    }

    if (challengeDiscounts !== undefined) {
      challenge.settings.challengeDiscounts = challengeDiscounts;
    }

    if (totalDiscount !== undefined) {
      challenge.settings.totalDiscount = totalDiscount;
    }

    if (discountMode !== undefined) {
      challenge.settings.discountMode = discountMode;
    }

    if (challengeShields !== undefined) {
      challenge.settings.challengeShields = challengeShields;
    }

    if (totalShield !== undefined) {
      challenge.settings.totalShield = totalShield;
    }

    if (shieldMode !== undefined) {
      challenge.settings.shieldMode = shieldMode;
    }

    if (challengeHints !== undefined) {
      challenge.settings.challengeHints = challengeHints;
    }

    if (challengeHintsEnabled !== undefined) {
      challenge.settings.challengeHintsEnabled = challengeHintsEnabled;
    }

    if (hintPenaltyPercent !== undefined) {
      challenge.settings.hintPenaltyPercent = hintPenaltyPercent;
    }

    if (maxHintsPerChallenge !== undefined) {
      challenge.settings.maxHintsPerChallenge = maxHintsPerChallenge;
    }

    if (dueDateEnabled !== undefined) {
      challenge.settings.dueDateEnabled = dueDateEnabled;
    }

    if (dueDate !== undefined) {
      challenge.settings.dueDate = dueDateEnabled ? dueDate : null;
    }

    await challenge.save();

    res.json({ 
      message: 'Challenge updated successfully',
      challenge: {
        _id: challenge._id,
        title: challenge.title,
        settings: challenge.settings,
        isConfigured: challenge.isConfigured,
        isActive: challenge.isActive
      }
    });

  } catch (error) {
    console.error('Error updating challenge:', error);
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
        challenge4: challenge.userChallenges.filter(uc => uc.progress === 4).length,
        challenge5: challenge.userChallenges.filter(uc => uc.progress === 5).length,
        completed: challenge.userChallenges.filter(uc => uc.progress === 6).length
      }
    };

    res.json({ stats, challenge });

  } catch (error) {
    console.error('Error fetching challenge stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:challengeId/assign-student', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { challengeId } = req.params;
    const { studentId } = req.body;
    const teacherId = req.user._id;

    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    const classroom = await Classroom.findById(challenge.classroomId);
    if (!classroom || classroom.teacher.toString() !== teacherId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const existingAssignment = challenge.userChallenges.find(
      uc => uc.userId && uc.userId.toString() === studentId.toString()
    );
    
    if (existingAssignment) {
      return res.status(400).json({ message: 'Student already assigned to this challenge' });
    }

    const newUserChallenge = challenge.generateUserChallenge(studentId);
    challenge.userChallenges.push(newUserChallenge);
    
    await challenge.save();

    try {
      await createGitHubBranch(newUserChallenge.uniqueId, studentId);
    } catch (error) {
      console.error(`Failed to create GitHub branch for new student: ${error.message}`);
    }

    res.json({ 
      message: 'Student assigned to challenge successfully',
      userChallenge: newUserChallenge
    });

  } catch (error) {
    console.error('Error assigning student to challenge:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:classroomId/reset-student', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const { studentId } = req.body;
    const userId = req.user._id;

    if (!studentId) {
      return res.status(400).json({ message: 'Student ID is required' });
    }

    const classroom = await Classroom.findById(classroomId);
    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    if (classroom.teacher.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const challenge = await Challenge.findOne({ classroomId });
    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    const userChallengeIndex = challenge.userChallenges.findIndex(
      uc => uc.userId.toString() === studentId.toString()
    );

    if (userChallengeIndex === -1) {
      return res.status(404).json({ message: 'Student not found in challenge' });
    }

    const userChallenge = challenge.userChallenges[userChallengeIndex];
    
    userChallenge.progress = 0;
    userChallenge.currentChallenge = undefined;
    userChallenge.completedAt = undefined;
    userChallenge.startedAt = undefined;
    userChallenge.completedChallenges = [false, false, false, false, false, false, false];
    userChallenge.challengeCompletedAt = [];
    userChallenge.challengeStartedAt = [];
    userChallenge.bitsAwarded = 0;
    userChallenge.hintsUsed = [];
    userChallenge.hintsUnlocked = [];
    
    userChallenge.challenge2Password = undefined;
    userChallenge.challenge3Code = undefined;
    userChallenge.challenge3ExpectedOutput = undefined;
    userChallenge.challenge3BugDescription = undefined;
    userChallenge.challenge3StartTime = undefined;
    userChallenge.challenge3Attempts = 0;
    userChallenge.challenge4Password = undefined;
    userChallenge.challenge6Attempts = 0;
    userChallenge.challenge7Attempts = 0;
    userChallenge.challenge7Progress = {
      revealedWords: [],
      totalWords: 0
    };

    await challenge.save();

    res.json({ 
      success: true, 
      message: 'Student challenge progress reset successfully' 
    });

  } catch (error) {
    console.error('Error resetting student challenge:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:classroomId/reset-student-challenge', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const { studentId, challengeIndex } = req.body;
    const userId = req.user._id;

    if (!studentId) {
      return res.status(400).json({ message: 'Student ID is required' });
    }

    if (challengeIndex === undefined || challengeIndex < 0 || challengeIndex > 6) {
      return res.status(400).json({ message: 'Valid challenge index (0-6) is required' });
    }

    const classroom = await Classroom.findById(classroomId);
    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    if (classroom.teacher.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const challenge = await Challenge.findOne({ classroomId });
    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    const userChallengeIndex = challenge.userChallenges.findIndex(
      uc => uc.userId.toString() === studentId.toString()
    );

    if (userChallengeIndex === -1) {
      return res.status(404).json({ message: 'Student not found in challenge' });
    }

    const userChallenge = challenge.userChallenges[userChallengeIndex];
    
    if (!userChallenge.completedChallenges) {
      userChallenge.completedChallenges = [false, false, false, false, false, false, false];
    }
    
    userChallenge.completedChallenges[challengeIndex] = false;
    
    if (userChallenge.challengeCompletedAt && userChallenge.challengeCompletedAt[challengeIndex]) {
      userChallenge.challengeCompletedAt[challengeIndex] = null;
    }
    if (userChallenge.challengeStartedAt && userChallenge.challengeStartedAt[challengeIndex]) {
      userChallenge.challengeStartedAt[challengeIndex] = null;
    }
    
    if (userChallenge.hintsUsed && userChallenge.hintsUsed[challengeIndex]) {
      userChallenge.hintsUsed[challengeIndex] = 0;
    }
    if (userChallenge.hintsUnlocked && userChallenge.hintsUnlocked[challengeIndex]) {
      userChallenge.hintsUnlocked[challengeIndex] = [];
    }
    
    switch (challengeIndex) {
      case 1: 
        userChallenge.challenge2Password = undefined;
        break;
      case 2: 
        userChallenge.challenge3Code = undefined;
        userChallenge.challenge3ExpectedOutput = undefined;
        userChallenge.challenge3BugDescription = undefined;
        userChallenge.challenge3StartTime = undefined;
        userChallenge.challenge3Attempts = 0;
        break;
      case 3: 
        userChallenge.challenge4Password = undefined;
        break;
      case 5: 
        userChallenge.challenge6Attempts = 0;
        break;
      case 6: 
        userChallenge.challenge7Attempts = 0;
        userChallenge.challenge7Progress = {
          revealedWords: [],
          totalWords: 0
        };
        break;
    }
    
    
    userChallenge.progress = userChallenge.completedChallenges.filter(Boolean).length;
    
    const firstIncompleteIndex = userChallenge.completedChallenges.findIndex(completed => !completed);
    if (firstIncompleteIndex !== -1) {
      userChallenge.currentChallenge = firstIncompleteIndex;
    }
    
    if (userChallenge.progress < 7) {
      userChallenge.completedAt = undefined;
    }

    await challenge.save();

    const challengeNames = ['Challenge 1', 'Challenge 2', 'Challenge 3', 'Challenge 4', 'Challenge 5', 'Challenge 6', 'Challenge 7'];
    
    res.json({ 
      success: true, 
      message: `${challengeNames[challengeIndex]} reset successfully for student` 
    });

  } catch (error) {
    console.error('Error resetting specific student challenge:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

function createDefaultValidationSettings() {
  const crypto = require('crypto');
  return [
    {
      challengeIndex: 0,
      logicType: 'caesar-decrypt',
      metadata: {
        salt: process.env.CAESAR_SALT || 'default_salt_2024',
        algorithmParams: { 
          base: parseInt(process.env.CAESAR_BASE || '3'), 
          range: parseInt(process.env.CAESAR_RANGE || '6') 
        }
      }
    },
    {
      challengeIndex: 1,
      logicType: 'github-osint',
      metadata: {
        salt: 'secret_salt_2024',
        algorithmParams: { prefixes: ['ACCESS', 'TOKEN', 'KEY', 'SECRET', 'CODE'] }
      }
    },
    {
      challengeIndex: 2,
      logicType: 'cpp-debugging',
      metadata: {
        salt: 'cpp_debug_salt_2024',
        algorithmParams: {}
      }
    },
    {
      challengeIndex: 3,
      logicType: 'image-forensics',
      metadata: {
        salt: 'forensics_salt_2024',
        algorithmParams: {}
      }
    },
    {
      challengeIndex: 4,
      logicType: 'wayneaws-verification',
      metadata: {
        staticAnswerHash: crypto.createHash('sha256').update('WAYNEAWS_VERIFIED').digest('hex')
      }
    },
    {
      challengeIndex: 5,
      logicType: 'needle-in-haystack',
      metadata: {
        salt: 'haystack_salt_2024',
        algorithmParams: {},
        generatedWords: {},
        expectedTokenIds: {}
      }
    }
  ];
}

module.exports = router;
