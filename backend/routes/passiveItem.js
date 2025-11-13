const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const User = require('../models/User');
const Group = require('../models/Group');
const { ensureAuthenticated } = require('../config/auth');
const Classroom = require('../models/Classroom');
const { awardXP } = require('../utils/awardXP');
const { logStatChanges } = require('../utils/statChangeLog');

// Passive items are another category of the item bazaar which will grant users multipliers, group multipliers, and luck

router.post('/equip/:itemId', ensureAuthenticated, async (req, res) => {
  try {
    const classroomId = req.body.classroomId || req.query.classroomId;
    const item = await Item.findById(req.params.itemId);
    if (!item || item.owner.toString() !== req.user._id.toString()) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // snapshot before changes
    const before = {
      luck: req.user.passiveAttributes?.luck || 1,
      multiplier: req.user.passiveAttributes?.multiplier || 1,
      discount: req.user.passiveAttributes?.discount || 0,
      shield: req.user.shieldCount || 0,
      // groupMultiplier: unknown baseline; we'll log a +1 when applied
    };

    // Find all groups where the user is an approved member
    const userGroups = await Group.find({
      'members._id': req.user._id,
      'members.status': 'approved'
    });

    // Apply passive effects
    let groupEffectApplied = false;
    item.secondaryEffects.forEach(effect => {
      switch(effect.effectType) {
        case 'grantsLuck':
          req.user.passiveAttributes.luck = (req.user.passiveAttributes.luck || 1) + effect.value;
          break;
        case 'grantsMultiplier':
          req.user.passiveAttributes.multiplier = (req.user.passiveAttributes.multiplier || 1) + effect.value;
          break;
        case 'grantsGroupMultiplier':
          // Update each group's multiplier
          userGroups.forEach(group => {
            group.groupMultiplier = (group.groupMultiplier || 1) + effect.value;
          });
          groupEffectApplied = true;
          break;
      }
    });

    // Save user and groups
    await req.user.save();
    if (groupEffectApplied) {
      await Promise.all(userGroups.map(g => g.save()));
    }

    // ADD: Mark item as consumed
    item.usesRemaining = Math.max(0, (item.usesRemaining || 1) - 1);
    item.consumed = item.usesRemaining === 0;
    await item.save();

    // award XP (existing)
    try {
      if (classroomId) {
        const after = {
          luck: req.user.passiveAttributes?.luck || 1,
          multiplier: req.user.passiveAttributes?.multiplier || 1,
        };
        let statCount = 0;
        if (after.multiplier !== before.multiplier) statCount += 1;
        if (after.luck !== before.luck) statCount += 1;
        if (groupEffectApplied) statCount += 1; // count group-multiplier redeem as a stat increase

        const cls = await Classroom.findById(classroomId).select('xpSettings');
        const rate = cls?.xpSettings?.enabled ? (cls.xpSettings.statIncrease || 0) : 0;
        const xp = statCount * rate;
        if (xp > 0) {
          await awardXP(req.user._id, classroomId, xp, 'stat increase (bazaar item)', cls.xpSettings);
        }
      }
    } catch (e) {
      console.warn('[passiveItem] awardXP failed:', e);
    }

    // NEW: stat-change notifications
    const after = {
      luck: req.user.passiveAttributes?.luck || 1,
      multiplier: req.user.passiveAttributes?.multiplier || 1,
      discount: req.user.passiveAttributes?.discount || 0,
      shield: req.user.shieldCount || 0,
      // If group effect applied, reflect a +1 virtual change so it appears in the log
      groupMultiplier: groupEffectApplied ? 2 : undefined
    };
    const prevWithGroup = { ...before, ...(groupEffectApplied ? { groupMultiplier: 1 } : {}) };

    // Build effects text for passive item
    const effects = [];
    (item.secondaryEffects || []).forEach(se => {
      if (se.effectType === 'grantsLuck') effects.push(`+${se.value} Luck`);
      if (se.effectType === 'grantsMultiplier') effects.push(`+${se.value}x Multiplier`);
      if (se.effectType === 'groupMultiplier') effects.push(`Group multiplier +${se.value || 1}`);
    });
    if (groupEffectApplied && !effects.some(t => /group multiplier/i.test(t))) {
      effects.push('Group multiplier +1');
    }

    await logStatChanges({
      io: req.app.get('io'),
      classroomId,
      user: req.user,
      actionBy: req.user._id,
      prevStats: prevWithGroup,
      currStats: after,
      context: `Bazaar - Equipped ${item.name}`,
      details: { effectsText: effects.join(', ') || undefined } // remove image
    });

    res.json({
      message: 'Passive item equipped',
      stats: req.user.passiveAttributes,
      updatedGroups: userGroups.map(g => ({
        groupId: g._id,
        newMultiplier: g.groupMultiplier
      }))
    });
  } catch (err) {
    console.error('Equip error:', err);
    res.status(500).json({ 
      error: 'Failed to equip item',
      details: err.message
    });
  }
});

module.exports = router;