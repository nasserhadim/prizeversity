const mongoose = require('mongoose');
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
  createdAt: { type: Date, default: Date.now }
});

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
  isFrozen: { type: Boolean, default: false },
  classrooms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' }],
  groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
  transactions: [TransactionSchema],
  isBanned: { type: Boolean, default: false },
  shieldActive: { type: Boolean, default: false },
  discountShop: { type: Boolean, default: false },
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

module.exports = mongoose.model('User', UserSchema);