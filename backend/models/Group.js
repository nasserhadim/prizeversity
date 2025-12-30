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
  
  if (!groupSet || groupSet.groupMultiplierIncrement === undefined) {
    return this.groupMultiplier || 1;
  }

  const approvedMemberCount = this.members.filter(m => m.status === 'approved').length;
  const raw = 1 + (approvedMemberCount * groupSet.groupMultiplierIncrement);
  // Round to 3 decimal places to avoid FP artifacts (adjust precision as needed)
  const rounded = Math.round(raw * 1000) / 1000;
  return rounded;
};

// Update multiplier when members change (only if auto mode is enabled)
GroupSchema.methods.updateMultiplier = async function() {
  const GroupSet = require('./GroupSet');
  const groupSet = await GroupSet.findOne({ groups: this._id });

  if (groupSet && groupSet.groupMultiplierIncrement !== undefined && this.isAutoMultiplier) {
    const approvedMemberCount = this.members.filter(m => m.status === 'approved').length;
    const raw = groupSet.groupMultiplierIncrement === 0
      ? 1
      : 1 + (approvedMemberCount * groupSet.groupMultiplierIncrement);
    this.groupMultiplier = Math.round(raw * 1000) / 1000;
    return this.save();
  }
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
  // CHANGED: do not mutate user.passiveAttributes.groupMultiplier (global / cross-classroom)
  this.members.push({ _id: userId });
  await this.save();
};

module.exports = mongoose.models.Group || mongoose.model('Group', GroupSchema);