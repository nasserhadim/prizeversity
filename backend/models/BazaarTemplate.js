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
    secondaryEffects: { type: Array, default: [] },
    swapOptions: { type: Array, default: [] },

    // NEW: MysteryBox support (portable via itemName)
    mysteryBoxConfig: {
      luckMultiplier: { type: Number },
      pityEnabled: { type: Boolean },
      guaranteedItemAfter: { type: Number },
      pityMinimumRarity: { type: String },
      maxOpensPerStudent: { type: Number, default: null },
      itemPool: [{
        itemName: { type: String, required: true }, // portable reference
        rarity: { type: String, default: 'common' },
        baseDropChance: { type: Number, default: 0 }
      }]
    }
  }]
}, {
  timestamps: true
});

BazaarTemplateSchema.index({ teacherId: 1 });
BazaarTemplateSchema.index({ teacherId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('BazaarTemplate', BazaarTemplateSchema);