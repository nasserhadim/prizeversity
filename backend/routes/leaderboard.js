const express = require('express');
const mongoose = require('mongoose');
const { ensureAuthenticated } = require('../config/auth');
const User = require('../models/User');
const Classroom = require('../models/Classroom');
const router = express.Router();

// The leaderboard will list all the users in that classroom from the one that has the most bits gathered.

// Leaderboard (updated for per-classroom balances)
router.get('/:classroomId/leaderboard', ensureAuthenticated, async (req, res) => {
  try {
    const classroomId = req.params.classroomId;
    const classroom = await Classroom.findById(classroomId).populate('students', 'email role firstName lastName');
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    // Fetch per-classroom balances and sort
    const leaderboard = await Promise.all(
      classroom.students
        .filter(student => student.role === 'student')
        .map(async (student) => {
          const user = await User.findById(student._id).select('classroomBalances');
          const classroomBalance = user.classroomBalances.find(cb => cb.classroom.toString() === classroomId);
          return {
            ...student.toObject(),
            balance: classroomBalance ? classroomBalance.balance : 0
          };
        })
    );
    leaderboard.sort((a, b) => b.balance - a.balance);

    res.json(leaderboard);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


module.exports = router;
