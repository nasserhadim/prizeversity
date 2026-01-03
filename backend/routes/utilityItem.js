const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const User = require('../models/User');
const { ensureAuthenticated } = require('../config/auth');
const Classroom = require('../models/Classroom');
const { awardXP } = require('../utils/awardXP');
const { logStatChanges } = require('../utils/statChangeLog');
const { getClassroomIdFromReq, getScopedUserStats } = require('../utils/classroomStats');

// Utility item is another category for items in the bazaar workign with a discount and multipleir
router.post('/use/:itemId', ensureAuthenticated, async (req, res) => {
  try {
    const classroomId = getClassroomIdFromReq(req);

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const item = await Item.findById(req.params.itemId);
    if (!item || item.owner.toString() !== user._id.toString()) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // classroom-scoped snapshot before (from the SAME doc we will mutate/save)
    const scopedBefore = getScopedUserStats(user, classroomId, { create: true });
    const before = {
      multiplier: scopedBefore.passive?.multiplier ?? 1,
      discount: scopedBefore.passive?.discount ?? 0,
      luck: scopedBefore.passive?.luck ?? 1,
      shield: scopedBefore.shieldCount ?? 0
    };

    // Write target: classroom-scoped entry if available, else legacy global
    const passiveTarget = scopedBefore.cs
      ? scopedBefore.cs.passiveAttributes
      : (user.passiveAttributes ||= {});

    // Apply utility effect (MUTATE `user`, not `req.user`)
    switch (item.primaryEffect) {
      case 'doubleEarnings': {
        passiveTarget.multiplier = (Number(passiveTarget.multiplier ?? 1) || 1) * 2;
        passiveTarget.multiplier = Math.round(passiveTarget.multiplier * 10) / 10;
        break;
      }

      case 'discountShop': {
        const pct = Math.round(Number(item.primaryEffectValue ?? 20) || 20);
        passiveTarget.discount = Math.max(0, Math.min(100, pct));

        setTimeout(async () => {
          try {
            const fresh = await User.findById(user._id);
            if (!fresh) return;

            const scoped = getScopedUserStats(fresh, classroomId, { create: true });
            const pt = scoped.cs ? scoped.cs.passiveAttributes : (fresh.passiveAttributes ||= {});
            pt.discount = 0;

            await fresh.save();
            req.app?.get('io')?.to(`user-${fresh._id}`).emit('discount_expired');
          } catch (e) {
            console.warn('[utilityItem] discount expiration handler failed:', e);
          }
        }, 24 * 60 * 60 * 1000);

        break;
      }

      default:
        if (!item.secondaryEffects || item.secondaryEffects.length === 0) {
          return res.status(400).json({ error: 'Unsupported utility effect' });
        }
    }

    // Apply secondary effects for Utility items
    let groupEffectApplied = false;
    const userGroups = [];
    let prevGroupAggregate = 0;
    
    if (item.secondaryEffects && item.secondaryEffects.length > 0) {
      // Pre-fetch user's groups if grantsGroupMultiplier effect exists
      const hasGroupEffect = item.secondaryEffects.some(e => e.effectType === 'grantsGroupMultiplier');
      if (hasGroupEffect && classroomId) {
        const GroupSet = require('../models/GroupSet');
        const Group = require('../models/Group');
        const gs = await GroupSet.find({ classroom: classroomId }).select('groups');
        const groupIds = gs.flatMap(g => (g.groups || []).map(x => String(x)));
        
        const groups = await Group.find({
          _id: { $in: groupIds },
          'members._id': req.user._id,
          'members.status': 'approved'
        });
        userGroups.push(...groups);
        // Capture previous aggregate before changes
        prevGroupAggregate = userGroups.reduce((sum, g) => sum + (g.groupMultiplier || 1), 0);
      }

      for (const effect of item.secondaryEffects) {
        switch (effect.effectType) {
          case 'grantsLuck':
            passiveTarget.luck = (Number(passiveTarget.luck ?? 1) || 1) + (Number(effect.value) || 1);
            passiveTarget.luck = Math.round(passiveTarget.luck * 10) / 10;
            break;
          case 'grantsMultiplier':
            passiveTarget.multiplier = (Number(passiveTarget.multiplier ?? 1) || 1) + (Number(effect.value) || 1);
            passiveTarget.multiplier = Math.round(passiveTarget.multiplier * 10) / 10;
            break;
          case 'grantsGroupMultiplier':
            // Update each group's multiplier
            for (const group of userGroups) {
              group.groupMultiplier = (group.groupMultiplier || 1) + (Number(effect.value) || 1);
            }
            groupEffectApplied = true;
            break;
          default:
            /* noop */
        }
      }
    }

    await user.save();
    
    // Save groups if group effect was applied
    if (groupEffectApplied) {
      await Promise.all(userGroups.map(g => g.save()));
    }

    // --- NEW: award & log XP for other approved group members affected by this groupMultiplier change ---
    try {
      const totalGroupEffectValue = (item.secondaryEffects || [])
        .filter(se => se.effectType === 'grantsGroupMultiplier')
        .reduce((s, se) => s + (Number(se.value) || 0), 0);

      if (groupEffectApplied && totalGroupEffectValue > 0 && classroomId) {
        const clsForMembers = await Classroom.findById(classroomId).select('xpSettings name');
        const rateStat = clsForMembers?.xpSettings?.enabled ? (clsForMembers.xpSettings.statIncrease || 0) : 0;

        if (rateStat > 0) {
          // Collect affected approved members and how many of the updated groups they belong to
          const memberMap = new Map(); // memberId -> { count, groupNames: Set }
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
            if (memberId === String(req.user._id)) continue; // skip the user who used the item

            try {
              // Compute after aggregate for this member (within the classroom's groups)
              const GroupSet = require('../models/GroupSet');
              const Group = require('../models/Group');
              const gs = await GroupSet.find({ classroom: classroomId }).select('groups');
              const groupIds = gs.flatMap(g => (g.groups || []).map(x => String(x)));

              const memberGroupsQuery = {
                'members._id': memberId,
                'members.status': 'approved'
              };
              if (groupIds && groupIds.length) memberGroupsQuery._id = { $in: groupIds };

              const memberGroups = await Group.find(memberGroupsQuery).select('groupMultiplier');
              const afterAggregate = (memberGroups || []).reduce((s, gg) => s + (gg.groupMultiplier || 1), 0);
              // Applied delta for this member = totalGroupEffectValue * number of affected groups they're in
              const appliedDelta = totalGroupEffectValue * (info.count || 0);
              const prevAggregate = Number((afterAggregate - appliedDelta).toFixed(3));

              // Award XP: treat the group-multiplier change as one stat increase
              const xpForMember = Math.max(0, rateStat * 1);
              let xpResMember = null;
              if (xpForMember > 0) {
                try {
                  xpResMember = await awardXP(memberId, classroomId, xpForMember, 'group multiplier applied', clsForMembers.xpSettings);
                } catch (xpErrMember) {
                  console.warn('[utilityItem] awardXP failed for affected member', memberId, xpErrMember);
                }
              }

              // Log stat change so the member sees the groupMultiplier diff and who applied it
              try {
                const targetUser = await User.findById(memberId).select('firstName lastName email');
                const groupNamesArr = Array.from(info.groupNames || []);
                const groupContext = groupNamesArr.length 
                  ? `applied to ${groupNamesArr.length} group${groupNamesArr.length > 1 ? 's' : ''}: ${groupNamesArr.slice(0, 5).join(', ')}` 
                  : undefined;
                const applierName = user.firstName || user.email || 'a group member';
                const effectsText = [
                  `Group multiplier +${appliedDelta}${groupContext ? ` (${groupContext})` : ''} (via ${item.name})`,
                  `Applied by ${applierName}`
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
                console.warn('[utilityItem] failed to log stat change for affected member', memberId, logErrMember);
              }
            } catch (memberErr) {
              console.warn('[utilityItem] error processing affected member', memberId, memberErr);
            }
          }
        }
      }
    } catch (eMembers) {
      console.warn('[utilityItem] failed to process affected group members for XP/logging:', eMembers);
    }

    // Calculate after group aggregate
    const afterGroupAggregate = groupEffectApplied 
      ? userGroups.reduce((sum, g) => sum + (g.groupMultiplier || 1), 0)
      : prevGroupAggregate;
    const groupAggregateDelta = afterGroupAggregate - prevGroupAggregate;

    item.usesRemaining = Math.max(0, (item.usesRemaining || 1) - 1);
    item.consumed = item.usesRemaining === 0;
    item.active = true;
    item.activatedAt = new Date();
    await item.save();

    // classroom-scoped after snapshot (again from SAME doc + scope)
    const scopedAfter = getScopedUserStats(user, classroomId, { create: true });
    const after = {
      multiplier: scopedAfter.passive?.multiplier ?? 1,
      discount: scopedAfter.passive?.discount ?? 0,
      luck: scopedAfter.passive?.luck ?? 1,
      shield: scopedAfter.shieldCount ?? 0
    };

    // Award XP (based on classroom-scoped before/after)
    let xpResForStats = null;
    try {
      if (classroomId) {
        // Count each stat that changed
        let statCount = 0;
        if (Number(after.multiplier) !== Number(before.multiplier)) statCount += 1;
        if (Number(after.luck) !== Number(before.luck)) statCount += 1;
        if (Number(after.discount) !== Number(before.discount)) statCount += 1;
        if (groupEffectApplied) statCount += 1; // count group multiplier as a stat increase

        const cls = await Classroom.findById(classroomId).select('xpSettings');
        const rate = cls?.xpSettings?.enabled ? (cls.xpSettings.statIncrease || 0) : 0;
        const xp = statCount * rate;

        if (xp > 0) {
          // Build detailed effects text for XP notification
          const effectsTextParts = [];
          
          // Primary effect
          if (item.primaryEffect === 'doubleEarnings') effectsTextParts.push('Double Earnings (2x multiplier)');
          if (item.primaryEffect === 'discountShop') effectsTextParts.push(`${after.discount}% shop discount`);
          
          // Secondary effects
          (item.secondaryEffects || []).forEach(se => {
            if (se.effectType === 'grantsLuck') effectsTextParts.push(`+${se.value} Luck`);
            if (se.effectType === 'grantsMultiplier') effectsTextParts.push(`+${se.value}x Multiplier`);
            if (se.effectType === 'grantsGroupMultiplier') effectsTextParts.push(`+${se.value}x Group Multiplier`);
          });
          
          // Group multiplier with context
          if (groupEffectApplied && groupAggregateDelta > 0) {
            const groupCount = userGroups.length;
            const groupNames = userGroups.slice(0, 3).map(g => g.name).filter(Boolean).join(', ');
            const groupContext = groupCount 
              ? ` (applied to ${groupCount} group${groupCount > 1 ? 's' : ''}${groupNames ? `: ${groupNames}` : ''})`
              : '';
            effectsTextParts.push(`Group multiplier +${groupAggregateDelta}${groupContext}`);
          }

          // Include item name in effects text
          const effectsTextWithItem = effectsTextParts.length 
            ? `${effectsTextParts.join(', ')} (via ${item.name})`
            : `(via ${item.name})`;

          xpResForStats = await awardXP(user._id, classroomId, xp, 'stat increase (bazaar item)', cls.xpSettings);
          if (xpResForStats?.newXP !== xpResForStats?.oldXP) {
            await logStatChanges({
              io: req.app?.get ? req.app.get('io') : null,
              classroomId,
              user,
              actionBy: user._id,
              prevStats: { xp: xpResForStats.oldXP },
              currStats: { xp: xpResForStats.newXP },
              context: `Bazaar - ${item.name}`,
              details: { effectsText: effectsTextWithItem },
              forceLog: true
            });
          }
        }
      }
    } catch (e) {
      console.warn('[utilityItem] XP award/log failed:', e);
    }

    // Build detailed effects text for stat-change notification
    const effectsParts = [];
    
    // Primary effect
    if (item.primaryEffect === 'doubleEarnings') effectsParts.push('Double Earnings (2x multiplier)');
    if (item.primaryEffect === 'discountShop') effectsParts.push(`${after.discount}% shop discount`);
    
    // Secondary effects
    (item.secondaryEffects || []).forEach(se => {
      if (se.effectType === 'grantsLuck') effectsParts.push(`+${se.value} Luck`);
      if (se.effectType === 'grantsMultiplier') effectsParts.push(`+${se.value}x Multiplier`);
      if (se.effectType === 'grantsGroupMultiplier') effectsParts.push(`+${se.value}x Group Multiplier`);
    });
    
    // Group multiplier with context
    if (groupEffectApplied && groupAggregateDelta > 0) {
      const groupCount = userGroups.length;
      const groupNames = userGroups.slice(0, 3).map(g => g.name).filter(Boolean).join(', ');
      const groupContext = groupCount 
        ? ` (applied to ${groupCount} group${groupCount > 1 ? 's' : ''}${groupNames ? `: ${groupNames}` : ''})`
        : '';
      effectsParts.push(`Group multiplier +${groupAggregateDelta}${groupContext}`);
    }

    // Include item name in effects text like other items (e.g., "via Luck Boost")
    const effectsTextWithItem = effectsParts.length 
      ? `${effectsParts.join(', ')} (via ${item.name})`
      : `(via ${item.name})`;

    // Include group multiplier in prevStats/currStats for proper logging
    const prevWithGroup = { 
      ...before, 
      ...(groupEffectApplied ? { groupMultiplier: prevGroupAggregate } : {}) 
    };
    const afterWithGroup = { 
      ...after, 
      ...(groupEffectApplied ? { groupMultiplier: afterGroupAggregate } : {}) 
    };

    await logStatChanges({
      io: req.app.get('io'),
      classroomId,
      user,
      actionBy: user._id,
      prevStats: prevWithGroup,
      currStats: afterWithGroup,
      context: `Bazaar - ${item.name}`,
      details: { effectsText: effectsTextWithItem }
    });

    return res.json({
      message: 'Utility item used',
      effect: item.primaryEffect,
      stats: scopedAfter.passive,
      discount: after.discount,
      groupMultiplier: groupEffectApplied ? afterGroupAggregate : undefined
    });
  } catch (err) {
    console.error('Utility use error:', err);
    return res.status(500).json({ error: 'Failed to use item', details: err.message });
  }
});

module.exports = router;