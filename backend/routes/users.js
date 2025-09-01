const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../config/auth');
const User = require('../models/User');
const Group = require('../models/Group'); // Add this import if not already present
const Classroom = require('../models/Classroom');
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const { populateNotification } = require('../utils/notifications');

// Add this helper function after the imports
const cleanupUserFromGroups = async (userId) => {
  try {
    // Find all groups that contain this user
    const groups = await Group.find({
      'members._id': userId
    });

    // Remove user from each group and update multipliers
    for (const group of groups) {
      const wasInGroup = group.members.some(member => member._id.equals(userId));
      if (wasInGroup) {
        group.members = group.members.filter(member => !member._id.equals(userId));
        await group.save();
        
        // Update group multiplier after member removal
        await group.updateMultiplier();
      }
    }
  } catch (err) {
    console.error('Error cleaning up user from groups:', err);
  }
};

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


// Get Students in Classroom (updated for per-classroom balances)
router.get('/students', ensureAuthenticated, async (req, res) => {
  const { classroomId } = req.query;
  if (!classroomId || !req.user.classrooms.includes(classroomId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const students = await User.find({
    role: 'student',
    classrooms: classroomId
  }).select('_id email firstName lastName');

  // Add per-classroom balances
  const studentsWithBalances = await Promise.all(
    students.map(async (student) => {
      const user = await User.findById(student._id).select('classroomBalances');
      const classroomBalance = user.classroomBalances.find(cb => cb.classroom.toString() === classroomId);
      return {
        ...student.toObject(),
        balance: classroomBalance ? classroomBalance.balance : 0
      };
    })
  );

  res.status(200).json(studentsWithBalances);
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

// Get user balance (updated for per-classroom)
router.get('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { classroomId } = req.query;
    const user = await User.findById(req.params.id).select('balance classroomBalances email');
    if (!user) return res.status(404).json({ error: 'User not found' });

    let balance = user.balance; // Default to global
    if (classroomId) {
      balance = getClassroomBalance(user, classroomId);
    }
    res.json({ balance, email: user.email });
  } catch (err) {
    console.error('Balance lookup failed:', err);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});



// Promote a student to admin
router.post('/:id/make-admin', ensureAuthenticated, async (req, res) => {
  try {
    const { classroomId } = req.body;
    const student = await User.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    student.role = 'admin';
    await student.save();

    
    const notification = await Notification.create({
      user: student._id,
      actionBy: req.user._id,
      type: 'ta_promotion',                                     //creating a notification for the student promoting to Admin/TA
      message: `You have been promoted to Admin/TA.`,
      read: false,
      classroom: classroomId, 
      createdAt: new Date(),
    });

    const populatedNotification = await populateNotification(notification._id);
      req.app.get('io').to(`user-${student._id}`).emit('notification', populatedNotification); // or req.io

    res.status(200).json({ message: 'Student promoted to admin' });
  } catch (err) {
    console.error('Failed to promote student:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Demote an admin back to student
router.post('/:id/demote-admin', ensureAuthenticated, async (req, res) => {
  try {
    const { classroomId } = req.body;
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

  const notification = await Notification.create({
  user: admin._id,
  actionBy: req.user._id,
  type: 'ta_demotion',
  message: `You have been demoted from Admin/TA to a student.`,
  classroom: classroomId,
  read: false,
  createdAt: new Date(),
});

const populated = await populateNotification(notification._id);
req.app.get('io').to(`user-${admin._id}`).emit('notification', populated);

// After role promotion/demotion
req.app.get('io').to(`user-${admin._id}`).emit('role_change', {
  newRole: 'student', // or whatever the new role is
  userId: admin._id
});

req.app.get('io').to(`classroom-${classroomId}`).emit('user_role_update', {
  userId: admin._id,
  newRole: 'student',
  classroomId
});

   res.status(200).json({ message: 'Admin/TA demoted to student' });
  } catch (err) {
    console.error('Failed to demote admin:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// update the profile with a firstname and a last name
router.post('/update-profile', ensureAuthenticated, async (req, res) => {
  const { role } = req.body;
  const firstNameRaw = req.body.firstName;
  const lastNameRaw = req.body.lastName;
  const userId = req.user._id;

  // Normalize / trim input
  const firstName = firstNameRaw !== undefined ? String(firstNameRaw).trim() : undefined;
  const lastName = lastNameRaw !== undefined ? String(lastNameRaw).trim() : undefined;

  // If client attempted to update name fields, require at least one non-empty name.
  if (firstNameRaw !== undefined || lastNameRaw !== undefined) {
    if (!firstName && !lastName) {
      return res.status(400).json({ error: 'At least one of firstName or lastName must be provided' });
    }
  }

  try {
    const updateData = {};
    if (role) updateData.role = role;
    if (firstNameRaw !== undefined) {
      updateData.firstName = firstName;
      updateData.oauthFirstName = undefined; // clear oauth fallback
    }
    if (lastNameRaw !== undefined) {
      updateData.lastName = lastName;
      updateData.oauthLastName = undefined;
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true });
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

// Helper to get or initialize per-classroom balance (same logic as in wallet.js)
const getClassroomBalance = (user, classroomId) => {
  if (!Array.isArray(user.classroomBalances)) return 0;
  const cb = user.classroomBalances.find(cb => String(cb.classroom) === String(classroomId));
  return cb ? cb.balance : 0;
};

const updateClassroomBalance = (user, classroomId, newBalance) => {
  if (!Array.isArray(user.classroomBalances)) user.classroomBalances = [];
  const idx = user.classroomBalances.findIndex(cb => String(cb.classroom) === String(classroomId));
  if (idx >= 0) {
    user.classroomBalances[idx].balance = Math.max(0, newBalance);
  } else {
    user.classroomBalances.push({ classroom: classroomId, balance: Math.max(0, newBalance) });
  }
};

// Add this route for user deletion (if it doesn't exist)
router.delete('/delete-account', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Clean up user from all groups first
    await cleanupUserFromGroups(userId);
    
    // Add any other cleanup logic here (remove from classrooms, etc.)
    
    await User.findByIdAndDelete(userId);
    res.status(200).json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error('Account deletion error:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

module.exports = router;