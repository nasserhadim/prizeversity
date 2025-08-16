const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../config/auth');
const User = require('../models/User');
const Item = require('../models/Item');
const Classroom = require('../models/Classroom');

// Will show all the attributes (that can be earned from the items from bazaar)in the statistics page


// GET /api/stats/student/:id
router.get('/student/:id', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);
    const classroom = await Classroom.findOne({ students: userId });

    if (!user) return res.status(404).json({ error: 'User not found' });

    const items = await Item.find({ owner: userId });

    const attackCount = items.filter((item) =>
      ['halveBits', 'stealBits'].includes(item.primaryEffect)
    ).length;

    const passiveItems = items.filter((item) => item.category === 'Passive');

    // Format stats with 'x' prefix for multipliers
    return res.json({
      student: {
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
      },
      shieldActive: user.shieldActive,
      discountShop: user.discountShop ? 20 : 0, // Return as number
      attackPower: attackCount,
      luck: user.passiveAttributes?.luck || 1,
      multiplier: user.passiveAttributes?.multiplier || 1,
      groupMultiplier: user.passiveAttributes?.groupMultiplier || 1,
      classroomId: classroom?._id?.toString() || null,
    });
  } catch (err) {
    console.error('Stats route error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});


module.exports = router;
