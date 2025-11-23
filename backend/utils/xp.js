// // const Classroom = require('../models/Classroom');
// // const User = require('../models/User');

// // //calculate how much XP is needed to go from current level tp next level
// // function xpNeededForNextLevel(level, { xpFormulaType = 'exponential', baseXPLevel2 = 100 }) {
// //   const L = Math.max(1, Number(level || 1));
// //   const base = Math.max(1, Number(baseXPLevel2 || 100));

// //   switch (xpFormulaType) {
// //     case 'linear':
// //       //same XP cost each level
// //       return base;

// //     case 'logarithmic':
// //       //easier early levels, slower later
// //       return Math.max(1, Math.round(base * L * Math.log10(L + 1)));

// //     case 'exponential':
// //     default:
// //       //standard: grows about 50% per level
// //       return Math.max(1, Math.round(base * Math.pow(1.5, L - 1)));
// //   }
// // }

// // //only these XP reward keys are valid for bit-based XP
// // const ALLOWED_REWARD_KEYS = new Set([
// //   'xpPerBitEarned',
// //   'xpPerBitSpent'
// // ]);

// // //Add XP to a student's classroom balance if XP is enabled
// // //opts: { rawXP, rawBits, bitsMode, rewardKey, oneTimeKey, roundXP }
// // async function awardXP({ userId, classroomId, opts = {} }) {
// //   const classroom = await Classroom.findById(classroomId).lean();
// //   if (!classroom) return { ok: false, reason: 'no-classroom' };

// //   const settings = classroom.xpSettings || {};
// //   if (!settings.isXPEnabled) return { ok: false, reason: 'xp-disabled' };

// //   const user = await User.findById(userId);
// //   if (!user) return { ok: false, reason: 'no-user' };

// //   //find orr create classroom balance
// //   let cb = user.classroomBalances?.find(c => String(c.classroom) === String(classroomId));
// //   if (!cb) {
// //     user.classroomBalances.push({
// //       classroom: classroomId,
// //       balance: 0,
// //       xp: 0,
// //       level: 1,
// //       meta: {}
// //     });
// //     cb = user.classroomBalances[user.classroomBalances.length - 1];
// //   }
// //   cb.meta = cb.meta || {};

// //   //will prevent  multiple one time XP rewards (like group join)
// //   if (opts.oneTimeKey && cb.meta[opts.oneTimeKey]) {
// //     await user.save();
// //     return { ok: false, reason: 'already-awarded' };
// //   }

// //   let xpToAdd = 0;

// //   //direct XP (for exam ep fromrom challenges or boosts)
// //   if (typeof opts.rawXP === 'number' && isFinite(opts.rawXP)) {
// //     xpToAdd += Math.max(0, opts.rawXP);
// //   }

// //   //bits converted to XP (earned/spent only)
// //   if (
// //     typeof opts.rawBits === 'number' &&
// //     isFinite(opts.rawBits) &&
// //     opts.rewardKey &&
// //     ALLOWED_REWARD_KEYS.has(opts.rewardKey)
// //   ) {
// //     const defaultMode = settings.bitToXpCountMode === 'base' ? 'base' : 'final';
// //     const mode = opts.bitsMode || defaultMode;
// //     const bitsForXP = Math.max(0, opts.rawBits);
// //     const rate = Number(settings.xpRewards?.[opts.rewardKey] || 0);
// //     if (rate > 0) xpToAdd += bitsForXP * rate;
// //   }

// //   if (xpToAdd <= 0) {
// //     await user.save();
// //     return { ok: false, reason: 'zero-xp' };
// //   }

// //   if (opts.roundXP !== false) xpToAdd = Math.round(xpToAdd);

// //   //aply XP and handle level-ups
// //   cb.xp += xpToAdd;
// //   let leveled = false;
// //   for (;;) {
// //     const need = xpNeededForNextLevel(cb.level, settings);
// //     if (cb.xp >= need) {
// //       cb.level += 1;
// //       cb.xp -= need;
// //       leveled = true;
// //     } else break;
// //   }

// //   if (opts.oneTimeKey) cb.meta[opts.oneTimeKey] = true;

// //   await user.save();
// //   return { ok: true, leveled, level: cb.level, xp: cb.xp, added: xpToAdd };
// // }

