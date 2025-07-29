const express = require('express');
const router = express.Router();
const Challenge = require('../models/Challenge');
const Classroom = require('../models/Classroom');
const { ensureAuthenticated, ensureTeacher } = require('../middleware/auth');

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

    if (isTeacher) {
      return res.json({ 
        challenge,
        userChallenge: null,
        isTeacher: true
      });
    }

    const userChallenge = challenge.userChallenges.find(
      uc => uc.userId._id.toString() === userId.toString()
    );

    res.json({ 
      challenge: {
        _id: challenge._id,
        title: challenge.title,
        description: challenge.description,
        isActive: challenge.isActive
      },
      userChallenge,
      isTeacher: false
    });

  } catch (error) {
    console.error('Error fetching challenge:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/challenges/:classroomId/initiate - Initiate challenge for classroom (Teacher only)
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
    
    if (challenge && challenge.isActive) {
      return res.status(400).json({ message: 'Challenge is already active for this classroom' });
    }

    const userChallenges = classroom.students.map(student => ({
      userId: student._id
    }));

    if (challenge) {
      challenge.isActive = true;
      challenge.userChallenges = userChallenges;
      challenge.updatedAt = Date.now();
    } else {
      challenge = new Challenge({
        classroomId,
        createdBy: teacherId,
        isActive: true,
        userChallenges
      });
    }

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

module.exports = router; 