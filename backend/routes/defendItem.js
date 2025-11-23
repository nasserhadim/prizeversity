const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const User = require('../models/User');
const { ensureAuthenticated } = require('../config/auth');
const { xpOnStatIncrease } = require('../middleware/xpHooks');

// Defend item is another category for the bazaar items that protect the user from any attack items.

// added :classroomId to the route
router.post('/activate/:itemId/:classroomId', ensureAuthenticated, async (req, res) => {
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

    // this get classroomId from ALL possible places, including classId
    let classroomId =
      req.params.classroomId ||           // if frontend ever adds it to the URL
      req.body.classroomId ||
      req.body.classId ||                // added this
      req.query.classroomId ||
      req.query.classId ||               // added this
      item.classroom ||
      item.classroomId ||
      item.classId;                      // in case item stores it this way

    //if user is only in ONE classroom, use that
    if (
      !classroomId &&
      Array.isArray(req.user.classroomBalances) &&
      req.user.classroomBalances.length === 1
    ) {
      classroomId = req.user.classroomBalances[0].classroom;
    }

    if (classroomId) {
      try {
        await xpOnStatIncrease({
          userId: req.user._id,
          classroomId,
          count: 1,
        });
      } catch (e) {
        console.warn('[XP Hook] xpOnStatIncrease from defendItem failed:', e.message);
      }
    } else {
      console.warn('[XP Hook] defendItem: no classroomId/classId found for XP');
    }

    res.json({ 
      message: 'Shield activated - will protect against next attack',
      usesRemaining: 1 // Single-use shield
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to activate shield' });
  }
});

module.exports = router;
