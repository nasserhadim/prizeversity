const express = require('express');
const router = express.Router();
const Challenge = require('../../models/Challenge');
const User = require('../../models/User');
const { ensureAuthenticated } = require('../../middleware/auth');
const { generateHashBreakingChallenge, generateCppDebuggingChallenge, generateAndUploadForensicsImage, uploadLocks } = require('./generators');

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

module.exports = router;
