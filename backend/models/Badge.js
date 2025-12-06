const mongoose = require('mongoose');

const BadgeSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 100
  },
  description: { 
    type: String, 
    required: true,
    maxlength: 500
  },
  classroom: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Classroom', 
    required: true 
  },
  levelRequired: { 
    type: Number, 
    required: true,
    min: 1
  },
  icon: { 
    type: String, 
    default: '🏅' 
  },
  image: { 
    type: String, 
    default: '' 
  },
  // Optional: Link badges to bazaar items
  unlockedBazaarItems: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Item' 
  }],
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true
});

BadgeSchema.index({ classroom: 1, levelRequired: 1 });
BadgeSchema.index({ classroom: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Badge', BadgeSchema);