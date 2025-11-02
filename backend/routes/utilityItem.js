const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const User = require('../models/User');
const { ensureAuthenticated } = require('../config/auth');
const Classroom = require('../models/Classroom');
const { awardXP } = require('../utils/awardXP');
const { logStatChanges } = require('../utils/statChangeLog');

// Utility item is another category for items in the bazaar workign with a discount and multipleir
router.post('/use/:itemId', ensureAuthenticated, async (req, res) => {
  try {
    const classroomId = req.body.classroomId || req.query.classroomId;
    const item = await Item.findById(req.params.itemId);
    
    if (!item || item.owner.toString() !== req.user._id.toString()) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // snapshot before
    const before = {
      multiplier: req.user.passiveAttributes?.multiplier || 1,
      discount: req.user.passiveAttributes?.discount || 0,
      luck: req.user.passiveAttributes?.luck || 1,
      shield: req.user.shieldCount || 0
    };

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
          req.app.get('io').to(`user-${req.user._id}`).emit('discount_expired');
        }, 24 * 60 * 60 * 1000);
        break;
      default:
        return res.status(400).json({ error: 'Unsupported utility effect' });
    }

    await req.user.save();
    await Item.findByIdAndDelete(item._id);

    // award XP for stat increases (multiplier or discount)
    try {
      if (classroomId) {
        const after = {
          multiplier: req.user.passiveAttributes?.multiplier || 1,
          discount: req.user.discountShop ? 20 : 0
        };
        let statCount = 0;
        if (after.multiplier !== before.multiplier) statCount += 1;
        if (after.discount > before.discount) statCount += 1;

        const cls = await Classroom.findById(classroomId).select('xpSettings');
        const rate = cls?.xpSettings?.enabled ? (cls.xpSettings.statIncrease || 0) : 0;
        const xp = statCount * rate;
        if (xp > 0) {
          await awardXP(req.user._id, classroomId, xp, 'stat increase (bazaar item)', cls.xpSettings);
        }
      }
    } catch (e) {
      console.warn('[utilityItem] awardXP failed:', e);
    }

    // NEW: stat-change notifications (only if recognized fields changed)
    const after = {
      multiplier: req.user.passiveAttributes?.multiplier || 1,
      discount: req.user.passiveAttributes?.discount || 0,
      luck: req.user.passiveAttributes?.luck || 1,
      shield: req.user.shieldCount || 0
    };
    await logStatChanges({
      io: req.app.get('io'),
      classroomId,
      user: req.user,
      actionBy: req.user._id,
      prevStats: before,
      currStats: after,
      context: `Bazaar - ${item.name}`
    });

    res.json({ 
      message: 'Utility item used',
      effect: item.primaryEffect,
      stats: req.user.passiveAttributes,
      discountShop: req.user.discountShop
    });
  } catch (err) {
    console.error('Utility use error:', err);
    res.status(500).json({ 
      error: 'Failed to use item',
      details: err.message
    });
  }
});

module.exports = router;