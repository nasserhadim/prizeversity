const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../config/auth');
const User = require('../models/User');
const Item = require('../models/Item');
const Classroom = require('../models/Classroom');


// GET /api/stats/student/:id
router.get('/student/:id', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);
    const classroom = await Classroom.findOne({ students: userId });

    if (!user) return res.status(404).json({ error: 'User not found' });

    const items = await Item.find({ owner: userId });

    const hasEffect = (effectName) =>
      items.some((item) => item.effect === effectName);

    const attackCount = items.filter((item) =>
      ['halveBits', 'stealBits'].includes(item.effect)
    ).length;

    const passiveItems = items.filter((item) => item.category === 'Passive');

    const passiveStats = {
      luck: passiveItems.filter((i) => i.passiveAttributes?.luck).length,
      multiplier: passiveItems.filter((i) => i.passiveAttributes?.multiplier).length,
      groupMultiplier: passiveItems.filter((i) => i.passiveAttributes?.groupMultiplier).length,
    };

    return res.json({
      shieldActive: user.shieldActive,
      doubleEarnings: user.doubleEarnings,
      discountShop: user.discountShop,
      bitInterest: hasEffect('bitInterest'),
      attackPower: attackCount,

      // New passive stat totals
      ...passiveStats,

      classroomId: classroom?._id?.toString() || null,
    });
  } catch (err) {
    console.error('Stats route error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});


module.exports = router;
