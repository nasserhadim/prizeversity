const mongoose = require('mongoose');

const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  members: [{
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    joinDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'approved'], default: 'approved' } // Removed 'rejected'
  }],
  maxMembers: { type: Number, default: null },
  image: { type: String, default: 'placeholder.jpg' },
  groupMultiplier: {type: Number, default: 1},
  isAutoMultiplier: { type: Boolean, default: true },
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

// Calculate multiplier based on approved members and groupset increment
GroupSchema.methods.calculateMultiplier = async function() {
  const GroupSet = require('./GroupSet');
  const groupSet = await GroupSet.findOne({ groups: this._id });
  
  // If no groupset or no increment setting, return current multiplier
  if (!groupSet || !groupSet.groupMultiplierIncrement) {
    return this.groupMultiplier || 1;
  }
  
  const approvedMemberCount = this.members.filter(m => m.status === 'approved').length;
  return 1 + (approvedMemberCount * groupSet.groupMultiplierIncrement);
};

// Update multiplier when members change (only if auto mode is enabled)
GroupSchema.methods.updateMultiplier = async function() {
  const GroupSet = require('./GroupSet');
  const groupSet = await GroupSet.findOne({ groups: this._id });
  
  // Only auto-update if groupset has multiplier increment AND auto mode is enabled
  if (groupSet && groupSet.groupMultiplierIncrement !== undefined && this.isAutoMultiplier) {
    const approvedMemberCount = this.members.filter(m => m.status === 'approved').length;
    // If increment is 0, multiplier stays at 1
    const newMultiplier = groupSet.groupMultiplierIncrement === 0 
      ? 1 
      : 1 + (approvedMemberCount * groupSet.groupMultiplierIncrement);
    this.groupMultiplier = newMultiplier;
    return this.save();
  }
  
  // If manual mode, don't change the multiplier
  return this;
};

// Manual multiplier setting (overrides auto calculation)
GroupSchema.methods.setManualMultiplier = async function(multiplier) {
  this.groupMultiplier = multiplier;
  this.isAutoMultiplier = false;
  return this.save();
};

// When applying group multipliers:
GroupSchema.methods.applyMultiplier = function(amount) {
  return amount * this.groupMultiplier;
};

// When a user joins a group:
GroupSchema.methods.addMember = async function(userId) {
  const User = require('./User');
  const user = await User.findById(userId);
  this.members.push({ _id: userId });
  await this.save();
  
  // Update user's group multipliers
  if (!user.passiveAttributes) {
    user.passiveAttributes = { luck: 1, multiplier: 1, groupMultiplier: 1 };
  }
  user.passiveAttributes.groupMultiplier = Math.max(
    user.passiveAttributes.groupMultiplier || 1,
    this.groupMultiplier || 1
  );
  await user.save();
};

module.exports = mongoose.models.Group || mongoose.model('Group', GroupSchema);