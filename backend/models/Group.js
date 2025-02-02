const mongoose = require('mongoose');

const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  members: [{
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    joinDate: { type: Date, default: Date.now }
  }],
  maxMembers: { type: Number, default: null },
  image: { type: String, default: 'placeholder.jpg' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Group || mongoose.model('Group', GroupSchema);