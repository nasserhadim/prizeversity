const User = require('../models/User');
const Group = require('../models/Group');
const GroupSet = require('../models/GroupSet');
const { logStatChanges } = require('./statChangeLog');

/**
 * Get user's group multiplier for a classroom (sum of all group multipliers)
 */
async function getUserGroupMultiplier(userId, classroomId) {
  try {
    // Find all GroupSets in this classroom
    const groupSets = await GroupSet.find({ classroom: classroomId }).select('groups');
    if (!groupSets.length) return 1;

    // Get all group IDs from these GroupSets
    const groupIds = groupSets.flatMap(gs => gs.groups || []);
    if (!groupIds.length) return 1;

    // Find groups where user is an approved member
    const groups = await Group.find({
      _id: { $in: groupIds },
      members: {
        $elemMatch: {
          _id: userId,
          status: 'approved'
        }
      }
    }).select('groupMultiplier');

    if (!groups || groups.length === 0) return 1;

    // Sum of multipliers across distinct groups (consistent with wallet/stats logic)
    return groups.reduce((sum, g) => sum + (g.groupMultiplier || 1), 0);
  } catch (err) {
    console.warn('[badgeRewards] getUserGroupMultiplier failed:', err);
    return 1;
  }
}

/**
 * Award badge rewards to a user
 * @param {Object} params
 * @param {Object} params.user - User document
 * @param {string} params.classroomId - Classroom ID
 * @param {Object} params.badge - Badge document with rewards
 * @param {Object} params.io - Socket.io instance for realtime notifications
 * @returns {Object} awarded rewards details
 */
