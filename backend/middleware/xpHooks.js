// //backend/middlewares/xpHooks.js
// const { awardXP } = require('../utils/xp');
// const Classroom = require('../models/Classroom');


// // convert bits to xp and award it using awardxp



// //award XP when Bits are earned
// async function xpOnBitsEarned({ userId, classroomId, bitsEarned, bitsMode = 'final' }) {
//   try {
//     //const classroom = await Classroom.findById(classroomId).lean();
//     //if (!classroom || !classroom.xpSettings?.isXPEnabled) return { ok: false, reason: 'xp-disabled'};
//     const bitsNum = Number(bitsEarned);
//         if (!Number.isFinite(bitsNum) || bitsNum <= 0) {
//           return { ok: false, reason: 'no-bits' };
//         }
//         const classroom = await Classroom.findById(classroomId).lean();
//         if (!classroom || !classroom.xpSettings?.isXPEnabled) {
//           return { ok: false, reason: 'xp-disabled' };
//         }

//     const settings = classroom.xpSettings || {};
//     const rewards = settings.xpRewards || {};

//     //find conversion rate; fallback to 1 if not defined
//     // const rate = Number(rewards.bitsToXp || 1);

//     // const rawXP = bitsEarned * rate;
//     //use teacher-configured conversion (XP per Bit Earned)
//     //xp per bit earned
//     const rate = Math.max(0, Number(rewards.xpPerBitEarned ?? 1));
//     const rawXP =  Math.round(bitsNum * rate);

//     if (rawXP <= 0) return { ok: false, reason: 'zero-xp' };
//     //teacher prefrence for base/final
//     const mode = bitsMode || (settings.bitToXpCountMode === 'base' ? 'base' : 'final');

//     const result = await awardXP({
//       userId,
//       classroomId,
//       opts: {
//         rawXP,
//         rawBits: bitsNum,
//         bitsMode: mode,
//         rewardKey: 'xpPerBitEarned'
//       }
//     });
//     return result; //returning the award xp result so callers can emit the xp updates
//   } catch (err) {
//     console.warn('[XP Hook] xpOnBitsEarned failed:', err.message);
//     return { ok: false, reason: 'error', error: err.message };
//   }
// }

// module.exports = { xpOnBitsEarned };

//commented out above for testing pruposes. 
// backend/middleware/xpHooks.js
'use strict';

const { awardXP } = require('../utils/xp');
const Classroom = require('../models/Classroom');

// XP from Bits Earned (teacher/admin awards, etc.)
async function xpOnBitsEarned({ userId, classroomId, bitsEarned, bitsMode = 'final' }) {
  try {
    const classroom = await Classroom.findById(classroomId).lean();
    if (!classroom || classroom?.xpSettings?.isXPEnabled === false) {
      return { ok: false, reason: 'xp-disabled' };
    }

    const settings = classroom.xpSettings || {};
    const rate = Number(settings.xpRewards?.xpPerBitEarned ?? 1);
    const bits = Math.max(0, Number(bitsEarned || 0));
    const rawXP = Math.round(bits * Math.max(0, rate));
    if (rawXP <= 0) return { ok: false, reason: 'zero-xp' };

    const result = await awardXP({
      userId,
      classroomId,
      opts: {
        rawXP,
        rawBits: bits,
        bitsMode: bitsMode || (settings.bitToXpCountMode === 'base' ? 'base' : 'final'),
        rewardKey: 'xpPerBitEarned',
      },
    });
    return result;
  } catch (err) {
    console.warn('[XP Hook] xpOnBitsEarned failed:', err.message);
    return { ok: false, reason: 'error' };
  }
}

// NEW: XP from Bits Spent (bazaar purchases)
async function xpOnBitsSpentPurchase({ userId, classroomId, spentBits, bitsMode = 'final' }) {
  try {
    const classroom = await Classroom.findById(classroomId).lean();
    if (!classroom || classroom?.xpSettings?.isXPEnabled === false) {
      return { ok: false, reason: 'xp-disabled' };
    }

    const settings = classroom.xpSettings || {};
    const rate = Number(settings.xpRewards?.xpPerBitSpent ?? 0);
    const bits = Math.max(0, Number(spentBits || 0));
    const rawXP = Math.round(bits * Math.max(0, rate));
    if (rawXP <= 0) return { ok: false, reason: 'zero-xp' };

    const result = await awardXP({
      userId,
      classroomId,
      opts: {
        rawXP,
        rawBits: bits,
        bitsMode: bitsMode || (settings.bitToXpCountMode === 'base' ? 'base' : 'final'),
        rewardKey: 'xpPerBitSpent',
      },
    });
    return result;
  } catch (err) {
    console.warn('[XP Hook] xpOnBitsSpentPurchase failed:', err.message);
    return { ok: false, reason: 'error' };
  }
}

module.exports = {
  xpOnBitsEarned,
  xpOnBitsSpentPurchase,
};
