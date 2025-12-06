const mongoose = require('mongoose');

const BazaarTemplateSchema = new mongoose.Schema({
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
  // NEW: Store classroom info for reference
  sourceClassroom: {
    classroomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' },
    name: { type: String },
    code: { type: String }
  },
  bazaarData: {
    name: { type: String, required: true },
    description: { type: String },
    image: { type: String }
  },
  items: [{
    name: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    image: { type: String },
    category: { type: String },
    primaryEffect: { type: String },
    primaryEffectValue: { type: Number },
    secondaryEffects: [{ type: mongoose.Schema.Types.Mixed }],
    swapOptions: [{ type: mongoose.Schema.Types.Mixed }]
  }]
}, {
  timestamps: true
});

BazaarTemplateSchema.index({ teacherId: 1 });
BazaarTemplateSchema.index({ teacherId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('BazaarTemplate', BazaarTemplateSchema);