const express = require('express');
const { ensureAuthenticated } = require('../config/auth');
const Classroom = require('../models/Classroom');
const router = express.Router();

function perLevelIncrease(level, baseXP, formula) {
  if (level <= 1) return 0; // level 1 costs 0
  switch ((formula || 'exponential').toLowerCase()) {
    case 'linear':       return baseXP * (level - 1);  // steady growth
    case 'logarithmic':  return Math.max(0, Math.floor(baseXP * level * Math.log10(level + 1))); // steep then slows
    case 'exponential':
    default: {
      const powerUp = Math.pow(1.5, level - 2);     // 50% more each level
      return Math.max(0, Math.floor(baseXP * powerUp));
    }
  }
}

// requiredXpForLevel: total XP needed to have reached a level (cumulative)
function requiredXpForLevel(targetLevel, baseXP, formula, caps = { maxLevel: 200 }) {
  let total = 0;
  const maxL = caps?.maxLevel ?? 200;
  for (let l = 2; l <= Math.min(targetLevel, maxL); l++) total += perLevelIncrease(l, baseXP, formula);
  return total;
}

// compute level number from TOTAL XP
function computeLevel(totalXP, baseXP, formula) {
  const maxLevel = 200;
  let level = 1;
  let end = requiredXpForLevel(2, baseXP, formula) || baseXP; 
  while (level < maxLevel && totalXP >= end) {
    level += 1;
    end = requiredXpForLevel(level + 1, baseXP, formula);
  }
  return level;
}

router.get('/:classroomId/leaderboard', ensureAuthenticated, async (req, res) => {
  try {
    const { classroomId } = req.params;

    const classroom = await Classroom.findById(classroomId)
      // include classroomBalances since we are reading it
      .populate('students', 'email role firstName lastName avatar profileImage classroomBalances')
      .lean();

    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    // class formula settings
    const baseXP = Number(classroom.baseXP) > 0 ? Number(classroom.baseXP) : 100;
    const xpFormula = classroom.xpFormula || 'exponential';

    // build leaderboard and sort by xp desc
    const leaderboard = (classroom.students || [])
      .filter(student => student.role === 'student')
      .map(student => {
        const cb = (student.classroomBalances || []).find(
          (c) => c.classroom?.toString() === classroomId.toString()
        );
        const totalXP = Number(cb?.xp) || 0;                 // this is the total XP for this class
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
      .sort((a, b) => (b.xp ?? 0) - (a.xp ?? 0));           

    res.json(leaderboard);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
