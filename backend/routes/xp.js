const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureTeacher } = require('../middleware/auth'); // Changed from '../config/auth'
const Classroom = require('../models/Classroom');
const User = require('../models/User');
const { calculateNextLevelProgress } = require('../utils/xp');

// GET XP settings for classroom (teacher only)
router.get('/classroom/:classroomId/settings', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { classroomId } = req.params;

    const classroom = await Classroom.findById(classroomId).select('xpSettings teacher');
    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    if (classroom.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json(classroom.xpSettings || {});
  } catch (err) {
    console.error('Error fetching XP settings:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH update XP settings (teacher only)
router.patch('/classroom/:classroomId/settings', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const updates = req.body;

    const classroom = await Classroom.findById(classroomId);
    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    if (classroom.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only the teacher can update XP settings' });
    }

    // Update XP settings
    classroom.xpSettings = {
      ...classroom.xpSettings,
      ...updates
    };

    await classroom.save();

    res.json({ message: 'XP settings updated successfully', xpSettings: classroom.xpSettings });
  } catch (err) {
    console.error('Error updating XP settings:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET user's XP and level in classroom
router.get('/classroom/:classroomId/user/:userId', ensureAuthenticated, async (req, res) => {
  try {
    const { classroomId, userId } = req.params;

    const user = await User.findById(userId).select('classroomXP firstName lastName email');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const classroom = await Classroom.findById(classroomId).select('xpSettings');
    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    const classroomXP = user.classroomXP.find(
      cx => cx.classroom.toString() === classroomId.toString()
    );

    if (!classroomXP) {
      return res.json({
        xp: 0,
        level: 1,
        earnedBadges: [],
        nextLevelProgress: {
          xpForCurrentLevel: 0,
          xpForNextLevel: classroom.xpSettings.baseXPForLevel2 || 100,
          xpNeeded: classroom.xpSettings.baseXPForLevel2 || 100,
          xpInCurrentLevel: 0,
          xpRequiredForLevel: classroom.xpSettings.baseXPForLevel2 || 100,
          progress: 0
        }
      });
    }

    const progress = calculateNextLevelProgress(
      classroomXP.xp,
      classroomXP.level,
      classroom.xpSettings.levelingFormula,
      classroom.xpSettings.baseXPForLevel2
    );

    res.json({
      xp: classroomXP.xp,
      level: classroomXP.level,
      earnedBadges: classroomXP.earnedBadges,
      nextLevelProgress: progress
    });
  } catch (err) {
    console.error('Error fetching user XP:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;