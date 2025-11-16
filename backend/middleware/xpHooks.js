//backend/middlewares/xpHooks.js
const { awardXP } = require('../utils/xp');
const Classroom = require('../models/Classroom');

//award XP when Bits are earned
async function xpOnBitsEarned({ userId, classroomId, bitsEarned, bitsMode = 'final' }) {
  try {
    const classroom = await Classroom.findById(classroomId).lean();
    if (!classroom || !classroom.xpSettings?.isXPEnabled) return;

    const settings = classroom.xpSettings || {};
    const rewards = settings.xpRewards || {};

    //find conversion rate; fallback to 1 if not defined
    const rate = Number(rewards.bitsToXp || 1);

    const rawXP = bitsEarned * rate;

    await awardXP({
      userId,
      classroomId,
      opts: {
        rawXP,
        rawBits: bitsEarned,
        bitsMode,
        rewardKey: 'bitsToXp'
      }
    });
  } catch (err) {
    console.warn('[XP Hook] xpOnBitsEarned failed:', err.message);
  }
}

module.exports = { xpOnBitsEarned };
