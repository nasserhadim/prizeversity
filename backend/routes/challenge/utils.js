const crypto = require('crypto');
const { CHALLENGE_NAMES } = require('./constants');
const Notification = require('../../models/Notification');
const { populateNotification } = require('../../utils/notifications');
const { awardXP } = require('../../utils/awardXP');
const { getScopedUserStats } = require('../../utils/classroomStats');
const { getUserGroupMultiplier } = require('../../utils/groupMultiplier');

function isChallengeExpired(challenge) {
  if (!challenge.settings.dueDateEnabled || !challenge.settings.dueDate) {
    return false;
  }
  return new Date() > new Date(challenge.settings.dueDate);
}

function generateChallenge2Password(uniqueId) {
  const hash = crypto.createHash('md5').update(uniqueId + 'secret_salt_2024').digest('hex');
  const prefix = ['ACCESS', 'TOKEN', 'KEY', 'SECRET', 'CODE'][parseInt(hash.substring(0, 1), 16) % 5];
  const suffix = hash.substring(8, 14).toUpperCase();
  return `${prefix}_${suffix}`;
}

function getChallengeIndex(challengeId) {
  const { CHALLENGE_IDS } = require('./constants');
  
  if (challengeId === CHALLENGE_IDS.CAESAR_SECRET) return 0;
  else if (challengeId === CHALLENGE_IDS.GITHUB_OSINT) return 1;
  else if (challengeId === CHALLENGE_IDS.CPP_DEBUG) return 2;
  else if (challengeId === CHALLENGE_IDS.FORENSICS) return 3;
  else if (challengeId === CHALLENGE_IDS.WAYNEAWS) return 4;
  else if (challengeId === CHALLENGE_IDS.HAYSTACK) return 5;
  else if (challengeId === CHALLENGE_IDS.HANGMAN) return 6;
  else return 0;
}

function isChallengeVisibleToUser(challenge, userRole, challengeIndex) {
  if (!userRole) userRole = 'student';
  if (['teacher','admin'].includes(String(userRole).toLowerCase())) return true;
  if (challenge && challenge.isVisible === false) return false;
  const perVisible = challenge?.settings?.challengeVisibility;
  if (Array.isArray(perVisible) && typeof perVisible[challengeIndex] !== 'undefined') {
    return perVisible[challengeIndex] !== false;
  }
  return true;
}

