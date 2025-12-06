const mongoose = require('mongoose');

// Add the field with default 0
const GroupSetSchema = new mongoose.Schema({
  name: { type: String, required: true },
  classroom: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
  selfSignup: { type: Boolean, default: false },
  joinApproval: { type: Boolean, default: false },
  maxMembers: { type: Number, default: null },
  groupMultiplierIncrement: { type: Number, default: 0 }, // Default to 0, not 0.1
  image: { type: String, default: 'placeholder.jpg' },
  groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
  // NEW: one-time XP per GroupSet
  joinXPAwarded: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.GroupSet || mongoose.model('GroupSet', GroupSetSchema);