// xp must go from level to level +1 based on the formula and baseXPLevel2 using teacher settings '
export function xpNeededForNextLevel(level, { xpFormulaType='exponential', baseXPLevel2=100 } = {}) {
  const L = Math.max(1, Number(level||1));
  const base = Math.max(1, Number(baseXPLevel2||100));
  switch (xpFormulaType) {
    case 'linear':       return base;
    case 'logarithmic':  return Math.max(1, Math.round(base * L * Math.log10(L + 1)));
    case 'exponential':
    default:             return Math.max(1, Math.round(base * Math.pow(1.5, L - 1)));
  }
}

//compute progress numbers for a bar: how much you have, need, and percent
export function computeProgress(currentXP, currentLevel, xpSettings) {
  const need = xpNeededForNextLevel(currentLevel, xpSettings || {});
  const have = Math.max(0, Number(currentXP||0));
  const pct = Math.max(0, Math.min(100, (have / Math.max(1, need)) * 100));
  return { need, have, pct };
}
