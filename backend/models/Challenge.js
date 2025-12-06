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
  challenge2Password: { type: String }, 
  challenge3Code: { type: String },
  challenge3ExpectedOutput: { type: String },
  challenge3BugDescription: { type: String },
  challenge3StartTime: { type: Date },
  challenge3Attempts: { type: Number, default: 0 },
  challenge3MaxAttempts: { type: Number, default: 5 },
  challenge4Password: { type: String },
  challenge6Attempts: { type: Number, default: 0 },
  challenge7Attempts: { type: Number, default: 0 },
  progress: { type: Number, default: 0, min: 0, max: 7 }, 
  completedAt: { type: Date },
  challengeCompletedAt: { type: [Date], default: [] },
  challengeStartedAt: { type: [Date], default: [] },
  bitsAwarded: { type: Number, default: 0 },
  hintsUsed: { type: [Number], default: [] },
  hintsUnlocked: { type: [[String]], default: [] },
  startedAt: { type: Date },
  currentChallenge: { type: Number, default: undefined },
  completedChallenges: { type: [Boolean], default: [false, false, false, false, false, false, false] },
  challenge7Progress: {
    revealedWords: { type: [String], default: [] },
    totalWords: { type: Number, default: 0 },
    wordAttempts: { type: Map, of: Number, default: new Map() } 
  },

}, { _id: true });

const ChallengeSchema = new mongoose.Schema({
  classroomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, default: 'Cyber Challenge Series' },
  description: { type: String, default: 'Defy the odds and conquer the challenges!' },
  isActive: { type: Boolean, default: false },
  isConfigured: { type: Boolean, default: false },
  isVisible: { type: Boolean, default: true },
  
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

    // NEW: per-challenge visibility (true = visible to students)
    challengeVisibility: [{ type: Boolean, default: true }],

    dueDateEnabled: { type: Boolean, default: false },
    dueDate: { type: Date, default: null },

    challengeValidation: [{
      challengeIndex: { type: Number, required: true },
      logicType: { type: String, required: true }, 
      metadata: {
        salt: String,
        staticAnswerHash: String,
        algorithmParams: mongoose.Schema.Types.Mixed
      }
    }],
    
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
      this.settings.challenge4Bits || 125,
      this.settings.challenge5Bits || 150,
      this.settings.challenge6Bits || 175
    ];
  }
  
  if (!this.settings.challengeMultipliers || this.settings.challengeMultipliers.length === 0) {
    this.settings.challengeMultipliers = [
      this.settings.challenge1Multiplier || 1.0,
      this.settings.challenge2Multiplier || 1.0,
      this.settings.challenge3Multiplier || 1.0,
      this.settings.challenge4Multiplier || 1.0,
      this.settings.challenge5Multiplier || 1.0,
      this.settings.challenge6Multiplier || 1.0
    ];
  }
  
  if (!this.settings.challengeLuck || this.settings.challengeLuck.length === 0) {
    this.settings.challengeLuck = [
      this.settings.challenge1Luck || 1.0,
      this.settings.challenge2Luck || 1.0,
      this.settings.challenge3Luck || 1.0,
      this.settings.challenge4Luck || 1.0,
      this.settings.challenge5Luck || 1.0,
      this.settings.challenge6Luck || 1.0
    ];
  }
  
  if (!this.settings.challengeDiscounts || this.settings.challengeDiscounts.length === 0) {
    this.settings.challengeDiscounts = [
      this.settings.challenge1Discount || 0,
      this.settings.challenge2Discount || 0,
      this.settings.challenge3Discount || 0,
      this.settings.challenge4Discount || 0,
      this.settings.challenge5Discount || 0,
      this.settings.challenge6Discount || 0
    ];
  }
  
  if (!this.settings.challengeShields || this.settings.challengeShields.length === 0) {
    this.settings.challengeShields = [
      this.settings.challenge1Shield || false,
      this.settings.challenge2Shield || false,
      this.settings.challenge3Shield || false,
      this.settings.challenge4Shield || false,
      this.settings.challenge5Shield || false,
      this.settings.challenge6Shield || false
    ];
  }
  
  if (!this.settings.challengeHintsEnabled || this.settings.challengeHintsEnabled.length === 0) {
    this.settings.challengeHintsEnabled = [
      false,
      false,
      false,
      false,
      false,
      false
    ];
  }
  
  const totalChallenges = this.settings.challengeBits?.length || 7;
  
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
  const totalChallenges = this.settings?.challengeBits?.length || 7;
  
  function generateChallenge2Password(uniqueId) {
    const hash = crypto.createHash('md5').update(uniqueId + 'secret_salt_2024').digest('hex');
    const prefix = ['ACCESS', 'TOKEN', 'KEY', 'SECRET', 'CODE'][parseInt(hash.substring(0, 1), 16) % 5];
    const suffix = hash.substring(8, 14).toUpperCase();
    return `${prefix}_${suffix}`;
  }

  function generateChallenge4Password(userId, uniqueId) {
    const studentHash = crypto.createHash('md5').update(userId.toString() + uniqueId).digest('hex');
    return `FORENSICS_${studentHash.substring(0, 8).toUpperCase()}`;
  }
  
  return {
    userId: userId,
    uniqueId: encryptedId,
    hashedPassword: plaintext,
    challenge2Password: generateChallenge2Password(encryptedId),
    challenge4Password: generateChallenge4Password(userId, encryptedId),
    progress: 0,
    bitsAwarded: 0,
    hintsUsed: Array(totalChallenges).fill(0),
    hintsUnlocked: Array.from({ length: totalChallenges }, () => [])
  };
};

