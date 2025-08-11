// Challenge Model
// path: backend/models/Challenge.js
// ---------------
// This file contains the model for the challenge system.
// We use this to store challenge data, user challenges, and stats.
// We also use this to generate random strings and encrypt passwords.

const mongoose = require('mongoose');

function generateRandomString(length = 6) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

function caesarCipher(text, shift = 3) {
  return text.replace(/[A-Z]/g, char => {
    const code = char.charCodeAt(0);
    const shifted = ((code - 65 + shift) % 26) + 65;
    return String.fromCharCode(shifted);
  });
}

const UserChallengeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  uniqueId: { type: String, required: true },
  hashedPassword: { type: String, required: true },
  progress: { type: Number, default: 0, min: 0, max: 2 },
  completedAt: { type: Date },
  bitsAwarded: { type: Number, default: 0 }
}, { _id: true });

const ChallengeSchema = new mongoose.Schema({
  classroomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, default: 'Cyber Challenge Series' },
  description: { type: String, default: 'Complete all challenges to earn maximum bits!' },
  isActive: { type: Boolean, default: false },
  isConfigured: { type: Boolean, default: false },
  
  settings: {
    rewardMode: { type: String, enum: ['individual', 'total'], default: 'individual' },
    challengeBits: [{ type: Number, default: 50, min: 0 }],
    totalRewardBits: { type: Number, default: 125, min: 0 },
    
    multiplierMode: { type: String, enum: ['individual', 'total'], default: 'individual' },
    challengeMultipliers: [{ type: Number, default: 1.0, min: 0 }],
    totalMultiplier: { type: Number, default: 1.0, min: 0 },
    
    luckMode: { type: String, enum: ['individual', 'total'], default: 'individual' },
    challengeLuck: [{ type: Number, default: 0, min: 0 }],
    totalLuck: { type: Number, default: 0, min: 0 },
    
    discountMode: { type: String, enum: ['individual', 'total'], default: 'individual' },
    challengeDiscounts: [{ type: Number, default: 0, min: 0, max: 100 }],
    totalDiscount: { type: Number, default: 0, min: 0, max: 100 },
    
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    timeLimit: { type: Number, default: null },
    allowHints: { type: Boolean, default: true },
    showLeaderboard: { type: Boolean, default: true },
    autoGrading: { type: Boolean, default: true },
    
    maxAttempts: { type: Number, default: null },
    penaltyPerAttempt: { type: Number, default: 0 },
    bonusForSpeed: { type: Boolean, default: false },
    teamMode: { type: Boolean, default: false }
  },
  
  userChallenges: [UserChallengeSchema],
  
  stats: {
    totalParticipants: { type: Number, default: 0 },
    completedChallenges: { type: Number, default: 0 },
    averageProgress: { type: Number, default: 0 },
    totalBitsAwarded: { type: Number, default: 0 }
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  activatedAt: { type: Date },
  deactivatedAt: { type: Date }
});

ChallengeSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  if (this.isActive && !this.activatedAt) {
    this.activatedAt = Date.now();
  }
  
  if (!this.isActive && this.activatedAt && !this.deactivatedAt) {
    this.deactivatedAt = Date.now();
  }
  
  if (!this.settings.challengeBits || this.settings.challengeBits.length === 0) {
    this.settings.challengeBits = [
      this.settings.challenge1Bits || 50,
      this.settings.challenge2Bits || 75
    ];
  }
  
  if (!this.settings.challengeMultipliers || this.settings.challengeMultipliers.length === 0) {
    this.settings.challengeMultipliers = [
      this.settings.challenge1Multiplier || 1.0,
      this.settings.challenge2Multiplier || 1.0
    ];
  }
  
  if (!this.settings.challengeLuck || this.settings.challengeLuck.length === 0) {
    this.settings.challengeLuck = [
      this.settings.challenge1Luck || 0,
      this.settings.challenge2Luck || 0
    ];
  }
  
  if (!this.settings.challengeDiscounts || this.settings.challengeDiscounts.length === 0) {
    this.settings.challengeDiscounts = [
      this.settings.challenge1Discount || 0,
      this.settings.challenge2Discount || 0
    ];
  }
  
  const totalChallenges = this.settings.challengeBits?.length || 2;
  
  this.stats.totalParticipants = this.userChallenges.length;
  this.stats.completedChallenges = this.userChallenges.filter(uc => uc.progress >= 2).length;
  this.stats.averageProgress = this.userChallenges.length > 0 
    ? this.userChallenges.reduce((sum, uc) => sum + uc.progress, 0) / this.userChallenges.length 
    : 0;
  this.stats.totalBitsAwarded = this.userChallenges.reduce((sum, uc) => sum + uc.bitsAwarded, 0);
  
  next();
});

ChallengeSchema.methods.generateUserChallenge = function(userId) {
  const plaintext = generateRandomString(6);
  const encryptedId = caesarCipher(plaintext, 3);
  
  return {
    userId: userId,
    uniqueId: encryptedId,
    hashedPassword: plaintext,
    progress: 0,
    bitsAwarded: 0
  };
};

ChallengeSchema.methods.calculateTotalBits = function() {
  if (this.settings.rewardMode === 'total') {
    return this.settings.totalRewardBits || 125;
  }
  
  if (!this.settings.challengeBits || this.settings.challengeBits.length === 0) {
    return 125;
  }
  
  return this.settings.challengeBits.reduce((sum, bits) => sum + (bits || 0), 0);
};

ChallengeSchema.methods.getBitsForChallenge = function(challengeLevel) {
  if (this.settings.rewardMode === 'total') {
    // In total mode, only award bits when completing the final challenge
    const totalChallenges = this.settings.challengeBits?.length || 2;
    return challengeLevel === totalChallenges ? (this.settings.totalRewardBits || 125) : 0;
  }
  
  // Individual mode - award bits for each challenge
  if (!this.settings.challengeBits || challengeLevel < 1 || challengeLevel > this.settings.challengeBits.length) {
    return 0;
  }
  
  return this.settings.challengeBits[challengeLevel - 1] || 0;
};

ChallengeSchema.methods.addChallenge = function(bits = 50, multiplier = 1.0, luck = 0, discount = 0) {
  if (!this.settings.challengeBits) this.settings.challengeBits = [];
  if (!this.settings.challengeMultipliers) this.settings.challengeMultipliers = [];
  if (!this.settings.challengeLuck) this.settings.challengeLuck = [];
  if (!this.settings.challengeDiscounts) this.settings.challengeDiscounts = [];
  
  this.settings.challengeBits.push(bits);
  this.settings.challengeMultipliers.push(multiplier);
  this.settings.challengeLuck.push(luck);
  this.settings.challengeDiscounts.push(discount);
  
  return this.settings.challengeBits.length; // Return new challenge count
};

ChallengeSchema.methods.getTotalChallenges = function() {
  return this.settings.challengeBits?.length || 2;
};

ChallengeSchema.index({ classroomId: 1 }, { unique: true });
ChallengeSchema.index({ createdBy: 1 });
ChallengeSchema.index({ isActive: 1 });

module.exports = mongoose.model('Challenge', ChallengeSchema);