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
    const classroom = await Classroom.findById(classroomId)
      .populate('students', 'email role firstName lastName avatar profileImage classroomXP')
      .select('xpSettings');
      
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    // Map students with their classroom-specific level and XP
    const leaderboard = classroom.students
      .filter(student => student.role === 'student')
      .map(student => {
        const classroomXP = student.classroomXP?.find(
          cx => cx.classroom.toString() === classroomId.toString()
        );

        return {
          _id: student._id,
          email: student.email,
          firstName: student.firstName,
          lastName: student.lastName,
          role: student.role,
          avatar: student.avatar,
          profileImage: student.profileImage,
          level: classroomXP?.level || 1,
          xp: classroomXP?.xp || 0
        };
      })
      .sort((a, b) => {
        // Sort by level (descending), then by XP (descending)
        if (b.level !== a.level) {
          return b.level - a.level;
        }
        return b.xp - a.xp;
      });

    res.json(leaderboard);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
