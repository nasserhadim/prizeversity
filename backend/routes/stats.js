const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../config/auth');
const User = require('../models/User');
const Item = require('../models/Item');
const Classroom = require('../models/Classroom');
const mongoose = require('mongoose');

// Will show all the attributes (that can be earned from the items from bazaar)in the statistics page


// GET /api/stats/student/:id
router.get('/student/:id', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.params.id;
    const { classroomId } = req.query;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let items;
    let classroom = null;

    if (classroomId) {
      // Validate classroomId early
      if (!mongoose.Types.ObjectId.isValid(classroomId)) {
        return res.status(400).json({ error: 'Bad classroomId' });
      }

      // Load items and keep only those from the requested classroom's bazaar
      items = await Item.find({ owner: userId }).populate({ path: 'bazaar', select: 'classroom' });
      items = (items || []).filter(it => it.bazaar && String(it.bazaar.classroom) === String(classroomId));

      // Fetch classroom summary (used in response)
      classroom = await Classroom.findById(classroomId).select('_id').lean();
    } else {
      items = await Item.find({ owner: userId });
      // Best-effort: find a classroom that contains this user (may be null)
      classroom = await Classroom.findOne({ students: userId }).select('_id').lean() || null;
    }

    const attackCount = (items || []).filter((item) =>
      ['halveBits', 'stealBits'].includes(item.primaryEffect)
    ).length;

    const passiveItems = (items || []).filter((item) => item.category === 'Passive');

    // Return actual user stats (updated by challenges and items)
    return res.json({
      student: {
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        email: user.email,
      },
      shieldActive: !!user.shieldActive,
      shieldCount: user.shieldCount || 0,
      discountShop: user.discountShop ? 20 : 0, // Return as number
      attackPower: attackCount,
      luck: user.passiveAttributes?.luck || 1,
      multiplier: user.passiveAttributes?.multiplier || 1,
      groupMultiplier: user.passiveAttributes?.groupMultiplier || 1,
      classroomId: classroom?._id?.toString() || null,
      passiveItemsCount: passiveItems.length
    });
  } catch (err) {
    // Log full error so you can inspect the stack in the backend terminal
    console.error('Stats fetch error:', err && err.stack ? err.stack : err);
    res.status(500).json({ error: 'Server error' });
  }
});


module.exports = router;
