const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const User = require('../models/User');
const { ensureAuthenticated } = require('../config/auth');

router.post('/use/:itemId', ensureAuthenticated, async (req, res) => {
  try {
    const item = await Item.findById(req.params.itemId);
    
    if (!item || item.owner.toString() !== req.user._id.toString()) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Apply utility effect
    switch(item.primaryEffect) {
      case 'doubleEarnings':
        req.user.passiveAttributes.multiplier = (req.user.passiveAttributes.multiplier || 1) * 2;
        break;
      case 'discountShop':
        req.user.discountShop = true;
        // Set expiration after 24 hours
        setTimeout(async () => {
          req.user.discountShop = false;
          await req.user.save();
        }, 24 * 60 * 60 * 1000);
        break;
    }

    await req.user.save();
    await Item.findByIdAndDelete(item._id); // Remove after use

    res.json({ 
      message: 'Utility item applied',
      effect: item.primaryEffect
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to use item' });
  }
});

module.exports = router;