// // module.exports = {
// //   xpNeededForNextLevel,
// //   awardXP,
// //   ALLOWED_REWARD_KEYS
// // };

// // eveything cokmente dout to see issue with bar movements xp 


// // backend/utils/xp.js
// const Classroom = require('../models/Classroom');
// const User = require('../models/User');

// // How much XP is needed to go from current level to next
// function xpNeededForNextLevel(level, { xpFormulaType = 'exponential', baseXPLevel2 = 100 }) {
//   const L = Math.max(1, Number(level || 1));
//   const base = Math.max(1, Number(baseXPLevel2 || 100));

//   switch (xpFormulaType) {
//     case 'linear':
//       // same XP cost each level
//       return base;

//     case 'logarithmic':
//       // easier early levels, slower later
//       return Math.max(1, Math.round(base * L * Math.log10(L + 1)));

//     case 'exponential':
//     default:
//       // grows about 50% per level from level 2 baseline
//       return Math.max(1, Math.round(base * Math.pow(1.5, L - 1)));
//   }
// }

// // Only these XP reward keys are valid for bit-based XP
// const ALLOWED_REWARD_KEYS = new Set([
//   'xpPerBitEarned',
//   'xpPerBitSpent',
// ]);

// /**
//  * Add XP to a user's classroom balance if XP is enabled.
//  * We ONLY award XP to STUDENTS (per your request).
//  *
//  * opts: {
//  *   rawXP?: number,           // direct XP (e.g., challenge rewards)
//  *   rawBits?: number,         // bits amount to convert to XP
//  *   bitsMode?: 'base'|'final',// which bits figure to use (default comes from settings)
//  *   rewardKey?: 'xpPerBitEarned'|'xpPerBitSpent',
//  *   oneTimeKey?: string,      // prevent duplicate awards
//  *   roundXP?: boolean         // default true
//  * }
//  */
// async function awardXP({ userId, classroomId, opts = {} }) {
//   const classroom = await Classroom.findById(classroomId).lean();
//   if (!classroom) return { ok: false, reason: 'no-classroom' };

//   const settings = classroom.xpSettings || {};
//   if (!settings.isXPEnabled) return { ok: false, reason: 'xp-disabled' };

//   const user = await User.findById(userId);
//   if (!user) return { ok: false, reason: 'no-user' };

//   // 🚫 Only students should get XP
//   if (String(user.role) !== 'student') {
//     return { ok: false, reason: 'not-student' };
//   }

//   // Ensure balances array exists
//   if (!Array.isArray(user.classroomBalances)) {
//     user.classroomBalances = [];
//   }

//   // Find or create classroom balance
//   let cb = user.classroomBalances.find(c => String(c.classroom) === String(classroomId));
//   if (!cb) {
//     user.classroomBalances.push({
//       classroom: classroomId,
//       balance: 0,
//       xp: 0,
//       level: 1,
//       meta: {},
//     });
//     cb = user.classroomBalances[user.classroomBalances.length - 1];
//   }
//   cb.meta = cb.meta || {};

//   // Prevent duplicate one-time XP rewards
//   if (opts.oneTimeKey && cb.meta[opts.oneTimeKey]) {
//     await user.save();
//     return { ok: false, reason: 'already-awarded' };
//   }

//   let xpToAdd = 0;

//   // Direct XP (e.g., challenge rewards)
//   if (typeof opts.rawXP === 'number' && Number.isFinite(opts.rawXP)) {
//     xpToAdd += Math.max(0, opts.rawXP);
//   }

//   // Convert bits to XP (earned/spent only through allowed keys)
//   if (
//     typeof opts.rawBits === 'number' &&
//     Number.isFinite(opts.rawBits) &&
//     opts.rewardKey &&
//     ALLOWED_REWARD_KEYS.has(opts.rewardKey)
//   ) {
//     // Decide which bits mode to use (base vs final) — default from settings
//     const defaultMode = settings.bitToXpCountMode === 'base' ? 'base' : 'final';
//     const mode = opts.bitsMode || defaultMode;

//     // Currently we only need the numeric amount (base/final handled at caller if needed)
//     const bitsForXP = Math.max(0, opts.rawBits);

//     const rate = Number(settings.xpRewards?.[opts.rewardKey] || 0);
//     if (rate > 0) xpToAdd += bitsForXP * rate;
//   }

