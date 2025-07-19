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

// When applying group multipliers:
GroupSchema.methods.applyMultiplier = function(amount) {
  return amount * this.groupMultiplier;
};

// When a user joins a group:
GroupSchema.methods.addMember = async function(userId) {
  const user = await User.findById(userId);
  this.members.push({ _id: userId });
  await this.save();
  
  // Update user's group multipliers
  user.passiveAttributes.groupMultiplier = Math.max(
    user.passiveAttributes.groupMultiplier || 1,
    this.groupMultiplier || 1
  );
  await user.save();
};

module.exports = mongoose.models.Group || mongoose.model('Group', GroupSchema);