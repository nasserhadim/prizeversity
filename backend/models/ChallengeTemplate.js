const mongoose = require('mongoose');

const ChallengeTemplateSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 100
  },
  teacherId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  settings: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    default: {}
  },
  title: {
    type: String,
    default: 'Cyber Challenge Series'
  }
}, {
  timestamps: true,
  minimize: false
});

ChallengeTemplateSchema.index({ teacherId: 1 });
ChallengeTemplateSchema.index({ teacherId: 1, name: 1 }, { unique: true });

ChallengeTemplateSchema.pre('save', function(next) {
  if (!this.settings.challengeBits) {
    this.settings.challengeBits = [50, 75, 100, 125];
  }
  if (!this.settings.challengeMultipliers) {
    this.settings.challengeMultipliers = [1.0, 1.0, 1.0, 1.0];
  }
  if (!this.settings.challengeLuck) {
    this.settings.challengeLuck = [0, 0, 0, 0];
  }
  if (!this.settings.challengeDiscounts) {
    this.settings.challengeDiscounts = [0, 0, 0, 0];
  }
  if (!this.settings.rewardMode) {
    this.settings.rewardMode = 'individual';
  }
  if (!this.settings.multiplierMode) {
    this.settings.multiplierMode = 'individual';
  }
  if (!this.settings.luckMode) {
    this.settings.luckMode = 'individual';
  }
  if (!this.settings.discountMode) {
    this.settings.discountMode = 'individual';
  }
  next();
});

module.exports = mongoose.model('ChallengeTemplate', ChallengeTemplateSchema);