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
  progress: { type: Number, default: 0, min: 0, max: 4 },
  completedAt: { type: Date },
    bitsAwarded: { type: Number, default: 0 },
  hintsUsed: { type: [Number], default: [] },
  hintsUnlocked: { type: [[String]], default: [] },

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
    totalRewardBits: { type: Number, default: 350, min: 0 },
    
    multiplierMode: { type: String, enum: ['individual', 'total'], default: 'individual' },
    challengeMultipliers: [{ type: Number, default: 1.0, min: 0 }],
    totalMultiplier: { type: Number, default: 1.0, min: 0 },
    
    luckMode: { type: String, enum: ['individual', 'total'], default: 'individual' },
    challengeLuck: [{ type: Number, default: 1.0, min: 0 }],
    totalLuck: { type: Number, default: 1.0, min: 0 },
    
    discountMode: { type: String, enum: ['individual', 'total'], default: 'individual' },
    challengeDiscounts: [{ type: Number, default: 0, min: 0, max: 100 }],
    totalDiscount: { type: Number, default: 0, min: 0, max: 100 },
    
    shieldMode: { type: String, enum: ['individual', 'total'], default: 'individual' },
    challengeShields: [{ type: Boolean, default: false }],
    totalShield: { type: Boolean, default: false },
    
    
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    timeLimit: { type: Number, default: null },
    allowHints: { type: Boolean, default: true },
    showLeaderboard: { type: Boolean, default: true },
    autoGrading: { type: Boolean, default: true },
    
    challengeHintsEnabled: [{ type: Boolean, default: false }],
    challengeHints: [{ type: [String], default: [] }],
    hintPenaltyPercent: { type: Number, default: 25, min: 0, max: 100 },
    maxHintsPerChallenge: { type: Number, default: 2, min: 0, max: 10 },
    
    dueDateEnabled: { type: Boolean, default: false },
    dueDate: { type: Date, default: null },

    
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

// Helper method to check if challenge is expired
ChallengeSchema.methods.isExpired = function() {
  if (!this.settings.dueDateEnabled || !this.settings.dueDate) {
    return false;
  }
  return new Date() > new Date(this.settings.dueDate);
};

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
      this.settings.challenge2Bits || 75,
      this.settings.challenge3Bits || 100,
      this.settings.challenge4Bits || 125
    ];
  }
  
  if (!this.settings.challengeMultipliers || this.settings.challengeMultipliers.length === 0) {
    this.settings.challengeMultipliers = [
      this.settings.challenge1Multiplier || 1.0,
      this.settings.challenge2Multiplier || 1.0,
      this.settings.challenge3Multiplier || 1.0,
      this.settings.challenge4Multiplier || 1.0
    ];
  }
  
  if (!this.settings.challengeLuck || this.settings.challengeLuck.length === 0) {
    this.settings.challengeLuck = [
      this.settings.challenge1Luck || 1.0,
      this.settings.challenge2Luck || 1.0,
      this.settings.challenge3Luck || 1.0,
      this.settings.challenge4Luck || 1.0
    ];
  }
  
  if (!this.settings.challengeDiscounts || this.settings.challengeDiscounts.length === 0) {
    this.settings.challengeDiscounts = [
      this.settings.challenge1Discount || 0,
      this.settings.challenge2Discount || 0,
      this.settings.challenge3Discount || 0,
      this.settings.challenge4Discount || 0
    ];
  }
  
  if (!this.settings.challengeShields || this.settings.challengeShields.length === 0) {
    this.settings.challengeShields = [
      this.settings.challenge1Shield || false,
      this.settings.challenge2Shield || false,
      this.settings.challenge3Shield || false,
      this.settings.challenge4Shield || false
    ];
  }
  
  if (!this.settings.challengeAttackBonuses || this.settings.challengeAttackBonuses.length === 0) {
    this.settings.challengeAttackBonuses = [
      this.settings.challenge1AttackBonus || 0,
      this.settings.challenge2AttackBonus || 0,
      this.settings.challenge3AttackBonus || 0,
      this.settings.challenge4AttackBonus || 0
    ];
  }
  
  if (!this.settings.challengeHintsEnabled || this.settings.challengeHintsEnabled.length === 0) {
    this.settings.challengeHintsEnabled = [
      false,
      false,
      false,
      false
    ];
  }
  
  const totalChallenges = this.settings.challengeBits?.length || 4;
  
  this.stats.totalParticipants = this.userChallenges.length;
  this.stats.completedChallenges = this.userChallenges.filter(uc => uc.progress >= totalChallenges).length;
  this.stats.averageProgress = this.userChallenges.length > 0 
    ? this.userChallenges.reduce((sum, uc) => sum + uc.progress, 0) / this.userChallenges.length 
    : 0;
  this.stats.totalBitsAwarded = this.userChallenges.reduce((sum, uc) => sum + uc.bitsAwarded, 0);
  
  next();
});

