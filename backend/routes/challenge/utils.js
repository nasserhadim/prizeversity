const crypto = require('crypto');

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

async function awardChallengeBits(userId, challengeLevel, challenge) {
  try {
    const User = require('../../models/User');
    const user = await User.findById(userId);
    if (!user) return 0;

    const bitsToAward = challenge.getBitsForChallenge(challengeLevel);
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

function calculateChallengeRewards(user, challenge, challengeIndex, userChallenge, options = {}) {
  const rewardsEarned = {
    bits: 0,
    multiplier: 0,
    luck: 1.0,
    discount: 0,
    shield: false,
  };

  const baseBits = (challenge.settings.challengeBits || [])[challengeIndex] || 0;
  let bitsAwarded = baseBits;

  const hintsEnabled = (challenge.settings.challengeHintsEnabled || [])[challengeIndex];
  const penaltyPercent = challenge.settings.hintPenaltyPercent ?? 25;
  const maxHints = challenge.settings.maxHintsPerChallenge ?? 2;
  const usedHints = Math.min((userChallenge.hintsUsed?.[challengeIndex] || 0), maxHints);
  
  if (hintsEnabled && bitsAwarded > 0 && usedHints > 0 && penaltyPercent > 0) {
    const totalPenalty = (penaltyPercent * usedHints) / 100;
    const cappedPenalty = Math.min(totalPenalty, 0.8); 
    bitsAwarded = Math.round(bitsAwarded * (1 - cappedPenalty));
  }

  if (bitsAwarded > 0) {
    user.balance = (user.balance || 0) + bitsAwarded;
    rewardsEarned.bits = bitsAwarded;
    
    if (options.addTransactionEntry !== false) {
      const { CHALLENGE_NAMES } = require('./constants');
      const challengeName = CHALLENGE_NAMES[challengeIndex] || `Challenge ${challengeIndex + 1}`;
      
      const transactionDescription = usedHints > 0 
        ? `Completed ${challengeName} (${baseBits} - ${baseBits - bitsAwarded} hint penalty)`
        : `Completed ${challengeName}`;
        
      user.transactions = user.transactions || [];
      user.transactions.push({
        amount: bitsAwarded,
        description: transactionDescription,
        type: 'challenge_completion',
        challengeIndex: challengeIndex,
        challengeName: challengeName,
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

  if (challenge.settings.multiplierMode === 'individual') {
    const multiplier = (challenge.settings.challengeMultipliers || [])[challengeIndex] || 1.0;
    if (multiplier > 1.0) {
      const multiplierIncrease = multiplier - 1.0;
      user.passiveAttributes.multiplier = (user.passiveAttributes.multiplier || 1.0) + multiplierIncrease;
      rewardsEarned.multiplier = multiplierIncrease;
    }
  }

  if (challenge.settings.luckMode === 'individual') {
    const luck = (challenge.settings.challengeLuck || [])[challengeIndex] || 1.0;
    if (luck > 1.0) {
      user.passiveAttributes.luck = (user.passiveAttributes.luck || 1.0) * luck;
      rewardsEarned.luck = luck;
    }
  }

  if (challenge.settings.discountMode === 'individual') {
    const discount = (challenge.settings.challengeDiscounts || [])[challengeIndex] || 0;
    if (discount > 0) {
      if (typeof user.discountShop === 'boolean') {
        user.discountShop = user.discountShop ? 100 : 0;
      }
      user.discountShop = Math.min(100, (user.discountShop || 0) + discount);
      rewardsEarned.discount = discount;
    }
  }

  if (challenge.settings.shieldMode === 'individual') {
    const shield = (challenge.settings.challengeShields || [])[challengeIndex] || false;
    if (shield) {
      user.shieldActive = true;
      rewardsEarned.shield = true;
    }
  }

  return rewardsEarned;
}

module.exports = {
  isChallengeExpired,
  generateChallenge2Password,
  getChallengeIndex,
  awardChallengeBits,
  calculateChallengeRewards
};
