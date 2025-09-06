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

    // Calculate actual group multiplier based on current group memberships
    let actualGroupMultiplier = 1;
    if (classroomId) {
      const GroupSet = require('../models/GroupSet');
      const Group = require('../models/Group');
      
      const groupSets = await GroupSet.find({ classroom: classroomId }).select('groups');
      const groupIds = groupSets.flatMap(gs => gs.groups);
      
      if (groupIds.length > 0) {
        const groups = await Group.find({
          _id: { $in: groupIds },
          members: {
            $elemMatch: {
              _id: userId,
              status: 'approved'
            }
          }
        }).select('groupMultiplier');

        if (groups && groups.length > 0) {
          // Sum of multipliers across distinct groupsets (same as wallet logic)
          actualGroupMultiplier = groups.reduce((sum, g) => sum + (g.groupMultiplier || 1), 0);
        }
      }
    }

    const attackCount = (items || []).filter((item) =>
      ['halveBits', 'stealBits'].includes(item.primaryEffect)
    ).length;

    const passiveItems = (items || []).filter((item) => item.category === 'Passive');

    // Helper function to check if user has a specific effect from items
    function hasEffect(effectName) {
      return passiveItems.some((item) => item.primaryEffect === effectName);
    }

    // Keep the EXISTING return structure - don't change anything else
    return res.json({
      student: {
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        email: user.email,
      },
      classroom: classroom?._id || null,
      // Keep existing user stats from schema
      luck: user.passiveAttributes?.luck || 1,
      multiplier: user.passiveAttributes?.multiplier || 1,
      groupMultiplier: actualGroupMultiplier, // Use calculated value instead
      shieldActive: user.shieldActive || false,
      shieldCount: user.shieldCount || 0,
      attackPower: attackCount,
      // Keep existing computed stats from items
      doubleEarnings: hasEffect('doubleEarnings'),
      discountShop: hasEffect('discountShop') ? 20 : 0,
      passiveItemsCount: passiveItems.length
    });
  } catch (err) {
    console.error('Stats route error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


module.exports = router;
