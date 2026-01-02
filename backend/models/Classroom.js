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
  // Per-classroom Admin/TAs (scoped to this classroom)
  admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
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

  // NEW: controls whether classroom-scoped Admin/TAs can manage groups (add/edit/delete/moderate/siphon)
  taGroupPolicy: {
    type: String,
    enum: ['full', 'none'],
    default: 'none',
  },

  // NEW: controls whether classroom-scoped Admin/TAs can moderate feedback
  taFeedbackPolicy: {
    type: String,
    enum: ['full', 'none'],
    default: 'none',
  },

  siphonTimeoutHours: {
    type: Number,
    default: 72,
    min: 1,
    max: 168 // Max 1 week
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

  createdAt: { type: Date, default: Date.now },
  xpSettings: {
    enabled: { 
      type: Boolean, 
      default: true 
    },
    // XP gain rates (recommended defaults)
    bitsEarned: { 
      type: Number, 
      default: 1, // 1 XP per bit earned
      min: 0
    },
    bitsSpent: { 
      type: Number, 
      default: 0.5, // 0.5 XP per bit spent
      min: 0
    },
    statIncrease: { 
      type: Number, 
      default: 10, // 10 XP per stat increase
      min: 0
    },
    dailyCheckIn: { 
      type: Number, 
      default: 5, // 5 XP per daily check-in
      min: 0
    },
    challengeCompletion: { 
      type: Number, 
      default: 20, // 20 XP per challenge completed
      min: 0
    },
    mysteryBox: { 
      type: Number, 
      default: 3, // 3 XP per mystery box use
      min: 0
    },
    groupJoin: { 
      type: Number, 
      default: 15, // 15 XP for joining a group (one-time)
      min: 0
    },
    // NEW: XP awarded for submitting classroom feedback (teacher config)
    feedbackSubmission: {
      type: Number,
      default: 0,
      min: 0
    },
    // Leveling formula: 'linear', 'exponential', 'logarithmic'
    levelingFormula: { 
      type: String, 
      enum: ['linear', 'exponential', 'logarithmic'],
      default: 'exponential'
    },
    // Base XP required for level 2
    baseXPForLevel2: { 
      type: Number, 
      default: 100,
      min: 10
    },

    // NEW: basis used for XP-per-bit calculation ('final' includes multipliers; 'base' ignores them)
    bitsXPBasis: {
      type: String,
      enum: ['final', 'base'],
      default: 'final'
    }
  }
});

module.exports = mongoose.model('Classroom', ClassroomSchema);