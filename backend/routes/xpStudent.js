const express = require('express');
const router = express.Router();

const Classroom = require('../models/Classroom');
const User = require('../models/User');
const { awardXP } = require('../utils/xp');

// auth helpers (adjust to your auth stack)
function ensureLoggedIn(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  return next();
}
function ensureStudentOrAbove(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const role = req.user.role;
  if (role === 'student' || role === 'teacher' || role === 'admin') return next();
  return res.status(403).json({ error: 'Forbidden' });
}

// utility: returns yyyymmdd string (local) to bucket daily actions
function todayStamp() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}${mm}${dd}`;
}

// POST /api/xpStudent/daily-checkin
// awards daily check-in XP if enabled by teacher.
router.post('/daily-checkin', ensureStudentOrAbove, async (req, res) => {
  try {
    const { classroomId } = req.body;
    const userId = req.user._id;

    if (!classroomId) return res.status(400).json({ error: 'classroomId required' });

    const classroom = await Classroom.findById(classroomId).lean();
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    const settings = classroom.xpSettings || {};
    if (!settings.isXPEnabled) {
      return res.status(400).json({ error: 'XP system is disabled for this classroom' });
    }

    const xpRewards = settings.xpRewards || {};

    // determine per-check-in XP amount
    let perCheckIn = Number(xpRewards.dailyCheckInLimit ?? 0);

    if ((!Number.isFinite(perCheckIn) || perCheckIn <= 0) && xpRewards.dailyCheckInXP != null) {
      perCheckIn = Number(xpRewards.dailyCheckInXP);
    }

    if (!Number.isFinite(perCheckIn) || perCheckIn <= 0) {
      return res.status(400).json({ error: 'Daily check-in XP not enabled' });
    }

    // only one check-in per day
    const limit = 1;

    // load user to track per-day usage
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // locate or create classroom balance to store meta
    user.classroomBalances = user.classroomBalances || [];
    let cb = user.classroomBalances.find(c => String(c.classroom) === String(classroomId));
    if (!cb) {
      cb = {
        classroom: classroomId,
        balance: 0,
        xp: 0,
        level: 1,
        meta: {},
      };
      user.classroomBalances.push(cb);
    }

    cb.meta = cb.meta || {};
    const stamp = todayStamp();
    const key = `dailyCheckIn_${stamp}`;
    const used = Number(cb.meta[key] || 0);

    if (used >= limit) {
      await user.save();
      return res.status(429).json({ error: 'Daily check-in limit reached for today' });
    }

    // award XP as rawXP (not tied to bits)
    const result = await awardXP({
      userId,
      classroomId,
      opts: { rawXP: perCheckIn },
    });

    if (!result.ok) {
      return res.status(400).json({ error: `Cannot award XP: ${result.reason}` });
    }

    cb.meta[key] = used + 1;
    await user.save();

    return res.json({
      ok: true,
      message: `+${perCheckIn} XP (daily check-in)`,
      countToday: cb.meta[key],
      limit,
      level: result.level,
      xp: result.xp,
    });
  } catch (e) {
    console.error('daily-checkin error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/xpStudent/group-join
// awards XP on group join if enabled by teacher (groupJoinXP > 0).
router.post('/group-join', ensureStudentOrAbove, async (req, res) => {
  try {
    const { classroomId } = req.body;
    const userId = req.user._id;

    if (!classroomId) return res.status(400).json({ error: 'classroomId required' });

    const classroom = await Classroom.findById(classroomId).lean();
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    const settings = classroom.xpSettings || {};
    if (!settings.isXPEnabled) {
      return res.status(400).json({ error: 'XP system is disabled for this classroom' });
    }

    const xpRewards = settings.xpRewards || {};
    const amount = Number(xpRewards.groupJoinXP || 0);
    if (amount <= 0) {
      return res.status(400).json({ error: 'Group-join XP not enabled' });
    }

    // one guard key per classroom
    const result = await awardXP({
      userId,
      classroomId,
      opts: {
        rawXP: amount,
        oneTimeKey: 'groupJoin_awarded',
      },
    });

    if (!result.ok && result.reason === 'already-awarded') {
      return res.status(200).json({ ok: true, message: 'Already awarded previously' });
    }
    if (!result.ok) {
      return res.status(400).json({ error: `Cannot award XP: ${result.reason}` });
    }

    return res.json({
      ok: true,
      message: `+${amount} XP for group join`,
      level: result.level,
      xp: result.xp,
    });
  } catch (e) {
    console.error('group-join error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/xpStudent/mystery-box
// awards XP on mystery-box use if enabled by teacher (mysteryBoxUseXP > 0).
router.post('/mystery-box', ensureStudentOrAbove, async (req, res) => {
  try {
    const { classroomId } = req.body;
    const userId = req.user._id;

    if (!classroomId) return res.status(400).json({ error: 'classroomId required' });

    const classroom = await Classroom.findById(classroomId).lean();
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    const settings = classroom.xpSettings || {};
    if (!settings.isXPEnabled) {
      return res.status(400).json({ error: 'XP system is disabled for this classroom' });
    }

    const xpRewards = settings.xpRewards || {};
    const amount = Number(xpRewards.mysteryBoxUseXP || 0);
    if (amount <= 0) {
      return res.status(400).json({ error: 'Mystery-box XP is disabled' });
    }

    const result = await awardXP({
      userId,
      classroomId,
      opts: { rawXP: amount },
    });

    if (!result.ok) {
      return res.status(400).json({ error: `Cannot award XP: ${result.reason}` });
    }

    return res.json({
      ok: true,
      message: `+${amount} XP for using a Mystery Box`,
      level: result.level,
      xp: result.xp,
    });
  } catch (e) {
    console.error('mystery-box error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/xpStudent/:classroomId
// get current user's XP and level info for given classroom
router.get('/:classroomId', ensureStudentOrAbove, async (req, res) => {
  try {
    const classroomId = req.params.classroomId;
    const userId = req.user._id;

    const classroom = await Classroom.findById(classroomId).lean();
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    const settings = classroom.xpSettings || {
      isXPEnabled: true,
      xpFormulaType: 'exponential',
      baseXPLevel2: 100,
    };
    if (!settings.isXPEnabled) {
      return res.status(400).json({ error: 'XP system is disabled for this classroom' });
    }

    const user = await User.findById(userId).select('classroomBalances').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const cb =
      (user.classroomBalances || []).find(
        c => String(c.classroom) === String(classroomId),
      ) || {
        xp: 0,
        level: 1,
      };

    const level = Number(cb.level) || 1;
    const xp = Number(cb.xp) || 0;

    const base = Math.max(1, Number(settings.baseXPLevel2 ?? 100));
    const xpFormulaType = settings.xpFormulaType || 'exponential';

    const xpNeededForNextLevel = L => {
      const levelSafe = Math.max(1, Number(L || 1));
      switch (xpFormulaType) {
        case 'linear':
          return base;
        case 'logarithmic':
          return Math.max(1, Math.round(base * levelSafe * Math.log10(levelSafe + 1)));
        case 'exponential':
        default:
          return Math.max(1, Math.round(base * Math.pow(1.5, levelSafe - 1)));
      }
    };

    const nextLevelXP = xpNeededForNextLevel(level);

    return res.json({ level, xp, nextLevelXP });
  } catch (e) {
    console.error('xpStudent GET error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
