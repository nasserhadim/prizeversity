const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const User = require('../models/User');
const { ensureAuthenticated } = require('../config/auth');

// attack item is one of the categories for the items that use effects that are used to 'hurt' damage the target's bits, luck, or multiplier

router.post('/use/:itemId', ensureAuthenticated, async (req, res) => {
  try {
    const { targetUserId, swapAttribute } = req.body; // Added swapAttribute parameter
    const item = await Item.findById(req.params.itemId);
    
    if (!item || item.owner.toString() !== req.user._id.toString()) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    // Check if target has active shield
    if (targetUser.shieldActive) {
      // Deactivate the shield on user
      targetUser.shieldActive = false;
      await targetUser.save();

      // Find and DELETE the shield item (not just deactivate)
      const shieldItem = await Item.findOneAndDelete({
        owner: targetUserId,
        category: 'Defend',
        active: true
      });

      // Delete the attack item (since it was used)
      await Item.findByIdAndDelete(item._id);

      return res.status(200).json({ 
        message: 'Attack blocked by shield! Both shield and attack items were consumed.',
        newBalance: req.user.balance,
        targetBalance: targetUser.balance,
        shieldDestroyed: true
      });
    }

    // If no shield, proceed with attack
    switch(item.primaryEffect) {
      case 'halveBits':
        targetUser.balance = Math.floor(targetUser.balance / 2);
        break;
      case 'stealBits':
        const stealAmount = Math.floor(targetUser.balance * (item.primaryEffectValue / 100));
        targetUser.balance -= stealAmount;
        req.user.balance += stealAmount;
        break;
      // In the swapper case section, update the validation:
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
            break;
          case 'luck':
            [req.user.passiveAttributes.luck, targetUser.passiveAttributes.luck] = 
              [targetUser.passiveAttributes.luck, req.user.passiveAttributes.luck];
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
            break;
          case 'luck':
            targetUser.passiveAttributes.luck = 1;
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
          break;
        case 'attackMultiplier':
          targetUser.passiveAttributes.multiplier = Math.max(1, 
            (targetUser.passiveAttributes.multiplier || 1) - effect.value);
          break;
        case 'attackGroupMultiplier':
          targetUser.passiveAttributes.groupMultiplier = Math.max(1, 
            (targetUser.passiveAttributes.groupMultiplier || 1) - effect.value);
          break;
      }
    });

    await targetUser.save();
    await req.user.save();
    await Item.findByIdAndDelete(item._id); // Delete attack item after use

    // Json notification for any successful or error commands
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
        targetNewValue: req.body.nullifyAttribute === 'bits' 
          ? 0 
          : 1
      }),
      shieldDestroyed: false
    });
  } catch (err) {
    console.error('Item use error:', err);
    res.status(500).json({ 
      error: 'Failed to use item',
      details: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  }
});

module.exports = router;