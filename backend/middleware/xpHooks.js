// // //backend/middlewares/xpHooks.js
// // const { awardXP } = require('../utils/xp');
// // const Classroom = require('../models/Classroom');

// // //award XP when Bits are earned
// // async function xpOnBitsEarned({ userId, classroomId, bitsEarned, bitsMode = 'final' }) {
// //   try {
// //     const classroom = await Classroom.findById(classroomId).lean();
// //     if (!classroom || !classroom.xpSettings?.isXPEnabled) return;

// //     const settings = classroom.xpSettings || {};
// //     const rewards = settings.xpRewards || {};

// //     //find conversion rate; fallback to 1 if not defined
// //     const rate = Number(rewards.bitsToXp || 1);

// //     const rawXP = bitsEarned * rate;

// //     await awardXP({
// //       userId,
// //       classroomId,
// //       opts: {
// //         rawXP,
// //         rawBits: bitsEarned,
// //         bitsMode,
// //         rewardKey: 'bitsToXp'
// //       }
// //     });
// //   } catch (err) {
// //     console.warn('[XP Hook] xpOnBitsEarned failed:', err.message);
// //   }
// // }

// // module.exports = { xpOnBitsEarned };




// // backend/middlewares/xpHooks.js
// const { awardXP } = require('../utils/xp');
// const Classroom = require('../models/Classroom');

// /**
//  * Award XP when Bits are EARNED.
//  * - Respects classroom.xpSettings.isXPEnabled
//  * - Uses xpRewards.xpPerBitEarned conversion rate (if > 0)
//  * - Defers role-gating (students only) to awardXP()
//  *
//  * @param {Object} params
//  * @param {string} params.userId
//  * @param {string} params.classroomId
//  * @param {number} params.bitsEarned   // positive number of bits just earned
//  * @param {'base'|'final'} [params.bitsMode='final'] // which bits figure to count (defaults to classroom setting if not provided)
//  */
// async function xpOnBitsEarned({ userId, classroomId, bitsEarned, bitsMode = 'final' }) {
//   try {
//     if (!userId || !classroomId || !Number.isFinite(bitsEarned) || bitsEarned <= 0) {
//       return; // nothing to do or invalid payload
//     }

//     const classroom = await Classroom.findById(classroomId).lean();
//     if (!classroom || !classroom?.xpSettings?.isXPEnabled) return;

//     // We don’t calculate conversion here; awardXP will read:
//     //   classroom.xpSettings.xpRewards.xpPerBitEarned
//     // and multiply by rawBits.
//     await awardXP({
//       userId,
//       classroomId,
//       opts: {
//         rawBits: bitsEarned,
//         bitsMode,                 // 'base' | 'final' (awardXP handles defaulting)
//         rewardKey: 'xpPerBitEarned',
//         roundXP: true,
//       }
//     });
//   } catch (err) {
//     console.warn('[XP Hook] xpOnBitsEarned failed:', err.message);
//   }
// }

// module.exports = { xpOnBitsEarned };

// middleware/xpHooks.js
const { awardXP } = require('../utils/xp');
const Classroom = require('../models/Classroom');
const { getIO } = require('../utils/io');


// Wrapper used by checkout/buy routes: accepts { spentBits } and forwards to xpOnBitsSpent
async function xpOnBitsSpentPurchase({ userId, classroomId, spentBits, bitsMode = 'final' }) {
  return xpOnBitsSpent({ userId, classroomId, bitsSpent: spentBits, bitsMode });
}



// helper: load settings once
// helper: load settings once (aligned to Classroom.xpSettings)
async function getSettings(classroomId) {
  const cls = await Classroom.findById(classroomId).select('xpSettings');
  const dflt = {
    isXPEnabled: true,
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
      mysteryBoxUseXP:   0
    }
  };
  return cls?.xpSettings
    ? { ...dflt, ...cls.xpSettings, xpRewards: { ...dflt.xpRewards, ...(cls.xpSettings.xpRewards || {}) } }
    : dflt;
}


