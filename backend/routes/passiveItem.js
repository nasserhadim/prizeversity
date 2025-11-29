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

    // capture previous aggregate group multiplier (sum across groupsets / groups)
    const prevGroupAggregate = (userGroups || []).reduce((s, g) => s + (g.groupMultiplier || 1), 0);
    // Prepare group context for human-readable effects (count + optional names)
    const groupNames = (userGroups || []).map(g => (g.name || String(g._id))).filter(Boolean);
    const groupApplyCount = groupNames.length;
    const groupNamesPreview = groupNames.slice(0, 5).join(', '); // cap list displayed

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

    // compute aggregate after applying group changes (real new sum)
    const afterGroupAggregate = (userGroups || []).reduce((s, g) => s + (g.groupMultiplier || 1), 0);
    const groupAggregateDelta = afterGroupAggregate - prevGroupAggregate;

    // Equip passive item (mark active + timestamp)
    item.active = true;              // ← NEW
    item.activatedAt = new Date();   // ← NEW
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
          try {
            // build a short effects text to include in the XP stat-change notification
            const effectsTextForXP = (item.secondaryEffects || []).map(se => {
              if (se.effectType === 'grantsLuck') return `+${se.value} Luck`;
              if (se.effectType === 'grantsMultiplier') return `+${se.value}x Multiplier`;
              if (se.effectType === 'grantsGroupMultiplier' || se.effectType === 'groupMultiplier') return `Group multiplier +${se.value || 1}`;
              return '';
            }).filter(Boolean);
            // if group multiplier applied, append contextual info: total delta + group count/names
            if (groupEffectApplied) {
              const groupContext = groupApplyCount
                ? ` (applied to ${groupApplyCount} group${groupApplyCount>1?'s':''}${groupNamesPreview ? `: ${groupNamesPreview}` : ''})`
                : '';
              effectsTextForXP.push(`Group multiplier +${groupAggregateDelta}${groupContext}`);
            }
            const effectsTextForXPSummary = effectsTextForXP.join(', ') || undefined;

            const xpRes = await awardXP(req.user._id, classroomId, xp, 'stat increase (bazaar item)', cls.xpSettings);
            if (xpRes && typeof xpRes.oldXP !== 'undefined' && typeof xpRes.newXP !== 'undefined' && xpRes.newXP !== xpRes.oldXP) {
              try {
                await logStatChanges({
                  io: req.app && req.app.get ? req.app.get('io') : null,
                  classroomId,
                  user: req.user,
                  actionBy: req.user._id,
                  prevStats: { xp: xpRes.oldXP },
                  currStats: { xp: xpRes.newXP },
                  context: 'stat increase (passive item)',
                  details: { effectsText: effectsTextForXPSummary },
                  forceLog: true
                });
              } catch (logErr) {
                console.warn('[passiveItem] failed to log XP stat change:', logErr);
              }
            }
          } catch (xpErr) {
            console.warn('[passiveItem] awardXP failed (passive):', xpErr);
          }
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
      // If group effect applied, reflect the real aggregate change so log shows correct delta
      groupMultiplier: groupEffectApplied ? afterGroupAggregate : undefined
    };
    const prevWithGroup = { ...before, ...(groupEffectApplied ? { groupMultiplier: prevGroupAggregate } : {}) };

    // Build effects text for passive item
    const effects = [];
    (item.secondaryEffects || []).forEach(se => {
      if (se.effectType === 'grantsLuck') effects.push(`+${se.value} Luck`);
      if (se.effectType === 'grantsMultiplier') effects.push(`+${se.value}x Multiplier`);
      if (se.effectType === 'grantsGroupMultiplier' || se.effectType === 'groupMultiplier') {
        // avoid duplicating textual group effect; we'll compute precise delta below
        /* noop here */
      }
    });
    // If group effect applied, show the actual delta (could be >1 if user in multiple groups)
    if (groupEffectApplied) {
      const delta = groupAggregateDelta;
      if (delta) {
        const groupContext = groupApplyCount
          ? ` (applied to ${groupApplyCount} group${groupApplyCount>1?'s':''}${groupNamesPreview ? `: ${groupNamesPreview}` : ''})`
          : '';
        effects.push(`Group multiplier +${delta}${groupContext}`);
      }
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