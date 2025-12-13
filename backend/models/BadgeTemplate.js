const mongoose = require('mongoose');

const TemplateBadgeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  levelRequired: { type: Number, required: true, min: 2 },
  icon: { type: String, default: '🏅' },
  image: { type: String, default: '' },
  unlockedBazaarItems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item' }]
}, { _id: false });

const BadgeTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sourceClassroom: {
    classroomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' },
    name: { type: String },
    code: { type: String }
  },
  badges: [TemplateBadgeSchema]
}, { timestamps: true });

BadgeTemplateSchema.index({ teacherId: 1 });
BadgeTemplateSchema.index({ teacherId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('BadgeTemplate', BadgeTemplateSchema);