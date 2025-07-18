const express = require('express');
const { ensureAuthenticated } = require('../config/auth');
const User = require('../models/User');
const router = express.Router();
const mongoose = require('mongoose');
const blockIfFrozen = require('../middleware/blockIfFrozen');
const PendingAssignment = require('../models/PendingAssignment');


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
          studentName:  (u.firstName || u.lastName)
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

if (req.user.role === 'admin') {
      const gate = await canTAAssignBits({ taUser: req.user, classroomId });
      if (!gate.ok) {
        if (gate.requiresApproval) {
      for (const upd of updates) {
        await PendingAssignment.create({
          classroom:   classroomId,
          student:     upd.studentId,
          amount:      upd.amount,
          description,
          requestedBy: req.user._id,
        });
      }
      return res
        .status(202)
        .json({ message: 'All requests queued for teacher approval' });
        }
        return res.status(gate.status).json({ error: gate.msg });
      }
    }
   else if (req.user.role !== 'teacher') {

    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const student = await User.findById(studentId);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const numericAmount = Number(amount);
    if (isNaN(numericAmount)) {
      return res.status(400).json({ error: 'Amount must be a number' });
    }

    student.balance += numericAmount;
    student.transactions.push({
      amount: numericAmount,
      description,
      assignedBy: req.user._id,
    });

    try {
      await student.save();
      console.log('Student saved successfully');
    } catch (saveErr) {
      console.error('Failed to save student:', saveErr);
    }

    res.status(200).json({ message: 'Balance assigned successfully' });
  } catch (err) {
    console.error('Failed to assign balance:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/assign/bulk', ensureAuthenticated, async (req, res) => {
  if (!['teacher', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only teachers or admins can bulk‑assign' });
  }

const { classroomId, updates, description = 'Bulk adjustment by teacher' } = req.body;

  if (!classroomId) {
    return res.status(400).json({ error: 'classroomId is required' });
 }

  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ error: 'No updates supplied' });
  }

  try {
    // ───────────────────────────────────────────────────── TA policy gate
    if (req.user.role === 'admin') {
      const gate = await canTAAssignBits({ taUser: req.user, classroomId });

      if (!gate.ok) {
        
        if (gate.requiresApproval) {
          for (const upd of updates) {
            await PendingAssignment.create({
              classroom:   classroomId,
              student:     upd.studentId,
              amount:      Number(upd.amount),
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
    let updated = 0;
    const skipped = [];

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

      student.balance += numericAmount;
      student.transactions.push({
        amount: numericAmount,
        description,
        assignedBy: req.user._id,
      });

      await student.save();
      updated += 1;
    }

    res.json({
      message: `Bulk assignment complete (${updated} updated, ${skipped.length} skipped)`,
      updated,
      skipped,
    });
  } catch (err) {
    console.error('Bulk assign failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// View Wallet Transactions
router.get('/transactions', ensureAuthenticated, async (req, res) => {
  try {
    // const user = await User.findById(req.user._id).populate('transactions');
    const user = await User.findById(req.user._id);
    res.status(200).json(user.transactions);
  } catch (err) {
    console.error('Failed to fetch transactions:', err.message);
    res.status(500).json({ error: 'Failed to fetch transactions' });
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

  
  const sender = await User.findById(req.user._id);
  if (!sender) {
    return res.status(404).json({ error: 'Sender not found' });
  }
  if (sender.balance < numericAmount) {
    return res.status(400).json({ error: 'Insufficient bits to complete transfer' });
  }

  // Check it's a valid number and not negative or zero
  if (
    typeof amount !== 'number' ||
    isNaN(amount) ||
    amount < 1
  ) {
    return res.status(400).json({ error: 'Transfer amount must be at least 1 bit' });
  }

  try {
    const sender = await User.findById(req.user._id);
    let recipient = mongoose.isValidObjectId(recipientId)
    ? await User.findById(recipientId)
    : null;

  if (!recipient) {
    recipient = await User.findOne({ shortId: recipientId.toUpperCase() });
  }

    if (!recipient) return res.status(404).json({ error: 'Recipient not found' });
    if (sender.balance < amount) return res.status(400).json({ error: 'Insufficient balance' });
/* student transfer toggle  */
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
      error:
        'Peer‑to‑peer transfers are disabled by your teacher in at least one of your shared classrooms.',
    });
  }
}
/* ═════════════════════════════════════════════════════ */

    sender.balance -= amount;
    recipient.balance += amount;

    sender.transactions.push({ amount: -amount, description: `Transferred to ${label(recipient)}`
});
    recipient.transactions.push({ amount,  description: `Received from ${label(sender)}`});

    await sender.save();
    await recipient.save();

    res.status(200).json({ message: 'Transfer successful' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to transfer balance' });
  }
});

router.get('/:userId/balance', ensureAuthenticated, async (req, res) => {
  try {
    const User = require('../models/User');
    
    const user = await User.findById(req.params.userId).select('balance');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ balance: user.balance });
  } catch (err) {
    console.error('Balance lookup failed:', err);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

module.exports = router;