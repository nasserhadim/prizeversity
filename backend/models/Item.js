// const mongoose = require('mongoose');

// // ItemSchema is the document where all the information of the items created per bazaar is stored.


// const ItemSchema = new mongoose.Schema({

//   // Primary effect configuration
//   primaryEffect: { 
//     type: String,
//     required: function() { return this.category !== 'Passive' }
//   },
//   primaryEffectValue: { type: Number },
  
//   // Secondary effects configuration
//   secondaryEffects: [{
//     effectType: String,
//     value: Number
//   }],
  
//   // Usage tracking
//   usesRemaining: { 
//     type: Number, 
//     default: function() {
//       return this.category === 'Defend' ? 1 : undefined;
//     }
//   },
//   active: { type: Boolean, default: false },
  
//   owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//   createdAt: { type: Date, default: Date.now }
// });

// module.exports = mongoose.model('Item', ItemSchema);


const mongoose = require('mongoose');

// ItemSchema is the document where all the information of the items created per bazaar is stored.

const ItemSchema = new mongoose.Schema({
  // Basic item info
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },

  // Pricing info
  price: { type: Number, required: true, min: 0 }, // no rounding/flooring here

  // Image file/url path
  image: { type: String, default: 'placeholder.jpg', trim: true },

  // Links each item to a specific bazaar
  bazaar: { type: mongoose.Schema.Types.ObjectId, ref: 'Bazaar', required: true },

  // Category: determines type of item
  category: {
    type: String,
    enum: ['Attack', 'Defend', 'Utility', 'Passive'],
    default: 'Utility',
  },

  // ---- Original effect/usage fields ----

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

  active: { type: Boolean, default: false },

  // Track who owns the item
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Timestamp
  createdAt: { type: Date, default: Date.now }
});

// Helpful indexes for faster queries
ItemSchema.index({ bazaar: 1, createdAt: -1 });
ItemSchema.index({ category: 1, bazaar: 1 });

module.exports = mongoose.model('Item', ItemSchema);
