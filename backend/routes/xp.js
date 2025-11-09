const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Classroom = require('../models/Classroom');
const Badge = require('../models/Badge');

// keep a number within bounds
const limitToRange = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// XP increase required from level (L) -> (L+1), based on formula
function perLevelIncrease(level, baseXP, formula) {
  if (level <= 1) return 0; // level 1 baseline
  switch ((formula || 'exponential').toLowerCase()) {
    case 'linear':
      return baseXP * (level - 1);
    case 'logarithmic':
      return Math.max(0, Math.floor(baseXP * level * Math.log10(level + 1)));
    case 'exponential':
    default: {
      const powerUp = Math.pow(1.5, level - 2);
      return Math.max(0, Math.floor(baseXP * powerUp));
    }
  }
}

// total XP required to arrive at targetLevel
function requiredXpForLevel(targetLevel, baseXP, formula, caps = { maxLevel: 200 }) {
  let total = 0;
  const maxL = caps?.maxLevel ?? 200;
  for (let l = 2; l <= Math.min(targetLevel, maxL); l++) {
    total += perLevelIncrease(l, baseXP, formula);
  }
  return total;
}

// convert TOTAL XP to level summary
function calculateLevelSummary(totalXP, baseXP, formula) {
  const maxLevel = 200;
  totalXP = Math.max(0, Number(totalXP) || 0);

  let level = 1;
  let XPStartLevel = 0;
  let XPEndLevel = requiredXpForLevel(2, baseXP, formula) || baseXP; // boundary to level 2

  while (level < maxLevel && totalXP >= XPEndLevel) {
    level += 1;
    XPStartLevel = XPEndLevel;
    XPEndLevel = requiredXpForLevel(level + 1, baseXP, formula);
  }

  const span = Math.max(1, XPEndLevel - XPStartLevel);
  const progressPercent = limitToRange(((totalXP - XPStartLevel) / span) * 100, 0, 100);
  const XPRequired = Math.max(0, XPEndLevel - totalXP);

  return {
    level,
    XPStartLevel,
    XPEndLevel,
    XPRequired,
    progressPercent: Math.round(progressPercent),
  };
}

// ensure user has a classroomBalances row for this classroom
function getClassroomRow(user, classroomId) {
  let row = user.classroomBalances?.find(
    (c) => (c.classroom?._id?.toString() || c.classroom?.toString()) === classroomId.toString()
  );
  if (!row) {
    user.classroomBalances = user.classroomBalances || [];
    user.classroomBalances.push({
      classroom: classroomId,
      balance: 0,
      xp: 0,       // store TOTAL XP
      level: 1,
      badges: []   // ensure badges array exists for awarding
    });
    row = user.classroomBalances.find(
      (c) => (c.classroom?._id?.toString() || c.classroom?.toString()) === classroomId.toString()
    );
  }
  if (!Array.isArray(row.badges)) row.badges = [];
  return row;
}

// read classroom XP config (with defaults)
async function loadClassroomConfigurations(classroomId) {
  const classroom = await Classroom.findById(classroomId);
  const xpCfg = classroom?.xpConfig || {};
  const baseXP = Number(xpCfg.baseXP) > 0 ? Number(xpCfg.baseXP) : 100;
  const xpFormula = (xpCfg.xpFormula || 'exponential').toLowerCase();
  return { baseXP, xpFormula, classroom };
}

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

// sanity test
router.get('/test', (req, res) => {
  res.json({ message: 'XP route connected successfully' });
});

