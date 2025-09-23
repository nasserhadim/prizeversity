const express = require('express');
const router = express.Router();
const Challenge = require('../../models/Challenge');
const User = require('../../models/User');
const { ensureAuthenticated } = require('../../middleware/auth');
const { generateCppDebuggingChallenge, generateAndUploadForensicsImage, uploadLocks } = require('./generators');

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
    
    const challenge = await Challenge.findOne({ 
      'userChallenges.uniqueId': uniqueId,
      'userChallenges.userId': userId 
    });

    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    if (!challenge.isVisible) {
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
    
    res.json({
      studentData,
      cppChallenge: cppChallenge,
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

    if (userRole !== 'teacher' && !challenge.isVisible) {
      return res.status(403).json({ message: 'Challenge is temporarily unavailable' });
    }

    const userChallenge = challenge.userChallenges.find(uc => uc.uniqueId === uniqueId);
    if (!userChallenge) {
      return res.status(404).json({ message: 'User challenge not found' });
    }

    if (userChallenge.completedChallenges && userChallenge.completedChallenges[5]) {
      return res.json({
        isCompleted: true,
        message: 'Challenge 6 already completed'
      });
    }

    const { generateChallengeData } = require('../../utils/tokenGenerator');
    
    try {
      const challengeData = await generateChallengeData(uniqueId);
      
      res.json({
        generatedWord: challengeData.generatedWord,
        expectedTokenId: challengeData.expectedTokenId,
        validTokens: challengeData.validTokens,
        tokenData: challengeData.allTokenIds,
        uniqueId: uniqueId,
        sectorCode: uniqueId.substring(0, 8).toUpperCase(),
        isCompleted: false
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

    if (userRole !== 'teacher' && !challenge.isVisible) {
      return res.status(403).json({ message: 'Challenge is temporarily unavailable' });
    }

    const userChallenge = challenge.userChallenges.find(uc => uc.uniqueId === uniqueId);
    if (!userChallenge) {
      return res.status(404).json({ message: 'User challenge not found' });
    }

    if (userChallenge.completedChallenges && userChallenge.completedChallenges[6]) {
      return res.json({
        isCompleted: true,
        message: 'Challenge 7 already completed'
      });
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
        await challenge.save();
      } else if (userChallenge.challenge7Progress.totalWords !== uniqueWords.length) {
        userChallenge.challenge7Progress.totalWords = uniqueWords.length;
        challenge.markModified('userChallenges');
        await challenge.save();
      }
      
      console.log('📤 Sending Challenge 7 data for:', uniqueId, {
        hasProgress: !!userChallenge.challenge7Progress,
        progressData: userChallenge.challenge7Progress,
        wordsCount: hangmanData.words.length,
        uniqueWordsCount: uniqueWords.length
      });
      
      res.json({
        quote: hangmanData.quote,
        author: hangmanData.author,
        words: hangmanData.words,
        wordTokens: hangmanData.wordTokens,
        maskedQuote: hangmanData.maskedQuote,
        uniqueId: uniqueId,
        isCompleted: false,
        challenge7Progress: userChallenge.challenge7Progress
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
