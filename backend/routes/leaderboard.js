const express = require('express');
const mongoose = require('mongoose');
const { ensureAuthenticated } = require('../config/auth');
const User = require('../models/User');
const Classroom = require('../models/Classroom');
const router = express.Router();

//perLevelIncrease: this is for XP to go from level 1 to the next level
function perLevelIncrease(level, baseXP, formula) {
  if (level <= 1) return 0;
  switch ((formula || 'exponential').toLowerCase()) {
    case 'linear':
      return baseXP * (level - 1);
    case 'logarithmic':
      return Math.max(0, Math.floor(baseXP * level * Math.log10(level + 1)));
    case 'exponential':
      default: {
        const powerUp = Math.pow(1.5, level - 2);
        return Math.max(0, Math.floor(baseXP * powerUp));
      }
  }
}

//requiredXPForLevel: this is the total XP that is needed to reach a level
function requiredXpForLevel(targetLevel, baseXP, formula, caps = {maxLevel: 100}) {
  let total = 0;
  const maxL = caps?.maxLevel ?? 100;
  for (let l  = 2; l <= Math.min(targetLevel, maxL); l++)
    total += perLevelIncrease(l, baseXP, formula);
  return total;
}

//this will computer the level number from the total XP
function computeLevel(totalXP, baseXP, formula) {
  const maxLevel = 100;
  let level = 1;
  let end = requiredXpForLevel(2, baseXP, formula) || baseXP;
  while (level < maxLevel && totalXP >= end) {
    level += 1;
    end = requiredXpForLevel(level + 1, baseXP, formula);
  }
  return level;
}

// Leaderboard (updated to not expose balances)
router.get('/:classroomId/leaderboard', ensureAuthenticated, async (req, res) => {
  try {
    const classroomId = req.params.classroomId;

    const classroom = await Classroom.findById(classroomId)
      .populate('students', 'email role firstName lastName avatar profileImage')
      .lean();

    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    //class formula settings 
    const baseXP = Number(classroom.baseXP) > 0 ? Number(classroom.baseXP) : 100;
    const xpFormula = classroom.xpFormula || 'exponential';

    // this will build rows and sort by xp description
    const leaderboard = (classroom.students || [])
      .filter(student => student.role === 'student')
      .map(student => {
        const cb = (student.classroomBalances || []).find(
          (c) => c.classroom?.toString() === classroomId.toString()
        );
        const totalXP = Number(cb?.xp) || 0;                 // this is total XP for this class
        const level = computeLevel(totalXP, baseXP, xpFormula);

        return {
          _id: student._id,
          email: student.email,
          firstName: student.firstName,
          lastName: student.lastName,
          role: student.role,
          avatar: student.avatar,
          profileImage: student.profileImage,
          xp: totalXP,                                       
          level                                              
        };
      })
      .sort((a, b) => (b.xp ?? 0) - (a.xp ?? 0));   //this will give the highest XP first

    res.json(leaderboard);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


module.exports = router;
