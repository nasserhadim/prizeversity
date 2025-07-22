const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../config/auth');
const User = require('../models/User');
const Classroom = require('../models/Classroom');
const mongoose = require('mongoose');

// DELETE a user by ID
router.delete('/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('Delete failed:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// POST route for bulk assigning balance to students
router.post('/assign/bulk', ensureAuthenticated, async (req, res) => {
  // Restrict to teachers or admins only
  if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only teachers can bulk‑assign' });
  }

  const { updates, description = 'Bulk adjustment by teacher' } = req.body;

  // Validate input
  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ error: 'No updates supplied' });
  }

  try {
    const results = { updated: 0, skipped: [] };

    for (const { studentId, amount } of updates) {

      // Validate ObjectId
      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        results.skipped.push({ studentId, reason: 'Invalid student ID' });
        continue;
      }
      const numericAmount = Number(amount);
      if (isNaN(numericAmount)) {
        results.skipped.push({ studentId, reason: 'Amount not numeric' });
        continue;
      }

      const student = await User.findById(studentId).populate({
        // Find student and populate approved groups
        path: 'groups',
        match: { 'members._id': studentId, 'members.status': 'approved' },
        select: 'groupMultiplier'
      });

      if (!student) {
        results.skipped.push({ studentId, reason: 'Student not found' });
        continue;
      }

      // Get all multipliers (group * passive)
      const groupMultiplier = student.groups.length > 0 
        ? Math.max(...student.groups.map(g => g.groupMultiplier || 1))
        : 1;
      const passiveMultiplier = student.passiveAttributes?.multiplier || 1;
      const totalMultiplier = groupMultiplier * passiveMultiplier;

      // Apply multiplier only for positive amounts
     const adjustedAmount = amount >= 0 
  ? Math.round(amount * totalMultiplier)
  : amount;

    // Prevent balance from going below 0
    const newBalance = student.balance + adjustedAmount;
    student.balance = Math.max(0, newBalance);

    // Record the transaction
    student.transactions.push({
      amount: adjustedAmount,
      description,
      assignedBy: req.user._id,
      createdAt: new Date()
    });

console.log(`Student ${student._id}: oldBalance=${student.balance - adjustedAmount}, adjusted=${adjustedAmount}, newBalance=${student.balance}`);

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


// Get all studetns in a classroom
 router.get('/students', ensureAuthenticated, async (req, res) => {
  const { classroomId } = req.query;
  
  // Ensure classroom access
  if (!classroomId || !req.user.classrooms.includes(classroomId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Find students by classroom
  const students = await User.find({
    role: 'student',
    classrooms: classroomId
  }).select('_id email balance firstName lastName');
   res.status(200).json(students);
 });

// GET all users (not just students) in a classroom
 router.get('/all', ensureAuthenticated, async (req, res) => {
  // Restrict to teacher/admin
   if (!['teacher', 'admin'].includes(req.user.role)) {
     return res.status(403).json({ error: 'Forbidden' });
   }


  const { classroomId } = req.query;

  // Check classroom access
 if (!classroomId || !req.user.classrooms.includes(classroomId)) {
   return res.status(403).json({ error: 'Forbidden' });
  }

  const everyone = await User.find({
   classrooms: classroomId
  }).select('_id email balance role');

   res.json(everyone);
 });

// Get user balance
router.get('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('balance email');
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.status(200).json({ balance: user.balance, email: user.email });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user balance' });
  }
});




// Promote a student to admin
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

// Demote an admin back to student
router.post('/:id/demote-admin', ensureAuthenticated, async (req, res) => {
  try {
    // Only teachers can demote admins
    if (req.user.role !== 'teacher') {
  return res.status(403).json({ error: 'Only teachers can demote admins' });
  }
    const admin = await User.findById(req.params.id);
    if (!admin) return res.status(404).json({ error: 'User not found' });

    if (admin.role !== 'admin')
      return res.status(400).json({ error: 'User is not an admin' });

    admin.role = 'student';
   await admin.save();

   res.status(200).json({ message: 'Admin demoted to student' });
  } catch (err) {
    console.error('Failed to demote admin:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// update the profile with a firstname and a last name
router.post('/update-profile', ensureAuthenticated, async (req, res) => {
  const { role, firstName, lastName } = req.body;
  const userId = req.user._id; // Assuming you are using a middleware like `passport` to get `req.user`

  try {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { role, firstName, lastName },
      { new: true }
    );
    res.json({ user: updatedUser });
  } catch (error) {
    console.error('Failed to update profile:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST route to upload users in bulk to a classroom
router.post('/bulk-upload', ensureAuthenticated, async (req, res) => {

  // Only teachers and admins can perform this action
  if (!['teacher', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only teachers can upload users' });
  }

  // Verify classroom ownership or teaching role
  const { classroomId, users } = req.body;
  const owns = req.user.classrooms.map(String).includes(classroomId)
            || await Classroom.exists({ _id: classroomId, teacher: req.user._id });
  if (!owns) return res.status(403).json({ error: 'Not your classroom' });
  if (!Array.isArray(users) || users.length === 0) {
    return res.status(400).json({ error: 'No user data provided' });
  }

  try {
    const results = { added: 0, skipped: [] };
    const newUserIds = [];

    for (const userData of users) {
     // Normalize and validate input fields
      const normal    = Object.fromEntries(
        Object.entries(userData).map(([k, v]) => [k.toLowerCase(), v])
      );
      const email     = normal.email?.trim();
      const firstName = normal.firstname;
      const lastName  = normal.lastname;
      let   role      = (normal.role || 'student').toLowerCase();
      if (!['student','admin'].includes(role)) role = 'student';

    // Validate email
    if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
      results.skipped.push({ email, reason: 'Invalid or missing email' });
      continue;
    }

    // Prevent duplicate accounts
    if (await User.exists({ email })) {
      results.skipped.push({ email, reason: 'Already exists' });
      continue;
    }

    // Parse initial balance
    const rawBal        = normal.balance;
    const parsedBalance = parseFloat(rawBal);
    const initialBalance = isNaN(parsedBalance) ? 0 : parsedBalance;

    // Create new user
    const newUser = new User({
      email,
      firstName,
      lastName,
      role,
      classrooms: [classroomId],
      balance: initialBalance
    });
    await newUser.save();

    newUserIds.push(newUser._id);
    results.added += 1;
  }

  // Update classroom to include new users
  if (newUserIds.length > 0) {
    await Classroom.updateOne(
      { _id: classroomId },
      { $addToSet: { students: { $each: newUserIds } } }
    );
  }

  return res.json({ message: `${results.added} users added`, results });
  } catch (err) {
    console.error('Upload failed:', err);
    return res.status(500).json({ error: err.message });
  }
});


module.exports = router;