const express = require('express');
const { ensureAuthenticated } = require('../config/auth');
const User = require('../models/User');
const Classroom = require('../models/Classroom');
const Group = require('../models/Group');
const GroupSet = require('../models/GroupSet');
const router = express.Router();
const mongoose = require('mongoose');
const blockIfFrozen = require('../middleware/blockIfFrozen');
const PendingAssignment = require('../models/PendingAssignment');
const Notification = require('../models/Notification');
const { populateNotification } = require('../utils/notifications');

// Utility to check if a Admin/TA can assign bits based on classroom policy
async function canTAAssignBits({ taUser, classroomId }) {
  const Classroom = require('../models/Classroom');
  const classroom = await Classroom.findById(classroomId).select('taBitPolicy students');
  if (!classroom) return { ok: false, status: 404, msg: 'Classroom not found' };

  if (!classroom.students.map(String).includes(String(taUser._id))) {
    return { ok: false, status: 403, msg: 'You are not part of this classroom' };
  }

  switch (classroom.taBitPolicy) {
    case 'full':
      return { ok: true };
    case 'none':
      return { ok: false, status: 403, msg: 'Policy forbids Admins/TAs from assigning bits' };
    case 'approval':
      return { ok: false, requiresApproval: true };
    default:
      return { ok: false, status: 500, msg: 'Unknown policy' };
  }
}

// Gets total group multiplier for a student across groups in a classroom
const getGroupMultiplierForStudentInClassroom = async (studentId, classroomId) => {
  const groupSets = await GroupSet.find({ classroom: classroomId }).select('groups');
  const groupIds = groupSets.flatMap(gs => gs.groups);

  if (groupIds.length === 0) return 1;

  const groups = await Group.find({
    _id: { $in: groupIds },
    members: {
      $elemMatch: {
        _id: studentId,
        status: 'approved'
      }
    }
  }).select('groupMultiplier');

  if (!groups || groups.length === 0) return 1;

  // Sum of multipliers across distinct groupsets
  return groups.reduce((sum, g) => sum + (g.groupMultiplier || 1), 0);
};

