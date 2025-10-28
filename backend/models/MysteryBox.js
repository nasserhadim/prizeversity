const mongoose = require('mongoose');

const MysteryBoxSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  image: { type: String, default: 'mystery-box-placeholder.svg' },
  bazaar: { type: mongoose.Schema.Types.ObjectId, ref: 'Bazaar', required: true },
  
  // Item pool with weighted rarities
  itemPool: [{
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    rarity: { 
      type: String, 
      enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
      default: 'common'
    },
    baseDropChance: { type: Number, required: true, min: 0, max: 100 } // percentage
  }],
  
  // ADD: Toggle to enable/disable pity system
  pityEnabled: { type: Boolean, default: false }, // DEFAULT OFF
  
  // Pity system settings (only used if pityEnabled = true)
  guaranteedItemAfter: { type: Number, default: 10 },
  
  // Minimum rarity tier guaranteed by pity system
  pityMinimumRarity: { 
    type: String, 
    enum: ['uncommon', 'rare', 'epic', 'legendary'],
    default: 'rare' // Default: guarantees at least "rare" tier or better
  },
  
  luckMultiplier: { type: Number, default: 1.5 },
  maxOpensPerStudent: { type: Number, default: null },
  
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

// ADD: Pre-save validation to prevent duplicate items
MysteryBoxSchema.pre('save', function(next) {
  const itemIds = this.itemPool.map(p => p.item.toString());
  const uniqueItemIds = new Set(itemIds);
  
  if (itemIds.length !== uniqueItemIds.size) {
    return next(new Error('Duplicate items are not allowed in the item pool. Each item can only be added once.'));
  }
  
  // Validate total drop chance equals 100%
  const totalChance = this.itemPool.reduce((sum, p) => sum + p.baseDropChance, 0);
  if (Math.abs(totalChance - 100) > 0.01) { // Allow small floating point error
    return next(new Error(`Total drop chance must equal 100% (currently ${totalChance.toFixed(2)}%)`));
  }
  
  next();
});

module.exports = mongoose.model('MysteryBox', MysteryBoxSchema);