ChallengeSchema.methods.calculateTotalBits = function() {
  if (this.settings.rewardMode === 'total') {
    return this.settings.totalRewardBits || 600;
  }
  
  if (!this.settings.challengeBits || this.settings.challengeBits.length === 0) {
    return 600;
  }
  
  return this.settings.challengeBits.reduce((sum, bits) => sum + (bits || 0), 0);
};

ChallengeSchema.methods.getBitsForChallenge = function(challengeLevel) {
  if (this.settings.rewardMode === 'total') {
    const totalChallenges = this.settings.challengeBits?.length || 7;
    return challengeLevel === totalChallenges ? (this.settings.totalRewardBits || 350) : 0;
  }
  
  if (!this.settings.challengeBits || challengeLevel < 1 || challengeLevel > this.settings.challengeBits.length) {
    return 0;
  }
  
  return this.settings.challengeBits[challengeLevel - 1] || 0;
};

ChallengeSchema.methods.addChallenge = function(bits = 50, multiplier = 1.0, luck = 1.0, discount = 0, shield = false, hintsEnabled = false) {
  if (!this.settings.challengeBits) this.settings.challengeBits = [];
  if (!this.settings.challengeMultipliers) this.settings.challengeMultipliers = [];
  if (!this.settings.challengeLuck) this.settings.challengeLuck = [];
  if (!this.settings.challengeDiscounts) this.settings.challengeDiscounts = [];
  if (!this.settings.challengeShields) this.settings.challengeShields = [];
  if (!this.settings.challengeHintsEnabled) this.settings.challengeHintsEnabled = [];
  
  this.settings.challengeBits.push(bits);
  this.settings.challengeMultipliers.push(multiplier);
  this.settings.challengeLuck.push(luck);
  this.settings.challengeDiscounts.push(discount);
  this.settings.challengeShields.push(shield);
  this.settings.challengeHintsEnabled.push(hintsEnabled);
  
  return this.settings.challengeBits.length; 
};

ChallengeSchema.methods.getTotalChallenges = function() {
  return this.settings.challengeBits?.length || 7;
};

ChallengeSchema.index({ classroomId: 1 }, { unique: true });
ChallengeSchema.index({ createdBy: 1 });
ChallengeSchema.index({ isActive: 1 });

module.exports = mongoose.model('Challenge', ChallengeSchema);