// Admin/teacher fetches all user transactions (optionally filtered by studentID & classroom)
router.get('/transactions/all', ensureAuthenticated, async (req, res) => {
  if (!['teacher', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const { studentId, classroomId } = req.query;
    if (studentId && !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ error: 'Bad studentId' });
    }
    if (classroomId && !mongoose.Types.ObjectId.isValid(classroomId)) {
      return res.status(400).json({ error: 'Bad classroomId' });
    }

    // If a specific student is requested, query by id.
    // If a classroomId is provided, load the Classroom and query users by the classroom's membership
    let users = [];
    if (studentId) {
      users = await User.find({ _id: studentId })
        .populate('transactions.assignedBy', 'role')
        .select('_id email firstName lastName transactions classrooms')
        .lean();
    } else if (classroomId) {
      // Load classroom and use its students/teacher list to find users (safer when User.classrooms isn't synced)
      const classroom = await Classroom.findById(classroomId).select('teacher students').lean();
      if (!classroom) return res.status(404).json({ error: 'Classroom not found' });
      const userIds = [
        ...(classroom.teacher ? [classroom.teacher] : []),
        ...(Array.isArray(classroom.students) ? classroom.students : [])
      ].map(id => String(id));

      users = await User.find({ _id: { $in: userIds } })
        .populate('transactions.assignedBy', 'role')
        .select('_id email firstName lastName transactions classrooms')
        .lean();
    } else {
      users = await User.find({})
        .populate('transactions.assignedBy', 'role')
        .select('_id email firstName lastName transactions classrooms')
        .lean();
    }

    console.debug('[/transactions/all] request by user:', req.user._id.toString(), 'role:', req.user.role, 'studentId:', studentId, 'classroomId:', classroomId, 'usersFetched:', users.length);

    const txs = [];
    users.forEach((u) => {
      (u.transactions || []).forEach((t) => {
        if (classroomId) {
          if (!t.classroom) return; // skip legacy/global txs when scoping by classroom
          if (String(t.classroom) !== String(classroomId)) return;
        }
        txs.push({
          ...(t.toObject ? t.toObject() : t),
          studentId: u._id,
          studentEmail: u.email,
          studentName: (u.firstName || u.lastName)
            ? `${u.firstName || ''} ${u.lastName || ''}`.trim()
            : u.email,
        });
      });
    });

    txs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(txs);
  } catch (err) {
    console.error('Failed to fetch all transactions:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Assign Balance to Student
router.post('/assign', ensureAuthenticated, async (req, res) => {
  const { classroomId, studentId, amount, description } = req.body;

  // Check Admin/TA permission
  if (req.user.role === 'admin') {
    const gate = await canTAAssignBits({ taUser: req.user, classroomId });
    if (!gate.ok) {
      if (gate.requiresApproval) {
        const pa = await PendingAssignment.create({
          classroom: classroomId,
          student: studentId,
          amount: amount,
          description,
          requestedBy: req.user._id,
        });
        // Notify teacher
        const classroom = await Classroom.findById(classroomId).populate('teacher');
        const notification = await Notification.create({
          user: classroom.teacher._id,
          type: 'bit_assignment_request',
          message: `Admin/TA ${req.user.firstName || req.user.email} requested to assign ${pa.amount}Ƀ.`,
          classroom: classroomId,
          actionBy: req.user._id,
        });
        const populated = await populateNotification(notification._id);
        req.app.get('io').to(`user-${classroom.teacher._id}`).emit('notification', populated);

        return res
          .status(202)
          .json({ message: 'Request queued for teacher approval' });
      }
      return res.status(gate.status).json({ error: gate.msg });
    }
  } else if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const student = await User.findById(studentId);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const numericAmount = Number(amount);
    if (isNaN(numericAmount)) {
      return res.status(400).json({ error: 'Amount must be a number' });
    }

    // Manually look up groups this student is in
    const groups = await Group.find({
      'members._id': studentId,
      'members.status': 'approved'
    }).select('groupMultiplier');

    // Get the highest multiplier
    let multiplier = 1;
    if (groups.length > 0 && numericAmount >= 0) {
      multiplier = Math.max(...groups.map(g => g.groupMultiplier || 1));
    }

    const adjustedAmount = numericAmount >= 0 
      ? Math.round(numericAmount * multiplier)
      : numericAmount;

    student.balance = Math.max(0, student.balance + adjustedAmount);
    student.transactions.push({
      amount: adjustedAmount,
      description: description || `Balance adjustment`,
      assignedBy: req.user._id,
      calculation: numericAmount >= 0 ? {
        baseAmount: numericAmount,
        personalMultiplier: 1, // Note: This route doesn't use personal multiplier
        groupMultiplier: multiplier,
        totalMultiplier: multiplier,
      } : undefined,
    });

    await student.save();
    console.log(`Assigned ${adjustedAmount} ₿ to ${student.email}`);
  
      const notification = await Notification.create({
          user: student._id,
          actionBy: req.user._id,
          type: 'wallet_topup',                                     //creating a notification for assigning balance
          message: `You were ${amount >= 0 ? 'credited' : 'debited'} ${Math.abs(amount)} ₿.`,
          read: false,
          classroom: classroomId, 
          createdAt: new Date(),
        });
    console.log('notification created:', notification._id);
        const populatedNotification = await populateNotification(notification._id);
        if (!populatedNotification) {
  console.warn('populateNotification failed or returned null');
}
          req.app.get('io').to(`user-${student._id}`).emit('notification', populatedNotification); 
      
    req.app.get('io').to(`classroom-${classroomId}`).emit('balance_update', {
      studentId: student._id,
      newBalance: student.balance,
      classroomId
    });

    res.status(200).json({ message: 'Balance assigned successfully' });
  } catch (err) {
    console.error('Failed to assign balance:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Bulk assign balances to mulitpler students
router.post('/assign/bulk', ensureAuthenticated, async (req, res) => {
  if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false,
      error: 'Only teachers can bulk-assign' 
    });
  }

  const { classroomId, updates } = req.body;
  const customDescription = req.body.description;

  const roleLabel = req.user.role === 'admin' ? 'Admin/TA' : 'Teacher';
  const userName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;
  const attribution = `Adjustment by ${roleLabel} (${userName})`;

  const description = customDescription
    ? `${customDescription} (${attribution})`
    : attribution;

  if (!classroomId) {
    return res.status(400).json({
      success: false,
      error: 'classroomId is required'
    });
  }

  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Updates array is required and must not be empty'
    });
  }

  try {

    // Admin/TA policy check
    if (req.user.role === 'admin') {
      const gate = await canTAAssignBits({ taUser: req.user, classroomId });
      if (!gate.ok) {
        if (gate.requiresApproval) {
          const classroom = await Classroom.findById(classroomId).populate('teacher');
          for (const upd of updates) {
            await PendingAssignment.create({
              classroom: classroomId,
              student: upd.studentId,
              amount: Number(upd.amount),
              description,
              requestedBy: req.user._id,
            });
          }
          // Notify teacher of bulk request
          const notification = await Notification.create({
            user: classroom.teacher._id,
            type: 'bit_assignment_request',
            message: `Admin/TA ${req.user.firstName || req.user.email} requested a bit balance assignment/adjustment for ${updates.length} student(s).`,
            classroom: classroomId,
            actionBy: req.user._id,
          });
          const populated = await populateNotification(notification._id);
          req.app.get('io').to(`user-${classroom.teacher._id}`).emit('notification', populated);

          return res
            .status(202)
            .json({ message: 'Requests queued for teacher approval' });
        }
        return res.status(gate.status).json({ error: gate.msg });
      }
    }

    const results = { updated: 0, skipped: [] };

    for (const { studentId, amount } of updates) {
      const numericAmount = Number(amount);
      if (isNaN(numericAmount)) {
        skipped.push({ studentId, reason: 'Amount not numeric' });
        continue;
      }

      const student = await User.findById(studentId);
      if (!student) {
        skipped.push({ studentId, reason: 'Student not found' });
        continue;
      }

      // Get all multipliers
      const groupMultiplier = await getGroupMultiplierForStudentInClassroom(studentId, classroomId);
      const passiveMultiplier = student.passiveAttributes?.multiplier || 1;
      const totalMultiplier = groupMultiplier * passiveMultiplier;

      // Apply multiplier only for positive amounts
      const adjustedAmount = numericAmount >= 0
   ? Math.round(numericAmount * totalMultiplier)
   : numericAmount;

 // never let balance go negative
 student.balance = Math.max(0, student.balance + adjustedAmount);
      student.transactions.push({
        amount: adjustedAmount,
        description,
        assignedBy: req.user._id,
        createdAt: new Date(),
        classroom: classroomId || null,
        calculation: numericAmount >= 0 ? {
          baseAmount: numericAmount,
          personalMultiplier: passiveMultiplier,
          groupMultiplier: groupMultiplier,
          totalMultiplier: totalMultiplier,
        } : undefined,
      });

      await student.save();
      results.updated += 1; 
      const notification = await Notification.create({
          user: student._id,
          actionBy: req.user._id,
          type: 'wallet_topup',                                     //creating a notification for assigning balance
          message: `You were ${amount >= 0 ? 'credited' : 'debited'} ${Math.abs(amount)} ₿.`,
          read: false,
          classroom: classroomId, 
          createdAt: new Date(),
        });
    console.log('notification created:', notification._id);
        const populatedNotification = await populateNotification(notification._id);
          req.app.get('io').to(`user-${student._id}`).emit('notification', populatedNotification); 

    }
  
    res.json({
      message: `Bulk balance assignment complete (${results.updated} updated, ${results.skipped.length} skipped)`,
      ...results,
    });
  } catch (err) {
    console.error('Bulk assign failed:', err);
    res.status(500).json({ 
      success: false,
      error: err.message,
      details: process.env.NODE_ENV === 'development' ? {
        message: err.message,
        stack: err.stack
      } : null
    });
  }
});

