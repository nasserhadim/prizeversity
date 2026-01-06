const mongoose = require('mongoose');

const TemplateStepSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, default: '', maxlength: 2000 },
  templateType: { type: String, default: 'passcode' },
  templateConfig: { type: mongoose.Schema.Types.Mixed, default: {} },
  solution: { type: String, default: '', maxlength: 500 },
  bits: { type: Number, default: 0, min: 0 },
  multiplier: { type: Number, default: 1.0, min: 0 },
  luck: { type: Number, default: 1.0, min: 1 },
  discount: { type: Number, default: 0, min: 0, max: 100 },
  shield: { type: Boolean, default: false },
  maxAttempts: { type: Number, default: null },
  hintsEnabled: { type: Boolean, default: false },
  hints: [{ type: String, maxlength: 500 }],
  hintPenaltyPercent: { type: Number, default: null, min: 0, max: 100 },
  isRequired: { type: Boolean, default: true }
}, { _id: false });

const CustomChallengeTemplateItemSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, default: '', maxlength: 2000 },
  externalUrl: { type: String, default: '' },
  solution: { type: String, default: '', maxlength: 500 },
  templateType: { type: String, default: 'passcode' },
  templateConfig: { type: mongoose.Schema.Types.Mixed, default: {} },
  maxAttempts: { type: Number, default: null },
  hintsEnabled: { type: Boolean, default: false },
  hints: [{ type: String, maxlength: 500 }],
  hintPenaltyPercent: { type: Number, default: null, min: 0, max: 100 },
  bits: { type: Number, default: 50, min: 0 },
  multiplier: { type: Number, default: 1.0, min: 0 },
  luck: { type: Number, default: 1.0, min: 1 },
  discount: { type: Number, default: 0, min: 0, max: 100 },
  shield: { type: Boolean, default: false },
  visible: { type: Boolean, default: true },
  dueDateEnabled: { type: Boolean, default: false },
  isMultiStep: { type: Boolean, default: false },
  steps: [TemplateStepSchema],
  completionBonus: { type: Number, default: 0, min: 0 }
}, { _id: false });

const CustomChallengeTemplateSchema = new mongoose.Schema({
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
  sourceClassroom: {
    classroomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' },
    name: { type: String },
    code: { type: String }
  },
  challenges: [CustomChallengeTemplateItemSchema],
  isSingleChallenge: { type: Boolean, default: false }
}, {
  timestamps: true,
  minimize: false
});

CustomChallengeTemplateSchema.index({ teacherId: 1 });
CustomChallengeTemplateSchema.index({ teacherId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('CustomChallengeTemplate', CustomChallengeTemplateSchema);

