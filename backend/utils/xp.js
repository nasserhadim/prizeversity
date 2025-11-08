const Classroom = require('../models/Classroom');
const User = require('../models/User');

//calculate how much XP is needed to go from current level tp next level
// function xpNeededForNextLevel(level, { xpFormulaType = 'exponential', baseXPLevel2 = 100 }) {
//   const L = Math.max(1, Number(level || 1));
//   const base = Math.max(1, Number(baseXPLevel2 || 100));

//   switch (xpFormulaType) {
//     case 'linear':
//       //same XP cost each level
//       return base;

//     case 'logarithmic':
//       //easier early levels, slower later
//       return Math.max(1, Math.round(base * L * Math.log10(L + 1)));

//     case 'exponential':
//     default:
//       //standard: grows about 50% per level
//       return Math.max(1, Math.round(base * Math.pow(1.5, L - 1)));
//   }
// }


// XP needed to go from *current* level -> next level.
// Uses teacher settings: baseXPLevel2 and xpFormulaType.
// Matches frontend utils/xp.js exactly.
function xpNeededForNextLevel(level, settings = {}) {
  const base = Number(settings?.baseXPLevel2 ?? 100);
  const formula = settings?.xpFormulaType ?? 'exponential';
  const L = Math.max(1, Number(level) || 1);

  if (L <= 1) return base; // L1 -> L2 uses base

  switch (formula) {
    case 'linear':
      // same cost every level after 1
      return base;

    case 'logarithmic':
      // gentle growth
      return Math.max(10, Math.floor(base * (1 + Math.log(L))));

    case 'exponential':
    default:
      // grows ~1.5x per level after L2
      return Math.floor(base * Math.pow(1.5, L - 2));
  }
}



//only these XP reward keys are valid for bit-based XP
const ALLOWED_REWARD_KEYS = new Set([
  'xpPerBitEarned',
  'xpPerBitSpent'
]);

//Add XP to a student's classroom balance if XP is enabled
//opts: { rawXP, rawBits, bitsMode, rewardKey, oneTimeKey, roundXP }
async function awardXP({ userId, classroomId, opts = {} }) {
  const classroom = await Classroom.findById(classroomId).lean();
  if (!classroom) return { ok: false, reason: 'no-classroom' };

  const settings = classroom.xpSettings || {};
  if (settings.isXPEnabled === false) return { ok: false, reason: 'xp-disabled' };

  const user = await User.findById(userId);
  if (!user) return { ok: false, reason: 'no-user' };

  //find orr create classroom balance
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

  //will prevent  multiple one time XP rewards (like group join)
  if (opts.oneTimeKey && cb.meta[opts.oneTimeKey]) {
    await user.save();
    return { ok: false, reason: 'already-awarded' };
  }

  let xpToAdd = 0;

  //direct XP (for exam ep fromrom challenges or boosts)
  if (typeof opts.rawXP === 'number' && isFinite(opts.rawXP)) {
    xpToAdd += Math.max(0, opts.rawXP);
  }

  //bits converted to XP (earned/spent only)
  if (
    typeof opts.rawBits === 'number' &&
    isFinite(opts.rawBits) &&
    opts.rewardKey &&
    ALLOWED_REWARD_KEYS.has(opts.rewardKey)
  ) {
    const defaultMode = settings.bitToXpCountMode === 'base' ? 'base' : 'final';
    const mode = opts.bitsMode || defaultMode;
    const bitsForXP = Math.max(0, opts.rawBits);
    const rate = Number(settings.xpRewards?.[opts.rewardKey] || 0);
    if (rate > 0) xpToAdd += bitsForXP * rate;
  }

  if (xpToAdd <= 0) {
    await user.save();
    return { ok: false, reason: 'zero-xp' };
  }

  if (opts.roundXP !== false) xpToAdd = Math.round(xpToAdd);

  //aply XP and handle level-ups
  cb.xp += xpToAdd;
  let leveled = false;
  for (;;) {
    const need = xpNeededForNextLevel(cb.level, settings);
    if (cb.xp >= need) {
      cb.level += 1;
      cb.xp -= need;
      leveled = true;
    } else break;
  }

  if (opts.oneTimeKey) cb.meta[opts.oneTimeKey] = true;

  await user.save();
  const need = xpNeededForNextLevel(cb.level, settings);
  return { ok: true, leveled, level: cb.level, xp: cb.xp, need, added: xpToAdd };

}

module.exports = {
  xpNeededForNextLevel,
  awardXP,
  ALLOWED_REWARD_KEYS
};
