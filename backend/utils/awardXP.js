const User = require('../models/User');
const Badge = require('../models/Badge');
const Notification = require('../models/Notification');
const Classroom = require('../models/Classroom');
const Group = require('../models/Group');
const GroupSet = require('../models/GroupSet');
const { calculateLevelFromXP } = require('./xp');
const { populateNotification } = require('./notifications');
const { logStatChanges } = require('./statChangeLog');

/**
 * Award XP to a user in a specific classroom
 * @param {string} userId - User ID
 * @param {string} classroomId - Classroom ID
 * @param {number} xpAmount - Amount of XP to award
 * @param {string} reason - Reason for XP award
 * @param {object} xpSettings - Classroom XP settings
 * @param {object} options - Additional options (user, io)
 * @returns {Promise<object>} { leveledUp, oldLevel, newLevel, earnedBadges, levelUpRewards }
 */
async function awardXP(userId, classroomId, xpAmount, reason, xpSettings, options = {}) {
  if (!xpSettings?.enabled || xpAmount <= 0) {
    return { leveledUp: false, oldLevel: 1, newLevel: 1, earnedBadges: [], levelUpRewards: null };
  }

  const user = options.user || await User.findById(userId);
  if (!user) throw new Error('User not found');

  let classroomXPEntry = user.classroomXP.find(
    cx => cx.classroom.toString() === classroomId.toString()
  );

  if (!classroomXPEntry) {
    classroomXPEntry = {
      classroom: classroomId,
      xp: 0,
      level: 1,
      earnedBadges: []
    };
    user.classroomXP.push(classroomXPEntry);
  }

  const oldXP = classroomXPEntry.xp;
  const oldLevel = classroomXPEntry.level;

  // Award XP
  classroomXPEntry.xp += xpAmount;

  // Calculate new level
  const newLevel = calculateLevelFromXP(
    classroomXPEntry.xp,
    xpSettings.levelingFormula,
    xpSettings.baseXPForLevel2
  );

  const leveledUp = newLevel > oldLevel;
  classroomXPEntry.level = newLevel;

  // Track level-up rewards
  let levelUpRewardsAwarded = null;

  // Award level-up rewards if enabled
  if (leveledUp && xpSettings.levelUpRewards?.enabled) {
    levelUpRewardsAwarded = await awardLevelUpRewards({
      user,
      classroomId,
      oldLevel,
      newLevel,
      rewards: xpSettings.levelUpRewards,
      xpSettings,
      io: options.io || null
    });
  }

  // Check for new badges earned
  const earnedBadges = [];
  let badgeXPAwarded = 0;
  
  if (leveledUp) {
    const badges = await Badge.find({
      classroom: classroomId,
      levelRequired: { $lte: newLevel, $gt: oldLevel }
    }).sort({ levelRequired: 1 });

    for (const badge of badges) {
      const alreadyEarned = classroomXPEntry.earnedBadges.some(
        eb => eb.badge.toString() === badge._id.toString()
      );

      if (!alreadyEarned) {
        classroomXPEntry.earnedBadges.push({
          badge: badge._id,
          earnedAt: new Date()
        });
        earnedBadges.push(badge);

        // Create notification for badge earned
        const badgeNotification = await Notification.create({
          user: userId,
          type: 'badge_earned',
          message: `🏅 You earned the "${badge.name}" badge! ${badge.description}`,
          classroom: classroomId,
          badge: badge._id,
          read: false
        });

        const populated = await populateNotification(badgeNotification._id);
        if (populated) {
          const io = options.io || (user.db?.base?.io);
          if (io) io.to(`user-${userId}`).emit('notification', populated);
        }

        // Award XP for badge unlock (if configured)
        const badgeXPRate = xpSettings?.badgeUnlock || 0;
        if (badgeXPRate > 0) {
          badgeXPAwarded += badgeXPRate;
        }
      }
    }

    // Apply badge unlock XP if any badges were earned
    if (badgeXPAwarded > 0) {
      const xpBeforeBadge = classroomXPEntry.xp;
      classroomXPEntry.xp += badgeXPAwarded;

      // Recalculate level after badge XP
      const updatedLevel = calculateLevelFromXP(
        classroomXPEntry.xp,
        xpSettings.levelingFormula,
        xpSettings.baseXPForLevel2
      );
      classroomXPEntry.level = updatedLevel;

      // Log the badge unlock XP as a stat change
      try {
        // Build badge names string
        const badgeNames = earnedBadges.map(b => `"${b.name}"`).join(', ');
        const badgeCount = earnedBadges.length;
        const badgeText = badgeCount === 1 
          ? `Unlocked badge ${badgeNames}` 
          : `Unlocked ${badgeCount} badges: ${badgeNames}`;

        await logStatChanges({
          io: options.io || null,
          classroomId,
          user,
          actionBy: null, // system
          prevStats: { xp: xpBeforeBadge },
          currStats: { xp: classroomXPEntry.xp },
          context: 'badge unlock XP',
          details: { 
            effectsText: `${badgeText}: +${badgeXPAwarded} XP`
          },
          forceLog: true
        });
      } catch (err) {
        console.warn('[awardXP] failed to log badge unlock XP:', err);
      }
    }
  }

  await user.save();

  // Send level-up notification
  if (leveledUp) {
    await sendLevelUpNotification({ 
      userId, 
      classroomId, 
      newLevel, 
      reason, 
      levelUpRewards: levelUpRewardsAwarded,
      io: options.io
    });
  }

  return {
    leveledUp,
    oldLevel,
    newLevel,
    oldXP,
    newXP: classroomXPEntry.xp,
    xpGained: xpAmount,
    earnedBadges,
    badgeXPAwarded,
    levelUpRewards: levelUpRewardsAwarded
  };
}

