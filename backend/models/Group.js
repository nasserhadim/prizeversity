const mongoose = require('mongoose');

const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: { type: String, default: 'placeholder.jpg' },
  maxMembers: { type: Number, required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  classroom: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Group', GroupSchema);