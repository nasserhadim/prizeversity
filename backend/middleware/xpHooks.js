

//deleted out above for testing pruposes. 
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

//XP from Bits Spent (bazaar purchases)
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

//award for events (attendance, challenges, posts
async function xpOnEvent({ userId, classroomId, baseXP, rewardKey = 'event' }) {
  try {
    const classroom = await Classroom.findById(classroomId).lean();
    if (!classroom || classroom?.xpSettings?.isXPEnabled === false) {
      return { ok: false, reason: 'xp-disabled' };
    }

    const rawXP = Math.max(0, Math.round(Number(baseXP || 0)));
    if (rawXP <= 0) return { ok: false, reason: 'zero-xp' };

    return await awardXP({
      userId,
      classroomId,
      opts: {
        rawXP,
        rewardKey, //for analytics/tuning in awardXP logs
        bitsMode: 'final',// respects multipliers/effects inside awardXP
      },
    });
  } catch (err) {
    console.warn('[XP Hook] xpOnEvent failed:', err.message);
    return { ok: false, reason: 'error' };
  }
}

//XP on Mystery Box Open
async function xpOnMysteryOpen({ userId, classroomId }) {
  try {
    const classroom = await Classroom.findById(classroomId).lean();
    if (!classroom || classroom?.xpSettings?.isXPEnabled === false) {
      return { ok: false, reason: 'xp-disabled' };
    }
    const baseXP = Number(classroom?.xpSettings?.xpRewards?.xpPerMysteryOpen ?? 0);
    if (!baseXP) return { ok: false, reason: 'zero-xp' };

    return xpOnEvent({ userId, classroomId, baseXP, rewardKey: 'xpPerMysteryOpen' });
  } catch (err) {
    console.warn('[XP Hook] xpOnMysteryOpen failed:', err.message);
    return { ok: false, reason: 'error' };
  }
}

//xp on attendance 
async function xpOnAttendance({ userId, classroomId }) {
  try {
    const classroom = await Classroom.findById(classroomId).lean();
    if (!classroom || classroom?.xpSettings?.isXPEnabled === false) {
      return { ok: false, reason: 'xp-disabled' };
    }
    const baseXP = Number(classroom?.xpSettings?.xpRewards?.xpPerAttendance ?? 0);
    if (!baseXP) return { ok: false, reason: 'zero-xp' };

    return xpOnEvent({ userId, classroomId, baseXP, rewardKey: 'xpPerAttendance' });
  } catch (err) {
    console.warn('[XP Hook] xpOnAttendance failed:', err.message);
    return { ok: false, reason: 'error' };
  }
}

//xp on challange complete WILL NEED TO TETTTTTTT idont have password
async function xpOnChallengeComplete({ userId, classroomId, difficulty = 'normal' }) {
  try {
    const classroom = await Classroom.findById(classroomId).lean();
    if (!classroom || classroom?.xpSettings?.isXPEnabled === false) {
      return { ok: false, reason: 'xp-disabled' };
    }

    const r = classroom?.xpSettings?.xpRewards || {};
    const baseXP =
      (difficulty === 'hard'  && Number(r.xpPerChallengeHard)) ||
      (difficulty === 'easy'  && Number(r.xpPerChallengeEasy)) ||
      Number(r.xpPerChallenge ?? 0);

    if (!baseXP) return { ok: false, reason: 'zero-xp' };

    return xpOnEvent({ userId, classroomId, baseXP, rewardKey: 'xpPerChallenge' });
  } catch (err) {
    console.warn('[XP Hook] xpOnChallengeComplete failed:', err.message);
    return { ok: false, reason: 'error' };
  }
}

//xp on feedback
async function xpOnNewsPost({ userId, classroomId }) {
  try {
    const classroom = await Classroom.findById(classroomId).lean();
    if (!classroom || classroom?.xpSettings?.isXPEnabled === false) {
      return { ok: false, reason: 'xp-disabled' };
    }
    const baseXP = Number(classroom?.xpSettings?.xpRewards?.xpPerNewsPost ?? 0);
    if (!baseXP) return { ok: false, reason: 'zero-xp' };

    return xpOnEvent({ userId, classroomId, baseXP, rewardKey: 'xpPerNewsPost' });
  } catch (err) {
    console.warn('[XP Hook] xpOnNewsPost failed:', err.message);
    return { ok: false, reason: 'error' };
  }
}

module.exports = {
  xpOnBitsEarned,
  xpOnBitsSpentPurchase,
  xpOnEvent,
  xpOnMysteryOpen,
  xpOnAttendance,
  xpOnChallengeComplete,
  xpOnNewsPost,
};
