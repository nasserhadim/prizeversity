const User = require('../models/User');
const Badge = require('../models/Badge');
const Notification = require('../models/Notification');
const Group = require('../models/Group');
const GroupSet = require('../models/GroupSet');
const { calculateLevelFromXP } = require('./xp');
const { populateNotification } = require('./notifications');
const { logStatChanges } = require('./statChangeLog');

/**
 * Get user's group multiplier for a classroom (sum of all group multipliers)
 */
async function getUserGroupMultiplier(userId, classroomId) {
  try {
    const groupSets = await GroupSet.find({ classroom: classroomId }).select('_id');
    if (!groupSets.length) return 1;

    const groupSetIds = groupSets.map(gs => gs._id);
    const groups = await Group.find({
      groupSet: { $in: groupSetIds },
      members: userId
    }).select('multiplier');

    if (!groups.length) return 1;

    let totalMultiplier = 1;
    for (const group of groups) {
      if (group.multiplier && group.multiplier > 1) {
        totalMultiplier += (group.multiplier - 1);
      }
    }
    return totalMultiplier;
  } catch (err) {
    console.warn('[manualXPLevelUp] getUserGroupMultiplier failed:', err);
    return 1;
  }
}

/**
 * Award level-up rewards for manual XP adjustment
 */
async function awardLevelUpRewardsManual({ user, classroomId, oldLevel, newLevel, xpSettings, io }) {
  const rewards = xpSettings?.levelUpRewards;
  if (!rewards?.enabled) {
    // Still check badges and send notification even without rewards
    const badgeResult = await checkAndAwardBadges({ user, classroomId, newLevel, xpSettings, io });
    await sendLevelUpNotificationManual({ userId: user._id, classroomId, newLevel, io });
    return { levelUpRewards: null, badges: badgeResult };
  }

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

  // Apply multipliers if enabled
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

    // Use additive logic
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
      description: `Level-up reward (Level ${newLevel}) - Manual XP adjustment`,
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
  if (!cs.passiveAttributes) {
    cs.passiveAttributes = { multiplier: 1, luck: 1, discount: 0 };
  }
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
      const xpBits = xpSettings.bitsXPBasis === 'base' ? awarded.baseBits : awarded.bits;
      xpFromLevelUpBits = Math.round(xpBits * (xpSettings.bitsEarned || 0));
    }

    // XP from level-up stats
    if (rewards.countStatsTowardXP && statIncreaseCount > 0 && (xpSettings.statIncrease || 0) > 0) {
      xpFromLevelUpStats = statIncreaseCount * (xpSettings.statIncrease || 0);
    }

    // Apply the XP directly
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
          console.warn('[manualXPLevelUp] failed to log level-up reward XP:', err);
        }
      }
    }
  }

  awarded.xpFromBits = xpFromLevelUpBits;
  awarded.xpFromStats = xpFromLevelUpStats;

  // Log stat changes for level-up rewards
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
      console.warn('[manualXPLevelUp] failed to log level-up reward stat changes:', err);
    }
  }

  // Check and award badges
  const badgeResult = await checkAndAwardBadges({ user, classroomId, newLevel, xpSettings, io });

  // Send level-up notification
  await sendLevelUpNotificationManual({ 
    userId: user._id, 
    classroomId, 
    newLevel, 
    levelUpRewards: awarded,
    io 
  });

  return { levelUpRewards: awarded, badges: badgeResult };
}

/**
 * Check and award badges for manual XP adjustment
 */