ChallengeSchema.methods.generateUserChallenge = function(userId) {
  const plaintext = generateRandomString(6);
  const crypto = require('crypto');
  const CAESAR_BASE = parseInt(process.env.CAESAR_BASE || '3');
  const CAESAR_RANGE = parseInt(process.env.CAESAR_RANGE || '6');
  const CAESAR_SALT = process.env.CAESAR_SALT || 'default_salt_2024';
  const hash = crypto.createHash('md5').update(plaintext + CAESAR_SALT).digest('hex');
  const shift = (parseInt(hash.substring(0, 2), 16) % CAESAR_RANGE) + CAESAR_BASE;
  const encryptedId = caesarCipher(plaintext, shift);
  const totalChallenges = this.settings?.challengeBits?.length || 4;
  
  return {
    userId: userId,
    uniqueId: encryptedId,
    hashedPassword: plaintext,
    progress: 0,
    bitsAwarded: 0,
    hintsUsed: Array(totalChallenges).fill(0),
    hintsUnlocked: Array.from({ length: totalChallenges }, () => [])
  };
};

ChallengeSchema.methods.calculateTotalBits = function() {
  if (this.settings.rewardMode === 'total') {
    return this.settings.totalRewardBits || 350;
  }
  
  if (!this.settings.challengeBits || this.settings.challengeBits.length === 0) {
    return 350;
  }
  
  return this.settings.challengeBits.reduce((sum, bits) => sum + (bits || 0), 0);
};

ChallengeSchema.methods.getBitsForChallenge = function(challengeLevel) {
  if (this.settings.rewardMode === 'total') {
    const totalChallenges = this.settings.challengeBits?.length || 4;
    return challengeLevel === totalChallenges ? (this.settings.totalRewardBits || 350) : 0;
  }
  
  if (!this.settings.challengeBits || challengeLevel < 1 || challengeLevel > this.settings.challengeBits.length) {
    return 0;
  }
  
  return this.settings.challengeBits[challengeLevel - 1] || 0;
};

ChallengeSchema.methods.addChallenge = function(bits = 50, multiplier = 1.0, luck = 1.0, discount = 0, shield = false, attackBonus = 0, hintsEnabled = false) {
  if (!this.settings.challengeBits) this.settings.challengeBits = [];
  if (!this.settings.challengeMultipliers) this.settings.challengeMultipliers = [];
  if (!this.settings.challengeLuck) this.settings.challengeLuck = [];
  if (!this.settings.challengeDiscounts) this.settings.challengeDiscounts = [];
  if (!this.settings.challengeShields) this.settings.challengeShields = [];
  if (!this.settings.challengeAttackBonuses) this.settings.challengeAttackBonuses = [];
  if (!this.settings.challengeHintsEnabled) this.settings.challengeHintsEnabled = [];
  
  this.settings.challengeBits.push(bits);
  this.settings.challengeMultipliers.push(multiplier);
  this.settings.challengeLuck.push(luck);
  this.settings.challengeDiscounts.push(discount);
  this.settings.challengeShields.push(shield);
  this.settings.challengeAttackBonuses.push(attackBonus);
  this.settings.challengeHintsEnabled.push(hintsEnabled);
  
  return this.settings.challengeBits.length; 
};

ChallengeSchema.methods.getTotalChallenges = function() {
  return this.settings.challengeBits?.length || 4;
};

ChallengeSchema.index({ classroomId: 1 }, { unique: true });
ChallengeSchema.index({ createdBy: 1 });
ChallengeSchema.index({ isActive: 1 });

module.exports = mongoose.model('Challenge', ChallengeSchema);