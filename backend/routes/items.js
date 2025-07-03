const express = require('express');
const router = express.Router();
const Item = require('../models/Item.js');
const User = require('../models/User.js')

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

    // Apply Effects 
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

    if (item.effect === 'shield') {
      // Activate shield on self
      user.shieldActive = true;
      await user.save();

      // Mark this item as "active" but don't delete yet
      item.active = true;
      item.usesRemaining = 1;
      await item.save();
      return res.json({ message: 'Shield activated. You are now protected!' });
    }

    // double earnings effect
    if (item.effect === 'doubleEarnings') {
        user.doubleEarnings = true;
        await user.save();

        // Mark item as active but do not delete
        item.active = true;
        item.usesRemaining = 1;
        await item.save();
        return res.json({message: 'Earnings multiplier activated! You will earn double from all events!' });
    }

    // getting bazaar discount
    if (item.effect === 'discountShop') {
      user.discountShop = true;
      await user.save();
      
      // Mark item as active but don't delete
      item.active = true;
      item.usesRemaining = 1;
      await item.save();
      return res.json({ message: 'Shop discount activated! You get 20% off all items!' });
    }

    // Remove item if it's not a persistent effect
    if (!['shield', 'doubleEarnings', 'discountShop'].includes(item.effect)) {
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
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});


module.exports = router;