async function checkAndAwardBadges({ user, classroomId, newLevel, xpSettings, io }) {
  const earnedBadges = [];
  let badgeXPAwarded = 0;

  let classroomXPEntry = user.classroomXP.find(
    cx => cx.classroom.toString() === classroomId.toString()
  );

  if (!classroomXPEntry) return { earnedBadges, badgeXPAwarded };

  // Find ALL badges that should be unlocked at current level
  const badges = await Badge.find({
    classroom: classroomId,
    levelRequired: { $lte: newLevel }
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

      // Award badge rewards if configured
      const { awardBadgeRewards, awardBadgeRewardXP } = require('./badgeRewards');
      const badgeRewardsAwarded = await awardBadgeRewards({
        user,
        classroomId,
        badge,
        io
      });

      // Build reward parts for notification
      const rewardParts = [];
      if (badgeRewardsAwarded.bits > 0) {
        if (badgeRewardsAwarded.baseBits !== badgeRewardsAwarded.bits) {
          rewardParts.push(`${badgeRewardsAwarded.bits} ₿ (${badgeRewardsAwarded.totalMultiplier.toFixed(2)}x)`);
        } else {
          rewardParts.push(`${badgeRewardsAwarded.bits} ₿`);
        }
      }
      if (badgeRewardsAwarded.multiplier > 0) rewardParts.push(`+${badgeRewardsAwarded.multiplier.toFixed(1)} Multiplier`);
      if (badgeRewardsAwarded.luck > 0) rewardParts.push(`+${badgeRewardsAwarded.luck.toFixed(1)} Luck`);
      if (badgeRewardsAwarded.discount > 0) rewardParts.push(`+${badgeRewardsAwarded.discount}% Discount`);
      if (badgeRewardsAwarded.shield > 0) rewardParts.push(`+${badgeRewardsAwarded.shield} Shield`);

      // Create notification for badge earned
      let badgeMessage = `🏅 You earned the "${badge.name}" badge! ${badge.description}`;
      if (rewardParts.length > 0) {
        badgeMessage += ` Rewards: ${rewardParts.join(', ')}`;
      }

      // DEDUPE: avoid creating many identical badge notifications in a short window
      // Safer dedupe: prefer existing badge-field check; skip if notification already exists
      const existing = await Notification.findOne({ user: user._id, type: 'badge_earned', badge: badge._id }).lean();
      if (existing) {
        console.warn('[DEDUP] Skipping duplicate badge_earned (already exists) for user', String(user._id), String(badge._id));
      } else {
        const badgeNotification = await Notification.create({
          user: user._id,
          type: 'badge_earned',
          message: badgeMessage,
          classroom: classroomId,
          badge: badge._id,
          read: false
        });
        const populated = await populateNotification(badgeNotification._id);
        if (populated && io) {
          io.to(`user-${user._id}`).emit('notification', populated);
        }
      }

      // Award XP for badge unlock
      const badgeXPRate = xpSettings?.badgeUnlock || 0;
      if (badgeXPRate > 0) {
        badgeXPAwarded += badgeXPRate;
      }

      // Award XP for badge rewards
      await awardBadgeRewardXP({
        user,
        classroomId,
        badge,
        awarded: badgeRewardsAwarded,
        xpSettings,
        io
      });
    }
  }

  // Apply badge unlock XP if any badges were earned
  if (badgeXPAwarded > 0 && xpSettings?.enabled) {
    const xpBeforeBadge = classroomXPEntry.xp;
    classroomXPEntry.xp += badgeXPAwarded;

    // Recalculate level after badge XP
    const updatedLevel = calculateLevelFromXP(
      classroomXPEntry.xp,
      xpSettings.levelingFormula,
      xpSettings.baseXPForLevel2
    );
    classroomXPEntry.level = updatedLevel;

    // Log the badge unlock XP
    try {
      const badgeNames = earnedBadges.map(b => `"${b.name}"`).join(', ');
      const badgeCount = earnedBadges.length;
      const badgeText = badgeCount === 1 
        ? `Unlocked badge ${badgeNames}` 
        : `Unlocked ${badgeCount} badges: ${badgeNames}`;

      await logStatChanges({
        io,
        classroomId,
        user,
        actionBy: null,
        prevStats: { xp: xpBeforeBadge },
        currStats: { xp: classroomXPEntry.xp },
        context: 'badge unlock XP',
        details: { 
          effectsText: `${badgeText}: +${badgeXPAwarded} XP`
        },
        forceLog: true
      });
    } catch (err) {
      console.warn('[manualXPLevelUp] failed to log badge unlock XP:', err);
    }
  }

  return { earnedBadges, badgeXPAwarded };
}

/**
 * Send level-up notification for manual XP adjustment
 */
async function sendLevelUpNotificationManual({ userId, classroomId, newLevel, levelUpRewards, io }) {
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
    console.warn('[manualXPLevelUp] sendLevelUpNotificationManual failed:', err);
  }
}

module.exports = { 
  awardLevelUpRewardsManual, 
  checkAndAwardBadges, 
  sendLevelUpNotificationManual 
};