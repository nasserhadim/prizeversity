const express = require('express');
const multer = require('multer');
const upload = multer({dest: 'uploads/'});
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



module.exports = router;