/**
 * Helper to get user's group multiplier for a classroom
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
    console.warn('[awardXP] getUserGroupMultiplier failed:', err);
    return 1;
  }
}

/**
 * Helper to award level-up rewards with multipliers and XP options
 */
async function awardLevelUpRewards({ user, classroomId, oldLevel, newLevel, rewards, xpSettings, io }) {
  const levelsGained = newLevel - oldLevel;
  if (levelsGained <= 0) return null;

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

  // Calculate base bits reward
  let baseBits = 0;
  if (rewards.bitsPerLevel > 0) {
    if (rewards.scaleBitsByLevel) {
      for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
        baseBits += rewards.bitsPerLevel * lvl;
      }
    } else {
      baseBits = rewards.bitsPerLevel * levelsGained;
    }
  }
  awarded.baseBits = baseBits;

  // Apply multipliers if enabled (using ADDITIVE logic consistent with wallet/groupBalance)
  let finalBits = baseBits;
  if (baseBits > 0) {
    let personalMult = 1;
    let groupMult = 1;

    if (rewards.applyPersonalMultiplier) {
      const cs = user.classroomStats?.find(s => String(s.classroom) === String(classroomId));
      personalMult = cs?.passiveAttributes?.multiplier || 1;
    }

    if (rewards.applyGroupMultiplier) {
      groupMult = await getUserGroupMultiplier(user._id, classroomId);
    }

    awarded.personalMultiplier = personalMult;
    awarded.groupMultiplier = groupMult;

    // CHANGED: Use additive logic (consistent with wallet, groupBalance, users, feedback routes)
    // Formula: 1 + (personal - 1) + (group - 1)
    let finalMultiplier = 1;
    if (rewards.applyPersonalMultiplier) {
      finalMultiplier += (personalMult - 1);
    }
    if (rewards.applyGroupMultiplier) {
      finalMultiplier += (groupMult - 1);
    }

    awarded.totalMultiplier = finalMultiplier;
    finalBits = Math.round(baseBits * finalMultiplier);
  }
  awarded.bits = finalBits;

  // Calculate stat rewards
  awarded.multiplier = (rewards.multiplierPerLevel || 0) * levelsGained;
  awarded.luck = (rewards.luckPerLevel || 0) * levelsGained;
  awarded.discount = (rewards.discountPerLevel || 0) * levelsGained;

  // Check shield at specific levels
  if (rewards.shieldAtLevels) {
    const shieldLevels = rewards.shieldAtLevels.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
      if (shieldLevels.includes(lvl)) {
        awarded.shield += 1;
      }
    }
  }

  // Get or create classroom stats entry
  let cs = user.classroomStats?.find(s => String(s.classroom) === String(classroomId));
  if (!cs) {
    if (!user.classroomStats) user.classroomStats = [];
    cs = { 
      classroom: classroomId, 
      balance: 0, 
      passiveAttributes: { multiplier: 1, luck: 1, discount: 0 }, 
      shieldCount: 0 
    };
    user.classroomStats.push(cs);
  }

  const prevStats = {
    balance: cs.balance || 0,
    multiplier: cs.passiveAttributes?.multiplier || 1,
    luck: cs.passiveAttributes?.luck || 1,
    discount: cs.passiveAttributes?.discount || 0,
    shield: cs.shieldCount || 0
  };

  // Apply bit rewards
  if (awarded.bits > 0) {
    cs.balance = (cs.balance || 0) + awarded.bits;

    // Also update classroomBalances for consistency
    let cb = user.classroomBalances?.find(b => String(b.classroom) === String(classroomId));
    if (!cb) {
      if (!user.classroomBalances) user.classroomBalances = [];
      cb = { classroom: classroomId, balance: 0 };
      user.classroomBalances.push(cb);
    }
    cb.balance = (cb.balance || 0) + awarded.bits;

    // Add transaction entry for level-up bits
    if (!user.transactions) user.transactions = [];
    user.transactions.push({
      amount: awarded.bits,
      description: `Level-up reward (Level ${newLevel})`,
      type: 'level_up_reward',
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

  const currStats = {
    balance: cs.balance,
    multiplier: cs.passiveAttributes.multiplier,
    luck: cs.passiveAttributes.luck,
    discount: cs.passiveAttributes.discount,
    shield: cs.shieldCount
  };

  // Count stat increases for XP
  let statIncreaseCount = 0;
  if (awarded.multiplier > 0) statIncreaseCount++;
  if (awarded.luck > 0) statIncreaseCount++;
  if (awarded.discount > 0) statIncreaseCount++;
  if (awarded.shield > 0) statIncreaseCount++;

  // Award XP for level-up rewards if enabled (circular economy)
  let xpFromLevelUpBits = 0;
  let xpFromLevelUpStats = 0;

  if (xpSettings?.enabled) {
    // XP from level-up bits
    if (rewards.countBitsTowardXP && awarded.bits > 0 && (xpSettings.bitsEarned || 0) > 0) {
      // Use base or final based on bitsXPBasis setting
      const xpBits = xpSettings.bitsXPBasis === 'base' ? awarded.baseBits : awarded.bits;
      xpFromLevelUpBits = Math.round(xpBits * (xpSettings.bitsEarned || 0));
    }

    // XP from level-up stats
    if (rewards.countStatsTowardXP && statIncreaseCount > 0 && (xpSettings.statIncrease || 0) > 0) {
      xpFromLevelUpStats = statIncreaseCount * (xpSettings.statIncrease || 0);
    }

    // Apply the XP directly (avoid recursive call)
    const totalLevelUpXP = xpFromLevelUpBits + xpFromLevelUpStats;
    if (totalLevelUpXP > 0) {
      let classroomXPEntry = user.classroomXP.find(
        cx => cx.classroom.toString() === classroomId.toString()
      );
      if (classroomXPEntry) {
        const xpBefore = classroomXPEntry.xp;
        classroomXPEntry.xp += totalLevelUpXP;
        
        // Recalculate level
        const updatedLevel = calculateLevelFromXP(
          classroomXPEntry.xp,
          xpSettings.levelingFormula,
          xpSettings.baseXPForLevel2
        );
        classroomXPEntry.level = updatedLevel;

        // Log the XP gain from level-up rewards
        try {
          const xpParts = [];
          if (xpFromLevelUpBits > 0) xpParts.push(`${xpFromLevelUpBits} XP from bits`);
          if (xpFromLevelUpStats > 0) xpParts.push(`${xpFromLevelUpStats} XP from stats`);
          
          await logStatChanges({
            io,
            classroomId,
            user,
            actionBy: null,
            prevStats: { xp: xpBefore },
            currStats: { xp: classroomXPEntry.xp },
            context: `level-up reward XP (Level ${newLevel})`,
            details: { effectsText: xpParts.join(', ') },
            forceLog: true
          });
        } catch (err) {
          console.warn('[awardXP] failed to log level-up reward XP:', err);
        }
      }
    }
  }

  awarded.xpFromBits = xpFromLevelUpBits;
  awarded.xpFromStats = xpFromLevelUpStats;

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
        context: `level-up reward (Level ${newLevel})`,
        details: { effectsText: effectsParts.join(', ') },
        forceLog: true
      });
    } catch (err) {
      console.warn('[awardXP] failed to log level-up reward stat changes:', err);
    }
  }

  return awarded;
}

