const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Classroom = require('../models/Classroom');


function ensureTeacherOrAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.user.role === 'teacher' || req.user.role === 'admin') return next();
  return res.status(403).json({ error: 'Forbidden' });
}

const { awardXP } = require('../utils/xp');


// Simple test route to confirm XP route is connected
router.get('/test', (req, res) => {
  res.json({ message: 'XP route connected successfully' });
});


//adding xp now uses awardXP() instead of manaual xp math
router.post('/add', ensureTeacherOrAdmin, async (req, res) => {
  try {
    const { userId, classroomId, xpToAdd } = req.body;

    if (!userId || !classroomId || typeof xpToAdd !== 'number' || xpToAdd <= 0) {
      return res.status(400).json({ error: 'Invalid input data' });
    }

    const result = await awardXP({
      userId,
      classroomId,
      opts: { rawXP: xpToAdd }
    });
    const io = req.app.get('io');
    if (io) {
      io.emit('xp:update', {
        userId,
        classroomId,
        newXP: result.xp,
        newLevel: result.level,
        leveledUp: result.leveled
      });
    }
    
    if (!result.ok) {
      return res.status(400).json({ error: result.reason || 'Failed to add XP' });
    }
    res.json({
      message: result.leveled
        ? `Level up! Now level ${result.level}.`
        : `+${result.added} XP added.`,
      level: result.level,
      currentXP: result.xp
    });
  } catch (err) {
    console.error('Error adding XP:', err);
    res.status(500).json({ error: 'Server error adding XP' });
  }
});



// Update classroom XP settings (Teacher only)

router.put('/config/:classroomId', ensureTeacherOrAdmin, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const { dailyLogin, groupJoin } = req.body;

    const classroom = await Classroom.findById(classroomId);
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    if (dailyLogin && (typeof dailyLogin !== 'number' || dailyLogin < 0)) {
      return res.status(400).json({ error: 'Invalid XP value for dailyLogin' });
    }
    if (groupJoin && (typeof groupJoin !== 'number' || groupJoin < 0)) {
      return res.status(400).json({ error: 'Invalid XP value for groupJoin' });
    }

    if (dailyLogin !== undefined) classroom.xpConfig.dailyLogin = dailyLogin;
    if (groupJoin !== undefined) classroom.xpConfig.groupJoin = groupJoin;

    await classroom.save();

    res.json({
      message: 'XP configuration updated successfully.',
      xpConfig: classroom.xpConfig
    });
  } catch (err) {
    console.error('Error updating XP config:', err);
    res.status(500).json({ error: 'Server error updating XP config' });
  }
});

// Rewritten: test add XP (teacher/admin only)
// Now calls awardXP() for consistency with formulas + guards
router.post('/test/add', ensureTeacherOrAdmin, async (req, res) => {
  try {
    let { userId, classroomId, xpToAdd = 100 } = req.body;

    const result = await awardXP({
      userId,
      classroomId,
      opts: { rawXP: xpToAdd }
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('xp:update', {
        userId,
        classroomId,
        newXP: result.xp,
        newLevel: result.level,
        leveledUp: result.leveled
      });
    }

    if (!result.ok) {
      return res.status(400).json({ error: result.reason || 'Failed to add XP' });
    }

    res.json({
      message: result.leveled
        ? `+${result.added} XP — Level Up! Now level ${result.level}.`
        : `+${result.added} XP added successfully.`,
      level: result.level,
      currentXP: result.xp
    });
  } catch (err) {
    console.error('Error in XP test/add route:', err);
    res.status(500).json({ error: 'Server error adding XP for testing' });
  }
});
// Rewritten: reset XP/level simplified and clarified
router.post('/test/reset', ensureTeacherOrAdmin, async (req, res) => {
  try {
    let { userId, classroomId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!classroomId) {
      if (user.classroomBalances.length > 0) {
        classroomId = user.classroomBalances[0].classroom;
      } else {
        return res.status(400).json({ error: 'User is not part of any classroom.' });
      }
    }

    const classroomData = user.classroomBalances.find(
      c => c.classroom.toString() === classroomId.toString()
    );
    if (!classroomData) {
      return res.status(400).json({ error: 'User not found in this classroom.' });
    }

    classroomData.xp = 0;
    classroomData.level = 1;
    await user.save();

    res.json({
      message: 'XP and level reset successfully.',
      classroomData
    });
  } catch (err) {
    console.error('Error in XP test/reset route:', err);
    res.status(500).json({ error: 'Server error resetting XP' });
  }
});



module.exports = router;
