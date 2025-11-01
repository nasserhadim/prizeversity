const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Classroom = require('../models/Classroom');

const Badge = require('../models/Badge');

// check and award level-based badges
async function awardLevelBadges(user, classroomId) {
  const classroomData = user.classroomBalances.find(
    c => c.classroom.toString() === classroomId.toString()
  );
  if (!classroomData) return;

  const currentLevel = classroomData.level;

  // badges available for this classroom and level
  const badges = await Badge.find({
    classroom: classroomId,
    levelRequired: { $lte: currentLevel }
  });

  // badges user already has
  const earned = new Set(
    classroomData.badges?.map(b => b.badge.toString())
  );

  const newBadges = badges.filter(b => !earned.has(b._id.toString()));

  if (newBadges.length === 0) return;

  // add new badges
  newBadges.forEach(b => {
    classroomData.badges.push({
      badge: b._id,
      dateEarned: new Date()
    });
  });

  await user.save();

  console.log('Awarded badges:', newBadges.map(b => b.name));
}

// Simple test route to confirm XP route is connected
router.get('/test', (req, res) => {
  res.json({ message: 'XP route connected successfully' });
});

// Add XP to a student with validation and improved error handling
router.post('/add', async (req, res) => {
  try {
    const { userId, classroomId, xpToAdd } = req.body;

    // Validate request data
    if (!userId || !classroomId || typeof xpToAdd !== 'number' || xpToAdd <= 0) {
      return res.status(400).json({ error: 'Invalid input data' });
    }

    // Find the student
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Find or create classroom balance entry
    let classroomData = user.classroomBalances.find(
      c => c.classroom.toString() === classroomId.toString()
    );

    if (!classroomData) {
      console.log("⚠️ No classroom match for classroomId:", classroomId);
      console.log("Existing classroomBalances:", user.classroomBalances.map(cb => cb.classroom?.toString()));
    }

    if (!classroomData) {
      user.classroomBalances.push({
        classroom: classroomId,
        balance: 0,
        xp: 0,
        level: 1
      });
      classroomData = user.classroomBalances.find(
        c => c.classroom.toString() === classroomId.toString()
      );
    }

    // Add XP
    classroomData.xp += xpToAdd;

    // Determine if the student leveled up
    let leveledUp = false;
    const xpNeeded = classroomData.level * 100;

    if (classroomData.xp >= xpNeeded) {
      classroomData.level += 1;
      classroomData.xp -= xpNeeded;
      leveledUp = true;
    }

    if (leveledUp) {
      await awardLevelBadges(user, classroomId);
    }

    await user.save();

    // Return result
    res.json({
      message: leveledUp
        ? `Level up! You are now level ${classroomData.level}`
        : 'XP updated successfully',
      classroomData
    });

  } catch (err) {
    console.error('Error updating XP:', err.message);
    res.status(500).json({ error: 'Server error updating XP' });
  }
});

// Update classroom XP settings (Teacher only)
router.put('/config/:classroomId', async (req, res) => {
  try {
    const { classroomId } = req.params;
    const { dailyLogin, groupJoin } = req.body;

    const classroom = await Classroom.findById(classroomId);
    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    // Validation
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
      message: 'XP configuration updated successfully',
      xpConfig: classroom.xpConfig,
    });
  } catch (err) {
    console.error('Error updating XP config:', err.message);
    res.status(500).json({ error: 'Server error updating XP config' });
  }
});

// Temporary test route to manually add XP
// This is not permanent code, just for testing purposes during development
router.post('/test/add', async (req, res) => {
  try {
    let { userId, classroomId, xpToAdd = 100 } = req.body;

    // Find the user
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // If no classroomId provided, use the first classroom the user is in
    if (!classroomId) {
      if (user.classroomBalances.length > 0) {
        classroomId = user.classroomBalances[0].classroom;
      } else {
        return res.status(400).json({ error: 'User is not part of any classroom.' });
      }
    }
    // Find or create classroom data entry
    let classroomData = user.classroomBalances.find(
      c => c.classroom.toString() === classroomId.toString()
    );

    if (!classroomData) {
      classroomData = {
        classroom: classroomId,
        balance: 0,
        xp: 0,
        level: 1
      };
      user.classroomBalances.push(classroomData);
    }

    // Add XP
    classroomData.xp += xpToAdd;

    // Handle level up
    const xpNeeded = classroomData.level * 100;
    let leveledUp = false;

    if (classroomData.xp >= xpNeeded) {
      classroomData.level += 1;
      classroomData.xp -= xpNeeded;
      leveledUp = true;
    }

    if (leveledUp) {
      await awardLevelBadges(user, classroomId);
    }

    await user.save();

    // Response
    res.json({
      message: leveledUp
        ? `+${xpToAdd} XP — Level Up! You are now level ${classroomData.level}.`
        : `+${xpToAdd} XP added successfully.`,
      classroomData
    });

  } catch (err) {
    console.error('Error in XP test/add route:', err.message);
    res.status(500).json({ error: 'Server error adding XP for testing' });
  }
});


// Temporary test route to reset XP and level
// This is not permanent code, just for testing purposes during development
router.post('/test/reset', async (req, res) => {
  try {
    let { userId, classroomId } = req.body;

    // Find the user
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // if no classroomId provided, use the first classroom the user is in
    if (!classroomId) {
      if (user.classroomBalances.length > 0) {
        classroomId = user.classroomBalances[0].classroom;
      } else {
        return res.status(400).json({ error: 'User is not part of any classroom.' });
      }
    }

    // Find classroom data
    const classroomData = user.classroomBalances.find(
      c => c.classroom.toString() === classroomId.toString()
    );

    if (!classroomData) {
      return res
        .status(400)
        .json({ error: 'User not found in specified classroom' });
    }

    // Reset XP and level
    classroomData.xp = 0;
    classroomData.level = 1;

    await user.save();

    res.json({
      message: 'XP and level reset successfully.',
      classroomData
    });
  } catch (err) {
    console.error('Error in XP test/reset route:', err.message);
    res.status(500).json({ error: 'Server error resetting XP' });
  }
});







module.exports = router;
