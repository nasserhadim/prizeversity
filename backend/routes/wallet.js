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

{
  // Add top-level helper so all handlers can call it
  function isBannedInClassroom(classroomDoc, studentId) {
    if (!classroomDoc) return false;
    const bannedIds = Array.isArray(classroomDoc.bannedStudents)
      ? classroomDoc.bannedStudents.map(b => String(b._id || b))
      : [];
    const banLog = Array.isArray(classroomDoc.banLog)
      ? classroomDoc.banLog
      : (Array.isArray(classroomDoc.bannedRecords) ? classroomDoc.bannedRecords : []);
    const isLegacy = bannedIds.includes(String(studentId));
    const isLog = Array.isArray(banLog) && banLog.some(br => String(br.user?._id || br.user) === String(studentId));
    return isLegacy || isLog;
  };
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

// Helper function to get or initialize per-classroom balance
const getClassroomBalance = (user, classroomId) => {
  const classroomBalance = user.classroomBalances.find(cb => cb.classroom.toString() === classroomId.toString());
  return classroomBalance ? classroomBalance.balance : 0;
};

// Helper function to update per-classroom balance
const updateClassroomBalance = (user, classroomId, newBalance) => {
  const index = user.classroomBalances.findIndex(cb => cb.classroom.toString() === classroomId.toString());
  if (index >= 0) {
    user.classroomBalances[index].balance = Math.max(0, newBalance); // Prevent negative balances
  } else {
    user.classroomBalances.push({ classroom: classroomId, balance: Math.max(0, newBalance) });
  }
};

// Assign Balance to Student (updated for per-classroom)
router.post('/assign', ensureAuthenticated, async (req, res) => {
  const { classroomId, studentId, amount, description, applyGroupMultipliers = true, applyPersonalMultipliers = true } = req.body; // Add separate parameters

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

    // Apply multipliers separately
    let finalMultiplier = 1;
    if (groups.length > 0 && numericAmount >= 0) {
      if (applyGroupMultipliers) {
        finalMultiplier *= Math.max(...groups.map(g => g.groupMultiplier || 1));
      }
      if (applyPersonalMultipliers) {
        finalMultiplier *= (student.passiveAttributes?.multiplier || 1);
      }
    }

    // Use per-classroom balance if classroomId is provided
    if (classroomId) {
      const currentBalance = getClassroomBalance(student, classroomId);
      const adjustedAmount = (numericAmount >= 0 && (applyGroupMultipliers || applyPersonalMultipliers)) 
        ? Math.round(numericAmount * finalMultiplier) 
        : numericAmount;
      const newBalance = Math.max(0, currentBalance + adjustedAmount);
      updateClassroomBalance(student, classroomId, newBalance);

      student.transactions.push({
        amount: adjustedAmount,
        description: description || `Balance adjustment`,
        assignedBy: req.user._id,
        classroom: classroomId,
        calculation: (numericAmount >= 0 && (applyGroupMultipliers || applyPersonalMultipliers)) ? {
          baseAmount: numericAmount,
          personalMultiplier: applyPersonalMultipliers ? (student.passiveAttributes?.multiplier || 1) : 1,
          groupMultiplier: applyGroupMultipliers ? Math.max(...groups.map(g => g.groupMultiplier || 1)) : 1,
          totalMultiplier: finalMultiplier,
        } : {
          baseAmount: numericAmount,
          personalMultiplier: 1,
          groupMultiplier: 1,
          totalMultiplier: 1,
          note: getMultiplierNote(applyGroupMultipliers, applyPersonalMultipliers)
        },
      });
    } else {
      // Fallback to global balance
      student.balance = Math.max(0, student.balance + numericAmount);
      student.transactions.push({
        amount: numericAmount,
        description: description || `Balance adjustment`,
        assignedBy: req.user._id,
        calculation: numericAmount >= 0 ? {
          baseAmount: numericAmount,
          personalMultiplier: 1, // Note: This route doesn't use personal multiplier
          groupMultiplier: finalMultiplier,
          totalMultiplier: finalMultiplier,
        } : undefined,
      });
    }

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

    // AFTER saving student(s) and creating notification(s), emit per-classroom update and return per-class balance
const perClassBalance = classroomId ? getClassroomBalance(student, classroomId) : (student.balance || 0);
req.app.get('io').to(`classroom-${classroomId}`).emit('balance_update', {
  studentId: student._id,
  newBalance: perClassBalance,
  classroomId
});

res.status(200).json({
  message: 'Balance assigned successfully',
  balance: perClassBalance
});
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

  const { classroomId, updates, applyGroupMultipliers = true, applyPersonalMultipliers = true } = req.body; // Add separate parameters
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

    // resolve classroom once
    const classroom = classroomId ? await Classroom.findById(classroomId).select('bannedStudents banLog bannedRecords') : null;

    const results = { updated: 0, skipped: [] };
    for (const { studentId, amount } of updates) {
      const numericAmount = Number(amount);
      if (isNaN(numericAmount)) {
        skipped.push({ studentId, reason: 'Amount not numeric' });
        continue;
      }

      // Check ban before doing anything
      if (classroom && isBannedInClassroom(classroom, studentId)) {
        results.skipped.push({ studentId, reason: 'Banned in classroom' });
        continue;
      }

      const student = await User.findById(studentId);
      if (!student) {
        results.skipped.push({ studentId, reason: 'Student not found' });
        continue;
      }

      // Ensure transactions array exists before push
      if (!Array.isArray(student.transactions)) student.transactions = [];

      // Get all multipliers
      const groupMultiplier = await getGroupMultiplierForStudentInClassroom(studentId, classroomId);
      const passiveMultiplier = student.passiveAttributes?.multiplier || 1;
      
      // Apply multipliers separately based on flags
      let finalMultiplier = 1;
      if (numericAmount >= 0) {
        if (applyGroupMultipliers) {
          finalMultiplier *= groupMultiplier;
        }
        if (applyPersonalMultipliers) {
          finalMultiplier *= passiveMultiplier;
        }
      }

      const adjustedAmount = (numericAmount >= 0 && (applyGroupMultipliers || applyPersonalMultipliers))
        ? Math.round(numericAmount * finalMultiplier)
        : numericAmount;

      // Update per-classroom balance when classroomId provided; otherwise fallback to global balance
      if (classroomId) {
        const current = getClassroomBalance(student, classroomId);
        const newBalance = Math.max(0, current + adjustedAmount);
        updateClassroomBalance(student, classroomId, newBalance);
      } else {
        // fallback: global balance (legacy)
        student.balance = Math.max(0, (student.balance || 0) + adjustedAmount);
      }
      student.transactions.push({
        amount: adjustedAmount,
        description,
        assignedBy: req.user._id,
        createdAt: new Date(),
        classroom: classroomId || null,
        calculation: (numericAmount >= 0 && (applyGroupMultipliers || applyPersonalMultipliers)) ? {
          baseAmount: numericAmount,
          personalMultiplier: applyPersonalMultipliers ? passiveMultiplier : 1,
          groupMultiplier: applyGroupMultipliers ? groupMultiplier : 1,
          totalMultiplier: finalMultiplier,
        } : {
          baseAmount: numericAmount,
          personalMultiplier: 1,
          groupMultiplier: 1,
          totalMultiplier: 1,
          note: getMultiplierNote(applyGroupMultipliers, applyPersonalMultipliers)
        },
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
    // Populate assignedBy on each transaction so student exports/display have assigner info (firstName/lastName/email/role)
    const user = await User.findById(req.user._id)
      .select('transactions')
      .populate({ path: 'transactions.assignedBy', select: 'firstName lastName email role' });
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
    // Determine classroom context from body/query
    const classroomId = req.body?.classroomId || req.query?.classroomId || null;
    const senderLive = await User.findById(req.user._id).select('classroomFrozen').lean();
    const frozenHere = classroomId
      ? Array.isArray(senderLive?.classroomFrozen) && senderLive.classroomFrozen.some(cf => String(cf.classroom) === String(classroomId))
      : Array.isArray(senderLive?.classroomFrozen) && senderLive.classroomFrozen.length > 0;
    if (frozenHere) {
      return res.status(403).json({ error: 'Your account is frozen during a siphon request' });
    }

    const { recipientShortId: recipientId, amount, message } = req.body; // classroomId is derived earlier in this scope

    // Prevent student transfers if disabled by teacher
    if (req.user.role === 'student' && classroomId) {
      const classroom = await Classroom.findById(classroomId).select('studentSendEnabled');
      if (classroom && !classroom.studentSendEnabled) {
        return res.status(403).json({ error: 'Student-to-student transfers are currently disabled by the teacher.' });
      }
    }

    const numericAmount = Number(amount);
    if (!Number.isInteger(numericAmount) || numericAmount < 1) {
      return res.status(400).json({ error: 'Amount must be a positive integer' });
    }

    // Ensure adjustedAmount is defined for later use (direct transfers use the raw amount)
    const adjustedAmount = numericAmount;
    
    // Load sender and recipient
    const sender = await User.findById(req.user._id);
    const recipient = await User.findOne({ shortId: recipientId });

    if (!recipient) return res.status(404).json({ error: 'Recipient not found' });
    if (String(sender._id) === String(recipient._id)) {
      return res.status(400).json({ error: 'Cannot transfer to yourself' });
    }

    // --- NEW: block transfers to banned students in the classroom ---
    if (classroomId) {
      const classroom = await Classroom.findById(classroomId).select('bannedStudents banLog bannedRecords').lean();
      // `isBannedInClassroom` helper is defined earlier in this file
      if (classroom && isBannedInClassroom(classroom, recipient._id)) {
        return res.status(403).json({ error: 'Cannot transfer bits to a student who is banned from this classroom' });
      }
    }
    // --- end new code ---

    // Update balances (use inside the transfer/assign handler where numericAmount/adjustedAmount/classroomId are available)
    const senderBalance = classroomId ? getClassroomBalance(sender, classroomId) : (sender.balance || 0);
    if (senderBalance < numericAmount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    if (classroomId) {
      updateClassroomBalance(sender, classroomId, Math.max(0, senderBalance - numericAmount));
      const recipientBalance = getClassroomBalance(recipient, classroomId);
      updateClassroomBalance(recipient, classroomId, recipientBalance + adjustedAmount);
    } else {
      sender.balance = (sender.balance || 0) - numericAmount;
      recipient.balance = (recipient.balance || 0) + adjustedAmount;
    }

    // Create custom descriptions based on whether a message was provided
    const baseDescription = message ? 
      `Transfer: ${message}` : 
      `Transferred to ${label(recipient)}`;
    
    const senderDescription = message ?
      `Sent to ${label(recipient)}: ${message}` :
      `Transferred to ${label(recipient)}`;
    
    const recipientDescription = message ?
      `Received from ${label(sender)}: ${message}` :
      `Received from ${label(sender)}`;

    // Add transactions (keep classroom reference)
    sender.transactions.push({
      amount: -numericAmount,
      description: senderDescription,
      assignedBy: sender._id,
      classroom: classroomId || null,
      createdAt: new Date()
    });
    recipient.transactions.push({
      amount: adjustedAmount,
      description: recipientDescription,
      assignedBy: sender._id,
      classroom: classroomId || null,
      createdAt: new Date()
    });

    await sender.save();
    await recipient.save();

    // --- Added: human readable notification messages for both parties ---
    // Resolve classroom name for message context (if classroomId provided)
    let classroomName = '';
    if (classroomId) {
      const Classroom = require('../models/Classroom');
      // include the classroom code so messages show "Class Name (CODE)"
      const classroom = await Classroom.findById(classroomId).select('name code');
      if (classroom) classroomName = ` in "${classroom.name}${classroom.code ? ` (${classroom.code})` : ''}"`;
    }
    
    // Update notification messages to include custom message if provided
    const senderNotificationMessage = message ?
      `You sent ${numericAmount} ₿ to ${label(recipient)} with message: "${message}".` :
      `You sent ${numericAmount} ₿ to ${label(recipient)}.`;
    
    const recipientNotificationMessage = message ?
      `You received ${adjustedAmount} ₿ from ${label(sender)} with message: "${message}".` :
      `You received ${adjustedAmount} ₿ from ${label(sender)}.`;
    
    const senderNotification = await Notification.create({
      user: sender._id,
      actionBy: sender._id,
      type: 'wallet_transaction',
      message: senderNotificationMessage,
      classroom: classroomId,
      createdAt: new Date()
    });
    const populatedSenderNotification = await populateNotification(senderNotification._id);
    req.app.get('io').to(`user-${sender._id}`).emit('notification', populatedSenderNotification);
    
    const recipientNotification = await Notification.create({
      user: recipient._id,
      actionBy: sender._id,
      type: 'wallet_transaction',
      message: recipientNotificationMessage,
      classroom: classroomId,
      createdAt: new Date()
    });
    const populatedRecipientNotification = await populateNotification(recipientNotification._id);
    req.app.get('io').to(`user-${recipient._id}`).emit('notification', populatedRecipientNotification);
    // --- end added block ---
    
    res.status(200).json({ message: 'Transfer complete' });
  }
);

// Will get the user balance
router.get('/:userId/balance', ensureAuthenticated, async (req, res) => {
  try {
    const { classroomId } = req.query;
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let balance = user.balance; // Default to global
    if (classroomId) {
      balance = getClassroomBalance(user, classroomId);
    }
    res.json({ balance });
  } catch (err) {
    console.error('Balance lookup failed:', err);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

// Helper function to generate appropriate note
function getMultiplierNote(applyGroup, applyPersonal) {
  if (!applyGroup && !applyPersonal) {
    return "All multipliers bypassed by teacher";
  } else if (!applyGroup) {
    return "Group multipliers bypassed by teacher";
  } else if (!applyPersonal) {
    return "Personal multipliers bypassed by teacher";
  }
  return undefined;
}

module.exports = router;