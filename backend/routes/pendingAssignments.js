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

  // Ensuring the requester is the teacher of the classroom
  const classroom = await Classroom.findById(classroomId);
  if (!classroom || classroom.teacher.toString() !== req.user._id.toString()) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Find all pending assignments for the classroom, and populating the student/'requestBy' info
  const list = await PendingAssignment.find({ classroom: classroomId, status: 'pending' })
    .populate('student','firstName lastName email')
    .populate('requestedBy','email');
  res.json(list);
});


// A PATCH ROUTE to approve a pending assignment
router.patch('/:id/approve', ensureAuthenticated, async (req, res) => {
  const pa = await PendingAssignment.findById(req.params.id).populate('student', 'firstName lastName email');
  if (!pa) return res.status(404).json({ error: 'Not found' });

  // Will ensure the requester is the teacher of the classroom
  const classroom = await Classroom.findById(pa.classroom);
  if (classroom.teacher.toString() !== req.user._id.toString()) {
    return res.status(403).json({ error: 'Forbidden' });
  }


  // Update the student's balance and add a transaction
  const User = require('../models/User');
  const student = await User.findById(pa.student);
  student.balance += pa.amount;
  student.transactions.push({
    amount: pa.amount,
    description: pa.description,
    assignedBy: pa.requestedBy
  });
  await student.save();

  // Mark the pending asignment as approved
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
