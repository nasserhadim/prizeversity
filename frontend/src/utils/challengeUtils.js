export const calculatePotentialBits = (challengeIndex, challengeData, userChallenge) => {
  if (!challengeData?.settings) return 0;
  
  let baseBits = 0;
  if (challengeData.settings.rewardMode === 'individual') {
    baseBits = challengeData.settings.challengeBits?.[challengeIndex] || 0;
  } else {
    if (challengeIndex === 4) {
      baseBits = challengeData.settings.totalRewardBits || 0;
    }
  }
  
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
    if (challengeIndex === 4) {
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
  } else if (challengeIndex === 4) { 
    const totalMultiplier = challengeData.settings.totalMultiplier || 1.0;
    if (totalMultiplier > 1.0) {
      rewards.multiplier = totalMultiplier - 1.0; 
    }
  }

  if (challengeData.settings.luckMode === 'individual') {
    const luckReward = challengeData.settings.challengeLuck?.[challengeIndex] || 1.0;
    if (luckReward > 1.0) {
      rewards.luck = luckReward;
    }
  } else if (challengeIndex === 4) { 
    const totalLuck = challengeData.settings.totalLuck || 1.0;
    if (totalLuck > 1.0) {
      rewards.luck = totalLuck;
    }
  }

  if (challengeData.settings.discountMode === 'individual') {
    const discountReward = challengeData.settings.challengeDiscounts?.[challengeIndex] || 0;
    if (discountReward > 0) {
      rewards.discount = discountReward;
    }
  } else if (challengeIndex === 4) { 
    const totalDiscount = challengeData.settings.totalDiscount || 0;
    if (totalDiscount > 0) {
      rewards.discount = totalDiscount;
    }
  }

  if (challengeData.settings.shieldMode === 'individual') {
    const shieldReward = challengeData.settings.challengeShields?.[challengeIndex] || false;
    if (shieldReward) {
      rewards.shield = true;
    }
  } else if (challengeIndex === 4) { 
    const totalShield = challengeData.settings.totalShield || false;
    if (totalShield) {
      rewards.shield = true;
    }
  }

  if (challengeData.settings.attackMode === 'individual') {
    const attackReward = challengeData.settings.challengeAttackBonuses?.[challengeIndex] || 0;
    if (attackReward > 0) {
      rewards.attackBonus = attackReward;
    }
  } else if (challengeIndex === 4) { 
    const totalAttackBonus = challengeData.settings.totalAttackBonus || 0;
    if (totalAttackBonus > 0) {
      rewards.attackBonus = totalAttackBonus;
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
      method: "Caesar Cipher Decryption",
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
      type: "hash-cracking"
    };
  } else if (progress === 3) {
    return {
      number: 4,
      name: "I Always Sign My Work...",
      method: "Image Metadata Analysis",
      type: "image-forensics"
    };
  } else if (progress === 4) {
    return {
      number: 5,
      name: "Secrets in the Clouds",
      method: "Cloud Authentication",
      type: "cloud-authentication"
    };
  } else {
    return {
      number: 6,
      name: "Needle in a Haystack",
      method: "Needle in a Haystack",
      type: "needle-in-a-haystack"
    };
  }
};