const express = require('express');
const router = express.Router();
const PendingAssignment = require('../models/PendingAssignment');
const Classroom = require('../models/Classroom');
const { ensureAuthenticated } = require('../config/auth');
const Notification = require('../models/Notification');
const { populateNotification } = require('../utils/notifications');


// Will get all pending assignments for a classroom (only teachers)
router.get('/:classroomId', ensureAuthenticated, async (req, res) => {
  const { classroomId } = req.params;

  const classroom = await Classroom.findById(classroomId);
  if (!classroom || classroom.teacher.toString() !== req.user._id.toString()) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const list = await PendingAssignment.find({ classroom: classroomId, status: 'pending' })
    .populate('student', 'firstName lastName email')
    // CHANGED: include more requestor info for UI
    .populate('requestedBy', 'firstName lastName email');

  res.json(list);
});


// A PATCH ROUTE to approve a pending assignment
router.patch('/:id/approve', ensureAuthenticated, async (req, res) => {
  const pa = await PendingAssignment.findById(req.params.id)
    .populate('student', 'firstName lastName email')
    .populate('requestedBy', 'firstName lastName email role'); // ADD: populate requestedBy for attribution
  if (!pa) return res.status(404).json({ error: 'Not found' });

  // Will ensure the requester is the teacher of the classroom
  const classroom = await Classroom.findById(pa.classroom);
  if (classroom.teacher.toString() !== req.user._id.toString()) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Update the student's balance and add a transaction
  const User = require('../models/User');
  // FIXED: Include shortId in select, or remove select entirely
  const student = await User.findById(pa.student);

  // Use per-classroom balance when approving pending assignment
  const current = Array.isArray(student.classroomBalances)
    ? (student.classroomBalances.find(cb => String(cb.classroom) === String(pa.classroom))?.balance || 0)
    : 0;
  const newBalance = Math.max(0, current + pa.amount);

  // update per-classroom balance
  if (!Array.isArray(student.classroomBalances)) student.classroomBalances = [];
  const idx = student.classroomBalances.findIndex(cb => String(cb.classroom) === String(pa.classroom));
  if (idx >= 0) {
    student.classroomBalances[idx].balance = newBalance;
  } else {
    student.classroomBalances.push({ classroom: pa.classroom, balance: newBalance });
  }

  // CHANGED: create detailed transaction matching direct adjustment format
  const taName = `${pa.requestedBy.firstName || ''} ${pa.requestedBy.lastName || ''}`.trim() || pa.requestedBy.email;
  const baseDesc = (pa.description && String(pa.description).trim()) 
    ? String(pa.description).trim() 
    : 'Balance adjustment';
  
  // Extract custom description if it was stored with attribution
  // (handle both "desc by Admin/TA (name)" and plain "desc" formats)
  const descParts = baseDesc.match(/^(.+?)\s+by\s+Admin\/TA\s+\(.+?\)$/i);
  const customPart = descParts ? descParts[1] : baseDesc;

  student.transactions.push({
    amount: pa.amount,
    description: `${customPart} by Admin/TA (${taName})`,
    assignedBy: req.user._id, // teacher who approved
    classroom: pa.classroom,
    createdAt: new Date(),
    // ADD: calculation object for consistency (multipliers were not applied during approval flow)
    calculation: pa.amount >= 0 ? {
      baseAmount: pa.amount,
      personalMultiplier: 1,
      groupMultiplier: 1,
      totalMultiplier: 1,
      note: 'Admin/TA adjustment (approved by teacher)'
    } : undefined
  });

  await student.save();

  // Mark the pending assignment as approved
  pa.status = 'approved';
  pa.respondedBy = req.user._id;
  pa.respondedAt = new Date();
  await pa.save();

  // Notify the TA who made the request
  const studentName = `${pa.student.firstName || ''} ${pa.student.lastName || ''}`.trim() || pa.student.email;
  const notification = await Notification.create({
    user: pa.requestedBy,
    type: 'bit_assignment_approved',
    message: `Your request to assign ${pa.amount}Ƀ to ${studentName} was approved.`,
    classroom: pa.classroom,
    actionBy: req.user._id,
  });
  const populated = await populateNotification(notification._id);
  req.app.get('io').to(`user-${pa.requestedBy}`).emit('notification', populated);

  res.json({ message: 'Approved and applied' });
});

// PATCH route to reject a pending assignment
router.patch('/:id/reject', ensureAuthenticated, async (req, res) => {
  const { reason } = req.body;
  const pa = await PendingAssignment.findById(req.params.id).populate('student', 'firstName lastName email');
  if (!pa) return res.status(404).json({ error: 'Not found' });

  // Ensure the requester is the teacher of the classroom
  const classroom = await Classroom.findById(pa.classroom);
  if (classroom.teacher.toString() !== req.user._id.toString()) {
    return res.status(403).json({ error: 'Forbidden' });
  }


  // Mark the pending assignment as rejected
  pa.status = 'rejected';
  pa.respondedBy = req.user._id;
  pa.respondedAt = new Date();
  await pa.save();

  // Notify the TA who made the request
  const studentName = `${pa.student.firstName || ''} ${pa.student.lastName || ''}`.trim() || pa.student.email;
  const notification = await Notification.create({
    user: pa.requestedBy,
    type: 'bit_assignment_rejected',
    message: `Your request to assign ${pa.amount}Ƀ to ${studentName} was rejected.` + (reason ? ` Reason: ${reason}` : ''),
    classroom: pa.classroom,
    actionBy: req.user._id,
  });
  const populated = await populateNotification(notification._id);
  req.app.get('io').to(`user-${pa.requestedBy}`).emit('notification', populated);

  res.json({ message: 'Rejected' });
});

module.exports = router;
