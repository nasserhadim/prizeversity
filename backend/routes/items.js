const express = require('express');
const router = express.Router();
const Item = require('../models/Item.js');
const User = require('../models/User.js');

// Use an item on a target student
router.post('/:itemId/use', async (req, res) => {
  const { userId, targetUserId } = req.body;
  const { itemId } = req.params;

  try {
    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let target = null;

    // If attack item requires a target
    if (['halveBits', 'stealBits'].includes(item.effect)) {
      if (!targetUserId) return res.status(400).json({ error: 'Target required' });

      target = await User.findById(targetUserId);
      if (!target) return res.status(404).json({ error: 'Target user not found' });

      // Shield protection
      if (target.shieldActive) {
        target.shieldActive = false; // Consume shield
        await target.save();
        await Item.findByIdAndDelete(itemId); // delete attacking item
        return res.status(200).json({
          message: `${target.firstName} was protected by a shield!`,
          protected: true
        });
      }
    }

    // --- EFFECTS SECTION ---

    // Attack Effects
    if (item.effect === 'halveBits') {
      target.balance = Math.floor(target.balance / 2);
      await target.save();
    }

    if (item.effect === 'stealBits') {
      const stolen = Math.floor(target.balance * 0.1);
      target.balance -= stolen;
      user.balance += stolen;
      await target.save();
      await user.save();
    }

    // Defend Effects
    if (item.effect === 'shield') {
      user.shieldActive = true;
      await user.save();

      item.active = true;
      item.usesRemaining = 1;
      await item.save();

      return res.json({ message: 'Shield activated. You are now protected!' });
    }

    // Utility Effects
    if (item.effect === 'doubleEarnings') {
      user.doubleEarnings = true;
      await user.save();

      item.active = true;
      item.usesRemaining = 1;
      await item.save();

      return res.json({ message: 'Earnings multiplier activated!' });
    }

    // Discount effect section
    if (item.effect === 'discountShop') {
      user.discountShop = true;
      await user.save();

      // Set expiration after 1 hour (3600000 ms)
      setTimeout(async () => {
        try {
          const updatedUser = await User.findById(user._id);
          if (updatedUser.discountShop) {
            updatedUser.discountShop = false;
            await updatedUser.save();
            
            // Emit socket event to notify client of discount expiration
            req.app.get('io').to(`user-${user._id}`).emit('discount_expired');
          }
        } catch (err) {
          console.error('Error expiring discount:', err);
        }
      }, 10000); // 10 seconds for testing

      await Item.findByIdAndDelete(itemId); // Delete the item after use
      return res.json({ message: 'Shop discount activated for 1 hour!' });
    }

    // Passive Effects (new)
    if (item.category === 'Passive' && item.passiveAttributes) {
      const { luck, multiplier, groupMultiplier } = item.passiveAttributes;

      if (luck) {
        user.luck = true;
      }
      if (multiplier) {
        user.multiplier = true;
      }
      if (groupMultiplier) {
        user.groupMultiplier = true;
      }

      await user.save();

      item.active = true;
      item.usesRemaining = 1;
      await item.save();

      return res.json({
        message: 'Passive effect applied!',
        passiveEffects: item.passiveAttributes,
      });
    }

    // Apply passiveAttributes if present
    if (item.passiveAttributes) {
      const { luck, multiplier, groupMultiplier } = item.passiveAttributes;

      // --- Case: Attack Item ---
      if (item.category === 'Attack' && target) {
        if (luck) target.luck = Math.max((target.luck || 0) - 1, 0);
        if (multiplier) target.multiplier = Math.max((target.multiplier || 1) - 0.1, 1);
        if (groupMultiplier && target.groups?.length) {
          const Group = require('../models/Group.js');
          const group = await Group.findById(target.groups[0]);
          if (group) {
            group.multiplier = Math.max((group.multiplier || 1) - 0.1, 1);
            await group.save();
          }
        }
        await target.save();
      }

      // --- Case: Passive Item ---
      if (item.category === 'Passive') {
        if (luck) user.luck = (user.luck || 0) + 1;
        if (multiplier) user.multiplier = (user.multiplier || 1) + 0.1;
        if (groupMultiplier && user.groups?.length) {
          const Group = require('../models/Group.js');
          const group = await Group.findById(user.groups[0]);
          if (group) {
            group.multiplier = (group.multiplier || 1) + 0.1;
            await group.save();
          }
        }
        await user.save();
      }
    }


    // Delete non-persistent item
    if (!['shield', 'doubleEarnings', 'discountShop'].includes(item.effect) &&
        item.category !== 'Passive') {
      await Item.findByIdAndDelete(itemId);
    } else if (item.effect === 'discountShop') {
      // For discountShop items, delete after use
      await Item.findByIdAndDelete(itemId);
    }

    return res.json({
      message: 'Item used successfully.',
      newBalance: {
        user: user.balance,
        target: target?.balance
      }
    });

  } catch (err) {
    console.error('Item use error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
