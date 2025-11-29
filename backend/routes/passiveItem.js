const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const User = require('../models/User');
const Group = require('../models/Group');
const GroupSet = require('../models/GroupSet'); // NEW: scope groups to classroom
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

    // Determine classroom-scoped groups (fallback to global if no classroomId provided)
    let groupIds = null;
    if (classroomId) {
      const gs = await GroupSet.find({ classroom: classroomId }).select('groups');
      groupIds = gs.flatMap(g => (g.groups || []).map(x => String(x)));
    }

    // Find all groups in this classroom where the user is an approved member
    const userGroupsQuery = {
      'members._id': req.user._id,
      'members.status': 'approved'
    };
    if (groupIds && groupIds.length) userGroupsQuery._id = { $in: groupIds };
    const userGroups = await Group.find(userGroupsQuery);

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

    // --- NEW: award & log XP for other approved group members affected by this groupMultiplier change
    try {
      // total group multiplier value applied per updated group (sum of secondary effects)
      const totalGroupEffectValue = (item.secondaryEffects || [])
        .filter(se => se.effectType === 'grantsGroupMultiplier' || se.effectType === 'groupMultiplier')
        .reduce((s, se) => s + (Number(se.value) || 0), 0);

      if (groupEffectApplied && totalGroupEffectValue > 0 && classroomId) {
        const clsForMembers = await Classroom.findById(classroomId).select('xpSettings name');
        const rateStat = clsForMembers?.xpSettings?.enabled ? (clsForMembers.xpSettings.statIncrease || 0) : 0;
        if (rateStat > 0) {
          // collect affected approved members and how many of the updated groups they belong to
          const memberMap = new Map(); // memberId -> { count, groupNames: [] }
          for (const g of userGroups) {
            const gName = g.name || String(g._id);
            for (const m of (g.members || [])) {
              if (!m._id) continue;
              if (m.status !== 'approved') continue;
              const id = String(m._id);
              const cur = memberMap.get(id) || { count: 0, groupNames: new Set() };
              cur.count += 1;
              cur.groupNames.add(gName);
              memberMap.set(id, cur);
            }
          }

          // For each affected member (excluding the actor), award XP and log stat-change
          for (const [memberId, info] of memberMap.entries()) {
            if (memberId === String(req.user._id)) continue; // skip equipper
            try {
              // compute after aggregate for this member (but only within the classroom's groups)
              const memberGroupsQuery = {
                'members._id': memberId,
                'members.status': 'approved'
              };
              if (groupIds && groupIds.length) memberGroupsQuery._id = { $in: groupIds };
              const memberGroups = await Group.find(memberGroupsQuery).select('groupMultiplier');
              const afterAggregate = (memberGroups || []).reduce((s, gg) => s + (gg.groupMultiplier || 1), 0);
              // applied delta for this member = totalGroupEffectValue * number of affected groups they're in
              const appliedDelta = totalGroupEffectValue * (info.count || 0);
              const prevAggregate = Number((afterAggregate - appliedDelta).toFixed(3));

              // award XP: treat the group-multiplier change as one stat increase (consistent with equipper)
              const xpForMember = Math.max(0, rateStat * 1);
              let xpResMember = null;
              if (xpForMember > 0) {
                try {
                  xpResMember = await awardXP(memberId, classroomId, xpForMember, 'group multiplier applied', clsForMembers.xpSettings);
                } catch (xpErrMember) {
                  console.warn('[passiveItem] awardXP failed for affected member', memberId, xpErrMember);
                }
              }

              // Log stat change so the member sees the groupMultiplier diff and who applied it
              try {
                const targetUser = await User.findById(memberId).select('firstName lastName email');
                const groupNamesArr = Array.from(info.groupNames || []);
                const groupContext = groupNamesArr.length ? `applied to ${groupNamesArr.length} group${groupNamesArr.length>1?'s':''}: ${groupNamesArr.slice(0,5).join(', ')}` : undefined;
                const effectsText = [
                  `Group multiplier +${appliedDelta}${groupContext ? ` (${groupContext})` : ''} (via ${item.name})`,
                  `Applied by ${req.user.firstName || req.user.email || 'an instructor'}`
                ].filter(Boolean).join(' — ');

                await logStatChanges({
                  io: req.app && req.app.get ? req.app.get('io') : null,
                  classroomId,
                  user: targetUser,
                  actionBy: req.user._id,
                  prevStats: { groupMultiplier: prevAggregate, ...(xpResMember ? { xp: xpResMember.oldXP } : {}) },
                  currStats: { groupMultiplier: afterAggregate, ...(xpResMember ? { xp: xpResMember.newXP } : {}) },
                  context: `Bazaar - Group multiplier applied (${item.name})`,
                  details: { effectsText },
                  forceLog: true
                });
              } catch (logErrMember) {
                console.warn('[passiveItem] failed to log stat change for affected member', memberId, logErrMember);
              }
            } catch (memberErr) {
              console.warn('[passiveItem] error processing affected member', memberId, memberErr);
            }
          } // end for memberMap
        } // end if rateStat
      } // end if groupEffectApplied
    } catch (eMembers) {
      console.warn('[passiveItem] failed to process affected group members for XP/logging:', eMembers);
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
                  // include item name for clearer notification header
                  context: `stat increase (passive item: ${item.name})`,
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