const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const User = require('../models/User');
const { ensureAuthenticated } = require('../config/auth');
const Classroom = require('../models/Classroom');
const { awardXP } = require('../utils/awardXP');
const { logStatChanges } = require('../utils/statChangeLog');
const { getClassroomIdFromReq, getScopedUserStats } = require('../utils/classroomStats'); // ADD

// Defend item is another category for the bazaar items that protect the user from any attack items.

router.post('/activate/:itemId', ensureAuthenticated, async (req, res) => {
  try {
    const classroomId = getClassroomIdFromReq(req); // CHANGED
    const item = await Item.findById(req.params.itemId);
    if (!item || item.owner.toString() !== req.user._id.toString()) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // IMPORTANT: mutate a fresh user doc (not req.user) so classroomStats persists reliably
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // snapshot before (classroom-scoped)
    const scopedBefore = getScopedUserStats(user, classroomId, { create: true });
    const prev = {
      multiplier: scopedBefore.passive?.multiplier ?? 1,
      luck: scopedBefore.passive?.luck ?? 1,
      discount: scopedBefore.passive?.discount ?? 0,
      shield: scopedBefore.shieldCount ?? 0
    };

    // Deactivate any other active defense items (just in case)
    await Item.updateMany(
      { owner: user._id, category: 'Defend', active: true },
      { $set: { active: false } }
    );

    // Activate shield item (consumption semantics unchanged)
    item.active = true;
    item.usesRemaining = Math.max(0, (item.usesRemaining || 1) - 1);
    item.consumed = item.usesRemaining === 0;
    item.activatedAt = new Date();
    await item.save();

    // CHANGED: classroom-scoped shield increment
    if (scopedBefore.cs) {
      scopedBefore.cs.shieldCount = (scopedBefore.cs.shieldCount || 0) + 1;
      scopedBefore.cs.shieldActive = true;
    } else {
      user.shieldCount = (user.shieldCount || 0) + 1;
      user.shieldActive = true;
    }
    await user.save();

    // Award stat-increase XP (existing)
    try {
      if (classroomId) {
        const cls = await Classroom.findById(classroomId).select('xpSettings');
        const rate = cls?.xpSettings?.enabled ? (cls.xpSettings.statIncrease || 0) : 0;
        if (rate > 0) {
          try {
            const xpRes = await awardXP(user._id, classroomId, rate, 'stat increase (shield activated)', cls.xpSettings);
            if (xpRes && typeof xpRes.oldXP !== 'undefined' && typeof xpRes.newXP !== 'undefined' && xpRes.newXP !== xpRes.oldXP) {
              try {
                await logStatChanges({
                  io: req.app && req.app.get ? req.app.get('io') : null,
                  classroomId,
                  user,
                  actionBy: user._id,
                  prevStats: { xp: xpRes.oldXP },
                  currStats: { xp: xpRes.newXP },
                  context: `stat increase (shield activated: ${item.name})`,
                  details: {
                    effectsText: 'Shield +1 (blocks next attack)',
                    itemName: item.name,
                    itemId: item._id
                  },
                  forceLog: true
                });
              } catch (logErr) {
                console.warn('[defendItem] failed to log XP stat change:', logErr);
              }
            }
          } catch (xpErr) {
            console.warn('[defendItem] awardXP failed:', xpErr);
          }
        }
      }
    } catch (e) {
      console.warn('[defendItem] awardXP failed:', e);
    }

    // stat-change notifications (classroom-scoped)
    const scopedAfter = getScopedUserStats(user, classroomId, { create: true });
    const after = {
      multiplier: scopedAfter.passive?.multiplier ?? 1,
      luck: scopedAfter.passive?.luck ?? 1,
      discount: scopedAfter.passive?.discount ?? 0,
      shield: scopedAfter.shieldCount ?? 0
    };

    await logStatChanges({
      io: req.app.get('io'),
      classroomId,
      user,
      actionBy: user._id,
      prevStats: prev,
      currStats: after,
      context: `Bazaar - Shield activated`,
      details: { effectsText: 'Shield +1 (blocks next attack)' }
    });

    return res.json({
      message: 'Shield activated successfully',
      shieldCount: scopedAfter.shieldCount // CHANGED
    });
  } catch (err) {
    console.error('Shield activation error:', err);
    res.status(500).json({ error: 'Failed to activate shield' });
  }
});

module.exports = router;