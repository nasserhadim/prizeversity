const express = require('express');
const router = express.Router();
const PendingAssignment = require('../models/PendingAssignment');
const Classroom = require('../models/Classroom');
const { ensureAuthenticated } = require('../config/auth');


router.get('/:classroomId', ensureAuthenticated, async (req, res) => {
  const { classroomId } = req.params;
  const classroom = await Classroom.findById(classroomId);
  if (!classroom || classroom.teacher.toString() !== req.user._id.toString()) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const list = await PendingAssignment.find({ classroom: classroomId, status: 'pending' })
    .populate('student','firstName lastName email')
    .populate('requestedBy','email');
  res.json(list);
});

router.patch('/:id/approve', ensureAuthenticated, async (req, res) => {
  const pa = await PendingAssignment.findById(req.params.id);
  if (!pa) return res.status(404).json({ error: 'Not found' });

  const classroom = await Classroom.findById(pa.classroom);
  if (classroom.teacher.toString() !== req.user._id.toString()) {
    return res.status(403).json({ error: 'Forbidden' });
  }


  const User = require('../models/User');
  const student = await User.findById(pa.student);
  student.balance += pa.amount;
  student.transactions.push({
    amount: pa.amount,
    description: pa.description,
    assignedBy: pa.requestedBy
  });
  await student.save();

  pa.status = 'approved';
  pa.respondedBy = req.user._id;
  pa.respondedAt = new Date();
  await pa.save();

  res.json({ message: 'Approved and applied' });
});

router.patch('/:id/reject', ensureAuthenticated, async (req, res) => {
  const pa = await PendingAssignment.findById(req.params.id);
  if (!pa) return res.status(404).json({ error: 'Not found' });

  const classroom = await Classroom.findById(pa.classroom);
  if (classroom.teacher.toString() !== req.user._id.toString()) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  pa.status = 'rejected';
  pa.respondedBy = req.user._id;
  pa.respondedAt = new Date();
  await pa.save();

  res.json({ message: 'Rejected' });
});

module.exports = router;
