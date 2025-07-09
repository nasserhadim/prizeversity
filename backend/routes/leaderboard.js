const express = require('express');
const mongoose = require('mongoose');
const { ensureAuthenticated } = require('../config/auth');
const User = require('../models/User');
const Classroom = require('../models/Classroom');
const router = express.Router();

router.get('/:classroomId/leaderboard', ensureAuthenticated, async (req, res) => {
  try {
    const classroomId = req.params.classroomId;

    // fetching classroom
    const classroom = await Classroom.findById(classroomId).populate('students', 'email balance role');
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });
    
    // listing the students based on the bits they have
    const leaderboard = classroom.students
      .filter(student => student.role === 'student')
      .sort((a, b) => b.balance - a.balance);

    res.json(leaderboard);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


module.exports = router;
