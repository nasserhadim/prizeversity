const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const User = require('../models/User');
const { ensureAuthenticated } = require('../config/auth');

// Defend item is another category for the bazaar items that protect the user from any attack items.

router.post('/activate/:itemId', ensureAuthenticated, async (req, res) => {
  try {
    const item = await Item.findById(req.params.itemId);
    
    if (!item || item.owner.toString() !== req.user._id.toString()) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Allow stacking shields

    // Deactivate any other active defense items (just in case)
    await Item.updateMany(
      { owner: req.user._id, category: 'Defend', active: true },
      { $set: { active: false } }
    );

    // Activate shield
    item.active = true;
    await item.save();
    
    // Update user's shield status
    req.user.shieldCount = (req.user.shieldCount || 0) + 1;
    req.user.shieldActive = true;
    await req.user.save();

    res.json({ 
      message: 'Shield activated - will protect against next attack',
      usesRemaining: 1 // Single-use shield
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to activate shield' });
  }
});

module.exports = router;