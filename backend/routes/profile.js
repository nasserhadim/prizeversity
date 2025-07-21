const express = require('express');
const upload = require('../middleware/upload');
const router = express.Router();
const User = require('../models/User.js');
const { ensureAuthenticated } = require('../config/auth.js');

// GET /api/profile/student/:id
router.get('/student/:id', ensureAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('classrooms')
      .populate('groups')
      .populate('transactions.assignedBy', 'firstName lastName email'); // just enough info
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/profile/student/:id
router.put('/student/:id', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.params.id;

    // Only allow users to update their own profile
    if (req.user._id.toString() !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { firstName, lastName, avatar } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Update fields if they exist in the request
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();

    res.json(user);
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// adding the statistics for each item you have
// GET /api/profile/student/:id/stats
router.get('/student/:id/stats', ensureAuthenticated, async (req, res) => {
  try {

    // Read the user to check if the shield is active 
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // it will load all items owned by that user nad check if any item effects match known passive items
    const items = await require('../models/Item').find({ owner: userId });

    const hasEffect = (effectName) =>
      items.some((item) => item.effect === effectName);

    const attackCount = items.filter((item) =>
      ['halveBits', 'stealBits'].includes(item.effect)
    ).length;

    return res.json({
      shieldActive: user.shieldActive || false,
      doubleEarnings: hasEffect('doubleEarnings'),
      discountShop: hasEffect('discountShop'),
      bitInterest: hasEffect('bitInterest'),
      attackPower: attackCount,
    });
  } catch (error) {
    console.error('Stats route error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
})

router.post('/upload-avatar', ensureAuthenticated, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    // req.user is authenticated user
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // store just the filename
    user.avatar = req.file.filename;
    await user.save();

    res.json(user);
  } catch (err) {
    console.error('Avatar upload error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/remove-avatar', ensureAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.avatar = undefined;
    await user.save();
    res.json(user);
  } catch (err) {
    console.error('Remove avatar error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


module.exports = router;
