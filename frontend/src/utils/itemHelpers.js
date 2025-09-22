export const getEffectDescription = (item) => {
  if (!item) return '';
  // Passive: list secondary effects
  if (item.category === 'Passive') {
    const effects = (item.secondaryEffects || []).map(e => {
      switch (e.effectType) {
        case 'grantsLuck': return `+${e.value} Luck`;
        case 'grantsMultiplier': return `+${e.value}x Multiplier`;
        case 'grantsGroupMultiplier': return `+${e.value}x Group Multiplier`;
        default: return '';
      }
    }).filter(Boolean);
    return effects.length ? `Passive: ${effects.join(', ')}` : '';
  }

  // Attack
  if (item.category === 'Attack') {
    if (item.primaryEffect === 'swapper') return 'Swaps attributes with target (bits, multiplier, or luck)';
    if (item.primaryEffect === 'halveBits') return 'Halves target bits';
    if (item.primaryEffect === 'stealBits') {
      const pct = item.primaryEffectValue || 10;
      return `Steals ${pct}% of target bits`;
    }
  }

  // Defend
  if (item.category === 'Defend') {
    if (item.primaryEffect === 'shield') return 'Blocks one attack (shield)';
  }

  // Utility
  if (item.category === 'Utility') {
    if (item.primaryEffect === 'doubleEarnings') return '2x earnings multiplier';
    if (item.primaryEffect === 'discountShop') {
      // Use configured percent on the item (fallback to 20)
      const pct = Number(item.primaryEffectValue) || 20;
      return `${pct}% shop discount`;
    }
  }

  return '';
};

export const describeEffectFromForm = (form) => {
  if (!form || !form.category) return '';
  // Mirror same logic but for form fields (when item being created)
  // PRIMARY / PASSIVE handling (unchanged for primary effects)
  if (form.category === 'Passive') {
    const effects = (form.secondaryEffects || []).map(e => {
      switch (e.effectType) {
        case 'grantsLuck': return `+${e.value} Luck`;
        case 'grantsMultiplier': return `+${e.value}x Multiplier`;
        case 'grantsGroupMultiplier': return `+${e.value}x Group Multiplier`;
        default: return '';
      }
    }).filter(Boolean);
    return effects.length ? `Passive: ${effects.join(', ')}` : '';
  }

  // Helper to format secondary effects (attack-style)
  const formatSecondary = (secList = []) => {
    const parts = (secList || []).map(e => {
      if (!e || !e.effectType) return '';
      switch (e.effectType) {
        case 'attackLuck': return `Attack Luck -${e.value}`;
        case 'attackMultiplier': return `Attack Multiplier -${e.value}x`;
        case 'attackGroupMultiplier': return `Attack Group Multiplier -${e.value}x`;
        case 'grantsLuck': return `+${e.value} Luck`;
        case 'grantsMultiplier': return `+${e.value}x Multiplier`;
        case 'grantsGroupMultiplier': return `+${e.value}x Group Multiplier`;
        default: return '';
      }
    }).filter(Boolean);
    return parts.length ? parts.join(', ') : '';
  };

  // Attack (primary)
  if (form.category === 'Attack') {
    let primary = '';
    if (form.primaryEffect === 'swapper') primary = 'Swaps attributes with target (bits, multiplier, or luck)';
    if (form.primaryEffect === 'halveBits') primary = 'Halves target bits';
    if (form.primaryEffect === 'stealBits') {
      const pct = form.primaryEffectValue || 10;
      primary = `Steals ${pct}% of target bits`;
    }

    const secondaryText = formatSecondary(form.secondaryEffects);
    if (primary && secondaryText) return `${primary}. Secondary: ${secondaryText}`;
    if (primary) return primary;
    if (secondaryText) return `Secondary: ${secondaryText}`;
    return '';
  }

  // Defend
  if (form.category === 'Defend') {
    if (form.primaryEffect === 'shield') return 'Blocks one attack (shield)';
  }

  // Utility
  if (form.category === 'Utility') {
    if (form.primaryEffect === 'doubleEarnings') return '2x earnings multiplier';
    if (form.primaryEffect === 'discountShop') {
      // Use form value (teacher-entered) or fall back to 20%
      const pct = Number(form.primaryEffectValue) || 20;
      return `${pct}% shop discount`;
    }
  }

  return '';
};

// New helper: split description into main text + Effect text (if present)
export const splitDescriptionEffect = (description) => {
  if (!description) return { main: '', effect: null };
  // Look for "Effect:" (case-insensitive) possibly preceded by newline(s)
  const m = description.match(/([\s\S]*?)\n*\s*Effect\s*:\s*([\s\S]*)/i);
  if (m) {
    return { main: (m[1] || '').trim(), effect: (m[2] || '').trim() };
  }
  return { main: description.trim(), effect: null };
};