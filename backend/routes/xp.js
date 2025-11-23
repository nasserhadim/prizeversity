const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Classroom = require('../models/Classroom');
const Badge = require('../models/Badge');

// Centralized XP helper
const { awardXP } = require('../utils/xp');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Role guard (requires auth middleware to set req.user)
function ensureTeacherOrAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.user.role === 'teacher' || req.user.role === 'admin') return next();
  return res.status(403).json({ error: 'Forbidden' });
}

// keep a number within bounds
const limitToRange = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/*accepts both classroomId and classId so the old frontend still works.*/

function getClassroomIdFromQuery(req) {
  return req.query.classroomId || req.query.classId;
}
function getClassroomIdFromBody(req) {
  return req.body.classroomId || req.body.classId;
}

// XP increase required from level, based on the formula
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

// total XP required to arrive at the targetLevel
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

// make sure that a user has a classroomBalances row for this classroom
function getClassroomRow(user, classroomId) {
  let row = user.classroomBalances?.find(
    (c) =>
      (c.classroom?._id?.toString() || c.classroom?.toString()) ===
      classroomId.toString()
  );
  if (!row) {
    user.classroomBalances = user.classroomBalances || [];
    user.classroomBalances.push({
      classroom: classroomId,
      balance: 0,
      xp: 0, // the XP is stored for this classroom (within current level)
      level: 1,
      lastDailyCheckin: null,
      badges: [],
    });
    row = user.classroomBalances.find(
      (c) =>
        (c.classroom?._id?.toString() || c.classroom?.toString()) ===
        classroomId.toString()
    );
  }
  if (!Array.isArray(row.badges)) row.badges = [];
  if (typeof row.lastDailyCheckin === 'undefined') row.lastDailyCheckin = null;
  return row;
}

// read classroom XP config (with defaults) – still used for baseXP/xpFormula
async function loadClassroomConfigurations(classroomId) {
  const classroom = await Classroom.findById(classroomId);
  const xpCfg = classroom?.xpConfig || {};
  const baseXP = Number(xpCfg.baseXP) > 0 ? Number(xpCfg.baseXP) : 100;
  const xpFormula = (xpCfg.xpFormula || 'exponential').toLowerCase();
  return { baseXP, xpFormula, classroom };
}

async function awardLevelBadges(user, classroomId) {
  const classroomData = user.classroomBalances.find((c) => {
    const cId = c.classroom?._id?.toString() || c.classroom?.toString();
    return cId === classroomId.toString();
  });

  if (!classroomData) {
    console.log('⚠️ No classroom data found for user:', user._id);
    return;
  }

  const currentLevel = Number(classroomData.level) || 0;
  if (!Array.isArray(classroomData.badges)) {
    classroomData.badges = [];
  }

  const badges = await Badge.find({ classroom: classroomId });

  const earned = new Set(
    classroomData.badges
      .filter((b) => b.badge)
      .map((b) => b.badge.toString())
  );

  const newlyAwarded = [];

  for (const badge of badges) {
    const badgeIdStr = badge._id.toString();
    const meetsLevel = currentLevel >= Number(badge.levelRequired);
    const alreadyEarned = earned.has(badgeIdStr);

    if (meetsLevel && !alreadyEarned) {
      classroomData.badges.push({
        badge: badge._id,
        dateEarned: new Date(),
      });
      earned.add(badgeIdStr);
      newlyAwarded.push(badge.name);
    }
  }

  if (newlyAwarded.length > 0) {
    await user.save();
    console.log('🏅 Saved user with new badges:', newlyAwarded);
  }
}

router.get('/test', (req, res) => {
  res.json({ message: 'XP route connected successfully' });
});