async function calculateChallengeRewards(user, challenge, challengeIndex, userChallenge, options = {}) {
  const rewardsEarned = {
    bits: 0,
    baseBits: 0,
    multiplier: 0,
    luck: 1.0,
    discount: 0,
    shield: false,
    personalMultiplier: 1,
    groupMultiplier: 1,
    totalMultiplier: 1,
    appliedPersonalMultiplier: false,
    appliedGroupMultiplier: false
  };

  if (!user) return rewardsEarned;

  const now = new Date();
  const classroomId = challenge.classroomId;

  // CHANGED: classroom-scoped stats snapshot + target
  const scopedBefore = getScopedUserStats(user, classroomId, { create: true });
  const passiveTarget = scopedBefore.cs
    ? scopedBefore.cs.passiveAttributes
    : (user.passiveAttributes ||= {});

  const prevStats = {
    multiplier: scopedBefore.passive?.multiplier ?? 1,
    luck: scopedBefore.passive?.luck ?? 1,
    discount: scopedBefore.passive?.discount ?? 0,
    shield: scopedBefore.shieldCount ?? 0,
  };

  let bitsAwarded = 0;
  let baseBits = 0;
  const settings = challenge.settings;

  const hintsEnabled = (settings.challengeHintsEnabled || [])[challengeIndex];
  const penaltyPercent = settings.hintPenaltyPercent ?? 25;
  const maxHints = settings.maxHintsPerChallenge ?? 2;
  const usedHints = Math.min((userChallenge.hintsUsed?.[challengeIndex] || 0), maxHints);
  
  baseBits = (settings.challengeBits || [])[challengeIndex] || 0;
  bitsAwarded = baseBits;

  if (hintsEnabled && bitsAwarded > 0 && usedHints > 0 && penaltyPercent > 0) {
    const totalPenalty = (penaltyPercent * usedHints) / 100;
    const cappedPenalty = Math.min(totalPenalty, 0.8); 
    bitsAwarded = Math.round(bitsAwarded * (1 - cappedPenalty));
  }

  // Store base bits before multiplier application
  rewardsEarned.baseBits = bitsAwarded;

  // NEW: Apply personal/group multipliers if enabled
  if (bitsAwarded > 0) {
    let personalMult = 1;
    let groupMult = 1;

    if (settings.applyPersonalMultiplier) {
      personalMult = scopedBefore.passive?.multiplier || 1;
      rewardsEarned.appliedPersonalMultiplier = true;
    }

    if (settings.applyGroupMultiplier) {
      groupMult = await getUserGroupMultiplier(user._id, classroomId);
      rewardsEarned.appliedGroupMultiplier = true;
    }

    rewardsEarned.personalMultiplier = personalMult;
    rewardsEarned.groupMultiplier = groupMult;

    // ADDITIVE multiplier logic (consistent with other features)
    let finalMultiplier = 1;
    if (settings.applyPersonalMultiplier) {
      finalMultiplier += (personalMult - 1);
    }
    if (settings.applyGroupMultiplier) {
      finalMultiplier += (groupMult - 1);
    }

    rewardsEarned.totalMultiplier = finalMultiplier;
    bitsAwarded = Math.round(bitsAwarded * finalMultiplier);
  }

  if (bitsAwarded > 0) {
    if (classroomId) {
      const classroomBalance = user.classroomBalances.find(
        cb => cb.classroom.toString() === classroomId.toString()
      );
      if (classroomBalance) {
        classroomBalance.balance = (classroomBalance.balance || 0) + bitsAwarded;
      } else {
        user.classroomBalances.push({ classroom: classroomId, balance: bitsAwarded });
      }
    } else {
      user.balance = (user.balance || 0) + bitsAwarded;
    }
    
    rewardsEarned.bits = bitsAwarded;
    
    if (options.addTransactionEntry !== false) {
      const challengeName = CHALLENGE_NAMES[challengeIndex] || `Challenge ${challengeIndex + 1}`;
      
      let transactionDescription;
      if (usedHints > 0) {
        transactionDescription = `Completed Challenge: ${challengeName} (${rewardsEarned.baseBits} - hint penalty)`;
      } else {
        transactionDescription = `Completed Challenge: ${challengeName}`;
      }

      // Add multiplier info to description if applied
      if (rewardsEarned.totalMultiplier > 1) {
        transactionDescription += ` (${rewardsEarned.totalMultiplier.toFixed(2)}x multiplier)`;
      }

      user.transactions = user.transactions || [];
      user.transactions.push({
        amount: bitsAwarded,
        description: transactionDescription,
        type: 'challenge_completion',
        challengeIndex: challengeIndex,
        challengeName: challengeName,
        classroom: classroomId,
        assignedBy: challenge.createdBy,
        calculation: {
          baseAmount: rewardsEarned.baseBits,
          hintsUsed: usedHints > 0 ? usedHints : undefined,
          penaltyPercent: usedHints > 0 ? penaltyPercent : undefined,
          personalMultiplier: rewardsEarned.appliedPersonalMultiplier ? rewardsEarned.personalMultiplier : undefined,
          groupMultiplier: rewardsEarned.appliedGroupMultiplier ? rewardsEarned.groupMultiplier : undefined,
          totalMultiplier: rewardsEarned.totalMultiplier > 1 ? rewardsEarned.totalMultiplier : undefined,
          finalAmount: bitsAwarded
        },
        createdAt: new Date()
      });
    }
  }

  // CHANGED: write multiplier/luck/discount into classroom-scoped passiveTarget
  if (settings.multiplierMode === 'individual') {
    const multiplier = (settings.challengeMultipliers || [])[challengeIndex] || 1.0;
    if (multiplier > 1.0) {
      const multiplierIncrease = multiplier - 1.0;
      passiveTarget.multiplier =
        Math.round(((passiveTarget.multiplier || 1.0) + multiplierIncrease) * 100) / 100;
      rewardsEarned.multiplier = multiplierIncrease;
    }
  }

  if (settings.luckMode === 'individual') {
    const luck = (settings.challengeLuck || [])[challengeIndex] || 1.0;
    if (luck > 1.0) {
      const luckIncrease = luck - 1.0;
      passiveTarget.luck = Math.round(((passiveTarget.luck || 1.0) + luckIncrease) * 10) / 10;
      rewardsEarned.luck = luck;
    }
  }

  if (settings.discountMode === 'individual') {
    const discount = (settings.challengeDiscounts || [])[challengeIndex] || 0;
    if (discount > 0) {
      passiveTarget.discount = Math.min(100, (passiveTarget.discount || 0) + discount);
      rewardsEarned.discount = discount;
    }
  }

  if (settings.shieldMode === 'individual') {
    const shield = (settings.challengeShields || [])[challengeIndex];
    if (shield) {
      if (scopedBefore.cs) {
        scopedBefore.cs.shieldCount = (scopedBefore.cs.shieldCount || 0) + 1;
        scopedBefore.cs.shieldActive = true;
      } else {
        user.shieldActive = true;
        user.shieldCount = (user.shieldCount || 0) + 1;
      }
      rewardsEarned.shield = true;
    }
  }

  // Snapshot after changes
  const scopedAfter = getScopedUserStats(user, classroomId, { create: true });

  const currStats = {
    multiplier: scopedAfter.passive?.multiplier ?? 1,
    luck: scopedAfter.passive?.luck ?? 1,
    discount: scopedAfter.passive?.discount ?? 0,
    shield: scopedAfter.shieldCount ?? 0,
  };

  const statChanges = [];
  ['multiplier', 'luck', 'discount', 'shield'].forEach((field) => {
    const before = prevStats[field];
    const after = currStats[field];
    if (String(before) !== String(after)) {
      statChanges.push({ field, from: before, to: after });
    }
  });

  if (statChanges.length > 0 && classroomId) {
    const challengeName = CHALLENGE_NAMES[challengeIndex] || `Challenge ${challengeIndex + 1}`;
    const changeSummary = statChanges.map(c => `${c.field}: ${c.from} → ${c.to}`).join('; ');

    const studentMessage = `You earned stat boosts from ${challenge.title} - ${challengeName}: ${changeSummary}.`;
    const teacherMessage = `Earned stat boosts from ${challenge.title} - ${challengeName}: ${changeSummary}.`;

    // 1. Notify student about their new stats
    Notification.create({
      user: user._id,
      actionBy: null,
      type: 'stats_adjusted',
      message: studentMessage,
      classroom: classroomId,
      changes: statChanges,
      createdAt: now,
      targetUser: user._id
    }).then(notification => {
      populateNotification(notification._id).then(populated => {
        if (populated) {
          const io = challenge.db.model('User').base.io;
          if (io) io.to(`user-${user._id}`).emit('notification', populated);
        }
      });
    }).catch(err => console.error('Notification error:', err));
  }

  return rewardsEarned;
}

