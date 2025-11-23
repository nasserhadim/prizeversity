// const express = require('express');
// const router = express.Router();

// const Classroom = require('../models/Classroom');
// const User = require('../models/User');
// const { awardXP } = require('../utils/xp');

// // auth helpers (adjust to your auth stack)
// function ensureLoggedIn(req, res, next) {
//   if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
//   return next();
// }
// function ensureStudentOrAbove(req, res, next) {
//   if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
//   const role = req.user.role;
//   if (role === 'student' || role === 'teacher' || role === 'admin') return next();
//   return res.status(403).json({ error: 'Forbidden' });
// }

// // utility: returns yyyymmdd string (local) to bucket daily actions
// function todayStamp() {
//   const d = new Date();
//   const mm = String(d.getMonth() + 1).padStart(2, '0');
//   const dd = String(d.getDate()).padStart(2, '0');
//   return `${d.getFullYear()}${mm}${dd}`;
// }

// // POST /api/xpStudent/daily-checkin
// // awards daily check-in XP if enabled by teacher.
// // POST /api/xpStudent/daily-checkin
// // awards daily check-in XP if enabled by teacher (once per day per classroom)
// router.post('/daily-checkin', ensureStudentOrAbove, async (req, res) => {
//   try {
//     const { classroomId } = req.body;
//     const userId = req.user._id;

//     if (!classroomId) {
//       return res.status(400).json({ ok: false, error: 'classroomId required' });
//     }

//     const classroom = await Classroom.findById(classroomId).lean();
//     if (!classroom) {
//       return res.status(404).json({ ok: false, error: 'Classroom not found' });
//     }

//     const settings = classroom.xpSettings || {};
//     // only block if explicitly disabled
//     if (settings.isXPEnabled === false) {
//       return res.status(200).json({ ok: false, already: true });
//     }

//     const xpRewards = settings.xpRewards || {};
//     const perCheckIn = Number(xpRewards.dailyCheckInXP || 0);
//     if (!Number.isFinite(perCheckIn) || perCheckIn <= 0) {
//       return res.status(200).json({ ok: false, already: true });
//     }

//     // once per day per user+classroom using oneTimeKey
//     const stamp = todayStamp(); // e.g. "20251119"
//     const oneTimeKey = `dailyCheckIn_${stamp}`;

//     const result = await awardXP({
//       userId,
//       classroomId,
//       opts: {
//         rawXP: perCheckIn,
//         oneTimeKey, // award only once per day with this key
//       },
//     });

//     // second, third, etc. calls that day → NO XP, NO TOAST
//     if (!result.ok && result.reason === 'already-awarded') {
//       return res.status(200).json({
//         ok: false,
//         already: true,
//       });
//     }

//     // any other failure → treat like "already" so frontend stays quiet
//     if (!result.ok) {
//       return res.status(200).json({ ok: false, already: true });
//     }

//     // FIRST successful check-in of the day
//     return res.json({
//       ok: true,
//       xpAwarded: perCheckIn,
//       xp: result.xp,       // total after award
//       level: result.level,
//     });
//   } catch (e) {
//     console.error('daily-checkin error:', e);
//     return res.status(200).json({ ok: false, already: true });
//   }
// });



// // POST /api/xpStudent/group-join
// // awards XP on group join if enabled by teacher (groupJoinXP > 0).
// router.post('/group-join', ensureStudentOrAbove, async (req, res) => {
//   try {
//     const { classroomId } = req.body;
//     const userId = req.user._id;

//     if (!classroomId) return res.status(400).json({ error: 'classroomId required' });

//     const classroom = await Classroom.findById(classroomId).lean();
//     if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

//     const settings = classroom.xpSettings || {};
//     if (settings.isXPEnabled === false) {
//       return res.status(400).json({ error: 'XP system is disabled for this classroom' });
//     }



//     const xpRewards = settings.xpRewards || {};
//     const amount = Number(xpRewards.groupJoinXP || 0);
//     if (amount <= 0) {
//       return res.status(400).json({ error: 'Group-join XP not enabled' });
//     }