// Student's own transactions (allow classroom scoping)
router.get('/transactions', ensureAuthenticated, async (req, res) => {
  try {
    const { classroomId } = req.query;
    const user = await User.findById(req.user._id).select('transactions');
    if (!user) return res.status(404).json({ error: 'User not found' });

    let txs = user.transactions || [];
    if (classroomId) {
      txs = txs.filter(t => t.classroom && String(t.classroom) === String(classroomId));
    }
    txs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.status(200).json(txs);
  } catch (err) {
    console.error('Failed to fetch transactions:', err.message);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

const label = (u) =>
  (u.firstName || u.lastName)
    ? `${u.firstName || ''} ${u.lastName || ''}`.trim()
    : u.email;

// Wallet Transfer (include classroomId, store on tx records)
router.post(
  '/transfer',
  ensureAuthenticated,
  blockIfFrozen,
  async (req, res) => {
    const senderLive = await User.findById(req.user._id).select('isFrozen');
    if (senderLive.isFrozen) {
      return res.status(403).json({ error: 'Your account is frozen during a siphon request' });
    }
    const { recipientShortId: recipientId, amount, classroomId } = req.body;

    const numericAmount = Number(amount);
    if (!Number.isInteger(numericAmount) || numericAmount < 1) {
      return res.status(400).json({ error: 'Amount must be a positive integer' });
    }

    // Load sender and recipient
    const sender = await User.findById(req.user._id);
    const recipient = await User.findOne({ shortId: recipientId });

    if (!recipient) return res.status(404).json({ error: 'Recipient not found' });
    if (String(sender._id) === String(recipient._id)) {
      return res.status(400).json({ error: 'Cannot transfer to yourself' });
    }
    if ((sender.balance || 0) < numericAmount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Apply recipient multiplier (passive)
    const recipientMultiplier = recipient.passiveAttributes?.multiplier || 1;
    const adjustedAmount = Math.round(numericAmount * recipientMultiplier);

    sender.balance -= numericAmount;
    recipient.balance += adjustedAmount;

    sender.transactions.push({ 
      amount: -numericAmount, 
      description: `Transferred to ${label(recipient)}`,
      classroom: classroomId || null,
      createdAt: new Date()
    });
    recipient.transactions.push({ 
      amount: adjustedAmount,  
      description: `Received from ${label(sender)}`,
      assignedBy: sender._id,
      classroom: classroomId || null,
      createdAt: new Date()
    });

    await sender.save();
    await recipient.save();

    return res.json({ message: 'Transfer complete' });
  }
);

// Will get the user balance
router.get('/:userId/balance', ensureAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('balance');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ balance: user.balance });
  } catch (err) {
    console.error('Balance lookup failed:', err);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

module.exports = router;