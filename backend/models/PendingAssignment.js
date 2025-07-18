const mongoose = require('mongoose');

const PendingAssignmentSchema = new mongoose.Schema({
  classroom:    { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
  student:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount:       { type: Number, required: true },
  description:  { type: String, default: 'Pending TA assignment' },
  requestedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // the TA
  status:       { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
  respondedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // the teacher
  respondedAt:  { type: Date },
  createdAt:    { type: Date, default: Date.now }
});

module.exports = mongoose.model('PendingAssignment', PendingAssignmentSchema);