async function awardChallengeBits(userId, challengeIndex, challenge) {
  try {
    const User = require('../../models/User');
    const user = await User.findById(userId);
    if (!user) return 0;

    const bitsToAward = challenge.getBitsForChallenge(challengeIndex);
    if (bitsToAward <= 0) return 0;

    // CHANGED: respect classroom-scoped balances when available
    const classroomId = challenge.classroomId;
    if (classroomId) {
      const classroomBalance = user.classroomBalances.find(
        cb => cb.classroom.toString() === classroomId.toString()
      );
      if (classroomBalance) {
        classroomBalance.balance = (classroomBalance.balance || 0) + bitsToAward;
      } else {
        user.classroomBalances.push({ classroom: classroomId, balance: bitsToAward });
      }
    } else {
      user.balance = (user.balance || 0) + bitsToAward;
    }

    await user.save();

    const userChallenge = challenge.userChallenges.find(
      uc => uc.userId.toString() === userId.toString()
    );
    if (userChallenge) {
      userChallenge.bitsAwarded += bitsToAward;
    }

    return bitsToAward;
  } catch (error) {
    console.error('Error awarding challenge bits:', error);
    return 0;
  }
}

module.exports = {
  isChallengeExpired,
  generateChallenge2Password,
  getChallengeIndex,
  isChallengeVisibleToUser,
  awardChallengeBits,
  calculateChallengeRewards
};
