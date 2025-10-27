const mongoose = require('mongoose');

// ItemSchema is the document where all the information of the items created per bazaar is stored.

const ItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  image: { type: String, default: 'placeholder.jpg' },
  bazaar: { type: mongoose.Schema.Types.ObjectId, ref: 'Bazaar', required: true },
  category: {
    type: String,
    enum: ['Attack', 'Defend', 'Utility', 'Passive'],
    default: 'Utility',
  },
  // Primary effect configuration
  primaryEffect: { 
    type: String,
    required: function() { return this.category !== 'Passive' }
  },
  primaryEffectValue: { type: Number },
  
  // Secondary effects configuration
  secondaryEffects: [{
    effectType: String,
    value: Number
  }],
  
  // Usage tracking
  usesRemaining: { 
    type: Number, 
    default: function() {
      return this.category === 'Defend' ? 1 : undefined;
    }
  },
  duration: {type: Number, default: 0, min: 0, max: 8760 },
  active: { type: Boolean, default: false },
  
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});
ItemSchema.index({ bazaar: 1, category: 1 });

module.exports = mongoose.model('Item', ItemSchema);