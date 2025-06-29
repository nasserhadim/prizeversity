const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  image: { type: String, default: 'placeholder.jpg' },
  bazaar: { type: mongoose.Schema.Types.ObjectId, ref: 'Bazaar', required: true },
  category: { type: String, enum: ['Attack', 'Defend', 'Utility'], required: true },
  effect: { type: String }, // 'halveBits', 'stealBits', 'shield'
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  active: { type: Boolean, default: false },
  usesRemaining: { type: Number, default: 1 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Item', ItemSchema);
