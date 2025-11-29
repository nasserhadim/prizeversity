const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const User = require('../models/User');
const Group = require('../models/Group');
const GroupSet = require('../models/GroupSet');
const { ensureAuthenticated } = require('../config/auth');
const Classroom = require('../models/Classroom');
const { awardXP } = require('../utils/awardXP');
const { logStatChanges } = require('../utils/statChangeLog'); // NEW
const Notification = require('../models/Notification');        // NEW
const { populateNotification } = require('../utils/notifications'); // NEW

// helpers for classroom-scoped balances
function getClassroomBalance(user, classroomId) {
  if (!classroomId) return user.balance || 0;
  if (!Array.isArray(user.classroomBalances)) return user.balance || 0;
  const entry = user.classroomBalances.find(cb => String(cb.classroom) === String(classroomId));
  return entry ? entry.balance : (user.balance || 0);
}
function setClassroomBalance(user, classroomId, newBalance) {
  if (!classroomId) { user.balance = newBalance; return; }
  if (!Array.isArray(user.classroomBalances)) user.classroomBalances = [];
  const idx = user.classroomBalances.findIndex(cb => String(cb.classroom) === String(classroomId));
  if (idx >= 0) {
    user.classroomBalances[idx].balance = newBalance;
  } else {
    user.classroomBalances.push({ classroom: classroomId, balance: newBalance });
  }
}

// attack item is one of the categories for the items that use effects that are used to 'hurt' damage the target's bits, luck, or multiplier

