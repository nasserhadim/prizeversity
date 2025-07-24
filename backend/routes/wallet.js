const express = require('express');
const { ensureAuthenticated } = require('../config/auth');
const User = require('../models/User');
const Group = require('../models/Group');
const GroupSet = require('../models/GroupSet');
const router = express.Router();
const mongoose = require('mongoose');
const blockIfFrozen = require('../middleware/blockIfFrozen');
const PendingAssignment = require('../models/PendingAssignment');

// Utility to check if a TA can assign bits based on classroom policy
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
      return { ok: false, status: 403, msg: 'Policy forbids TAs from assigning bits' };
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

// Admin/teacher fetches al user transactions (optionally filtered by studentID)
router.get('/transactions/all', ensureAuthenticated, async (req, res) => {
  if (!['teacher', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const { studentId } = req.query;
    if (studentId && !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ error: 'Bad studentId' });
    }
    
    const criteria = studentId ? { _id: studentId } : {};
    const users = await User
      .find(criteria)
      .select('_id email firstName lastName transactions')
      .lean();
    
    const txs = [];
    users.forEach((u) => {
      u.transactions.forEach((t) => {
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

  // Check TA permission (admin)
  if (req.user.role === 'admin') {
    const gate = await canTAAssignBits({ taUser: req.user, classroomId });
    if (!gate.ok) {
      if (gate.requiresApproval) {
        await PendingAssignment.create({
          classroom: classroomId,
          student: studentId,
          amount: amount,
          description,
          requestedBy: req.user._id,
        });
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
    });

    await student.save();
      const notification = await Notification.create({
          user: student._id,
          actionBy: req.user._id,
          type: 'wallet_topup',                                     //creating a notification for assigning balance
          message: `You have been assigned ${numericAmount} bits.`,
          read: false,
          classroom: classroomId, 
          createdAt: new Date(),
        });
    
        const populatedNotification = await populateNotification(notification._id);
          req.app.get('io').to(`user-${student._id}`).emit('notification', populatedNotification); 
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

  const { classroomId, updates, description = 'Bulk adjustment by teacher' } = req.body;

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

    // TA (admin) policy check
    if (req.user.role === 'admin') {
      const gate = await canTAAssignBits({ taUser: req.user, classroomId });
      if (!gate.ok) {
        if (gate.requiresApproval) {
          for (const upd of updates) {
            await PendingAssignment.create({
              classroom: classroomId,
              student: upd.studentId,
              amount: Number(upd.amount),
              description,
              requestedBy: req.user._id,
            });
          }
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
        createdAt: new Date()
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

// View Wallet Transactions
router.get('/transactions', ensureAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.status(200).json(user.transactions);
  } catch (err) {
    console.error('Failed to fetch transactions:', err.message);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

const label = (u) =>
  (u.firstName || u.lastName)
    ? `${u.firstName || ''} ${u.lastName || ''}`.trim()
    : u.email;

// Wallet Transfer
router.post(
  '/transfer',
  ensureAuthenticated,
  blockIfFrozen,
  async (req, res) => {
    const senderLive = await User.findById(req.user._id).select('isFrozen');
    if (senderLive.isFrozen) {
      return res.status(403).json({ error: 'Your account is frozen during a siphon request' });
    }
    const { recipientId, amount } = req.body;

    const numericAmount = Number(amount);
    if (!Number.isInteger(numericAmount) || numericAmount < 1) {
      return res.status(400).json({ error: 'Amount must be a positive integer' });
    }

    // Get sender and recipient with their multipliers
    const sender = await User.findById(req.user._id);
    let recipient = mongoose.isValidObjectId(recipientId)
      ? await User.findById(recipientId)
      : await User.findOne({ shortId: recipientId.toUpperCase() });

    if (!recipient) return res.status(404).json({ error: 'Recipient not found' });
    if (sender.balance < numericAmount) return res.status(400).json({ error: 'Insufficient balance' });

    // Check student transfer toggle
    if (
      sender.role.toLowerCase() === 'student' &&
      recipient.role.toLowerCase() === 'student'
    ) {
      const Classroom = require('../models/Classroom');
      const blocked = await Classroom.exists({
        archived: false,
        studentSendEnabled: false,
        students: sender._id            
      });
      
      if (blocked) {
        return res.status(403).json({
          error: 'Peer-to-peer transfers are disabled by your teacher in at least one of your shared classrooms.',
        });
      }
    }

    // Apply recipient's multiplier to the received amount
    const recipientMultiplier = recipient.passiveAttributes?.multiplier || 1;
    const adjustedAmount = Math.round(numericAmount * recipientMultiplier);

    sender.balance -= numericAmount;
    recipient.balance += adjustedAmount;

    sender.transactions.push({ 
      amount: -numericAmount, 
      description: `Transferred to ${label(recipient)}`
    });
    recipient.transactions.push({ 
      amount: adjustedAmount,  
      description: `Received from ${label(sender)}`,
      assignedBy: sender._id
    });

    await sender.save();
    await recipient.save();

    res.status(200).json({ message: 'Transfer successful' });
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