const mongoose = require('mongoose');

const ModerationLogSchema = new mongoose.Schema({
  feedback: { type: mongoose.Schema.Types.ObjectId, ref: 'Feedback', required: true },
  action: { type: String, enum: ['hide', 'unhide', 'report'], required: true },
  moderator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // who hid/unhid or reported (optional)
  reporterEmail: { type: String }, // for anonymous/manual reports
  reason: { type: String, default: '' },
  classroom: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.ModerationLog || mongoose.model('ModerationLog', ModerationLogSchema);