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
    enum: ['Attack', 'Defend', 'Utility', 'Passive', 'MysteryBox'],
    default: 'Utility',
  },
  // Primary effect configuration
  primaryEffect: { 
    type: String,
    required: function() { return this.category !== 'Passive' && this.category !== 'MysteryBox' }
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
      // Mystery boxes can have multiple uses
      if (this.category === 'MysteryBox') {
        return this.mysteryBoxConfig?.maxOpensPerStudent || 1;
      }
      // Most items are single-use
      return 1;
    }
  },
  consumed: { 
    type: Boolean, 
    default: false 
  }, // ADD: Track if item is fully consumed
  active: { type: Boolean, default: false },
  
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  
  // ADD: Mystery Box specific fields
  mysteryBoxConfig: {
    luckMultiplier: { type: Number, default: 1.5 },
    pityEnabled: { type: Boolean, default: false },
    guaranteedItemAfter: { type: Number, default: 10 },
    pityMinimumRarity: { 
      type: String, 
      enum: ['uncommon', 'rare', 'epic', 'legendary'],
      default: 'rare'
    },
    maxOpensPerStudent: { type: Number, default: null },
    itemPool: [{
      item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
      rarity: { 
        type: String, 
        enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
        default: 'common'
      },
      baseDropChance: { type: Number, min: 0, max: 100 }
    }]
  },
});

module.exports = mongoose.model('Item', ItemSchema);