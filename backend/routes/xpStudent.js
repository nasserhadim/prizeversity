// Student-facing XP endpoints: daily check-in, group join, mystery box, etc.
// Uses the shared XP utility to compute/award XP based on classroom settings.

const express = require('express');
const router = express.Router();

const Classroom = require('../models/Classroom');
const User = require('../models/User');
const { awardXP } = require('../utils/xp');

//auth helpers (adjust to your auth stack)
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

//utility: returns yyyymmdd string (local) to bucket daily actions
function todayStamp() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}${mm}${dd}`;
}

//POST api/xpstudent/dailycheckin
//give XP once per day up to dailyCheckInLimit in classroom.xpSettings.xpRewards

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
    const perCheckIn = Number(xpRewards.dailyCheckInXP || 0);
    const limit = Math.max(0, Number(xpRewards.dailyCheckInLimit || 1));
    if (perCheckIn <= 0 || limit <= 0) {
      return res.status(400).json({ error: 'Daily check-in XP not enabled' });
    }

    //load user to track per-day usage
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    //locate or create classroom balance to store meta
    let cb = user.classroomBalances?.find(c => String(c.classroom) === String(classroomId));
    if (!cb) {
      user.classroomBalances.push({
        classroom: classroomId,
        balance: 0,
        xp: 0,
        level: 1,
        meta: {}
      });
      cb = user.classroomBalances[user.classroomBalances.length - 1];
    }

    cb.meta = cb.meta || {};
    const stamp = todayStamp();
    const key = `dailyCheckIn_${stamp}`;
    const used = Number(cb.meta[key] || 0);

    if (used >= limit) {
      await user.save();
      return res.status(429).json({ error: 'Daily check-in limit reached for today' });
    }

    //award XP as rawXP (not tied to bits)
    const result = await awardXP({
      userId,
      classroomId,
      opts: { rawXP: perCheckIn }
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
      xp: result.xp
    });
  } catch (e) {
    console.error('daily-checkin error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

//POSTapi/xpStudent/group-join
//onetime XP award for joining a group (idempotent via oneTimeKey).
//grontend should call this immediately after a successful group join.
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

    //one guard key per classroom
    const result = await awardXP({
      userId,
      classroomId,
      opts: {
        rawXP: amount,
        oneTimeKey: 'groupJoin_awarded'
      }
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
      xp: result.xp
    });
  } catch (e) {
    console.error('group-join error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});
//POSTapi/xpStudent/mystery-box
//awards XP on mystery box use if enabled by teacher (mysteryBoxUseXP > 0).
//this is *not* tied to bits spending; it’s a bonus for taking the risk.
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
      opts: { rawXP: amount }
    });

    if (!result.ok) {
      return res.status(400).json({ error: `Cannot award XP: ${result.reason}` });
    }

    return res.json({
      ok: true,
      message: `+${amount} XP for using a Mystery Box`,
      level: result.level,
      xp: result.xp
    });
  } catch (e) {
    console.error('mystery-box error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/xpStudent/:classroomId  -> returns persisted xp/level for the logged-in user
router.get('/:classroomId', ensureStudentOrAbove, async (req, res) => {
  try {
    const classroomId = req.params.classroomId;
    const userId = req.user._id;

    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const cb = (user.classroomBalances || []).find(
      c => String(c.classroom) === String(classroomId)
    );

    // If the bucket doesn't exist yet, return defaults
    if (!cb) return res.json({ xp: 0, level: 1 });

    // Optional: also return how much is needed to hit next level (helps the progress bar)
    const classroom = await Classroom.findById(classroomId).lean();
    const settings = classroom?.xpSettings || {};
    const base = Math.max(1, Number(settings.baseXPLevel2 || 100));
    const type = settings.xpFormulaType || 'exponential';

    // reuse your helper
    const need = require('../utils/xp').xpNeededForNextLevel(cb.level, {
      xpFormulaType: type,
      baseXPLevel2: base,
    });

    return res.json({
      xp: cb.xp || 0,          // xp toward the NEXT level (your util subtracts on level up)
      level: cb.level || 1,
      nextLevelXP: need        // total needed to reach (level+1)
    });
  } catch (e) {
    console.error('xpStudent GET error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});


// GET /api/xpStudent/:classroomId
// Returns this student's level, xp (toward next level), and nextLevelXP
router.get('/:classroomId', ensureStudentOrAbove, async (req, res) => {
  try {
    const classroomId = req.params.classroomId;
    const userId = req.user._id;

    const classroom = await Classroom.findById(classroomId).lean();
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    const settings = classroom.xpSettings || { isXPEnabled: true, xpFormulaType: 'exponential', baseXPLevel2: 100 };
    if (!settings.isXPEnabled) {
      return res.status(400).json({ error: 'XP system is disabled for this classroom' });
    }

    const user = await User.findById(userId).select('classroomBalances').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const cb = (user.classroomBalances || []).find(c => String(c.classroom) === String(classroomId)) || {
      xp: 0, level: 1
    };

    // compute “xp needed for NEXT level” from current level + class settings
    const level = Number(cb.level) || 1;
    const xp = Number(cb.xp) || 0;

    // inline copy of your util (or import it if you prefer)
    const base = Math.max(1, Number((settings.baseXPLevel2 ?? 100)));
    const xpFormulaType = settings.xpFormulaType || 'exponential';
    const xpNeededForNextLevel = (L) => {
      const levelSafe = Math.max(1, Number(L || 1));
      switch (xpFormulaType) {
        case 'linear':       return base;
        case 'logarithmic':  return Math.max(1, Math.round(base * levelSafe * Math.log10(levelSafe + 1)));
        case 'exponential':
        default:             return Math.max(1, Math.round(base * Math.pow(1.5, levelSafe - 1)));
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