// returns level summary for one student in one class
router.get('/summary', async (req, res) => {
  try {
    const { userId, classroomId } = req.query;
    if (!userId || !classroomId) {
      return res.status(400).json({ error: 'userId and classroomId are required' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const row = getClassroomRow(user, classroomId);
    const { baseXP, xpFormula } = await loadClassroomConfigurations(classroomId);

    const totalXP = Number(row.xp) || 0;
    const summary = calculateLevelSummary(totalXP, baseXP, xpFormula);

    // keep stored level synced with computed
    if (row.level !== summary.level) {
      row.level = summary.level;
      await user.save();
    }

    res.json({
      userId,
      classroomId,
      formula: xpFormula,
      baseXP,
      totalXP,
      ...summary,
    });
  } catch (err) {
    console.error('Error in XP summary:', err);
    res.status(500).json({ error: 'Server error generating XP summary' });
  }
});

// adds to TOTAL XP, recomputes level, awards badges, returns summary
router.post('/add', async (req, res) => {
  try {
    const { userId, classroomId, xpToAdd } = req.body;

    if (!userId || !classroomId || typeof xpToAdd !== 'number' || xpToAdd <= 0) {
      return res.status(400).json({ error: 'Invalid input data' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const row = getClassroomRow(user, classroomId);
    const { baseXP, xpFormula } = await loadClassroomConfigurations(classroomId);

    const prevLevel = row.level || 1;
    row.xp = (Number(row.xp) || 0) + xpToAdd; // store TOTAL XP

    const summary = calculateLevelSummary(row.xp, baseXP, xpFormula);
    row.level = summary.level;

    await user.save();

    const leveledUp = summary.level > prevLevel;

    // award badges based on new level
    await awardLevelBadges(user, classroomId);

    res.json({
      message: leveledUp ? `Level up! You are now level ${row.level}` : `+${xpToAdd} XP added`,
      classroomData: {
        classroom: row.classroom,
        totalXP: row.xp,
        level: row.level,
        ...summary,
        baseXP,
        formula: xpFormula,
      },
    });
  } catch (err) {
    console.error('Error updating XP:', err.message);
    res.status(500).json({ error: 'Server error updating XP' });
  }
});

// Update classroom XP settings (Teacher only)
// (keeping your body: { dailyLogin, groupJoin }, preserving other xpConfig fields)
router.put('/config/:classroomId', async (req, res) => {
  try {
    const { classroomId } = req.params;
    const { dailyLogin, groupJoin } = req.body;

    const classroom = await Classroom.findById(classroomId);
    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    // Validation
    if (dailyLogin !== undefined && (typeof dailyLogin !== 'number' || dailyLogin < 0)) {
      return res.status(400).json({ error: 'Invalid XP value for dailyLogin' });
    }
    if (groupJoin !== undefined && (typeof groupJoin !== 'number' || groupJoin < 0)) {
      return res.status(400).json({ error: 'Invalid XP value for groupJoin' });
    }

    classroom.xpConfig = classroom.xpConfig || {};
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

// dev-only: quick add XP
router.post('/test/add', async (req, res) => {
  try {
    let { userId, classroomId, xpToAdd = 100 } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // if not provided, use first classroom on user
    if (!classroomId) {
      if (user.classroomBalances?.length > 0) {
        classroomId = user.classroomBalances[0].classroom;
      } else {
        return res.status(400).json({ error: 'User is not part of any classroom.' });
      }
    }

    const row = getClassroomRow(user, classroomId);
    const { baseXP, xpFormula } = await loadClassroomConfigurations(classroomId);

    const prevLevel = row.level || 1;
    row.xp = (Number(row.xp) || 0) + Number(xpToAdd);

    const summary = calculateLevelSummary(row.xp, baseXP, xpFormula);
    row.level = summary.level;

    await user.save();

    const leveledUp = row.level > prevLevel;

    // badge check
    await awardLevelBadges(user, classroomId);

    res.json({
      message: leveledUp
        ? `+${xpToAdd} XP — Level Up! You are now level ${row.level}.`
        : `+${xpToAdd} XP added successfully.`,
      classroomData: {
        classroom: row.classroom,
        totalXP: row.xp,
        level: row.level,
        ...summary,
        baseXP,
        formula: xpFormula,
      },
    });
  } catch (err) {
    console.error('Error in XP test/add route:', err.message);
    res.status(500).json({ error: 'Server error adding XP for testing' });
  }
});

// dev-only: reset XP & level
router.post('/test/reset', async (req, res) => {
  try {
    let { userId, classroomId } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!classroomId) {
      if (user.classroomBalances?.length > 0) {
        classroomId = user.classroomBalances[0].classroom;
      } else {
        return res.status(400).json({ error: 'User is not part of any classroom.' });
      }
    }

    const row = user.classroomBalances.find(
      (c) => (c.classroom?._id?.toString() || c.classroom?.toString()) === classroomId.toString()
    );
    if (!row) {
      return res.status(400).json({ error: 'User not found in specified classroom' });
    }

    row.xp = 0;
    row.level = 1;
    row.badges = Array.isArray(row.badges) ? row.badges : [];

    await user.save();

    res.json({
      message: 'XP and level reset successfully.',
      classroomData: row,
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
      c => (c.classroom?._id?.toString() || c.classroom?.toString()) === classroomId.toString()
    );

    if (!classroomData) {
      return res.status(400).json({ error: 'No classroom data for this user' });
    }

    // Fetch all badges for this classroom
    const allBadges = await Badge.find({ classroom: classroomId }).sort({ levelRequired: 1 });

    // Identify earned badge IDs
    const earnedIds = new Set(
      (classroomData.badges || []).map(b => b.badge?._id?.toString() || b.badge?.toString())
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
          .filter(b => b.badge && earnedIds.has((b.badge._id?.toString?.() || b.badge.toString())))
          .map(b => ({
            id: b.badge._id || b.badge,
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
    console.error('Error fetching badges:', err.message);
    res.status(500).json({ error: 'Server error getting badges' });
  }
});

module.exports = router;
