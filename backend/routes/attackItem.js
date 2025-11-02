const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const User = require('../models/User');
const { ensureAuthenticated } = require('../config/auth');
const Classroom = require('../models/Classroom');
const { awardXP } = require('../utils/awardXP');
const { logStatChanges } = require('../utils/statChangeLog'); // NEW

// attack item is one of the categories for the items that use effects that are used to 'hurt' damage the target's bits, luck, or multiplier

router.post('/use/:itemId', ensureAuthenticated, async (req, res) => {
  try {
    const { targetUserId, swapAttribute } = req.body;
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

      // NEW: Attacker log (forced even if no stat changed)
      await logStatChanges({
        io: req.app.get('io'),
        classroomId,
        user: req.user,
        actionBy: req.user._id,
        prevStats: attackerPrev,
        currStats: attackerPrev, // unchanged
        context: `Bazaar - Attack on ${targetName} (${item.name}) was blocked`,
        details: { effectsText: `Blocked by ${targetName} (shield consumed)` },
        forceLog: true,
        extraChanges: [{ field: 'attackResult', from: 'attempted', to: `blocked by ${targetName}` }]
      });

      return res.status(200).json({
        message: 'Attack blocked by shield! Both shield and attack items were consumed.',
        newBalance: req.user.balance,
        targetBalance: targetUser.balance,
        shieldDestroyed: true
      });
    }

    // If no shield, proceed with attack
    const effectNotes = []; // collect human-readable effect descriptions

    switch(item.primaryEffect) {
      case 'halveBits':
        targetUser.balance = Math.floor(targetUser.balance / 2);
        break;
      case 'stealBits':
        const stealAmount = Math.floor(targetUser.balance * (item.primaryEffectValue / 100));
        targetUser.balance -= stealAmount;
        req.user.balance += stealAmount;
        break;
      case 'swapper':  // New Swapper effect
        if (!swapAttribute) {
          return res.status(400).json({ 
            error: 'Swap attribute is required',
            validAttributes: ['bits', 'multiplier', 'luck']
          });
        }
        
        const validAttributes = ['bits', 'multiplier', 'luck'];
        if (!validAttributes.includes(swapAttribute)) {
          return res.status(400).json({ 
            error: 'Invalid swap attribute',
            validAttributes,
            received: swapAttribute
          });
        }
        
        // Perform the swap
        switch(swapAttribute) {
          case 'bits':
            [req.user.balance, targetUser.balance] = [targetUser.balance, req.user.balance];
            break;
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
      case 'nullify':  // New Nullify effect
        if (!req.body.nullifyAttribute) {
          return res.status(400).json({ 
            error: 'Nullify attribute is required',
            validAttributes: ['bits', 'multiplier', 'luck']
          });
        }
        
        const validNullifyAttributes = ['bits', 'multiplier', 'luck'];
        if (!validNullifyAttributes.includes(req.body.nullifyAttribute)) {
          return res.status(400).json({ 
            error: 'Invalid nullify attribute',
            validAttributes: validNullifyAttributes,
            received: req.body.nullifyAttribute
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
        switch(req.body.nullifyAttribute) {
          case 'bits':
            targetUser.balance = 0;
            break;
          case 'multiplier':
            targetUser.passiveAttributes.multiplier = 1;
            effectNotes.push('Nullified multiplier');
            break;
          case 'luck':
            targetUser.passiveAttributes.luck = 1;
            effectNotes.push('Nullified luck');
            break;
        }
        // Add a transaction record for the nullification
        targetUser.transactions.push({
          amount: 0,
          description: `Attribute nullified: ${req.body.nullifyAttribute}`,
          assignedBy: req.user._id,
          createdAt: new Date()
        });
        break;
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

    await targetUser.save();
    await req.user.save();
    await Item.findByIdAndDelete(item._id); // Delete attack item after use

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

    // Attacker notification (e.g., swapped stats) – shows whom they targeted
    await logStatChanges({
      io: req.app.get('io'),
      classroomId,
      user: req.user,
      actionBy: req.user._id,
      prevStats: attackerPrev,
      currStats: {
        multiplier: req.user.passiveAttributes?.multiplier || 1,
        luck: req.user.passiveAttributes?.luck || 1,
        discount: req.user.passiveAttributes?.discount || 0,
        shield: req.user.shieldCount || 0,
        groupMultiplier: req.user.passiveAttributes?.groupMultiplier || 1
      },
      context: `Bazaar - Attack on ${targetName} (${item.name})`,
      details: { effectsText }
    });

    // Target notification (they were attacked) – shows attacker
    await logStatChanges({
      io: req.app.get('io'),
      classroomId,
      user: targetUser,
      actionBy: req.user._id,
      prevStats: targetPrev,
      currStats: {
        multiplier: targetUser.passiveAttributes?.multiplier || 1,
        luck: targetUser.passiveAttributes?.luck || 1,
        discount: targetUser.passiveAttributes?.discount || 0,
        shield: targetUser.shieldCount || 0,
        groupMultiplier: targetUser.passiveAttributes?.groupMultiplier || 1
      },
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