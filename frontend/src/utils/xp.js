// xp must go from level to level +1 based on the formula and baseXPLevel2 using teacher settings '
export function xpNeededForLevel(level, settings) {
  const base = Number(settings?.baseXPLevel2 ?? 100);
  const formula = settings?.xpFormulaType ?? 'exponential';

  if (level <= 1) return base;

  switch (formula) {
    case 'linear':
      //same cost every level after 1
      return base;
    case 'logarithmic':
      //gentle growth
      return Math.max(10, Math.floor(base * (1 + Math.log(level))));
    case 'exponential':
    default:
      //grows ~1.5x per level after 2
      return Math.floor(base * Math.pow(1.5, level - 2));
  }
}

//compute progress numbers for a bar: how much you have, need, and percent
export function computeProgress(currentXP, currentLevel, settings) {
  const need = xpNeededForLevel(currentLevel, settings);
  const have = Math.max(0, Number(currentXP ?? 0));
  const pct = Math.max(0, Math.min(100, Math.floor((have / need) * 100)));
  return { need, have, pct };
}