//     // one guard key per classroom
//     const result = await awardXP({
//       userId,
//       classroomId,
//       opts: {
//         rawXP: amount,
//         oneTimeKey: 'groupJoin_awarded',
//       },
//     });

//     if (!result.ok && result.reason === 'already-awarded') {
//       return res.status(200).json({ ok: true, message: 'Already awarded previously' });
//     }
//     if (!result.ok) {
//       return res.status(400).json({ error: `Cannot award XP: ${result.reason}` });
//     }

//     return res.json({
//       ok: true,
//       message: `+${amount} XP for group join`,
//       level: result.level,
//       xp: result.xp,
//     });
//   } catch (e) {
//     console.error('group-join error:', e);
//     return res.status(500).json({ error: 'Server error' });
//   }
// });

// // POST /api/xpStudent/mystery-box
// // awards XP on mystery-box use if enabled by teacher (mysteryBoxUseXP > 0).
// router.post('/mystery-box', ensureStudentOrAbove, async (req, res) => {
//   try {
//     const { classroomId } = req.body;
//     const userId = req.user._id;

//     if (!classroomId) return res.status(400).json({ error: 'classroomId required' });

//     const classroom = await Classroom.findById(classroomId).lean();
//     if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

//     const settings = classroom.xpSettings || {};
//     if (settings.isXPEnabled === false) {
//       return res.status(400).json({ error: 'XP system is disabled for this classroom' });
//     }



//     const xpRewards = settings.xpRewards || {};
//     const amount = Number(xpRewards.mysteryBoxUseXP || 0);
//     if (amount <= 0) {
//       return res.status(400).json({ error: 'Mystery-box XP is disabled' });
//     }

//     const result = await awardXP({
//       userId,
//       classroomId,
//       opts: { rawXP: amount },
//     });

//     if (!result.ok) {
//       return res.status(400).json({ error: `Cannot award XP: ${result.reason}` });
//     }

//     return res.json({
//       ok: true,
//       message: `+${amount} XP for using a Mystery Box`,
//       level: result.level,
//       xp: result.xp,
//     });
//   } catch (e) {
//     console.error('mystery-box error:', e);
//     return res.status(500).json({ error: 'Server error' });
//   }
// });

// // GET /api/xpStudent/:classroomId
// // get current user's XP and level info for given classroom
// router.get('/:classroomId', ensureStudentOrAbove, async (req, res) => {
//   try {
//     const classroomId = req.params.classroomId;
//     const userId = req.user._id;

//     const classroom = await Classroom.findById(classroomId).lean();
//     if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

//     const settings = classroom.xpSettings || {
//       isXPEnabled: true,
//       xpFormulaType: 'exponential',
//       baseXPLevel2: 100,
//     };
//     if (!settings.isXPEnabled) {
//       return res.status(400).json({ error: 'XP system is disabled for this classroom' });
//     }

//     const user = await User.findById(userId).select('classroomBalances').lean();
//     if (!user) return res.status(404).json({ error: 'User not found' });

//     const cb =
//       (user.classroomBalances || []).find(
//         c => String(c.classroom) === String(classroomId),
//       ) || {
//         xp: 0,
//         level: 1,
//       };

//     const level = Number(cb.level) || 1;
//     const xp = Number(cb.xp) || 0;

//     const base = Math.max(1, Number(settings.baseXPLevel2 ?? 100));
//     const xpFormulaType = settings.xpFormulaType || 'exponential';

//     const xpNeededForNextLevel = L => {
//       const levelSafe = Math.max(1, Number(L || 1));
//       switch (xpFormulaType) {
//         case 'linear':
//           return base;
//         case 'logarithmic':
//           return Math.max(1, Math.round(base * levelSafe * Math.log10(levelSafe + 1)));
//         case 'exponential':
//         default:
//           return Math.max(1, Math.round(base * Math.pow(1.5, levelSafe - 1)));
//       }
//     };

//     const nextLevelXP = xpNeededForNextLevel(level);

//     return res.json({ level, xp, nextLevelXP });
//   } catch (e) {
//     console.error('xpStudent GET error:', e);
//     return res.status(500).json({ error: 'Server error' });
//   }
// });

