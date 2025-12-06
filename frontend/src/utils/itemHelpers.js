export const getEffectDescription = (item) => {
  if (!item) return '';
  const swapOpts = normalizeSwapOptions(item.swapOptions) || ['bits', 'multiplier', 'luck'];
  
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
    
    if (item.primaryEffect === 'swapper') {
      return `Swaps attributes with target (${swapOpts.join(', ')})`;
    }
    if (item.primaryEffect === 'nullify') {
      return `Resets target's ${swapOpts.join(', ')} to default`;
    }
    if (item.primaryEffect === 'halveBits') return 'Halves target bits';
    if (item.primaryEffect === 'drainBits') {
      const pct = item.primaryEffectValue || 10;
      return `Drains ${pct}% of target bits`;
    }
  }

  // Defend
  if (item.category === 'Defend') {
    if (item.primaryEffect === 'shield') return 'Blocks one attack (shield)';
  }

  // Utility
  if (item.category === 'Utility') {
    if (item.primaryEffect === 'doubleEarnings') return 'Double Earnings (2x multiplier)';
    if (item.primaryEffect === 'discountShop') return '20% shop discount';
  }

  return '';
};

// ADD function here:
export const normalizeSwapOptions = (swapOptions) => {
  if (!swapOptions) return [];
  // If value is a JSON string or CSV, try to parse it into an array
  let arr = [];
  if (typeof swapOptions === 'string') {
    const s = swapOptions.trim();
    // try JSON.parse
    if ((s.startsWith('[') && s.endsWith(']')) || (s.startsWith('{') && s.endsWith('}'))) {
      try {
        const parsed = JSON.parse(s);
        arr = Array.isArray(parsed) ? parsed : [parsed];
      } catch (e) {
        // fallback to CSV
        arr = s.split(',').map(p => p.trim()).filter(Boolean);
      }
    } else {
      // comma separated (CSV) or single token
      arr = s.includes(',') ? s.split(',').map(p => p.trim()).filter(Boolean) : [s];
    }
  } else if (Array.isArray(swapOptions)) {
    arr = swapOptions;
  } else {
    // single value (number/object)
    arr = [swapOptions];
  }

  const attrs = new Set();
  const canonical = (s) => {
    if (!s) return null;
    const val = String(s).toLowerCase().trim();
    if (['bits', 'bit', 'b'].includes(val)) return 'bits';
    if (['multiplier', 'mult', 'mul', 'x'].includes(val)) return 'multiplier';
    if (['luck', 'l'].includes(val)) return 'luck';
    return null;
  };

  arr.forEach(item => {
    if (!item) return;
    if (typeof item === 'string' || typeof item === 'number') {
      const c = canonical(item);
      if (c) attrs.add(c);
      return;
    }
    if (typeof item === 'object') {
      if (item.attribute) {
        const c = canonical(item.attribute);
        if (c) attrs.add(c);
      }
      if (item.from) {
        const c = canonical(item.from);
        if (c) attrs.add(c);
      }
      if (item.to) {
        const c = canonical(item.to);
        if (c) attrs.add(c);
      }
      ['bits', 'multiplier', 'luck'].forEach(k => {
        if (item[k] === true || item[k] === 'true') attrs.add(k);
      });
    }
  });

  return Array.from(attrs);
};

export const splitDescriptionEffect = (desc) => {
  if (!desc) return { main: '', effect: '' };

  // Look for "Effect:" preceded by 1 or more newlines (tolerant of spacing/case)
  const match = desc.match(/[\r\n]+\s*Effect\s*:\s*/i);
  if (match && typeof match.index === 'number') {
    const start = match.index;
    const before = desc.slice(0, start).trim();
    const after = desc.slice(start + match[0].length).trim();
    return { main: before, effect: after };
  }

  // Fallback: if "Effect:" appears anywhere, split there (covers single-line cases)
  const inline = desc.match(/Effect\s*:\s*/i);
  if (inline && typeof inline.index === 'number') {
    const start = inline.index;
    const before = desc.slice(0, start).trim();
    const after = desc.slice(start + inline[0].length).trim();
    return { main: before, effect: after };
  }

  return { main: desc, effect: '' };
};

export const describeEffectFromForm = (form) => {
  if (!form || !form.category) return '';

  const formatSecondary = (effects) => {
    if (!effects || !effects.length) return '';
    const parts = effects.map(e => {
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
    const swapOpts = form.swapOptions && form.swapOptions.length > 0 ? form.swapOptions : ['bits', 'multiplier', 'luck'];
    
    if (form.primaryEffect === 'swapper') {
      primary = `Swaps attributes with target (${swapOpts.join(', ')})`;
    } else if (form.primaryEffect === 'nullify') {
      primary = `Resets target's ${swapOpts.join(', ')} to default`;
    } else if (form.primaryEffect === 'halveBits') {
      primary = 'Halves target bits';
    } else if (form.primaryEffect === 'drainBits') {
      const pct = form.primaryEffectValue || 10;
      primary = `Drains ${pct}% of target bits`;
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
    return '';
  }

  // Utility
  if (form.category === 'Utility') {
    if (form.primaryEffect === 'doubleEarnings') return 'Double Earnings (2x multiplier)';
    if (form.primaryEffect === 'discountShop') return '20% shop discount';
    return '';
  }

  // Passive
  if (form.category === 'Passive') {
    const secondaryText = formatSecondary(form.secondaryEffects);
    return secondaryText ? `Passive: ${secondaryText}` : '';
  }

  return '';
};