import mongoose from 'mongoose';

// Badge schema per classroom
const badgeSchema = new mongoose.Schema({
  // Badge title
  name: {
    type: String,
    required: true
  },

  // Short description shown under badge
  description: {
    type: String
  },

  // Level needed to unlock
  levelRequired: {
    type: Number,
    required: true,
    min: 1
  },

  // Emoji/icon displayed with badge
  icon: {
    type: String,
    default: "🏅"
  },

  // Optional image for badge
  imageUrl: {
    type: String
  },

  // Which classroom this badge belongs to
  classroom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Classroom',
    required: true
  },

  // Teacher who created the badge
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Timestamp
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Badge', badgeSchema);