// helper: emit realtime update to the student
function emitXpUpdate({ userId, classroomId, leveledUp, newLevel }) {
  const io = getIO?.();
  if (!io) return;
  io.to(`user-${userId}`).emit('xp:update', {
    userId: String(userId),
    classroomId: String(classroomId),
    leveledUp: !!leveledUp,
    newLevel: newLevel || undefined
  });
}

// ----- Bits Earned / Spent -----

// respects settings.xpRewards.xpPerBitEarned and bitToXpCountMode ('base'|'final')
async function xpOnBitsEarned({ userId, classroomId, bitsEarned, bitsMode = 'final' }) {
  const settings = await getSettings(classroomId);
  const mode = bitsMode || settings.bitToXpCountMode || 'final';

  const res = await awardXP({
    userId, classroomId,
    opts: { rawBits: bitsEarned, bitsMode: mode, rewardKey: 'xpPerBitEarned' }
  });

  if (res?.ok) emitXpUpdate({
    userId, classroomId, leveledUp: res.leveled, newLevel: res.level
  });
}

async function xpOnBitsSpent({ userId, classroomId, bitsSpent, bitsMode = 'final' }) {
  const settings = await getSettings(classroomId);
  const mode = bitsMode || settings.bitToXpCountMode || 'final';

  const res = await awardXP({
    userId,
    classroomId,
    opts: { rawBits: bitsSpent, bitsMode: mode, rewardKey: 'xpPerBitSpent' }
  });

  if (res?.ok) {
    emitXpUpdate({ userId, classroomId, leveledUp: res.leveled, newLevel: res.level });
  }
}



// ----- Direct XP Events (use rawXP from settings) -----
async function xpOnStatIncrease({ userId, classroomId, count = 1 }) {
  const settings = await getSettings(classroomId);
  const per = Number(settings.xpRewards?.xpPerStatsBoost || 0);
  if (per <= 0) return;
  const res = await awardXP({ userId, classroomId, opts: { rawXP: per * count } });
  if (res?.ok) emitXpUpdate({ userId, classroomId, leveledUp: res.leveled, newLevel: res.level });
}

async function xpOnDailyCheckIn({ userId, classroomId }) {
  const settings = await getSettings(classroomId);
  const per = Number(settings.xpRewards?.dailyCheckInXP || 0);
  if (per <= 0) return;

  const today = new Date();
  const key = `checkin_${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`;

  const res = await awardXP({ userId, classroomId, opts: { rawXP: per, oneTimeKey: key } });
  if (res?.ok) emitXpUpdate({ userId, classroomId, leveledUp: res.leveled, newLevel: res.level });
}

async function xpOnGroupJoin({ userId, classroomId }) {
  const settings = await getSettings(classroomId);
  const per = Number(settings.xpRewards?.groupJoinXP || 0);
  if (per <= 0) return;
  const res = await awardXP({ userId, classroomId, opts: { rawXP: per, oneTimeKey: `groupJoin_${classroomId}` } });
  if (res?.ok) emitXpUpdate({ userId, classroomId, leveledUp: res.leveled, newLevel: res.level });
}

async function xpOnChallengeCompletion({ userId, classroomId, count = 1 }) {
  const settings = await getSettings(classroomId);
  const per = Number(settings.xpRewards?.challengeXP || 0);
  if (per <= 0) return;
  const res = await awardXP({ userId, classroomId, opts: { rawXP: per * count } });
  if (res?.ok) emitXpUpdate({ userId, classroomId, leveledUp: res.leveled, newLevel: res.level });
}

async function xpOnMysteryBoxUse({ userId, classroomId }) {
  const settings = await getSettings(classroomId);
  const per = Number(settings.xpRewards?.mysteryBoxUseXP || 0);
  if (per <= 0) return;
  const res = await awardXP({ userId, classroomId, opts: { rawXP: per } });
  if (res?.ok) emitXpUpdate({ userId, classroomId, leveledUp: res.leveled, newLevel: res.level });
}


module.exports = {
  xpOnBitsEarned,
  xpOnBitsSpent,
  xpOnStatIncrease,
  xpOnDailyCheckIn,
  xpOnBitsSpentPurchase,
  xpOnGroupJoin,
  xpOnChallengeCompletion,
  xpOnMysteryBoxUse,
};

