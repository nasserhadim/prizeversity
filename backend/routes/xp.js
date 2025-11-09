const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Classroom = require('../models/Classroom');

const Badge = require('../models/Badge');

// check and award level-based badges
async function awardLevelBadges(user, classroomId) {
  // Find the classroom record for this user
  const classroomData = user.classroomBalances.find(c => {
    const cId = c.classroom?._id?.toString() || c.classroom?.toString();
    return cId === classroomId.toString();
  });

  if (!classroomData) {
    console.log("⚠️ No classroom data found for user:", user._id);
    return;
  }

  const currentLevel = Number(classroomData.level) || 0;

  // Make sure badges array exists
  if (!Array.isArray(classroomData.badges)) {
    classroomData.badges = [];
  }

  // 1) Get ALL badges for this classroom
  const badges = await Badge.find({ classroom: classroomId });

  console.log("🔎 Award check for user", user._id.toString());
  console.log("   classroom:", classroomId.toString());
  console.log("   current level:", currentLevel);
  console.log("   badge levels:", badges.map(b => ({
    id: b._id.toString(),
    name: b.name,
    levelRequired: b.levelRequired
  })));

  // 2) Build set of already-earned badge IDs
  const earned = new Set(
    classroomData.badges
      .filter(b => b.badge)
      .map(b => b.badge.toString())
  );

  // 3) For each badge, award if:
  //    - user level >= badge.levelRequired
  //    - not already in earned set
  const newlyAwarded = [];

  for (const badge of badges) {
    const badgeIdStr = badge._id.toString();
    const meetsLevel = currentLevel >= Number(badge.levelRequired);
    const alreadyEarned = earned.has(badgeIdStr);

    if (meetsLevel && !alreadyEarned) {
      console.log(
        `✅ Awarding badge "${badge.name}" (req ${badge.levelRequired}, user lvl ${currentLevel})`
      );
      classroomData.badges.push({
        badge: badge._id,
        dateEarned: new Date()
      });
      earned.add(badgeIdStr);
      newlyAwarded.push(badge.name);
    } else {
      console.log(
        `   ❌ Not awarding "${badge.name}" — meetsLevel=${meetsLevel}, alreadyEarned=${alreadyEarned}`
      );
    }
  }

  if (newlyAwarded.length > 0) {
    await user.save();
    console.log("🏅 Saved user with new badges:", newlyAwarded);
  } else {
    console.log(
      `ℹ️ No new badges awarded for user ${user._id} at level ${currentLevel}.`
    );
  }
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

    await awardLevelBadges(user, classroomId);

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

    await awardLevelBadges(user, classroomId);

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
    const classroomData = user.classroomBalances.find(c => {
      const cId = c.classroom?._id?.toString() || c.classroom?.toString();
      return cId === classroomId.toString();
    });

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




router.get('/badges/:userId/:classroomId', async (req, res) => {
  try {
    const { userId, classroomId } = req.params;

    // Load user and populate badges
    const user = await User.findById(userId).populate({
      path: 'classroomBalances.badges.badge',
      model: 'Badge',
      select: 'name description icon levelRequired classroom',
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find classroom data for this user
    const classroomData = user.classroomBalances.find(
      c => c.classroom?.toString() === classroomId.toString()
    );

    if (!classroomData) {
      return res.status(400).json({ error: 'No classroom data for this user' });
    }

    // Fetch all badges for this classroom 
    const allBadges = await Badge.find({ classroom: classroomId }).sort({ levelRequired: 1 });

    // Identify earned badge IDs
    const earnedIds = new Set(
      (classroomData.badges || []).map(b => b.badge?._id?.toString())
    );

    // Split badges into earned / locked arrays
    const earnedBadges = allBadges.filter(b => earnedIds.has(b._id.toString()));
    const lockedBadges = allBadges.filter(b => !earnedIds.has(b._id.toString()));

    // Return detailed structured response
    res.json({
      classroom: classroomId,
      user: {
        id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        level: classroomData.level || 1,
        xp: classroomData.xp || 0
      },
      badges: {
        earned: (classroomData.badges || [])
          .filter(b => b.badge && earnedIds.has(b.badge._id.toString()))
          .map(b => ({
            id: b.badge._id,
            name: b.badge.name,
            description: b.badge.description,
            icon: b.badge.icon,
            levelRequired: b.badge.levelRequired,
            dateEarned: b.dateEarned || null,
            status: 'earned'
          })),
        locked: (lockedBadges || []).map(b => ({
          id: b._id,
          name: b.name,
          description: b.description,
          icon: b.icon,
          levelRequired: b.levelRequired,
          status: 'locked'
        }))
      },
        
      totalBadges: allBadges.length,
      badgesEarnedCount: earnedBadges.length,
      completionPercent:
        allBadges.length > 0
          ? Math.round((earnedBadges.length / allBadges.length) * 100)
          : 0
    });
  } catch (err) {
    console.error('Error fetching badges for testing:', err.message);
    res.status(500).json({ error: 'Server error getting badges for testing' });
  }
});

// Get current badge + XP progress for each student in a classroom
router.get('/classroom/:classroomId/progress', async (req, res) => {
  try {
    const { classroomId } = req.params;

    // Get all users who belong to this classroom
    const users = await User.find({ 'classroomBalances.classroom': classroomId })
      .populate({
        path: 'classroomBalances.badges.badge',
        model: 'Badge',
        select: 'name levelRequired',
      });

    // Get all possible badges for the classroom
    const allBadges = await Badge.find({ classroom: classroomId }).sort({ levelRequired: 1 });

    const students = users.map(user => {
      const classroomData = user.classroomBalances.find(
        c => c.classroom?.toString() === classroomId.toString()
      );

      if (!classroomData) return null;

      // Count only currently held badges
      const earnedBadges = (classroomData.badges || []).filter(b => b.badge);
      const earnedCount = earnedBadges.length;
      const totalBadges = allBadges.length;

      // Determine next badge
      const nextBadge = allBadges.find(
        b => b.levelRequired > (classroomData.level || 1)
      );

      // XP until next badge unlock
      const xpUntilNextBadge = nextBadge
        ? Math.max(0, nextBadge.levelRequired * 100 - classroomData.xp - (classroomData.level - 1) * 100)
        : 0;

      return {
        _id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        level: classroomData.level || 1,
        xp: classroomData.xp || 0,
        badgesEarned: earnedCount,
        totalBadges: totalBadges,
        nextBadge: nextBadge
          ? `${nextBadge.name} | Level ${nextBadge.levelRequired}`
          : 'All badges earned',
        xpUntilNextBadge,
      };
    }).filter(Boolean);

    res.json(students);
  } catch (err) {
    console.error('Error getting classroom progress:', err);
    res.status(500).json({ error: 'Server error getting progress' });
  }
});



module.exports = router;
