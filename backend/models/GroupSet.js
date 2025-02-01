const mongoose = require('mongoose');

const GroupSetSchema = new mongoose.Schema({
  name: { type: String, required: true },
  classroom: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
  selfSignup: { type: Boolean, default: false },
  joinApproval: { type: Boolean, default: false },
  maxMembers: { type: Number, default: null },
  image: { type: String, default: 'placeholder.jpg' },
  groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.GroupSet || mongoose.model('GroupSet', GroupSetSchema);