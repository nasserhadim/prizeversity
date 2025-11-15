// backend/routes/xpSettings.js
const express = require('express');
const router = express.Router();
const Classroom = require('../models/Classroom');

// Middleware - verifies teacher/admin (placeholder for now)
// const ensureTeacherOrAdmin = async (req, res, next) => {
//   // Add your authentication logic later
//   return next();
// };
async function ensureClassMember(req, res, next) {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    if (user.role === 'admin') return next();

    const cls = await Classroom.findById(req.params.classroomId)
      .select('teacher students')
      .lean();
    if (!cls) return res.status(404).json({ error: 'Classroom not found' });

    const isTeacher = String(cls.teacher) === String(user._id);
    const isStudent = (cls.students || []).some(s => String(s) === String(user._id));

    return (isTeacher || isStudent)
      ? next()
      : res.status(403).json({ error: 'Not a member of this classroom' });
  } catch (e) {
    return next(e);
  }
}

const ensureTeacherOrAdmin = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    if (user.role === 'admin') return next();

    const cls = await Classroom.findById(req.params.classroomId).select('teacher');
    if (!cls) return res.status(404).json({ error: 'Classroom not found' });

    if (user.role === 'teacher' && String(user._id) === String(cls.teacher)) {
      return next();
    }
    return res.status(403).json({ error: 'Only the classroom teacher/admin may modify XP settings' });
  } catch (e) {
    return next(e);
  }
};


// GET - retrieve XP settings for a classroom
// router.get('/:classroomId', ensureTeacherOrAdmin, async (req, res) => {
//   try {
//     const classroom = await Classroom.findById(req.params.classroomId).lean();
//     if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

//     const defaults = {
//       isXPEnabled: true,
//       xpFormulaType: 'exponential',
//       baseXPLevel2: 100,
//       bitToXpCountMode: 'final',
//       xpRewards: {
//         xpPerBitEarned: 1,
//         xpPerBitSpent: 0.5,
//         xpPerStatsBoost: 10,
//         dailyCheckInXP: 5,
//         dailyCheckInLimit: 1,
//         groupJoinXP: 10,
//         challengeXP: 25,
//         mysteryBoxUseXP: 0,
//       },
//     };

//     const current = classroom.xpSettings || {};
//     const merged = {
//       ...defaults,
//       ...current,
//       xpRewards: { ...defaults.xpRewards, ...(current.xpRewards || {}) },
//     };

//     res.json(merged);
//   } catch (e) {
//     console.error('xpSettings GET error:', e);
//     res.status(500).json({ error: 'Server error' });
//   }
// });

// GET - retrieve XP settings for a classroom
router.get('/:classroomId', ensureClassMember, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.classroomId).lean();
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    const defaults = {
      isXPEnabled: true,
      xpFormulaType: 'exponential',
      baseXPLevel2: 100,
      bitToXpCountMode: 'final',
      xpRewards: {
        xpPerBitEarned: 1,
        xpPerBitSpent: 0.5,
        xpPerStatsBoost: 10,
        dailyCheckInXP: 5,
        dailyCheckInLimit: 1,
        groupJoinXP: 10,
        challengeXP: 25,
        mysteryBoxUseXP: 0,
      },
    };

    const current = classroom.xpSettings || {};
    const merged = {
      ...defaults,
      ...current,
      xpRewards: { ...defaults.xpRewards, ...(current.xpRewards || {}) },
    };

    res.json(merged);
  } catch (e) {
    console.error('xpSettings GET error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});



// POST - save or update XP settings for a classroom
router.post('/:classroomId', ensureTeacherOrAdmin, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.classroomId);
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    const body = req.body || {};

    const cleaned = {
      isXPEnabled: body.isXPEnabled === true || body.isXPEnabled === 'true',
      xpFormulaType: ['linear', 'exponential', 'logarithmic'].includes(body.xpFormulaType)
        ? body.xpFormulaType
        : 'exponential',
      baseXPLevel2: Math.max(1, Number(body.baseXPLevel2 ?? 100)),
      bitToXpCountMode: ['base', 'final'].includes(body.bitToXpCountMode)
        ? body.bitToXpCountMode
        : 'final',
      xpRewards: {
        xpPerBitEarned: Number(body?.xpRewards?.xpPerBitEarned ?? 1),
        xpPerBitSpent: Number(body?.xpRewards?.xpPerBitSpent ?? 0.5),
        xpPerStatsBoost: Number(body?.xpRewards?.xpPerStatsBoost ?? 10),
        dailyCheckInXP: Number(body?.xpRewards?.dailyCheckInXP ?? 5),
        dailyCheckInLimit: Math.max(0, Number(body?.xpRewards?.dailyCheckInLimit ?? 1)),
        groupJoinXP: Number(body?.xpRewards?.groupJoinXP ?? 10),
        challengeXP: Number(body?.xpRewards?.challengeXP ?? 25),
        mysteryBoxUseXP: Number(body?.xpRewards?.mysteryBoxUseXP ?? 0),
      },
    };

    classroom.xpSettings = cleaned;
    await classroom.save();

    res.json(classroom.xpSettings);
  } catch (e) {
    console.error('xpSettings POST error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
