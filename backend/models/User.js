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
  avatar: {type: String, default: 'placeholder.jpg'},
  firstName: { type: String},
  lastName: { type: String},
  role: { type: String, enum: ['admin', 'teacher', 'student']/*, default: 'student' */},
  balance: { type: Number, default: 0 },
  isFrozen: { type: Boolean, default: false },
  classrooms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' }],
  groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
  transactions: [TransactionSchema],
  isBanned: { type: Boolean, default: false},
  shieldActive: {type: Boolean, default: false},
  doubleEarnings: { type: Boolean, default: false },
  discountShop: { type: Boolean, default: false },
  attackPower: { type: Number, default: 0 }
});

module.exports = mongoose.model('User', UserSchema);