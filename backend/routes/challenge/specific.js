const express = require('express');
const router = express.Router();
const Challenge = require('../../models/Challenge');
const User = require('../../models/User');                   // NEW
const Classroom = require('../../models/Classroom');         // NEW
const { ensureAuthenticated } = require('../../middleware/auth');
const { generateCppDebuggingChallenge, generateAndUploadForensicsImage, uploadLocks } = require('./generators');
const { awardXP } = require('../../utils/awardXP');          // NEW
const { calculateChallengeRewards } = require('./utils');    // NEW

// NEW helper: centralize per-challenge visibility logic
function isChallengeVisibleToUser(challenge, userRole, challengeIndex) {
  // teachers always see everything
  if (userRole === 'teacher') return true;

  // require the overall challenge to be visible
  if (challenge.isVisible === false) return false;

  // if there is an explicit per-challenge visibility array, deny when false
  const perVisible = challenge.settings?.challengeVisibility;
  if (Array.isArray(perVisible)) {
    // if index out-of-range, treat as visible (backwards compatible)
    if (typeof perVisible[challengeIndex] !== 'undefined') {
      return perVisible[challengeIndex] !== false;
    }
  }

  return true;
}

router.get('/challenge3/:uniqueId/teacher', ensureAuthenticated, async (req, res) => {
  try {
    const { uniqueId } = req.params;
    const teacherId = req.user._id;
    
    const challenge = await Challenge.findOne({ 
      'userChallenges.uniqueId': uniqueId
    });

    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found or not authorized' });
    }

    const userChallenge = challenge.userChallenges.find(uc => uc.uniqueId === uniqueId);
    if (!userChallenge) {
      return res.status(404).json({ message: 'User challenge not found' });
    }

    const studentUserId = userChallenge.userId;
    const user = await User.findById(studentUserId);
    if (!user) {
      console.warn(`[challenge3 teacher] user not found for id: ${studentUserId} (userChallenge: ${userChallenge._id})`);
      return res.status(404).json({ message: 'Student user not found for this challenge' });
    }
    // proceed safely now that user is confirmed non-null
    
    const crypto = require('crypto');
    const studentHash = crypto.createHash('md5').update(studentUserId.toString() + uniqueId).digest('hex');
    const hashNum = parseInt(studentHash.substring(0, 8), 16);
    
    const studentData = {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      year: user.year || 1,
      favoriteFood: user.favoriteFood || 'Pizza',
      petName: user.petName || 'Buddy',
      favoriteFruit: user.favoriteFruit || 'Apple',
      hash: hashNum,
      agentId: `AGENT-${studentHash.substring(0, 6).toUpperCase()}`
    };
    
    const cppChallenge = generateCppDebuggingChallenge(studentData, uniqueId);
    
    res.json({
      cppChallenge: cppChallenge,
      studentData
    });
  } catch (error) {
    console.error('Error in challenge3 teacher endpoint:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/challenge3/:uniqueId', ensureAuthenticated, async (req, res) => {
  try {
    const { uniqueId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    const challenge = await Challenge.findOne({ 
      'userChallenges.uniqueId': uniqueId,
      'userChallenges.userId': userId 
    });

    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    if (!isChallengeVisibleToUser(challenge, userRole, 2)) {
      return res.status(403).json({ message: 'Challenge is temporarily unavailable' });
    }

    const userChallenge = challenge.userChallenges.find(uc => uc.uniqueId === uniqueId);
    if (!userChallenge) {
      return res.status(404).json({ message: 'User challenge not found' });
    }

    const user = await User.findById(userId);
    
    const crypto = require('crypto');
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
    
    if (!userChallenge.challenge3ExpectedOutput) {
      userChallenge.challenge3ExpectedOutput = cppChallenge.actualOutput.toString();
      await challenge.save();
    }
    
    const safeCppChallenge = {
      missionId: cppChallenge.missionId,
      scenario: cppChallenge.scenario,
      agentId: cppChallenge.agentId,
      studentName: cppChallenge.studentName,
      cppCode: cppChallenge.cppCode,
      task: cppChallenge.task,
      securityNote: cppChallenge.securityNote,
      difficulty: cppChallenge.difficulty,
      timeLimit: cppChallenge.timeLimit
    };

    res.json({
      studentData,
      cppChallenge: safeCppChallenge,
      startTime: userChallenge.challenge3StartTime || null,
      attempts: userChallenge.challenge3Attempts || 0,
      maxAttempts: userChallenge.challenge3MaxAttempts || 5
    });

  } catch (error) {
    console.error('Error generating Challenge 3:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/challenge3/:uniqueId/start', ensureAuthenticated, async (req, res) => {
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

    if (!userChallenge.challenge3StartTime) {
      userChallenge.challenge3StartTime = new Date();
      await challenge.save();
    }

    res.json({
      success: true,
      startTime: userChallenge.challenge3StartTime,
      message: 'Challenge started successfully!'
    });

  } catch (error) {
    console.error('Error starting Challenge 3:', error);
    res.status(500).json({ message: 'Failed to start challenge' });
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
      const user = await User.findById(userId);
      
      const { filename } = await generateAndUploadForensicsImage(user, uniqueId);
      const imageUrl = `https://raw.githubusercontent.com/cinnamonstic/wsu-transit-delay/main/assets/${filename}`;
      
      userChallenge.forensicsImageUrl = imageUrl;
      await challenge.save();

      res.json({ 
        imageUrl,
        message: 'Digital forensics evidence generated successfully!'
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

    const user = await User.findById(userId);
    const filename = `campus_${uniqueId}.jpg`;
    
    if (uploadLocks.has(filename)) {
      return res.status(429).json({ message: 'Generation in progress, please wait...' });
    }

    const githubToken = process.env.GITHUB_TOKEN;
    const url = `https://api.github.com/repos/cinnamonstic/wsu-transit-delay/contents/assets/${filename}`;
    
    try {
      const axios = require('axios');
      const existingFile = await axios.get(url, {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      const imageUrl = `https://raw.githubusercontent.com/cinnamonstic/wsu-transit-delay/main/assets/${filename}`;
      res.json({ 
        imageUrl,
        message: 'Forensics image already exists and ready for analysis.'
      });
    } catch (checkError) {
      if (checkError.response?.status === 404) {
        uploadLocks.set(filename, true);
        try {
          const { filename: generatedFilename } = await generateAndUploadForensicsImage(user, uniqueId);
          const imageUrl = `https://raw.githubusercontent.com/cinnamonstic/wsu-transit-delay/main/assets/${generatedFilename}`;
          
          res.json({ 
            imageUrl,
            message: 'Digital forensics evidence generated successfully!'
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

router.get('/challenge6/:uniqueId', ensureAuthenticated, async (req, res) => {
  try {
    const { uniqueId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    let challenge;
    
    if (userRole === 'teacher') {
      challenge = await Challenge.findOne({
        'userChallenges.uniqueId': uniqueId,
        'createdBy': userId
      });
    } else {
      challenge = await Challenge.findOne({
        'userChallenges.uniqueId': uniqueId,
        'userChallenges.userId': userId
      });
    }

    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    if (!isChallengeVisibleToUser(challenge, userRole, 5)) {
      return res.status(403).json({ message: 'Challenge is temporarily unavailable' });
    }

    const userChallenge = challenge.userChallenges.find(uc => uc.uniqueId === uniqueId);
    if (!userChallenge) {
      return res.status(404).json({ message: 'User challenge not found' });
    }

    if (userRole !== 'teacher' && userChallenge.challenge6Attempts >= 3 && (!userChallenge.completedChallenges || !userChallenge.completedChallenges[5])) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (userChallenge.completedChallenges && userChallenge.completedChallenges[5]) {
      const { generateChallengeData } = require('../../utils/tokenGenerator');
      try {
        const challengeData = await generateChallengeData(uniqueId);
        
        return res.json({
          generatedWord: challengeData.generatedWord,
          uniqueId: uniqueId,
          sectorCode: uniqueId.substring(0, 8).toUpperCase(),
          isCompleted: true,
          message: 'Challenge 6 already completed'
        });
      } catch (error) {
        console.error('Error generating completed Challenge 6 data:', error);
        return res.json({
          isCompleted: true,
          message: 'Challenge 6 already completed',
          generatedWord: 'Error loading word',
          uniqueId: uniqueId,
          sectorCode: uniqueId.substring(0, 8).toUpperCase()
        });
      }
    }

    const { generateChallengeData } = require('../../utils/tokenGenerator');
    
    try {
      const challengeData = await generateChallengeData(uniqueId);
      
      res.json({
        generatedWord: challengeData.generatedWord,
        uniqueId: uniqueId,
        sectorCode: uniqueId.substring(0, 8).toUpperCase(),
        isCompleted: false,
        attemptsUsed: userChallenge.challenge6Attempts || 0,
        attemptsRemaining: Math.max(0, 3 - (userChallenge.challenge6Attempts || 0))
      });
    } catch (error) {
      console.error('Error generating Challenge 6 data:', error);
      res.status(500).json({ message: 'Failed to generate challenge data' });
    }

  } catch (error) {
    console.error('Error fetching Challenge 6 data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/challenge6/:uniqueId/teacher', ensureAuthenticated, async (req, res) => {
  try {
    const { uniqueId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    if (userRole !== 'teacher') {
      return res.status(403).json({ message: 'Access denied - teachers only' });
    }

    const challenge = await Challenge.findOne({
      'userChallenges.uniqueId': uniqueId,
      'createdBy': userId
    });

    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    const userChallenge = challenge.userChallenges.find(uc => uc.uniqueId === uniqueId);
    if (!userChallenge) {
      return res.status(404).json({ message: 'User challenge not found' });
    }

    const { generateChallengeData } = require('../../utils/tokenGenerator');
    
    try {
      const challengeData = await generateChallengeData(uniqueId);
      
      res.json({
        generatedWord: challengeData.generatedWord,
        expectedTokenId: challengeData.expectedTokenId,
        allTokenIds: challengeData.allTokenIds,
        validTokens: challengeData.validTokens,
        uniqueId: uniqueId,
        sectorCode: uniqueId.substring(0, 8).toUpperCase(),
        isCompleted: userChallenge.completedChallenges?.[5] || false,
        attemptsUsed: userChallenge.challenge6Attempts || 0,
        attemptsRemaining: Math.max(0, 3 - (userChallenge.challenge6Attempts || 0))
      });
    } catch (error) {
      console.error('Error generating Challenge 6 teacher data:', error);
      res.status(500).json({ message: 'Failed to generate challenge data' });
    }

  } catch (error) {
    console.error('Error fetching Challenge 6 teacher data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/challenge7/:uniqueId', ensureAuthenticated, async (req, res) => {
  try {
    const { uniqueId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    let challenge;
    
    if (userRole === 'teacher') {
      challenge = await Challenge.findOne({
        'userChallenges.uniqueId': uniqueId,
        'createdBy': userId
      });
    } else {
      challenge = await Challenge.findOne({
        'userChallenges.uniqueId': uniqueId,
        'userChallenges.userId': userId
      });
    }

    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    if (!isChallengeVisibleToUser(challenge, userRole, 6)) {
      return res.status(403).json({ message: 'Challenge is temporarily unavailable' });
    }

    const userChallenge = challenge.userChallenges.find(uc => uc.uniqueId === uniqueId);
    if (!userChallenge) {
      return res.status(404).json({ message: 'User challenge not found' });
    }

    if (userRole !== 'teacher' && userChallenge.challenge7Attempts >= 3 && (!userChallenge.completedChallenges || !userChallenge.completedChallenges[6])) {
      return res.status(401).json({ message: 'Challenge failed - maximum attempts reached' });
    }

    if (userChallenge.completedChallenges && userChallenge.completedChallenges[6]) {
      const { generateHangmanData } = require('../../utils/quoteGenerator');
      try {
        const hangmanData = await generateHangmanData(uniqueId);
        const uniqueWords = [...new Set(hangmanData.words.map(w => w.toLowerCase()))];
        
        return res.json({
          quote: hangmanData.quote,
          author: hangmanData.author,
          words: hangmanData.words,
          maskedQuote: hangmanData.maskedQuote,
          uniqueId: uniqueId,
          isCompleted: true,
          message: 'Challenge 7 already completed',
          challenge7Progress: userChallenge.challenge7Progress || {
            revealedWords: uniqueWords,
            totalWords: uniqueWords.length
          }
        });
      } catch (error) {
        console.error('Error generating completed Challenge 7 data:', error);
        return res.json({
          isCompleted: true,
          message: 'Challenge 7 already completed',
          quote: 'Error loading quote data',
          author: 'Error',
          words: [],
          uniqueId: uniqueId
        });
      }
    }

    const { generateHangmanData } = require('../../utils/quoteGenerator');
    
    try {
      const hangmanData = await generateHangmanData(uniqueId);
      const uniqueWords = [...new Set(hangmanData.words.map(w => w.toLowerCase()))];
      
      if (!userChallenge.challenge7Progress) {
        userChallenge.challenge7Progress = {
          revealedWords: [],
          totalWords: uniqueWords.length
        };
        challenge.markModified('userChallenges');
        try {
          await challenge.save();
        } catch (saveError) {
          if (saveError.name === 'VersionError') {
            console.log('⚠️ Version conflict detected, refetching and retrying...');
            const freshChallenge = await Challenge.findOne({
              'userChallenges.uniqueId': uniqueId,
              'createdBy': userRole === 'teacher' ? userId : undefined,
              'userChallenges.userId': userRole !== 'teacher' ? userId : undefined
            });
            const freshUserChallenge = freshChallenge.userChallenges.find(uc => uc.uniqueId === uniqueId);
            if (!freshUserChallenge.challenge7Progress) {
              freshUserChallenge.challenge7Progress = {
                revealedWords: [],
                totalWords: uniqueWords.length
              };
              freshChallenge.markModified('userChallenges');
              await freshChallenge.save();
            }
          } else {
            throw saveError;
          }
        }
      } else if (userChallenge.challenge7Progress.totalWords !== uniqueWords.length) {
        userChallenge.challenge7Progress.totalWords = uniqueWords.length;
        challenge.markModified('userChallenges');
        try {
          await challenge.save();
        } catch (saveError) {
          if (saveError.name === 'VersionError') {
            console.log('⚠️ Version conflict detected during update, continuing without save...');
          } else {
            throw saveError;
          }
        }
      }
      
      console.log('📤 Sending Challenge 7 data for:', uniqueId, {
        hasProgress: !!userChallenge.challenge7Progress,
        progressData: userChallenge.challenge7Progress,
        wordsCount: hangmanData.words.length,
        uniqueWordsCount: uniqueWords.length,
        quote: hangmanData.quote,
        author: hangmanData.author,
        hasQuote: !!hangmanData.quote,
        hasAuthor: !!hangmanData.author
      });

      res.json({
        quote: hangmanData.quote,
        author: hangmanData.author,
        words: hangmanData.words,
        maskedQuote: hangmanData.maskedQuote,
        uniqueId: uniqueId,
        isCompleted: false,
        challenge7Progress: userChallenge.challenge7Progress,
        totalAttempts: userChallenge.challenge7Attempts || 0,
      });
    } catch (error) {
      console.error('Error generating Challenge 7 data:', error);
      res.status(500).json({ message: 'Failed to generate challenge data' });
    }

  } catch (error) {
    console.error('Error fetching Challenge 7 data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/challenge7/:uniqueId/teacher', ensureAuthenticated, async (req, res) => {
  try {
    const { uniqueId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    if (userRole !== 'teacher') {
      return res.status(403).json({ message: 'Access denied - teachers only' });
    }

    const challenge = await Challenge.findOne({
      'userChallenges.uniqueId': uniqueId,
      'createdBy': userId
    });

    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    const userChallenge = challenge.userChallenges.find(uc => uc.uniqueId === uniqueId);
    if (!userChallenge) {
      return res.status(404).json({ message: 'User challenge not found' });
    }

    const { generateHangmanData } = require('../../utils/quoteGenerator');
    
    try {
      const hangmanData = await generateHangmanData(uniqueId);
      const uniqueWords = [...new Set(hangmanData.words.map(w => w.toLowerCase()))];
      
      res.json({
        quote: hangmanData.quote,
        author: hangmanData.author,
        words: hangmanData.words,
        wordTokens: hangmanData.wordTokens,
        uniqueWords: uniqueWords,
        maskedQuote: hangmanData.maskedQuote,
        uniqueId: uniqueId,
        isCompleted: userChallenge.completedChallenges?.[6] || false,
        challenge7Progress: userChallenge.challenge7Progress,
        totalAttempts: userChallenge.challenge7Attempts || 0
      });
    } catch (error) {
      console.error('Error generating Challenge 7 teacher data:', error);
      res.status(500).json({ message: 'Failed to generate challenge data' });
    }

  } catch (error) {
    console.error('Error fetching Challenge 7 teacher data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// NEW: local helper to grant XP for bits/stat boosts/completion
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
    console.warn('[teacher-complete] awardChallengeXP failed:', e);
  }
}

// Challenge 6: teacher "Skip to Completion"
router.post('/challenge6/:uniqueId/complete', ensureAuthenticated, async (req, res) => {
  try {
    const { uniqueId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    if (userRole !== 'teacher') {
      return res.status(403).json({ message: 'Only teachers can complete challenges for students' });
    }

    const challenge = await Challenge.findOne({
      'userChallenges.uniqueId': uniqueId,
      'createdBy': userId
    });

    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    const userChallenge = challenge.userChallenges.find(uc => uc.uniqueId === uniqueId);
    if (!userChallenge) {
      return res.status(404).json({ message: 'User challenge not found' });
    }

    if (userChallenge.completedChallenges && userChallenge.completedChallenges[5]) {
      return res.json({ message: 'Challenge 6 already completed' });
    }

    if (!userChallenge.completedChallenges) {
      userChallenge.completedChallenges = {};
    }
    userChallenge.completedChallenges[5] = true;

    if (!userChallenge.challengeCompletedAt) {
      userChallenge.challengeCompletedAt = {};
    }
    userChallenge.challengeCompletedAt[5] = new Date();

    if (userChallenge.progress === 5) {
      userChallenge.progress = 6;
    }

    // NEW: compute rewards and award XP
    const studentId = userChallenge.userId;
    const user = await User.findById(studentId);
    if (user) {
      const rewards = calculateChallengeRewards(user, challenge, 5, userChallenge);
      await user.save();

      // persist rewards for this challenge entry
      if (!userChallenge.challengeRewards) userChallenge.challengeRewards = {};
      userChallenge.challengeRewards[5] = rewards;

      await awardChallengeXP({
        userId: user._id,
        classroomId: challenge.classroomId,
        rewards
      });
    }

    challenge.markModified('userChallenges');
    await challenge.save();

    res.json({ message: 'Challenge 6 completed successfully' });

  } catch (error) {
    console.error('Error completing Challenge 6:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Challenge 7: teacher "Skip to Completion"
router.post('/challenge7/:uniqueId/complete', ensureAuthenticated, async (req, res) => {
  try {
    const { uniqueId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    if (userRole !== 'teacher') {
      return res.status(403).json({ message: 'Only teachers can complete challenges for students' });
    }

    const challenge = await Challenge.findOne({
      'userChallenges.uniqueId': uniqueId,
      'createdBy': userId
    });

    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    const userChallenge = challenge.userChallenges.find(uc => uc.uniqueId === uniqueId);
    if (!userChallenge) {
      return res.status(404).json({ message: 'User challenge not found' });
    }

    if (userChallenge.completedChallenges && userChallenge.completedChallenges[6]) {
      return res.json({ message: 'Challenge 7 already completed' });
    }

    const { generateHangmanData } = require('../../utils/quoteGenerator');
    const hangmanData = await generateHangmanData(uniqueId);
    const uniqueWords = [...new Set(hangmanData.words.map(w => w.toLowerCase()))];

    if (!userChallenge.completedChallenges) {
      userChallenge.completedChallenges = {};
    }
    userChallenge.completedChallenges[6] = true;

    if (!userChallenge.challengeCompletedAt) {
      userChallenge.challengeCompletedAt = {};
    }
    userChallenge.challengeCompletedAt[6] = new Date();

    if (!userChallenge.challenge7Progress) {
      userChallenge.challenge7Progress = {
        revealedWords: uniqueWords,
        totalWords: uniqueWords.length
      };
    } else {
      userChallenge.challenge7Progress.revealedWords = uniqueWords;
    }

    if (userChallenge.progress === 6) {
      userChallenge.progress = 7;
      userChallenge.completedAt = new Date();
    }

    // NEW: compute rewards and award XP
    {
      const studentId = userChallenge.userId;
      const user = await User.findById(studentId);
      if (user) {
        const rewards = calculateChallengeRewards(user, challenge, 6, userChallenge);
        await user.save();

        if (!userChallenge.challengeRewards) userChallenge.challengeRewards = {};
        userChallenge.challengeRewards[6] = rewards;

        await awardChallengeXP({
          userId: user._id,
          classroomId: challenge.classroomId,
          rewards
        });
      }
    }

    challenge.markModified('userChallenges');
    await challenge.save();

    res.json({ message: 'Challenge 7 completed successfully' });

  } catch (error) {
    console.error('Error completing Challenge 7:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/check-completion/:uniqueId/:challengeIndex', ensureAuthenticated, async (req, res) => {
  try {
    const { uniqueId, challengeIndex } = req.params;
    const userId = req.user._id;
    const index = parseInt(challengeIndex);

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

    const isCompleted = userChallenge.completedChallenges && userChallenge.completedChallenges[index];

    res.json({ isCompleted: !!isCompleted });

  } catch (error) {
    console.error('Error checking challenge completion:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/challenge-data/:classroomId', ensureAuthenticated, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const userId = req.user._id;

    console.log('Fetching classroom with ID:', classroomId);

    // Fetch classroom data separately
    const Classroom = require('../../models/Classroom');
    const classroom = await Classroom.findById(classroomId).select('name code');
    console.log('Found classroom:', classroom);

    const challenge = await Challenge.findOne({ classroomId });
    console.log('Found challenge:', !!challenge);
    
    if (!challenge) {
      return res.json({ 
        challenge: null, 
        classroom: classroom,
        userChallenge: null 
      });
    }

    const userChallenge = challenge.userChallenges.find(uc => uc.userId.toString() === userId.toString());

    const challengeData = {
      uniqueId: challenge.uniqueId,
      classroomId: challenge.classroomId,
      description: challenge.description,
      createdAt: challenge.createdAt,
      updatedAt: challenge.updatedAt,
      userId: challenge.userId,
      userChallenges: challenge.userChallenges.map(uc => ({
        uniqueId: uc.uniqueId,
        userId: uc.userId,
        challenge1StartTime: uc.challenge1StartTime,
        challenge1Attempts: uc.challenge1Attempts,
        challenge1MaxAttempts: uc.challenge1MaxAttempts,
        challenge2StartTime: uc.challenge2StartTime,
        challenge2Attempts: uc.challenge2Attempts,
        challenge2MaxAttempts: uc.challenge2MaxAttempts,
        challenge3StartTime: uc.challenge3StartTime,
        challenge3Attempts: uc.challenge3Attempts,
        challenge3MaxAttempts: uc.challenge3MaxAttempts,
        completedChallenges: uc.completedChallenges
      }))
    };

    res.json({
      challenge: challengeData,
      classroom: classroom,
      userChallenge,
      isTeacher: challenge.userId.toString() === userId.toString()
    });

  } catch (error) {
    console.error('Error fetching challenge data:', error);
    res.status(500).json({ error: 'Failed to fetch challenge data' });
  }
});

module.exports = router;
