const mongoose = require('mongoose');

const ClassroomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { 
    type: String, 
    required: true, 
    minlength: 5,
    maxlength: 6,
    unique: true
  },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  bazaars: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Bazaar' }],
  groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
  // Students who are banned from this classroom (kept separate so they cannot rejoin)
  bannedStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // Optional ban metadata so frontend can display reason + timestamp without breaking existing code
  bannedRecords: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String, default: '' },
    bannedAt: { type: Date, default: Date.now }
  }],
  color: { type: String, default: '#ffffff' },
  // filename/path for an optional background image
  backgroundImage: { type: String, default: '' },
  archived: { type: Boolean, default: false },
  taBitPolicy: {
    type: String,
    enum: ['full', 'approval', 'none'],
    default: 'full',
  },
  siphonTimeoutHours: {
    type: Number,
    default: 72,
    min: 1,
    max: 168 // Max 1 week
  },

  xpConfig: {
    dailyLogin: { type: Number, default: 10 },
    groupJoin: { type: Number, default: 25 },
  },



  //leveling system settings and xp 
  //below powers the leveing system UI in classroom settings 
  xpSettings: {
    isXPEnabled: { type: Boolean, default: true },
    xpFormulaType: {
      type: String,
      enum: ['linear', 'exponential', 'logarithmic'],
      default: 'exponential'
    },
    baseXPLevel2: { type: Number, default: 100 },
    bitToXpCountMode: { 
      type: String, 
      enum: ['base', 'final'], 
      default: 'final' 
    },
    xpRewards: {
      xpPerBitEarned:    { type: Number, default: 1 },
      xpPerBitSpent:     { type: Number, default: 0.5 }, // purchases only
      xpPerStatsBoost:   { type: Number, default: 10 },
      dailyCheckInXP:    { type: Number, default: 5 },
      dailyCheckInLimit: { type: Number, default: 1 },
      groupJoinXP:       { type: Number, default: 10 },
      challengeXP:       { type: Number, default: 25 },
      mysteryBoxUseXP:   { type: Number, default: 0 }, // 0 = off
       xpPerAttendance:   { type: Number, default: 5 },// used by /xp/attendance
      xpPerChallenge:    { type: Number, default: 10 },// used by /xp/challenge
      xpPerNewsfeedPost: { type: Number, default: 2 }, // used by /xp/newsfeed
      xpPerMysteryOpen:  { type: Number, default: 1 }// used when opening a mystery box
    }
  },

  studentSendEnabled: { type: Boolean, default: false },
  studentsCanViewStats: { type: Boolean, default: true }, // Add this line

  // --- FEEDBACK REWARD CONFIG ---
  // Enable teacher to configure a small bit reward for submitting classroom feedback.
  feedbackRewardEnabled: { type: Boolean, default: false },
  feedbackRewardBits: { type: Number, default: 0, min: 0 },
  feedbackRewardApplyGroupMultipliers: { type: Boolean, default: true },
  feedbackRewardApplyPersonalMultipliers: { type: Boolean, default: true },
  // NEW: whether teacher allows awarding even when student chose "anonymous"
  feedbackRewardAllowAnonymous: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Classroom', ClassroomSchema);