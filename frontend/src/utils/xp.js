// xp must go from level to level +1 based on the formula and baseXPLevel2 using teacher settings '
export function xpNeededForLevel(level, settings) {
  const base = Number(settings?.baseXPLevel2 ?? 100);
  const formula = settings?.xpFormulaType ?? 'exponential';
const L = Math.max(1, Number(level) || 1);
  if (level <= 1) return base;

  switch (formula) {
    case 'linear':
      //same cost every level after 1
      return Math.max(1, Math.floor(base * (L - 1)));
    case 'logarithmic':
      //gentle growth
      return Math.max(1, Math.floor(base * L * Math.log10(L + 1)));
    case 'exponential':
    default:
      //grows ~1.5x per level after 2
      return Math.max(1, Math.floor(base * Math.pow(1.5, L - 2)));
  }
}

//compute progress numbers for a bar: how much you have, need, and percent
export function computeProgress(currentXP, currentLevel, settings) {
  const need = xpNeededForLevel(currentLevel, settings);
  const have = Math.max(0, Number(currentXP ?? 0));
  const pct = Math.max(0, Math.min(100, Math.floor((have / Math.max(1, need)) * 100)));
  return { need, have, pct };
}
