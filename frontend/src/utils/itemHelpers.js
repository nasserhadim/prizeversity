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
    if (item.primaryEffect === 'discountShop') return '20% shop discount';
  }

  return '';
};

export const describeEffectFromForm = (form) => {
  if (!form || !form.category) return '';
  // Mirror same logic but for form fields (when item being created)
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

  if (form.category === 'Attack') {
    if (form.primaryEffect === 'swapper') return 'Swaps attributes with target (bits, multiplier, or luck)';
    if (form.primaryEffect === 'halveBits') return 'Halves target bits';
    if (form.primaryEffect === 'stealBits') {
      const pct = form.primaryEffectValue || 10;
      return `Steals ${pct}% of target bits`;
    }
  }

  if (form.category === 'Defend' && form.primaryEffect === 'shield') return 'Blocks one attack (shield)';

  if (form.category === 'Utility') {
    if (form.primaryEffect === 'doubleEarnings') return '2x earnings multiplier';
    if (form.primaryEffect === 'discountShop') return '20% shop discount';
  }

  return '';
};