// ─────────────────────────── XP SUMMARY ──────────────────────────
router.get('/summary', async (req, res) => {
  try {
    const { userId } = req.query;
    const classroomId = getClassroomIdFromQuery(req);

    if (!userId || !classroomId) {
      return res
        .status(400)
        .json({ error: 'userId and classroomId/classId are required' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const row = getClassroomRow(user, classroomId);
    const { baseXP, xpFormula } = await loadClassroomConfigurations(classroomId);

    // Stored level and the XP INSIDE that level
    const storedLevel = Number(row.level) || 1;
    const xpInCurrentLevel = Math.max(0, Number(row.xp) || 0);

    // XP needed from this level to next level
    let xpNeeded = perLevelIncrease(storedLevel + 1, baseXP, xpFormula);
    if (!xpNeeded || xpNeeded <= 0) {
      xpNeeded = baseXP; // fallback
    }

    // don't let "have" exceed what is needed for this level
    const haveInLevel = Math.max(0, Math.min(xpInCurrentLevel, xpNeeded));

    // this is the total XP at start of this level (all previous levels)
    const XPStartLevel = requiredXpForLevel(storedLevel, baseXP, xpFormula);

    // this is total XP required to reach the NEXT level
    const XPEndLevel = XPStartLevel + xpNeeded;

    // this is the total XP earned in this classroom (what you want as numerator)
    const totalXP = XPStartLevel + haveInLevel;

    const progressPercent = limitToRange(
      (haveInLevel / xpNeeded) * 100,
      0,
      100
    );

    const XPRequired = Math.max(0, XPEndLevel - totalXP); // same as xpNeeded - haveInLevel

    res.json({
      userId,
      classroomId,
      formula: xpFormula,
      baseXP,
      totalXP,          // total XP across ALL levels
      level: storedLevel,
      XPStartLevel,     // total XP at start of this level
      XPEndLevel,       // total XP required for the next level
      XPRequired,       // XP still needed to level up
      progressPercent: Math.round(progressPercent),
    });
  } catch (err) {
    console.error('Error in XP summary:', err);
    res.status(500).json({ error: 'Server error generating XP summary' });
  }
});

// DAILY CHECK-IN ROUTES
// shared helper for both status routes
async function handleDailyStatus(req, res) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const classroomId = getClassroomIdFromQuery(req);
    if (!classroomId) {
      return res
        .status(400)
        .json({ error: 'classroomId or classId is required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const row = getClassroomRow(user, classroomId);
    const last = row.lastDailyCheckin ? new Date(row.lastDailyCheckin) : null;
    const now = new Date();

    let hasCheckedInToday = false;
    let nextAvailableAt = null;

    if (last) {
      const diff = now.getTime() - last.getTime();
      if (diff < MS_PER_DAY) {
        hasCheckedInToday = true;
        nextAvailableAt = new Date(last.getTime() + MS_PER_DAY);
      }
    }

    res.json({
      hasCheckedInToday,
      lastDailyCheckin: last,
      nextAvailableAt,
    });
  } catch (err) {
    console.error('Error in daily-checkin/status:', err);
    res
      .status(500)
      .json({ error: 'Server error checking daily check-in status' });
  }
}

// status routes (both paths)
router.get('/daily-checkin/status', handleDailyStatus);
router.get('/daily-login/status', handleDailyStatus);

// shared helper for both POST routes
async function handleDailyCheckin(req, res) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const classroomId = getClassroomIdFromBody(req);
    if (!classroomId) {
      return res
        .status(400)
        .json({ error: 'classroomId or classId is required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { classroom } = await loadClassroomConfigurations(classroomId);
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    const row = getClassroomRow(user, classroomId);
    const now = new Date();
    const last = row.lastDailyCheckin ? new Date(row.lastDailyCheckin) : null;

    // 24-hour lock
    if (last && now.getTime() - last.getTime() < MS_PER_DAY) {
      const nextAvailableAt = new Date(last.getTime() + MS_PER_DAY);
      return res.status(200).json({
        ok: false,
        alreadyCheckedIn: true,
        message: 'Already Checked In',
        nextAvailableAt,
      });
    }

    // this will derive dailyXP from the People "XP Gain Rates" settings
    const xpSettings = classroom.xpSettings || {};
    const xpRewards = xpSettings.xpRewards || {};
    const xpCfg = classroom.xpConfig || {};
    let rawDailyXP =
      xpRewards.dailyCheckInLimit ??
      xpRewards.dailyCheckinLimit ??
      xpRewards.dailyCheckInXP ??
      xpRewards.dailyCheckinXP ??
      xpSettings.dailyCheckInLimit ??
      xpSettings.dailyCheckinLimit ??
      xpSettings.dailyCheckInXP ??
      xpSettings.dailyCheckinXP ??
      xpCfg.dailyCheckinLimit ??
      xpCfg.dailyLogin ??
      null;

    console.log('[xp /daily-checkin] rawDailyXP =', rawDailyXP);

    const dailyXPNum = Number(rawDailyXP);
    if (!Number.isFinite(dailyXPNum) || dailyXPNum <= 0) {
      // Treat the no valid config or <=0 as no XP for daily check-in
      return res.status(200).json({
        ok: false,
        alreadyCheckedIn: false,
        message: 'Daily check-in XP not configured',
      });
    }

    const dailyXP = dailyXPNum;
    console.log('[xp /daily-checkin] using dailyXP =', dailyXP);


    // Use the awardXP so leveling and badges stay consistent
    const result = await awardXP({
      userId: user._id,
      classroomId,
      opts: { rawXP: dailyXP },
    });

    if (!result || result.ok === false) {
      return res.status(400).json({
        error: result?.reason || 'Failed to award XP for daily check-in',
      });
    }

    row.lastDailyCheckin = now;
    await user.save();

    res.json({
      ok: true,
      alreadyCheckedIn: false,
      message: `Daily check-in complete! +${dailyXP} XP`,
      awardedXP: dailyXP,
      level: result.level,
      totalXP: result.xp,
      nextAvailableAt: new Date(now.getTime() + MS_PER_DAY),
    });
  } catch (err) {
    console.error('Error in daily-checkin:', err);
    res
      .status(500)
      .json({ error: 'Server error completing daily check-in' });
  }
}

// main daily check-in routes (both paths so frontend works)
router.post('/daily-checkin', handleDailyCheckin);
router.post('/daily-login', handleDailyCheckin);

//adding xp route for teachers/admins
router.post('/add', ensureTeacherOrAdmin, async (req, res) => {
  try {
    const { userId, xpToAdd } = req.body;
    const classroomId = getClassroomIdFromBody(req);

    if (
      !userId ||
      !classroomId ||
      typeof xpToAdd !== 'number' ||
      xpToAdd <= 0
    ) {
      return res.status(400).json({ error: 'Invalid input data' });
    }

    const result = await awardXP({
      userId,
      classroomId,
      opts: { rawXP: xpToAdd },
    });

    if (!result || result.ok === false) {
      return res
        .status(400)
        .json({ error: result?.reason || 'Failed to add XP' });
    }

    // Reload user to award badges against updated level
    const user = await User.findById(userId);
    if (!user)
      return res
        .status(404)
        .json({ error: 'User not found after XP update' });

    await awardLevelBadges(user, classroomId);

    res.json({
      message: result.leveled
        ? `Level up! Now level ${result.level}.`
        : `+${result.added ?? xpToAdd} XP added.`,
      classroomData: {
        classroom: classroomId,
        level: result.level,
        totalXP: result.xp,
      },
    });
  } catch (err) {
    console.error('Error updating XP:', err);
    res.status(500).json({ error: 'Server error updating XP' });
  }
});

// Update classroom XP settings (Teacher/Admin only)
router.put('/config/:classroomId', ensureTeacherOrAdmin, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const { dailyLogin, groupJoin } = req.body;

    const classroom = await Classroom.findById(classroomId);
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    // Validation (allow 0; only reject if type invalid or negative)
    if (
      dailyLogin !== undefined &&
      (typeof dailyLogin !== 'number' || dailyLogin < 0)
    ) {
      return res
        .status(400)
        .json({ error: 'Invalid XP value for dailyLogin' });
    }
    if (
      groupJoin !== undefined &&
      (typeof groupJoin !== 'number' || groupJoin < 0)
    ) {
      return res
        .status(400)
        .json({ error: 'Invalid XP value for groupJoin' });
    }

    classroom.xpConfig = classroom.xpConfig || {};
    if (dailyLogin !== undefined) classroom.xpConfig.dailyLogin = dailyLogin;
    if (groupJoin !== undefined) classroom.xpConfig.groupJoin = groupJoin;

    await classroom.save();

    res.json({
      message: 'XP configuration updated successfully.',
      xpConfig: classroom.xpConfig,
    });
  } catch (err) {
    console.error('Error updating XP config:', err);
    res.status(500).json({ error: 'Server error updating XP config' });
  }
});

// dev-only: quick add XP (now calls awardXP), gated by role
router.post('/test/add', ensureTeacherOrAdmin, async (req, res) => {
  try {
    let { userId, xpToAdd = 100 } = req.body;
    let classroomId = getClassroomIdFromBody(req);

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!classroomId) {
      if (user.classroomBalances?.length > 0) {
        classroomId = user.classroomBalances[0].classroom;
      } else {
        return res
          .status(400)
          .json({ error: 'User is not part of any classroom.' });
      }
    }

    const result = await awardXP({
      userId,
      classroomId,
      opts: { rawXP: Number(xpToAdd) },
    });

    if (!result || result.ok === false) {
      return res
        .status(400)
        .json({ error: result?.reason || 'Failed to add XP' });
    }

    const refreshed = await User.findById(userId);
    await awardLevelBadges(refreshed, classroomId);

    res.json({
      message: result.leveled
        ? `+${result.added ?? xpToAdd} XP — Level Up! Now level ${result.level}.`
        : `+${result.added ?? xpToAdd} XP added successfully.`,
      classroomData: {
        classroom: classroomId,
        level: result.level,
        totalXP: result.xp,
      },
    });
  } catch (err) {
    console.error('Error in XP test/add route:', err);
    res
      .status(500)
      .json({ error: 'Server error adding XP for testing' });
  }
});

// dev-only: reset XP & level, gated by role
router.post('/test/reset', ensureTeacherOrAdmin, async (req, res) => {
  try {
    let { userId } = req.body;
    let classroomId = getClassroomIdFromBody(req);

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!classroomId) {
      if (user.classroomBalances?.length > 0) {
        classroomId = user.classroomBalances[0].classroom;
      } else {
        return res
          .status(400)
          .json({ error: 'User is not part of any classroom.' });
      }
    }

    const classroomData = user.classroomBalances.find(
      (c) =>
        (c.classroom?._id?.toString() || c.classroom?.toString()) ===
        classroomId.toString()
    );
    if (!classroomData) {
      return res
        .status(400)
        .json({ error: 'User not found in this classroom.' });
    }

    classroomData.xp = 0;
    classroomData.level = 1;
    classroomData.badges = Array.isArray(classroomData.badges)
      ? classroomData.badges
      : [];
    classroomData.lastDailyCheckin = null;

    await user.save();

    res.json({
      message: 'XP and level reset successfully.',
      classroomData,
    });
  } catch (err) {
    console.error('Error in XP test/reset route:', err);
    res.status(500).json({ error: 'Server error resetting XP' });
  }
});

router.get('/badges/:userId/:classroomId', async (req, res) => {
  try {
    const { userId, classroomId } = req.params;

    //Load user and make sure they exist
    let user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const classroomDataRaw = user.classroomBalances.find(
      (c) =>
        (c.classroom?._id?.toString() || c.classroom?.toString()) ===
        classroomId.toString()
    );

    if (!classroomDataRaw) {
      return res.status(400).json({ error: 'No classroom data for this user' });
    }

    //Award any missing level-based badges based on current level
    await awardLevelBadges(user, classroomId);

    //reload user with populated badge docs for response
    user = await User.findById(userId).populate({
      path: 'classroomBalances.badges.badge',
      model: 'Badge',
      select: 'name description icon imageUrl levelRequired classroom',
    });

    const classroomData = user.classroomBalances.find(
      (c) =>
        (c.classroom?._id?.toString() || c.classroom?.toString()) ===
        classroomId.toString()
    );

    if (!classroomData) {
      return res.status(400).json({ error: 'No classroom data for this user' });
    }

    // Fetch all badges for this classroom
    const allBadges = await Badge.find({ classroom: classroomId }).sort({
      levelRequired: 1,
    });

    const earnedIds = new Set(
      (classroomData.badges || []).map(
        (b) => b.badge?._id?.toString() || b.badge?.toString()
      )
    );

    const earnedBadges = allBadges.filter((b) => earnedIds.has(b._id.toString()));
    const lockedBadges = allBadges.filter((b) => !earnedIds.has(b._id.toString()));

    res.json({
      classroom: classroomId,
      user: {
        id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        level: classroomData.level || 1,
        xp: classroomData.xp || 0,
      },
      badges: {
        earned: (classroomData.badges || [])
          .filter(
            (b) =>
              b.badge &&
              earnedIds.has(
                b.badge._id?.toString?.() || b.badge.toString()
              )
          )
          .map((b) => ({
            id: b.badge._id || b.badge,
            name: b.badge.name,
            description: b.badge.description,
            icon: b.badge.icon,
            imageUrl: b.badge.imageUrl,
            levelRequired: b.badge.levelRequired,
            dateEarned: b.dateEarned || null,
            status: 'earned',
          })),
        locked: (lockedBadges || []).map((b) => ({
          id: b._id,
          name: b.name,
          description: b.description,
          icon: b.icon,
          imageUrl: b.imageUrl,
          levelRequired: b.levelRequired,
          status: 'locked',
        })),
      },
      totalBadges: allBadges.length,
      badgesEarnedCount: earnedBadges.length,
      completionPercent:
        allBadges.length > 0
          ? Math.round((earnedBadges.length / allBadges.length) * 100)
          : 0,
    });
  } catch (err) {
    console.error('Error fetching badges:', err.message);
    res.status(500).json({ error: 'Server error getting badges' });
  }
});

// Get current badge + XP progress for each student in a classroom
router.get('/classroom/:classroomId/progress', async (req, res) => {
  try {
    const { classroomId } = req.params;
    const { baseXP, xpFormula } = await loadClassroomConfigurations(classroomId);

    const users = await User.find({
      'classroomBalances.classroom': classroomId,
    }).populate({
      path: 'classroomBalances.badges.badge',
      model: 'Badge',
      select: 'name levelRequired',
    });

    // Get all possible badges for the classroom
    const allBadges = await Badge.find({ classroom: classroomId }).sort({
      levelRequired: 1,
    });

    const students = users
      .map((user) => {
        const classroomData = user.classroomBalances.find(
          (c) =>
            (c.classroom?._id?.toString() || c.classroom?.toString()) ===
            classroomId.toString()
        );

        if (!classroomData) return null;

        const earnedBadges = (classroomData.badges || []).filter(
          (b) => b.badge
        );
        const earnedCount = earnedBadges.length;
        const totalBadges = allBadges.length;

        const nextBadge = allBadges.find(
          (b) => b.levelRequired > (classroomData.level || 1)
        );

        // XP until next badge unlock 
        const xpUntilNextBadge = nextBadge
          ? Math.max(
              0,
              nextBadge.levelRequired * 100 -
                classroomData.xp -
                (classroomData.level - 1) * 100
            )
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
      })
      .filter(Boolean);

    res.json(students);
  } catch (err) {
    console.error('Error getting classroom progress:', err);
    res.status(500).json({ error: 'Server error getting progress' });
  }
});

module.exports = router;
