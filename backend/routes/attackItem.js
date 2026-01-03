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
const { getClassroomIdFromReq, getScopedUserStats } = require('../utils/classroomStats');

// helpers for classroom-scoped balances
function getClassroomBalance(user, classroomId) {
  if (!classroomId) return user.balance || 0;
  if (!Array.isArray(user.classroomBalances)) return 0; // CHANGED: don't fall back to global
  const entry = user.classroomBalances.find(cb => String(cb.classroom) === String(classroomId));
  return entry ? (entry.balance || 0) : 0; // CHANGED: don't fall back to global
}

function setClassroomBalance(user, classroomId, newBalance) {
  if (!classroomId) {
    user.balance = Math.max(0, newBalance);
    return;
  }
  if (!Array.isArray(user.classroomBalances)) user.classroomBalances = [];
  const idx = user.classroomBalances.findIndex(cb => String(cb.classroom) === String(classroomId));
  if (idx >= 0) {
    user.classroomBalances[idx].balance = Math.max(0, newBalance);
  } else {
    user.classroomBalances.push({ classroom: classroomId, balance: Math.max(0, newBalance) });
  }
}

// attack item is one of the categories for the items that use effects that are used to 'hurt' damage the target's bits, luck, or multiplier

router.post('/use/:itemId', ensureAuthenticated, async (req, res) => {
  try {
    const classroomId = getClassroomIdFromReq(req);
    const item = await Item.findById(req.params.itemId);

    if (!item || item.owner.toString() !== req.user._id.toString()) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // IMPORTANT: mutate a fresh attacker doc (not req.user) so classroomStats persists reliably
    const attacker = await User.findById(req.user._id);
    if (!attacker) return res.status(404).json({ error: 'User not found' });

    const target = await User.findById(req.body.targetUserId);
    if (!target) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    // Create scoped stat pointers (write into classroomStats when classroomId exists)
    const attackerScoped = getScopedUserStats(attacker, classroomId, { create: true });
    const targetScopedForPassive = getScopedUserStats(target, classroomId, { create: true });

    const attackerPassive = attackerScoped.cs
      ? attackerScoped.cs.passiveAttributes
      : (attacker.passiveAttributes ||= {});
    const targetPassive = targetScopedForPassive.cs
      ? targetScopedForPassive.cs.passiveAttributes
      : (target.passiveAttributes ||= {});

    // Snapshot bits BEFORE any changes (so we can compute net positives for BOTH sides)
    const attackerBitsBefore = classroomId
      ? getClassroomBalance(attacker, classroomId)
      : (attacker.balance || 0);

    const targetBitsBefore = classroomId
      ? getClassroomBalance(target, classroomId)
      : (target.balance || 0);

    // Small helper to compute normalized diffs like statChangeLog
    const diffChanges = (prev, curr, prefix = '') => {
      const fields = ['multiplier', 'luck', 'discount', 'shield'];
      const norm = (f, v) => {
        if (v == null) return v;
        if (['multiplier','luck'].includes(f)) return Number(Number(v).toFixed(1));
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

    // Snapshot stats BEFORE any changes (classroom-scoped)
    const attackerPrev = {
      multiplier: attackerScoped.passive?.multiplier ?? 1,
      luck: attackerScoped.passive?.luck ?? 1,
      discount: attackerScoped.passive?.discount ?? 0,
      shield: attackerScoped.shieldCount ?? 0
    };
    const targetPrevScoped = getScopedUserStats(target, classroomId, { create: true });
    const targetPrev = {
      multiplier: targetPrevScoped.passive?.multiplier ?? 1,
      luck: targetPrevScoped.passive?.luck ?? 1,
      discount: targetPrevScoped.passive?.discount ?? 0,
      shield: targetPrevScoped.shieldCount ?? 0
    };

    // Helpful display names
    const attackerName = `${attacker.firstName || ''} ${attacker.lastName || ''}`.trim() || attacker.email;
    const targetName = `${target.firstName || ''} ${target.lastName || ''}`.trim() || target.email;

    // Check if target has active shield (already classroom-scoped)
    const targetScoped = getScopedUserStats(target, classroomId, { create: true });
    const targetShieldActive = targetScoped.shieldActive;
    const targetCs = targetScoped.cs;

    if (targetShieldActive) {
      // consume shield *in this classroom only*
      if (targetCs) {
        targetCs.shieldCount = Math.max(0, (targetCs.shieldCount || 0) - 1);
        targetCs.shieldActive = (targetCs.shieldCount || 0) > 0;
      } else {
        target.shieldCount = Math.max(0, (target.shieldCount || 0) - 1);
        target.shieldActive = (target.shieldCount || 0) > 0;
      }
      await target.save();

      // Find and DELETE the shield item (not just deactivate)
      await Item.findOneAndDelete({
        owner: req.body.targetUserId,
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
            await awardXP(attacker._id, classroomId, rate, 'stat increase (attack item used)', cls.xpSettings);
          }
        }
      } catch (e) {
        console.warn('[attackItem] awardXP failed:', e);
      }

      const targetAfterBlockedScoped = getScopedUserStats(target, classroomId, { create: true });
      const targetAfterBlocked = {
        multiplier: targetAfterBlockedScoped.passive?.multiplier ?? 1,
        luck: targetAfterBlockedScoped.passive?.luck ?? 1,
        discount: targetAfterBlockedScoped.passive?.discount ?? 0,
        shield: targetAfterBlockedScoped.shieldCount ?? 0
      };

      await logStatChanges({
        io: req.app.get('io'),
        classroomId,
        user: target,
        actionBy: attacker._id,
        prevStats: targetPrev,
        currStats: targetAfterBlocked,
        context: `Bazaar - Attack by ${attackerName} (${item.name}) was blocked`,
        details: { effectsText: 'Shield -1 (blocked attack)' }
      });

      const targetDiffForAttacker = diffChanges(targetPrev, targetAfterBlocked, 'target.');
      await logStatChanges({
        io: req.app.get('io'),
        classroomId,
        user: attacker,
        actionBy: attacker._id,
        prevStats: attackerPrev,
        currStats: attackerPrev, // unchanged on block
        context: `Bazaar - Attack on ${targetName} (${item.name}) was blocked`,
        details: { effectsText: `Blocked by ${targetName} (shield consumed)` },
        forceLog: true,
        extraChanges: [{ field: 'attackResult', from: 'attempted', to: `blocked by ${targetName}` }, ...targetDiffForAttacker]
      });

      return res.status(200).json({
        message: 'Attack blocked by shield! Both shield and attack items were consumed.',
        newBalance: classroomId ? getClassroomBalance(attacker, classroomId) : attacker.balance,
        targetBalance: classroomId ? getClassroomBalance(target, classroomId) : target.balance,
        shieldDestroyed: true
      });
    }

    // If no shield, proceed with attack
    const effectNotes = [];
    const walletLogs = [];

    // ADD: declare these before any possible assignment/use
    let targetGroupAggPrev = null;
    let targetGroupAggAfter = null;

    let nullifyNoop = false;
    const nullifyNoopExtraForAttacker = [];
    const nullifyNoopExtraForTarget = [];

    let attackNoop = false;
    const attackNoopExtraForAttacker = [];
    const attackNoopExtraForTarget = [];

    const formatArrow = (from, to) => `${from} → ${to}`;

    switch (item.primaryEffect) {
      case 'halveBits': {
        const tBefore = getClassroomBalance(target, classroomId);
        const tAfter = Math.floor(tBefore / 2);
        setClassroomBalance(target, classroomId, tAfter);
        effectNotes.push('Split bits');

        const lost = tBefore - tAfter;
        if (lost > 0) {
          target.transactions.push({
            amount: -lost,
            description: `Attack: ${item.name} by ${attackerName} (split bits)`,
            assignedBy: attacker._id,
            classroom: classroomId || null,
            createdAt: new Date(),
            calculation: { prevBalance: tBefore, newBalance: tAfter },
            type: 'attack'
          });
          walletLogs.push({
            user: target,
            amount: -lost,
            message: `Lost ${lost} ₿ due to attack by ${attackerName} (${item.name}). Balance: ${formatArrow(tBefore, tAfter)}`,
            prevBalance: tBefore,
            newBalance: tAfter
          });
        }
        break;
      }

      case 'drainBits': {
        const tBefore = getClassroomBalance(target, classroomId);
        const drainAmount = Math.floor(tBefore * (Number(item.primaryEffectValue || 0) / 100));
        const tAfter = Math.max(0, tBefore - drainAmount);
        setClassroomBalance(target, classroomId, tAfter);

        const aBefore = getClassroomBalance(attacker, classroomId);
        const aAfter = aBefore + drainAmount;
        setClassroomBalance(attacker, classroomId, aAfter);

        effectNotes.push(`Drained ${item.primaryEffectValue || 0}% bits`);

        if (drainAmount <= 0) {
          attackNoop = true;
          attackNoopExtraForAttacker.push({ field: 'target.bits', from: tBefore, to: tAfter });
          attackNoopExtraForAttacker.push({ field: 'attackResult', from: 'drainBits', to: `no-op (target had ${tBefore} ₿)` });

          attackNoopExtraForTarget.push({ field: 'bits', from: tBefore, to: tAfter });
          attackNoopExtraForTarget.push({ field: 'attackResult', from: 'drainBits', to: `no-op (had ${tBefore} ₿)` });

          walletLogs.push({
            user: target,
            amount: 0,
            message: `Attack by ${attackerName} (${item.name}) had no effect because your balance was already ${tBefore} ₿.`,
            prevBalance: tBefore,
            newBalance: tAfter,
            emitBalance: false
          });
          walletLogs.push({
            user: attacker,
            amount: 0,
            message: `Your attack on ${targetName} (${item.name}) drained 0 ₿ because their balance was already ${tBefore} ₿.`,
            prevBalance: tBefore,
            newBalance: tAfter,
            emitBalance: false
          });
          break;
        }

        if (drainAmount > 0) {
          target.transactions.push({
            amount: -drainAmount,
            description: `Attack: ${item.name} by ${attackerName} (drained ${drainAmount} ₿)`,
            assignedBy: attacker._id,
            classroom: classroomId || null,
            createdAt: new Date(),
            calculation: { prevBalance: tBefore, newBalance: tAfter },
            type: 'attack'
          });
          walletLogs.push({
            user: target,
            amount: -drainAmount,
            message: `You lost ${drainAmount} ₿ due to attack by ${attackerName} (${item.name}). Balance: ${formatArrow(tBefore, tAfter)}`,
            prevBalance: tBefore,
            newBalance: tAfter
          });

          attacker.transactions.push({
            amount: drainAmount,
            description: `Attack: ${item.name} vs ${targetName} (received ${drainAmount} ₿)`,
            assignedBy: attacker._id,
            classroom: classroomId || null,
            createdAt: new Date(),
            calculation: { prevBalance: aBefore, newBalance: aAfter },
            type: 'attack'
          });
          walletLogs.push({
            user: attacker,
            amount: drainAmount,
            message: `You received ${drainAmount} ₿ from attack on ${targetName} (${item.name}). Balance: ${formatArrow(aBefore, aAfter)}`,
            prevBalance: aBefore,
            newBalance: aAfter
          });
        }
        break;
      }

      case 'swapper': {
        if (!req.body.swapAttribute) {
          return res.status(400).json({
            error: 'Swap attribute is required',
            validAttributes: item.swapOptions || ['bits', 'multiplier', 'luck']
          });
        }

        const allowedSwapOptions = item.swapOptions && item.swapOptions.length > 0
          ? item.swapOptions
          : ['bits', 'multiplier', 'luck'];

        if (!allowedSwapOptions.includes(req.body.swapAttribute)) {
          return res.status(400).json({
            error: 'Invalid swap attribute for this item',
            validAttributes: allowedSwapOptions,
            received: req.body.swapAttribute
          });
        }

        switch (req.body.swapAttribute) {
          case 'bits': {
            const aBefore = getClassroomBalance(attacker, classroomId);
            const tBefore = getClassroomBalance(target, classroomId);

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
                user: attacker,
                amount: 0,
                message: `Your swap with ${targetName} (${item.name}) had no effect because both balances were ${tBefore} ₿.`,
                prevBalance: aBefore,
                newBalance: aBefore,
                emitBalance: false
              });
              walletLogs.push({
                user: target,
                amount: 0,
                message: `Swap by ${attackerName} (${item.name}) had no effect because both balances were ${tBefore} ₿.`,
                prevBalance: tBefore,
                newBalance: tBefore,
                emitBalance: false
              });

              break;
            }

            setClassroomBalance(attacker, classroomId, tBefore);
            setClassroomBalance(target, classroomId, aBefore);
            effectNotes.push('Swapped bits');

            const aAfter = tBefore;
            const tAfter = aBefore;
            const deltaAtt = aAfter - aBefore;
            const deltaTar = tAfter - tBefore;

            // attacker delta
            if (deltaAtt !== 0) {
              attacker.transactions.push({
                amount: deltaAtt,
                description: `Attack: ${item.name} swap with ${targetName} (${deltaAtt >= 0 ? '+' : ''}${deltaAtt} ₿)`,
                assignedBy: attacker._id,
                classroom: classroomId || null,
                createdAt: new Date(),
                calculation: { prevBalance: aBefore, newBalance: aAfter },
                type: 'attack' // NEW
              });
              walletLogs.push({
                user: attacker,
                amount: deltaAtt,
                message: `${deltaAtt >= 0 ? 'You received' : 'You lost'} ${Math.abs(deltaAtt)} ₿ from swap with ${targetName} (${item.name}). Balance: ${formatArrow(aBefore, aAfter)}`,
                prevBalance: aBefore,
                newBalance: aAfter
              });
            }

            // target delta
            if (deltaTar !== 0) {
              target.transactions.push({
                amount: deltaTar,
                description: `Attack: ${item.name} swap by ${attackerName} (${deltaTar >= 0 ? '+' : ''}${deltaTar} ₿)`,
                assignedBy: attacker._id,
                classroom: classroomId || null,
                createdAt: new Date(),
                calculation: { prevBalance: tBefore, newBalance: tAfter },
                type: 'attack' // NEW
              });
              walletLogs.push({
                user: target,
                amount: deltaTar,
                message: `${deltaTar >= 0 ? 'You received' : 'You lost'} ${Math.abs(deltaTar)} ₿ from swap with ${attackerName} (${item.name}). Balance: ${formatArrow(tBefore, tAfter)}`,
                prevBalance: tBefore,
                newBalance: tAfter
              });
            }
            break;
          }
          case 'multiplier': {
            const aBefore = Number(attackerScoped.passive?.multiplier ?? 1);
            const tBefore = Number(targetPrevScoped.passive?.multiplier ?? 1);

            if (Number(aBefore) === Number(tBefore)) {
              attackNoop = true;
              attackNoopExtraForAttacker.push({ field: 'target.multiplier', from: tBefore, to: tBefore });
              attackNoopExtraForAttacker.push({ field: 'attackResult', from: 'swapper', to: `no-op (multiplier already equal at ${tBefore})` });

              attackNoopExtraForTarget.push({ field: 'multiplier', from: tBefore, to: tBefore });
              attackNoopExtraForTarget.push({ field: 'attackResult', from: 'swapper', to: `no-op (multiplier already equal at ${tBefore})` });

              effectNotes.push('Swapped multiplier (no effect)');
              break;
            }

            // CHANGED: classroom-scoped swap
            const tmp = attackerPassive.multiplier ?? 1;
            attackerPassive.multiplier = targetPassive.multiplier ?? 1;
            targetPassive.multiplier = tmp;

            effectNotes.push('Swapped multiplier');
            break;
          }

          case 'luck': {
            const aBefore = Number(attackerScoped.passive?.luck ?? 1);
            const tBefore = Number(targetPrevScoped.passive?.luck ?? 1);

            if (Number(aBefore) === Number(tBefore)) {
              attackNoop = true;

              attackNoopExtraForAttacker.push({ field: 'target.luck', from: tBefore, to: tBefore });
              attackNoopExtraForAttacker.push({ field: 'attackResult', from: 'swapper', to: `no-op (luck already equal at ${tBefore})` });

              attackNoopExtraForTarget.push({ field: 'luck', from: tBefore, to: tBefore });
              attackNoopExtraForTarget.push({ field: 'attackResult', from: 'swapper', to: `no-op (luck already equal at ${tBefore})` });

              effectNotes.push('Swapped luck (no effect)');
              break;
            }

            // CHANGED: classroom-scoped swap
            const tmp = attackerPassive.luck ?? 1;
            attackerPassive.luck = targetPassive.luck ?? 1;
            targetPassive.luck = tmp;

            effectNotes.push('Swapped luck');
            break;
          }
        }
        break;
      }

      case 'nullify': {
        if (!req.body.nullifyAttribute) {
          return res.status(400).json({
            error: 'Nullify attribute is required',
            validAttributes: item.swapOptions || ['bits', 'multiplier', 'luck']
          });
        }

        const allowedNullifyOptions = item.swapOptions && item.swapOptions.length > 0
          ? item.swapOptions
          : ['bits', 'multiplier', 'luck'];

        if (!allowedNullifyOptions.includes(req.body.nullifyAttribute)) {
          return res.status(400).json({
            error: 'Invalid nullify attribute for this item',
            validAttributes: allowedNullifyOptions,
            received: req.body.nullifyAttribute
          });
        }

        switch (req.body.nullifyAttribute) {
          case 'bits': {
            const tBefore = getClassroomBalance(target, classroomId);
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

            setClassroomBalance(target, classroomId, 0);
            effectNotes.push('Nullified bits');

            target.transactions.push({
              amount: -tBefore,
              description: `Attack: ${item.name} by ${attackerName} (reset to 0)`,
              assignedBy: attacker._id,
              classroom: classroomId || null,
              createdAt: new Date(),
              calculation: { prevBalance: tBefore, newBalance: tAfter },
              type: 'attack' // NEW
            });
            walletLogs.push({
              user: target,
              amount: -tBefore,
              message: `Your bits were reset to 0 by ${attackerName} (${item.name}). Balance: ${formatArrow(tBefore, tAfter)}`,
              prevBalance: tBefore,
              newBalance: tAfter
            });

            // NEW: info-only notif; don't emit balance_update for attacker
            walletLogs.push({
              user: attacker,
              amount: 0,
              message: `You reset ${targetName}'s bits to 0 (${item.name}). Target balance: ${formatArrow(tBefore, tAfter)}`,
              prevBalance: tBefore,
              newBalance: tAfter,
              emitBalance: false
            });
            break;
          }
          case 'multiplier': {
            const before = Number(targetPassive.multiplier ?? 1);
            const after = Math.min(before, 1);

            if (Number(before) === Number(after)) {
              nullifyNoop = true;
              nullifyNoopExtraForAttacker.push({ field: 'target.multiplier', from: before, to: after });
              nullifyNoopExtraForAttacker.push({ field: 'attackResult', from: 'nullify', to: `no-op (target multiplier already <= ${after})` });

              nullifyNoopExtraForTarget.push({ field: 'multiplier', from: before, to: after });
              nullifyNoopExtraForTarget.push({ field: 'attackResult', from: 'nullify', to: `no-op (multiplier already <= ${after})` });

              effectNotes.push('Nullified multiplier (no effect)');
            } else {
              // CHANGED: classroom-scoped write
              targetPassive.multiplier = after;
              effectNotes.push('Nullified multiplier');
            }
            break;
          }

          case 'luck': {
            const before = Number(targetPassive.luck ?? 1);
            const after = Math.min(before, 1);

            if (Number(before) === Number(after)) {
              nullifyNoop = true;
              nullifyNoopExtraForAttacker.push({ field: 'target.luck', from: before, to: after });
              nullifyNoopExtraForAttacker.push({ field: 'attackResult', from: 'nullify', to: `no-op (target luck already <= ${after})` });

              nullifyNoopExtraForTarget.push({ field: 'luck', from: before, to: after });
              nullifyNoopExtraForTarget.push({ field: 'attackResult', from: 'nullify', to: `no-op (luck already <= ${after})` });

              effectNotes.push('Nullified luck (no effect)');
            } else {
              // CHANGED: classroom-scoped write
              targetPassive.luck = after;
              effectNotes.push('Nullified luck');
            }
            break;
          }
        }
        break;
      }
    }

    // Apply secondary effects (CHANGED: operate on targetPassive, not target.passiveAttributes)
    item.secondaryEffects.forEach(effect => {
      switch (effect.effectType) {
        case 'attackLuck': {
          const MIN_LUCK = 0.1;
          const before = Number(targetPassive.luck ?? 1);
          const dec = Number(effect.value) || 0;
          const next = Math.max(MIN_LUCK, before - dec);
          const after = Math.round(next * 10) / 10;

          targetPassive.luck = after;

          if (Number(after) === Number(before)) {
            attackNoop = true;
            attackNoopExtraForAttacker.push({ field: 'target.luck', from: before, to: after });
            attackNoopExtraForAttacker.push({ field: 'attackResult', from: 'attackLuck', to: `no-op (target luck already at minimum ${after})` });
            attackNoopExtraForTarget.push({ field: 'luck', from: before, to: after });
            attackNoopExtraForTarget.push({ field: 'attackResult', from: 'attackLuck', to: `no-op (luck already at minimum ${after})` });
            effectNotes.push(`-${effect.value} Luck (no effect)`);
          } else {
            effectNotes.push(`-${effect.value} Luck`);
          }
          break;
        }

        case 'attackMultiplier': {
          const before = Number(targetPassive.multiplier ?? 1);
          const dec = Number(effect.value) || 0;
          const after = Math.max(1, before - dec);

          targetPassive.multiplier = after;

          if (Number(after) === Number(before)) {
            attackNoop = true;
            attackNoopExtraForAttacker.push({ field: 'target.multiplier', from: before, to: after });
            attackNoopExtraForAttacker.push({ field: 'attackResult', from: 'attackMultiplier', to: `no-op (target multiplier already at minimum ${after})` });
            attackNoopExtraForTarget.push({ field: 'multiplier', from: before, to: after });
            attackNoopExtraForTarget.push({ field: 'attackResult', from: 'attackMultiplier', to: `no-op (multiplier already at minimum ${after})` });
            effectNotes.push(`-${effect.value}x Multiplier (no effect)`);
          } else {
            effectNotes.push(`-${effect.value}x Multiplier`);
          }
          break;
        }

        case 'attackGroupMultiplier': {
          // unchanged (Groups are source of truth)
          break;
        }
      }
    });

    // --- If attack reduced group multipliers, apply change to classroom-scoped Groups and log for affected members ---
    try {
      const groupDecreaseEffects = (item.secondaryEffects || []).filter(
        se => se.effectType === 'attackGroupMultiplier' && Number(se.value)
      );
      if (groupDecreaseEffects.length && classroomId) {
        const gs = await GroupSet.find({ classroom: classroomId }).select('groups');
        const groupIds = gs.flatMap(g => (g.groups || []).map(String));

        const groupsToUpdate = await Group.find({
          _id: { $in: groupIds },
          'members._id': req.body.targetUserId,
          'members.status': 'approved'
        });

        const totalDecreasePerGroup = groupDecreaseEffects.reduce((s, se) => s + (Number(se.value) || 0), 0);

        if (!groupsToUpdate || !groupsToUpdate.length) {
          // No groups => no effect
          attackNoop = true;
          attackNoopExtraForAttacker.push({
            field: 'attackResult',
            from: 'attackGroupMultiplier',
            to: `no-op (target is not in any approved groups)`
          });
          attackNoopExtraForTarget.push({
            field: 'attackResult',
            from: 'attackGroupMultiplier',
            to: `no-op (not in any approved groups)`
          });
          effectNotes.push(`-${totalDecreasePerGroup}x Group Multiplier (no effect)`);
        } else {
          // capture previous multipliers per group
          const prevByGroup = new Map();
          groupsToUpdate.forEach(g => prevByGroup.set(String(g._id), Number(g.groupMultiplier || 1)));

          // apply all decreases (sum multiple attackGroupMultiplier effects)
          let anyGroupChanged = false;
          groupsToUpdate.forEach(g => {
            const before = Number(g.groupMultiplier || 1);
            const after = Math.max(1, before - totalDecreasePerGroup);
            if (after !== before) anyGroupChanged = true;
            g.groupMultiplier = after;
          });

          await Promise.all(groupsToUpdate.map(g => g.save()));

          if (!anyGroupChanged) {
            attackNoop = true;
            attackNoopExtraForAttacker.push({
              field: 'attackResult',
              from: 'attackGroupMultiplier',
              to: `no-op (target group multiplier already at minimum)`
            });
            attackNoopExtraForTarget.push({
              field: 'attackResult',
              from: 'attackGroupMultiplier',
              to: `no-op (group multiplier already at minimum)`
            });
            effectNotes.push(`-${totalDecreasePerGroup}x Group Multiplier (no effect)`);
          } else {
            effectNotes.push(`-${totalDecreasePerGroup}x Group Multiplier`);
          }

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

          // capture target aggregate so the attacker can see it in their normal attack log
          const tgtInfo = memberMap.get(String(req.body.targetUserId));
          if (tgtInfo) {
            targetGroupAggPrev = Number(tgtInfo.prevAggregate.toFixed(3));
            targetGroupAggAfter = Number(tgtInfo.afterAggregate.toFixed(3));
          }

          // Log stat change for each affected member (exclude actor), but ONLY when delta != 0
          for (const [memberId, info] of memberMap.entries()) {
            if (memberId === String(req.user._id)) continue;

            const prevAggregate = Number(info.prevAggregate.toFixed(3));
            const afterAggregate = Number(info.afterAggregate.toFixed(3));
            if (String(prevAggregate) === String(afterAggregate)) continue; // CHANGED: avoid duplicate "no change" logs

            try {
              const targetUserDoc = await User.findById(memberId).select('firstName lastName email');
              const delta = Number((afterAggregate - prevAggregate).toFixed(3));
              const groupNamesArr = Array.from(info.groupNames || []);
              const groupContext = groupNamesArr.length
                ? `applied to ${groupNamesArr.length} group${groupNamesArr.length > 1 ? 's' : ''}: ${groupNamesArr.slice(0,5).join(', ')}`
                : '';
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

    await target.save();
    await attacker.save(); // CHANGED (was req.user.save())

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

          const attackerBitsAfter = getClassroomBalance(attacker, classroomId);
          const targetBitsAfter = getClassroomBalance(target, classroomId);

          const attackerBitsDelta = attackerBitsAfter - attackerBitsBefore;
          const targetBitsDelta = targetBitsAfter - targetBitsBefore;

          // CHANGED: classroom-scoped stats (no groupMultiplier from passiveAttributes)
          const attackerAfterScoped = getScopedUserStats(attacker, classroomId, { create: true });
          const targetAfterScoped = getScopedUserStats(target, classroomId, { create: true });

          const attackerAfter = {
            multiplier: attackerAfterScoped.passive?.multiplier ?? 1,
            luck: attackerAfterScoped.passive?.luck ?? 1,
            discount: attackerAfterScoped.passive?.discount ?? 0,
            shield: attackerAfterScoped.shieldCount ?? 0
          };
          const targetAfter = {
            multiplier: targetAfterScoped.passive?.multiplier ?? 1,
            luck: targetAfterScoped.passive?.luck ?? 1,
            discount: targetAfterScoped.passive?.discount ?? 0,
            shield: targetAfterScoped.shieldCount ?? 0
          };

          const safeNum = (v, d = 0) => {
            const n = Number(v);
            return Number.isFinite(n) ? n : d;
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

            return { count, parts };
          };

          const awardBitsEarnedXP = async ({ userDoc, bitsDelta, whoLabel }) => {
            if (!userDoc?._id) return;
            if (bitsEarnedRate <= 0) return;
            if (bitsDelta <= 0) return;

            const xpBits = Math.abs(bitsDelta); // attacks: base == final
            const xpToAward = xpBits * bitsEarnedRate;
            if (xpToAward <= 0) return;

            const xpRes = await awardXP(userDoc._id, classroomId, xpToAward, 'earning bits (attack outcome)', cls.xpSettings);
            if (xpRes && xpRes.newXP !== xpRes.oldXP) {
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
            if (xpRes && xpRes.newXP !== xpRes.oldXP) {
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
          await awardBitsEarnedXP({ userDoc: attacker, bitsDelta: attackerBitsDelta, whoLabel: 'Attacker' });
          await awardStatIncreaseXP({ userDoc: attacker, beforeStats: attackerPrev, afterStats: attackerAfter, whoLabel: 'Attacker' });

          // Target: positive outcomes (e.g. swap benefits them)
          await awardBitsEarnedXP({ userDoc: target, bitsDelta: targetBitsDelta, whoLabel: 'Target' });
          await awardStatIncreaseXP({ userDoc: target, beforeStats: targetPrev, afterStats: targetAfter, whoLabel: 'Target' });
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
          await awardXP(attacker._id, classroomId, rate, 'stat increase (attack item used)', cls.xpSettings);
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
    const attackerAfterScoped = getScopedUserStats(attacker, classroomId, { create: true });
    const targetAfterScoped = getScopedUserStats(target, classroomId, { create: true });

    const attackerAfter = {
      multiplier: attackerAfterScoped.passive?.multiplier ?? 1,
      luck: attackerAfterScoped.passive?.luck ?? 1,
      discount: attackerAfterScoped.passive?.discount ?? 0,
      shield: attackerAfterScoped.shieldCount ?? 0
    };
    const targetAfter = {
      multiplier: targetAfterScoped.passive?.multiplier ?? 1,
      luck: targetAfterScoped.passive?.luck ?? 1,
      discount: targetAfterScoped.passive?.discount ?? 0,
      shield: targetAfterScoped.shieldCount ?? 0
    };

    // Include target-side diffs in attacker’s log (prefixed as target.*)
    const targetDiffForAttacker = diffChanges(targetPrev, targetAfter, 'target.');

    // CHANGED: if group aggregate changed, include it in attacker's log as an extra change (no contradiction now)
    if (targetGroupAggPrev != null && targetGroupAggAfter != null && String(targetGroupAggPrev) !== String(targetGroupAggAfter)) {
      targetDiffForAttacker.push({ field: 'target.groupMultiplier', from: targetGroupAggPrev, to: targetGroupAggAfter });
    }

    // NEW: build effects text already collected; include item name in human text
    const effectsText = effectNotes.length ? `${effectNotes.join(', ')} (via ${item.name})` : undefined;

    // Attacker log
    await logStatChanges({
      io: req.app.get('io'),
      classroomId,
      user: attacker,
      actionBy: attacker._id,
      prevStats: attackerPrev,
      currStats: attackerAfter,
      context: `Bazaar - Attack on ${targetName} (${item.name})`,
      details: { effectsText },
      extraChanges: [
        ...targetDiffForAttacker,
        ...(nullifyNoop ? nullifyNoopExtraForAttacker : []),
        ...(attackNoop ? attackNoopExtraForAttacker : [])
      ],
      forceLog: Boolean(nullifyNoop || attackNoop)
    });

    // Target log
    await logStatChanges({
      io: req.app.get('io'),
      classroomId,
      user: target,
      actionBy: attacker._id,
      prevStats: targetPrev,
      currStats: targetAfter,
      context: `Bazaar - Attacked by ${attackerName} (${item.name})`,
      details: { effectsText },
      extraChanges: [
        ...(nullifyNoop ? nullifyNoopExtraForTarget : []),
        ...(attackNoop ? attackNoopExtraForTarget : [])
      ],
      forceLog: Boolean(nullifyNoop || attackNoop)
    });

    return res.json({
      message: item.primaryEffect === 'swapper'
        ? `Successfully swapped ${req.body.swapAttribute}! Item was consumed.`
        : item.primaryEffect === 'nullify'
          ? `Successfully nullified ${req.body.nullifyAttribute}! Item was consumed.`
          : 'Attack successful! Attack item was consumed.',
      newBalance: classroomId ? getClassroomBalance(attacker, classroomId) : attacker.balance,
      targetBalance: classroomId ? getClassroomBalance(target, classroomId) : target.balance,
      ...(item.primaryEffect === 'swapper' && {
        newMultiplier: attackerAfter.multiplier,
        targetNewMultiplier: targetAfter.multiplier,
        newLuck: attackerAfter.luck,
        targetNewLuck: targetAfter.luck
      }),
      ...(item.primaryEffect === 'nullify' && {
        nullifiedAttribute: req.body.nullifyAttribute,
        targetNewValue:
          req.body.nullifyAttribute === 'bits'
            ? 0
            : (req.body.nullifyAttribute === 'luck'
              ? Number(targetAfter.luck)
              : Number(targetAfter.multiplier))
      }),
      shieldDestroyed: false
    });
  } catch (err) {
    console.error('Item use error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;