const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../config/auth');
const User = require('../models/User');
























































router.post('/assign/bulk', ensureAuthenticated, async (req, res) => {
  if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only teachers can bulk‑assign' });
  }

  const { updates, description = 'Bulk adjustment by teacher' } = req.body;

  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ error: 'No updates supplied' });
  }

  try {
    // Keep a record of successes / failures (optional)
    const results = { updated: 0, skipped: [] };

    for (const { studentId, amount } of updates) {
      const numericAmount = Number(amount);
      if (isNaN(numericAmount)) {
        results.skipped.push({ studentId, reason: 'Amount not numeric' });
        continue;
      }

      const student = await User.findById(studentId);
      if (!student) {
        results.skipped.push({ studentId, reason: 'Student not found' });
        continue;
      }

      student.balance += numericAmount;
      student.transactions.push({
        amount: numericAmount,
        description,
        assignedBy: req.user._id,
        createdAt:   { type: Date, default: Date.now }
      });

      await student.save();
      results.updated += 1;
    }

    res.json({
      message: `Bulk balance assignment complete (${results.updated} updated, ${results.skipped.length} skipped)`,
      ...results,
    });
  } catch (err) {
    console.error('Bulk assign failed:', err);
    res.status(500).json({ error: err.message });
  }
});


 router.get('/users/students', ensureAuthenticated, async (req, res) => {
  const { classroomId } = req.query;

  if (!classroomId || !req.user.classrooms.includes(classroomId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const students = await User.find({
    role: 'student',
    classrooms: classroomId
  }).select('_id email balance');

   res.status(200).json(students);
 });


 router.get('/users/all', ensureAuthenticated, async (req, res) => {
   if (!['teacher', 'admin'].includes(req.user.role)) {
     return res.status(403).json({ error: 'Forbidden' });
   }


  const { classroomId } = req.query;

 if (!classroomId || !req.user.classrooms.includes(classroomId)) {
   return res.status(403).json({ error: 'Forbidden' });
  }

  const everyone = await User.find({
   classrooms: classroomId
  }).select('_id email balance role');

   res.json(everyone);
 });

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