const express = require('express');
const router = express.Router();
const User = require('../models/User.js');
const { ensureAuthenticated } = require('../config/auth.js');

// GET /api/users/:id
router.get('/:id', ensureAuthenticated, async (req, res) => {
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

// router.get('/me', ensureAuthenticated, async, (req, res) => {

// })


module.exports = router;
