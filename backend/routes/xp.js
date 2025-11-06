const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Classroom = require('../models/Classroom');

//limitToRange: keep a number between lower bound and the upper bound
const limitToRange = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

//perLevelIncrease: this XP is going from level 1 to the next level
function perLevelIncrease(level, baseXP, formula) {
  if (level <= 1) return 0; // level 1
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
function requiredXpForLevel(targetLevel, baseXP, formula, caps = { maxLevel: 200 }) {
  let total = 0;
  const maxL = caps?.maxLevel ?? 200;
  for (let l = 2; l <= Math.min(targetLevel, maxL); l++) total += perLevelIncrease(l, baseXP, formula);
  return total;
}

//calculateLevelSummary: this will turn the total XP into level, range and progress
function calculateLevelSummary(totalXP, baseXP, formula) {
  const maxLevel = 200;
  let level = 1;
  let XPStartLevel = 0;
  let XPEndLevel = requiredXpForLevel(2, baseXP, formula) || baseXP;

  while (level < maxLevel && totalXP >= XPEndLevel) {
    level += 1;
    XPStartLevel = XPEndLevel;
    XPEndLevel = requiredXpForLevel(level + 1, baseXP, formula);
  }

  const span = Math.max(1, XPEndLevel - XPStartLevel); //this is the size of the level
  const progressPercent = limitToRange(((totalXP - XPStartLevel) /span ) * 100, 0, 100);
  const XPRequired = Math.max(0, XPEndLevel - totalXP); //this is the xp points that are left to get to the next level

  return {
    level,
    XPStartLevel,
    XPEndLevel,
    XPRequired,
    progressPercent: Math.round(progressPercent),
  };
}

//getClassroomRow: this makes sure that the user has a classroomBalances row for this class
function getClassroomRow(user, classroomId) {
  let row = user.classroomBalances.find(
    (c) => c.classroom?.toString() === classroomId.toString()
  );
  if(!row) {
    user.classroomBalances.push({
      classroom: classroomId,
      balance: 0,
      xp: 0,
      level: 1,
    });
    row = user.classroomBalances.find(
      (c) => c.classroom?.toString() === classroomId.toString()
    );
  }
  return row;
}

//loadClassroomConfigurations: this reads the classroom formula settings
async function loadClassroomConfigurations(classroomId) {
  const classroom = await Classroom.findById(classroomId);
  if (!classroom) return {
    baseXP: 100,
    xpFormula: 'exponential'
  };
  const baseXP = Number(classroom.baseXP) > 0 ? Number(classroom.baseXP) : 100;
  const xpFormula = classroom.xpFormula || 'exponential';
  return {
    baseXP,
    xpFormula,
    classroom
  };
}


// Simple test route to confirm XP route is connected
router.get('/test', (req, res) => {
  res.json({ message: 'XP route connected successfully' });
});

// returns level summary for one student in one class
router.get('/summary', async (req, res) => {
  try {
    const { userId, classroomId } = req.query;
    if (!userId || !classroomId) return res.status(400).json({ error: 'userId and classroomId are required' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const row = getClassroomRow(user, classroomId);
    const { baseXP, xpFormula } = await loadClassroomConfigurations(classroomId);

    const totalXP = Number(row.xp) || 0;
    const summary = calculateLevelSummary(totalXP, baseXP, xpFormula);

    // keep stored level with computed level
    if (row.level !== summary.level) {
      row.level = summary.level;
      await user.save();
    }

    res.json({
      userId,
      classroomId,
      formula: xpFormula,
      baseXP,
      totalXP,
      ...summary,
    });
  } catch (err) {
    console.error('Error in XP summary:', err);
    res.status(500).json({ error: 'Server error generating XP summary' });
  }
});

// adds to TOTAL XP, recomputes level, returns summary
router.post('/add', async (req, res) => {
  try {
    const { userId, classroomId, xpToAdd } = req.body;

    // validate inputs
    if (!userId || !classroomId || typeof xpToAdd !== 'number' || xpToAdd <= 0) {
      return res.status(400).json({ error: 'Invalid input data' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const row = getClassroomRow(user, classroomId);
    const { baseXP, xpFormula } = await loadClassroomConfigurations(classroomId);

    row.xp = (Number(row.xp) || 0) + xpToAdd;                    // store TOTAL XP

    const summary = calculateLevelSummary(row.xp, baseXP, xpFormula);
    const leveledUp = summary.level > (row.level || 1);          // check if level increased
    row.level = summary.level;

    await user.save();

    res.json({
      message: leveledUp ? `Level up! You are now level ${row.level}` : `+${xpToAdd} XP added`,
      classroomData: {
        classroom: row.classroom,
        totalXP: row.xp,
        level: row.level,
        ...summary,
        baseXP,
        formula: xpFormula
      }
    });
  } catch (err) {
    console.error('Error updating XP:', err.message);
    res.status(500).json({ error: 'Server error updating XP' });
  }
});

// Update classroom XP settings (Teacher only)
router.put('/config/:classroomId', async (req, res) => {
  try {
    const { classroomId } = req.params;
    const { dailyLogin, groupJoin } = req.body;

    const classroom = await Classroom.findById(classroomId);
    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    // Validation
    if (dailyLogin && (typeof dailyLogin !== 'number' || dailyLogin < 0)) {
      return res.status(400).json({ error: 'Invalid XP value for dailyLogin' });
    }
    if (groupJoin && (typeof groupJoin !== 'number' || groupJoin < 0)) {
      return res.status(400).json({ error: 'Invalid XP value for groupJoin' });
    }

    if (dailyLogin !== undefined) classroom.xpConfig.dailyLogin = dailyLogin;
    if (groupJoin !== undefined) classroom.xpConfig.groupJoin = groupJoin;

    await classroom.save();

    res.json({
      message: 'XP configuration updated successfully',
      xpConfig: classroom.xpConfig,
    });
  } catch (err) {
    console.error('Error updating XP config:', err.message);
    res.status(500).json({ error: 'Server error updating XP config' });
  }
});

// Temporary test route to manually add XP
// This is not permanent code, just for testing purposes during development
// add XP for testing
router.post('/test/add', async (req, res) => {
  try {
    let { userId, classroomId, xpToAdd = 100 } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // if class not provided, use the first one on the user
    if (!classroomId) {
      if (user.classroomBalances.length > 0) classroomId = user.classroomBalances[0].classroom;
      else return res.status(400).json({ error: 'User is not part of any classroom.' });
    }

    const row = getClassroomRow(user, classroomId);
    const { baseXP, xpFormula } = await loadClassroomConfigurations(classroomId);

    row.xp = (Number(row.xp) || 0) + xpToAdd;

    const summary = calculateLevelSummary(row.xp, baseXP, xpFormula);
    const leveledUp = summary.level > (row.level || 1);
    row.level = summary.level;

    await user.save();

    res.json({
      message: leveledUp
        ? `+${xpToAdd} XP — Level Up! You are now level ${row.level}.`
        : `+${xpToAdd} XP added successfully.`,
      classroomData: { classroom: row.classroom, totalXP: row.xp, ...summary, formula: xpFormula, baseXP }
    });
  } catch (err) {
    console.error('Error in XP test/add route:', err.message);
    res.status(500).json({ error: 'Server error adding XP for testing' });
  }
});


// Temporary test route to reset XP and level
// This is not permanent code, just for testing purposes during development
router.post('/test/reset', async (req, res) => {
  try {
    let { userId, classroomId } = req.body;

    // Find the user
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // if no classroomId provided, use the first classroom the user is in
    if (!classroomId) {
      if (user.classroomBalances.length > 0) {
        classroomId = user.classroomBalances[0].classroom;
      } else {
        return res.status(400).json({ error: 'User is not part of any classroom.' });
      }
    }

    // Find classroom data
    const row = user.classroomBalances.find(
      c => c.classroom.toString() === classroomId.toString()
    );

    if (!row) {
      return res
        .status(400)
        .json({ error: 'User not found in specified classroom' });
    }

    // Reset XP and level
    row.xp = 0;
    row.level = 1;

    await user.save();

    res.json({
      message: 'XP and level reset successfully.',
      classroomData: row
    });
  } catch (err) {
    console.error('Error in XP test/reset route:', err.message);
    res.status(500).json({ error: 'Server error resetting XP' });
  }
});

module.exports = router;
