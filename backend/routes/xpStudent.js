// Student-facing XP endpoints: daily check-in, group join, mystery box, etc.
// Uses the shared XP utility to compute/award XP based on classroom settings.

const express = require('express');
const router = express.Router();

const Classroom = require('../models/Classroom');
const User = require('../models/User');
const { awardXP } = require('../utils/xp');

//auth helpers (adjust to your auth stack)

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

async function dailyCheckInHandler(req, res) {
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

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!Array.isArray(user.classroomBalances)) user.classroomBalances = [];

    let cb = user.classroomBalances.find(c => String(c.classroom) === String(classroomId));
    if (!cb) {
      user.classroomBalances.push({ classroom: classroomId, balance: 0, xp: 0, level: 1, meta: {} });
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

    const result = await awardXP({ userId, classroomId, opts: { rawXP: perCheckIn } });
    if (!result.ok) return res.status(400).json({ error: `Cannot award XP: ${result.reason}` });

    cb.meta[key] = used + 1;
    await user.save();

    const io = req.app.get('io');
    if (io && result?.ok) {
      io.to(`classroom-${classroomId}`).emit('xp:update', {
        userId: String(userId),
        classroomId: String(classroomId),
        newXP: result.xp,
        newLevel: result.level,
        leveledUp: result.leveled
      });
    }

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
}

// >>> THIS IS NEWWWWW <<<
// Accept BOTH spellings so the frontend can call either:
router.post('/daily-checkin', ensureStudentOrAbove, dailyCheckInHandler);
router.post('/dailycheckin',  ensureStudentOrAbove, dailyCheckInHandler);

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

    const io = req.app.get('io');
    if (io && result?.ok) {
      io.to(`classroom-${classroomId}`).emit('xp:update', {
        userId,
        classroomId,
        newXP: result.xp,
        newLevel: result.level,
        leveledUp: result.leveled
      });
    }


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

    const io = req.app.get('io');
    if (io && result?.ok) {
      io.to(`classroom-${classroomId}`).emit('xp:update', {
        userId,
        classroomId,
        newXP: result.xp,
        newLevel: result.level,
        leveledUp: result.leveled
      });
    }


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

