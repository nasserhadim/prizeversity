const mongoose = require('mongoose');

// The Siphon Request feature will be used to keep all request in a group if one of the members wins bits unfairly

const VoteSchema = new mongoose.Schema({
  user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vote:   { type: String, enum: ['yes','no'], required: true },
  _id:    false                               
});

const SiphonRequestSchema = new mongoose.Schema({
  group:        { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  requestedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetUser:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reasonHtml:   { type: String, required: true },
  amount:       { type: Number,  min: 1, required: true },
  requestedPercent: { type: Number, min: 1, max: 100 },
  classroom:    { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
  expiresAt:    { type: Date, required: true }, // Auto-expire date

  status:       {                                            
    type: String,
    enum: ['pending',           
           'group_approved',    
           'teacher_approved',  
           'rejected',
           'expired'],
    default: 'pending'
  },

  votes: [VoteSchema],
  createdAt:   { type: Date, default: Date.now },
  
  proof: {
    originalName: String,
    storedName: String,
    mimeType: String,
    size: Number
  }
});

// Add index for auto-expiration
SiphonRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports =
  mongoose.models.SiphonRequest || mongoose.model('SiphonRequest', SiphonRequestSchema);
