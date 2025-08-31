const mongoose = require('mongoose');

const FeedbackSchema = new mongoose.Schema({
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: false,
    trim: true
  },
  classroom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Classroom',
    required: false
  },
  hidden: {
    type: Boolean,
    default: false
  },
  hiddenBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  // IP address captured for anonymous / unauthenticated rate-limiting
  ip: {
    type: String,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: false 
  },
  anonymous: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model('Feedback', FeedbackSchema);