const express = require('express');
const mongoose = require('mongoose');
const { ensureAuthenticated } = require('../config/auth');
const User = require('../models/User');
const Classroom = require('../models/Classroom');
const router = express.Router();

// The leaderboard will list all the users in that classroom from the one that has the most bits gathered.

// Leaderboard (updated to not expose balances)
router.get('/:classroomId/leaderboard', ensureAuthenticated, async (req, res) => {
  try {
    const classroomId = req.params.classroomId;
    const classroom = await Classroom.findById(classroomId).populate('students', 'email role firstName lastName');
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    // Return students without balance information
    const leaderboard = classroom.students
      .filter(student => student.role === 'student')
      .map(student => ({
        _id: student._id,
        email: student.email,
        firstName: student.firstName,
        lastName: student.lastName,
        role: student.role
      }));

    res.json(leaderboard);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


module.exports = router;