async function awardBadgeRewards({ user, classroomId, badge, io }) {
  const rewards = badge.rewards || {};
  const awarded = {
    bits: 0,
    baseBits: 0,
    multiplier: 0,
    luck: 0,
    discount: 0,
    shield: 0,
    personalMultiplier: 1,
    groupMultiplier: 1,
    totalMultiplier: 1
  };

  // Check if there are any rewards to give
  const hasRewards = (rewards.bits || 0) > 0 || 
                     (rewards.multiplier || 0) > 0 || 
                     (rewards.luck || 0) > 0 || 
                     (rewards.discount || 0) > 0 || 
                     (rewards.shield || 0) > 0;

  if (!hasRewards) return awarded;

  // Get or create classroom stats entry
  let cs = user.classroomStats?.find(s => String(s.classroom) === String(classroomId));
  if (!cs) {
    if (!user.classroomStats) user.classroomStats = [];
    cs = {
      classroom: classroomId,
      balance: 0,
      passiveAttributes: { multiplier: 1, luck: 1, discount: 0 },
      shieldCount: 0,
      shieldActive: false
    };
    user.classroomStats.push(cs);
  }

  // Ensure passiveAttributes exists
  if (!cs.passiveAttributes) {
    cs.passiveAttributes = { multiplier: 1, luck: 1, discount: 0 };
  }

  // Snapshot previous stats
  const prevStats = {
    balance: cs.balance || 0,
    multiplier: cs.passiveAttributes.multiplier || 1,
    luck: cs.passiveAttributes.luck || 1,
    discount: cs.passiveAttributes.discount || 0,
    shield: cs.shieldCount || 0
  };

  // Calculate bit rewards with multipliers
  const baseBits = rewards.bits || 0;
  awarded.baseBits = baseBits;

  if (baseBits > 0) {
    let personalMult = 1;
    let groupMult = 1;

    if (rewards.applyPersonalMultiplier) {
      personalMult = cs.passiveAttributes.multiplier || 1;
    }

    if (rewards.applyGroupMultiplier) {
      // Use the proper group multiplier calculation
      groupMult = await getUserGroupMultiplier(user._id, classroomId);
    }

    awarded.personalMultiplier = personalMult;
    awarded.groupMultiplier = groupMult;

    // ADDITIVE multiplier logic (consistent with other features)
    // Formula: 1 + (personal - 1) + (group - 1)
    let finalMultiplier = 1;
    if (rewards.applyPersonalMultiplier) {
      finalMultiplier += (personalMult - 1);
    }
    if (rewards.applyGroupMultiplier) {
      finalMultiplier += (groupMult - 1);
    }

    awarded.totalMultiplier = finalMultiplier;
    awarded.bits = Math.round(baseBits * finalMultiplier);

    // Apply bit rewards to classroomStats
    cs.balance = (cs.balance || 0) + awarded.bits;

    // Also update classroomBalances for consistency
    let cb = user.classroomBalances?.find(b => String(b.classroom) === String(classroomId));
    if (!cb) {
      if (!user.classroomBalances) user.classroomBalances = [];
      cb = { classroom: classroomId, balance: 0 };
      user.classroomBalances.push(cb);
    }
    cb.balance = (cb.balance || 0) + awarded.bits;

    // Add transaction entry
    if (!user.transactions) user.transactions = [];
    user.transactions.push({
      amount: awarded.bits,
      description: `Badge reward: ${badge.name}`,
      type: 'badge_reward',
      classroom: classroomId,
      calculation: awarded.baseBits !== awarded.bits ? {
        baseAmount: awarded.baseBits,
        personalMultiplier: awarded.personalMultiplier,
        groupMultiplier: awarded.groupMultiplier,
        totalMultiplier: awarded.totalMultiplier,
        finalAmount: awarded.bits
      } : undefined,
      createdAt: new Date()
    });
  }

  // Apply stat rewards
  awarded.multiplier = rewards.multiplier || 0;
  awarded.luck = rewards.luck || 0;
  awarded.discount = rewards.discount || 0;
  awarded.shield = rewards.shield || 0;

  if (awarded.multiplier > 0) {
    cs.passiveAttributes.multiplier = (cs.passiveAttributes.multiplier || 1) + awarded.multiplier;
  }
  if (awarded.luck > 0) {
    cs.passiveAttributes.luck = (cs.passiveAttributes.luck || 1) + awarded.luck;
  }
  if (awarded.discount > 0) {
    cs.passiveAttributes.discount = Math.min(100, (cs.passiveAttributes.discount || 0) + awarded.discount);
  }
  if (awarded.shield > 0) {
    cs.shieldCount = (cs.shieldCount || 0) + awarded.shield;
    cs.shieldActive = cs.shieldCount > 0;
  }

  // Snapshot current stats after changes
  const currStats = {
    balance: cs.balance,
    multiplier: cs.passiveAttributes.multiplier,
    luck: cs.passiveAttributes.luck,
    discount: cs.passiveAttributes.discount,
    shield: cs.shieldCount
  };

  // Log stat changes
  const hasChanges = awarded.bits > 0 || awarded.multiplier > 0 || awarded.luck > 0 || awarded.discount > 0 || awarded.shield > 0;
  if (hasChanges) {
    try {
      const effectsParts = [];
      if (awarded.bits > 0) {
        if (awarded.baseBits !== awarded.bits) {
          effectsParts.push(`+${awarded.bits} ₿ (base: ${awarded.baseBits}, ${awarded.totalMultiplier.toFixed(2)}x)`);
        } else {
          effectsParts.push(`+${awarded.bits} ₿`);
        }
      }
      if (awarded.multiplier > 0) effectsParts.push(`+${awarded.multiplier.toFixed(1)} Multiplier`);
      if (awarded.luck > 0) effectsParts.push(`+${awarded.luck.toFixed(1)} Luck`);
      if (awarded.discount > 0) effectsParts.push(`+${awarded.discount}% Discount`);
      if (awarded.shield > 0) effectsParts.push(`+${awarded.shield} Shield`);

      await logStatChanges({
        io,
        classroomId,
        user,
        actionBy: null,
        prevStats,
        currStats,
        context: `badge reward: "${badge.name}"`,
        details: { effectsText: `Badge "${badge.name}": ${effectsParts.join(', ')}` },
        forceLog: true
      });
    } catch (err) {
      console.warn('[badgeRewards] failed to log stat changes:', err);
    }
  }

  return awarded;
}

