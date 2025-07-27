const mongoose = require('mongoose');

// Pending Assignment Document will store the assignment for each user per classroom

const PendingAssignmentSchema = new mongoose.Schema({
  classroom:    { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
  student:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount:       { type: Number, required: true },
  description:  { type: String, default: 'Pending Admin/TA assignment' },
  requestedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // the Admin/TA
  status:       { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
  respondedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // the teacher
  respondedAt:  { type: Date },
  createdAt:    { type: Date, default: Date.now }
});

module.exports = mongoose.model('PendingAssignment', PendingAssignmentSchema);
