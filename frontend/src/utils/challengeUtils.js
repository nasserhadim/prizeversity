export const calculatePotentialBits = (challengeIndex, challengeData, userChallenge) => {
  if (!challengeData?.settings) return 0;
  
  let baseBits = 0;
  if (challengeData.settings.rewardMode === 'individual') {
    baseBits = challengeData.settings.challengeBits?.[challengeIndex] || 0;
  } else {
    if (challengeIndex === 3) {
      baseBits = challengeData.settings.totalRewardBits || 0;
    }
  }
  
  // Apply hint penalty if hints are enabled and used
  const hintsEnabled = challengeData.settings.challengeHintsEnabled?.[challengeIndex];
  if (hintsEnabled && baseBits > 0) {
    const penaltyPercent = challengeData.settings.hintPenaltyPercent ?? 25;
    const usedHints = userChallenge?.hintsUsed?.[challengeIndex] || 0;
    if (penaltyPercent > 0 && usedHints > 0) {
      const totalPenalty = Math.min(100, usedHints * penaltyPercent);
      baseBits = Math.max(0, baseBits - Math.floor((baseBits * totalPenalty) / 100));
    }
  }
  
  return baseBits;
};

export const getRewardDataForChallenge = (challengeIndex, challengeData, userChallenge, challengeNames) => {
  if (!challengeData?.settings) return null;

  const rewards = {
    bits: 0,
    multiplier: 0,
    luck: 1.0,
    discount: 0,
    shield: false,
    attackBonus: 0
  };

  if (challengeData.settings.rewardMode === 'individual') {
    let baseBits = challengeData.settings.challengeBits?.[challengeIndex] || 0;
    const hintsEnabled = challengeData.settings.challengeHintsEnabled?.[challengeIndex];
    if (hintsEnabled && baseBits > 0) {
      const penaltyPercent = challengeData.settings.hintPenaltyPercent ?? 25;
      const maxHints = challengeData.settings.maxHintsPerChallenge ?? 2;
      const usedHints = Math.min(userChallenge?.hintsUsed?.[challengeIndex] || 0, maxHints);
      if (penaltyPercent > 0 && usedHints > 0) {
        const totalPenalty = Math.min(100, usedHints * penaltyPercent);
        baseBits = Math.max(0, baseBits - Math.floor((baseBits * totalPenalty) / 100));
      }
    }
    rewards.bits = baseBits;
  } else {
    if (challengeIndex === 3) {
      let baseBits = challengeData.settings.totalRewardBits || 0;
      const hintsEnabled = challengeData.settings.challengeHintsEnabled?.[challengeIndex];
      if (hintsEnabled && baseBits > 0) {
        const penaltyPercent = challengeData.settings.hintPenaltyPercent ?? 25;
        const maxHints = challengeData.settings.maxHintsPerChallenge ?? 2;
        const usedHints = Math.min(userChallenge?.hintsUsed?.[challengeIndex] || 0, maxHints);
        if (penaltyPercent > 0 && usedHints > 0) {
          const totalPenalty = Math.min(100, usedHints * penaltyPercent);
          baseBits = Math.max(0, baseBits - Math.floor((baseBits * totalPenalty) / 100));
        }
      }
      rewards.bits = baseBits;
    }
  }

  if (challengeData.settings.multiplierMode === 'individual') {
    const multiplierReward = challengeData.settings.challengeMultipliers?.[challengeIndex] || 1.0;
    if (multiplierReward > 1.0) {
      rewards.multiplier = multiplierReward - 1.0;
    }
  }

  if (challengeData.settings.luckMode === 'individual') {
    const luckReward = challengeData.settings.challengeLuck?.[challengeIndex] || 1.0;
    if (luckReward > 1.0) {
      rewards.luck = luckReward;
    }
  }

  if (challengeData.settings.discountMode === 'individual') {
    const discountReward = challengeData.settings.challengeDiscounts?.[challengeIndex] || 0;
    if (discountReward > 0) {
      rewards.discount = discountReward;
    }
  }

  if (challengeData.settings.shieldMode === 'individual') {
    const shieldReward = challengeData.settings.challengeShields?.[challengeIndex] || false;
    if (shieldReward) {
      rewards.shield = true;
    }
  }

  if (challengeData.settings.attackMode === 'individual') {
    const attackReward = challengeData.settings.challengeAttackBonuses?.[challengeIndex] || 0;
    if (attackReward > 0) {
      rewards.attackBonus = attackReward;
    }
  }

  return {
    rewards,
    challengeName: challengeNames[challengeIndex],
    allCompleted: challengeIndex === 4,
    nextChallenge: challengeIndex < 4 ? challengeNames[challengeIndex + 1] : null
  };
};

export const getCurrentChallenge = (progress) => {
  if (progress === 0) {
    return {
      number: 1,
      name: "Little Caesar's Secret",
      method: "Caesar Cipher",
      type: "caesar"
    };
  } else if (progress === 1) {
    return {
      number: 2,
      name: "Check Me Out", 
      method: "OSINT & Git Exploration",
      type: "github"
    };
  } else if (progress === 2) {
    return {
      number: 3,
      name: "Bug Smasher",
      method: "C++ Security Vulnerability", 
      type: "debugging"
    };
  } else if (progress === 3) {
    return {
      number: 4,
      name: "I Always Sign My Work",
      method: "Image Metadata Analysis",
      type: "forensics"
    };
  } else {
    return {
      number: 5,
      name: "Secrets Written in the Clouds",
      method: "AWS S3 Bucket Investigation",
      type: "cloud"
    };
  }
};
