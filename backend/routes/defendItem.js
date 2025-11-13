const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const User = require('../models/User');
const { ensureAuthenticated } = require('../config/auth');
const Classroom = require('../models/Classroom');
const { awardXP } = require('../utils/awardXP');
const { logStatChanges } = require('../utils/statChangeLog');

// Defend item is another category for the bazaar items that protect the user from any attack items.

router.post('/activate/:itemId', ensureAuthenticated, async (req, res) => {
  try {
    const classroomId = req.body.classroomId || req.query.classroomId;
    const item = await Item.findById(req.params.itemId);
    if (!item || item.owner.toString() !== req.user._id.toString()) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // snapshot before
    const prev = {
      multiplier: req.user.passiveAttributes?.multiplier || 1,
      luck: req.user.passiveAttributes?.luck || 1,
      discount: req.user.passiveAttributes?.discount || 0,
      shield: req.user.shieldCount || 0
    };

    // Deactivate any other active defense items (just in case)
    await Item.updateMany(
      { owner: req.user._id, category: 'Defend', active: true },
      { $set: { active: false } }
    );

    // Activate shield
    item.active = true;
    // ADD: Mark item usage
    item.usesRemaining = Math.max(0, (item.usesRemaining || 1) - 1);
    item.consumed = item.usesRemaining === 0;
    await item.save();

    req.user.shieldCount = (req.user.shieldCount || 0) + 1;
    req.user.shieldActive = true;
    await req.user.save();

    // Award stat-increase XP (existing)
    try {
      if (classroomId) {
        const cls = await Classroom.findById(classroomId).select('xpSettings');
        const rate = cls?.xpSettings?.enabled ? (cls.xpSettings.statIncrease || 0) : 0;
        if (rate > 0) {
          await awardXP(req.user._id, classroomId, rate, 'stat increase (shield activated)', cls.xpSettings);
        }
      }
    } catch (e) {
      console.warn('[defendItem] awardXP failed:', e);
    }

    // NEW: stat-change notifications
    const after = {
      multiplier: req.user.passiveAttributes?.multiplier || 1,
      luck: req.user.passiveAttributes?.luck || 1,
      discount: req.user.passiveAttributes?.discount || 0,
      shield: req.user.shieldCount || 0
    };
    await logStatChanges({
      io: req.app.get('io'),
      classroomId,
      user: req.user,
      actionBy: req.user._id,
      prevStats: prev,
      currStats: after,
      context: `Bazaar - Shield activated`,
      details: { effectsText: 'Shield +1 (blocks next attack)' }
    });

    res.json({ 
      message: 'Shield activated successfully',
      shieldCount: req.user.shieldCount
    });
  } catch (err) {
    console.error('Shield activation error:', err);
    res.status(500).json({ error: 'Failed to activate shield' });
  }
});

module.exports = router;