router.post('/use/:itemId', ensureAuthenticated, async (req, res) => {
  try {
    const { targetUserId, swapAttribute, nullifyAttribute } = req.body;
    const classroomId = req.body.classroomId || req.query.classroomId;

    const item = await Item.findById(req.params.itemId);
    
    if (!item || item.owner.toString() !== req.user._id.toString()) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    // Snapshot stats BEFORE any changes (for attacker and target)
    const attackerPrev = {
      multiplier: req.user.passiveAttributes?.multiplier || 1,
      luck: req.user.passiveAttributes?.luck || 1,
      discount: req.user.passiveAttributes?.discount || 0,
      shield: req.user.shieldCount || 0,
      groupMultiplier: req.user.passiveAttributes?.groupMultiplier || 1
    };
    const targetPrev = {
      multiplier: targetUser.passiveAttributes?.multiplier || 1,
      luck: targetUser.passiveAttributes?.luck || 1,
      discount: targetUser.passiveAttributes?.discount || 0,
      shield: targetUser.shieldCount || 0,
      groupMultiplier: targetUser.passiveAttributes?.groupMultiplier || 1
    };

    // Helpful display names
    const attackerName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;
    const targetName = `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim() || targetUser.email;

    // Small helper to compute normalized diffs like statChangeLog
    const diffChanges = (prev, curr, prefix = '') => {
      const fields = ['multiplier', 'luck', 'discount', 'shield', 'groupMultiplier'];
      const norm = (f, v) => {
        if (v == null) return v;
        if (['multiplier','luck','groupMultiplier'].includes(f)) return Number(Number(v).toFixed(1));
        if (f === 'discount') return Math.round(Number(v));
        if (f === 'shield') return Math.max(0, parseInt(v, 10));
        return v;
      };
      const out = [];
      for (const f of fields) {
        const b = norm(f, prev[f]);
        const a = norm(f, curr[f]);
        if (b === undefined && a === undefined) continue;
        if (String(b) !== String(a)) out.push({ field: `${prefix}${f}`, from: b, to: a });
      }
      return out;
    };

    // Check if target has active shield
    if (targetUser.shieldActive) {
      // Consume one shield
      targetUser.shieldCount = Math.max(0, (targetUser.shieldCount || 0) - 1);
      if (targetUser.shieldCount === 0) {
        targetUser.shieldActive = false;
      }
      await targetUser.save();

      // Find and DELETE the shield item (not just deactivate)
      const shieldItem = await Item.findOneAndDelete({
        owner: targetUserId,
        category: 'Defend',
        active: true
      });

      // Delete the attack item (since it was used)
      await Item.findByIdAndDelete(item._id);

      // Award XP for using an attack item (consumed even if blocked)
      try {
        if (classroomId) {
          const cls = await Classroom.findById(classroomId).select('xpSettings');
          const rate = cls?.xpSettings?.enabled ? (cls.xpSettings.statIncrease || 0) : 0;
          if (rate > 0) {
            await awardXP(req.user._id, classroomId, rate, 'stat increase (attack item used)', cls.xpSettings);
          }
        }
      } catch (e) {
        console.warn('[attackItem] awardXP failed:', e);
      }

      // Target log (already present)
      const targetAfterBlocked = {
        multiplier: targetUser.passiveAttributes?.multiplier || 1,
        luck: targetUser.passiveAttributes?.luck || 1,
        discount: targetUser.passiveAttributes?.discount || 0,
        shield: targetUser.shieldCount || 0,
        groupMultiplier: targetUser.passiveAttributes?.groupMultiplier || 1
      };

      // Target gets the shield decrement entry
      await logStatChanges({
        io: req.app.get('io'),
        classroomId,
        user: targetUser,
        actionBy: req.user._id,
        prevStats: targetPrev,
        currStats: targetAfterBlocked,
        context: `Bazaar - Attack by ${attackerName} (${item.name}) was blocked`,
        details: { effectsText: 'Shield -1 (blocked attack)' }
      });

      // Attacker gets a forced log with target’s shield change as extraChanges
      const targetDiffForAttacker = diffChanges(targetPrev, targetAfterBlocked, 'target.');
      await logStatChanges({
        io: req.app.get('io'),
        classroomId,
        user: req.user,
        actionBy: req.user._id,
        prevStats: attackerPrev,
        currStats: attackerPrev, // attacker stats unchanged on block
        context: `Bazaar - Attack on ${targetName} (${item.name}) was blocked`,
        details: { effectsText: `Blocked by ${targetName} (shield consumed)` },
        forceLog: true,
        extraChanges: [{ field: 'attackResult', from: 'attempted', to: `blocked by ${targetName}` }, ...targetDiffForAttacker]
      });

      return res.status(200).json({
        message: 'Attack blocked by shield! Both shield and attack items were consumed.',
        newBalance: req.user.balance,
        targetBalance: targetUser.balance,
        shieldDestroyed: true
      });
    }

    // If no shield, proceed with attack
    const effectNotes = [];
    const walletLogs = [];

    const formatArrow = (from, to) => `${from} → ${to}`;

    switch(item.primaryEffect) {
      case 'halveBits': {
        const tBefore = getClassroomBalance(targetUser, classroomId);
        const tAfter  = Math.floor(tBefore / 2);
        setClassroomBalance(targetUser, classroomId, tAfter);
        effectNotes.push('Halved bits');

        const lost = tBefore - tAfter;
        if (lost > 0) {
          targetUser.transactions.push({
            amount: -lost,
            description: `Attack: ${item.name} by ${attackerName} (halved bits)`,
            assignedBy: req.user._id,
            classroom: classroomId || null,
            createdAt: new Date(),
            calculation: { prevBalance: tBefore, newBalance: tAfter },
            type: 'attack' // NEW
          });
          walletLogs.push({
            user: targetUser,
            amount: -lost,
            message: `You lost ${lost} ₿ due to attack by ${attackerName} (${item.name}). Balance: ${formatArrow(tBefore, tAfter)}`,
            prevBalance: tBefore,
            newBalance: tAfter
          });
        }
        break;
      }

      case 'drainBits': {
        const tBefore = getClassroomBalance(targetUser, classroomId);
        const drainAmount = Math.floor(tBefore * (Number(item.primaryEffectValue || 0) / 100));
        const tAfter  = Math.max(0, tBefore - drainAmount);
        setClassroomBalance(targetUser, classroomId, tAfter);

        const aBefore = getClassroomBalance(req.user, classroomId);
        const aAfter  = aBefore + drainAmount;
        setClassroomBalance(req.user, classroomId, aAfter);

        effectNotes.push(`Drained ${item.primaryEffectValue || 0}% bits`);

        if (drainAmount > 0) {
          // target (debit)
          targetUser.transactions.push({
            amount: -drainAmount,
            description: `Attack: ${item.name} by ${attackerName} (drained ${drainAmount} ₿)`,
            assignedBy: req.user._id,
            classroom: classroomId || null,
            createdAt: new Date(),
            calculation: { prevBalance: tBefore, newBalance: tAfter },
            type: 'attack' // NEW
          });
          walletLogs.push({
            user: targetUser,
            amount: -drainAmount,
            message: `You lost ${drainAmount} ₿ due to attack by ${attackerName} (${item.name}). Balance: ${formatArrow(tBefore, tAfter)}`,
            prevBalance: tBefore,
            newBalance: tAfter
          });

          // attacker (credit)
          req.user.transactions.push({
            amount: drainAmount,
            description: `Attack: ${item.name} vs ${targetName} (received ${drainAmount} ₿)`,
            assignedBy: req.user._id,
            classroom: classroomId || null,
            createdAt: new Date(),
            calculation: { prevBalance: aBefore, newBalance: aAfter },
            type: 'attack' // NEW
          });
          walletLogs.push({
            user: req.user,
            amount: drainAmount,
            message: `You received ${drainAmount} ₿ from attack on ${targetName} (${item.name}). Balance: ${formatArrow(aBefore, aAfter)}`,
            prevBalance: aBefore,
            newBalance: aAfter
          });
        }
        break;
      }

      case 'swapper': {
        if (!swapAttribute) {
          return res.status(400).json({ 
            error: 'Swap attribute is required',
            validAttributes: item.swapOptions || ['bits', 'multiplier', 'luck']
          });
        }
        
        // Check if the selected attribute is in the allowed list
        const allowedSwapOptions = item.swapOptions && item.swapOptions.length > 0 
          ? item.swapOptions 
          : ['bits', 'multiplier', 'luck'];
          
        if (!allowedSwapOptions.includes(swapAttribute)) {
          return res.status(400).json({ 
            error: 'Invalid swap attribute for this item',
            validAttributes: allowedSwapOptions,
            received: swapAttribute
          });
        }
        
        // Perform the swap
        switch(swapAttribute) {
          case 'bits': {
            const aBefore = getClassroomBalance(req.user, classroomId);
            const tBefore = getClassroomBalance(targetUser, classroomId);

            setClassroomBalance(req.user, classroomId, tBefore);
            setClassroomBalance(targetUser, classroomId, aBefore);
            effectNotes.push('Swapped bits');

            const aAfter = tBefore;
            const tAfter = aBefore;
            const deltaAtt = aAfter - aBefore;
            const deltaTar = tAfter - tBefore;

            // attacker delta
            if (deltaAtt !== 0) {
              req.user.transactions.push({
                amount: deltaAtt,
                description: `Attack: ${item.name} swap with ${targetName} (${deltaAtt >= 0 ? '+' : ''}${deltaAtt} ₿)`,
                assignedBy: req.user._id,
                classroom: classroomId || null,
                createdAt: new Date(),
                calculation: { prevBalance: aBefore, newBalance: aAfter },
                type: 'attack' // NEW
              });
              walletLogs.push({
                user: req.user,
                amount: deltaAtt,
                message: `${deltaAtt >= 0 ? 'You received' : 'You lost'} ${Math.abs(deltaAtt)} ₿ from swap with ${targetName} (${item.name}). Balance: ${formatArrow(aBefore, aAfter)}`,
                prevBalance: aBefore,
                newBalance: aAfter
              });
            }

            // target delta
            if (deltaTar !== 0) {
              targetUser.transactions.push({
                amount: deltaTar,
                description: `Attack: ${item.name} swap by ${attackerName} (${deltaTar >= 0 ? '+' : ''}${deltaTar} ₿)`,
                assignedBy: req.user._id,
                classroom: classroomId || null,
                createdAt: new Date(),
                calculation: { prevBalance: tBefore, newBalance: tAfter },
                type: 'attack' // NEW
              });
              walletLogs.push({
                user: targetUser,
                amount: deltaTar,
                message: `${deltaTar >= 0 ? 'You received' : 'You lost'} ${Math.abs(deltaTar)} ₿ from swap with ${attackerName} (${item.name}). Balance: ${formatArrow(tBefore, tAfter)}`,
                prevBalance: tBefore,
                newBalance: tAfter
              });
            }
            break;
          }
          case 'multiplier':
            [req.user.passiveAttributes.multiplier, targetUser.passiveAttributes.multiplier] = 
              [targetUser.passiveAttributes.multiplier, req.user.passiveAttributes.multiplier];
            effectNotes.push('Swapped multiplier');
            break;
          case 'luck':
            [req.user.passiveAttributes.luck, targetUser.passiveAttributes.luck] = 
              [targetUser.passiveAttributes.luck, req.user.passiveAttributes.luck];
            effectNotes.push('Swapped luck');
            break;
        }
        break;
      }

      case 'nullify': {
        if (!nullifyAttribute) {
          return res.status(400).json({ 
            error: 'Nullify attribute is required',
            validAttributes: item.swapOptions || ['bits', 'multiplier', 'luck']
          });
        }
        
        // Check if the selected attribute is in the allowed list
        const allowedNullifyOptions = item.swapOptions && item.swapOptions.length > 0 
          ? item.swapOptions 
          : ['bits', 'multiplier', 'luck'];
          
        if (!allowedNullifyOptions.includes(nullifyAttribute)) {
          return res.status(400).json({ 
            error: 'Invalid nullify attribute for this item',
            validAttributes: allowedNullifyOptions,
            received: nullifyAttribute
          });
        }
        
        // Initialize passiveAttributes if they don't exist
        if (!targetUser.passiveAttributes) {
          targetUser.passiveAttributes = {
            luck: 1,
            multiplier: 1,
            groupMultiplier: 1
          };
        }

        // Perform the nullify
        switch(nullifyAttribute) {
          case 'bits': {
            const tBefore = getClassroomBalance(targetUser, classroomId);
            const tAfter = 0;
            if (tBefore > 0) {
              setClassroomBalance(targetUser, classroomId, 0);
              effectNotes.push('Nullified bits');
              targetUser.transactions.push({
                amount: -tBefore,
                description: `Attack: ${item.name} by ${attackerName} (reset to 0)`,
                assignedBy: req.user._id,
                classroom: classroomId || null,
                createdAt: new Date(),
                calculation: { prevBalance: tBefore, newBalance: tAfter },
                type: 'attack' // NEW
              });
              walletLogs.push({
                user: targetUser,
                amount: -tBefore,
                message: `Your bits were reset to 0 by ${attackerName} (${item.name}). Balance: ${formatArrow(tBefore, tAfter)}`,
                prevBalance: tBefore,
                newBalance: tAfter
              });
            } else {
              setClassroomBalance(targetUser, classroomId, 0);
              effectNotes.push('Nullified bits');
            }
            break;
          }
          case 'multiplier':
            targetUser.passiveAttributes.multiplier = 1;
            effectNotes.push('Nullified multiplier');
            break;
          case 'luck':
            targetUser.passiveAttributes.luck = 1;
            effectNotes.push('Nullified luck');
            break;
        }
        break;
      }
    }

    // Apply secondary effects
    item.secondaryEffects.forEach(effect => {
      switch(effect.effectType) {
        case 'attackLuck':
          targetUser.passiveAttributes.luck = Math.max(0, 
            (targetUser.passiveAttributes.luck || 1) - effect.value);
          effectNotes.push(`-${effect.value} Luck`);
          break;
        case 'attackMultiplier':
          targetUser.passiveAttributes.multiplier = Math.max(1, 
            (targetUser.passiveAttributes.multiplier || 1) - effect.value);
          effectNotes.push(`-${effect.value}x Multiplier`);
          break;
        case 'attackGroupMultiplier':
          targetUser.passiveAttributes.groupMultiplier = Math.max(1, 
            (targetUser.passiveAttributes.groupMultiplier || 1) - effect.value);
          effectNotes.push(`-${effect.value}x Group Multiplier`);
          break;
      }
    });

    // --- NEW: If attack reduced group multipliers, apply change to classroom-scoped Groups and log for affected members ---
    try {
      const groupDecreaseEffects = (item.secondaryEffects || []).filter(se => se.effectType === 'attackGroupMultiplier' && Number(se.value));
      if (groupDecreaseEffects.length && classroomId) {
        // load group IDs for this classroom
        const gs = await GroupSet.find({ classroom: classroomId }).select('groups');
        const groupIds = gs.flatMap(g => (g.groups || []).map(String));

        // find groups in this classroom where the target is an approved member
        const groupsToUpdate = await Group.find({
          _id: { $in: groupIds },
          'members._id': targetUserId,
          'members.status': 'approved'
        });

        if (groupsToUpdate && groupsToUpdate.length) {
          // capture previous multipliers per group
          const prevByGroup = new Map();
          groupsToUpdate.forEach(g => prevByGroup.set(String(g._id), Number(g.groupMultiplier || 1)));

          // apply all decreases (sum multiple attackGroupMultiplier effects)
          const totalDecreasePerGroup = groupDecreaseEffects.reduce((s, se) => s + (Number(se.value) || 0), 0);
          groupsToUpdate.forEach(g => {
            g.groupMultiplier = Math.max(1, (Number(g.groupMultiplier || 1) - totalDecreasePerGroup));
          });

          // save updated groups
          await Promise.all(groupsToUpdate.map(g => g.save()));

          // build affected member map (memberId -> { prevAggregate, afterAggregate, groupNames })
          const memberMap = new Map();
          for (const g of groupsToUpdate) {
            const gName = g.name || String(g._id);
            const prevVal = prevByGroup.get(String(g._id)) || 1;
            const afterVal = Number(g.groupMultiplier || 1);
            for (const m of (g.members || [])) {
              if (!m._id) continue;
              if (m.status !== 'approved') continue;
              const id = String(m._id);
              const cur = memberMap.get(id) || { prevAggregate: 0, afterAggregate: 0, groupNames: new Set() };
              cur.prevAggregate += prevVal;
              cur.afterAggregate += afterVal;
              cur.groupNames.add(gName);
              memberMap.set(id, cur);
            }
          }

          // Log stat change for each affected member (exclude attacker/actor)
          for (const [memberId, info] of memberMap.entries()) {
            if (memberId === String(req.user._id)) continue; // actor already sees attack logs
            try {
              const targetUserDoc = await User.findById(memberId).select('firstName lastName email');
              const prevAggregate = Number(info.prevAggregate.toFixed(3));
              const afterAggregate = Number(info.afterAggregate.toFixed(3));
              const delta = Number((afterAggregate - prevAggregate).toFixed(3));
              const groupNamesArr = Array.from(info.groupNames || []);
              const groupContext = groupNamesArr.length ? `applied to ${groupNamesArr.length} group${groupNamesArr.length>1?'s':''}: ${groupNamesArr.slice(0,5).join(', ')}` : '';
              const effectsText = `Group multiplier ${delta < 0 ? '' : '+'}${delta} (${groupContext}) — Applied by ${attackerName}`;

              await logStatChanges({
                io: req.app && req.app.get ? req.app.get('io') : null,
                classroomId,
                user: targetUserDoc,
                actionBy: req.user._id,
                prevStats: { groupMultiplier: prevAggregate },
                currStats: { groupMultiplier: afterAggregate },
                context: `Bazaar - Group multiplier reduced`,
                details: { effectsText },
                forceLog: true
              });
            } catch (memberLogErr) {
              console.warn('[attackItem] failed to log group multiplier change for member', memberId, memberLogErr);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[attackItem] group multiplier propagation failed:', e);
    }

    await targetUser.save();
    await req.user.save();
    item.usesRemaining = Math.max(0, (item.usesRemaining || 1) - 1);
    item.consumed = item.usesRemaining === 0;
    await item.save();

    // Award XP for using an attack item
    try {
      if (classroomId) {
        const cls = await Classroom.findById(classroomId).select('xpSettings');
        const rate = cls?.xpSettings?.enabled ? (cls.xpSettings.statIncrease || 0) : 0;
        if (rate > 0) {
          await awardXP(req.user._id, classroomId, rate, 'stat increase (attack item used)', cls.xpSettings);
        }
      }
    } catch (e) {
      console.warn('[attackItem] awardXP failed:', e);
    }

    // Create wallet notifications and emit balance updates
    try {
      const io = req.app.get('io');
      for (const ev of walletLogs) {
        const n = await Notification.create({
          user: ev.user._id,
          actionBy: req.user._id,
          type: 'wallet_transaction',
          message: ev.message,               // includes "Balance: X → Y"
          classroom: classroomId || null,
          amount: ev.amount,
          prevBalance: ev.prevBalance,       // optional metadata
          newBalance: ev.newBalance,         // optional metadata
          createdAt: new Date()
        });
        const pop = await populateNotification(n._id);
        if (io && pop) io.to(`user-${ev.user._id}`).emit('notification', pop);

        const newBal = classroomId ? getClassroomBalance(ev.user, classroomId) : (ev.user.balance || 0);
        if (io) {
          io.to(`user-${ev.user._id}`).emit('balance_update', { userId: ev.user._id, classroomId, newBalance: newBal });
          if (classroomId) io.to(`classroom-${classroomId}`).emit('balance_update', { studentId: ev.user._id, classroomId, newBalance: newBal });
        }
      }
    } catch (e) {
      console.warn('[attackItem] wallet notifications/emit failed:', e);
    }

    // NEW: log stat changes for attacker and target (only if any tracked fields changed)
    const attackerAfter = {
      multiplier: req.user.passiveAttributes?.multiplier || 1,
      luck: req.user.passiveAttributes?.luck || 1,
      discount: req.user.passiveAttributes?.discount || 0,
      shield: req.user.shieldCount || 0,
      groupMultiplier: req.user.passiveAttributes?.groupMultiplier || 1
    };
    const targetAfter = {
      multiplier: targetUser.passiveAttributes?.multiplier || 1,
      luck: targetUser.passiveAttributes?.luck || 1,
      discount: targetUser.passiveAttributes?.discount || 0,
      shield: targetUser.shieldCount || 0,
      groupMultiplier: targetUser.passiveAttributes?.groupMultiplier || 1
    };

    // NEW: build effects text already collected; add human names in context
    const effectsText = effectNotes.join(', ') || undefined;

    // Include target-side diffs in attacker’s log (prefixed as target.*)
    const targetDiffForAttacker = diffChanges(targetPrev, targetAfter, 'target.');

    // Attacker notification with own changes + target-side changes
    await logStatChanges({
      io: req.app.get('io'),
      classroomId,
      user: req.user,
      actionBy: req.user._id,
      prevStats: attackerPrev,
      currStats: attackerAfter,
      context: `Bazaar - Attack on ${targetName} (${item.name})`,
      details: { effectsText },
      extraChanges: targetDiffForAttacker
    });

    // Target notification (their own before/after already captured)
    await logStatChanges({
      io: req.app.get('io'),
      classroomId,
      user: targetUser,
      actionBy: req.user._id,
      prevStats: targetPrev,
      currStats: targetAfter,
      context: `Bazaar - Attacked by ${attackerName} (${item.name})`,
      details: { effectsText }
    });

    res.json({ 
      message: item.primaryEffect === 'swapper' 
        ? `Successfully swapped ${req.body.swapAttribute}! Item was consumed.`
        : item.primaryEffect === 'nullify'
          ? `Successfully nullified ${req.body.nullifyAttribute}! Item was consumed.`
          : 'Attack successful! Attack item was consumed.',
      newBalance: req.user.balance,
      targetBalance: targetUser.balance,
      ...(item.primaryEffect === 'swapper' && {
        newMultiplier: req.user.passiveAttributes?.multiplier,
        targetNewMultiplier: targetUser.passiveAttributes?.multiplier,
        newLuck: req.user.passiveAttributes?.luck,
        targetNewLuck: targetUser.passiveAttributes?.luck
      }),
      ...(item.primaryEffect === 'nullify' && {
        nullifiedAttribute: req.body.nullifyAttribute,
        targetNewValue: req.body.nullifyAttribute === 'bits' ? 0 : 1
      }),
      shieldDestroyed: false
    });
  } catch (err) {
    console.error('Item use error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;