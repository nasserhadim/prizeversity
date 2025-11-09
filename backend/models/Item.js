const mongoose = require('mongoose');
const { Schema, model } = mongoose;
//mystery award box sechema
const RewardSchema = new mongoose.Schema({
  itemId: {type: Schema.Types.ObjectId, ref: "Item", required: true},
  weight: {type: Number, min: 1, required: true}
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
  duration: {type: Number, default: 0, min: 0, max: 8760 },
  active: { type: Boolean, default: false },
  //marking an ownerd mustery box as opened
  openedAt: { type: Date, default: null },

  //soft deleting filed 
  deletedAt: { type: Date, default: null },
  
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

//automatically hide soft deleted items on all .find() queries and findone()
ItemSchema.pre(/^find/, function (next) {
  //allowing explicit override 
  const withDeleted = this.getOptions && this.getOptions().withDeleted;
  if (!withDeleted) this.where({ deletedAt: null });
  next();
});


//making sure teacher entering mystery box is all validated
// making sure teacher entering mystery box is all validated
ItemSchema.pre('validate', function (next) {
  let hasPositive = false;

  if (this.category === 'Mystery') {
    if (this.kind !== 'mystery_box') {
      this.kind = 'mystery_box';
    }
    const pool = this.metadata?.rewards || [];
    hasPositive = pool.some(r => (r.weight ?? 0) > 0);

    // If creating a new Mystery box, require at least one reward
    if (this.isNew && !hasPositive) {
      return next(new Error('Mystery box must have at least one reward with positive weight.'));
    }
  }

  // Keep kind/category in sync if someone sets kind first
  if (this.kind === 'mystery_box' && this.category !== 'Mystery') {
    this.category = 'Mystery';
  }

  next();
});


ItemSchema.statics.setMysteryRewards = async function (boxId, rewards) {
  const Item = this;
  const box = await Item.findById(boxId);
  if (!box) throw new Error('Mystery box not found');
  if (box.kind !== 'mystery_box' || box.category !== 'Mystery') {
    throw new Error('Item is not a mystery box');
  }

  if (!Array.isArray(rewards) || !rewards.some(r => Number(r.weight) > 0)) {
    throw new Error('Provide at least one reward with weight > 0');
  }

  const itemIds = rewards.map(r => r.itemId);
  const count = await Item.countDocuments({
    _id: { $in: itemIds },
    bazaar: box.bazaar,
    deletedAt: null
  });
  if (count !== itemIds.length) {
    throw new Error('Some rewards are invalid or not in this bazaar');
  }

  // de-dupe and coerce
  const map = new Map();
  for (const r of rewards) {
    const w = Number(r.weight);
    if (w > 0) map.set(String(r.itemId), { itemId: r.itemId, weight: w });
  }
  box.metadata.rewards = Array.from(map.values());
  await box.save();
  return box.metadata.rewards;
};



module.exports = mongoose.model('Item', ItemSchema);