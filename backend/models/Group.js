const mongoose = require('mongoose');

const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  members: [{
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    joinDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' }
  }],
  maxMembers: { type: Number, default: null },
  image: { type: String, default: 'placeholder.jpg' },
  groupMultiplier: {type: Number, default: 1},
  createdAt: { type: Date, default: Date.now }
});

GroupSchema.virtual('siphonRequests', {
  ref: 'SiphonRequest',
  localField: '_id',
  foreignField: 'group',
  options: { 
    match: { status: { $in: ['pending','group_approved'] } }
  }
});


GroupSchema.set('toJSON', { virtuals: true });
GroupSchema.set('toObject', { virtuals: true });

module.exports = mongoose.models.Group || mongoose.model('Group', GroupSchema);