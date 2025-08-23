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

    let needsSave = false;
    for (const userChallenge of challenge.userChallenges) {
      if (!userChallenge.challenge2Password) {
        const { generateChallenge2Password } = require('./utils');
        userChallenge.challenge2Password = generateChallenge2Password(userChallenge.uniqueId);
        needsSave = true;
      }
      
      if (!userChallenge.challenge4Password) {
        const crypto = require('crypto');
        const studentHash = crypto.createHash('md5').update(userChallenge.userId.toString() + userChallenge.uniqueId).digest('hex');
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
        completedAt: progress >= 7 ? new Date() : null
      };
      
      challenge.userChallenges.push(userChallenge);
    } else {
      userChallenge.progress = parseInt(progress);
      userChallenge.completedAt = progress >= 4 ? new Date() : null;
    }

    await challenge.save();

    const user = await User.findById(userId);
    if (user && progress > 0) {
      for (let i = 0; i < progress; i++) {
        const baseBits = (challenge.settings.challengeBits || [])[i] || 0;
        user.balance = (user.balance || 0) + baseBits;
      }
      await user.save();
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
