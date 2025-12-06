/**
 * Calculate XP required for a given level based on formula
 * @param {number} level - Target level
 * @param {string} formula - 'linear', 'exponential', or 'logarithmic'
 * @param {number} baseXP - Base XP required for level 2
 * @returns {number} Total XP required to reach this level
 */
function calculateXPForLevel(level, formula = 'exponential', baseXP = 100) {
  if (level <= 1) return 0;
  
  switch (formula) {
    case 'linear':
      // Linear: XP = baseXP * (level - 1)
      return baseXP * (level - 1);
      
    case 'exponential':
      // Exponential: XP = baseXP * (1.5^(level-2))
      // Level 2: 100, Level 3: 150, Level 4: 225, Level 5: 337...
      let total = 0;
      for (let l = 2; l <= level; l++) {
        total += Math.floor(baseXP * Math.pow(1.5, l - 2));
      }
      return total;
      
    case 'logarithmic':
      // Logarithmic: XP = baseXP * level * log(level)
      let totalLog = 0;
      for (let l = 2; l <= level; l++) {
        totalLog += Math.floor(baseXP * l * Math.log10(l + 1));
      }
      return totalLog;
      
    default:
      return baseXP * (level - 1);
  }
}

/**
 * Calculate level from total XP
 * @param {number} xp - Current total XP
 * @param {string} formula - Leveling formula
 * @param {number} baseXP - Base XP for level 2
 * @returns {number} Current level
 */
function calculateLevelFromXP(xp, formula = 'exponential', baseXP = 100) {
  if (xp < 0) return 1;
  
  let level = 1;
  while (calculateXPForLevel(level + 1, formula, baseXP) <= xp) {
    level++;
    // Safety check to prevent infinite loops
    if (level > 1000) break;
  }
  return level;
}

/**
 * Calculate XP needed for next level
 * @param {number} currentXP - Current total XP
 * @param {number} currentLevel - Current level
 * @param {string} formula - Leveling formula
 * @param {number} baseXP - Base XP
 * @returns {object} { xpForCurrentLevel, xpForNextLevel, xpNeeded, progress }
 */
function calculateNextLevelProgress(currentXP, currentLevel, formula, baseXP) {
  const xpForCurrentLevel = calculateXPForLevel(currentLevel, formula, baseXP);
  const xpForNextLevel = calculateXPForLevel(currentLevel + 1, formula, baseXP);
  const xpNeeded = xpForNextLevel - currentXP;
  const xpInCurrentLevel = currentXP - xpForCurrentLevel;
  const xpRequiredForLevel = xpForNextLevel - xpForCurrentLevel;
  const progress = Math.min(100, Math.floor((xpInCurrentLevel / xpRequiredForLevel) * 100));
  
  return {
    xpForCurrentLevel,
    xpForNextLevel,
    xpNeeded,
    xpInCurrentLevel,
    xpRequiredForLevel,
    progress
  };
}

module.exports = {
  calculateXPForLevel,
  calculateLevelFromXP,
  calculateNextLevelProgress
};