async function sendLevelUpNotification({ userId, classroomId, newLevel, reason, levelUpRewards, io }) {
  let message = `🎉 You've reached Level ${newLevel}!`;
  
  if (levelUpRewards) {
    const rewardParts = [];
    if (levelUpRewards.bits > 0) {
      if (levelUpRewards.baseBits !== levelUpRewards.bits) {
        rewardParts.push(`${levelUpRewards.bits} ₿ (${levelUpRewards.totalMultiplier.toFixed(2)}x)`);
      } else {
        rewardParts.push(`${levelUpRewards.bits} ₿`);
      }
    }
    if (levelUpRewards.multiplier > 0) rewardParts.push(`+${levelUpRewards.multiplier.toFixed(1)} Multiplier`);
    if (levelUpRewards.luck > 0) rewardParts.push(`+${levelUpRewards.luck.toFixed(1)} Luck`);
    if (levelUpRewards.discount > 0) rewardParts.push(`+${levelUpRewards.discount}% Discount`);
    if (levelUpRewards.shield > 0) rewardParts.push(`+${levelUpRewards.shield} Shield`);
    
    if (rewardParts.length > 0) {
      message += ` Rewards: ${rewardParts.join(', ')}`;
    }
  }

  try {
    const notification = await Notification.create({
      user: userId,
      type: 'level_up',
      message,
      classroom: classroomId,
      read: false
    });
    
    const populated = await populateNotification(notification._id);
    if (populated && io) {
      io.to(`user-${userId}`).emit('notification', populated);
    }
  } catch (err) {
    console.warn('[awardXP] sendLevelUpNotification failed:', err);
  }
}

module.exports = { awardXP };