const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../config/auth');
const User = require('../models/User');

// Get user balance
router.get('/users/:id', ensureAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('balance email');
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.status(200).json({ balance: user.balance, email: user.email });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user balance' });
  }
});

// List all student users
router.get('/users/students', ensureAuthenticated, async (req, res) => {
  try {
    const students = await User.find({ role: 'student' }).select('_id email balance');
    res.status(200).json(students);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch student list' });
  }
});

router.post('/:id/make-admin', ensureAuthenticated, async (req, res) => {
  try {
    const student = await User.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    student.role = 'admin';
    await student.save();

    res.status(200).json({ message: 'Student promoted to admin' });
  } catch (err) {
    console.error('Failed to promote student:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;