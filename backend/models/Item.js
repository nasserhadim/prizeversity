const mongoose = require('mongoose');
const { Schema, model } = mongoose;
//mystery award box sechema
const RewardSchema = new mongoose.Schema({
  itemId: {type: Schema.Types.ObjectId, ref: "Item", required: true},
  weight: {type: Number, min: 0, required: true}
}, {_id: false});


// ItemSchema is the document where all the information of the items created per bazaar is stored.

const ItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  image: { type: String, default: 'placeholder.jpg' },
  bazaar: { type: mongoose.Schema.Types.ObjectId, ref: 'Bazaar', required: true },
  category: {
    type: String,
    enum: ['Attack', 'Defend', 'Utility', 'Passive', 'Mystery'],
    default: 'Utility',
  },

  //only items for mysterybox
kind: { type: String, enum: ['standard', 'mystery_box'], default: 'standard' },

  
  // Primary effect configuration
  primaryEffect: { 
    type: String,
    required: function() { return this.category !== 'Passive' && this.category !== 'Mystery'; }
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
  active: { type: Boolean, default: false },
  
  //listing possible prizes, array of items with a weight that affects, so putting this list inside a nested sechema keeps it well orgnaized
  metadata: {
    rewards: { type: [RewardSchema], default: [] }, //which kind of mysterybox
    openDelay: { type: Number, min: 0, default: 0 },
    dailyOpenLimit: { type: Number, min: 0, default: 0 }
},
  
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});
ItemSchema.index({ bazaar: 1, category: 1 });

//making sure teacher entering mystery box is all validated
ItemSchema.pre('validate', function (next) {
  if (this.category === 'Mystery') {
    if (this.kind !== 'mystery_box') {
      this.kind = 'mystery_box';
    }
    const pool = this.metadata?.rewards || [];
    const hasPositive = pool.some(r => (r.weight ?? 0) > 0);
    //if (!hasPositive) {
      //return next(new Error('Mystery box must have at least one reward with positive weight.'));
 // }
  }
  if (this.kind === 'mystery_box' && this.category !== 'Mystery') {
    this.category = 'Mystery';
  }
  next();
});


module.exports = mongoose.model('Item', ItemSchema);