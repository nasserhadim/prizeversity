const mongoose = require('mongoose');
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Clear existing model to avoid OverwriteModelError in watch mode
delete mongoose.models['User'];
delete mongoose.connection.models['User'];

function generateShortId() {
  const letters =
    ALPHABET[Math.floor(Math.random() * 26)] +
    ALPHABET[Math.floor(Math.random() * 26)];
  const numbers = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return letters + numbers;
}

const TransactionSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  description: { type: String, required: true },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Classroom reference so transactions can be scoped per classroom
  classroom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Classroom',
    default: null
  },

  // Embedded item summaries for purchase transactions
  // this is so wallet can render thumbnails/effects even if the Item changes later
  items: [{
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
    name: String,
    description: String,
    price: Number,
    image: String,
    category: String,
    primaryEffect: String,
    primaryEffectValue: Number,
    secondaryEffects: [{ effectType: String, value: Number }]
  }],

  // Reference to Order when a checkout created an Order document
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },

  type: { type: String }, // e.g. 'purchase', 'transfer', etc.
  createdAt: { type: Date, default: Date.now },

  calculation: {
    baseAmount: Number,
    personalMultiplier: Number,
    groupMultiplier: Number,
    totalMultiplier: Number
  }
});

const UserSchema = new mongoose.Schema({
  googleId: { type: String },
  microsoftId: { type: String },

  email: { type: String, required: true },

  avatar: String,        // uploaded avatar filename
  profileImage: String,  // OAuth provider profile image URL

  firstName: { type: String },
  lastName: { type: String },

  // Store OAuth profile names temporarily this is used to prefill profile
  oauthFirstName: { type: String },
  oauthLastName: { type: String },

  role: {
    type: String,
    enum: ['admin', 'teacher', 'student']
  },

  balance: { type: Number, default: 0, min: 0 },

  isFrozen: { type: Boolean, default: false },

  // this will track when the user joined each classroom
  classroomJoinDates: [{
    classroom: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' },
    joinedAt: { type: Date, default: Date.now }
  }],

  // Per-classroom freeze flags: list of classroom ids where this user is frozen
  classroomFrozen: [{
    classroom: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' }
  }],

  groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],

  transactions: [TransactionSchema],

  isBanned: { type: Boolean, default: false },

  shieldActive: { type: Boolean, default: false },
  shieldCount: { type: Number, default: 0 },

  // this is for the discount shop status
  discountShop: { type: Boolean, default: false },
  discountPercent: { type: Number, default: 0 },
  discountExpiresAt: { type: Date, default: null },

  // Combat / challenge stats
  attackPower: { type: Number, default: 0 },

  // Passive stat attributes (used for items, mystery boxes, etc.)
  passiveAttributes: {
    luck: { type: Number, default: 1 },           // base 1, can be incremented
    multiplier: { type: Number, default: 1 },     // base 1x
    groupMultiplier: { type: Number, default: 1 } // base 1x
  },

  // Leveling System (this is scoped Per Classroom)
  // Each student has a separate XP and a Level per classroom.
  classroomBalances: [{
    classroom: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' },

    // this is Bits balance for this classroom
    balance: { type: Number, default: 0, min: 0 },

    // XP and Level specific to this classroom
    xp: { type: Number, default: 0, min: 0 },
    level: { type: Number, default: 1, min: 1 },

    // Per-classroom daily check-in timestamp this is used for 24h
    lastDailyCheckin: { type: Date, default: null },

    // these are the badges earned in this classroom
    badges: [{
      badge: { type: mongoose.Schema.Types.ObjectId, ref: 'Badge' },
      dateEarned: { type: Date, default: Date.now }
    }]
  }],

  // Short friendly id like "AB1234"
  shortId: {
    type: String,
    unique: true,
    required: true,
    match: /^[A-Z]{2}\d{4}$/
  }

}, {
  timestamps: true // automatically adds createdAt and updatedAt
});

// this will generate a unique shortId before validation if it's missing
UserSchema.pre('validate', async function (next) {
  if (this.shortId) return next();

  let candidate;
  let exists = true;

  while (exists) {
    candidate = generateShortId();
    exists = await mongoose.models.User.exists({ shortId: candidate });
  }

  this.shortId = candidate;
  next();
});

module.exports = mongoose.model('User', UserSchema);