// module.exports = router;







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
// awards daily check-in XP if enabled by teacher (once per day per classroom)
router.post('/daily-checkin', ensureStudentOrAbove, async (req, res) => {
  try {
    const { classroomId } = req.body;
    const userId = req.user._id;

    if (!classroomId) {
      return res.status(400).json({ ok: false, error: 'classroomId required' });
    }

    const classroom = await Classroom.findById(classroomId).lean();
    if (!classroom) {
      return res.status(404).json({ ok: false, error: 'Classroom not found' });
    }

    const settings = classroom.xpSettings || {};
    // only block if explicitly disabled
    if (settings.isXPEnabled === false) {
      return res.status(200).json({ ok: false, already: true });
    }

      const xpRewards = settings.xpRewards || {};

    // 🔎 LOG what we actually have from DB
    console.log('[xpStudents /daily-checkin] xpSettings =', settings);
    console.log('[xpStudents /daily-checkin] xpRewards =', xpRewards);

    // we want the Daily Check-in limit in the (XP Gain Rates) to be the main source of XP for the check in
    const xpCfg = classroom.xpConfig || {};

    let rawPerCheckIn =
      xpRewards.dailyCheckInLimit ??   // XP Gain Rates "Daily Check-in limit"
      xpRewards.dailyCheckInXP ??      // fallback: older "Daily Check-in XP"
      xpCfg.dailyCheckinLimit ??       // legacy xpConfig (optional)
      xpCfg.dailyLogin ??              // very old fallback (optional)
      null;


    console.log('[xpStudents /daily-checkin] rawPerCheckIn =', rawPerCheckIn);

    // If teacher didn't set anything valid → NO XP
    const perCheckInNum = Number(rawPerCheckIn);
    if (!Number.isFinite(perCheckInNum) || perCheckInNum <= 0) {
      return res.status(200).json({ ok: false, already: true });
    }

    let perCheckIn = perCheckInNum;
    console.log('[xpStudents /daily-checkin] perCheckIn (number) =', perCheckIn);


    // once per day per user+classroom using oneTimeKey
    const stamp = todayStamp(); // e.g. "20251119"
    const oneTimeKey = `dailyCheckIn_${stamp}`;

    const result = await awardXP({
      userId,
      classroomId,
      opts: {
        rawXP: perCheckIn,
        oneTimeKey, // award only once per day with this key
      },
    });

    // second, third, etc. calls that day → NO XP, NO TOAST
    if (!result.ok && result.reason === 'already-awarded') {
      return res.status(200).json({
        ok: false,
        already: true,
      });
    }

    // any other failure → treat like "already" so frontend stays quiet
    if (!result.ok) {
      console.log('[xpStudents /daily-checkin] awardXP failure:', result);
      return res.status(200).json({ ok: false, already: true });
    }

    // FIRST successful check-in of the day
    return res.json({
      ok: true,
      xpAwarded: perCheckIn,
      xp: result.xp,       // total after award
      level: result.level,
    });
  } catch (e) {
    console.error('daily-checkin error:', e);
    return res.status(200).json({ ok: false, already: true });
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
    if (settings.isXPEnabled === false) {
      return res.status(400).json({ error: 'XP system is disabled for this classroom' });
    }

    const xpRewards = settings.xpRewards || {};
    let amount =
      xpRewards.groupJoinXP ??
      settings.groupJoinXP ??
      null;

    if (!Number.isFinite(Number(amount))) {
      return res.status(400).json({ error: 'Group-join XP not enabled' });
    }

    amount = Number(amount);
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
    if (settings.isXPEnabled === false) {
      return res.status(400).json({ error: 'XP system is disabled for this classroom' });
    }

    const xpRewards = settings.xpRewards || {};
    let amount =
      xpRewards.mysteryBoxUseXP ??
      settings.mysteryBoxUseXP ??
      null;

    if (!Number.isFinite(Number(amount))) {
      return res.status(400).json({ error: 'Mystery-box XP is disabled' });
    }

    amount = Number(amount);
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