//award XP once for completing a challenge in this classroom
router.post('/challenge-complete', ensureStudentOrAbove, async (req, res) => {
  try {
    const { classroomId, challengeId } = req.body;
    const userId = req.user._id;

    if (!classroomId || !challengeId) {
      return res.status(400).json({ error: 'classroomId and challengeId required' });
    }

    const classroom = await Classroom.findById(classroomId).lean();
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    const settings = classroom.xpSettings || {};
    if (!settings.isXPEnabled) {
      return res.status(400).json({ error: 'XP system is disabled for this classroom' });
    }

    const xpRewards = settings.xpRewards || {};
    const amount = Number(xpRewards.challengeXP || 0);
    if (amount <= 0) {
      return res.status(400).json({ error: 'Challenge XP not enabled' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    //don’t award XP twice for the same thing
    user.classroomBalances = user.classroomBalances || [];
    let cb = user.classroomBalances.find(c => String(c.classroom) === String(classroomId));
    if (!cb) {
      user.classroomBalances.push({ classroom: classroomId, balance: 0, xp: 0, level: 1, meta: {} });
      cb = user.classroomBalances[user.classroomBalances.length - 1];
    }
    cb.meta = cb.meta || {};
    const onceKey = `challenge_${challengeId}`;
    if (cb.meta[onceKey]) {
      return res.status(200).json({ ok: true, message: 'Already awarded previously' });
    }

    const result = await awardXP({ userId, classroomId, opts: { rawXP: amount } });
    if (!result.ok) return res.status(400).json({ error: `Cannot award XP: ${result.reason}` });

    cb.meta[onceKey] = true;
    await user.save();

    const io = req.app.get('io');
    if (io && result?.ok) {
      io.to(`classroom-${classroomId}`).emit('xp:update', {
        userId: String(userId),
        classroomId: String(classroomId),
        newXP: result.xp,
        newLevel: result.level,
        leveledUp: result.leveled
      });
    }

    return res.json({ ok: true, message: `+${amount} XP for challenge`, level: result.level, xp: result.xp });
  } catch (e) {
    console.error('challenge-complete error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

//award XP once per post in this classroom
router.post('/news-post', ensureStudentOrAbove, async (req, res) => {
  try {
    const { classroomId, postId } = req.body;
    const userId = req.user._id;

    if (!classroomId || !postId) {
      return res.status(400).json({ error: 'classroomId and postId required' });
    }

    const classroom = await Classroom.findById(classroomId).lean();
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    const settings = classroom.xpSettings || {};
    if (!settings.isXPEnabled) {
      return res.status(400).json({ error: 'XP system is disabled for this classroom' });
    }

    const xpRewards = settings.xpRewards || {};
    const amount = Number(xpRewards.newsPostXP || 0);
    if (amount <= 0) {
      return res.status(400).json({ error: 'News post XP is disabled' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    //don’t award XP twice for the same thing
    user.classroomBalances = user.classroomBalances || [];
    let cb = user.classroomBalances.find(c => String(c.classroom) === String(classroomId));
    if (!cb) {
      user.classroomBalances.push({ classroom: classroomId, balance: 0, xp: 0, level: 1, meta: {} });
      cb = user.classroomBalances[user.classroomBalances.length - 1];
    }
    cb.meta = cb.meta || {};
    const onceKey = `newsPost_${postId}`;
    if (cb.meta[onceKey]) {
      return res.status(200).json({ ok: true, message: 'Already awarded previously' });
    }

    const result = await awardXP({ userId, classroomId, opts: { rawXP: amount } });
    if (!result.ok) return res.status(400).json({ error: `Cannot award XP: ${result.reason}` });

    cb.meta[onceKey] = true;
    await user.save();

    const io = req.app.get('io');
    if (io && result?.ok) {
      io.to(`classroom-${classroomId}`).emit('xp:update', {
        userId: String(userId),
        classroomId: String(classroomId),
        newXP: result.xp,
        newLevel: result.level,
        leveledUp: result.leveled
      });
    }

    return res.json({ ok: true, message: `+${amount} XP for news post`, level: result.level, xp: result.xp });
  } catch (e) {
    console.error('news-post error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});


//award XP once per boost key in this classroom
router.post('/stats-boost', ensureStudentOrAbove, async (req, res) => {
  try {
    const { classroomId, boostKey } = req.body;
    const userId = req.user._id;

    if (!classroomId || !boostKey) {
      return res.status(400).json({ error: 'classroomId and boostKey required' });
    }

    const classroom = await Classroom.findById(classroomId).lean();
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    const settings = classroom.xpSettings || {};
    if (!settings.isXPEnabled) {
      return res.status(400).json({ error: 'XP system is disabled for this classroom' });
    }

    const xpRewards = settings.xpRewards || {};
    const amount = Number(xpRewards.xpPerStatsBoost || 0);
    if (amount <= 0) {
      return res.status(400).json({ error: 'Stats boost XP is disabled' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    //don’t award XP twice for the same thing
    user.classroomBalances = user.classroomBalances || [];
    let cb = user.classroomBalances.find(c => String(c.classroom) === String(classroomId));
    if (!cb) {
      user.classroomBalances.push({ classroom: classroomId, balance: 0, xp: 0, level: 1, meta: {} });
      cb = user.classroomBalances[user.classroomBalances.length - 1];
    }
    cb.meta = cb.meta || {};
    const onceKey = `statsBoost_${boostKey}`;
    if (cb.meta[onceKey]) {
      return res.status(200).json({ ok: true, message: 'Already awarded previously' });
    }

    const result = await awardXP({ userId, classroomId, opts: { rawXP: amount } });
    if (!result.ok) return res.status(400).json({ error: `Cannot award XP: ${result.reason}` });

    cb.meta[onceKey] = true;
    await user.save();

    const io = req.app.get('io');
    if (io && result?.ok) {
      io.to(`classroom-${classroomId}`).emit('xp:update', {
        userId: String(userId),
        classroomId: String(classroomId),
        newXP: result.xp,
        newLevel: result.level,
        leveledUp: result.leveled
      });
    }

    return res.json({ ok: true, message: `+${amount} XP for stats boost`, level: result.level, xp: result.xp });
  } catch (e) {
    console.error('stats-boost error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});



module.exports = router;