//   if (xpToAdd <= 0) {
//     await user.save();
//     return { ok: false, reason: 'zero-xp' };
//   }

//   if (opts.roundXP !== false) xpToAdd = Math.round(xpToAdd);

//   // Apply XP and handle level-ups
//   cb.xp += xpToAdd;
//   let leveled = false;

//   for (;;) {
//     const need = xpNeededForNextLevel(cb.level, settings);
//     if (cb.xp >= need) {
//       cb.level += 1;
//       cb.xp -= need;
//       leveled = true;
//     } else {
//       break;
//     }
//   }

//   if (opts.oneTimeKey) cb.meta[opts.oneTimeKey] = true;

// // Optional: track total XP (only if you like)
// // if (typeof cb.xpTotal !== 'number') cb.xpTotal = 0;
// // cb.xpTotal += xpToAdd;

// // How much XP is needed for the *next* level from where we are now
// const nextNeed = xpNeededForNextLevel(cb.level, settings);

// await user.save();

// return {
//   ok: true,
//   leveled,          // true if at least one level-up happened
//   level: cb.level,  // CURRENT level
//   xp: cb.xp,        // XP inside this level (0 up to nextNeed-1)
//   // xpTotal: cb.xpTotal,   // uncomment if you decide to track it
//   nextNeed,
//   added: xpToAdd,
// };

// }

// module.exports = {
//   xpNeededForNextLevel,
//   awardXP,
//   ALLOWED_REWARD_KEYS,
// };


// backend/utils/xp.js
const Classroom = require('../models/Classroom');
const User = require('../models/User');

// How much XP is needed to go from current level to next
function xpNeededForNextLevel(level, { xpFormulaType = 'exponential', baseXPLevel2 = 100 }) {
  const L = Math.max(1, Number(level || 1));
  const base = Math.max(1, Number(baseXPLevel2 || 100));

  switch (xpFormulaType) {
    case 'linear':
      // same XP cost each level
      return base;

    case 'logarithmic':
      // easier early levels, slower later
      return Math.max(1, Math.round(base * L * Math.log10(L + 1)));

    case 'exponential':
    default:
      // grows about 50% per level from level 2 baseline
      return Math.max(1, Math.round(base * Math.pow(1.5, L - 1)));
  }
}

// Only these XP reward keys are valid for bit-based XP
const ALLOWED_REWARD_KEYS = new Set([
  'xpPerBitEarned',
  'xpPerBitSpent',
]);

/**
 * Add XP to a user's classroom balance if XP is enabled.
 *
 * opts: {
 *   rawXP?: number,
 *   rawBits?: number,
 *   bitsMode?: 'base'|'final',
 *   rewardKey?: 'xpPerBitEarned'|'xpPerBitSpent',
 *   oneTimeKey?: string,
 *   roundXP?: boolean
 * }
 */
