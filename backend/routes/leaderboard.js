const express = require('express');
const { ensureAuthenticated } = require('../config/auth');
const Classroom = require('../models/Classroom');
const router = express.Router();

//perLevelIncrease: this is for XP to go from level 1 to the next level
function perLevelIncrease(level, baseXP, formula) {
  if (level <= 1) return 0; // level 1 
  switch ((formula || 'exponential').toLowerCase()) {
    case 'linear':
      return baseXP * (level - 1);  // steady growth
    case 'logarithmic':
      return Math.max(0, Math.floor(baseXP * level * Math.log10(level + 1)));
    case 'exponential':
    default: {
      const powerUp = Math.pow(1.5, level - 2); // 50% more each level
      return Math.max(0, Math.floor(baseXP * powerUp));
    }
  }
}

//requiredXPForLevel: this is the total XP that is needed to reach a level
function requiredXpForLevel(targetLevel, baseXP, formula, caps = { maxLevel: 200 }) {
  let total = 0;
  const maxL = caps?.maxLevel ?? 200;
  for (let l = 2; l <= Math.min(targetLevel, maxL); l++) {
    total += perLevelIncrease(l, baseXP, formula);
  }
  return total;
}

router.get('/:classroomId/leaderboard', ensureAuthenticated, async (req, res) => {
  try {
    const { classroomId } = req.params;

    const classroom = await Classroom.findById(classroomId)
      .populate(
        'students',
        'email role firstName lastName avatar profileImage classroomBalances'
      )
      .lean();

    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    // Use the same XP config as xp.js xpConfig.baseXP and xpConfig.xpFormula
    const XPConfig = classroom.xpConfig || {};
    const baseXP = Number(XPConfig.baseXP) > 0 ? Number(XPConfig.baseXP) : 100;
    const xpFormula = (XPConfig.xpFormula || 'exponential').toLowerCase();
    // this will build rows and sort by xp description  
    const leaderboard = (classroom.students || [])
      .filter((student) => student.role === 'student')
      .map((student) => {
        const cb = (student.classroomBalances || []).find(
          (c) =>
            (c.classroom?._id?.toString() || c.classroom?.toString()) ===
            classroomId.toString()
        );

        const storedLevel = Number(cb?.level) || 1;
        const xpInCurrentLevel = Math.max(0, Number(cb?.xp) || 0);

        // total XP at start of this level XP from last levels
        const XPStartLevel = requiredXpForLevel(storedLevel, baseXP, xpFormula);
        // total XP earned in this classroom
        const totalXP = XPStartLevel + xpInCurrentLevel;

        return {
          _id: student._id,
          email: student.email,
          firstName: student.firstName,
          lastName: student.lastName,
          role: student.role,
          avatar: student.avatar,
          profileImage: student.profileImage,
          xp: totalXP,              // total XP for this classroom
          level: storedLevel        
        };
      })
      // highest XP first goes first
      .sort((a, b) => (b.xp ?? 0) - (a.xp ?? 0));

    res.json(leaderboard);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
