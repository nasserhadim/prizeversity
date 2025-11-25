const crypto = require('crypto');
const { CHALLENGE_NAMES } = require('./constants');
const Notification = require('../../models/Notification');
const { populateNotification } = require('../../utils/notifications');
const { awardXP } = require('../../utils/awardXP'); // Changed from '../utils/awardXP'

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

function calculateChallengeRewards(user, challenge, challengeIndex, userChallenge, options = {}) {
  const rewardsEarned = {
    bits: 0,
    multiplier: 0,
    luck: 1.0,
    discount: 0,
    shield: false,
  };

  if (!user) return rewardsEarned;

  // --- BEGIN: Track stat changes ---
  const now = new Date();
  const classroomId = challenge.classroomId;
  const prevStats = {
    multiplier: user.passiveAttributes?.multiplier || 1,
    luck: user.passiveAttributes?.luck || 1,
    discount: user.passiveAttributes?.discount || 0,
    shield: user.shieldCount || 0,
  };
  // --- END: Track stat changes ---

  let bitsAwarded = 0;
  const settings = challenge.settings;

  const hintsEnabled = (settings.challengeHintsEnabled || [])[challengeIndex];
  const penaltyPercent = settings.hintPenaltyPercent ?? 25;
  const maxHints = settings.maxHintsPerChallenge ?? 2;
  const usedHints = Math.min((userChallenge.hintsUsed?.[challengeIndex] || 0), maxHints);
  
  const baseBits = (settings.challengeBits || [])[challengeIndex] || 0;
  bitsAwarded = baseBits;

  if (hintsEnabled && bitsAwarded > 0 && usedHints > 0 && penaltyPercent > 0) {
    const totalPenalty = (penaltyPercent * usedHints) / 100;
    const cappedPenalty = Math.min(totalPenalty, 0.8); 
    bitsAwarded = Math.round(bitsAwarded * (1 - cappedPenalty));
  }

  if (bitsAwarded > 0) {
    if (classroomId) {
      const classroomBalance = user.classroomBalances.find(cb => cb.classroom.toString() === classroomId.toString());
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
      const { CHALLENGE_NAMES } = require('./constants');
      const challengeName = CHALLENGE_NAMES[challengeIndex] || `Challenge ${challengeIndex + 1}`;
      
      const transactionDescription = usedHints > 0 
        ? `Completed Challenge: ${challengeName} (${baseBits} - ${baseBits - bitsAwarded} hint penalty)`
        : `Completed Challenge: ${challengeName}`;

      user.transactions = user.transactions || [];
      user.transactions.push({
        amount: bitsAwarded,
        description: transactionDescription,
        type: 'challenge_completion',
        challengeIndex: challengeIndex,
        challengeName: challengeName,
        classroom: classroomId,
        assignedBy: challenge.createdBy,
        calculation: hintsEnabled && usedHints > 0 ? {
          baseAmount: baseBits,
          hintsUsed: usedHints,
          penaltyPercent: penaltyPercent,
          finalAmount: bitsAwarded
        } : undefined,
        createdAt: new Date()
      });
    }
  }

  if (settings.multiplierMode === 'individual') {
    const multiplier = (settings.challengeMultipliers || [])[challengeIndex] || 1.0;
    if (multiplier > 1.0) {
      const multiplierIncrease = multiplier - 1.0;
      if (!user.passiveAttributes) user.passiveAttributes = {};
      // round to 2 decimals to avoid floating point artifacts
      user.passiveAttributes.multiplier = Math.round(((user.passiveAttributes.multiplier || 1.0) + multiplierIncrease) * 100) / 100;
      rewardsEarned.multiplier = multiplierIncrease;
    }
  }

  if (settings.luckMode === 'individual') {
    const luck = (settings.challengeLuck || [])[challengeIndex] || 1.0;
    if (luck > 1.0) {
      if (!user.passiveAttributes) user.passiveAttributes = {};
      const newLuck = (user.passiveAttributes.luck || 1.0) * luck;
      user.passiveAttributes.luck = Math.round(newLuck * 10) / 10; // Round to 1 decimal place
      rewardsEarned.luck = luck;
    }
  }

  if (settings.discountMode === 'individual') {
    const discount = (settings.challengeDiscounts || [])[challengeIndex] || 0;
    if (discount > 0) {
      if (!user.passiveAttributes) user.passiveAttributes = {};
      const currentDiscount = user.passiveAttributes.discount || 0;
      user.passiveAttributes.discount = Math.min(100, currentDiscount + discount);
      rewardsEarned.discount = discount;
    }
  }

  if (settings.shieldMode === 'individual' && settings.challengeShields?.[challengeIndex]) {
    if (!user.shieldActive) {
      user.shieldActive = true;
      rewardsEarned.shield = true;
    }
    // Also increment shield count
    user.shieldCount = (user.shieldCount || 0) + 1;
    rewardsEarned.shield = true;
  }

  // --- BEGIN: Create notifications for stat changes ---
  const currStats = {
    multiplier: user.passiveAttributes?.multiplier || 1,
    luck: user.passiveAttributes?.luck || 1,
    discount: user.passiveAttributes?.discount || 0,
    shield: user.shieldCount || 0,
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
      actionBy: challenge.createdBy,
      type: 'stats_adjusted',
      message: studentMessage,
      classroom: classroomId,
      changes: statChanges,
      createdAt: now,
      targetUser: user._id // Explicitly set targetUser for student's own notification
    }).then(notification => {
      populateNotification(notification._id).then(populated => {
        if (populated) {
          const io = challenge.db.model('User').base.io;
          if (io) io.to(`user-${user._id}`).emit('notification', populated);
        }
      });
    }).catch(e => console.error('Failed to create student stat-change notification from challenge:', e));

    // REMOVE the teacher log creation that used user: null (no bell spam, no schema violation)
  }
  // --- END: Create notifications for stat changes ---

  return rewardsEarned;
}

async function awardChallengeBits(userId, challengeIndex, challenge) {
  try {
    const User = require('../../models/User');
    const user = await User.findById(userId);
    if (!user) return 0;

    const bitsToAward = challenge.getBitsForChallenge(challengeIndex);
    if (bitsToAward <= 0) return 0;

    user.balance = (user.balance || 0) + bitsToAward;
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
