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

    // Snapshot bits BEFORE any changes (so we can compute net positives for BOTH sides)
    const attackerBitsBefore = classroomId
      ? getClassroomBalance(req.user, classroomId)
      : (req.user.balance || 0);

    const targetBitsBefore = classroomId
      ? getClassroomBalance(targetUser, classroomId)
      : (targetUser.balance || 0);

    // Snapshot stats BEFORE any changes (for attacker and target)
    // helper (optional, but keeps things consistent)
    const stat = (v, d) => (v ?? d);

    // --- snapshots: replace || with ?? so 0 is preserved ---
    const attackerPrev = {
      multiplier: stat(req.user.passiveAttributes?.multiplier, 1),
      luck: stat(req.user.passiveAttributes?.luck, 1),
      discount: stat(req.user.passiveAttributes?.discount, 0),
      shield: stat(req.user.shieldCount, 0),
      groupMultiplier: stat(req.user.passiveAttributes?.groupMultiplier, 1)
    };
    const targetPrev = {
      multiplier: stat(targetUser.passiveAttributes?.multiplier, 1),
      luck: stat(targetUser.passiveAttributes?.luck, 1),
      discount: stat(targetUser.passiveAttributes?.discount, 0),
      shield: stat(targetUser.shieldCount, 0),
      groupMultiplier: stat(targetUser.passiveAttributes?.groupMultiplier, 1)
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
        multiplier: stat(targetUser.passiveAttributes?.multiplier, 1),
        luck: stat(targetUser.passiveAttributes?.luck, 1),
        discount: stat(targetUser.passiveAttributes?.discount, 0),
        shield: stat(targetUser.shieldCount, 0),
        groupMultiplier: stat(targetUser.passiveAttributes?.groupMultiplier, 1)
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

    // NEW: track no-op nullify so we can still log/notify with +0.0 deltas
    let nullifyNoop = false;
    const nullifyNoopExtraForAttacker = [];
    const nullifyNoopExtraForTarget = [];

    // NEW: track other no-op attacks (e.g., drain when target has 0)
    let attackNoop = false;
    const attackNoopExtraForAttacker = [];
    const attackNoopExtraForTarget = [];

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

        // NEW: if nothing can be drained (target has 0), still notify/log clearly
        if (drainAmount <= 0) {
          attackNoop = true;

          // extra changes for stat-change feed (forced log)
          attackNoopExtraForAttacker.push({ field: 'target.bits', from: tBefore, to: tAfter });
          attackNoopExtraForAttacker.push({
            field: 'attackResult',
            from: 'drainBits',
            to: `no-op (target had ${tBefore} ₿)`
          });

          attackNoopExtraForTarget.push({ field: 'bits', from: tBefore, to: tAfter });
          attackNoopExtraForTarget.push({
            field: 'attackResult',
            from: 'drainBits',
            to: `no-op (you had ${tBefore} ₿)`
          });

          // info-only wallet notifications for both sides
          walletLogs.push({
            user: targetUser,
            amount: 0,
            message: `Attack by ${attackerName} (${item.name}) had no effect because your balance was already ${tBefore} ₿.`,
            prevBalance: tBefore,
            newBalance: tAfter,
            emitBalance: false
          });
          walletLogs.push({
            user: req.user,
            amount: 0,
            message: `Your attack on ${targetName} (${item.name}) drained 0 ₿ because their balance was already ${tBefore} ₿.`,
            prevBalance: tBefore,
            newBalance: tAfter,
            emitBalance: false
          });

          break;
        }

        if (drainAmount > 0) {
          // target (debit)
          targetUser.transactions.push({
            amount: -drainAmount,
            description: `Attack: ${item.name} by ${attackerName} (drained ${drainAmount} ₿)`,
            assignedBy: req.user._id,
            classroom: classroomId || null,
            createdAt: new Date(),
            calculation: { prevBalance: tBefore, newBalance: tAfter },
            type: 'attack'
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
            type: 'attack'
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

            // NEW: no-op swap bits (e.g., both 0)
            if (aBefore === tBefore) {
              attackNoop = true;

              // force attacker/target logs to show "no effect"
              attackNoopExtraForAttacker.push({ field: 'target.bits', from: tBefore, to: tBefore });
              attackNoopExtraForAttacker.push({
                field: 'attackResult',
                from: 'swapper',
                to: `no-op (bits already equal at ${tBefore} ₿)`
              });

              attackNoopExtraForTarget.push({ field: 'bits', from: tBefore, to: tBefore });
              attackNoopExtraForTarget.push({
                field: 'attackResult',
                from: 'swapper',
                to: `no-op (bits already equal at ${tBefore} ₿)`
              });

              effectNotes.push('Swapped bits (no effect)');

              // optional: info-only wallet notifications for clarity
              walletLogs.push({
                user: req.user,
                amount: 0,
                message: `Your swap with ${targetName} (${item.name}) had no effect because both balances were ${tBefore} ₿.`,
                prevBalance: aBefore,
                newBalance: aBefore,
                emitBalance: false
              });
              walletLogs.push({
                user: targetUser,
                amount: 0,
                message: `Swap by ${attackerName} (${item.name}) had no effect because both balances were ${tBefore} ₿.`,
                prevBalance: tBefore,
                newBalance: tBefore,
                emitBalance: false
              });

              break;
            }

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
          case 'multiplier': {
            const aBefore = Number(stat(req.user.passiveAttributes?.multiplier, 1));
            const tBefore = Number(stat(targetUser.passiveAttributes?.multiplier, 1));

            if (Number(aBefore) === Number(tBefore)) {
              attackNoop = true;

              // attacker sees target.* line + a clear no-op marker
              attackNoopExtraForAttacker.push({ field: 'target.multiplier', from: tBefore, to: tBefore });
              attackNoopExtraForAttacker.push({
                field: 'attackResult',
                from: 'swapper',
                to: `no-op (multiplier already equal at ${tBefore})`
              });

              // target sees their own line + no-op marker
              attackNoopExtraForTarget.push({ field: 'multiplier', from: tBefore, to: tBefore });
              attackNoopExtraForTarget.push({
                field: 'attackResult',
                from: 'swapper',
                to: `no-op (multiplier already equal at ${tBefore})`
              });

              effectNotes.push('Swapped multiplier (no effect)');
              break;
            }

            [req.user.passiveAttributes.multiplier, targetUser.passiveAttributes.multiplier] =
              [targetUser.passiveAttributes.multiplier, req.user.passiveAttributes.multiplier];
            effectNotes.push('Swapped multiplier');
            break;
          }

          case 'luck': {
            const aBefore = Number(stat(req.user.passiveAttributes?.luck, 1));
            const tBefore = Number(stat(targetUser.passiveAttributes?.luck, 1));

            if (Number(aBefore) === Number(tBefore)) {
              attackNoop = true;

              attackNoopExtraForAttacker.push({ field: 'target.luck', from: tBefore, to: tBefore });
              attackNoopExtraForAttacker.push({
                field: 'attackResult',
                from: 'swapper',
                to: `no-op (luck already equal at ${tBefore})`
              });

              attackNoopExtraForTarget.push({ field: 'luck', from: tBefore, to: tBefore });
              attackNoopExtraForTarget.push({
                field: 'attackResult',
                from: 'swapper',
                to: `no-op (luck already equal at ${tBefore})`
              });

              effectNotes.push('Swapped luck (no effect)');
              break;
            }

            [req.user.passiveAttributes.luck, targetUser.passiveAttributes.luck] =
              [targetUser.passiveAttributes.luck, req.user.passiveAttributes.luck];
            effectNotes.push('Swapped luck');
            break;
          }
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
        
        if (!targetUser.passiveAttributes) {
          targetUser.passiveAttributes = { luck: 1, multiplier: 1, groupMultiplier: 1 };
        }

        switch(nullifyAttribute) {
          case 'bits': {
            const tBefore = getClassroomBalance(targetUser, classroomId);
            const tAfter = 0;

            if (tBefore === tAfter) {
              nullifyNoop = true;
              nullifyNoopExtraForAttacker.push({
                field: 'attackResult',
                from: 'nullify',
                to: `no-op (target bits already ${tAfter})`
              });
              nullifyNoopExtraForTarget.push({
                field: 'attackResult',
                from: 'nullify',
                to: `no-op (bits already ${tAfter})`
              });
              effectNotes.push('Nullified bits (no effect)');
              break;
            }

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

            // NEW: info-only notif; don't emit balance_update for attacker
            walletLogs.push({
              user: req.user,
              amount: 0,
              message: `You reset ${targetName}'s bits to 0 (${item.name}). Target balance: ${formatArrow(tBefore, tAfter)}`,
              prevBalance: tBefore,
              newBalance: tAfter,
              emitBalance: false
            });
            break;
          }
          case 'multiplier': {
            const before = Number(stat(targetUser.passiveAttributes?.multiplier, 1));
            const after = Math.min(before, 1); // CHANGED: never increase someone above their current value

            if (Number(before) === Number(after)) {
              nullifyNoop = true;
              nullifyNoopExtraForAttacker.push({ field: 'target.multiplier', from: before, to: after });
              nullifyNoopExtraForAttacker.push({
                field: 'attackResult',
                from: 'nullify',
                to: `no-op (target multiplier already <= ${after})`
              });
              nullifyNoopExtraForTarget.push({ field: 'multiplier', from: before, to: after });
              nullifyNoopExtraForTarget.push({
                field: 'attackResult',
                from: 'nullify',
                to: `no-op (multiplier already <= ${after})`
              });
              effectNotes.push('Nullified multiplier (no effect)');
            } else {
              targetUser.passiveAttributes.multiplier = after;
              effectNotes.push('Nullified multiplier');
            }
            break;
          }

          case 'luck': {
            const before = Number(stat(targetUser.passiveAttributes?.luck, 1));
            const after = Math.min(before, 1); // CHANGED: never “heal” debuffed luck

            if (Number(before) === Number(after)) {
              nullifyNoop = true;
              nullifyNoopExtraForAttacker.push({ field: 'target.luck', from: before, to: after });
              nullifyNoopExtraForAttacker.push({
                field: 'attackResult',
                from: 'nullify',
                to: `no-op (target luck already <= ${after})`
              });
              nullifyNoopExtraForTarget.push({ field: 'luck', from: before, to: after });
              nullifyNoopExtraForTarget.push({
                field: 'attackResult',
                from: 'nullify',
                to: `no-op (luck already <= ${after})`
              });
              effectNotes.push('Nullified luck (no effect)');
            } else {
              targetUser.passiveAttributes.luck = after;
              effectNotes.push('Nullified luck');
            }
            break;
          }
        }
        break;
      }
    }

    // Apply secondary effects
    item.secondaryEffects.forEach(effect => {
      switch (effect.effectType) {
        case 'attackLuck': {
          const MIN_LUCK = 0.1;

          const before = Number(stat(targetUser.passiveAttributes?.luck, 1));
          const dec = Number(effect.value) || 0;
          const next = Math.max(MIN_LUCK, before - dec);
          const after = Math.round(next * 10) / 10;

          targetUser.passiveAttributes.luck = after;

          if (Number(after) === Number(before)) {
            attackNoop = true;
            attackNoopExtraForAttacker.push({ field: 'target.luck', from: before, to: after });
            attackNoopExtraForAttacker.push({
              field: 'attackResult',
              from: 'attackLuck',
              to: `no-op (target luck already at minimum ${after})`
            });
            attackNoopExtraForTarget.push({ field: 'luck', from: before, to: after });
            attackNoopExtraForTarget.push({
              field: 'attackResult',
              from: 'attackLuck',
              to: `no-op (luck already at minimum ${after})`
            });
            effectNotes.push(`-${effect.value} Luck (no effect)`);
          } else {
            effectNotes.push(`-${effect.value} Luck`);
          }
          break;
        }

        case 'attackMultiplier': {
          const before = Number(stat(targetUser.passiveAttributes?.multiplier, 1));
          const dec = Number(effect.value) || 0;
          const after = Math.max(1, before - dec);

          targetUser.passiveAttributes.multiplier = after;

          if (Number(after) === Number(before)) {
            attackNoop = true;
            attackNoopExtraForAttacker.push({ field: 'target.multiplier', from: before, to: after });
            attackNoopExtraForAttacker.push({
              field: 'attackResult',
              from: 'attackMultiplier',
              to: `no-op (target multiplier already at minimum ${after})`
            });
            attackNoopExtraForTarget.push({ field: 'multiplier', from: before, to: after });
            attackNoopExtraForTarget.push({
              field: 'attackResult',
              from: 'attackMultiplier',
              to: `no-op (multiplier already at minimum ${after})`
            });
            effectNotes.push(`-${effect.value}x Multiplier (no effect)`);
          } else {
            effectNotes.push(`-${effect.value}x Multiplier`);
          }
          break;
        }

        case 'attackGroupMultiplier': {
          const before = Number(stat(targetUser.passiveAttributes?.groupMultiplier, 1));
          const dec = Number(effect.value) || 0;
          const after = Math.max(1, before - dec);

          targetUser.passiveAttributes.groupMultiplier = after;

          if (Number(after) === Number(before)) {
            attackNoop = true;
            attackNoopExtraForAttacker.push({ field: 'target.groupMultiplier', from: before, to: after });
            attackNoopExtraForAttacker.push({
              field: 'attackResult',
              from: 'attackGroupMultiplier',
              to: `no-op (target groupMultiplier already at minimum ${after})`
            });
            attackNoopExtraForTarget.push({ field: 'groupMultiplier', from: before, to: after });
            attackNoopExtraForTarget.push({
              field: 'attackResult',
              from: 'attackGroupMultiplier',
              to: `no-op (groupMultiplier already at minimum ${after})`
            });
            effectNotes.push(`-${effect.value}x Group Multiplier (no effect)`);
          } else {
            effectNotes.push(`-${effect.value}x Group Multiplier`);
          }
          break;
        }
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
              const effectsText = `Group multiplier ${delta < 0 ? '' : '+'}${delta} (${groupContext}) — Applied by ${attackerName} (via ${item.name})`;

              await logStatChanges({
                io: req.app && req.app.get ? req.app.get('io') : null,
                classroomId,
                user: targetUserDoc,
                actionBy: req.user._id,
                prevStats: { groupMultiplier: prevAggregate },
                currStats: { groupMultiplier: afterAggregate },
                context: `Bazaar - Group multiplier reduced (${item.name})`,
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

    // NEW: XP for positive attack outcomes (applies to attacker AND target)
    // - Bits Earned XP: any net-positive bit delta (>= 1)
    // - Stat Increase XP: any net-positive stat increase (e.g. gained multiplier/luck via swap)
    try {
      if (classroomId) {
        const cls = await Classroom.findById(classroomId).select('xpSettings');
        if (cls?.xpSettings?.enabled) {
          const io = req.app && req.app.get ? req.app.get('io') : null;

          const bitsEarnedRate = Number(cls.xpSettings.bitsEarned || 0);
          const statRate = Number(cls.xpSettings.statIncrease || 0);

          const safeNum = (v, d = 0) => {
            const n = Number(v);
            return Number.isFinite(n) ? n : d;
          };

          const attackerBitsAfter = getClassroomBalance(req.user, classroomId);
          const targetBitsAfter = getClassroomBalance(targetUser, classroomId);

          const attackerBitsDelta = attackerBitsAfter - attackerBitsBefore;
          const targetBitsDelta = targetBitsAfter - targetBitsBefore;

          // FIX: use ??-based defaults so 0 does NOT turn into 1
          const attackerAfter = {
            multiplier: stat(req.user.passiveAttributes?.multiplier, 1),
            luck: stat(req.user.passiveAttributes?.luck, 1),
            discount: stat(req.user.passiveAttributes?.discount, 0),
            shield: stat(req.user.shieldCount, 0),
            groupMultiplier: stat(req.user.passiveAttributes?.groupMultiplier, 1)
          };
          const targetAfter = {
            multiplier: stat(targetUser.passiveAttributes?.multiplier, 1),
            luck: stat(targetUser.passiveAttributes?.luck, 1),
            discount: stat(targetUser.passiveAttributes?.discount, 0),
            shield: stat(targetUser.shieldCount, 0),
            groupMultiplier: stat(targetUser.passiveAttributes?.groupMultiplier, 1)
          };

          const collectPositiveStatIncreases = (before, after) => {
            const parts = [];
            let count = 0;

            // treat any positive direction as a "stat increase" (counted once per stat)
            if (safeNum(after.multiplier, 1) > safeNum(before.multiplier, 1)) {
              count += 1;
              parts.push(`Multiplier: ${safeNum(before.multiplier, 1)} → ${safeNum(after.multiplier, 1)}`);
            }
            if (safeNum(after.luck, 1) > safeNum(before.luck, 1)) {
              count += 1;
              parts.push(`Luck: ${safeNum(before.luck, 1)} → ${safeNum(after.luck, 1)}`);
            }
            if (safeNum(after.discount, 0) > safeNum(before.discount, 0)) {
              count += 1;
              parts.push(`Discount: ${safeNum(before.discount, 0)} → ${safeNum(after.discount, 0)}`);
            }
            if (safeNum(after.shield, 0) > safeNum(before.shield, 0)) {
              count += 1;
              parts.push(`Shield: ${safeNum(before.shield, 0)} → ${safeNum(after.shield, 0)}`);
            }
            if (safeNum(after.groupMultiplier, 1) > safeNum(before.groupMultiplier, 1)) {
              count += 1;
              parts.push(`Group Multiplier: ${safeNum(before.groupMultiplier, 1)} → ${safeNum(after.groupMultiplier, 1)}`);
            }

            return { count, parts };
          };

          const awardBitsEarnedXP = async ({ userDoc, bitsDelta, whoLabel }) => {
            if (!userDoc?._id) return;
            if (bitsEarnedRate <= 0) return;
            if (bitsDelta <= 0) return;

            const xpBits = Math.abs(bitsDelta); // attacks do not apply multipliers => base == final
            const xpToAward = xpBits * bitsEarnedRate;
            if (xpToAward <= 0) return;

            const xpRes = await awardXP(userDoc._id, classroomId, xpToAward, 'earning bits (attack outcome)', cls.xpSettings);
            if (xpRes && typeof xpRes.oldXP !== 'undefined' && typeof xpRes.newXP !== 'undefined' && xpRes.newXP !== xpRes.oldXP) {
              await logStatChanges({
                io,
                classroomId,
                user: userDoc,
                actionBy: req.user ? req.user._id : undefined,
                prevStats: { xp: xpRes.oldXP },
                currStats: { xp: xpRes.newXP },
                context: 'earning bits (attack outcome)',
                details: { effectsText: `${whoLabel} gained ${bitsDelta} ₿ (via ${item.name})` },
                forceLog: true
              });
            }
          };

          const awardStatIncreaseXP = async ({ userDoc, beforeStats, afterStats, whoLabel }) => {
            if (!userDoc?._id) return;
            if (statRate <= 0) return;

            const { count, parts } = collectPositiveStatIncreases(beforeStats, afterStats);
            if (count <= 0) return;

            const xpToAward = count * statRate;
            if (xpToAward <= 0) return;

            const xpRes = await awardXP(userDoc._id, classroomId, xpToAward, 'stat increase (attack outcome)', cls.xpSettings);
            if (xpRes && typeof xpRes.oldXP !== 'undefined' && typeof xpRes.newXP !== 'undefined' && xpRes.newXP !== xpRes.oldXP) {
              await logStatChanges({
                io,
                classroomId,
                user: userDoc,
                actionBy: req.user ? req.user._id : undefined,
                prevStats: { xp: xpRes.oldXP },
                currStats: { xp: xpRes.newXP },
                context: 'stat increase (attack outcome)',
                details: { effectsText: `${whoLabel} benefited: ${parts.join('; ')} (via ${item.name})` },
                forceLog: true
              });
            }
          };

          // Attacker: positive outcomes
          await awardBitsEarnedXP({ userDoc: req.user, bitsDelta: attackerBitsDelta, whoLabel: 'Attacker' });
          await awardStatIncreaseXP({ userDoc: req.user, beforeStats: attackerPrev, afterStats: attackerAfter, whoLabel: 'Attacker' });

          // Target: positive outcomes (e.g. swap benefits them)
          await awardBitsEarnedXP({ userDoc: targetUser, bitsDelta: targetBitsDelta, whoLabel: 'Target' });
          await awardStatIncreaseXP({ userDoc: targetUser, beforeStats: targetPrev, afterStats: targetAfter, whoLabel: 'Target' });
        }
      }
    } catch (e) {
      console.warn('[attackItem] positive-outcome XP award/log failed:', e);
    }

    // Award XP for using an attack item (existing behavior)
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
          message: ev.message,
          classroom: classroomId || null,
          amount: ev.amount,
          prevBalance: ev.prevBalance,
          newBalance: ev.newBalance,
          createdAt: new Date()
        });
        const pop = await populateNotification(n._id);
        if (io && pop) io.to(`user-${ev.user._id}`).emit('notification', pop);

        // NEW: allow info-only notifications without emitting balance updates
        const shouldEmitBalance = ev.emitBalance !== false;
        if (shouldEmitBalance && io) {
          const newBal = classroomId ? getClassroomBalance(ev.user, classroomId) : (ev.user.balance || 0);
          io.to(`user-${ev.user._id}`).emit('balance_update', { userId: ev.user._id, classroomId, newBalance: newBal });
          if (classroomId) io.to(`classroom-${classroomId}`).emit('balance_update', { studentId: ev.user._id, classroomId, newBalance: newBal });
        }
      }
    } catch (e) {
      console.warn('[attackItem] wallet notifications/emit failed:', e);
    }

    // NEW: log stat changes for attacker and target (only if any tracked fields changed)
    const attackerAfter = {
      multiplier: stat(req.user.passiveAttributes?.multiplier, 1),
      luck: stat(req.user.passiveAttributes?.luck, 1),
      discount: stat(req.user.passiveAttributes?.discount, 0),
      shield: stat(req.user.shieldCount, 0),
      groupMultiplier: stat(req.user.passiveAttributes?.groupMultiplier, 1)
    };
    const targetAfter = {
      multiplier: stat(targetUser.passiveAttributes?.multiplier, 1),
      luck: stat(targetUser.passiveAttributes?.luck, 1),
      discount: stat(targetUser.passiveAttributes?.discount, 0),
      shield: stat(targetUser.shieldCount, 0),
      groupMultiplier: stat(targetUser.passiveAttributes?.groupMultiplier, 1)
    };

    // NEW: build effects text already collected; include item name in human text
    const effectsText = effectNotes.length ? `${effectNotes.join(', ')} (via ${item.name})` : undefined;

    // Include target-side diffs in attacker’s log (prefixed as target.*)
    const targetDiffForAttacker = diffChanges(targetPrev, targetAfter, 'target.');

    // NEW: if nullify was a no-op, still force a log and include +0.0 lines
    const attackerExtra = [
      ...targetDiffForAttacker,
      ...(nullifyNoop ? nullifyNoopExtraForAttacker : []),
      ...(attackNoop ? attackNoopExtraForAttacker : [])
    ];
    const targetExtra = [
      ...(nullifyNoop ? nullifyNoopExtraForTarget : []),
      ...(attackNoop ? attackNoopExtraForTarget : [])
    ];

    const forceAttackLog = Boolean(nullifyNoop || attackNoop);

    await logStatChanges({
      io: req.app.get('io'),
      classroomId,
      user: req.user,
      actionBy: req.user._id,
      prevStats: attackerPrev,
      currStats: attackerAfter,
      context: `Bazaar - Attack on ${targetName} (${item.name})`,
      details: { effectsText },
      extraChanges: attackerExtra,
      forceLog: forceAttackLog
    });

    await logStatChanges({
      io: req.app.get('io'),
      classroomId,
      user: targetUser,
      actionBy: req.user._id,
      prevStats: targetPrev,
      currStats: targetAfter,
      context: `Bazaar - Attacked by ${attackerName} (${item.name})`,
      details: { effectsText },
      extraChanges: targetExtra,
      forceLog: forceAttackLog
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
        // CHANGED: report actual post-value (not always 1)
        targetNewValue:
          req.body.nullifyAttribute === 'bits'
            ? 0
            : (req.body.nullifyAttribute === 'luck'
                ? Number(stat(targetUser.passiveAttributes?.luck, 1))
                : Number(stat(targetUser.passiveAttributes?.multiplier, 1)))
      }),
      shieldDestroyed: false
    });
  } catch (err) {
    console.error('Item use error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;