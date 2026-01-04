const mongoose = require('mongoose');
const { Schema } = mongoose;

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

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
  // <-- add classroom reference so transactions can be scoped per classroom
  classroom: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', default: null },
  // Embedded item summaries for purchase transactions (so wallet can render thumbnails/effects)
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
    totalMultiplier: Number,
  }
});

const ClassroomStatsSchema = new Schema(
  {
    classroom: { type: Schema.Types.ObjectId, ref: 'Classroom', required: true, index: true },
    passiveAttributes: {
      multiplier: { type: Number, default: 1 },
      luck: { type: Number, default: 1 },
      discount: { type: Number, default: 0 },
    },
    shieldCount: { type: Number, default: 0 },
    shieldActive: { type: Boolean, default: false },
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema({
  googleId: { type: String },
  microsoftId: { type: String },
  email: { type: String, required: true },
  avatar: String, // uploaded avatar filename
  profileImage: String, // OAuth provider profile image URL
  firstName: { type: String },
  lastName: { type: String },
  // Add these fields to store OAuth profile names temporarily
  oauthFirstName: { type: String }, // Temporary storage for OAuth first name
  oauthLastName: { type: String },  // Temporary storage for OAuth last name
  role: { type: String, enum: ['admin', 'teacher', 'student']/*, default: 'student' */ },
  balance: { type: Number, default: 0, min: 0 },
  isFrozen: { type: Boolean, default: false }, // Add default: false here
  // Per-classroom balances (new)
  classroomBalances: [{
    classroom: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' },
    balance: { type: Number, default: 0, min: 0 }
  }],
  // Add classroom join dates tracking
  classroomJoinDates: [{
    classroom: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' },
    joinedAt: { type: Date, default: Date.now },
    // NEW: track per-classroom last access
    lastAccessed: { type: Date, default: Date.now }
  }],
  // Per-classroom freeze flags: list of classroom ids where this user is currently frozen
  classroomFrozen: [{
    classroom: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' }
  }],
  groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
  transactions: [TransactionSchema],
  isBanned: { type: Boolean, default: false },
  shieldActive: { type: Boolean, default: false },
  shieldCount: { type: Number, default: 0 },
  discountShop: { type: Number, default: 0, min: 0, max: 100 },
  attackPower: { type: Number, default: 0 },
  // New passive stat attributes
  passiveAttributes: {
    luck: { type: Number, default: 1 },               // base 0, can be incremented
    multiplier: { type: Number, default: 1 },         // base 1x
    groupMultiplier: { type: Number, default: 1 }, // base 1x
  },
  shortId: {
    type: String,
    unique: true,
    required: true,
    match: /^[A-Z]{2}\d{4}$/,
  },

  // Add classroom-specific XP and levels
  classroomXP: [{
    classroom: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Classroom' 
    },
    xp: { 
      type: Number, 
      default: 0,
      min: 0
    },
    level: { 
      type: Number, 
      default: 1,
      min: 1
    },
    lastDailyCheckIn: { 
      type: Date 
    },
    earnedBadges: [{
      badge: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Badge' 
      },
      earnedAt: { 
        type: Date, 
        default: Date.now 
      }
    }],
    // NEW: equipped badge for this classroom
    equippedBadge: { type: mongoose.Schema.Types.ObjectId, ref: 'Badge', default: null }
  }],
  classroomStats: { type: [ClassroomStatsSchema], default: [] },
}, { 
  timestamps: true  // This should be here to automatically add createdAt and updatedAt
});

UserSchema.pre('validate', async function (next) {
  if (this.shortId) return next();
  let candidate; let exists = true;
  while (exists) {
    candidate = generateShortId();
    exists = await mongoose.models.User.exists({ shortId: candidate });
  }
  this.shortId = candidate;
  next();
});

// NEW: shortId must never change once it exists in DB (prevents "changing on refresh")
UserSchema.pre('save', async function (next) {
  try {
    if (!this.isNew && this.isModified('shortId')) {
      const prev = await mongoose.models.User.findById(this._id).select('shortId').lean();
      const prevSid = prev?.shortId;

      // Allow backfill if previously missing; otherwise block changes
      if (prevSid && String(prevSid) !== String(this.shortId)) {
        return next(new Error(`shortId is immutable (attempted ${prevSid} -> ${this.shortId})`));
      }
    }
    return next();
  } catch (e) {
    return next(e);
  }
});

module.exports = mongoose.model('User', UserSchema);