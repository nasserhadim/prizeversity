const express = require('express');
const { ensureAuthenticated } = require('../config/auth');
const User = require('../models/User');
const Group = require('../models/Group');
const GroupSet = require('../models/GroupSet');
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

    //  Manually look up groups this student is in
    const groups = await Group.find({
      'members._id': studentId,
      'members.status': 'approved'
    }).select('groupMultiplier');

    //  Get the highest multiplier
    let multiplier = 1;
    if (groups.length > 0 && numericAmount >= 0) {
      multiplier = Math.max(...groups.map(g => g.groupMultiplier || 1));
    }

    const adjustedAmount = numericAmount >= 0 
      ? Math.round(numericAmount * multiplier)
      : numericAmount;

    student.balance += adjustedAmount;
    student.transactions.push({
      amount: adjustedAmount,
      description: description || `Balance adjustment`,
      assignedBy: req.user._id,
    });

    await student.save();

    console.log('Student saved successfully with multiplier:', multiplier);
    res.status(200).json({ message: 'Balance assigned successfully' });
  } catch (err) {
    console.error('Failed to assign balance:', err.message);
    res.status(500).json({ error: err.message });
  }
});



router.post('/assign/bulk', ensureAuthenticated, async (req, res) => {
  // Validate user role
  if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false,
      error: 'Only teachers can bulk-assign' 
    });
  }

<<<<<<< Updated upstream
const { classroomId, updates, description = 'Bulk adjustment by teacher' } = req.body;

  if (!classroomId) {
    return res.status(400).json({ error: 'classroomId is required' });
 }
=======
  const { updates, description, classroomId } = req.body;
>>>>>>> Stashed changes

  // Validate request body
  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ 
      success: false,
      error: 'Updates array is required and must not be empty',
      details: {
        received: updates,
        expected: 'Array of { studentId: string, amount: number }'
      }
    });
  }

  if (!classroomId) {
    return res.status(400).json({ 
      success: false,
      error: 'classroomId is required',
      details: 'Please provide the classroom context for group multiplier calculation'
    });
  }

  try {
<<<<<<< Updated upstream
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
=======
    // Get all groups in the classroom with their multipliers
    const groupSets = await GroupSet.find({ classroom: classroomId })
      .populate({
        path: 'groups',
        select: 'groupMultiplier members name'
>>>>>>> Stashed changes
      });

    const allGroups = groupSets.flatMap(gs => gs.groups);
    const results = { 
      updated: 0, 
      skipped: [],
      details: []
    };

    // Process each update
    for (const update of updates) {
      const { studentId, amount } = update;
      const studentResult = {
        studentId,
        success: false,
        error: null,
        details: null
      };

      // Validate studentId
      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        studentResult.error = 'Invalid student ID format';
        results.skipped.push(studentId);
        results.details.push(studentResult);
        continue;
      }

      // Validate amount
      const numericAmount = Number(amount);
      if (isNaN(numericAmount)) {
        studentResult.error = 'Amount must be a number';
        results.skipped.push(studentId);
        results.details.push(studentResult);
        continue;
      }

      // Find student
      const student = await User.findById(studentId);
      if (!student) {
        studentResult.error = 'Student not found';
        results.skipped.push(studentId);
        results.details.push(studentResult);
        continue;
      }

      // Find all approved groups for this student
      const studentGroups = allGroups.filter(group => 
        group.members.some(m => 
          m._id.equals(studentId) && m.status === 'approved'
        )
      );

      // Calculate total group multiplier (sum of all group multipliers)
      let totalGroupMultiplier = 1;
      if (studentGroups.length > 0 && numericAmount > 0) {
        totalGroupMultiplier = studentGroups.reduce(
          (sum, group) => sum + (group.groupMultiplier || 1), 
          0
        );
      }

      // Calculate adjusted amount
      const adjustedAmount = numericAmount > 0
        ? Math.round(numericAmount * totalGroupMultiplier * (student.passiveAttributes?.multiplier || 1))
        : numericAmount;

      // Prepare transaction data
      const transaction = {
        amount: adjustedAmount,
        description: description || `Bulk assignment by ${req.user.email}`,
        assignedBy: req.user._id,
        classroom: classroomId,
        multipliersApplied: numericAmount > 0 ? {
          baseAmount: numericAmount,
          group: totalGroupMultiplier,
          personal: student.passiveAttributes?.multiplier || 1,
          total: totalGroupMultiplier * (student.passiveAttributes?.multiplier || 1)
        } : null
      };

      // Update student
      await User.findByIdAndUpdate(studentId, {
        $inc: { balance: adjustedAmount },
        $push: { transactions: transaction }
      });

      studentResult.success = true;
      studentResult.details = {
        newBalance: student.balance + adjustedAmount,
        adjustedAmount,
        groupMultipliers: studentGroups.map(g => ({
          groupId: g._id,
          groupName: g.name,
          multiplier: g.groupMultiplier
        })),
        totalGroupMultiplier
      };

      results.updated++;
      results.details.push(studentResult);
    }

    res.json({
      success: true,
      message: `Processed ${updates.length} students`,
      ...results
    });

  } catch (err) {
    console.error('Bulk assign failed:', err);
    res.status(500).json({ 
      success: false,
      error: 'Server error during bulk assignment',
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

    // Get sender and recipient with their multipliers
    const sender = await User.findById(req.user._id);
    let recipient = mongoose.isValidObjectId(recipientId)
      ? await User.findById(recipientId)
      : await User.findOne({ shortId: recipientId.toUpperCase() });

    if (!recipient) return res.status(404).json({ error: 'Recipient not found' });
<<<<<<< Updated upstream
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
=======
    if (sender.balance < numericAmount) return res.status(400).json({ error: 'Insufficient balance' });
>>>>>>> Stashed changes

    // Apply recipient's multiplier to the received amount
    const recipientMultiplier = recipient.passiveAttributes?.multiplier || 1;
    const adjustedAmount = Math.round(numericAmount * recipientMultiplier);

<<<<<<< Updated upstream
    sender.transactions.push({ amount: -amount, description: `Transferred to ${label(recipient)}`
});
    recipient.transactions.push({ amount,  description: `Received from ${label(sender)}`});
=======
    sender.balance -= numericAmount;
    recipient.balance += adjustedAmount;

    sender.transactions.push({ 
      amount: -numericAmount, 
      description: `Transferred to ${recipient.email}` 
    });
    recipient.transactions.push({ 
      amount: adjustedAmount, 
      description: `Received from ${sender.email}`,
      assignedBy: sender._id
    });
>>>>>>> Stashed changes

    await sender.save();
    await recipient.save();

    res.status(200).json({ message: 'Transfer successful' });
  }
);

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