async function awardXP({ userId, classroomId, opts = {} }) {
  console.log('\n[XP] awardXP called', {
    userId: String(userId),
    classroomId: String(classroomId),
    opts,
  });

  const classroom = await Classroom.findById(classroomId).lean();
  if (!classroom) {
    console.warn('[XP] no classroom found');
    return { ok: false, reason: 'no-classroom' };
  }

  // merge classroom.xpSettings with defaults so every classroom works by default
  const rawSettings = classroom.xpSettings || {};
  const defaultSettings = {
    isXPEnabled: true,               // XP ON by default unless explicitly turned off
    xpFormulaType: 'exponential',
    baseXPLevel2: 100,
    bitToXpCountMode: 'final',
    xpRewards: {
      xpPerBitEarned:    1,
      xpPerBitSpent:     0.5,
      xpPerStatsBoost:   10,
      dailyCheckInXP:    5,
      dailyCheckInLimit: 1,
      groupJoinXP:       10,
      challengeXP:       25,
      mysteryBoxUseXP:   0,
    },
  };

  const settings = {
    ...defaultSettings,
    ...rawSettings,
    xpRewards: {
      ...defaultSettings.xpRewards,
      ...(rawSettings.xpRewards || {}),
    },
  };

  if (!settings.isXPEnabled) {
    console.warn('[XP] xp disabled for classroom', classroomId);
    return { ok: false, reason: 'xp-disabled' };
  }

  const user = await User.findById(userId);
  if (!user) {
    console.warn('[XP] no user found');
    return { ok: false, reason: 'no-user' };
  }

  // 🚫 Only students should get XP
  if (String(user.role) !== 'student') {
    console.warn('[XP] user is not a student, skipping XP', {
      userId: String(user._id),
      role: user.role,
    });
    return { ok: false, reason: 'not-student' };
  }

  // Ensure balances array exists
  if (!Array.isArray(user.classroomBalances)) {
    user.classroomBalances = [];
  }

  // Find or create classroom balance
  let cb = user.classroomBalances.find(c => String(c.classroom) === String(classroomId));
  if (!cb) {
    console.log('[XP] no classroomBalance entry found, creating new one');
    user.classroomBalances.push({
      classroom: classroomId,
      balance: 0,
      xp: 0,
      level: 1,
      meta: {},
    });
    cb = user.classroomBalances[user.classroomBalances.length - 1];
  }
  cb.meta = cb.meta || {};

  console.log('[XP] BEFORE calc', {
    level: cb.level,
    xp: cb.xp,
    classroomId: String(classroomId),
  });

  // Prevent duplicate one-time XP rewards
  if (opts.oneTimeKey && cb.meta[opts.oneTimeKey]) {
    console.warn('[XP] oneTimeKey already used, skipping', opts.oneTimeKey);
    await user.save();
    return { ok: false, reason: 'already-awarded' };
  }

  let xpToAdd = 0;

  // Direct XP (e.g., challenge rewards, stat boosts, mystery box, etc.)
  if (typeof opts.rawXP === 'number' && Number.isFinite(opts.rawXP)) {
    xpToAdd += Math.max(0, opts.rawXP);
  }

  // Convert bits to XP (earned/spent only through allowed keys)
  if (
    typeof opts.rawBits === 'number' &&
    Number.isFinite(opts.rawBits) &&
    opts.rewardKey &&
    ALLOWED_REWARD_KEYS.has(opts.rewardKey)
  ) {
    const defaultMode = settings.bitToXpCountMode === 'base' ? 'base' : 'final';
    const mode = opts.bitsMode || defaultMode;

    const bitsForXP = Math.max(0, opts.rawBits);
    const rate = Number(settings.xpRewards?.[opts.rewardKey] || 0);

    console.log('[XP] bit->xp conversion', {
      rawBits: opts.rawBits,
      bitsForXP,
      rewardKey: opts.rewardKey,
      mode,
      rate,
    });

    if (rate > 0) xpToAdd += bitsForXP * rate;
  }

  if (xpToAdd <= 0) {
    console.warn('[XP] xpToAdd is zero or negative, skipping', { xpToAdd });
    await user.save();
    return { ok: false, reason: 'zero-xp' };
  }

  if (opts.roundXP !== false) xpToAdd = Math.round(xpToAdd);

  // Apply XP and handle level-ups
  cb.xp = Number(cb.xp || 0) + xpToAdd;
  cb.level = cb.level || 1;

  console.log('[XP] AFTER add, BEFORE level loop', {
    added: xpToAdd,
    level: cb.level,
    xp: cb.xp,
  });

  let leveled = false;

  for (;;) {
    const need = xpNeededForNextLevel(cb.level, settings);
    console.log('[XP] level loop', {
      currentLevel: cb.level,
      xp: cb.xp,
      need,
    });

    if (cb.xp >= need) {
      cb.level += 1;
      cb.xp -= need;
      leveled = true;
      console.log('[XP] LEVEL UP!', {
        newLevel: cb.level,
        remainingXP: cb.xp,
      });
    } else {
      break;
    }
  }

  if (opts.oneTimeKey) {
    cb.meta[opts.oneTimeKey] = true;
  }

  await user.save();

  console.log('[XP] FINAL state saved', {
    userId: String(user._id),
    classroomId: String(classroomId),
    level: cb.level,
    xp: cb.xp,
    leveled,
  });

  return { ok: true, leveled, level: cb.level, xp: cb.xp, added: xpToAdd };
}

module.exports = {
  xpNeededForNextLevel,
  awardXP,
  ALLOWED_REWARD_KEYS,
};