/**
 * Award XP for badge rewards (bits earned, stat increases)
 */
async function awardBadgeRewardXP({ user, classroomId, badge, awarded, xpSettings, io }) {
  if (!xpSettings?.enabled) return;

  const { awardXP } = require('./awardXP');
  const { logStatChanges } = require('./statChangeLog');

  // XP from bits earned
  if (awarded.bits > 0 && (xpSettings.bitsEarned || 0) > 0) {
    const xpBits = xpSettings.bitsXPBasis === 'base' ? awarded.baseBits : awarded.bits;
    const xp = Math.round(xpBits * (xpSettings.bitsEarned || 0));
    if (xp > 0) {
      try {
        const xpRes = await awardXP(user._id, classroomId, xp, `earning bits (badge reward: "${badge.name}")`, xpSettings, { io });
        if (xpRes && typeof xpRes.oldXP !== 'undefined' && typeof xpRes.newXP !== 'undefined' && xpRes.newXP !== xpRes.oldXP) {
          try {
            await logStatChanges({
              io,
              classroomId,
              user,
              actionBy: null,
              prevStats: { xp: xpRes.oldXP },
              currStats: { xp: xpRes.newXP },
              context: `earning bits (badge reward: "${badge.name}")`,
              details: { effectsText: `Badge "${badge.name}": Bits +${awarded.bits}` },
              forceLog: true
            });
          } catch (logErr) {
            console.warn('[badgeRewards] failed to log bits-earned XP:', logErr);
          }
        }
      } catch (xpErr) {
        console.warn('[badgeRewards] awardXP (bits) failed:', xpErr);
      }
    }
  }

  // XP from stat increases
  const statCount =
    (awarded.multiplier > 0 ? 1 : 0) +
    (awarded.luck > 0 ? 1 : 0) +
    (awarded.discount > 0 ? 1 : 0) +
    (awarded.shield > 0 ? 1 : 0);

  if (statCount > 0 && (xpSettings.statIncrease || 0) > 0) {
    const xp = statCount * (xpSettings.statIncrease || 0);
    if (xp > 0) {
      try {
        const xpRes = await awardXP(user._id, classroomId, xp, `stat increase (badge reward: "${badge.name}")`, xpSettings, { io });
        if (xpRes && typeof xpRes.oldXP !== 'undefined' && typeof xpRes.newXP !== 'undefined' && xpRes.newXP !== xpRes.oldXP) {
          try {
            const parts = [];
            if (awarded.multiplier > 0) parts.push(`+${awarded.multiplier.toFixed(1)} Multiplier`);
            if (awarded.luck > 0) parts.push(`+${awarded.luck.toFixed(1)} Luck`);
            if (awarded.discount > 0) parts.push(`+${awarded.discount}% Discount`);
            if (awarded.shield > 0) parts.push(`+${awarded.shield} Shield`);

            await logStatChanges({
              io,
              classroomId,
              user,
              actionBy: null,
              prevStats: { xp: xpRes.oldXP },
              currStats: { xp: xpRes.newXP },
              context: `stat increase (badge reward: "${badge.name}")`,
              details: { effectsText: `Badge "${badge.name}": ${parts.join(', ')}` },
              forceLog: true
            });
          } catch (logErr) {
            console.warn('[badgeRewards] failed to log stat-increase XP:', logErr);
          }
        }
      } catch (xpErr) {
        console.warn('[badgeRewards] awardXP (stat increase) failed:', xpErr);
      }
    }
  }
}

module.exports = { awardBadgeRewards, awardBadgeRewardXP, getUserGroupMultiplier };