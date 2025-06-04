const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  description: { type: String, required: true },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

const UserSchema = new mongoose.Schema({
  googleId: { type: String },
  microsoftId: { type: String },
  email: { type: String, required: true },
  role: { type: String, enum: ['admin', 'teacher', 'student']/*, default: 'student' */},
  balance: { type: Number, default: 0 },
  classrooms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' }],
  groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
  transactions: [TransactionSchema],
  isBanned: { type: Boolean, default: false}
});

module.exports = mongoose.model('User', UserSchema);