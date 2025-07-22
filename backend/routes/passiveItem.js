const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const User = require('../models/User');
const Group = require('../models/Group');
const { ensureAuthenticated } = require('../config/auth');

// Passive items are another category of the item bazaar which will grant users multipliers, group multipliers, and luck

router.post('/equip/:itemId', ensureAuthenticated, async (req, res) => {
  try {
    const item = await Item.findById(req.params.itemId);
    
    if (!item || item.owner.toString() !== req.user._id.toString()) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Find all groups where the user is an approved member
    const userGroups = await Group.find({
      'members._id': req.user._id,
      'members.status': 'approved'
    });

    // Apply passive effects
    item.secondaryEffects.forEach(effect => {
      switch(effect.effectType) {
        case 'grantsLuck':
          req.user.passiveAttributes.luck = (req.user.passiveAttributes.luck || 1) + effect.value;
          break;
        case 'grantsMultiplier':
          req.user.passiveAttributes.multiplier = (req.user.passiveAttributes.multiplier || 1) + effect.value;
          break;
        case 'grantsGroupMultiplier':
          // Update each group's multiplier
          userGroups.forEach(group => {
            group.groupMultiplier = (group.groupMultiplier || 1) + effect.value;
          });
          break;
      }
    });

    // Save all updated groups
    await Promise.all(userGroups.map(group => group.save()));

    item.active = true;
    await req.user.save();
    await item.save();

    res.json({ 
      message: 'Passive item equipped',
      stats: req.user.passiveAttributes,
      updatedGroups: userGroups.map(g => ({
        groupId: g._id,
        newMultiplier: g.groupMultiplier
      }))
    });
  } catch (err) {
    console.error('Equip error:', err);
    res.status(500).json({ 
      error: 'Failed to equip item',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;